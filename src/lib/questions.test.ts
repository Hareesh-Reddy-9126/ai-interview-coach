import { describe, it, expect } from "vitest";
import {
  getQuestionById,
  getQuestions,
  getQuestionCount,
  scoreAgainstRubric,
  QUESTIONS,
} from "./questions";

describe("Curated question bank", () => {
  it("has 8 curated questions", () => {
    expect(QUESTIONS).toHaveLength(8);
  });

  it("getQuestionById returns the right question", () => {
    const q = getQuestionById("q-001");
    expect(q).toBeDefined();
    expect(q!.id).toBe("q-001");
    expect(q!.company).toBe("Google");
    expect(q!.question).toContain("temperatures");
  });

  it("getQuestionById returns undefined for unknown id", () => {
    expect(getQuestionById("nope")).toBeUndefined();
  });

  it("getQuestions filters by company", () => {
    const google = getQuestions({ company: "Google" });
    expect(google.every((q) => q.company === "Google")).toBe(true);
    expect(google.length).toBeGreaterThan(0);
  });

  it("getQuestions filters by role", () => {
    const backend = getQuestions({ role: "Backend Engineer" });
    expect(backend.every((q) => q.role === "Backend Engineer")).toBe(true);
  });

  it("getQuestions filters by difficulty", () => {
    const easy = getQuestions({ difficulty: "Easy" });
    expect(easy.every((q) => q.difficulty === "Easy")).toBe(true);
  });

  it("getQuestions filters by focus", () => {
    const coding = getQuestions({ focus: "Coding" });
    expect(coding.every((q) => q.focus === "Coding")).toBe(true);
  });

  it("getQuestions applies limit", () => {
    const limited = getQuestions({ limit: 2 });
    expect(limited.length).toBeLessThanOrEqual(2);
  });

  it("getQuestionCount returns correct count", () => {
    expect(getQuestionCount()).toBe(8);
    expect(getQuestionCount({ company: "Google" })).toBe(1);
  });

  it("scoreAgainstRubric rewards concept coverage", () => {
    const q = getQuestionById("q-001")!;
    const baseScores: Record<string, number> = {
      communication_score: 50,
      technical_score: 50,
      system_design_score: 50,
      problem_solving_score: 50,
      confidence_score: 50,
    } as Record<string, number>;

    // Answer mentioning all concepts should score higher
    const richAnswer =
      "I would use a monotonic decreasing stack that stores indices. This gives O(n) time and O(n) space complexity.";
    const richScores = scoreAgainstRubric(q, richAnswer, baseScores);

    const poorAnswer = "I don't know.";
    const poorScores = scoreAgainstRubric(q, poorAnswer, baseScores);

    expect(richScores.technical_score).toBeGreaterThan(poorScores.technical_score);
  });

  it("scores stay within 0-100", () => {
    const q = getQuestionById("q-001")!;
    const baseScores: Record<string, number> = {
      communication_score: 50,
      technical_score: 50,
      system_design_score: 50,
      problem_solving_score: 50,
      confidence_score: 50,
    } as Record<string, number>;

    const scores = scoreAgainstRubric(q, "x".repeat(5000), baseScores);
    for (const score of Object.values(scores)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
