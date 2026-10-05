import { useRef, useState } from "react";
import { FileText, FileUp, Loader2, X } from "lucide-react";
import { FORMATS, SBB_LEVELS, THEMES } from "../../options";

const ACCEPTED_FILES = ".pdf,.docx,.txt,.jpg,.jpeg,.png";

// "tan_wei_ling-essay.pdf" -> "Tan Wei Ling Essay"
const nameFromFile = (fileName) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function EssayUploadForm({
  onSubmit,
  onPreviewSample,
  isMarking,
  error,
}) {
  // Blank theme/format = let the system infer it
  const [format, setFormat] = useState("");
  const [theme, setTheme] = useState("");
  const [band, setBand] = useState("G2");
  const [question, setQuestion] = useState("");
  const [instructions, setInstructions] = useState("");

  // [{ key, file, studentName }]
  const [essays, setEssays] = useState([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef(null);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      studentName: nameFromFile(file.name),
    }));

    setEssays((current) => [
      ...current,
      ...incoming.filter((e) => !current.some((c) => c.key === e.key)),
    ]);
  };

  const updateStudentName = (key, studentName) =>
    setEssays((current) =>
      current.map((e) => (e.key === key ? { ...e, studentName } : e)),
    );

  const removeEssay = (key) =>
    setEssays((current) => current.filter((e) => e.key !== key));

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!isMarking) addFiles(e.dataTransfer.files);
  };

  const handleSubmit = () =>
    onSubmit({
      rubric: `${band} rubric`,
      format,
      theme,
      band,
      question,
      instructions,
      essays,
    });

  return (
    <div className="p-5">
      <p className="text-base font-medium text-slate-900">Mark essays</p>
      <p className="mt-0.5 text-sm text-slate-500">
        Upload your students' essays. The AI scores each one against the
        rubric, highlights errors and strengths, and drafts feedback for you
        to review.
      </p>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {/* ASSIGNMENT */}
        <section className="rounded-xl border border-slate-200 p-5">
          <p className="mb-4 text-sm font-medium text-slate-900">Assignment</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                disabled={isMarking}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Infer automatically</option>
                {FORMATS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                disabled={isMarking}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Infer automatically</option>
                {THEMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Full SBB band
              </label>
              <div className="flex gap-1.5">
                {SBB_LEVELS.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBand(b)}
                    disabled={isMarking}
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
            </div>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Rubric: {band} rubric
          </p>

          <label className="mb-1 mt-4 block text-xs text-slate-500">
            Essay question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isMarking}
            placeholder="Should school uniforms be abolished? Give your view."
            className="min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />

          <label className="mb-1 mt-3 block text-xs text-slate-500">
            Marking focus (optional)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isMarking}
            placeholder="Pay extra attention to subject-verb agreement"
            className="min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </section>

        {/* ESSAYS */}
        <section className="rounded-xl border border-slate-200 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-900">Essays</p>
            {essays.length > 0 && (
              <p className="text-xs text-slate-400">
                {essays.length} file{essays.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
            className={`rounded-md border border-dashed p-6 text-center transition-colors ${
              isDraggingOver
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-300"
            }`}
          >
            <FileUp size={28} className="mx-auto text-slate-400" />
            <p className="mt-2 text-sm text-slate-500">
              Drag essays here or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isMarking}
                className="text-indigo-600 hover:text-indigo-700"
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              One essay per file · scanned (PDF, JPG, PNG) or typed (DOCX, TXT)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {essays.length > 0 && (
            <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
              {essays.map(({ key, file, studentName }) => (
                <div key={key} className="flex items-center gap-3 px-3 py-2">
                  <FileText size={18} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <input
                      value={studentName}
                      onChange={(e) => updateStudentName(key, e.target.value)}
                      disabled={isMarking}
                      aria-label="Student name"
                      placeholder="Student name"
                      className="w-full rounded border border-transparent px-1 py-0.5 text-sm text-slate-800 hover:border-slate-200 focus:border-indigo-300 focus:outline-none"
                    />
                    <p className="truncate px-1 text-xs text-slate-400">
                      {file.name} · {formatSize(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeEssay(key)}
                    disabled={isMarking}
                    aria-label={`Remove ${file.name}`}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={onPreviewSample}
          disabled={isMarking}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Preview with sample essays
        </button>

        <button
          onClick={handleSubmit}
          disabled={isMarking || essays.length === 0}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isMarking ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Marking {essays.length} essay{essays.length === 1 ? "" : "s"}...
            </>
          ) : essays.length ? (
            `Mark ${essays.length} essay${essays.length === 1 ? "" : "s"} ↗`
          ) : (
            "Mark essays ↗"
          )}
        </button>
      </div>
    </div>
  );
}
