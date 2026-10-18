import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FileDown, Loader2, Paperclip, Sparkles, Upload } from "lucide-react";
import MaterialSection from "../components/content-generator/MaterialSection";
import printMaterial from "../components/content-generator/printMaterial";
import ResizeHandle from "../components/ResizeHandle";
import useResizableWidth from "../hooks/useResizableWidth";

import { API_URL as API_BASE_URL } from "../api";
import { FORMATS, SBB_LEVELS, THEMES } from "../options";

// Each material type has a short description and an example instruction
const MATERIAL_TYPES = [
  {
    name: "Worksheet",
    description: "Student-facing practice",
    placeholder: "e.g. Essay planning and breakdown for a discursive question",
  },
  {
    name: "Lesson plan",
    description:
      "Teacher-facing, with objectives, a sequence of activities, timings and differentiation notes",
    placeholder: "e.g. 50-minute lesson introducing argumentative essay structure",
  },
  {
    name: "Lesson activity",
    description: "In-class tasks such as discussions, peer review, starters and exit tickets",
    placeholder: "e.g. Peer review activity for introductions, in pairs",
  },
  {
    name: "Questions and assessments",
    description: "Essay prompts, short-answer questions and quizzes",
    placeholder: "e.g. 5 essay prompts with a mix of difficulty levels",
  },
  {
    name: "Podcast",
    description: "A script for students to listen to, e.g. a discussion of a topic or model essay",
    placeholder: "e.g. 5-minute two-host discussion on both sides of the topic",
  },
  {
    name: "Others",
    description: "Anything else; describe what you need below",
    placeholder: "Describe the material you want, e.g. a vocabulary list on the theme",
  },
];

// Titles of sections meant only for the teacher. The generation prompt asks
// for these to start with "Answer guide" or "Marking guide".
const TEACHER_SECTION =
  /answer (guide|key|sheet)|answers\b|marking (guide|scheme)|mark scheme|solutions\b|for the teacher|teacher'?s? (guide|notes|reference)/i;

