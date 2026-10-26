"""Essay marking pipeline

Two independent switches give the four experiment conditions:
  A: neither   B: checklist   C: model essays   D: both
Only the scoring step differs between conditions; the annotation and
feedback call is the same in all four, so the experiment varies one thing.

The checklist depends only on the rubric and the assignment (question, band,
format, theme), so it is built once per batch, shown to the teacher, and then
used for every essay in the batch.
"""

import json
import time

from config import WEAKNESS_TAGS
from db import get_conn
from services import vector_store
from services.extract import extract_text
from services.llm import MODEL, chat_json

PROMPT_VERSION = "mark-v2"  # v2: one checklist per batch instead of per essay
MAX_MODEL_ESSAYS = 3
MODEL_ESSAY_CHAR_LIMIT = 6000  # per essay, to keep the prompt a sensible size
ANNOTATION_TYPES = {"grammar", "spelling", "vocabulary", "content", "strength"}


# ---------- Rubric ----------

def criteria_from_bands(bands):
    """[{name, max}] in rubric order, e.g. [{"Content", 10}, {"Language", 20}]."""
    criteria = {}
    for b in bands:
        criteria[b["criterion"]] = max(criteria.get(b["criterion"], 0), b["max_mark"])
    return [{"name": name, "max": top} for name, top in criteria.items()]


def band_for(bands, criterion, mark):
    return next(
        (b for b in bands if b["criterion"] == criterion and b["min_mark"] <= mark <= b["max_mark"]),
        None,
    )


def _rubric_text(bands, with_descriptors=True):
    lines = []
    for c in criteria_from_bands(bands):
        lines.append(f"Criterion: {c['name']} (out of {c['max']})")
        for b in sorted((b for b in bands if b["criterion"] == c["name"]), key=lambda b: -b["band"]):
            marks = f"{b['min_mark']}–{b['max_mark']}" if b["min_mark"] != b["max_mark"] else str(b["min_mark"])
            line = f"- Band {b['band']} ({marks} marks)"
            lines.append(f"{line}: {b['descriptor']}" if with_descriptors else line)
    return "\n".join(lines)


# ---------- LLM calls with validation ----------

# A reply with the wrong shape (missing keys, text where an object should be)
# raises one of these; JSONDecodeError is a ValueError
BAD_REPLY = (ValueError, KeyError, TypeError, AttributeError)


def _items(data, key):
    """The list under data[key], keeping only objects (models sometimes put plain text in)."""
    if not isinstance(data, dict) or not isinstance(data.get(key), list):
        raise ValueError(f'expected a JSON object with a "{key}" list')
    return [item for item in data[key] if isinstance(item, dict)]


