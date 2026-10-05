import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowUp, Sparkles } from "lucide-react";
import {
  ASSIGNMENTS,
  AT_RISK_BELOW,
  ESSAYS,
  MAX_TOTAL,
} from "./analyticsSample";

const C = {
  accent: "var(--color-teal-600)",
  warning: "var(--color-amber-400)",
  grid: "var(--color-slate-200)",
  axis: "var(--color-slate-500)",
};

const SUGGESTIONS = [
  "Which students scored below 9 for Language?",
  "How did the class do on the discursive essay?",
  "Who improved the most this term?",
];

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const round1 = (x) => Math.round(x * 10) / 10;

function StatTile({ label, value, max, warn }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-slate-900">{value}</span>
        {max && <span className="text-sm text-slate-400">/ {max}</span>}
        {warn && (
          <span className="ml-1 flex items-center gap-1 self-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <AlertTriangle size={12} />
            {warn}
          </span>
        )}
      </p>
    </div>
  );
}

export default function Analytics() {
  const [filter, setFilter] = useState("all");
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState([]);

  const essays = useMemo(
    () => (filter === "all" ? ESSAYS : ESSAYS.filter((e) => e.assignmentId === filter)),
    [filter],
  );

  // One row per student (averaged when looking at all essays), lowest first
  const students = useMemo(() => {
    const byStudent = new Map();
    essays.forEach((e) => {
      if (!byStudent.has(e.studentId)) byStudent.set(e.studentId, []);
      byStudent.get(e.studentId).push(e);
    });
    return [...byStudent.values()]
      .map((list) => ({
        id: list[0].studentId,
        name: list[0].student,
        total: round1(mean(list.map((e) => e.total))),
        issue: list.at(-1).weaknesses[0],
      }))
      .sort((a, b) => a.total - b.total);
  }, [essays]);

  const atRisk = students.filter((s) => s.total < AT_RISK_BELOW);

  // Number of essays in each 3-mark range of the total
  const bins = Array.from({ length: 10 }, (_, i) => {
    const lo = i * 3;
    const hi = i === 9 ? MAX_TOTAL : lo + 2;
    return {
      range: `${lo}–${hi}`,
      count: essays.filter((e) => e.total >= lo && e.total <= hi).length,
      atRisk: hi < AT_RISK_BELOW,
    };
  });

  const ask = (text) => {
    const q = text.trim();
    if (!q) return;
    setAsked((list) => [...list, q]);
    setQuestion("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-6 py-6 lg:flex-row">
      {/* LEFT: RESULTS */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Performance analytics
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Class 2A · sample data until marked essays are saved
            </p>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Essays to include"
            className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">All marked essays</option>
            {[...ASSIGNMENTS].reverse().map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} · {a.format} ({a.date})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile
            label="Class average"
            value={round1(mean(essays.map((e) => e.total)))}
            max={MAX_TOTAL}
          />
          <StatTile label="Content" value={round1(mean(essays.map((e) => e.content)))} max={10} />
          <StatTile label="Language" value={round1(mean(essays.map((e) => e.language)))} max={20} />
          <StatTile
            label="At-risk students"
            value={atRisk.length}
            warn={atRisk.length ? `below ${AT_RISK_BELOW}` : null}
          />
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-5">
          {/* SCORE DISTRIBUTION */}
          <section className="flex min-h-75 flex-col rounded-xl border border-slate-200 bg-white p-5 xl:col-span-3">
            <h2 className="text-base font-semibold text-slate-900">Score distribution</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Essays by total mark out of {MAX_TOTAL}
            </p>
            <div className="mt-4 min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bins} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis
                    dataKey="range"
                    interval={0}
                    tick={{ fill: C.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: C.grid }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: C.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-slate-100)" }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold text-slate-900">
                            {payload[0].payload.range} marks
                          </p>
                          <p className="text-slate-600">{payload[0].value} essays</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="count"
                    maxBarSize={24}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  >
                    {bins.map((b) => (
                      <Cell key={b.range} fill={b.atRisk ? C.warning : C.accent} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.warning }} />
              <AlertTriangle size={12} className="text-amber-600" />
              At risk: below {AT_RISK_BELOW} / {MAX_TOTAL}
            </p>
          </section>

          {/* LOWEST TOTALS */}
          <section className="flex min-h-75 flex-col rounded-xl border border-slate-200 bg-white xl:col-span-2">
            <div className="px-5 pb-2 pt-5">
              <h2 className="text-base font-semibold text-slate-900">Lowest totals</h2>
              <p className="mt-0.5 text-sm text-slate-500">Students who may need support</p>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {students.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">{s.issue}</p>
                  </div>
                  {s.total < AT_RISK_BELOW && (
                    <AlertTriangle
                      size={14}
                      className="shrink-0 text-amber-600"
                      aria-label="At risk"
                    />
                  )}
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {s.total}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* RIGHT: ASK ABOUT YOUR CLASS */}
      <aside className="flex min-h-105 w-full shrink-0 flex-col rounded-xl border border-slate-200 bg-white lg:min-h-0 lg:w-96">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Ask about your class</h2>
          <p className="mt-0.5 text-sm text-slate-500">Answered from your marking records</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {asked.length === 0 ? (
            <div className="flex h-full flex-col justify-end">
              <p className="mb-2 text-xs font-semibold text-slate-500">Try asking</p>
              <div className="flex flex-col items-start gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {asked.map((q, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-teal-600 px-3.5 py-2 text-sm text-white">
                    {q}
                  </p>
                  <p className="flex max-w-[85%] items-start gap-2 self-start rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2 text-sm text-slate-600">
                    <Sparkles size={14} className="mt-0.5 shrink-0 text-teal-600" />
                    Answers will appear here once questions are connected to the marks
                    database.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2 border-t border-slate-100 p-3"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            aria-label="Ask"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40"
          >
            <ArrowUp size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}
