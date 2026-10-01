import { useEffect, useState } from "react";
import {
  Search,
  Upload,
  Folder,
  FileText,
  ChevronDown,
  Trash2,
  Table2,
} from "lucide-react";
import UploadFileModal from "../components/UploadFileModal";
import RubricEditor from "../components/RubricEditor";
import { API_URL } from "../api";

// Each folder shows the files of one document type
const FOLDERS = [
  { name: "Rubrics", docType: "Rubric", color: "text-indigo-600" },
  { name: "Model essays", docType: "Model essay", color: "text-emerald-600" },
  { name: "Lesson notes", docType: "Lesson notes", color: "text-violet-600" },
  { name: "Marked essays", docType: "Marked essay", color: "text-amber-600" },
];

const fetchFiles = () =>
  fetch(`${API_URL}/api/library/files`)
    .then((response) => response.json())
    .then((data) => data.files)
    .catch((error) => {
      console.error("Could not load files:", error);
      return [];
    });

// Unique, non-empty values of a field, for the filter dropdowns
const uniqueValues = (files, key) =>
  [...new Set(files.map((f) => f[key]).filter(Boolean))].sort();

export default function FileLibrary() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [sbb, setSbb] = useState("all");
  const [format, setFormat] = useState("all");
  const [theme, setTheme] = useState("all");
  const [activeFolder, setActiveFolder] = useState(FOLDERS[0]);
  const [showUpload, setShowUpload] = useState(false);
  const [rubricFile, setRubricFile] = useState(null); // rubric open in the band editor

  const loadFiles = () => fetchFiles().then(setFiles);

  useEffect(() => {
    fetchFiles().then(setFiles);
  }, []);

  // After an upload, refresh the list; rubrics go straight to band review
  const handleUploaded = (file) => {
    loadFiles();
    if (file.doc_type === "Rubric") setRubricFile(file);
  };

  const handleDelete = async (file) => {
    if (!confirm(`Delete "${file.filename}" from the library?`)) return;
    await fetch(`${API_URL}/api/library/files/${file.id}`, { method: "DELETE" });
    loadFiles();
  };

  const visibleFiles = files.filter(
    (f) =>
      f.doc_type === activeFolder.docType &&
      f.filename.toLowerCase().includes(search.toLowerCase()) &&
      // Files with no SBB apply to all levels, so they match any SBB filter
      (sbb === "all" || !f.sbb || f.sbb === sbb) &&
      (format === "all" || f.format === format) &&
      (theme === "all" || f.theme === theme),
  );

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-base font-medium text-slate-900">File library</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {files.length} resources across {FOLDERS.length} folders
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
          value={sbb}
          onChange={(e) => setSbb(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All SBB</option>
          <option>G1</option>
          <option>G2</option>
          <option>G3</option>
        </select>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All formats</option>
          {uniqueValues(files, "format").map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All themes</option>
          {uniqueValues(files, "theme").map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FOLDERS.map((f) => (
          <button
            key={f.name}
            onClick={() => setActiveFolder(f)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              activeFolder.name === f.name
                ? "border-indigo-300 bg-indigo-50/50"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Folder size={22} className={f.color} />
            <p className="mt-2.5 text-sm font-medium text-slate-900">
              {f.name}
            </p>
            <p className="text-xs text-slate-400">
              {files.filter((file) => file.doc_type === f.docType).length} files
            </p>
          </button>
        ))}
      </div>

      <p className="mb-2 flex items-center gap-1 text-sm text-slate-500">
        {activeFolder.name} <ChevronDown size={14} />
      </p>
      {visibleFiles.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">No files yet</p>
      )}
      <div className="flex flex-col">
        {visibleFiles.map((file, i) => (
          <div
            key={file.id}
            className={`flex items-center gap-3 border-t border-slate-200 py-2.5 ${
              i === visibleFiles.length - 1 ? "border-b" : ""
            }`}
          >
            <FileText size={18} className="text-slate-500" />
            <p className="flex-1 text-sm text-slate-800">{file.filename}</p>
            {[file.sbb, file.theme, file.format].filter(Boolean).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
              >
                {tag}
              </span>
            ))}
            {file.doc_type === "Rubric" && (
              <button
                onClick={() => setRubricFile(file)}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Table2 size={14} /> Bands
              </button>
            )}
            <button
              onClick={() => handleDelete(file)}
              aria-label="Delete file"
              className="text-slate-400 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {showUpload && (
        <UploadFileModal
          onClose={() => setShowUpload(false)}
          onUpload={handleUploaded}
        />
      )}

      {rubricFile && (
        <RubricEditor file={rubricFile} onClose={() => setRubricFile(null)} />
      )}
    </div>
  );
}
