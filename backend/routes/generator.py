import io
import os
import tempfile

from flask import Blueprint, request, send_file

from config import FORMATS, THEMES
from db import get_conn
from services import generator, podcast
from services.extract import ALLOWED_EXTENSIONS, extract_text

generator_bp = Blueprint("generator", __name__, url_prefix="/api/lesson")

BANDS = {"G1", "G2", "G3"}


class BadRequest(Exception):
    pass


def parse_request():
    """Read and validate the fields shared by generate and regenerate-section."""
    form = request.form
    params = {
        "band": form.get("band", ""),
        "material_type": form.get("materialType", ""),
        "format": form.get("format", "").strip(),
        "theme": form.get("theme", "").strip(),
        "instructions": form.get("instructions", "").strip(),
    }
    if params["band"] not in BANDS:
        raise BadRequest("Select a band (G1, G2 or G3)")
    if params["material_type"] not in generator.MATERIAL_TYPES:
        raise BadRequest("Invalid material type")
    if params["format"] not in FORMATS:
        raise BadRequest("Invalid format")
    if params["theme"] not in THEMES:
        raise BadRequest("Invalid theme")
    if params["material_type"] == "Others" and not params["instructions"]:
        raise BadRequest("Describe the material you want in the instructions")
    return params


def read_session_files():
    """Extract text from the attached session files without saving them anywhere."""
    files = []
    for file in request.files.getlist("sessionFiles"):
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise BadRequest(f"Unsupported session file type: {file.filename}")
        # extract_text needs a path, so write to a temp file and delete it straight away
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            file.save(tmp)
        try:
            text = extract_text(tmp.name).strip()
        except Exception as e:
            raise BadRequest(f"Could not read {file.filename}: {e}")
        finally:
            os.remove(tmp.name)
        if not text:
            raise BadRequest(f"No text found in {file.filename}")
        files.append((file.filename, text))
    return files


def gather_context(params):
    """Retrieve library chunks and session text for a request."""
    query = generator.build_query(
        params["material_type"], params["format"], params["theme"], params["instructions"]
    )
    # With no format, theme or instructions there is no topic to search for, so the
    # library would return arbitrary files and steer the material towards their topics
    if params["format"] or params["theme"] or params["instructions"]:
        chunks, relaxed = generator.retrieve(query, params["band"], params["format"], params["theme"])
    else:
        chunks, relaxed = [], []
    session_files = generator.select_session_text(read_session_files(), query)

    file_ids = sorted({c["metadata"]["file_id"] for c in chunks})
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT id, filename, doc_type FROM library_files WHERE id IN ({','.join('?' * len(file_ids))})",
            file_ids,
        ).fetchall() if file_ids else []
    filenames = {row["id"]: row["filename"] for row in rows}

    # One entry per file, library files in retrieval order, then session files
    sources, listed = [], set()
    for chunk in chunks:
        file_id = chunk["metadata"]["file_id"]
        if file_id not in listed and file_id in filenames:
            listed.add(file_id)
            sources.append({"source_file": filenames[file_id], "document_type": chunk["metadata"]["doc_type"]})
    sources += [{"source_file": name, "document_type": "Session file"} for name, _ in session_files]

    return chunks, filenames, session_files, sources, relaxed


# POST /api/lesson/generate - retrieve library resources and generate one material
@generator_bp.route("/generate", methods=["POST"])
def generate():
    try:
        params = parse_request()
        chunks, filenames, session_files, sources, relaxed = gather_context(params)
    except BadRequest as e:
        return {"error": str(e)}, 400

    try:
        content = generator.generate(**params, chunks=chunks, filenames=filenames,
                                     session_files=session_files)
    except Exception as e:
        return {"error": f"Generation failed: {e}"}, 502

    return {
        "content": content,
        "sources": sources,
        "relaxed": relaxed,
        "prompt_version": generator.PROMPT_VERSION,
    }


# POST /api/lesson/regenerate-section - rewrite one ## section, keeping the rest
@generator_bp.route("/regenerate-section", methods=["POST"])
def regenerate_section():
    material = request.form.get("currentMaterial", "")
    section_title = request.form.get("sectionTitle", "").strip()
    if not material or not section_title:
        return {"error": "Missing material or section title"}, 400

    try:
        params = parse_request()
        chunks, filenames, session_files, _, _ = gather_context(params)
    except BadRequest as e:
        return {"error": str(e)}, 400

    try:
        content = generator.regenerate_section(
            **params, material=material, section_title=section_title,
            chunks=chunks, filenames=filenames, session_files=session_files,
        )
    except Exception as e:
        return {"error": f"Regeneration failed: {e}"}, 502
    if content is None:
        return {"error": f'Section "{section_title}" not found'}, 400

    return {"content": content}


# POST /api/lesson/podcast-audio - read a podcast script aloud, returns a WAV file
@generator_bp.route("/podcast-audio", methods=["POST"])
def podcast_audio():
    material = (request.json or {}).get("material", "")
    if not material.strip():
        return {"error": "Missing podcast script"}, 400
    try:
        audio, _ = podcast.synthesise(material)
    except ValueError as e:
        return {"error": str(e)}, 400
    except Exception as e:
        return {"error": f"Could not create the audio: {e}"}, 500
    return send_file(io.BytesIO(audio), mimetype="audio/wav", download_name="podcast.wav")
