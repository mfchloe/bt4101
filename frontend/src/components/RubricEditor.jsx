import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
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

  const cell = "w-full rounded border border-slate-300 px-1.5 py-1 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-base font-medium text-slate-900">
            Rubric bands · {file.filename}
          </p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Check the bands against the rubric and fix any mistakes before saving.
        </p>

        {status === "loading" && (
          <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
        )}
        {status === "extracting" && (
          <p className="py-10 text-center text-sm text-slate-400">
            Extracting bands with AI… this can take up to a minute.
          </p>
        )}

        {(status === "ready" || status === "saving") && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="w-32 pb-2 font-normal">Criterion</th>
                  <th className="w-16 pb-2 font-normal">Band</th>
                  <th className="w-16 pb-2 font-normal">Min</th>
                  <th className="w-16 pb-2 font-normal">Max</th>
                  <th className="pb-2 font-normal">Descriptor</th>
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
                        className="mt-1.5 text-slate-400 hover:text-red-600"
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
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
            >
              <Plus size={16} /> Add row
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={runExtraction}
            disabled={status !== "ready"}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Sparkles size={16} /> Re-extract with AI
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={status !== "ready"}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "saving" ? "Saving…" : "Save bands"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
