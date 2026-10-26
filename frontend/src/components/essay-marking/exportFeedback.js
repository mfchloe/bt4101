/*
 * Student feedback PDFs for accepted essays.
 *
 * Each PDF has the student's marks with the rubric band descriptor, the
 * teacher's overall feedback, the essay with numbered highlights, and the
 * numbered comments. Teacher-only details (the AI's reasons, at-risk flags,
 * changed marks, weakness tags, model essays) are left out.
 *
 * pdfmake and jszip are large, so they are loaded only when exporting.
 */
import { buildSegments } from "./annotations";

// Light highlight colours per comment type (printable versions of the review screen's)
const HIGHLIGHT = {
  grammar: "#fef3c7",
  spelling: "#ffe4e6",
  vocabulary: "#e0f2fe",
  content: "#ede9fe",
  strength: "#ccfbf1",
};
const LABEL = {
  grammar: "Grammar",
  spelling: "Spelling",
  vocabulary: "Word choice",
  content: "Content",
  strength: "Strength",
};
const INK = "#14262e";
const MUTED = "#5b6b72";
const TEAL = "#0e7c7b";

// pdfmake's font file is a classic script that sets this.pdfMake.vfs, which
// doesn't work as an ES module, so it is loaded with a <script> tag
const loadFonts = () =>
  import("pdfmake/build/vfs_fonts.js?url").then(
    ({ default: url }) =>
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.onload = () => resolve(window.pdfMake.vfs);
        script.onerror = () => reject(new Error("Could not load the PDF fonts"));
        document.head.appendChild(script);
      }),
  );

let pdfMakePromise = null;
const loadPdfMake = () => {
  pdfMakePromise ??= Promise.all([import("pdfmake/build/pdfmake"), loadFonts()]).then(
    ([pdfMakeModule, vfs]) => {
      const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
      pdfMake.vfs = vfs;
      return pdfMake;
    },
  );
  pdfMakePromise.catch(() => (pdfMakePromise = null)); // allow a retry after a failure
  return pdfMakePromise;
};

// SQLite stores UTC as "2026-10-26 02:16:46"
const formatDate = (timestamp) =>
  (timestamp ? new Date(`${timestamp.replace(" ", "T")}Z`) : new Date()).toLocaleDateString(
    "en-SG",
    { day: "numeric", month: "long", year: "numeric" },
  );

const bandFor = (rubricBands, criterion, score) =>
  rubricBands.find(
    (b) => b.criterion === criterion && score >= b.min_mark && score <= b.max_mark,
  );

/*
 * The essay as pdfmake text runs: highlighted passages get a background
 * colour and a superscript comment number where they end. Comments are
 * numbered in the order they appear in the essay.
 */
function essayBody(essay) {
  const { segments, ranges } = buildSegments(essay.text, essay.annotations);
  const placed = essay.annotations
    .filter((a) => ranges.has(a.id))
    .sort((a, b) => {
      const ra = ranges.get(a.id);
      const rb = ranges.get(b.id);
      return ra.start - rb.start || rb.end - ra.end;
    });
  const unplaced = essay.annotations.filter((a) => !ranges.has(a.id));
  const numbered = [...placed, ...unplaced];
  const numberOf = new Map(numbered.map((a, i) => [a.id, i + 1]));

  // Where each highlight ends, so its number can be placed there
  const endsAt = new Map();
  placed.forEach((a) => {
    const end = ranges.get(a.id).end;
    endsAt.set(end, [...(endsAt.get(end) ?? []), numberOf.get(a.id)]);
  });

  let offset = 0;
  const runs = [];
  segments.forEach((segment) => {
    const inner = segment.annotations[0];
    runs.push(
      inner ? { text: segment.text, background: HIGHLIGHT[inner.type] ?? HIGHLIGHT.content } : segment.text,
    );
    offset += segment.text.length;
    const numbers = endsAt.get(offset);
    if (numbers) {
      runs.push({ text: numbers.join(","), sup: true, color: TEAL, bold: true });
    }
  });

  // One paragraph per blank-line-separated block keeps the essay's layout
  const paragraphs = [];
  let current = [];
  runs.forEach((run) => {
    const text = typeof run === "string" ? run : run.text;
    const parts = text.split(/\n\s*\n/);
    parts.forEach((part, i) => {
      if (i > 0) {
        paragraphs.push(current);
        current = [];
      }
      if (part) current.push(typeof run === "string" ? part : { ...run, text: part });
    });
  });
  paragraphs.push(current);

  return {
    paragraphs: paragraphs
      .filter((p) => p.length)
      .map((p) => ({ text: p, margin: [0, 0, 0, 8], lineHeight: 1.35 })),
    comments: numbered.map((a) => ({ number: numberOf.get(a.id), annotation: a })),
  };
}

