import { useState } from "react";
import { FileUp, FileText, X } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-medium text-slate-900">Upload file</p>

          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) setFile(droppedFile);
          }}
          className="mb-4 rounded-md border border-dashed border-slate-300 p-6 text-center"
        >
          <FileUp size={28} className="mx-auto text-slate-400" />

          <p className="mt-2 text-sm text-slate-500">Drag a file here or</p>

          <label className="mt-1 inline-block cursor-pointer rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
            Browse files
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.pptx,.txt,.md"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {file && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
            <FileText size={18} className="text-slate-500" />

            <p className="flex-1 truncate text-sm text-slate-700">
              {file.name}
            </p>

            <span className="text-xs text-slate-400">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
        )}

        <label className="mb-1 block text-xs text-slate-500">
          Document type
        </label>

        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {DOC_TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>

        <label className="mb-1 block text-xs text-slate-500">
          SBB <span className="text-slate-400">· optional</span>
        </label>

        <select
          value={sbb}
          onChange={(e) => setSbb(e.target.value)}
          className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">All levels</option>
          {SBB_LEVELS.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Theme <span className="text-slate-400">· optional</span>
            </label>

            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">None</option>
              {THEMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Format <span className="text-slate-400">· optional</span>
            </label>

            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">None</option>
              {FORMATS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Processing..." : "Add to library"}
          </button>
        </div>
      </div>
    </div>
  );
}
