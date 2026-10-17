from services.llm import chat_json

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


def validate_bands(bands):
    """Return an error message if the bands can't be used for marking, else None.

    Each band is a (file_id, criterion, band, min_mark, max_mark, descriptor) tuple.
    """
    if not bands:
        return "Add at least one band before saving"
    by_criterion = {}
    for _, criterion, band, min_mark, max_mark, _ in bands:
        if not criterion:
            return "Every band needs a criterion"
        if min_mark < 0 or min_mark > max_mark:
            return f"{criterion} band {band}: marks must satisfy 0 ≤ min ≤ max"
        by_criterion.setdefault(criterion, []).append((min_mark, max_mark, band))
    # Within a criterion, each mark must fall in at most one band
    for criterion, ranges in by_criterion.items():
        ranges.sort()
        for (_, prev_max, prev_band), (lo, _, band) in zip(ranges, ranges[1:]):
            if lo <= prev_max:
                return f"{criterion}: bands {prev_band} and {band} have overlapping marks"
    return None
