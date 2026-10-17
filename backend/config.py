import os

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

# Local data (all git-ignored)
DB_PATH = os.path.join(BACKEND_DIR, "app.db")
CHROMA_DIR = os.path.join(BACKEND_DIR, "chroma_db")
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
ENV_PATH = os.path.join(BACKEND_DIR, "..", ".env")

DOC_TYPES = {"Model essay", "Rubric", "Lesson notes", "Marked essay"}
# Only these are retrieved by RAG (rubrics are read from SQL as bands, and marked essays are kept for reference only)
EMBEDDED_DOC_TYPES = {"Model essay", "Lesson notes"}
# "" = not specified (for SBB, it means the file applies to all levels)
SBB_LEVELS = {"", "G1", "G2", "G3"}
THEMES = {"", "Technology", "Environment", "Identity", "Society", "Education",
          "Relationships", "Others"}
FORMATS = {"", "Narrative", "Personal Recount", "Descriptive", "Reflective",
           "Argumentative", "Discursive", "Hybrid"}