export default function ContentGenerator() {
  const [band, setBand] = useState("G1");
  const [materialType, setMaterialType] = useState(MATERIAL_TYPES[0].name);
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState("");
  const [instructions, setInstructions] = useState("");
  const selectedMaterial = MATERIAL_TYPES.find((m) => m.name === materialType);

  // Store the actual File objects, not just their filenames
  const [sessionFiles, setSessionFiles] = useState([]);

  // Generated content
  const [generatedMaterial, setGeneratedMaterial] = useState("");
  const [sources, setSources] = useState([]);
  const [relaxed, setRelaxed] = useState([]); // filters dropped to find enough resources

  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);
  // Section open in the editor (one at a time); -1 = whole material when it has no sections
  const [editingIndex, setEditingIndex] = useState(null);
  const documentRef = useRef(null);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const settingsPanel = useResizableWidth({
    initial: 340,
    min: 280,
    max: 520,
    edge: "right",
  });

  /*
   * Generate lesson/material
   *
   * Sends the teacher's requirements to Flask.
   */
  // Fields shared by generate and regenerate-section
  const buildFormData = () => {
    const formData = new FormData();

    formData.append("band", band);
    formData.append("materialType", materialType);
    formData.append("theme", theme);
    formData.append("format", format);
    formData.append("instructions", instructions);

    // Session file is temporary context.
    // It is NOT automatically added to the permanent vector store.
    sessionFiles.forEach((file) => formData.append("sessionFiles", file));
    return formData;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError("");
    setEditingIndex(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/lesson/generate`, {
        method: "POST",
        body: buildFormData(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate material.");
      }

      setGeneratedMaterial(data.content || "");
      setSources(data.sources || []);
      setRelaxed(data.relaxed || []);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Something went wrong while generating the material.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  /*
   * Regenerate a single section.
   *
   * Sends the whole material (including the teacher's edits) and the
   * section title; Flask rewrites only that section and returns the
   * full material with it replaced.
   */
  const handleRegenerateSection = async (sectionTitle, index) => {
    if (!generatedMaterial) return;

    setError("");
    setEditingIndex(null);
    setRegeneratingIndex(index);

    try {
      const formData = buildFormData();
      formData.append("sectionTitle", sectionTitle);
      formData.append("currentMaterial", generatedMaterial);

      const response = await fetch(
        `${API_BASE_URL}/api/lesson/regenerate-section`,
        { method: "POST", body: formData },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to regenerate section.");
      }

      setGeneratedMaterial(data.content || generatedMaterial);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Something went wrong while regenerating the section.",
      );
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const exportName = [theme, materialType].filter(Boolean).join("_").replace(/\s+/g, "_");

  /*
   * Export as PDF through the browser's print dialog ("Save as PDF").
   * Close the editor first so every section is printed as formatted text.
   */
  const handleExportPdf = () => {
    if (!generatedMaterial || !documentRef.current) return;
    flushSync(() => setEditingIndex(null));
    printMaterial(documentRef.current, exportName);
  };

  /*
   * Split the generated material into its preamble and sections.
   *
   * Expected LLM output:
   *
   * # Title
   *
   * ## Section 1: Warm-up
   * ...
   *
   * ## Section 2: Practice
   * ...
   */
  const parseSections = (content) => {
    const preamble = [];
    const sections = [];

    content.split("\n").forEach((line) => {
      if (line.startsWith("## ")) {
        sections.push({ title: line.slice(3).trim(), body: "" });
      } else if (sections.length > 0) {
        sections[sections.length - 1].body += `${line}\n`;
      } else {
        preamble.push(line);
      }
    });

    return { preamble: preamble.join("\n"), sections };
  };

  const { preamble, sections } = parseSections(generatedMaterial);
  const title = preamble.match(/^# (.+)$/m)?.[1].trim();

  // Teacher-only sections (answers, marking guides) come last and start on a
  // new page in the PDF, so the student pages can be printed on their own.
  // Lesson plans are all teacher-facing, so they are not split.
  const teacherStart =
    materialType === "Lesson plan"
      ? -1
      : sections.findIndex((s) => TEACHER_SECTION.test(s.title));

  // Write an edited section back into the full Markdown, so edits are kept
  // when exporting or regenerating another section
  const updateSection = (index, body) => {
    const parts = preamble.trim() ? [preamble.trim()] : [];
    sections.forEach((s, i) =>
      parts.push(`## ${s.title}\n${(i === index ? body : s.body).trim()}`),
    );
    setGeneratedMaterial(`${parts.join("\n\n")}\n`);
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* LEFT: GENERATION SETTINGS */}
      <div
        style={{ width: settingsPanel.width }}
        className="shrink-0 overflow-y-auto bg-white px-6 py-7"
      >
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Generate material
        </h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">
          Drafts are grounded in your file library.
        </p>

        {/* BAND */}
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Full SBB band
        </label>

        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          {SBB_LEVELS.map((b) => (
            <button
              key={b}
              onClick={() => setBand(b)}
              aria-pressed={band === b}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                band === b
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* MATERIAL TYPE */}
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Material type
        </label>

        <select
          value={materialType}
          onChange={(e) => setMaterialType(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        >
          {MATERIAL_TYPES.map((m) => (
            <option key={m.name}>{m.name}</option>
          ))}
        </select>
        <p className="-mt-2.5 mb-4 text-xs leading-5 text-slate-500">
          {selectedMaterial.description}
        </p>

        {/* FORMAT */}
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Format</label>

        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        >
          <option value="">Any format</option>
          {FORMATS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>

        {/* THEME */}
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Theme</label>

        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        >
          <option value="">Any theme</option>
          {THEMES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        {/* INSTRUCTIONS */}
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Additional instructions
        </label>

        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={selectedMaterial.placeholder}
          className="mb-4 min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        />

        {/* SESSION FILES */}
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Session files{" "}
          <span className="font-normal text-slate-400">· this lesson only</span>
        </label>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-700"
        >
          <Upload size={15} />
          Add slides or notes
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.txt,.md"
          multiple
          className="hidden"
          onChange={(e) => {
            const added = Array.from(e.target.files);
            // Skip files that are already attached
            setSessionFiles((current) => [
              ...current,
              ...added.filter(
                (f) => !current.some((c) => c.name === f.name && c.size === f.size),
              ),
            ]);
            e.target.value = ""; // allow re-adding a file after removing it
          }}
        />

        {sessionFiles.length > 0 && (
          <div className="mb-4 space-y-1">
            {sessionFiles.map((file) => (
              <div
                key={`${file.name}-${file.size}`}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
              >
                <Paperclip size={13} />

                <span className="min-w-0 flex-1 truncate">{file.name}</span>

                <button
                  onClick={() =>
                    setSessionFiles((current) => current.filter((f) => f !== file))
                  }
                  aria-label={`Remove ${file.name}`}
                  className="text-base leading-none text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* GENERATE */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles size={15} />
              Generate
            </>
          )}
        </button>

        {/* ERROR */}
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      <ResizeHandle
        label="Resize settings panel"
        isDragging={settingsPanel.isDragging}
        {...settingsPanel.handleProps}
      />

      {/* RIGHT: PREVIEW */}
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between">
          <p className="text-sm font-medium text-slate-500">
            Preview · {[band, theme, materialType].filter(Boolean).join(" · ")}
          </p>

          <button
            onClick={handleExportPdf}
            disabled={!generatedMaterial || isGenerating}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileDown size={14} />
            Export PDF
          </button>
        </div>

        <div className="mx-auto min-h-[420px] max-w-3xl rounded-xl border border-slate-200 bg-white px-12 py-10 shadow-sm">
          {/* BEFORE GENERATION */}
          {!generatedMaterial && !isGenerating && (
            <div className="flex min-h-[340px] items-center justify-center">
              <div className="max-w-xs text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                  <Sparkles size={22} />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-800">
                  Nothing generated yet
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Pick a band and material type on the left, then press
                  Generate.
                </p>
              </div>
            </div>
          )}

          {/* LOADING */}
          {isGenerating && (
            <div className="flex min-h-[340px] items-center justify-center">
              <div className="text-center">
                <Loader2
                  size={24}
                  className="mx-auto animate-spin text-teal-600"
                />

                <p className="mt-3 text-sm font-medium text-slate-700">
                  Generating material…
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Retrieving relevant resources and generating content.
                </p>
              </div>
            </div>
          )}

          {/* GENERATED CONTENT */}
          {generatedMaterial && !isGenerating && (
            // Everything in here is printed by Export PDF, except data-no-print parts
            <div ref={documentRef}>
              <div className="mb-7 border-b border-slate-200 pb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  {band} · {materialType}
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">
                  {title ||
                    (theme ? `${theme} ${materialType.toLowerCase()}` : materialType)}
                </h2>
              </div>

              {relaxed.length > 0 && (
                <div
                  data-no-print
                  className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800"
                >
                  Not enough library resources matched every filter, so resources
                  with any {relaxed.join(" or ")} were also used. Check the
                  resources listed at the bottom.
                </div>
              )}

              {/* If sections were detected, display them individually */}
              {sections.length > 0 ? (
                sections.map((section, index) => (
                  <MaterialSection
                    key={`${section.title}-${index}`}
                    title={section.title}
                    body={section.body}
                    editing={editingIndex === index}
                    onToggleEdit={() =>
                      setEditingIndex(editingIndex === index ? null : index)
                    }
                    onChange={(body) => updateSection(index, body)}
                    onRegenerate={() => handleRegenerateSection(section.title, index)}
                    regenerating={regeneratingIndex === index}
                    regenerateDisabled={regeneratingIndex !== null}
                    pageBreakBefore={index === teacherStart && index > 0}
                  />
                ))
              ) : (
                /*
                 * Fallback if the LLM does not follow the expected
                 * markdown section format: one block for the whole material.
                 */
                <MaterialSection
                  body={generatedMaterial}
                  editing={editingIndex === -1}
                  onToggleEdit={() => setEditingIndex(editingIndex === -1 ? null : -1)}
                  onChange={setGeneratedMaterial}
                />
              )}

              {/* SOURCES */}
              {sources.length > 0 && (
                <div data-no-print className="mt-8 border-t border-slate-100 pt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Resources used
                  </p>

                  <div className="space-y-1">
                    {sources.map((source, index) => (
                      <div
                        key={`${source.source_file}-${index}`}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <Paperclip size={13} className="text-slate-400" />

                        <span>{source.source_file}</span>

                        {source.document_type && (
                          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                            {source.document_type}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
