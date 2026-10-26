import { ClipboardCheck, ListChecks, Loader2, X } from "lucide-react";

/*
 * Pop-up showing the checklist built for a batch (stage 1 of checklist
 * prompting) before any essay is marked. Every essay in the batch is then
 * scored against these same yes/no questions.
 */
export default function ChecklistReview({
  checklist,
  rubricBands,
  question,
  band,
  essayCount,
  onContinue,
  onBack,
  isStarting,
}) {
  // Criteria in rubric order, each with its bands from highest to lowest
  const criteria = [...new Set(checklist.map((q) => q.criterion))];
  const marksFor = (criterion, bandNo) => {
    const b = rubricBands.find((r) => r.criterion === criterion && r.band === bandNo);
    if (!b) return "";
    return b.min_mark === b.max_mark ? `${b.min_mark} marks` : `${b.min_mark}–${b.max_mark} marks`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <h2 id="checklist-title" className="text-lg font-semibold text-slate-900">
              Marking checklist
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              CoTeach turned the {band} rubric into yes/no checks for this question.
              Every essay in this batch will be marked against them.
            </p>
            {question && (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Question: </span>
                {question}
              </p>
            )}
          </div>
          <button
            onClick={onBack}
            disabled={isStarting}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* CHECKLIST */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {criteria.map((criterion) => {
            const questions = checklist.filter((q) => q.criterion === criterion);
            const bands = [...new Set(questions.map((q) => q.band))].sort((a, b) => b - a);
            return (
              <section key={criterion}>
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ListChecks size={16} className="text-teal-600" />
                  {criterion}
                  <span className="text-xs font-normal text-slate-500">
                    {questions.length} checks
                  </span>
                </h3>
                <div className="divide-y divide-slate-100">
                  {bands.map((bandNo) => (
                    <div key={bandNo} className="flex gap-4 py-2.5">
                      <div className="w-24 shrink-0">
                        <p className="text-xs font-semibold text-teal-700">Band {bandNo}</p>
                        <p className="text-xs text-slate-500">{marksFor(criterion, bandNo)}</p>
                      </div>
                      <ul className="flex-1 space-y-1.5">
                        {questions
                          .filter((q) => q.band === bandNo)
                          .map((q, i) => (
                            <li key={i} className="text-sm leading-6 text-slate-700">
                              {q.question}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onBack}
            disabled={isStarting}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={onContinue}
            disabled={isStarting}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
          >
            {isStarting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <ClipboardCheck size={15} />
            )}
            Continue · mark {essayCount} essay{essayCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
