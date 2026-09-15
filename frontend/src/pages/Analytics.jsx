import { useState } from "react";

const STATS = [
  { label: "Class average", value: "14.2 / 20" },
  { label: "At-risk students", value: "4" },
  { label: "Weakest criterion", value: "Organisation" },
];

const CRITERIA = [
  { name: "Content", pct: 76, warn: false },
  { name: "Language", pct: 70, warn: false },
  { name: "Organisation", pct: 58, warn: true },
];

const STUDENTS = [
  { name: "Muhammad Rizwan", note: "Weak: Organisation, 2 assignments" },
  { name: "Ahmad Hakim", note: "Weak: Language, 3 assignments" },
];

export default function Analytics() {
  const [query, setQuery] = useState("");

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-base font-medium text-slate-900">
          Performance analytics — class 2A
        </p>
        <select className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option>Persuasive essay</option>
          <option>All assignments</option>
        </select>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-md bg-slate-50 p-4">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-medium text-slate-900">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <p className="mb-2 text-sm text-slate-500">Criterion-level performance</p>
      <div className="mb-4 flex flex-col gap-2.5">
        {CRITERIA.map((c) => (
          <div key={c.name}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-800">{c.name}</span>
              <span className={c.warn ? "text-amber-600" : "text-slate-500"}>
                {c.pct}%
              </span>
            </div>
            <div className="h-2 rounded bg-slate-100">
              <div
                className={`h-2 rounded ${c.warn ? "bg-amber-500" : "bg-indigo-500"}`}
                style={{ width: `${c.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mb-2 text-sm text-slate-500">Students needing support</p>
      <div className="mb-4 flex flex-col">
        {STUDENTS.map((s, i) => (
          <div
            key={s.name}
            className={`flex items-center gap-3 border-t border-slate-200 py-2 ${
              i === STUDENTS.length - 1 ? "border-b" : ""
            }`}
          >
            <span className="flex-1 text-sm text-slate-800">{s.name}</span>
            <span className="text-xs text-amber-600">{s.note}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Which students scored below 10 on organisation?"
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">
          Ask ↗
        </button>
      </div>
    </div>
  );
}