def _whole_number(value):
    """6, 6.0 or "6" -> 6; anything else -> None."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def _ask(prompt, validate):
    """Call the LLM for JSON and validate it, retrying once on a bad response."""
    try:
        return validate(chat_json(prompt))
    except BAD_REPLY as e:
        error = e
    # At temperature 0 the same prompt gives the same reply, so the retry says
    # what was wrong with the first one
    retry = (
        f"{prompt}\n\nYour previous reply could not be used ({type(error).__name__}: {error}). "
        "Return ONLY the JSON object in exactly the format above: no comments, no trailing "
        "commas, and every field filled in."
    )
    try:
        return validate(chat_json(retry))
    except BAD_REPLY as e:
        raise ValueError(f"The AI returned an invalid response twice: {e}")


def _validate_scores(bands):
    criteria = criteria_from_bands(bands)

    def validate(data):
        by_name = {str(s.get("criterion", "")).strip().lower(): s for s in _items(data, "scores")}
        scores = []
        for c in criteria:
            s = by_name.get(c["name"].lower())
            if s is None:
                raise ValueError(f"no score for {c['name']}")
            mark = _whole_number(s.get("mark"))
            if mark is None or not 0 <= mark <= c["max"]:
                raise ValueError(
                    f"{c['name']} mark {s.get('mark')!r} is not a whole number from 0 to {c['max']}"
                )
            # The band always comes from the mark, so the two can't disagree
            band = band_for(bands, c["name"], mark)
            scores.append({
                "criterion": c["name"],
                "max": c["max"],
                "mark": mark,
                "band": band["band"] if band else None,
                "reason": str(s.get("reason", "")).strip(),
            })
        return scores

    return validate


def _validate_checklist(data):
    checklist = [
        {"criterion": str(q["criterion"]), "band": int(q["band"]), "question": str(q["question"]).strip()}
        for q in _items(data, "checklist")
        if str(q.get("question", "")).strip()
    ]
    if not checklist:
        raise ValueError("empty checklist")
    return checklist


def _validate_annotations(data):
    annotations = []
    for a in _items(data, "annotations"):
        quote, comment = str(a.get("quote", "")).strip(), str(a.get("comment", "")).strip()
        if not quote or not comment:
            continue  # drop incomplete items rather than fail the whole essay
        kind = str(a.get("type", "")).strip().lower()
        annotations.append({
            "type": kind if kind in ANNOTATION_TYPES else "content",
            "quote": quote,
            "suggestion": str(a.get("suggestion") or "").strip(),
            "comment": comment,
        })
    feedback = data.get("feedback")
    if isinstance(feedback, list):  # sometimes given as a list of paragraphs
        feedback = "\n\n".join(str(p) for p in feedback)
    feedback = str(feedback or "").strip()
    if not feedback:
        raise ValueError("empty feedback")
    tags = data.get("weakness_tags") or []
    if isinstance(tags, str):
        tags = [tags]
    tags = [t for t in tags if t in WEAKNESS_TAGS][:3]
    return {"annotations": annotations, "feedback": feedback, "weakness_tags": tags}


# ---------- Model essays (factor 2) ----------

def find_model_essays(question, format, theme, band):
    """Return [{file_id, filename, text}] for up to 3 matching model essays.

    Chunks are retrieved with metadata filters, grouped by file, and each
    file's full text is loaded so an essay is never shown in fragments.
    If nothing matches, the theme filter is relaxed once.
    """
    query = question or f"{format} essay about {theme}"
    for use_theme in (True, False):
        conditions = [
            {"doc_type": "Model essay"},
            {"sbb": {"$in": [band, ""]}},
            {"format": {"$in": [format, ""]}},
        ]
        if use_theme:
            conditions.append({"theme": {"$in": [theme, ""]}})
        file_ids = []
        for chunk in vector_store.query(query, {"$and": conditions}, 20):
            file_id = chunk["metadata"]["file_id"]
            if file_id not in file_ids:
                file_ids.append(file_id)
        if file_ids:
            break

    essays = []
    with get_conn() as conn:
        for file_id in file_ids[:MAX_MODEL_ESSAYS]:
            row = conn.execute(
                "SELECT filename, stored_path FROM library_files WHERE id = ?", (file_id,)
            ).fetchone()
            if row:
                text = extract_text(row["stored_path"]).strip()[:MODEL_ESSAY_CHAR_LIMIT]
                essays.append({"file_id": file_id, "filename": row["filename"], "text": text})
    return essays


def _model_essays_text(model_essays):
    if not model_essays:
        return ""
    blocks = [
        f"[Model essay {i}: {e['filename']}]\n{e['text']}" for i, e in enumerate(model_essays, 1)
    ]
    return (
        "\nModel essays from the teacher's library, written for this kind of task. Use them only as "
        "reference examples of the expected standard; do NOT mark them.\n\n"
        + "\n\n---\n\n".join(blocks)
        + "\n"
    )


# ---------- Prompts ----------

def _task(question, format, theme, band):
    return (
        f"Full SBB band: {band}\nEssay format: {format}\nTheme: {theme}\n"
        f"Essay question: {question or '(not given)'}"
    )


CHECKLIST_PROMPT = """You are an experienced Singapore secondary school English teacher.
Turn this marking rubric into a checklist for the essay question below.

{task}

Rubric:
{rubric}

For every criterion and every band above band 0, write one to three specific yes/no questions that a marker could answer from the essay text, and that would show the essay reaches that band. Make them specific to this question (e.g. "Does the essay take a clear position on whether school uniforms should be abolished?"), not generic.

Return ONLY a JSON object:
{{"checklist": [{{"criterion": str, "band": int, "question": str}}]}}"""


SCORE_DIRECT_PROMPT = """You are an experienced Singapore secondary school English teacher marking a student's essay.

{task}

Rubric:
{rubric}
{model_essays}
Student essay:
<essay>
{essay}
</essay>

