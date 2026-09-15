import { useRef, useState } from "react";
import { Upload, Paperclip, RefreshCw, Download } from "lucide-react";

const BANDS = ["G1", "G2", "G3"];

const SECTIONS = [
  {
    title: "Section 1: warm-up",
    body: "Identify the claim and counter-claim in the sample paragraph below.",
  },
  {
    title: "Section 2: scaffolded practice",
    body: "Complete the sentence starters to build your own counter-argument.",
  },
];

export default function ContentGenerator() {
  const [band, setBand] = useState("G1");
  const [materialType, setMaterialType] = useState("Worksheet");
  const [theme, setTheme] = useState("Persuasive writing");
  const [format, setFormat] = useState("Short answer");
  const [instructions, setInstructions] = useState("");
  const [sessionFile, setSessionFile] = useState("counter_argument_notes.pdf");
  const fileInputRef = useRef(null);

  return (
    <div className="flex">
      <div className="w-[260px] shrink-0 border-r border-slate-200 p-5">
        <p className="mb-4 text-[15px] font-medium text-slate-900">
          Generate material
        </p>

        <label className="mb-1.5 block text-xs text-slate-500">
          Full SBB band
        </label>
        <div className="mb-3.5 flex gap-1.5">
          {BANDS.map((b) => (
            <button
              key={b}
              onClick={() => setBand(b)}
              className={`flex-1 rounded-md border px-2 py-1 text-sm ${
                band === b
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-slate-500">
          Material type
        </label>
        <select
          value={materialType}
          onChange={(e) => setMaterialType(e.target.value)}
          className="mb-3.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option>Worksheet</option>
          <option>Lesson activity</option>
          <option>Practice questions</option>
        </select>

        <label className="mb-1 block text-xs text-slate-500">Theme</label>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="mb-3.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />

        <label className="mb-1 block text-xs text-slate-500">Format</label>
        <input
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="mb-3.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />

        <label className="mb-1 block text-xs text-slate-500">
          Additional instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Focus on counter-argument structure"
          className="mb-3.5 min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Upload size={15} />
          Upload session file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) =>
            e.target.files?.[0] && setSessionFile(e.target.files[0].name)
          }
        />
        {sessionFile && (
          <p className="mb-3.5 flex items-center gap-1 text-xs text-slate-400">
            <Paperclip size={13} />
            {sessionFile}
          </p>
        )}

        <button className="w-full rounded-md bg-indigo-600 py-1.5 text-sm text-white hover:bg-indigo-700">
          Generate ↗
        </button>
      </div>

      <div className="min-w-0 flex-1 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Preview — {band} {theme.toLowerCase()} {materialType.toLowerCase()}
          </p>
          <button className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
            <Download size={14} />
            Export
          </button>
        </div>
        <div className="min-h-[280px] rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-base font-medium text-slate-900">
            {theme} {materialType.toLowerCase()}
          </p>
          {SECTIONS.map((s) => (
            <div
              key={s.title}
              className="mb-2.5 rounded-md border border-slate-200 bg-white p-3 last:mb-0"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{s.title}</p>
                <button aria-label="Regenerate section">
                  <RefreshCw
                    size={14}
                    className="text-indigo-600 hover:text-indigo-700"
                  />
                </button>
              </div>
              <p className="mt-1.5 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
