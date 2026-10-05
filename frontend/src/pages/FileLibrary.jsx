import { useEffect, useState } from "react";
import {
  BookOpen,
  ClipboardList,
  FileText,
  PenLine,
  Search,
  Star,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import UploadFileModal from "../components/UploadFileModal";
import RubricEditor from "../components/RubricEditor";
import PageHeader from "../components/PageHeader";
import { API_URL } from "../api";
import { FORMATS, SBB_LEVELS, THEMES } from "../options";

// Each folder shows the files of one document type
const FOLDERS = [
  { name: "Rubrics", docType: "Rubric", icon: ClipboardList },
  { name: "Model essays", docType: "Model essay", icon: Star },
  { name: "Lesson notes", docType: "Lesson notes", icon: BookOpen },
  { name: "Marked essays", docType: "Marked essay", icon: PenLine },
];

const FILTER =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700";

const fetchFiles = () =>
  fetch(`${API_URL}/api/library/files`)
    .then((response) => response.json())
    .then((data) => data.files)
    .catch((error) => {
      console.error("Could not load files:", error);
      return [];
    });

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
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeader
        title="File library"
        description="Rubrics, model essays and notes that CoTeach draws on when it generates material and marks essays."
      >
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
        >
          <Upload size={16} />
          Upload file
        </button>
      </PageHeader>

      {/* FOLDERS */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FOLDERS.map((f) => {
          const isActive = activeFolder.name === f.name;
          const count = files.filter((file) => file.doc_type === f.docType).length;
          return (
            <button
              key={f.name}
              onClick={() => setActiveFolder(f)}
              aria-pressed={isActive}
              className={`flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition-all ${
                isActive
                  ? "border-teal-600 shadow-[0_0_0_1px_var(--color-teal-600)]"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? "bg-teal-600 text-white" : "bg-teal-50 text-teal-700"
                }`}
              >
                <f.icon size={20} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  {f.name}
                </span>
                <span className="block text-xs text-slate-500">
                  {count} {count === 1 ? "file" : "files"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* FILES */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          <div className="relative min-w-48 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${activeFolder.name.toLowerCase()}`}
              className={`${FILTER} w-full pl-9`}
            />
          </div>
          <select value={sbb} onChange={(e) => setSbb(e.target.value)} className={FILTER}>
            <option value="all">All SBB</option>
            {SBB_LEVELS.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={FILTER}>
            <option value="all">All formats</option>
            {FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className={FILTER}>
            <option value="all">All themes</option>
            {THEMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        {visibleFiles.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <FileText size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              No {activeFolder.name.toLowerCase()} here yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Upload a file, or clear the filters above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleFiles.map((file) => (
              <li
                key={file.id}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <FileText size={18} className="shrink-0 text-slate-400" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {file.filename}
                </p>
                {[file.sbb, file.theme, file.format].filter(Boolean).map((tag) => (
                  <span
                    key={tag}
                    className="hidden rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 sm:inline"
                  >
                    {tag}
                  </span>
                ))}
                {file.doc_type === "Rubric" && (
                  <button
                    onClick={() => setRubricFile(file)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                  >
                    <Table2 size={14} /> Bands
                  </button>
                )}
                <button
                  onClick={() => handleDelete(file)}
                  aria-label={`Delete ${file.filename}`}
                  className="rounded-lg p-1.5 text-slate-400 opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
