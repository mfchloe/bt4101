import { useState } from "react";
import { Search, Upload, Folder, FileText, ChevronDown } from "lucide-react";
import UploadFileModal from "../components/UploadFileModal";

const FOLDERS = [
  { name: "Rubrics", count: 9, color: "text-indigo-600" },
  { name: "Model essays", count: 14, color: "text-emerald-600" },
  { name: "Lesson notes", count: 11, color: "text-violet-600" },
  { name: "Marked essays", count: 8, color: "text-amber-600" },
];

const RUBRIC_FILES = [
  { name: "Narrative writing rubric G2.pdf", format: "Narrative" },
  { name: "Persuasive essay rubric G1.pdf", format: "Persuasive" },
];

export default function FileLibrary() {
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("all");
  const [activeFolder, setActiveFolder] = useState("Rubrics");
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-base font-medium text-slate-900">File library</p>
          <p className="mt-0.5 text-sm text-slate-500">
            42 resources across 4 folders
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          <Upload size={16} />
          Upload file
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files"
            className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-2 text-sm"
          />
        </div>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All formats</option>
          <option>Short answer</option>
          <option>Narrative</option>
          <option>Argumentative</option>
          <option>Persuasive</option>
        </select>
        <select className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option>All themes</option>
        </select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FOLDERS.map((f) => (
          <button
            key={f.name}
            onClick={() => setActiveFolder(f.name)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              activeFolder === f.name
                ? "border-indigo-300 bg-indigo-50/50"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Folder size={22} className={f.color} />
            <p className="mt-2.5 text-sm font-medium text-slate-900">
              {f.name}
            </p>
            <p className="text-xs text-slate-400">{f.count} files</p>
          </button>
        ))}
      </div>

      <p className="mb-2 flex items-center gap-1 text-sm text-slate-500">
        {activeFolder} <ChevronDown size={14} />
      </p>
      <div className="flex flex-col">
        {RUBRIC_FILES.map((file, i) => (
          <div
            key={file.name}
            className={`flex items-center gap-3 border-t border-slate-200 py-2.5 ${
              i === RUBRIC_FILES.length - 1 ? "border-b" : ""
            }`}
          >
            <FileText size={18} className="text-slate-500" />
            <p className="flex-1 text-sm text-slate-800">{file.name}</p>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {file.format}
            </span>
          </div>
        ))}
      </div>

      {showUpload && <UploadFileModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