function buildDoc(essay, batch) {
  const total = essay.criteria.reduce((sum, c) => sum + c.score, 0);
  const maxTotal = essay.criteria.reduce((sum, c) => sum + c.max, 0);
  const { paragraphs, comments } = essayBody(essay);

  const marksTable = {
    table: {
      widths: [70, 50, "*"],
      body: [
        ["Criterion", "Mark", "What this mark means"].map((text) => ({
          text,
          bold: true,
          color: MUTED,
          fontSize: 9,
        })),
        ...essay.criteria.map((c) => {
          const band = bandFor(batch.rubricBands, c.name, c.score);
          return [
            { text: c.name, bold: true },
            `${c.score} / ${c.max}`,
            { text: band ? `Band ${band.band}: ${band.descriptor}` : "", fontSize: 9, color: MUTED },
          ];
        }),
        [{ text: "Total", bold: true }, { text: `${total} / ${maxTotal}`, bold: true }, ""],
      ],
    },
    layout: {
      hLineColor: () => "#dbe4e3",
      vLineWidth: () => 0,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
    margin: [0, 0, 0, 16],
  };

  const legend = Object.keys(LABEL)
    .filter((type) => essay.annotations.some((a) => a.type === type))
    .flatMap((type) => [
      { text: `  ${LABEL[type]}  `, background: HIGHLIGHT[type], fontSize: 8 },
      { text: "   ", fontSize: 8 },
    ]);

  return {
    info: { title: `${essay.studentName} – essay feedback` },
    pageMargins: [50, 50, 50, 50],
    defaultStyle: { fontSize: 10.5, color: INK },
    footer: (page, pages) => ({
      text: `${essay.studentName} · page ${page} of ${pages}`,
      alignment: "center",
      fontSize: 8,
      color: MUTED,
      margin: [0, 20, 0, 0],
    }),
    content: [
      { text: "ESSAY FEEDBACK", fontSize: 8, bold: true, color: TEAL, characterSpacing: 1 },
      { text: essay.studentName, fontSize: 20, bold: true, margin: [0, 2, 0, 4] },
      {
        text: [batch.band, batch.format, formatDate(essay.acceptedAt)].filter(Boolean).join(" · "),
        fontSize: 9,
        color: MUTED,
        margin: [0, 0, 0, 10],
      },
      batch.question && {
        text: [{ text: "Question: ", bold: true }, batch.question],
        margin: [0, 0, 0, 14],
      },
      marksTable,
      { text: "Overall feedback", fontSize: 13, bold: true, margin: [0, 0, 0, 6] },
      ...essay.feedback
        .split(/\n\s*\n/)
        .filter((p) => p.trim())
        .map((p) => ({ text: p.trim(), margin: [0, 0, 0, 6], lineHeight: 1.3 })),
      {
        text: "Your essay",
        fontSize: 13,
        bold: true,
        pageBreak: "before",
        margin: [0, 0, 0, 4],
      },
      legend.length > 0 && { text: legend, margin: [0, 0, 0, 10] },
      ...paragraphs,
      comments.length > 0 && {
        text: "Comments",
        fontSize: 13,
        bold: true,
        margin: [0, 14, 0, 6],
      },
      ...comments.map(({ number, annotation: a }) => ({
        margin: [0, 0, 0, 7],
        columns: [
          { width: 20, text: `${number}.`, bold: true, color: TEAL },
          {
            width: "*",
            stack: [
              {
                text: [
                  { text: ` ${LABEL[a.type] ?? "Comment"} `, background: HIGHLIGHT[a.type], fontSize: 8, bold: true },
                  "  ",
                  { text: `“${a.quote}”`, italics: true, color: MUTED },
                  // The PDF font has no arrow glyph, so suggestions are introduced in words
                  a.suggestion ? { text: [{ text: "   Try: ", color: MUTED }, { text: a.suggestion, bold: true, color: TEAL }] } : "",
                ],
              },
              { text: a.comment, margin: [0, 2, 0, 0] },
            ],
          },
        ],
      })),
    ].filter(Boolean),
  };
}

// "Tan Wei Ling" -> "Tan_Wei_Ling"; safe in file names on every system
const fileSafe = (name) => name.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "") || "essay";

const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const pdfBlob = (pdfMake, doc) =>
  new Promise((resolve) => pdfMake.createPdf(doc).getBlob(resolve));

// One accepted essay -> "<Student>.pdf"
export async function exportEssayPdf(essay, batch) {
  const pdfMake = await loadPdfMake();
  download(await pdfBlob(pdfMake, buildDoc(essay, batch)), `${fileSafe(essay.studentName)}.pdf`);
}

// Every accepted essay in a batch -> one zip with a PDF per student
export async function exportBatchZip(essays, batch) {
  const accepted = essays.filter((e) => e.status === "accepted");
  if (accepted.length === 0) return 0;
  const [pdfMake, { default: JSZip }] = await Promise.all([loadPdfMake(), import("jszip")]);

  const zip = new JSZip();
  const used = new Set();
  for (const essay of accepted) {
    // Two students with the same name get "Name_2.pdf"
    let name = fileSafe(essay.studentName);
    for (let n = 2; used.has(name); n++) name = `${fileSafe(essay.studentName)}_${n}`;
    used.add(name);
    zip.file(`${name}.pdf`, await pdfBlob(pdfMake, buildDoc(essay, batch)));
  }
  const title = fileSafe(batch.question || `${batch.format} essay`).slice(0, 60);
  download(await zip.generateAsync({ type: "blob" }), `${title}_feedback.zip`);
  return accepted.length;
}
