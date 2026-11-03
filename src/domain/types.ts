/**
 * Domain layer — canonical schemas and pure business logic for the AI Interview Lab.
 *
 * Every entity that crosses the frontend↔edge-function boundary is validated
 * with Zod. This gives us:
 *   • End-to-end type safety with no `any` leakage
 *   • Runtime contract enforcement (malformed AI responses are rejected, not crashed on)
 *   • A single source of truth for dashboard, report, radar, and analytics surfaces
 *
 * Zero runtime dependencies beyond zod (already a transitive dep).
 */

import { z } from "zod";

// ── Shared primitives ──────────────────────────────────────────────────────

export const SkillKey = z.enum([
  "communication_score",
  "technical_score",
  "system_design_score",
  "problem_solving_score",
  "confidence_score",
]);
export type SkillKey = z.infer<typeof SkillKey>;

export const SKILL_LABELS: Record<SkillKey, string> = {
  communication_score: "Communication",
  technical_score: "Technical",
  system_design_score: "System Design",
  problem_solving_score: "Problem Solving",
  confidence_score: "Confidence",
} as const;

export const Score = z.number().int().min(0).max(100);
export type Score = z.infer<typeof Score>;

export const Difficulty = z.enum(["Easy", "Medium", "Hard"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const Experience = z.enum([
  "Junior (0-2 yrs)",
  "Mid (2-5 yrs)",
  "Senior (5+ yrs)",
]);
export type Experience = z.infer<typeof Experience>;

export const InterviewFocus = z.enum(["Behavioral", "System Design", "Leadership", "Coding"]);
export type InterviewFocus = z.infer<typeof InterviewFocus>;

export const Company = z.enum([
  "Google",
  "Amazon",
  "Meta",
  "Microsoft",
  "Netflix",
  "Apple",
  "Startup",
]);
export type Company = z.infer<typeof Company>;

export const Role = z.enum([
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "ML Engineer",
  "DevOps Engineer",
]);
export type Role = z.infer<typeof Role>;

export const SessionStatus = z.enum(["draft", "in_progress", "completed", "abandoned"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

// ── Entities ───────────────────────────────────────────────────────────────

export const InterviewSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  company: Company,
  role: Role,
  difficulty: Difficulty,
  experience: Experience,
  focus: InterviewFocus.nullable(),
  resume_mode: z.boolean().default(false),
  status: SessionStatus,
  overall_score: Score.nullable(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type InterviewSession = z.infer<typeof InterviewSessionSchema>;

export const InterviewTurnSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  turn_index: z.number().int().min(0),
  question: z.string().min(1),
  answer: z.string().nullable(),
  score: Score.nullable(),
  feedback: z.string().nullable(),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  next_question: z.string().nullable(),
  tokens_in: z.number().int().nonnegative().default(0),
  tokens_out: z.number().int().nonnegative().default(0),
  latency_ms: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
});
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;

export const UserAnalyticsSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  communication_score: Score,
  technical_score: Score,
  system_design_score: Score,
  problem_solving_score: Score,
  confidence_score: Score,
  interviews_completed: z.number().int().nonnegative(),
  current_streak: z.number().int().nonnegative(),
  updated_at: z.string().datetime(),
});
export type UserAnalytics = z.infer<typeof UserAnalyticsSchema>;

// ── Edge function contracts ────────────────────────────────────────────────

export const StartInterviewRequest = z.object({
  company: Company,
  role: Role,
  difficulty: Difficulty,
  experience: Experience,
  focus: InterviewFocus.nullable(),
  resume_mode: z.boolean().optional(),
});
export type StartInterviewRequest = z.infer<typeof StartInterviewRequest>;

export const StartInterviewResponse = z.object({
  session_id: z.string().uuid(),
  first_question: z.string().min(1),
  turn_index: z.number().int().nonnegative(),
});
export type StartInterviewResponse = z.infer<typeof StartInterviewResponse>;

export const SubmitAnswerRequest = z.object({
  session_id: z.string().uuid(),
  turn_index: z.number().int().nonnegative(),
  answer: z.string().min(1),
});
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerRequest>;

export const SubmitAnswerResponse = z.object({
  score: Score.nullable(),
  feedback: z.string().nullable(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  next_question: z.string().nullable(),
  is_complete: z.boolean(),
});
export type SubmitAnswerResponse = z.infer<typeof SubmitAnswerResponse>;

export const GenerateRoadmapRequest = z.object({});
export type GenerateRoadmapRequest = z.infer<typeof GenerateRoadmapRequest>;

export const RoadmapWeekSchema = z.object({
  week: z.number().int().min(1).max(4),
  title: z.string().min(1),
  focus_skill: SkillKey,
  description: z.string().min(1),
  tasks: z.array(z.string().min(1)),
  resources: z.array(z.string().min(1)).default([]),
});
export type RoadmapWeek = z.infer<typeof RoadmapWeekSchema>;

export const GenerateRoadmapResponse = z.object({
  weeks: z.array(RoadmapWeekSchema),
  summary: z.string().min(1),
  priority_skill: z.string().min(1),
});
export type GenerateRoadmapResponse = z.infer<typeof GenerateRoadmapResponse>;

export const AnalyzeResumeRequest = z.object({
  file_url: z.string().url(),
});
export type AnalyzeResumeRequest = z.infer<typeof AnalyzeResumeRequest>;

export const AnalyzeResumeResponse = z.object({
  analysis_status: z.enum(["pending", "analyzing", "completed", "failed"]),
  skills: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  interview_questions: z.array(z.string()).default([]),
  summary: z.string().default(""),
});
export type AnalyzeResumeResponse = z.infer<typeof AnalyzeResumeResponse>;

export const CodeReviewRequest = z.object({
  code: z.string().min(1),
  language: z.string().min(1),
  problem: z.string().min(1),
  test_results: z.array(z.object({ passed: z.boolean(), test_index: z.number() })).default([]),
});
export type CodeReviewRequest = z.infer<typeof CodeReviewRequest>;

export const CodeReviewResponse = z.object({
  correctness: Score,
  code_quality: Score,
  feedback: z.string().min(1),
  optimizations: z.array(z.string()).default([]),
  time_complexity: z.string().default(""),
  space_complexity: z.string().default(""),
  suggested_answer: z.string().optional(),
});
export type CodeReviewResponse = z.infer<typeof CodeReviewResponse>;

// ── Validation helpers ─────────────────────────────────────────────────────

export function validateStartInterview(body: unknown): StartInterviewRequest {
  return StartInterviewRequest.parse(body);
}

export function validateSubmitAnswer(body: unknown): SubmitAnswerRequest {
  return SubmitAnswerRequest.parse(body);
}

export function validateStartInterviewResponse(data: unknown): StartInterviewResponse {
  return StartInterviewResponse.parse(data);
}

export function validateSubmitAnswerResponse(data: unknown): SubmitAnswerResponse {
  return SubmitAnswerResponse.parse(data);
}

export function validateGenerateRoadmapResponse(data: unknown): GenerateRoadmapResponse {
  return GenerateRoadmapResponse.parse(data);
}

export function validateAnalyzeResumeResponse(data: unknown): AnalyzeResumeResponse {
  return AnalyzeResumeResponse.parse(data);
}

export function validateCodeReviewResponse(data: unknown): CodeReviewResponse {
  return CodeReviewResponse.parse(data);
}

// ── Pure scoring logic ─────────────────────────────────────────────────────

const SKILL_KEYWORD_MAP: Record<SkillKey, string[]> = {
  communication_score: ["communicat", "clarity", "articulate", "explain", "clear", "concise", "structured"],
  technical_score: ["technical", "code", "algorithm", "data structure", "implementation", "logic", "complexity"],
  system_design_score: ["system design", "architecture", "scalab", "distributed", "database", "trade-off"],
  problem_solving_score: ["problem solving", "approach", "solution", "analytical", "debug", "optimize", "edge case"],
  confidence_score: ["confidence", "composure", "assertive", "decisive", "prepared"],
};

export function deriveSkillScoresFromTurns(
  turns: Array<{ score?: number | null; feedback?: string | null; strengths?: string[]; improvements?: string[] }>,
  avgScore: number,
): Record<SkillKey, number> {
  const buckets: Record<SkillKey, number[]> = {
    communication_score: [],
    technical_score: [],
    system_design_score: [],
    problem_solving_score: [],
    confidence_score: [],
  };

  for (const turn of turns) {
    const text = [turn.feedback || "", ...(turn.strengths || []), ...(turn.improvements || [])]
      .join(" ")
      .toLowerCase();
    const score = turn.score ?? avgScore;
    const strengthText = (turn.strengths || []).join(" ").toLowerCase();
    const improvementText = (turn.improvements || []).join(" ").toLowerCase();

    for (const skill of Object.keys(SKILL_KEYWORD_MAP) as SkillKey[]) {
      const keywords = SKILL_KEYWORD_MAP[skill];
      const mentioned = keywords.some((k) => text.includes(k));
      if (!mentioned) continue;
      let adjusted = score;
      const inStrengths = keywords.some((k) => strengthText.includes(k));
      const inImprovements = keywords.some((k) => improvementText.includes(k));
      if (inStrengths && !inImprovements) adjusted = Math.min(100, score + 10);
      else if (inImprovements && !inStrengths) adjusted = Math.max(0, score - 10);
      buckets[skill].push(adjusted);
    }
  }

  const avg = (arr: number[]): number =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : avgScore;

  return {
    communication_score: avg(buckets.communication_score),
    technical_score: avg(buckets.technical_score),
    system_design_score: avg(buckets.system_design_score),
    problem_solving_score: avg(buckets.problem_solving_score),
    confidence_score: avg(buckets.confidence_score),
  };
}

export function computeOverallScore(skillScores: Record<SkillKey, number>): number {
  const values = Object.values(skillScores);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// ── Canonical ranking (kept here so every surface agrees) ──────────────────

function canonicalRank(label: string) {
  const order = [
    "Communication",
    "Technical",
    "System Design",
    "Problem Solving",
    "Confidence",
  ];
  const index = order.indexOf(label);
  return index === -1 ? order.length : index;
}

export function pickStrongestAndWeakest<T extends { score: number; label: string }>(
  rows: T[],
): { strongest: T | null; weakest: T | null } {
  if (rows.length === 0) return { strongest: null, weakest: null };
  const tieBreak = (a: T, b: T) => canonicalRank(a.label) - canonicalRank(b.label);
  return {
    strongest: [...rows].sort((a, b) => b.score - a.score || tieBreak(a, b))[0],
    weakest: [...rows].sort((a, b) => a.score - b.score || tieBreak(a, b))[0],
  };
}
