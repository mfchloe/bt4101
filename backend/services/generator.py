import re

import numpy as np

from services import vector_store
from services.extract import chunk_text
from services.llm import chat

PROMPT_VERSION = "gen-v2"
RETRIEVED_DOC_TYPES = ["Lesson notes", "Model essay"]
TOP_K = 6
SESSION_CHAR_LIMIT = 8000  # longer session files are cut down to their most relevant chunks

# What each material type should contain; the LLM writes one ## section per item
MATERIAL_TEMPLATES = {
    "Worksheet": (
        "A student-facing worksheet. Sections: Learning objective; Instructions; "
        "two to four tasks that build in difficulty (one ## section per task); "
        "Answer guide (for the teacher)."
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


def _request_summary(band, material_type, format, theme, instructions):
    return "\n".join([
        "Subject: Singapore secondary school English Language (composition writing).",
        f"Full SBB band: {band}. {BAND_GUIDANCE[band]}",
        f"Material type: {material_type}. {MATERIAL_TEMPLATES[material_type]}",
        f"Essay format: {format or 'any'}.",
        f"Theme: {theme or 'any'}.",
        f"Teacher's instructions: {instructions or '(none)'}",
    ])


GENERATE_PROMPT = """You are helping a Singapore secondary school English teacher prepare teaching material.

{request}

Reference material from the teacher's library and session files:
{context}

Write the material in Markdown.
- Start with one line "# <title>", then one "## <section title>" heading per section. Do not use ## anywhere else.
- Base the content on the reference material where it is relevant: reuse its examples, terms and structures, and do not contradict it.
- Put answers, marking guides and any other teacher-only content in sections at the very end, with titles starting "Answer guide" or "Marking guide". Student-facing sections must not contain answers.
- Do not mention the reference labels (e.g. "[Library: ...]") in the material.
- Output only the material, with no introduction or closing remarks."""


SECTION_PROMPT = """You are helping a Singapore secondary school English teacher revise teaching material.

{request}

Reference material from the teacher's library and session files:
{context}

Here is the full current material:
<material>
{material}
</material>

Rewrite only the section titled "{section}". Keep it consistent with the rest of the material and the band guidance, but make it a fresh version.
Output only the new body of that section in Markdown, without its "## {section}" heading and without any ## headings."""


def strip_fences(text):
    """Remove a ```markdown ... ``` wrapper if the LLM added one."""
    match = re.fullmatch(r"\s*```(?:markdown|md)?\s*\n(.*?)\n```\s*", text, re.DOTALL)
    return (match.group(1) if match else text).strip()


def generate(band, material_type, format, theme, instructions, chunks, filenames, session_files):
    prompt = GENERATE_PROMPT.format(
        request=_request_summary(band, material_type, format, theme, instructions),
        context=_context(chunks, filenames, session_files),
    )
    return strip_fences(chat(prompt))


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


def regenerate_section(band, material_type, format, theme, instructions,
                       material, section_title, chunks, filenames, session_files):
    """Return the material with one section rewritten, or None if the section isn't found."""
    preamble, sections = split_sections(material)
    match = next((s for s in sections if s[0] == section_title), None)
    if match is None:
        return None

    prompt = SECTION_PROMPT.format(
        request=_request_summary(band, material_type, format, theme, instructions),
        context=_context(chunks, filenames, session_files),
        material=material,
        section=section_title,
    )
    # Drop any heading the LLM repeats, so the section count stays the same
    body = strip_fences(chat(prompt))
    match[1] = "\n".join(line for line in body.split("\n") if not line.startswith("## "))
    return join_sections(preamble, sections)
