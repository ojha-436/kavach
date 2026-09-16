import { describe, it, expect } from "vitest";
import { validateExplanation } from "./explain-judgment";
import type { JudgmentExplanation } from "./schema";

function explanation(
  overrides: Partial<JudgmentExplanation> = {}
): JudgmentExplanation {
  return {
    issue: [],
    held: [],
    reasoning: [],
    outcome: [],
    doesNotDecide: [],
    ...overrides,
  };
}

describe("validateExplanation", () => {
  const real = new Set([1, 2, 3]);

  it("keeps points whose paragraph citations all resolve", () => {
    const { explanation: out, droppedClaims } = validateExplanation(
      explanation({ held: [{ text: "The appeal was allowed.", paragraphs: [1, 3] }] }),
      real
    );

    expect(droppedClaims).toBe(0);
    expect(out.held).toHaveLength(1);
    expect(out.held[0].paragraphs).toEqual([1, 3]);
  });

  it("strips citations to paragraphs that do not exist", () => {
    const { explanation: out } = validateExplanation(
      explanation({ held: [{ text: "Allowed.", paragraphs: [1, 99] }] }),
      real
    );

    expect(out.held[0].paragraphs).toEqual([1]);
  });

  it("deletes a point whose citations are entirely fabricated", () => {
    const { explanation: out, droppedClaims } = validateExplanation(
      explanation({
        held: [
          { text: "Grounded claim.", paragraphs: [2] },
          { text: "Invented claim.", paragraphs: [42, 77] },
        ],
      }),
      real
    );

    expect(droppedClaims).toBe(1);
    expect(out.held).toHaveLength(1);
    expect(out.held[0].text).toBe("Grounded claim.");
  });

  it("deletes an uncited point outright", () => {
    const { explanation: out, droppedClaims } = validateExplanation(
      explanation({ outcome: [{ text: "Sounds plausible.", paragraphs: [] }] }),
      real
    );

    expect(droppedClaims).toBe(1);
    expect(out.outcome).toHaveLength(0);
  });

  it("counts drops across every section", () => {
    const { droppedClaims } = validateExplanation(
      explanation({
        issue: [{ text: "a", paragraphs: [500] }],
        held: [{ text: "b", paragraphs: [501] }],
        reasoning: [{ text: "c", paragraphs: [502] }],
        outcome: [{ text: "d", paragraphs: [503] }],
      }),
      real
    );

    expect(droppedClaims).toBe(4);
  });

  it("carries doesNotDecide through uncited, since absence has nothing to cite", () => {
    const { explanation: out, droppedClaims } = validateExplanation(
      explanation({
        doesNotDecide: ["It does not decide whether the Act applies retrospectively.", "   "],
      }),
      real
    );

    // Blank entries are removed, real ones kept, and none of it counts as a
    // dropped claim — you cannot cite a paragraph for what a court did not say.
    expect(out.doesNotDecide).toHaveLength(1);
    expect(droppedClaims).toBe(0);
  });
});