For each criterion, decide which band the essay is in, then give a whole-number mark within that band's range, with a one-sentence reason that refers to the essay.

Return ONLY a JSON object:
{{"scores": [{{"criterion": str, "band": int, "mark": int, "reason": str}}]}}"""


SCORE_CHECKLIST_PROMPT = """You are an experienced Singapore secondary school English teacher marking a student's essay.

{task}

Mark ranges of each band:
{rubric}

Checklist (each question gives evidence that the essay reaches a band):
{checklist}
{model_essays}
Student essay:
<essay>
{essay}
</essay>

First answer every checklist question with "yes" or "no", quoting short evidence from the essay.
Then, for each criterion, use those answers to decide the band, and give a whole-number mark within that band's range, with a one-sentence reason.

Return ONLY a JSON object:
{{"answers": [{{"criterion": str, "band": int, "question": str, "answer": "yes" | "no", "evidence": str}}],
 "scores": [{{"criterion": str, "band": int, "mark": int, "reason": str}}]}}"""


ANNOTATE_PROMPT = """You are an experienced Singapore secondary school English teacher giving feedback on a student's essay.

{task}
Teacher's marking focus: {focus}

Rubric:
{rubric}

Marks given:
{scores}

Student essay:
<essay>
{essay}
</essay>

Write:
1. "annotations": 6 to 12 comments on specific passages. Each has
   - "type": one of "grammar", "spelling", "vocabulary" (word choice), "content", "strength" (include at least two strengths)
   - "quote": the exact words from the essay, copied character for character, a few words to one sentence long
   - "suggestion": corrected wording, or "" if there is none (always "" for strengths)
   - "comment": one short sentence explaining the point to the student
   Pay extra attention to the teacher's marking focus, if there is one.
2. "feedback": overall feedback to the student in two or three short paragraphs: what they did well, the one or two most important things to improve, and a concrete next step. Write simply enough for a {band} student, and address them as "you".
3. "weakness_tags": up to three of these, for the essay's main weaknesses: {tags}

Return ONLY a JSON object:
{{"annotations": [{{"type": str, "quote": str, "suggestion": str, "comment": str}}], "feedback": str, "weakness_tags": [str]}}"""


# ---------- Pipeline ----------

def build_checklist(bands, question, format, theme, band):
    """Stage 1: turn the rubric into yes/no questions for this assignment."""
    return _ask(
        CHECKLIST_PROMPT.format(task=_task(question, format, theme, band), rubric=_rubric_text(bands)),
        _validate_checklist,
    )


def mark_essay(essay, bands, question, format, theme, band, focus, checklist, use_model_essays):
    """Mark one essay. checklist is the batch's checklist, or None to score directly
    against the rubric. Returns scores, annotations, feedback, tags and run details."""
    started = time.monotonic()
    task = _task(question, format, theme, band)

    model_essays = find_model_essays(question, format, theme, band) if use_model_essays else []
    model_text = _model_essays_text(model_essays)

    if checklist:
        checklist_text = "\n".join(
            f"- [{q['criterion']}, band {q['band']}] {q['question']}" for q in checklist
        )
        # Stage 2: apply the batch's checklist to this essay
        prompt = SCORE_CHECKLIST_PROMPT.format(
            task=task, rubric=_rubric_text(bands, with_descriptors=False),
            checklist=checklist_text, model_essays=model_text, essay=essay,
        )
    else:
        prompt = SCORE_DIRECT_PROMPT.format(
            task=task, rubric=_rubric_text(bands), model_essays=model_text, essay=essay
        )
    scores = _ask(prompt, _validate_scores(bands))

    scores_text = "\n".join(
        f"- {s['criterion']}: {s['mark']}/{s['max']} (band {s['band']}). {s['reason']}" for s in scores
    )
    feedback = _ask(
        ANNOTATE_PROMPT.format(
            task=task, focus=focus or "(none)", rubric=_rubric_text(bands),
            scores=scores_text, essay=essay, band=band, tags=json.dumps(WEAKNESS_TAGS),
        ),
        _validate_annotations,
    )

    return {
        "scores": scores,
        **feedback,
        "model_essays": [{"file_id": e["file_id"], "filename": e["filename"]} for e in model_essays],
        "model_name": MODEL,
        "prompt_version": PROMPT_VERSION,
        "latency_ms": int((time.monotonic() - started) * 1000),
    }
