import { useRef, useState } from "react";
import { Upload, Paperclip, RefreshCw, Download, Loader2 } from "lucide-react";
import ResizeHandle from "../components/ResizeHandle";
import useResizableWidth from "../hooks/useResizableWidth";

const BANDS = ["G1", "G2", "G3"];

const API_BASE_URL = "http://localhost:5000";

export default function ContentGenerator() {
  const [band, setBand] = useState("G1");
  const [materialType, setMaterialType] = useState("Worksheet");
  const [theme, setTheme] = useState("Persuasive writing");
  const [format, setFormat] = useState("Short answer");
  const [instructions, setInstructions] = useState("");

  // Store the actual File object, not just its filename
  const [sessionFile, setSessionFile] = useState(null);

  // Generated content
  const [generatedMaterial, setGeneratedMaterial] = useState("");
  const [sources, setSources] = useState([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const settingsPanel = useResizableWidth({
    initial: 260,
    min: 220,
    max: 520,
    edge: "right",
  });

  /*
   * Generate lesson/material
   *
   * Sends the teacher's requirements to Flask.
   */
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("band", band);
      formData.append("materialType", materialType);
      formData.append("theme", theme);
      formData.append("format", format);
      formData.append("instructions", instructions);

      // Session file is temporary context.
      // It is NOT automatically added to the permanent vector store.
      if (sessionFile) {
        formData.append("sessionFile", sessionFile);
      }

      const response = await fetch(`${API_BASE_URL}/api/lesson/generate`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate material.");
      }

      setGeneratedMaterial(data.content || "");
      setSources(data.sources || []);
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
   * For now this sends the entire generated material to Flask,
   * together with the section title.
   *
   * Later we can make the backend handle proper section-level
   * regeneration.
   */
  const handleRegenerateSection = async (sectionTitle) => {
    if (!generatedMaterial) return;

    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/lesson/regenerate-section`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            band,
            materialType,
            theme,
            format,
            instructions,
            sectionTitle,
            currentMaterial: generatedMaterial,
          }),
        },
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
    }
  };

  /*
   * Export generated material.
   *
   * For the MVP this downloads a .txt file.
   * Later this can call a Flask endpoint to generate a proper
   * Word/PDF worksheet.
   */
  const handleExport = () => {
    if (!generatedMaterial) return;

    const blob = new Blob([generatedMaterial], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${theme.replace(/\s+/g, "_")}_${materialType.replace(
      /\s+/g,
      "_",
    )}.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  /*
   * Extract markdown sections from the generated material.
   *
   * Expected Qwen output:
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
    if (!content) return [];

    const lines = content.split("\n");

    const sections = [];
    let currentSection = null;

    lines.forEach((line) => {
      if (line.startsWith("## ")) {
        if (currentSection) {
          sections.push(currentSection);
        }

        currentSection = {
          title: line.replace("## ", "").trim(),
          body: "",
        };
      } else if (currentSection) {
        currentSection.body += `${line}\n`;
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  };

  const sections = parseSections(generatedMaterial);

  return (
    <div className="flex min-h-0 flex-1">
      {/* LEFT: GENERATION SETTINGS */}
      <div
        style={{ width: settingsPanel.width }}
        className="shrink-0 overflow-y-auto p-5"
      >
        <p className="mb-4 text-[15px] font-medium text-slate-900">
          Generate material
        </p>

        {/* BAND */}
        <label className="mb-1.5 block text-xs text-slate-500">
          Full SBB band
        </label>

        <div className="mb-3.5 flex gap-1.5">
          {BANDS.map((b) => (
            <button
              key={b}
              onClick={() => setBand(b)}
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

        {/* MATERIAL TYPE */}
        <label className="mb-1 block text-xs text-slate-500">
          Material type
        </label>

        <select
          value={materialType}
          onChange={(e) => setMaterialType(e.target.value)}
          className="mb-3.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option>Worksheet</option>
          <option>Lesson activity</option>
          <option>Practice questions</option>
        </select>

        {/* THEME */}
        <label className="mb-1 block text-xs text-slate-500">Theme</label>

        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="mb-3.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />

        {/* FORMAT */}
        <label className="mb-1 block text-xs text-slate-500">Format</label>

        <input
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="mb-3.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />

        {/* INSTRUCTIONS */}
        <label className="mb-1 block text-xs text-slate-500">
          Additional instructions
        </label>

        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Focus on counter-argument structure"
          className="mb-3.5 min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />

        {/* SESSION FILE */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Upload size={15} />
          Upload session file
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.txt,.md"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];

            if (file) {
              setSessionFile(file);
            }
          }}
        />

        {sessionFile && (
          <div className="mb-3.5 flex items-center gap-1 text-xs text-slate-400">
            <Paperclip size={13} />

            <span className="min-w-0 flex-1 truncate">{sessionFile.name}</span>

            <button
              onClick={() => setSessionFile(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        )}

        {/* GENERATE */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating...
            </>
          ) : (
            "Generate ↗"
          )}
        </button>

        {/* ERROR */}
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
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
      <div className="min-w-0 flex-1 overflow-y-auto p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Preview — {band} {theme.toLowerCase()} {materialType.toLowerCase()}
          </p>

          <button
            onClick={handleExport}
            disabled={!generatedMaterial}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={14} />
            Export
          </button>
        </div>

        <div className="min-h-[280px] rounded-md border border-slate-200 bg-slate-50 p-4">
          {/* BEFORE GENERATION */}
          {!generatedMaterial && !isGenerating && (
            <div className="flex min-h-[250px] items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">
                  No material generated yet
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Configure the material and click Generate.
                </p>
              </div>
            </div>
          )}

          {/* LOADING */}
          {isGenerating && (
            <div className="flex min-h-[250px] items-center justify-center">
              <div className="text-center">
                <Loader2
                  size={24}
                  className="mx-auto animate-spin text-indigo-600"
                />

                <p className="mt-3 text-sm font-medium text-slate-700">
                  Generating material...
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Retrieving relevant resources and generating content.
                </p>
              </div>
            </div>
          )}

          {/* GENERATED CONTENT */}
          {generatedMaterial && !isGenerating && (
            <>
              <div className="mb-4">
                <p className="text-base font-medium text-slate-900">
                  {theme} {materialType.toLowerCase()}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Generated for {band}
                </p>
              </div>

              {/* If sections were detected, display them individually */}
              {sections.length > 0 ? (
                sections.map((section, index) => (
                  <div
                    key={`${section.title}-${index}`}
                    className="mb-2.5 rounded-md border border-slate-200 bg-white p-3 last:mb-0"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">
                        {section.title}
                      </p>

                      <button
                        onClick={() => handleRegenerateSection(section.title)}
                        aria-label="Regenerate section"
                        className="rounded p-1 hover:bg-indigo-50"
                      >
                        <RefreshCw
                          size={14}
                          className="text-indigo-600 hover:text-indigo-700"
                        />
                      </button>
                    </div>

                    <textarea
                      value={section.body.trim()}
                      readOnly
                      className="mt-2 min-h-[100px] w-full resize-y border-0 bg-transparent p-0 text-sm leading-6 text-slate-600 outline-none"
                    />
                  </div>
                ))
              ) : (
                /*
                 * Fallback if Qwen does not follow the expected
                 * markdown section format.
                 */
                <textarea
                  value={generatedMaterial}
                  onChange={(e) => setGeneratedMaterial(e.target.value)}
                  className="min-h-[400px] w-full resize-y rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 outline-none focus:border-indigo-300"
                />
              )}

              {/* SOURCES */}
              {sources.length > 0 && (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="mb-2 text-xs font-medium text-slate-500">
                    Resources used
                  </p>

                  <div className="space-y-1">
                    {sources.map((source, index) => (
                      <div
                        key={`${source.source_file}-${index}`}
                        className="flex items-center gap-2 text-xs text-slate-400"
                      >
                        <Paperclip size={12} />

                        <span>{source.source_file}</span>

                        {source.document_type && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5">
                            {source.document_type}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
