/**
 * Canonical skill dimensions and ordering.
 *
 * Ties are common because the analytics aggregates round to whole numbers.
 * Always break ties with the canonical order below so every surface — dashboard,
 * report, radar, and analytics — names the same strongest and weakest skill.
 */
export const SKILLS = [
  { key: "communication_score", label: "Communication" },
  { key: "technical_score", label: "Technical" },
  { key: "system_design_score", label: "System Design" },
  { key: "problem_solving_score", label: "Problem Solving" },
  { key: "confidence_score", label: "Confidence" },
] as const;

export type SkillKey = (typeof SKILLS)[number]["key"];

function canonicalRank(label: string) {
  const index = SKILLS.findIndex((skill) => skill.label === label);
  return index === -1 ? SKILLS.length : index;
}

export function pickStrongestAndWeakest<T extends { score: number }>(
  rows: T[],
  getLabel: (row: T) => string,
): { strongest: T | null; weakest: T | null } {
  if (rows.length === 0) return { strongest: null, weakest: null };

  const tieBreak = (a: T, b: T) => canonicalRank(getLabel(a)) - canonicalRank(getLabel(b));

  return {
    strongest: [...rows].sort((a, b) => b.score - a.score || tieBreak(a, b))[0],
    weakest: [...rows].sort((a, b) => a.score - b.score || tieBreak(a, b))[0],
  };
}
