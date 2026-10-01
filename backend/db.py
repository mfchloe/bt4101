import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # rows behave like dicts
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
