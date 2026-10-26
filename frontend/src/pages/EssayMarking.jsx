import { useEffect, useState } from "react";
import EssayUploadForm from "../components/essay-marking/EssayUploadForm";
import EssayReview from "../components/essay-marking/EssayReview";
import ChecklistReview from "../components/essay-marking/ChecklistReview";

import { API_URL as API_BASE_URL } from "../api";

// Essays marked at the same time; each takes several LLM calls
const PARALLEL_ESSAYS = 2;

const postForm = async (path, fields) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "POST", body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

/*
 * Essay marking has three stages:
 *   1. Upload – choose the assignment details and upload student essays
 *   2. Checklist – with checklist prompting on, check the batch's checklist
 *   3. Review – check the AI's scores, highlights and feedback, and accept
 *
 * Marking is one request per essay, so the page can show progress:
 *   POST /api/marking/assignments                 -> { assignmentId, rubric, rubricBands }
 *   POST /api/marking/assignments/<id>/checklist  -> { checklist }, built once per batch
 *   POST /api/marking/assignments/<id>/essays     -> one essay object
 *   GET  /api/marking/assignments/<id>            -> a saved batch, to reopen it
 *     { id, studentName, text, source, criteria: [{ name, score, max, note }],
 *       feedback, weaknessTags, annotations: [{ id, type, quote, suggestion, comment }], run }
 */
export default function EssayMarking({ assignmentId, onBatchChange, onBackToLibrary }) {
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null); // { done, total, building } while working
  // The batch's checklist, shown before marking: { assignment, essays, checklist, question, band }
  const [checklistStep, setChecklistStep] = useState(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  // Reopen a saved batch (from the File library, or when coming back to this page)
  const isLoading = Boolean(assignmentId) && result?.assignmentId !== assignmentId && !loadError;
  useEffect(() => {
    if (!assignmentId || result?.assignmentId === assignmentId) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/marking/assignments/${assignmentId}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not open the batch");
        if (!cancelled) setResult({ ...data, failed: [] });
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [assignmentId, result?.assignmentId]);

  const startNewBatch = () => {
    setResult(null);
    setLoadError("");
    onBatchChange(null);
  };

  // Mark every essay against the batch, a few at a time, then open the review
  // Mark essays into a batch, a few at a time. Failed ones keep their file,
  // so they can be retried from the review screen.
  const markInto = async (assignmentId, essays, onEssayDone = () => {}) => {
    const marked = new Array(essays.length).fill(null);
    const failed = [];
    let next = 0;

    // Each worker takes the next unmarked essay until none are left
    const worker = async () => {
      while (next < essays.length) {
        const i = next++;
        const { file, studentName } = essays[i];
        try {
          marked[i] = await postForm(`/api/marking/assignments/${assignmentId}/essays`, {
            essay: file,
            studentName,
          });
        } catch (err) {
          failed.push({ file, studentName, fileName: file.name, error: err.message });
        }
        onEssayDone();
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_ESSAYS, essays.length) }, worker));
    return { marked: marked.filter(Boolean), failed };
  };

  // Retry the essays that failed (e.g. when the AI service was briefly down)
  const retryFailed = (failed) => markInto(result.assignmentId, failed);

  const markEssays = async (assignment, essays) => {
    setChecklistStep(null);
    setError("");
    setProgress({ done: 0, total: essays.length });
    try {
      const { marked: markedEssays, failed } = await markInto(
        assignment.assignmentId,
        essays,
        () => setProgress((p) => ({ ...p, done: p.done + 1 })),
      );
      if (markedEssays.length === 0) {
        discardBatch(assignment.assignmentId);
        throw new Error(
          `No essays could be marked. ${failed.map((f) => `${f.studentName}: ${f.error}`).join(" ")}`,
        );
      }
      setResult({
        assignmentId: assignment.assignmentId,
        rubric: assignment.rubric,
        rubricBands: assignment.rubricBands,
        question: assignment.question,
        band: assignment.band,
        format: assignment.format,
        theme: assignment.theme,
        essays: markedEssays,
        failed,
      });
      onBatchChange(assignment.assignmentId);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong while marking essays.");
    } finally {
      setProgress(null);
    }
  };

  // Create the batch; with checklist prompting, build its checklist first and
  // show it to the teacher before marking
  const handleMark = async ({
    format,
    theme,
    band,
    question,
    instructions,
    useChecklist,
    useModelEssays,
    essays,
  }) => {
    setError("");
    setProgress({ done: 0, total: essays.length, building: useChecklist });

    let assignment = null;
    try {
      assignment = await postForm("/api/marking/assignments", {
        format,
        theme,
        band,
        question,
        instructions,
        useChecklist,
        useModelEssays,
      });
      if (!useChecklist) {
        await markEssays(assignment, essays);
        return;
      }
      const { checklist } = await postForm(
        `/api/marking/assignments/${assignment.assignmentId}/checklist`,
        {},
      );
      setChecklistStep({ assignment, essays, checklist, question, band });
      setProgress(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong while marking essays.");
      setProgress(null);
      if (assignment) discardBatch(assignment.assignmentId);
    }
  };

  // A batch with no marked essays (checklist rejected or failed) isn't kept
  const discardBatch = (id) =>
    fetch(`${API_BASE_URL}/api/marking/assignments/${id}`, { method: "DELETE" }).catch(
      (err) => console.error("Could not discard batch:", err),
    );

  if (isLoading) {
    return (
      <p className="py-20 text-center text-sm text-slate-500">Opening marked essays…</p>
    );
  }

  if (result) {
    // key: a different batch starts the review screen afresh
    return (
      <EssayReview
        key={result.assignmentId}
        result={result}
        onRetryFailed={retryFailed}
        // Opened from the File library: go back there; just marked: start another batch
        backLabel={onBackToLibrary ? "File library" : "New batch"}
        onBack={onBackToLibrary ?? startNewBatch}
      />
    );
  }

  return (
    <>
      <EssayUploadForm onSubmit={handleMark} progress={progress} error={error || loadError} />
      {/* Pop-up over the form, so Back leaves the form as it was */}
      {checklistStep && (
        <ChecklistReview
          {...checklistStep}
          rubricBands={checklistStep.assignment.rubricBands}
          essayCount={checklistStep.essays.length}
          onContinue={() => markEssays(checklistStep.assignment, checklistStep.essays)}
          onBack={() => {
            discardBatch(checklistStep.assignment.assignmentId);
            setChecklistStep(null);
          }}
        />
      )}
    </>
  );
}
