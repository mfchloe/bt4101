from llm import chat_json

PROMPT = """Extract every band from this marking rubric as JSON.
Return ONLY a JSON object: {{"bands": [{{"criterion": str, "band": int, "min_mark": int, "max_mark": int, "descriptor": str}}]}}
- "criterion" is the short name of the assessed area as written in the table heading (e.g. "Content", "Language"), not the list of sub-points under it.
- One object per band per criterion; do not duplicate rows.
- Copy descriptors word for word; join multiple bullet points with "; ".

Rubric text:
{text}"""


def extract_rubric_bands(text):
    """Use the LLM to turn rubric text into a list of band rows."""
    return chat_json(PROMPT.format(text=text))["bands"]
