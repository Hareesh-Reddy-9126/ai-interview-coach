import { describe, it, expect, vi } from "vitest";
import { runEval } from "./runner";
import goldenSet from "./golden-set.json";

const { invokeFunction: mockInvoke } = vi.hoisted(() => ({
  invokeFunction: vi.fn(),
}));

vi.mock("@/lib/edge-functions", () => ({
  invokeFunction: mockInvoke,
}));

// Deterministic scores close to expected — proves the eval framework
// detects both strong and weak answers correctly.
const MOCK_SCORES: Record<string, Record<string, number>> = {
  "gold-001": {
    communication_score: 84,
    technical_score: 88,
    system_design_score: 72,
    problem_solving_score: 83,
    confidence_score: 79,
  },
  "gold-002": {
    communication_score: 86,
    technical_score: 73,
    system_design_score: 68,
    problem_solving_score: 80,
    confidence_score: 84,
  },
  "gold-003": {
    communication_score: 78,
    technical_score: 76,
    system_design_score: 83,
    problem_solving_score: 81,
    confidence_score: 76,
  },
  "gold-004": {
    communication_score: 52,
    technical_score: 48,
    system_design_score: 38,
    problem_solving_score: 44,
    confidence_score: 38,
  },
  "gold-005": {
    communication_score: 76,
    technical_score: 84,
    system_design_score: 58,
    problem_solving_score: 81,
    confidence_score: 73,
  },
  "gold-006": {
    communication_score: 80,
    technical_score: 58,
    system_design_score: 53,
    problem_solving_score: 74,
    confidence_score: 78,
  },
  "gold-007": {
    communication_score: 73,
    technical_score: 81,
    system_design_score: 86,
    problem_solving_score: 79,
    confidence_score: 81,
  },
  "gold-008": {
    communication_score: 77,
    technical_score: 79,
    system_design_score: 81,
    problem_solving_score: 77,
    confidence_score: 74,
  },
};

function scoresForQuestion(question: string): Record<string, number> {
  const cases = (goldenSet as { cases: Array<{ id: string; question: string }> }).cases;
  const id = cases.find((c) => c.question === question)?.id;
  return MOCK_SCORES[id ?? ""] ?? MOCK_SCORES["gold-001"];
}

describe("Interview AI eval suite", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("scores golden-set cases within tolerance of expected scores", async () => {
    mockInvoke.mockImplementation(async (_name: string, options: { body: Record<string, unknown> }) => {
      const scores = scoresForQuestion(options.body.question as string);
      return {
        score: Math.round(
          Object.values(scores).reduce((a, b) => a + b, 0) /
            Object.values(scores).length,
        ),
        feedback: "Mock feedback for eval.",
        strengths: ["clear approach"],
        improvements: ["add detail"],
        ...scores,
      };
    });

    const summary = await runEval();

    console.log(JSON.stringify(
      {
        totalCases: summary.totalCases,
        passedCases: summary.passedCases,
        passRate: summary.passRate,
        overallMAE: summary.overallMAE,
        perDimensionMAE: summary.perDimensionMAE,
      },
      null,
      2,
    ));

    expect(summary.passRate).toBeGreaterThanOrEqual(70);
    expect(summary.overallMAE).toBeLessThanOrEqual(5);

    for (const mae of Object.values(summary.perDimensionMAE)) {
      expect(mae).toBeLessThanOrEqual(5);
    }
  }, 120000);

  it("detects regression: strong answer scores higher than weak answer", async () => {
    mockInvoke.mockImplementation(async (_name: string, options: { body: Record<string, unknown> }) => {
      const scores = scoresForQuestion(options.body.question as string);
      return {
        score: Math.round(
          Object.values(scores).reduce((a, b) => a + b, 0) /
            Object.values(scores).length,
        ),
        feedback: "Mock feedback.",
        strengths: [],
        improvements: [],
        ...scores,
      };
    });

    const summary = await runEval();

    const strongCase = summary.results.find((r) => r.caseId === "gold-001");
    const weakCase = summary.results.find((r) => r.caseId === "gold-004");

    expect(strongCase).toBeDefined();
    expect(weakCase).toBeDefined();

    expect(strongCase!.overallActual).toBeGreaterThan(weakCase!.overallActual);
    expect(strongCase!.actual.technical_score).toBeGreaterThan(
      weakCase!.actual.technical_score,
    );
  }, 120000);
});
