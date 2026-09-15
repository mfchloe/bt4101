import { useState } from "react";
import { FileUp, FileText, X } from "lucide-react";

const DOC_TYPES = ["Model essay", "Rubric", "Lesson notes", "Marked essay"];

export default function UploadFileModal({ onClose, onUpload }) {
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState("");
  const fileName = "argumentative_essay_g2.pdf";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-medium text-slate-900">Upload file</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div className="mb-4 rounded-md border border-dashed border-slate-300 p-6 text-center">
          <FileUp size={28} className="mx-auto text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Drag a file here or</p>
          <button className="mt-1 rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
            Browse files
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
          <FileText size={18} className="text-slate-500" />
          <p className="flex-1 truncate text-sm text-slate-700">{fileName}</p>
          <span className="text-xs text-slate-400">2.4 MB</span>
        </div>

        <label className="mb-1 block text-xs text-slate-500">
          Document type <span className="text-slate-400">· suggested</span>
        </label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {DOC_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Theme <span className="text-slate-400">· optional</span>
            </label>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Argumentative"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Format <span className="text-slate-400">· optional</span>
            </label>
            <input
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="Long answer"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
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
            onClick={() => {
              onUpload?.({ fileName, docType, theme, format });
              onClose();
            }}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
          >
            Add to library
          </button>
        </div>
      </div>
    </div>
  );
}
