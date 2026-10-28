import re

import numpy as np
from spellchecker import SpellChecker

from services import vector_store
from services.extract import chunk_text
from services.llm import chat, chat_json

PROMPT_VERSION = "gen-v3"  # v3: page limits, teacher's instructions take priority, proofreading
RETRIEVED_DOC_TYPES = ["Lesson notes", "Model essay"]
TOP_K = 6
SESSION_CHAR_LIMIT = 8000  # longer session files are cut down to their most relevant chunks

# Rough capacity of one printed A4 page of material (headings, tables and
# writing lines take space too), used to turn a page limit into a word budget
WORDS_PER_PAGE = 300
# Page limit used when the teacher's instructions don't give one
DEFAULT_PAGES = {"Worksheet": 3}
# Allow some slack before asking the LLM to shorten
LENGTH_TOLERANCE = 1.15

# What each material type should contain; the LLM writes one ## section per item
MATERIAL_TEMPLATES = {
    "Worksheet": (
        "A student-facing worksheet. Sections: Learning objective; Instructions; "
        "the tasks, building in difficulty (one ## section per task); "
        "Answer guide (for the teacher). Choose the number of tasks to fit the learning "
        "objective and the page limit; one or two well-developed tasks are often better "
        "than several thin ones, so do not default to three."
    ),
    "Lesson plan": (
        "A teacher-facing lesson plan. Sections: Learning objectives; Materials; "
        "Lesson sequence (each activity with a timing in minutes); "
        "Differentiation notes; Check for understanding."
    ),
    "Lesson activity": (
        "An in-class activity such as a discussion, peer review, starter or exit ticket. "
        "Sections: Purpose; Preparation; Steps (with timings); "
        "Student instructions; Debrief questions."
    ),
    "Questions and assessments": (
        "Questions for students, such as essay prompts, short-answer questions or a quiz. "
        "Group the questions into ## sections by type, then end with a Marking guide section."
    ),
    "Podcast": (
        "A script for students to listen to. Sections: Episode overview; "
        "Script (speaker labels such as HOST A: and HOST B:, one speaker per paragraph); "
        "Listening questions; Answer guide (for the teacher)."
    ),
    "Others": "Follow the teacher's instructions for what to produce, split into sensible sections.",
}
MATERIAL_TYPES = set(MATERIAL_TEMPLATES)

# How the material should differ across Full SBB bands
BAND_GUIDANCE = {
    "G1": (
        "G1 students need strong support. Use short sentences and everyday vocabulary, "
        "break tasks into small steps, give worked examples, sentence starters and word banks, "
        "and keep any reading passage short."
    ),
    "G2": (
        "G2 students need moderate support. Give a worked example for new skills, then move "
        "to guided and independent practice. Offer optional sentence starters and use "
        "age-appropriate vocabulary with brief explanations of harder words."
    ),
    "G3": (
        "G3 students can work independently. Use richer vocabulary and longer texts, ask "
        "higher-order questions (evaluate, compare, justify), keep scaffolding light, and "
        "include an extension task that stretches the strongest students."
    ),
}


def build_query(material_type, format, theme, instructions):
    """Combine the request into one text to embed for retrieval."""
    parts = [material_type, format and f"{format} writing", theme and f"theme: {theme}", instructions]
    return ". ".join(p for p in parts if p)


def _where(band, format, theme):
    conditions = [
        {"doc_type": {"$in": RETRIEVED_DOC_TYPES}},
        # "" means the file applies to every value of that field
        {"sbb": {"$in": [band, ""]}},
    ]
    if format:
        conditions.append({"format": {"$in": [format, ""]}})
    if theme:
        conditions.append({"theme": {"$in": [theme, ""]}})
    return {"$and": conditions}


def retrieve(query, band, format, theme, k=TOP_K):
    """Return (chunks, relaxed): up to k library chunks and the filters dropped to find them.

    Chunks matching every filter come first. If there are fewer than k, the theme
    filter and then the format filter are relaxed to fill the remaining places.
    """
    attempts = [((format, theme), [])]
    if theme:
        attempts.append(((format, ""), ["theme"]))
    if format:
        attempts.append((("", ""), ["theme", "format"] if theme else ["format"]))

    chunks, seen, relaxed = [], set(), []
    for (f, t), dropped in attempts:
        for chunk in vector_store.query(query, _where(band, f, t), k):
            if chunk["id"] not in seen and len(chunks) < k:
                seen.add(chunk["id"])
                chunks.append(chunk)
                relaxed = dropped
        if len(chunks) >= k:
            break
    return chunks, relaxed


