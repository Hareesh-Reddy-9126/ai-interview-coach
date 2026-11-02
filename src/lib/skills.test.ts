import { describe, expect, it } from "vitest";
import { pickStrongestAndWeakest, SKILLS } from "./skills";

describe("pickStrongestAndWeakest", () => {
  it("breaks ties with the canonical skill order", () => {
    const rows = [
      { label: "Confidence", score: 77 },
      { label: "Communication", score: 77 },
      { label: "System Design", score: 78 },
      { label: "Problem Solving", score: 78 },
      { label: "Technical", score: 77 },
    ];

    const { strongest, weakest } = pickStrongestAndWeakest(rows, (row) => row.label);

    expect(strongest?.label).toBe("System Design");
    expect(weakest?.label).toBe("Communication");
  });

  it("handles a clear winner without ties", () => {
    const rows = [
      { label: "Communication", score: 64 },
      { label: "Technical", score: 91 },
    ];

    const { strongest, weakest } = pickStrongestAndWeakest(rows, (row) => row.label);

    expect(strongest?.label).toBe("Technical");
    expect(weakest?.label).toBe("Communication");
  });

  it("returns nulls when there is no data", () => {
    expect(pickStrongestAndWeakest([], () => "")).toEqual({ strongest: null, weakest: null });
  });

  it("keeps the canonical dimension order", () => {
    expect(SKILLS.map((skill) => skill.label)).toEqual([
      "Communication",
      "Technical",
      "System Design",
      "Problem Solving",
      "Confidence",
    ]);
  });
});
