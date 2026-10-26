import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MessageSquarePlus,
  Paperclip,
  PenLine,
  Sparkles,
  TextSelect,
  X,
} from "lucide-react";
import ResizeHandle from "../ResizeHandle";
import { API_URL } from "../../api";
import { AT_RISK_MAX } from "../../options";
import useResizableWidth from "../../hooks/useResizableWidth";
import { exportBatchZip, exportEssayPdf } from "./exportFeedback";
import {
  ANNOTATION_TYPES,
  buildSegments,
  findQuote,
  getAnnotationType,
} from "./annotations";

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

// Review state for one marked essay. Reopened essays keep their saved status
// and the AI's original marks.
const prepareEssay = (e) => ({
  ...e,
  status: e.status ?? "pending",
  criteria: e.criteria.map((c) => ({ ...c, aiScore: c.aiScore ?? c.score })),
});

export default function EssayReview({ result, backLabel, onBack, onRetryFailed }) {
  const [essays, setEssays] = useState(() => result.essays.map(prepareEssay));
  // Essays that couldn't be marked; ones from this session can be retried
  const [failed, setFailed] = useState(result.failed ?? []);
  const [isRetrying, setIsRetrying] = useState(false);
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState("marking");
  const [activeId, setActiveId] = useState(null);
  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  // Comment being edited, and the teacher's unsaved changes to it
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  // Last text the teacher selected in the essay, for "Use selection"
  const [selectedText, setSelectedText] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [saveError, setSaveError] = useState("");

  const essayRef = useRef(null);
  const commentsRef = useRef(null);

  const sidePanel = useResizableWidth({
    initial: 360,
    min: 280,
    max: 680,
    edge: "left",
  });

  const current = essays[index];

  const { segments, ranges } = useMemo(
    () => buildSegments(current.text, current.annotations),
    [current.text, current.annotations],
  );

  // Annotations in the order they appear in the essay (longer first when two
  // start together); ones whose text isn't in the essay go last
  const orderedAnnotations = useMemo(() => {
    const placed = current.annotations
      .filter((a) => ranges.has(a.id))
      .sort((a, b) => {
        const ra = ranges.get(a.id);
        const rb = ranges.get(b.id);
        return ra.start - rb.start || rb.end - ra.end;
      });
    const unplaced = current.annotations.filter((a) => !ranges.has(a.id));
    return [...placed, ...unplaced];
  }, [ranges, current.annotations]);

  const typeCounts = useMemo(() => {
    const counts = {};
    current.annotations.forEach((a) => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });
    return counts;
  }, [current.annotations]);

  const total = current.criteria.reduce((sum, c) => sum + c.score, 0);
  const maxTotal = current.criteria.reduce((sum, c) => sum + c.max, 0);
  const isAtRisk = total <= AT_RISK_MAX;

  // Bring the selected highlight and its comment card into view
  useEffect(() => {
    if (!activeId) return;
    essayRef.current
      ?.querySelector(`[data-annotation-ids~="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    commentsRef.current
      ?.querySelector(`[data-annotation-id="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId, tab]);

  const setCurrent = (changes) =>
    setEssays((all) => all.map((e, i) => (i === index ? { ...e, ...changes } : e)));

  // Any edit to an accepted essay (marks, comments, feedback) puts it back to
  // "pending", so the teacher has to accept the changed version again
  const updateCurrent = (changes) => {
    if (current.status === "accepted") {
      fetch(`${API_URL}/api/marking/submissions/${current.id}/reopen`, {
        method: "POST",
      }).catch((err) => console.error("Could not reopen essay:", err));
    }
    setCurrent({ status: "pending", ...changes });
  };

  const goTo = (nextIndex) => {
    setIndex(nextIndex);
    setSaveError("");
    setActiveId(null);
    cancelEdit();
    setSelectedText("");
  };

  const startEdit = (annotation) => {
    setEditingId(annotation.id);
    setDraft({ suggestion: "", ...annotation });
    setActiveId(annotation.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  // Start a new teacher comment, using the selected essay text if there is one
  const startNewComment = () => {
    const id = `teacher-${Date.now()}`;
    setEditingId(id);
    setDraft({
      id,
      isNew: true,
      type: "content",
      quote: selectedText,
      suggestion: "",
      comment: "",
    });
    setActiveId(null);
    setTab("comments");
  };

  const saveEdit = () => {
    const { isNew, ...rest } = draft;
    const saved = {
      ...rest,
      quote: draft.quote.trim(),
      suggestion: draft.suggestion.trim(),
      comment: draft.comment.trim(),
      ...(isNew ? { teacherAdded: true } : { edited: true }),
    };
    updateCurrent({
      annotations: isNew
        ? [...current.annotations, saved]
        : current.annotations.map((a) => (a.id === editingId ? saved : a)),
    });
    setActiveId(saved.id);
    cancelEdit();
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
  };

  // Form for editing a comment, or writing a new one (draft.isNew)
  const renderEditor = () => {
    const quoteFound = findQuote(current.text, draft.quote) !== null;
    const field =
      "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800";
    const label = "mb-1 block text-xs font-semibold text-slate-700";
    return (
      <div
        key={draft.id}
        data-annotation-id={draft.id}
        className="mb-2.5 rounded-xl border border-coral-300 bg-coral-50/40 p-3.5"
      >
        <div className="space-y-3">
          <div>
            <label className={label}>Type</label>
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              className={field}
            >
              {Object.entries(ANNOTATION_TYPES).map(([type, t]) => (
                <option key={type} value={type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Highlighted text
              </label>
              <button
                onClick={() => setDraft({ ...draft, quote: selectedText })}
                disabled={!selectedText}
                title={
                  selectedText
                    ? `Use "${selectedText}"`
                    : "Select text in the essay first"
                }
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:text-slate-400 disabled:hover:bg-transparent"
              >
                <TextSelect size={12} />
                Use selection
              </button>
            </div>
            <textarea
              rows={2}
              value={draft.quote}
              onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
              className={field}
            />
            <p
              className={`mt-1 text-xs ${quoteFound ? "text-slate-500" : "text-amber-700"}`}
            >
              {quoteFound
                ? "Select a passage in the essay, then Use selection, to change the highlight."
                : "This text isn't in the essay, so nothing will be highlighted."}
            </p>
          </div>

          <div>
            <label className={label}>
              Suggestion{" "}
              <span className="font-normal text-slate-400">· optional</span>
            </label>
            <input
              value={draft.suggestion}
              onChange={(e) =>
                setDraft({ ...draft, suggestion: e.target.value })
              }
              placeholder="Corrected wording"
              className={field}
            />
          </div>

          <div>
            <label className={label}>Comment</label>
            <textarea
              rows={3}
              value={draft.comment}
              onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
              className={field}
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={cancelEdit}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={saveEdit}
            disabled={!draft.quote.trim() || !draft.comment.trim()}
            className="rounded-lg bg-coral-500 px-3.5 py-1.5 text-sm font-bold text-white hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {draft.isNew ? "Add comment" : "Save"}
          </button>
        </div>
      </div>
    );
  };

  // Remember text the teacher selects in the essay
  const captureSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (text && essayRef.current?.contains(selection.anchorNode)) {
      setSelectedText(text);
    }
  };

  const selectAnnotation = (id) => {
    setActiveId(id);
    setTab("comments");
  };

  const dismissAnnotation = (id) => {
    updateCurrent({
      annotations: current.annotations.filter((a) => a.id !== id),
    });
    if (activeId === id) setActiveId(null);
    if (editingId === id) cancelEdit();
  };

  // Keep marks whole numbers within 0..max
  const setCriterionScore = (name, score) =>
    updateCurrent({
      criteria: current.criteria.map((c) =>
        c.name === name
          ? { ...c, score: Math.min(c.max, Math.max(0, Math.round(score) || 0)) }
          : c,
      ),
    });

  // The rubric band whose mark range contains this score
  const bandFor = (criterion, score) =>
    (result.rubricBands ?? []).find(
      (b) =>
        b.criterion === criterion && score >= b.min_mark && score <= b.max_mark,
    );

  const toggleType = (type) =>
    setHiddenTypes((hidden) => {
      const next = new Set(hidden);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  // Save the teacher's final marks, comments and feedback; analytics only
  // uses accepted essays
  const handleAccept = async () => {
    setSaveError("");
    setIsSaving(true);
    try {
      const response = await fetch(
        `${API_URL}/api/marking/submissions/${current.id}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentName: current.studentName,
            criteria: current.criteria.map(({ name, score }) => ({ name, score })),
            feedback: current.feedback,
            annotations: current.annotations,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the marks");
      // Saved comments come back with database ids, so accepting again updates them
      setCurrent({ status: "accepted", annotations: data.annotations });
    } catch (err) {
      setSaveError(err.message);
      return;
    } finally {
      setIsSaving(false);
    }
    if (index < essays.length - 1) goTo(index + 1);
  };

  const acceptedCount = essays.filter((e) => e.status === "accepted").length;

  // Mark the failed essays again; newly marked ones are added to the batch
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const { marked, failed: stillFailed } = await onRetryFailed(failed);
      setEssays((all) => [...all, ...marked.map(prepareEssay)]);
      setFailed(stillFailed);
    } finally {
      setIsRetrying(false);
    }
  };

  // Student feedback PDFs; only accepted (teacher-approved) essays are exported
  const handleExport = async (all) => {
    setShowExport(false);
    setSaveError("");
    setIsExporting(true);
    try {
      if (all) await exportBatchZip(essays, result);
      else await exportEssayPdf(current, result);
    } catch (err) {
      console.error(err);
      setSaveError(`Could not export: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* HEADER */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="mr-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </button>

          <button
            aria-label="Previous essay"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">
            {initialsOf(current.studentName)}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{current.studentName}</p>
            <p className="text-xs text-slate-500">
              Essay {index + 1} of {essays.length} · {acceptedCount} accepted
            </p>
          </div>
          <button
            aria-label="Next essay"
            onClick={() => goTo(index + 1)}
            disabled={index === essays.length - 1}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3.5">
          {/* EXPORT */}
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              disabled={isExporting}
              aria-expanded={showExport}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {isExporting ? "Exporting…" : "Export"}
            </button>
            {showExport && (
              // Clicking anywhere else closes the menu
              <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
            )}
            {showExport && (
              <div className="absolute right-0 z-20 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                {[
                  {
                    label: "This essay (PDF)",
                    hint:
                      current.status === "accepted"
                        ? `Feedback for ${current.studentName}`
                        : "Accept this essay first",
                    disabled: current.status !== "accepted",
                    all: false,
                  },
                  {
                    label: "All accepted essays (ZIP)",
                    hint:
                      acceptedCount > 0
                        ? `One PDF per student · ${acceptedCount} of ${essays.length} accepted` +
                          (acceptedCount < essays.length
                            ? `, ${essays.length - acceptedCount} not included`
                            : "")
                        : "No essays accepted yet",
                    disabled: acceptedCount === 0,
                    all: true,
                  },
                ].map((option) => (
                  <button
                    key={option.label}
                    onClick={() => handleExport(option.all)}
                    disabled={option.disabled}
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <span className="block text-sm font-semibold text-slate-800">
                      {option.label}
                    </span>
                    <span className="block text-xs text-slate-500">{option.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {isAtRisk && (
            <span
              title={`Total of ${AT_RISK_MAX}/${maxTotal} or below`}
              className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
            >
              <AlertTriangle size={13} />
              At risk
            </span>
          )}
          <p className="font-display text-lg font-semibold text-slate-900">
            {total}
            <span className="text-sm font-medium text-slate-400"> / {maxTotal}</span>
          </p>
          {current.status === "accepted" ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-teal-50 px-3.5 py-2 text-sm font-semibold text-teal-700">
              <CheckCircle2 size={14} />
              Accepted
            </span>
          ) : (
            <button
              onClick={handleAccept}
              disabled={isSaving}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Accept"}
            </button>
          )}
        </div>
      </div>

      {(saveError || failed.length > 0) && (
        <div className="flex shrink-0 items-center gap-4 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800">
          <div className="min-w-0 flex-1 space-y-1">
            {saveError && <p className="font-semibold text-red-700">{saveError}</p>}
            {failed.map((f) => (
              <p key={f.fileName}>
                Not marked: {f.studentName} ({f.fileName}). {f.error}
              </p>
            ))}
          </div>
          {onRetryFailed && failed.length > 0 && failed.every((f) => f.file) && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              {isRetrying && <Loader2 size={13} className="animate-spin" />}
              {isRetrying
                ? "Retrying…"
                : `Retry ${failed.length === 1 ? "this essay" : `${failed.length} essays`}`}
            </button>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* ESSAY */}
        <div
          ref={essayRef}
          onMouseUp={captureSelection}
          className="min-w-0 flex-1 overflow-y-auto px-8 py-7"
        >
          <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white px-10 py-9 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
              {/* Legend, doubles as a filter */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ANNOTATION_TYPES)
                  .filter(([type]) => typeCounts[type])
                  .map(([type, style]) => {
                    const hidden = hiddenTypes.has(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        aria-pressed={!hidden}
                        className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
                          hidden
                            ? "border-slate-200 text-slate-400 line-through"
                            : "border-slate-200 font-medium text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${hidden ? "bg-slate-300" : style.dot}`}
                        />
                        {style.label} {typeCounts[type]}
                      </button>
                    );
                  })}
              </div>
            </div>

            <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-800">
              {segments.map((segment, i) => {
                const visible = segment.annotations.filter(
                  (a) => !hiddenTypes.has(a.type),
                );
                if (visible.length === 0) {
                  return <span key={i}>{segment.text}</span>;
                }
                // Colour by the selected comment if it covers this text, else
                // by the innermost one
                const active = visible.find((a) => a.id === activeId);
                const shown = active ?? visible[0];
                const style = getAnnotationType(shown.type);
                // Where comments overlap, each click selects the next one
                const selectNext = () => {
                  const at = visible.findIndex((a) => a.id === activeId);
                  selectAnnotation(visible[(at + 1) % visible.length].id);
                };
                return (
                  <mark
                    key={i}
                    data-annotation-ids={visible.map((a) => a.id).join(" ")}
                    role="button"
                    tabIndex={0}
                    title={
                      visible.length > 1
                        ? `${visible.length} comments here; click to cycle through them`
                        : shown.comment
                    }
                    onClick={selectNext}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectNext();
                      }
                    }}
                    className={`cursor-pointer rounded-sm text-inherit underline underline-offset-4 ${
                      visible.length > 1 ? "decoration-[3px]" : "decoration-2"
                    } ${style.mark} ${active ? "ring-2 ring-teal-400" : ""}`}
                  >
                    {segment.text}
                  </mark>
                );
              })}
            </p>
          </div>
        </div>

        <ResizeHandle
          label="Resize marking panel"
          isDragging={sidePanel.isDragging}
          {...sidePanel.handleProps}
        />

        {/* MARKING PANEL */}
        <div
          style={{ width: sidePanel.width }}
          className="flex shrink-0 flex-col bg-white"
        >
          <div className="flex shrink-0 gap-4 border-b border-slate-200 px-5 pt-3">
            {[
              { id: "marking", label: "Marking" },
              {
                id: "comments",
                label: `Comments (${current.annotations.length})`,
              },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-semibold ${
                  tab === t.id
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "marking" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              <p className="text-xs font-medium text-slate-500">
                Rubric · {result.rubric}
              </p>
              {current.run && (
                <p className="mb-4 mt-0.5 text-xs text-slate-400">
                  {[
                    current.run.useChecklist ? "Checklist" : "Direct rubric",
                    current.run.useModelEssays && "model essays",
                    current.source === "ocr" && "transcribed from a scan",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {!current.run && <div className="mb-4" />}

              {current.criteria.map((c) => {
                const weak = c.score / c.max < 0.5;
                const band = bandFor(c.name, c.score);
                const changed = c.score !== c.aiScore;
                return (
                  <div
                    key={c.name}
                    className={`mb-2.5 rounded-xl border p-3.5 ${
                      weak ? "border-amber-200 bg-amber-50/60" : "border-slate-200"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {c.name}
                        </p>
                        {band && (
                          <p
                            className={`text-xs font-semibold ${weak ? "text-amber-700" : "text-teal-700"}`}
                          >
                            Band {band.band}
                            <span className="font-normal text-slate-500">
                              {" "}
                              · {band.min_mark === band.max_mark
                                ? band.min_mark
                                : `${band.min_mark}–${band.max_mark}`}{" "}
                              marks
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Mark stepper: type a number, use the arrows, or ↑/↓ keys */}
                      <div
                        className={`flex items-center rounded-lg border bg-white ${
                          changed ? "border-coral-400" : "border-slate-200"
                        }`}
                      >
                        <input
                          type="number"
                          min={0}
                          max={c.max}
                          value={c.score}
                          onChange={(e) => setCriterionScore(c.name, Number(e.target.value))}
                          aria-label={`${c.name} mark`}
                          className="w-9 appearance-none border-0 bg-transparent py-1 pl-2 text-right text-sm font-semibold text-slate-900 shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          style={{ MozAppearance: "textfield" }}
                        />
                        <span className="pl-1 pr-1.5 text-sm text-slate-400">/ {c.max}</span>
                        <div className="flex flex-col border-l border-slate-200">
                          <button
                            onClick={() => setCriterionScore(c.name, c.score + 1)}
                            disabled={c.score >= c.max}
                            aria-label={`Increase ${c.name} mark`}
                            className="px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            onClick={() => setCriterionScore(c.name, c.score - 1)}
                            disabled={c.score <= 0}
                            aria-label={`Decrease ${c.name} mark`}
                            className="border-t border-slate-200 px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Rubric descriptor for the band this mark falls in */}
                    <p className="text-xs leading-5 text-slate-700">
                      {band ? band.descriptor : "No rubric band covers this mark."}
                    </p>

                    {changed ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-coral-500" />
                        Changed from the AI's mark of {c.aiScore}
                        <button
                          onClick={() => setCriterionScore(c.name, c.aiScore)}
                          className="font-semibold text-teal-700 hover:underline"
                        >
                          Undo
                        </button>
                      </p>
                    ) : (
                      c.note && (
                        <p className="mt-2 flex items-start gap-1.5 border-t border-slate-200/70 pt-2 text-xs leading-5 text-slate-500">
                          <Sparkles size={12} className="mt-0.5 shrink-0 text-teal-600" />
                          {c.note}
                        </p>
                      )
                    )}
                  </div>
                );
              })}

              {current.weaknessTags?.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700">Focus areas</span>
                  {current.weaknessTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mb-1.5 mt-4 flex items-center justify-between">
                <label
                  htmlFor="overall-feedback"
                  className="text-xs font-semibold text-slate-700"
                >
                  Overall feedback
                </label>
                <span className="flex items-center gap-1 text-xs text-teal-700">
                  <Sparkles size={12} />
                  Drafted by AI · editable
                </span>
              </div>
              <textarea
                id="overall-feedback"
                value={current.feedback}
                onChange={(e) => updateCurrent({ feedback: e.target.value })}
                className="min-h-[240px] w-full flex-1 resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 text-slate-700"
              />

              {/* MODEL ESSAYS, listed like the Content generator's resources */}
              {current.run?.useModelEssays && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Model essays used
                  </p>
                  {current.run.modelEssays.length > 0 ? (
                    <div className="space-y-1">
                      {current.run.modelEssays.map((name) => (
                        <div
                          key={name}
                          className="flex items-center gap-2 text-sm text-slate-600"
                        >
                          <Paperclip size={13} className="shrink-0 text-slate-400" />
                          <span className="min-w-0 truncate">{name}</span>
                          <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                            Model essay
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No model essays in your library matched this band, format and theme,
                      so this essay was marked without them.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              ref={commentsRef}
              className="min-h-0 flex-1 overflow-y-auto p-5"
            >
              {!draft?.isNew && (
                <button
                  onClick={startNewComment}
                  className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:border-coral-300 hover:bg-coral-50/50"
                >
                  <MessageSquarePlus size={15} className="text-coral-500" />
                  Add comment
                </button>
              )}

              {draft?.isNew && renderEditor()}

              {orderedAnnotations.length === 0 && !draft?.isNew && (
                <p className="py-8 text-center text-sm text-slate-500">No comments left.</p>
              )}

              {orderedAnnotations.map((a) => {
                const style = getAnnotationType(a.type);
                const isActive = activeId === a.id;

                if (editingId === a.id) return renderEditor();

                return (
                  <div
                    key={a.id}
                    data-annotation-id={a.id}
                    onClick={() => setActiveId(a.id)}
                    className={`group mb-2.5 cursor-pointer rounded-xl border p-3.5 transition-colors ${
                      isActive
                        ? "border-teal-500 ring-1 ring-teal-500"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}
                        >
                          {style.label}
                        </span>
                        {(a.edited || a.teacherAdded) && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-coral-500" />
                            {a.teacherAdded ? "Added by you" : "Edited"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(a);
                          }}
                          aria-label="Edit comment"
                          title="Edit"
                          className="rounded-md p-1 text-slate-400 hover:bg-coral-50 hover:text-coral-600"
                        >
                          <PenLine size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissAnnotation(a.id);
                          }}
                          aria-label="Dismiss comment"
                          title="Dismiss"
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {a.suggestion ? (
                      <p className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="text-slate-400 line-through">
                          {a.quote}
                        </span>
                        <ArrowRight size={12} className="text-slate-400" />
                        <span className="font-semibold text-teal-700">
                          {a.suggestion}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm italic text-slate-600">
                        “{a.quote}”
                      </p>
                    )}

                    <p className="mt-1.5 text-xs leading-5 text-slate-600">
                      {a.comment}
                    </p>

                    {!ranges.has(a.id) && (
                      <p className="mt-1.5 text-xs text-amber-700">
                        Not highlighted: this text couldn't be found in the essay
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