def select_session_text(files, query, limit=SESSION_CHAR_LIMIT):
    """Return [(filename, text)] for the prompt. Session files stay in memory only.

    If the files are too long together, keep only their chunks most similar to the
    query, in their original order.
    """
    if sum(len(text) for _, text in files) <= limit:
        return files

    chunks = [(name, i, chunk) for name, text in files for i, chunk in enumerate(chunk_text(text))]
    vectors = np.array(vector_store.embed_fn([query] + [c for _, _, c in chunks]))
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    scores = vectors[1:] @ vectors[0]

    kept, used = set(), 0
    for idx in np.argsort(-scores):
        if used + len(chunks[idx][2]) > limit:
            break
        kept.add(idx)
        used += len(chunks[idx][2])

    selected = {}
    for idx, (name, _, chunk) in enumerate(chunks):
        if idx in kept:
            selected.setdefault(name, []).append(chunk)
    return [(name, "\n[...]\n".join(parts)) for name, parts in selected.items()]


def _context(chunks, filenames, session_files):
    blocks = []
    for chunk in chunks:
        meta = chunk["metadata"]
        name = filenames.get(meta["file_id"], "unknown file")
        blocks.append(f"[Library: {name} ({meta['doc_type']})]\n{chunk['text']}")
    for name, text in session_files:
        blocks.append(f"[Session file: {name}]\n{text}")
    return "\n\n---\n\n".join(blocks) or "(no reference material found)"


_NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "single": 1}
_PAGES = re.compile(r"\b(\d+|one|two|three|four|five|six|single)[\s-]*(?:a4[\s-]*)?(?:pages?|pager)\b", re.I)


def page_limit(material_type, instructions):
    """Pages the student-facing part must fit on: the teacher's "2 pages" if given, else the default."""
    match = _PAGES.search(instructions or "")
    if match:
        value = match.group(1).lower()
        return int(value) if value.isdigit() else _NUMBER_WORDS[value]
    return DEFAULT_PAGES.get(material_type)


def _length_rule(pages):
    if not pages:
        return "Keep the material focused; do not pad it."
    return (
        f"Length: the student-facing sections must fit on {pages} printed A4 "
        f"page{'s' if pages > 1 else ''}, so at most about {pages * WORDS_PER_PAGE} words in total "
        "(tables and writing space take room too). Teacher-only sections at the end are printed "
        "separately and do not count."
    )


def _request_summary(band, material_type, format, theme):
    return "\n".join([
        "Subject: Singapore secondary school English Language (composition writing).",
        f"Full SBB band: {band}. {BAND_GUIDANCE[band]}",
        f"Material type: {material_type}. {MATERIAL_TEMPLATES[material_type]}",
        f"Essay format: {format or 'any'}.",
        f"Theme: {theme or 'any'}.",
    ])


# Formatting rules shared by every prompt that writes material
STYLE_RULES = """- Use "#" only for the title and "##" only for section headings; inside a section use ### or **bold** text.
- For space where students write, put a short line of at most 30 underscores on its own line. In tables, leave answer cells empty instead of filling them with underscores.
- Write in British English and check the spelling. Do not write words in capital letters for emphasis; use **bold** instead."""

# The teacher's instructions go last, so they are the freshest thing in the
# model's context and clearly override the defaults above them
INSTRUCTIONS_BLOCK = """The teacher's instructions below take priority. Where they conflict with the defaults above (for example the number of tasks, the sections or the length), follow the teacher.
Teacher's instructions: {instructions}"""


GENERATE_PROMPT = """You are helping a Singapore secondary school English teacher prepare teaching material.

{request}

Reference material from the teacher's library and session files:
{context}

Write the material in Markdown.
- Start with one line "# <title>", then one "## <section title>" heading per section.
{style}
- {length}
- Base the content on the reference material where it is relevant: reuse its examples, terms and structures, and do not contradict it.
- Put answers, marking guides and any other teacher-only content in sections at the very end, with titles starting "Answer guide" or "Marking guide". Student-facing sections must not contain answers.
- Do not mention the reference labels (e.g. "[Library: ...]") in the material.
- Output only the material, with no introduction or closing remarks.

{instructions}"""


