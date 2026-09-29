import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import ResizeHandle from "../ResizeHandle";
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
    result.essays.map((e) => ({ ...e, status: "pending" })),
  );
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState("marking");
  const [activeId, setActiveId] = useState(null);
  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  const [isOverriding, setIsOverriding] = useState(false);

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

  const updateCurrent = (changes) =>
    setEssays((all) =>
      all.map((e, i) => (i === index ? { ...e, ...changes } : e)),
    );

  const goTo = (nextIndex) => {
    setIndex(nextIndex);
    setActiveId(null);
    setIsOverriding(false);
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
  };

  const setCriterionScore = (name, score) =>
    updateCurrent({
      criteria: current.criteria.map((c) =>
        c.name === name ? { ...c, score } : c,
      ),
    });

  const toggleType = (type) =>
    setHiddenTypes((hidden) => {
      const next = new Set(hidden);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const handleAccept = () => {
    updateCurrent({ status: "accepted" });
    setIsOverriding(false);
    if (index < essays.length - 1) goTo(index + 1);
  };

  const acceptedCount = essays.filter((e) => e.status === "accepted").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* HEADER */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNewBatch}
            className="mr-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <ArrowLeft size={14} />
            New batch
          </button>

          <button
            aria-label="Previous essay"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="text-slate-500 hover:text-slate-700 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-indigo-700">
            {initialsOf(current.studentName)}
          </div>
          <div>
            <p className="text-sm text-slate-900">{current.studentName}</p>
            <p className="text-xs text-slate-400">
              Essay {index + 1} of {essays.length} · {acceptedCount} accepted
            </p>
          </div>
          <button
            aria-label="Next essay"
            onClick={() => goTo(index + 1)}
            disabled={index === essays.length - 1}
            className="text-slate-500 hover:text-slate-700 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3.5">
          {current.flag && (
            <span className="flex items-center gap-1 text-sm text-amber-600">
              <AlertTriangle size={14} />
              {current.flag}
            </span>
          )}
          <p className="text-[15px] font-medium text-slate-900">
            {total} / {maxTotal}
          </p>
          <button
            onClick={() => {
              setIsOverriding((o) => !o);
              setTab("marking");
            }}
            className={`rounded-md border px-3 py-1 text-sm ${
              isOverriding
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isOverriding ? "Done" : "Override"}
          </button>
          {current.status === "accepted" ? (
            <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
              <CheckCircle2 size={14} />
              Accepted
            </span>
          ) : (
            <button
              onClick={handleAccept}
              className="rounded-md bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
            >
              Accept
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ESSAY */}
        <div ref={essayRef} className="min-w-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">
                {current.source === "ocr"
                  ? "Scanned essay · OCR verified"
                  : "Typed submission"}
              </p>

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
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
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

            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
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
                      isActive ? "ring-2 ring-indigo-400" : ""
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
          className="flex shrink-0 flex-col"
        >
          <div className="flex shrink-0 gap-1 border-b border-slate-200 px-5 pt-3">
            {[
              { id: "marking", label: "Marking" },
              {
                id: "comments",
                label: `AI comments (${current.annotations.length})`,
              },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-2 pb-2 text-sm ${
                  tab === t.id
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "marking" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              <p className="mb-3 text-sm text-slate-500">
                Rubric: {result.rubric}
              </p>

              {current.criteria.map((c) => {
                const weak = c.score / c.max < 0.5;
                return (
                  <div
                    key={c.name}
                    className="mb-2.5 rounded-md border border-slate-200 p-2.5"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">
                        {c.name}
                      </p>
                      <select
                        value={c.score}
                        onChange={(e) =>
                          setCriterionScore(c.name, Number(e.target.value))
                        }
                        disabled={!isOverriding}
                        className={`w-auto rounded border px-1.5 py-0.5 text-xs ${
                          isOverriding
                            ? "border-indigo-300 bg-white"
                            : "border-slate-300 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {Array.from({ length: c.max + 1 }, (_, s) => (
                          <option key={s} value={s}>
                            {s} / {c.max}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p
                      className={`text-xs ${weak ? "flex items-center gap-1 text-amber-600" : "text-slate-500"}`}
                    >
                      {weak && <AlertTriangle size={12} className="shrink-0" />}
                      {c.note}
                    </p>
                  </div>
                );
              })}

              <div className="mb-1 mt-3 flex items-center justify-between">
                <label
                  htmlFor="overall-feedback"
                  className="text-xs text-slate-500"
                >
                  Overall feedback
                </label>
                <span className="text-xs text-slate-400">
                  Drafted by AI · editable
                </span>
              </div>
              <textarea
                id="overall-feedback"
                value={current.feedback}
                onChange={(e) => updateCurrent({ feedback: e.target.value })}
                className="min-h-[240px] w-full flex-1 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-700 focus:border-indigo-300 focus:outline-none"
              />
            </div>
          ) : (
            <div
              ref={commentsRef}
              className="min-h-0 flex-1 overflow-y-auto p-5"
            >
              {orderedAnnotations.length === 0 && (
                <p className="text-sm text-slate-400">No comments left.</p>
              )}

              {orderedAnnotations.map((a) => {
                const style = getAnnotationType(a.type);
                const isActive = activeId === a.id;
                return (
                  <div
                    key={a.id}
                    data-annotation-id={a.id}
                    onClick={() => setActiveId(a.id)}
                    className={`mb-2.5 cursor-pointer rounded-md border p-3 transition-colors ${
                      isActive
                        ? "border-indigo-300 ring-1 ring-indigo-300"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${style.badge}`}
                      >
                        {style.label}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissAnnotation(a.id);
                        }}
                        aria-label="Dismiss comment"
                        title="Dismiss"
                        className="text-slate-300 hover:text-slate-500"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {a.suggestion ? (
                      <p className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="text-slate-400 line-through">
                          {a.quote}
                        </span>
                        <ArrowRight size={12} className="text-slate-400" />
                        <span className="font-medium text-emerald-700">
                          {a.suggestion}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm italic text-slate-600">
                        “{a.quote}”
                      </p>
                    )}

                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      {a.comment}
                    </p>

                    {!placedIds.has(a.id) && (
                      <p className="mt-1.5 text-xs text-amber-600">
                        Passage not found in essay text
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
