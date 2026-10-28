import { useEffect, useState } from "react";
import { AudioLines, Download, Loader2, RefreshCw } from "lucide-react";

import { API_URL as API_BASE_URL } from "../../api";

// Rough wait: audio is made at about twice real time, at ~150 spoken words a minute
const estimateSeconds = (material) => {
  const script = material.match(/^## [^\n]*script[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/im)?.[1] ?? material;
  return Math.max(10, Math.round(script.split(/\s+/).length * 0.2));
};

const BUTTON =
  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

/*
 * Turns a generated podcast script into audio the teacher can play or download.
 * The backend reads the Script section aloud with a local text-to-speech model,
 * one voice per speaker (HOST A, HOST B).
 */
export default function PodcastAudio({ material, fileName }) {
  const [audio, setAudio] = useState(null); // { url, material } it was made from
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  // Free the previous audio file from memory when it is replaced
  useEffect(() => () => audio && URL.revokeObjectURL(audio.url), [audio]);

  const createAudio = async () => {
    setIsCreating(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/lesson/podcast-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not create the audio.");
      }
      setAudio({ url: URL.createObjectURL(await response.blob()), material });
    } catch (err) {
      setError(err.message || "Could not create the audio.");
    } finally {
      setIsCreating(false);
    }
  };

  // The teacher edited or regenerated the script after the audio was made
  const isStale = audio && audio.material !== material;

  return (
    <div data-no-print className="mb-7 rounded-lg border border-teal-100 bg-teal-50/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <AudioLines size={18} className="text-teal-600" />
        <p className="flex-1 text-sm font-semibold text-slate-800">Podcast audio</p>

        {audio && !isCreating && (
          <a href={audio.url} download={`${fileName || "podcast"}.wav`} className={`${BUTTON} text-teal-700 hover:bg-teal-50`}>
            <Download size={14} />
            Download
          </a>
        )}

        {(!audio || isStale || isCreating) && (
          <button
            onClick={createAudio}
            disabled={isCreating}
            className={`${BUTTON} bg-teal-600 text-white shadow-sm hover:bg-teal-700`}
          >
            {isCreating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : audio ? (
              <RefreshCw size={14} />
            ) : (
              <AudioLines size={14} />
            )}
            {isCreating ? "Creating audio…" : audio ? "Update audio" : "Create audio"}
          </button>
        )}
      </div>

      {isCreating && (
        <p className="mt-2 text-xs text-slate-500">
          Reading the script aloud. This takes about {Math.ceil(estimateSeconds(material) / 60)} min.
        </p>
      )}
      {!audio && !isCreating && (
        <p className="mt-1 text-xs text-slate-500">
          The Script section is read aloud with a different voice for each host.
        </p>
      )}
      {isStale && !isCreating && (
        <p className="mt-1 text-xs text-amber-700">
          The script has changed since this audio was made.
        </p>
      )}
      {audio && <audio controls src={audio.url} className="mt-3 w-full" />}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
