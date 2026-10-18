import { Check, Pencil, RefreshCw } from "lucide-react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// Grow the textarea to fit its text, so the section never scrolls on its own
const autoSize = (el) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const ACTION =
  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50";

/*
 * One "## " section of the generated material: rendered Markdown by default,
 * or a plain-text editor while the teacher is editing it.
 * Elements marked data-no-print are left out of the PDF export.
 */
export default function MaterialSection({
  title,
  body,
  editing,
  onToggleEdit,
  onChange,
  onRegenerate,
  regenerating = false,
  regenerateDisabled = false,
  pageBreakBefore = false,
}) {
  return (
    <section
      className={`group mb-7 break-inside-avoid-page last:mb-0 ${
        pageBreakBefore ? "print:break-before-page" : ""
      }`}
    >
      {/* Shows the teacher where the PDF starts a new page */}
      {pageBreakBefore && (
        <div
          data-no-print
          className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          <span className="h-px flex-1 border-t border-dashed border-slate-300" />
          Teacher only · new page
          <span className="h-px flex-1 border-t border-dashed border-slate-300" />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {title && (
          <h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3>
        )}

        <div
          data-no-print
          className={`ml-auto flex shrink-0 gap-1 transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
            editing || regenerating ? "opacity-100" : "opacity-0"
          }`}
        >
          <button onClick={onToggleEdit} disabled={regenerating} className={ACTION}>
            {editing ? <Check size={13} /> : <Pencil size={13} />}
            {editing ? "Done" : "Edit"}
          </button>

          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={regenerateDisabled}
              title="Regenerate this section"
              className={ACTION}
            >
              <RefreshCw size={13} className={regenerating ? "animate-spin" : ""} />
              {regenerating ? "Regenerating…" : "Regenerate"}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          ref={autoSize}
          value={body.trim()}
          onChange={(e) => {
            autoSize(e.target);
            onChange(e.target.value);
          }}
          autoFocus
          className="mt-2 w-full resize-none overflow-hidden rounded-lg border border-teal-200 bg-teal-50/30 p-3 font-mono text-sm leading-6 text-slate-800 outline-none focus:border-teal-400"
        />
      ) : (
        <div
          className={`prose prose-slate mt-2 max-w-none text-[15px] leading-7 prose-headings:font-display prose-headings:text-slate-900 prose-strong:text-slate-900 prose-li:my-0.5 prose-table:text-sm prose-th:bg-slate-50 prose-th:px-3 prose-td:px-3 ${
            regenerating ? "opacity-40" : ""
          }`}
        >
          <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{body}</Markdown>
        </div>
      )}
    </section>
  );
}
