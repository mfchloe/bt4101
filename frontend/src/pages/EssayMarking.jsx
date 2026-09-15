import { useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

const ESSAYS = [
  {
    initials: "TW",
    name: "Tan Wei Ling",
    index: 3,
    total: 28,
    overall: "11 / 20",
    flag: "Borderline",
    body: [
      {
        text: "Some people think that school uniforms should be removed because it limits how student express themselves. However, I believe uniforms should be kept.",
        highlight: "orange",
      },
      {
        text: "Firstly, uniforms create a sense of equality among students, since everyone wears the same thing regardless of family income.",
        highlight: "blue",
      },
      {
        text: "Secondly, it help student to focus more on study instead of what to wear every morning.",
        highlight: "orange",
      },
      {
        text: "In conclusion, uniforms should stay because it is good for the school.",
      },
    ],
    criteria: [
      {
        name: "Content",
        score: "4 / 5",
        note: "Clear stance with two supporting reasons.",
        warn: false,
      },
      {
        name: "Language",
        score: "2 / 5",
        note: "Subject-verb agreement errors highlighted in orange.",
        warn: true,
      },
      {
        name: "Organisation",
        score: "5 / 5",
        note: "Clear intro, body, and conclusion structure.",
        warn: false,
      },
    ],
    feedback:
      "Good structure and a clear stance. Focus next on subject-verb agreement — see highlighted sentences.",
  },
];

const HIGHLIGHT_CLASSES = {
  orange: "bg-amber-100",
  blue: "bg-sky-100",
};

export default function EssayMarking() {
  const [current] = useState(ESSAYS[0]);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <button aria-label="Previous essay">
            <ChevronLeft
              size={16}
              className="text-slate-500 hover:text-slate-700"
            />
          </button>
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-indigo-700">
            {current.initials}
          </div>
          <div>
            <p className="text-sm text-slate-900">{current.name}</p>
            <p className="text-xs text-slate-400">
              Essay {current.index} of {current.total}
            </p>
          </div>
          <button aria-label="Next essay">
            <ChevronRight
              size={16}
              className="text-slate-500 hover:text-slate-700"
            />
          </button>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="flex items-center gap-1 text-sm text-amber-600">
            <AlertTriangle size={14} />
            {current.flag}
          </span>
          <p className="text-[15px] font-medium text-slate-900">
            {current.overall}
          </p>
          <button className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
            Override
          </button>
          <button className="rounded-md bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700">
            Accept
          </button>
        </div>
      </div>

      <div className="flex h-[420px]">
        <div className="flex-1 overflow-y-auto border-r border-slate-200 p-5">
          <p className="mb-2.5 text-xs text-slate-400">
            Scanned essay · OCR verified
          </p>
          <p className="text-sm leading-7 text-slate-800">
            {current.body.map((chunk, i) => (
              <span key={i}>
                {chunk.highlight ? (
                  <mark
                    className={`${HIGHLIGHT_CLASSES[chunk.highlight]} px-0.5`}
                  >
                    {chunk.text}
                  </mark>
                ) : (
                  chunk.text
                )}
                <br />
                <br />
              </span>
            ))}
          </p>
        </div>

        <div className="w-[300px] shrink-0 overflow-y-auto p-5">
          <p className="mb-3 text-sm text-slate-500">
            Rubric: persuasive essay G2
          </p>

          {current.criteria.map((c) => (
            <div
              key={c.name}
              className="mb-2.5 rounded-md border border-slate-200 p-2.5"
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{c.name}</p>
                <select
                  defaultValue={c.score}
                  className="w-auto rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                >
                  <option>{c.score}</option>
                </select>
              </div>
              <p
                className={`text-xs ${c.warn ? "flex items-center gap-1 text-amber-600" : "text-slate-500"}`}
              >
                {c.warn && <AlertTriangle size={12} />}
                {c.note}
              </p>
            </div>
          ))}

          <label className="mb-1 block text-xs text-slate-500">
            Overall feedback
          </label>
          <textarea
            defaultValue={current.feedback}
            className="min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
