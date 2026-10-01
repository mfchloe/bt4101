import os
import uuid

from flask import Flask, request
from flask_cors import CORS
from werkzeug.utils import secure_filename

import vector_store
from db import get_conn, init_db
from extract import ALLOWED_EXTENSIONS, chunk_text, extract_text
from rubric import extract_rubric_bands

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
DOC_TYPES = {"Model essay", "Rubric", "Lesson notes", "Marked essay"}
SBB_LEVELS = {"", "G1", "G2", "G3"}  # "" = not specific to one level

app = Flask(__name__)
CORS(app)

os.makedirs(UPLOAD_DIR, exist_ok=True)
init_db()


@app.route("/health")
def health():
    return {"status": "ok"}


# POST /api/library/upload - upload a file, extract text, chunk it, and embed it
@app.route("/api/library/upload", methods=["POST"])
def upload_file():
    file = request.files.get("file")
    doc_type = request.form.get("docType", "")
    sbb = request.form.get("sbb", "")
    theme = request.form.get("theme", "").strip()
    format = request.form.get("format", "").strip()

    if not file or not file.filename:
        return {"error": "No file provided"}, 400
    if doc_type not in DOC_TYPES:
        return {"error": "Invalid document type"}, 400
    if sbb not in SBB_LEVELS:
        return {"error": "Invalid SBB level"}, 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return {"error": f"Unsupported file type: {ext}"}, 400

    # 1. Save the original file to disk (uuid prefix avoids name clashes)
    stored_path = os.path.join(
        UPLOAD_DIR, f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
    )
    file.save(stored_path)

    # 2. Extract text and split it into chunks
    try:
        chunks = chunk_text(extract_text(stored_path))
    except Exception as e:
        os.remove(stored_path)
        return {"error": f"Could not read file: {e}"}, 400
    if not chunks:
        os.remove(stored_path)
        return {"error": "No text found in file (scanned PDFs are not supported yet)"}, 400

    # 3. Record the file in SQLite
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO library_files
               (filename, stored_path, doc_type, sbb, theme, format, num_chunks)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (file.filename, stored_path, doc_type, sbb, theme, format, len(chunks)),
        )
        file_id = cur.lastrowid

    # 4. Embed the chunks into the vector store
    try:
        vector_store.add_chunks(file_id, chunks, doc_type, sbb, theme, format)
    except Exception as e:
        with get_conn() as conn:
            conn.execute("DELETE FROM library_files WHERE id = ?", (file_id,))
        os.remove(stored_path)
        return {"error": f"Embedding failed: {e}"}, 500

    return {"id": file_id, "filename": file.filename, "num_chunks": len(chunks)}, 201


# GET /api/library/files - list all uploaded files
@app.route("/api/library/files")
def list_files():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, filename, doc_type, sbb, theme, format, num_chunks, uploaded_at
               FROM library_files ORDER BY uploaded_at DESC"""
        ).fetchall()
    return {"files": [dict(row) for row in rows]}

# DELETE /api/library/files/<file_id> - delete a file and its chunks
@app.route("/api/library/files/<int:file_id>", methods=["DELETE"])
def delete_file(file_id):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT stored_path FROM library_files WHERE id = ?", (file_id,)
        ).fetchone()
        if row is None:
            return {"error": "File not found"}, 404
        conn.execute("DELETE FROM library_files WHERE id = ?", (file_id,))
        conn.execute("DELETE FROM rubric_bands WHERE file_id = ?", (file_id,))

    vector_store.delete_chunks(file_id)
    if os.path.exists(row["stored_path"]):
        os.remove(row["stored_path"])
    return {"deleted": file_id}


# POST /api/library/files/<file_id>/rubric/extract - AI draft of the rubric bands (not saved)
@app.route("/api/library/files/<int:file_id>/rubric/extract", methods=["POST"])
def extract_rubric(file_id):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT stored_path FROM library_files WHERE id = ?", (file_id,)
        ).fetchone()
    if row is None:
        return {"error": "File not found"}, 404

    try:
        bands = extract_rubric_bands(extract_text(row["stored_path"]))
    except Exception as e:
        return {"error": f"Could not extract rubric: {e}"}, 500
    return {"bands": bands}


# GET /api/library/files/<file_id>/rubric - saved rubric bands
@app.route("/api/library/files/<int:file_id>/rubric")
def get_rubric(file_id):
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT criterion, band, min_mark, max_mark, descriptor
               FROM rubric_bands WHERE file_id = ? ORDER BY id""",
            (file_id,),
        ).fetchall()
    return {"bands": [dict(row) for row in rows]}


# PUT /api/library/files/<file_id>/rubric - save the teacher-reviewed bands
@app.route("/api/library/files/<int:file_id>/rubric", methods=["PUT"])
def save_rubric(file_id):
    try:
        bands = [
            (
                file_id,
                b["criterion"].strip(),
                int(b["band"]),
                int(b["min_mark"]),
                int(b["max_mark"]),
                b.get("descriptor", "").strip(),
            )
            for b in request.json["bands"]
        ]
    except (KeyError, TypeError, ValueError):
        return {"error": "Each band needs a criterion, band, min_mark and max_mark"}, 400

    with get_conn() as conn:
        # Replace all bands for this file with the reviewed ones
        conn.execute("DELETE FROM rubric_bands WHERE file_id = ?", (file_id,))
        conn.executemany(
            """INSERT INTO rubric_bands
               (file_id, criterion, band, min_mark, max_mark, descriptor)
               VALUES (?, ?, ?, ?, ?, ?)""",
            bands,
        )
    return {"saved": len(bands)}


if __name__ == "__main__":
    # Port 5001 because macOS AirPlay Receiver already uses 5000
    app.run(debug=True, port=5001)