SECTION_PROMPT = """You are helping a Singapore secondary school English teacher revise teaching material.

{request}

Reference material from the teacher's library and session files:
{context}

Here is the full current material:
<material>
{material}
</material>

Rewrite only the section titled "{section}". Keep it consistent with the rest of the material and the band guidance, but make it a fresh version. Keep it about the same length or shorter.
{style}
Output only the new body of that section in Markdown, without its "## {section}" heading and without any ## headings.

{instructions}"""


SHORTEN_PROMPT = """You are helping a Singapore secondary school English teacher prepare teaching material.

{request}

Here is the material:
<material>
{material}
</material>

Its student-facing sections are about {words} words, but they must fit on {pages} printed A4 page{plural}: at most about {budget} words. Shorten them to fit, for example by dropping the least important task, trimming instructions and examples, or using less writing space. Update the teacher-only sections at the end to match.
Keep "# <title>" as the first line and one "## <section title>" heading per section, with answer and marking guides last.
{style}
Output only the full shortened material, with no introduction or closing remarks.

{instructions}"""


PROOFREAD_PROMPT = """A spell checker flagged these words in some teaching material for Singapore secondary school English:
{words}

Here is the material:
<material>
{material}
</material>

For each flagged word that is a real mistake (a typo, a misspelling, or a garbled word such as "DISAGOTREE" for "DISAGREE"), give the correct word as it should be written in that place. Leave out words that are correct, including names, British spellings, abbreviations and deliberate errors in exercises where students must find mistakes.
Reply with JSON only: {{"corrections": {{"<word as written>": "<correct word>"}}}}"""


def strip_fences(text):
    """Remove a ```markdown ... ``` wrapper if the LLM added one."""
    match = re.fullmatch(r"\s*```(?:markdown|md)?\s*\n(.*?)\n```\s*", text, re.DOTALL)
    return (match.group(1) if match else text).strip()


def fix_headings(markdown):
    """Turn any "# " heading after the title into a "## " section heading.

    Models sometimes write "# Answer guide", which would otherwise end up
    inside the last student-facing section (and be printed with it).
    """
    lines, seen_title = markdown.split("\n"), False
    for i, line in enumerate(lines):
        if line.startswith("# "):
            if seen_title:
                lines[i] = "#" + line
            seen_title = True
    return "\n".join(lines)


MAX_WRITING_LINE = 30


def clean_markdown(markdown):
    """Fix the structure and layout problems the model often ignores instructions about."""
    # Long underscore lines can't wrap, so they run off the page
    markdown = re.sub(r"_{%d,}" % (MAX_WRITING_LINE + 1), "_" * MAX_WRITING_LINE, markdown)
    return fix_headings(strip_fences(markdown))


def split_sections(markdown):
    """Split Markdown into (preamble, [[title, body], ...]) on "## " headings."""
    preamble, sections = [], []
    for line in markdown.split("\n"):
        if line.startswith("## "):
            sections.append([line[3:].strip(), []])
        elif sections:
            sections[-1][1].append(line)
        else:
            preamble.append(line)
    return "\n".join(preamble), [[title, "\n".join(body)] for title, body in sections]


def join_sections(preamble, sections):
    parts = [preamble.rstrip()] if preamble.strip() else []
    parts += [f"## {title}\n{body.strip()}" for title, body in sections]
    return "\n\n".join(parts) + "\n"


# ---------- Length ----------

# Same titles the frontend treats as teacher-only (printed on separate pages)
TEACHER_SECTION = re.compile(
    r"answer (guide|key|sheet)|answers\b|marking (guide|scheme)|mark scheme|solutions\b"
    r"|for the teacher|teacher'?s? (guide|notes|reference)",
    re.I,
)


def student_words(markdown):
    """Approximate printed size of the student-facing part, in words.

    Writing lines and table rows take a line of the page each, so they are
    counted as a few words on top of their text.
    """
    preamble, sections = split_sections(markdown)
    text = "\n".join([preamble] + [
        f"{title}\n{body}" for title, body in sections if not TEACHER_SECTION.search(title)
    ])
    words = len(re.findall(r"[A-Za-z0-9']+", text))
    writing_lines = len(re.findall(r"_{5,}", text))
    table_rows = sum(1 for line in text.split("\n") if line.lstrip().startswith("|"))
    return words + 8 * writing_lines + 4 * table_rows


