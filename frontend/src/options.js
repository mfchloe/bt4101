// Fixed options for library files. Keep in sync with SBB_LEVELS, THEMES and
// FORMATS in backend/config.py.
export const SBB_LEVELS = ["G1", "G2", "G3"];

export const THEMES = [
  "Technology",
  "Environment",
  "Identity",
  "Society",
  "Education",
  "Relationships",
  "Others",
];

export const FORMATS = [
  "Narrative",
  "Personal Recount",
  "Descriptive",
  "Reflective",
  "Argumentative",
  "Discursive",
  "Hybrid",
];

// Essays with a total at or below this mark (out of 30) are flagged as at risk,
// on both the essay marking and analytics pages
export const AT_RISK_MAX = 17;

// Marking method used unless the teacher changes it under "Marking method".
// Keep in sync with DEFAULT_USE_CHECKLIST / DEFAULT_USE_MODEL_ESSAYS in
// backend/config.py, and set both to the best condition after the experiment.
export const MARKING_DEFAULTS = { useChecklist: true, useModelEssays: true };
