import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MessageSquarePlus,
  PenLine,
  Sparkles,
  TextSelect,
  X,
} from "lucide-react";
import ResizeHandle from "../ResizeHandle";
import { AT_RISK_MAX } from "../../options";
import useResizableWidth from "../../hooks/useResizableWidth";
import {
  ANNOTATION_TYPES,
  buildSegments,
  getAnnotationType,
} from "./annotations";

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

export default function EssayReview({ result, onNewBatch }) {
  const [essays, setEssays] = useState(() =>
    result.essays.map((e) => ({
      ...e,
      status: "pending",
      criteria: e.criteria.map((c) => ({ ...c, aiScore: c.score })),
    })),
  );
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState("marking");
  const [activeId, setActiveId] = useState(null);
  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  // Comment being edited, and the teacher's unsaved changes to it
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  // Last text the teacher selected in the essay, for "Use selection"
  const [selectedText, setSelectedText] = useState("");

  const essayRef = useRef(null);
  const commentsRef = useRef(null);

  const sidePanel = useResizableWidth({
    initial: 360,
    min: 280,
    max: 680,
    edge: "left",
  });

  const current = essays[index];

  const { segments, placedIds } = useMemo(
    () => buildSegments(current.text, current.annotations),
    [current.text, current.annotations],
  );

  // Annotations in the order they appear in the essay; unplaced ones last
  const orderedAnnotations = useMemo(() => {
    const placed = segments
      .filter((s) => s.annotation)
      .map((s) => s.annotation);
    const unplaced = current.annotations.filter((a) => !placedIds.has(a.id));
    return [...placed, ...unplaced];
  }, [segments, placedIds, current.annotations]);

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
    const selector = `[data-annotation-id="${activeId}"]`;
    essayRef.current
      ?.querySelector(selector)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    commentsRef.current
      ?.querySelector(selector)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId, tab]);

  // Any edit to an accepted essay (marks, comments, feedback) puts it back to
  // "pending", so the teacher has to accept the changed version again
  const updateCurrent = (changes) =>
    setEssays((all) =>
      all.map((e, i) =>
        i === index ? { ...e, status: "pending", ...changes } : e,
      ),
    );

  const goTo = (nextIndex) => {
    setIndex(nextIndex);
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
    const quoteFound =
      draft.quote.trim() && current.text.includes(draft.quote.trim());
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

  const handleAccept = () => {
    updateCurrent({ status: "accepted" });
    if (index < essays.length - 1) goTo(index + 1);
  };

  const acceptedCount = essays.filter((e) => e.status === "accepted").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* HEADER */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNewBatch}
            className="mr-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <ArrowLeft size={14} />
            New batch
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
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
            >
              Accept
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ESSAY */}
        <div
          ref={essayRef}
          onMouseUp={captureSelection}
          className="min-w-0 flex-1 overflow-y-auto px-8 py-7"
        >
          <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white px-10 py-9 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
              <button
                onClick={startNewComment}
                onMouseUp={(e) => e.stopPropagation()}
                className="order-last ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-coral-300 hover:bg-coral-50"
              >
                <MessageSquarePlus size={14} className="text-coral-500" />
                {selectedText ? "Comment on selection" : "Add comment"}
              </button>
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
                const { annotation } = segment;
                if (!annotation || hiddenTypes.has(annotation.type)) {
                  return <span key={i}>{segment.text}</span>;
                }
                const style = getAnnotationType(annotation.type);
                const isActive = activeId === annotation.id;
                return (
                  <mark
                    key={i}
                    data-annotation-id={annotation.id}
                    role="button"
                    tabIndex={0}
                    title={annotation.comment}
                    onClick={() => selectAnnotation(annotation.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectAnnotation(annotation.id);
                      }
                    }}
                    className={`cursor-pointer rounded-sm px-0.5 text-inherit underline decoration-2 underline-offset-4 ${style.mark} ${
                      isActive ? "ring-2 ring-teal-400" : ""
                    }`}
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
              <p className="mb-4 text-xs font-medium text-slate-500">
                Rubric · {result.rubric}
              </p>

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

                    {!placedIds.has(a.id) && (
                      <p className="mt-1.5 text-xs text-amber-700">
                        Not highlighted: the text isn't in the essay or overlaps
                        another comment
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
