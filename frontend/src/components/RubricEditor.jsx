import { useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { API_URL } from "../api";

const EMPTY_ROW = {
  criterion: "",
  band: "",
  min_mark: "",
  max_mark: "",
  descriptor: "",
};

const rubricUrl = (fileId) => `${API_URL}/api/library/files/${fileId}/rubric`;

// Ask the AI for a draft of the bands (not saved until the teacher clicks Save)
const fetchExtractedBands = async (fileId) => {
  const response = await fetch(`${rubricUrl(fileId)}/extract`, {
    method: "POST",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Extraction failed");
  return data.bands;
};

export default function RubricEditor({ file, onClose }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | extracting | ready | saving
  const [error, setError] = useState("");

  const runExtraction = () => {
    setStatus("extracting");
    setError("");
    fetchExtractedBands(file.id)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setStatus("ready"));
  };

  // Load saved bands; if there are none yet, get an AI draft
  useEffect(() => {
    fetch(rubricUrl(file.id))
      .then((response) => response.json())
      .then((data) => {
        if (data.bands.length > 0) {
          setRows(data.bands);
          setStatus("ready");
        } else {
          setStatus("extracting");
          return fetchExtractedBands(file.id)
            .then(setRows)
            .catch((e) => setError(e.message))
            .finally(() => setStatus("ready"));
        }
      });
  }, [file.id]);

  const updateRow = (index, field, value) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const handleSave = async () => {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch(rubricUrl(file.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bands: rows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");
      onClose();
    } catch (e) {
      setError(e.message);
      setStatus("ready");
    }
  };

  const cell =
    "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">Rubric bands</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {file.filename} · check the AI's draft against the rubric and fix
              any mistakes before saving
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

        {status === "loading" && (
          <p className="py-16 text-center text-sm text-slate-500">Loading…</p>
        )}
        {status === "extracting" && (
          <div className="py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-teal-600" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              Reading the rubric…
            </p>
            <p className="mt-1 text-sm text-slate-500">
              This can take up to a minute.
            </p>
          </div>
        )}

        {(status === "ready" || status === "saving") && (
          <div className="-mx-1 flex-1 overflow-y-auto px-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs font-semibold text-slate-500">
                <tr>
                  <th className="w-32 pb-2 font-semibold">Criterion</th>
                  <th className="w-16 pb-2 font-semibold">Band</th>
                  <th className="w-16 pb-2 font-semibold">Min</th>
                  <th className="w-16 pb-2 font-semibold">Max</th>
                  <th className="pb-2 font-semibold">Descriptor</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="align-top">
                    <td className="pb-2 pr-2">
                      <input
                        value={row.criterion}
                        onChange={(e) => updateRow(i, "criterion", e.target.value)}
                        className={cell}
                      />
                    </td>
                    {["band", "min_mark", "max_mark"].map((field) => (
                      <td key={field} className="pb-2 pr-2">
                        <input
                          type="number"
                          value={row[field]}
                          onChange={(e) => updateRow(i, field, e.target.value)}
                          className={cell}
                        />
                      </td>
                    ))}
                    <td className="pb-2 pr-2">
                      <textarea
                        rows={2}
                        value={row.descriptor}
                        onChange={(e) => updateRow(i, "descriptor", e.target.value)}
                        className={cell}
                      />
                    </td>
                    <td className="pb-2">
                      <button
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                        aria-label="Delete row"
                        className="mt-1 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setRows([...rows, EMPTY_ROW])}
              className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              <Plus size={16} /> Add row
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            onClick={runExtraction}
            disabled={status !== "ready"}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
          >
            <Sparkles size={16} /> Re-extract with AI
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={status !== "ready"}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "saving" ? "Saving…" : "Save bands"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
