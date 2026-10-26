import sqlite3

from config import DB_PATH


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # rows behave like dicts
    conn.execute("PRAGMA foreign_keys = ON")  # SQLite ignores REFERENCES without this
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS library_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                doc_type TEXT NOT NULL,
                sbb TEXT,
                theme TEXT,
                format TEXT,
                num_chunks INTEGER DEFAULT 0,
                uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        # One row per band per criterion of a rubric file,
        # e.g. (file 3, "Content", band 5, 9, 10, "All aspects of the task...")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rubric_bands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                criterion TEXT NOT NULL,
                band INTEGER NOT NULL,
                min_mark INTEGER NOT NULL,
                max_mark INTEGER NOT NULL,
                descriptor TEXT
            )
            """
        )

        # ---- Essay marking ----
        # There are no classes: one list of students, matched by normalised name
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,      -- normalised, e.g. "tan wei ling"
                display_name TEXT NOT NULL,     -- as the teacher typed it
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        # One marking batch: the same question, band and rubric for every essay
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rubric_file_id INTEGER NOT NULL REFERENCES library_files(id),
                format TEXT NOT NULL,
                theme TEXT NOT NULL,
                sbb TEXT NOT NULL,
                question TEXT,
                marking_focus TEXT,
                use_checklist INTEGER NOT NULL DEFAULT 0,     -- marking method for the whole batch
                use_model_essays INTEGER NOT NULL DEFAULT 0,
                checklist TEXT,                 -- JSON, built once and used for every essay
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        # One student's essay for one assignment. student_id is set when the
        # teacher accepts the marks; until then only student_name is known.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assignment_id INTEGER NOT NULL REFERENCES assignments(id),
                student_id INTEGER REFERENCES students(id),
                student_name TEXT NOT NULL,
                filename TEXT,
                stored_path TEXT,               -- the uploaded PDF on disk
                essay_text TEXT NOT NULL,
                source TEXT NOT NULL,           -- "typed" | "ocr"
                status TEXT NOT NULL DEFAULT 'pending',  -- "pending" | "accepted"
                overall_feedback TEXT,
                weakness_tags TEXT,             -- JSON list, up to 3 of WEAKNESS_TAGS
                accepted_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (assignment_id, student_id)
            )
            """
        )
        # One AI marking of a submission, with the configuration that produced it
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS marking_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER NOT NULL REFERENCES submissions(id),
                use_checklist INTEGER NOT NULL,
                use_model_essays INTEGER NOT NULL,
                model_essay_ids TEXT,           -- JSON list of library file ids actually used
                model_name TEXT NOT NULL,
                prompt_version TEXT NOT NULL,
                latency_ms INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        # ai_score is kept alongside final_score to measure how often teachers change marks
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS criterion_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL REFERENCES marking_runs(id),
                criterion TEXT NOT NULL,
                max_mark INTEGER NOT NULL,
                ai_score INTEGER NOT NULL,
                final_score INTEGER,            -- set when the teacher accepts
                reason TEXT,
                UNIQUE (run_id, criterion)
            )
            """
        )
        # Dismissed AI comments are kept (dismissed = 1) so the edit rate can be measured
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS annotations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER NOT NULL REFERENCES submissions(id),
                type TEXT NOT NULL,
                quote TEXT NOT NULL,
                suggestion TEXT,
                comment TEXT NOT NULL,
                origin TEXT NOT NULL,           -- "ai" | "ai_edited" | "teacher"
                dismissed INTEGER NOT NULL DEFAULT 0
            )
            """
        )

        # Columns added after the first version of a table; CREATE TABLE IF NOT
        # EXISTS doesn't change existing tables, so add them here if missing
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(submissions)")}
        if "stored_path" not in columns:
            conn.execute("ALTER TABLE submissions ADD COLUMN stored_path TEXT")
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(assignments)")}
        for name, definition in [
            ("use_checklist", "INTEGER NOT NULL DEFAULT 0"),
            ("use_model_essays", "INTEGER NOT NULL DEFAULT 0"),
            ("checklist", "TEXT"),
        ]:
            if name not in columns:
                conn.execute(f"ALTER TABLE assignments ADD COLUMN {name} {definition}")
