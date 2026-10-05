/*
 * Sample data for the Analytics page, until it reads from the Student Marks
 * table. Scores follow the G2 rubric: Content /10, Language /20, total /30.
 *
 * Generated from a fixed seed so the numbers are the same on every load.
 */

export const CLASS_NAME = "2A";
export const MAX_TOTAL = 30;

export const ASSIGNMENTS = [
  { id: "a1", title: "Social media and teenagers", format: "Argumentative", theme: "Technology", date: "12 Jul" },
  { id: "a2", title: "Saving our coastlines", format: "Discursive", theme: "Environment", date: "2 Aug" },
  { id: "a3", title: "A day I will never forget", format: "Narrative", theme: "Relationships", date: "23 Aug" },
  { id: "a4", title: "Who I am becoming", format: "Reflective", theme: "Identity", date: "13 Sep" },
];

export const WEAKNESSES = [
  "Subject-verb agreement",
  "Undeveloped conclusion",
  "Limited vocabulary range",
  "Weak paragraph linking",
  "Ideas lack examples",
  "Spelling errors",
  "Off-topic introduction",
];

const NAMES = [
  "Tan Wei Ling", "Muhammad Hafiz", "Priya Raman", "Lim Jun Jie", "Nur Aisyah",
  "Chen Yu Xuan", "Aaron Goh", "Siti Nurhaliza", "Ravi Kumar", "Ong Shu Hui",
  "Daniel Lee", "Farah Iskandar", "Koh Zhi Hao", "Meera Pillai", "Ng Kai Wen",
  "Amirah Yusof", "Jonathan Teo", "Chua Xin Yi", "Arjun Nair", "Lau Hui Min",
  "Haziq Rahman", "Wong Jia Hui", "Ethan Sim", "Kavya Menon", "Toh Yi Ting",
  "Muhammad Rizwan", "Ho Wen Xin", "Ahmad Hakim", "Seah Li Ting", "Benjamin Yeo",
];

// Small seeded random number generator (mulberry32)
function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, max) => Math.max(0, Math.min(max, Math.round(value)));

// How much harder (-) or easier (+) each format was for this class
const FORMAT_EFFECT = { Argumentative: 0, Discursive: -0.07, Narrative: 0.06, Reflective: 0.02 };

function buildEssays() {
  const random = seeded(2026);
  const essays = [];

  NAMES.forEach((name, i) => {
    const ability = 0.28 + random() * 0.6; // 0.28..0.88
    const languageGap = (random() - 0.5) * 0.2; // some students are stronger in one criterion
    const usualWeakness = WEAKNESSES[Math.floor(random() * WEAKNESSES.length)];

    ASSIGNMENTS.forEach((assignment, j) => {
      const growth = j * 0.015;
      const noise = (random() - 0.5) * 0.16;
      const level = ability + growth + FORMAT_EFFECT[assignment.format] + noise;
      const content = clamp((level - languageGap / 2) * 10, 10);
      const language = clamp((level + languageGap / 2) * 20, 20);

      // Weaker essays pick up more recurring issues
      const weaknesses = new Set([usualWeakness]);
      if (level < 0.6) weaknesses.add(WEAKNESSES[Math.floor(random() * 4)]);
      if (level < 0.45) weaknesses.add(WEAKNESSES[Math.floor(random() * WEAKNESSES.length)]);

      essays.push({
        studentId: `s${i + 1}`,
        student: name,
        assignmentId: assignment.id,
        content,
        language,
        total: content + language,
        weaknesses: [...weaknesses],
      });
    });
  });

  return essays;
}

export const ESSAYS = buildEssays();
