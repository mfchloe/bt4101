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
    mark: "bg-emerald-100 decoration-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-400",
  },
};

export const getAnnotationType = (type) =>
  ANNOTATION_TYPES[type] ?? ANNOTATION_TYPES.content;

/*
 * Split essay text into plain and highlighted segments.
 *
 * Each annotation's `quote` is located in the text (first occurrence
 * that doesn't overlap an earlier highlight). Annotations whose quote
 * can't be found are left out of the segments; their ids are missing
 * from `placedIds` so the UI can flag them.
 */
export function buildSegments(text, annotations) {
  const placed = [];

  annotations.forEach((annotation) => {
    if (!annotation.quote) return;

    let from = 0;
    while (from < text.length) {
      const start = text.indexOf(annotation.quote, from);
      if (start === -1) return;

      const end = start + annotation.quote.length;
      const overlaps = placed.some((p) => start < p.end && end > p.start);
      if (!overlaps) {
        placed.push({ start, end, annotation });
        return;
      }
      from = start + 1;
    }
  });

  placed.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  placed.forEach(({ start, end, annotation }) => {
    if (start > cursor) segments.push({ text: text.slice(cursor, start) });
    segments.push({ text: text.slice(start, end), annotation });
    cursor = end;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  return {
    segments,
    placedIds: new Set(placed.map((p) => p.annotation.id)),
  };
}
