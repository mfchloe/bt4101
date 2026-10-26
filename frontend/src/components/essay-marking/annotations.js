/*
 * Kinds of comments the AI can attach to a passage of an essay.
 */
export const ANNOTATION_TYPES = {
  grammar: {
    label: "Grammar",
    mark: "bg-amber-100 decoration-amber-500",
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  spelling: {
    label: "Spelling",
    mark: "bg-rose-100 decoration-rose-500",
    badge: "bg-rose-50 text-rose-700",
    dot: "bg-rose-400",
  },
  vocabulary: {
    label: "Word choice",
    mark: "bg-sky-100 decoration-sky-500",
    badge: "bg-sky-50 text-sky-700",
    dot: "bg-sky-400",
  },
  content: {
    label: "Content",
    mark: "bg-violet-100 decoration-violet-500",
    badge: "bg-violet-50 text-violet-700",
    dot: "bg-violet-400",
  },
  strength: {
    label: "Strength",
    mark: "bg-teal-100 decoration-teal-500",
    badge: "bg-teal-50 text-teal-700",
    dot: "bg-teal-500",
  },
};

export const getAnnotationType = (type) =>
  ANNOTATION_TYPES[type] ?? ANNOTATION_TYPES.content;

// Characters that often differ between the essay and the AI's copy of a quote
const EQUIVALENT = [
  ["'", "‘", "’", "`"],
  ['"', "“", "”"],
  ["-", "–", "—"],
];
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const charPattern = (ch) => {
  const group = EQUIVALENT.find((g) => g.includes(ch));
  return group ? `[${group.map(escapeRegex).join("")}]` : escapeRegex(ch);
};

/*
 * Find a quote in the essay: { start, end } or null.
 *
 * Tries an exact match first, then a looser one that ignores differences in
 * spacing and line breaks (typed PDFs break lines mid-sentence), curly vs
 * straight quotes, dash types, capitalisation and trailing punctuation.
 */
export function findQuote(text, quote) {
  const trimmed = quote.trim();
  if (!trimmed) return null;

  const exact = text.indexOf(trimmed);
  if (exact !== -1) return { start: exact, end: exact + trimmed.length };

  for (const candidate of [trimmed, trimmed.replace(/[.,;:!?]+$/, "")]) {
    const words = candidate.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    const pattern = words.map((w) => [...w].map(charPattern).join("")).join("\\s+");
    const match = new RegExp(pattern, "i").exec(text);
    if (match) return { start: match.index, end: match.index + match[0].length };
  }
  return null;
}

/*
 * Split essay text into segments for highlighting.
 *
 * Highlights may overlap, so the text is cut at every highlight's start and
 * end; each segment lists every annotation covering it, innermost (shortest)
 * first. Annotations whose quote isn't in the essay are missing from
 * `ranges`, so the UI can flag them.
 */
export function buildSegments(text, annotations) {
  const ranges = new Map();
  annotations.forEach((annotation) => {
    const range = annotation.quote && findQuote(text, annotation.quote);
    if (range) ranges.set(annotation.id, range);
  });

  const cuts = new Set([0, text.length]);
  ranges.forEach(({ start, end }) => {
    cuts.add(start);
    cuts.add(end);
  });
  const points = [...cuts].sort((a, b) => a - b);

  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [from, to] = [points[i], points[i + 1]];
    const covering = annotations
      .filter((a) => {
        const r = ranges.get(a.id);
        return r && r.start <= from && r.end >= to;
      })
      .sort((a, b) => {
        const ra = ranges.get(a.id);
        const rb = ranges.get(b.id);
        return ra.end - ra.start - (rb.end - rb.start);
      });
    segments.push({ text: text.slice(from, to), annotations: covering });
  }

  return { segments, ranges };
}
