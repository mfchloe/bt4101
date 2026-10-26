import json
import os
import re
import uuid

from flask import Blueprint, request
from werkzeug.utils import secure_filename

from config import (
    DEFAULT_USE_CHECKLIST, DEFAULT_USE_MODEL_ESSAYS, ESSAY_EXTENSIONS, FORMATS, THEMES, UPLOAD_DIR,
)
from db import get_conn
from services import marking
from services.essay_reader import read_essay

marking_bp = Blueprint("marking", __name__, url_prefix="/api/marking")

BANDS = {"G1", "G2", "G3"}
ESSAY_DIR = os.path.join(UPLOAD_DIR, "essays")


def load_bands(conn, rubric_file_id):
    rows = conn.execute(
        """SELECT criterion, band, min_mark, max_mark, descriptor
           FROM rubric_bands WHERE file_id = ? ORDER BY id""",
        (rubric_file_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def find_rubric(conn, band):
    """The newest reviewed rubric for this band, else one for all levels, else an error."""
    for sbb in (band, ""):
        row = conn.execute(
            """SELECT id, filename FROM library_files f
               WHERE doc_type = 'Rubric' AND sbb = ?
                 AND EXISTS (SELECT 1 FROM rubric_bands b WHERE b.file_id = f.id)
               ORDER BY uploaded_at DESC, id DESC LIMIT 1""",
            (sbb,),
        ).fetchone()
        if row:
            return row, None

    unreviewed = conn.execute(
        "SELECT filename FROM library_files WHERE doc_type = 'Rubric' AND sbb IN (?, '')", (band,)
    ).fetchone()
    if unreviewed:
        return None, (
            f'The bands of "{unreviewed["filename"]}" haven\'t been saved yet. '
            "Open it in the File library (Bands), check them and save."
        )
    return None, f"There is no {band} rubric in the File library. Upload one first."


def to_bool(value, default):
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


# POST /api/marking/assignments - start a marking batch and look up its rubric
@marking_bp.route("/assignments", methods=["POST"])
def create_assignment():
    form = request.form
    format, theme, band = form.get("format", ""), form.get("theme", ""), form.get("band", "")
    question = form.get("question", "").strip()
    focus = form.get("instructions", "").strip()

    if not format or format not in FORMATS:
        return {"error": "Select a format"}, 400
    if not theme or theme not in THEMES:
        return {"error": "Select a theme"}, 400
    if band not in BANDS:
        return {"error": "Select a band (G1, G2 or G3)"}, 400
    # The marking method applies to the whole batch
    use_checklist = to_bool(form.get("useChecklist"), DEFAULT_USE_CHECKLIST)
    use_model_essays = to_bool(form.get("useModelEssays"), DEFAULT_USE_MODEL_ESSAYS)

    with get_conn() as conn:
        rubric, error = find_rubric(conn, band)
        if error:
            return {"error": error}, 400
        cur = conn.execute(
            """INSERT INTO assignments
               (rubric_file_id, format, theme, sbb, question, marking_focus,
                use_checklist, use_model_essays)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (rubric["id"], format, theme, band, question, focus,
             int(use_checklist), int(use_model_essays)),
        )
        bands = load_bands(conn, rubric["id"])

    return {
        "assignmentId": cur.lastrowid,
        "rubric": rubric["filename"],
        "rubricBands": bands,
        "question": question,
        "band": band,
        "format": format,
        "theme": theme,
        "useChecklist": use_checklist,
        "useModelEssays": use_model_essays,
    }, 201


# POST /api/marking/assignments/<id>/checklist - build the batch's checklist (stage 1)
# once, before any essay is marked, so the teacher can see it first
@marking_bp.route("/assignments/<int:assignment_id>/checklist", methods=["POST"])
def build_checklist(assignment_id):
    with get_conn() as conn:
        assignment = conn.execute(
            "SELECT * FROM assignments WHERE id = ?", (assignment_id,)
        ).fetchone()
        if assignment is None:
            return {"error": "Assignment not found"}, 404
        if not assignment["use_checklist"]:
            return {"error": "Checklist prompting is off for this batch"}, 400
        if conn.execute(
            "SELECT 1 FROM submissions WHERE assignment_id = ?", (assignment_id,)
        ).fetchone():
            return {"error": "Essays in this batch are already marked with its checklist"}, 409
        bands = load_bands(conn, assignment["rubric_file_id"])

    try:
        checklist = marking.build_checklist(
            bands, assignment["question"], assignment["format"],
            assignment["theme"], assignment["sbb"],
        )
    except Exception as e:
        return {"error": f"Could not build the checklist: {e}"}, 502

    with get_conn() as conn:
        conn.execute(
            "UPDATE assignments SET checklist = ? WHERE id = ?",
            (json.dumps(checklist), assignment_id),
        )
    return {"checklist": checklist}


# POST /api/marking/assignments/<id>/essays - read and mark one essay
@marking_bp.route("/assignments/<int:assignment_id>/essays", methods=["POST"])
def mark_essay(assignment_id):
    file = request.files.get("essay")
    student_name = request.form.get("studentName", "").strip()

    if not file or not file.filename:
        return {"error": "No essay file provided"}, 400
    if not student_name:
        return {"error": "Enter the student's name"}, 400
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ESSAY_EXTENSIONS:
        return {"error": "Essays must be PDF files"}, 400

    with get_conn() as conn:
        assignment = conn.execute(
            "SELECT * FROM assignments WHERE id = ?", (assignment_id,)
        ).fetchone()
        if assignment is None:
            return {"error": "Assignment not found"}, 404
        bands = load_bands(conn, assignment["rubric_file_id"])
    use_checklist = bool(assignment["use_checklist"])
    use_model_essays = bool(assignment["use_model_essays"])
    checklist = json.loads(assignment["checklist"]) if assignment["checklist"] else None
    if use_checklist and not checklist:
        return {"error": "Build the batch's checklist before marking essays"}, 400

    # Keep the original file (scans can be checked against the transcription later)
    os.makedirs(ESSAY_DIR, exist_ok=True)
    stem = secure_filename(os.path.splitext(file.filename)[0]) or "essay"
    stored_path = os.path.join(ESSAY_DIR, f"{uuid.uuid4().hex}_{stem}{ext}")
    file.save(stored_path)

    try:
        text, source = read_essay(stored_path)
    except Exception as e:
        os.remove(stored_path)
        return {"error": f"Could not read the essay: {e}"}, 400
    if not text:
        os.remove(stored_path)
        return {"error": "No text found in the essay"}, 400

    try:
        result = marking.mark_essay(
            text, bands, assignment["question"], assignment["format"], assignment["theme"],
            assignment["sbb"], assignment["marking_focus"], checklist, use_model_essays,
        )
    except Exception as e:
        os.remove(stored_path)
        return {"error": f"Marking failed: {e}"}, 502

    # Save everything in one transaction, only after marking succeeded
    with get_conn() as conn:
        submission_id = conn.execute(
            """INSERT INTO submissions
               (assignment_id, student_name, filename, stored_path, essay_text, source,
                overall_feedback, weakness_tags)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (assignment_id, student_name, file.filename, stored_path, text, source,
             result["feedback"], json.dumps(result["weakness_tags"])),
        ).lastrowid
        run_id = conn.execute(
            """INSERT INTO marking_runs
               (submission_id, use_checklist, use_model_essays, model_essay_ids,
                model_name, prompt_version, latency_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (submission_id, int(use_checklist), int(use_model_essays),
             json.dumps([e["file_id"] for e in result["model_essays"]]),
             result["model_name"], result["prompt_version"], result["latency_ms"]),
        ).lastrowid
        conn.executemany(
            """INSERT INTO criterion_scores (run_id, criterion, max_mark, ai_score, reason)
               VALUES (?, ?, ?, ?, ?)""",
            [(run_id, s["criterion"], s["max"], s["mark"], s["reason"]) for s in result["scores"]],
        )
        conn.executemany(
            """INSERT INTO annotations (submission_id, type, quote, suggestion, comment, origin)
               VALUES (?, ?, ?, ?, ?, 'ai')""",
            [(submission_id, a["type"], a["quote"], a["suggestion"], a["comment"])
             for a in result["annotations"]],
        )
        essay = essay_json(conn, submission_id)

    return essay, 201


def essay_json(conn, submission_id):
    """One essay in the shape the review screen uses, read from the database.

    score is the teacher's final mark once accepted, otherwise the AI's;
    aiScore is always the AI's, so the screen can show what the teacher changed.
    """
    submission = conn.execute("SELECT * FROM submissions WHERE id = ?", (submission_id,)).fetchone()
    run = conn.execute(
        "SELECT * FROM marking_runs WHERE submission_id = ? ORDER BY id DESC LIMIT 1",
        (submission_id,),
    ).fetchone()
    scores = conn.execute(
        "SELECT * FROM criterion_scores WHERE run_id = ? ORDER BY id", (run["id"],)
    ).fetchall()
    annotations = conn.execute(
        "SELECT * FROM annotations WHERE submission_id = ? AND dismissed = 0 ORDER BY id",
        (submission_id,),
    ).fetchall()
    model_essay_ids = json.loads(run["model_essay_ids"] or "[]")
    model_essays = [
        row["filename"]
        for file_id in model_essay_ids
        for row in conn.execute("SELECT filename FROM library_files WHERE id = ?", (file_id,))
    ]
    return {
        "id": submission["id"],
        "studentName": submission["student_name"],
        "text": submission["essay_text"],
        "source": submission["source"],
        "status": submission["status"],
        "acceptedAt": submission["accepted_at"],
        "criteria": [
            {
                "name": s["criterion"],
                "score": s["final_score"] if s["final_score"] is not None else s["ai_score"],
                "aiScore": s["ai_score"],
                "max": s["max_mark"],
                "note": s["reason"],
            }
            for s in scores
        ],
        "feedback": submission["overall_feedback"] or "",
        "weaknessTags": json.loads(submission["weakness_tags"] or "[]"),
        "annotations": [
            {
                "id": str(a["id"]), "type": a["type"], "quote": a["quote"],
                "suggestion": a["suggestion"] or "", "comment": a["comment"],
                "edited": a["origin"] == "ai_edited", "teacherAdded": a["origin"] == "teacher",
            }
            for a in annotations
        ],
        "run": {
            "useChecklist": bool(run["use_checklist"]),
            "useModelEssays": bool(run["use_model_essays"]),
            "modelEssays": model_essays,
            "latencyMs": run["latency_ms"],
        },
    }


# GET /api/marking/assignments - marking batches, newest first (for the File library)
@marking_bp.route("/assignments")
def list_assignments():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT a.id, a.format, a.theme, a.sbb, a.question, a.created_at,
                      f.filename AS rubric,
                      COUNT(s.id) AS essays,
                      SUM(s.status = 'accepted') AS accepted,
                      GROUP_CONCAT(s.student_name, ', ') AS students
               FROM assignments a
               JOIN library_files f ON f.id = a.rubric_file_id
               JOIN submissions s ON s.assignment_id = a.id
               GROUP BY a.id
               ORDER BY a.created_at DESC, a.id DESC"""
        ).fetchall()
    return {"assignments": [dict(row) for row in rows]}


# GET /api/marking/assignments/<id> - reopen a batch in the review screen
@marking_bp.route("/assignments/<int:assignment_id>")
def get_assignment(assignment_id):
    with get_conn() as conn:
        assignment = conn.execute(
            """SELECT a.*, f.filename AS rubric FROM assignments a
               JOIN library_files f ON f.id = a.rubric_file_id WHERE a.id = ?""",
            (assignment_id,),
        ).fetchone()
        if assignment is None:
            return {"error": "Marking batch not found"}, 404
        submission_ids = [
            row["id"] for row in conn.execute(
                "SELECT id FROM submissions WHERE assignment_id = ? ORDER BY id", (assignment_id,)
            )
        ]
        return {
            "assignmentId": assignment_id,
            "rubric": assignment["rubric"],
            "rubricBands": load_bands(conn, assignment["rubric_file_id"]),
            "question": assignment["question"],
            "band": assignment["sbb"],
            "format": assignment["format"],
            "theme": assignment["theme"],
            "checklist": json.loads(assignment["checklist"]) if assignment["checklist"] else None,
            "essays": [essay_json(conn, sid) for sid in submission_ids],
        }


# DELETE /api/marking/assignments/<id> - delete a batch with all its essays and marks
@marking_bp.route("/assignments/<int:assignment_id>", methods=["DELETE"])
def delete_assignment(assignment_id):
    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM assignments WHERE id = ?", (assignment_id,)).fetchone() is None:
            return {"error": "Marking batch not found"}, 404
        submissions = conn.execute(
            "SELECT id, stored_path FROM submissions WHERE assignment_id = ?", (assignment_id,)
        ).fetchall()
        ids = [row["id"] for row in submissions]
        marks = ",".join("?" * len(ids))
        if ids:
            # Children first, so the foreign keys are never left dangling
            conn.execute(
                f"""DELETE FROM criterion_scores WHERE run_id IN
                    (SELECT id FROM marking_runs WHERE submission_id IN ({marks}))""",
                ids,
            )
            conn.execute(f"DELETE FROM marking_runs WHERE submission_id IN ({marks})", ids)
            conn.execute(f"DELETE FROM annotations WHERE submission_id IN ({marks})", ids)
            conn.execute(f"DELETE FROM submissions WHERE id IN ({marks})", ids)
        conn.execute("DELETE FROM assignments WHERE id = ?", (assignment_id,))
        # Students with no essays left (e.g. only in this batch) are removed too
        conn.execute(
            "DELETE FROM students WHERE id NOT IN (SELECT student_id FROM submissions WHERE student_id IS NOT NULL)"
        )

    for row in submissions:
        if row["stored_path"] and os.path.exists(row["stored_path"]):
            os.remove(row["stored_path"])
    return {"deleted": assignment_id, "essays": len(ids)}


def normalise_name(name):
    return re.sub(r"\s+", " ", name).strip().lower()


# POST /api/marking/submissions/<id>/accept - save the teacher's final marks and comments
@marking_bp.route("/submissions/<int:submission_id>/accept", methods=["POST"])
def accept_submission(submission_id):
    body = request.json or {}
    display_name = re.sub(r"\s+", " ", body.get("studentName", "")).strip()
    if not display_name:
        return {"error": "Enter the student's name"}, 400

    with get_conn() as conn:
        submission = conn.execute(
            "SELECT * FROM submissions WHERE id = ?", (submission_id,)
        ).fetchone()
        if submission is None:
            return {"error": "Submission not found"}, 404

        run = conn.execute(
            "SELECT id FROM marking_runs WHERE submission_id = ? ORDER BY id DESC LIMIT 1",
            (submission_id,),
        ).fetchone()
        maxima = {
            row["criterion"]: row["max_mark"]
            for row in conn.execute(
                "SELECT criterion, max_mark FROM criterion_scores WHERE run_id = ?", (run["id"],)
            )
        }
        try:
            final = {c["name"]: int(c["score"]) for c in body["criteria"]}
        except (KeyError, TypeError, ValueError):
            return {"error": "Each criterion needs a name and a whole-number score"}, 400
        if set(final) != set(maxima):
            return {"error": "Marks must be given for every rubric criterion"}, 400
        for name, score in final.items():
            if not 0 <= score <= maxima[name]:
                return {"error": f"{name} must be between 0 and {maxima[name]}"}, 400

        # Match the student by normalised name, creating them if they're new
        name = normalise_name(display_name)
        student = conn.execute("SELECT id FROM students WHERE name = ?", (name,)).fetchone()
        student_id = student["id"] if student else conn.execute(
            "INSERT INTO students (name, display_name) VALUES (?, ?)", (name, display_name)
        ).lastrowid
        clash = conn.execute(
            "SELECT 1 FROM submissions WHERE assignment_id = ? AND student_id = ? AND id != ?",
            (submission["assignment_id"], student_id, submission_id),
        ).fetchone()
        if clash:
            return {"error": f"{display_name} already has an essay in this batch. Check the name."}, 409

        conn.executemany(
            "UPDATE criterion_scores SET final_score = ? WHERE run_id = ? AND criterion = ?",
            [(score, run["id"], name) for name, score in final.items()],
        )

        # Annotations: AI comments the teacher removed are kept as dismissed (for the
        # edit rate); teacher comments they removed are deleted; new ones are added
        existing = {
            str(row["id"]): row
            for row in conn.execute("SELECT * FROM annotations WHERE submission_id = ?", (submission_id,))
        }
        saved = []
        for a in body.get("annotations", []):
            quote, comment = str(a.get("quote", "")).strip(), str(a.get("comment", "")).strip()
            if not quote or not comment:
                continue
            fields = (a.get("type", "content"), quote, str(a.get("suggestion") or "").strip(), comment)
            row = existing.pop(str(a.get("id")), None)
            if row:
                origin = "ai_edited" if row["origin"] == "ai" and a.get("edited") else row["origin"]
                conn.execute(
                    """UPDATE annotations SET type = ?, quote = ?, suggestion = ?, comment = ?,
                       origin = ?, dismissed = 0 WHERE id = ?""",
                    (*fields, origin, row["id"]),
                )
                annotation_id = row["id"]
            else:
                annotation_id = conn.execute(
                    """INSERT INTO annotations (submission_id, type, quote, suggestion, comment, origin)
                       VALUES (?, ?, ?, ?, ?, 'teacher')""",
                    (submission_id, *fields),
                ).lastrowid
            saved.append({
                "id": str(annotation_id), "type": fields[0], "quote": quote,
                "suggestion": fields[2], "comment": comment,
                "edited": bool(a.get("edited")), "teacherAdded": bool(a.get("teacherAdded")),
            })
        for row in existing.values():
            if row["origin"] == "teacher":
                conn.execute("DELETE FROM annotations WHERE id = ?", (row["id"],))
            else:
                conn.execute("UPDATE annotations SET dismissed = 1 WHERE id = ?", (row["id"],))

        conn.execute(
            """UPDATE submissions SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP,
               student_id = ?, student_name = ?, overall_feedback = ? WHERE id = ?""",
            (student_id, display_name, str(body.get("feedback", "")).strip(), submission_id),
        )

    return {"status": "accepted", "annotations": saved}


# POST /api/marking/submissions/<id>/reopen - an accepted essay was edited again
@marking_bp.route("/submissions/<int:submission_id>/reopen", methods=["POST"])
def reopen_submission(submission_id):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE submissions SET status = 'pending', accepted_at = NULL WHERE id = ?",
            (submission_id,),
        )
    if cur.rowcount == 0:
        return {"error": "Submission not found"}, 404
    return {"status": "pending"}