def fit_to_pages(material, pages, request, instructions):
    """Ask the LLM to shorten the material once if it is clearly over its page limit."""
    if not pages:
        return material
    words, budget = student_words(material), pages * WORDS_PER_PAGE
    if words <= budget * LENGTH_TOLERANCE:
        return material
    shortened = clean_markdown(chat(SHORTEN_PROMPT.format(
        request=request, material=material, words=words, pages=pages,
        plural="s" if pages > 1 else "", budget=budget, style=STYLE_RULES,
        instructions=instructions,
    )))
    # Keep the original if the reply lost the section structure
    return shortened if split_sections(shortened)[1] else material


# ---------- Proofreading ----------

_spell = None
# British spellings that the (American) dictionary lacks, mapped to the American ending
_BRITISH = [("our", "or"), ("isation", "ization"), ("ise", "ize"), ("ising", "izing"),
            ("ised", "ized"), ("yse", "yze"), ("ysed", "yzed"), ("mme", "m"), ("tre", "ter"),
            ("ogue", "og"), ("ence", "ense"), ("lled", "led"), ("lling", "ling"), ("llor", "lor")]
MAX_FLAGGED = 40


def _known(word):
    global _spell
    if _spell is None:
        _spell = SpellChecker()
    word = word.lower().removesuffix("'s")
    if _spell.known([word]):
        return True
    return any(
        old in word and _spell.known([word.replace(old, new)]) for old, new in _BRITISH
    )


def flag_words(markdown):
    """Words the dictionary doesn't know, in order of first appearance."""
    flagged = {}
    for word in re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", markdown):
        if len(word) >= 3 and word not in flagged and not _known(word):
            flagged[word] = True
    return list(flagged)[:MAX_FLAGGED]


def _match_case(original, fix):
    if original.isupper():
        return fix.upper()
    if original[0].isupper():
        return fix[0].upper() + fix[1:]
    return fix


def proofread(markdown, context=None):
    """Fix misspelt and garbled words (e.g. "DISAGOTREE") in generated Markdown.

    A dictionary flags unknown words; the LLM then decides which are real
    mistakes, so names and British spellings are kept. context is the text the
    LLM sees around the words (defaults to the Markdown itself). Proofreading
    is best effort: if it fails, the text is returned unchanged.
    """
    flagged = flag_words(markdown)
    if not flagged:
        return markdown
    try:
        corrections = chat_json(PROOFREAD_PROMPT.format(
            words=", ".join(flagged), material=context or markdown
        )).get("corrections", {})
    except Exception:
        return markdown
    for word, fix in corrections.items():
        if word in flagged and isinstance(fix, str) and fix.strip() and fix != word:
            markdown = re.sub(rf"\b{re.escape(word)}\b", _match_case(word, fix.strip()), markdown)
    return markdown


# ---------- Generation ----------

def generate(band, material_type, format, theme, instructions, chunks, filenames, session_files):
    request = _request_summary(band, material_type, format, theme)
    pages = page_limit(material_type, instructions)
    teacher = INSTRUCTIONS_BLOCK.format(instructions=instructions or "(none)")
    prompt = GENERATE_PROMPT.format(
        request=request,
        context=_context(chunks, filenames, session_files),
        style=STYLE_RULES,
        length=_length_rule(pages),
        instructions=teacher,
    )
    # The service occasionally streams back an empty reply; try once more
    material = clean_markdown(chat(prompt)) or clean_markdown(chat(prompt))
    if not material:
        raise ValueError("the AI service returned an empty reply. Please try again.")
    material = fit_to_pages(material, pages, request, teacher)
    return proofread(material)


def regenerate_section(band, material_type, format, theme, instructions,
                       material, section_title, chunks, filenames, session_files):
    """Return the material with one section rewritten, or None if the section isn't found."""
    preamble, sections = split_sections(material)
    match = next((s for s in sections if s[0] == section_title), None)
    if match is None:
        return None

    prompt = SECTION_PROMPT.format(
        request=_request_summary(band, material_type, format, theme),
        context=_context(chunks, filenames, session_files),
        material=material,
        section=section_title,
        style=STYLE_RULES,
        instructions=INSTRUCTIONS_BLOCK.format(instructions=instructions or "(none)"),
    )
    # Drop any heading the LLM repeats, so the section count stays the same.
    # Only the new section is proofread; the rest may hold the teacher's own edits.
    body = clean_markdown(chat(prompt))
    body = "\n".join(line for line in body.split("\n") if not line.startswith(("# ", "## ")))
    match[1] = proofread(body)
    return join_sections(preamble, sections)
