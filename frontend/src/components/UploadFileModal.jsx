import { useState } from "react";
import { FileText, FileUp, Loader2, X } from "lucide-react";
import { API_URL } from "../api";
import { FORMATS, SBB_LEVELS, THEMES } from "../options";

const DOC_TYPES = ["Model essay", "Rubric", "Lesson notes", "Marked essay"];

export default function UploadFileModal({ onClose, onUpload }) {
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [sbb, setSbb] = useState("");

  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("docType", docType);
      formData.append("sbb", sbb);
      formData.append("theme", theme);
      formData.append("format", format);

      const response = await fetch(`${API_URL}/api/library/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      console.log("Upload successful:", data);

      onUpload?.({ ...data, doc_type: docType });

      onClose();
    } catch (error) {
      console.error(error);

      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const label = "mb-1.5 block text-xs font-semibold text-slate-700";
  const field =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";
  const optional = <span className="font-normal text-slate-400">· optional</span>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Upload file</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              PDF, Word, PowerPoint, text or Markdown
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {file ? (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
            <FileText size={20} className="shrink-0 text-teal-700" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <button
              onClick={() => setFile(null)}
              aria-label="Remove file"
              className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const droppedFile = e.dataTransfer.files?.[0];
              if (droppedFile) setFile(droppedFile);
            }}
            className="mb-5 block cursor-pointer rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center transition-colors hover:border-teal-300 hover:bg-teal-50/40"
          >
            <FileUp size={28} className="mx-auto text-teal-600" />
            <p className="mt-2 text-sm text-slate-600">
              Drop a file here, or{" "}
              <span className="font-semibold text-teal-700">browse</span>
            </p>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.pptx,.txt,.md"
              onChange={handleFileChange}
            />
          </label>
        )}

        <div className="space-y-4">
          <div>
            <label className={label}>Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={field}>
              {DOC_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>SBB {optional}</label>
            <select value={sbb} onChange={(e) => setSbb(e.target.value)} className={field}>
              <option value="">All levels</option>
              {SBB_LEVELS.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Format {optional}</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className={field}>
                <option value="">None</option>
                {FORMATS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Theme {optional}</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} className={field}>
                <option value="">None</option>
                {THEMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading && <Loader2 size={14} className="animate-spin" />}
            {uploading ? "Adding to library…" : "Add to library"}
          </button>
        </div>
      </div>
    </div>
  );
}
