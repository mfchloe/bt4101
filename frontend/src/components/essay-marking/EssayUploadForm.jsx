import { useRef, useState } from "react";
import { ClipboardCheck, FileText, FileUp, Loader2, X } from "lucide-react";
import PageHeader from "../PageHeader";
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
  // The teacher must choose both before marking
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

  // Everything the teacher still has to fill in before marking
  const missing = [
    !format && "a format",
    !theme && "a theme",
    essays.length === 0 && "at least one essay",
  ].filter(Boolean);

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
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeader
        title="Essay marking"
        description="Upload a batch of essays. CoTeach scores each one against the rubric, highlights errors and strengths, and drafts feedback for you to review."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ASSIGNMENT */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-5 text-base font-semibold text-slate-900">
            Assignment
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                disabled={isMarking}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="" disabled>
                  Select a format
                </option>
                {FORMATS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                disabled={isMarking}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="" disabled>
                  Select a theme
                </option>
                {THEMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Full SBB band
              </label>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {SBB_LEVELS.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBand(b)}
                    disabled={isMarking}
                    aria-pressed={band === b}
                    className={`flex-1 rounded-md px-2 py-1 text-sm font-semibold transition-colors ${
                      band === b
                        ? "bg-white text-teal-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Scored against the{" "}
            <span className="font-semibold text-slate-700">{band} rubric</span>{" "}
            in your library
          </p>

          <label className="mb-1.5 mt-5 block text-xs font-semibold text-slate-700">
            Essay question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isMarking}
            placeholder="Should school uniforms be abolished? Give your view."
            className="min-h-[60px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          />

          <label className="mb-1.5 mt-4 block text-xs font-semibold text-slate-700">
            Marking focus{" "}
            <span className="font-normal text-slate-400">· optional</span>
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isMarking}
            placeholder="Pay extra attention to subject-verb agreement"
            className="min-h-[60px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          />
        </section>

        {/* ESSAYS */}
        <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Essays</h2>
            {essays.length > 0 && (
              <p className="text-xs font-medium text-slate-500">
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
            className={`flex min-h-44 flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
              isDraggingOver ? "border-teal-400 bg-teal-50" : "border-slate-200"
            }`}
          >
            <FileUp size={28} className="text-teal-600" />
            <p className="mt-2 text-sm text-slate-600">
              Drop essays here, or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isMarking}
                className="font-semibold text-teal-700 hover:underline"
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-slate-500">
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
            <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
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
                      className="w-full rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium text-slate-800 hover:border-slate-200"
                    />
                    <p className="truncate px-1.5 text-xs text-slate-500">
                      {file.name} · {formatSize(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeEssay(key)}
                    disabled={isMarking}
                    aria-label={`Remove ${file.name}`}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onPreviewSample}
          disabled={isMarking}
          className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-teal-700 hover:underline"
        >
          Try it with sample essays
        </button>

        <div className="flex items-center gap-3">
          {missing.length > 0 && !isMarking && (
            <p className="text-xs text-slate-500">
              Add {missing.slice(0, -1).join(", ")}
              {missing.length > 1 ? " and " : ""}
              {missing.at(-1)} to continue
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isMarking || missing.length > 0}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isMarking ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Marking {essays.length} essay{essays.length === 1 ? "" : "s"}…
              </>
            ) : (
              <>
                <ClipboardCheck size={15} />
                {essays.length
                  ? `Mark ${essays.length} essay${essays.length === 1 ? "" : "s"}`
                  : "Mark essays"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
