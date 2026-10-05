import { useState } from "react";
import EssayUploadForm from "../components/essay-marking/EssayUploadForm";
import EssayReview from "../components/essay-marking/EssayReview";
import { SAMPLE_RESULT } from "../components/essay-marking/sampleResult";

import { API_URL as API_BASE_URL } from "../api";

/*
 * Essay marking has two stages:
 *   1. Upload – choose the rubric and upload student essays
 *   2. Review – check the AI's scores, highlights and feedback
 *
 * POST /api/essays/mark is expected to return:
 *
 * {
 *   rubric: "G2 rubric",
 *   rubricBands: [{ criterion, band, min_mark, max_mark, descriptor }],  // rows from rubric_bands
 *   essays: [{
 *     id, studentName, text,
 *     source: "ocr" | "typed",
 *     criteria: [{ name, score, max, note }],  // Content /10, Language /20; note = AI's reason
 *     feedback: "Overall feedback...",
 *     annotations: [{
 *       id,
 *       type: "grammar" | "spelling" | "vocabulary" | "content" | "strength",
 *       quote,        // copied verbatim from `text`, used for highlighting
 *       suggestion,   // optional corrected wording
 *       comment,
 *     }],
 *   }],
 * }
 *
 * See components/essay-marking/sampleResult.js for a full example.
 */
export default function EssayMarking() {
  const [result, setResult] = useState(null);
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState("");

  const handleMark = async ({
    rubric,
    format,
    theme,
    band,
    question,
    instructions,
    essays,
  }) => {
    setIsMarking(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("rubric", rubric);
      formData.append("format", format);
      formData.append("theme", theme);
      formData.append("band", band);
      formData.append("question", question);
      formData.append("instructions", instructions);

      // Files and names are appended in the same order so they pair up
      essays.forEach(({ file, studentName }) => {
        formData.append("essays", file);
        formData.append("studentNames", studentName);
      });

      const response = await fetch(`${API_BASE_URL}/api/essays/mark`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to mark essays.");
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong while marking essays.");
    } finally {
      setIsMarking(false);
    }
  };

  if (result) {
    return <EssayReview result={result} onNewBatch={() => setResult(null)} />;
  }

  return (
    <EssayUploadForm
      onSubmit={handleMark}
      onPreviewSample={() => setResult(SAMPLE_RESULT)}
      isMarking={isMarking}
      error={error}
    />
  );
}
