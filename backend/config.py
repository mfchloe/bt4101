import os

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

# Local data (all git-ignored)
DB_PATH = os.path.join(BACKEND_DIR, "app.db")
CHROMA_DIR = os.path.join(BACKEND_DIR, "chroma_db")
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
ENV_PATH = os.path.join(BACKEND_DIR, "..", ".env")
# Kokoro text-to-speech model for podcast audio (downloaded separately, see README)
TTS_DIR = os.path.join(BACKEND_DIR, "tts_models")

DOC_TYPES = {"Model essay", "Rubric", "Lesson notes", "Marked essay"}
# Only these are retrieved by RAG (rubrics are read from SQL as bands, and marked essays are kept for reference only)
EMBEDDED_DOC_TYPES = {"Model essay", "Lesson notes"}
# "" = not specified (for SBB, it means the file applies to all levels)
SBB_LEVELS = {"", "G1", "G2", "G3"}
THEMES = {"", "Technology", "Environment", "Identity", "Society", "Education",
          "Relationships", "Others"}
FORMATS = {"", "Narrative", "Personal Recount", "Descriptive", "Reflective",
           "Argumentative", "Discursive", "Hybrid"}

# ---- Essay marking ----
# Essays are PDFs: typed ones are read directly, scanned ones go through OCR
ESSAY_EXTENSIONS = {".pdf"}
# Marking condition used when the request doesn't set one (FR-M5). Change to the
# best-performing condition (A-D) once the marking experiment has been run.
DEFAULT_USE_CHECKLIST = True
DEFAULT_USE_MODEL_ESSAYS = True
# Fixed list the AI picks up to 3 weakness tags from, so analytics can count them
WEAKNESS_TAGS = [
    "Task fulfilment",
    "Development of ideas",
    "Organisation",
    "Cohesion",
    "Vocabulary",
    "Grammar",
    "Spelling",
    "Punctuation",
    "Sentence structure",
    "Tone and register",
]
