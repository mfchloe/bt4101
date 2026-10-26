import io
import re
from statistics import median

import pdfplumber
from pypdf import PdfReader

from services.extract import extract_text
from services.llm import read_image

MAX_IMAGE_SIDE = 2000  # px; large scans are scaled down before OCR
MIN_PDF_TEXT = 100     # chars; a PDF with less text than this is treated as a scan

OCR_PROMPT = """This is a page of a student's handwritten or scanned essay.
Transcribe it exactly as written. Keep every spelling, grammar and punctuation mistake: the essay will be marked, so do not correct anything.
Separate paragraphs with a blank line, but join lines within a paragraph.
Write [illegible] for any word you cannot read.
Output only the transcribed text, as plain text: no Markdown, LaTeX or other formatting."""


def _ocr(image):
    """Transcribe one PIL image of a page with the vision LLM."""
    image = image.convert("RGB")
    image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return _clean_ocr(read_image(OCR_PROMPT, buffer.getvalue(), "image/jpeg"))


def _clean_ocr(text):
    """Remove formatting the vision model sometimes adds, e.g. "social \\(media\\)"."""
    text = re.sub(r"\\([()\[\]{}])", r"\1", text)   # LaTeX escapes: \( \) \[ \]
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)      # **bold**
    return text.strip()


def _pdf_lines(path):
    """Visual lines of a typed PDF: [{text, top, x0, x1, size, page}], in reading order."""
    lines = []
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages):
            words = page.extract_words(use_text_flow=True, extra_attrs=["size"])
            for w in words:
                line = lines[-1] if lines else None
                # Same line if on the same page and the tops are within half a font size
                if line and line["page"] == page_no and abs(w["top"] - line["top"]) < w["size"] / 2:
                    line["words"].append(w["text"])
                    line["x1"] = max(line["x1"], w["x1"])
                else:
                    lines.append({
                        "words": [w["text"]], "top": w["top"], "x0": w["x0"],
                        "x1": w["x1"], "size": w["size"], "page": page_no,
                    })
    for line in lines:
        line["text"] = " ".join(line.pop("words"))
    return lines


def reflow_pdf_text(path):
    """Rebuild a typed PDF's paragraphs from its line layout.

    PDFs only store visual lines, so plain extraction breaks the essay wherever
    the page wrapped it. A line starts a new paragraph when there is a bigger
    gap above it, when it is indented, or when the line before ended a sentence
    well short of the right margin. Other lines are joined back together.
    """
    lines = _pdf_lines(path)
    if not lines:
        return ""

    gaps = [
        b["top"] - a["top"]
        for a, b in zip(lines, lines[1:])
        if a["page"] == b["page"] and b["top"] > a["top"]
    ]
    spacing = median(gaps) if gaps else None
    left = min(line["x0"] for line in lines)
    right = max(line["x1"] for line in lines)
    width = right - left

    paragraphs = [[lines[0]["text"]]]
    for prev, line in zip(lines, lines[1:]):
        gap = line["top"] - prev["top"] if line["page"] == prev["page"] else None
        bigger_gap = spacing and gap and gap > spacing * 1.3
        indented = line["x0"] - left > line["size"] * 1.5
        prev_short = prev["x1"] < right - width * 0.15
        ended_sentence = re.search(r"[.!?:\"”’')]$", prev["text"])
        if bigger_gap or indented or (prev_short and ended_sentence) or prev["x1"] < left + width * 0.6:
            paragraphs.append([line["text"]])
        else:
            paragraphs[-1].append(line["text"])

    def join(parts):
        text = parts[0]
        for part in parts[1:]:
            # "well-" + "known" -> "well-known"; otherwise join with a space
            text += part if text.endswith("-") and part[:1].islower() else " " + part
        return text

    return "\n\n".join(join(p) for p in paragraphs)


def read_essay(path):
    """Return (text, source) for a PDF essay; source is "typed" or "ocr".

    Typed essays saved as PDF have a text layer and are read directly.
    Scanned essays only contain page images, which are transcribed page by page.
    """
    text = extract_text(path).strip()
    if len(text) >= MIN_PDF_TEXT:
        return reflow_pdf_text(path) or text, "typed"

    pages = []
    for page in PdfReader(path).pages:
        for image_file in page.images:
            pages.append(_ocr(image_file.image))
    if not pages:
        raise ValueError("The PDF has no text or scanned pages")
    return "\n\n".join(pages).strip(), "ocr"
