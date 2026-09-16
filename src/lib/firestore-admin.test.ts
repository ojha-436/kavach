import { describe, it, expect } from "vitest";
import { clauseAnalysisPatch } from "./firestore-admin";
import type { Clause, ClauseFinding } from "./schema";

function clause(over: Partial<Clause> = {}): Clause {
  return {
    id: "clause-4",
    heading: "MAINTENANCE AND UTILITIES",
    text: "The Licensee shall bear electricity and water charges as metered. Society maintenance and all structural repairs shall be borne by the Licensor.",
    startOffset: 0,
    endOffset: 140,
    page: 1,
    clauseType: "utilities_charges",
    alsoCovers: ["maintenance_repairs"],
    ...over,
  };
}

const finding: ClauseFinding = {
  clauseId: "clause-4",
  verdict: "STANDARD",
  severity: 0,
  plainEnglish: "…",
  whyItMatters: "…",
  statutoryBasis: [],
  negotiationAsk: null,
  confidence: "HIGH",
  needsLawyer: false,
  lawyerQuestion: null,
};

/**
 * Regression: alsoCovers used to be dropped on write. Stage 2 computed it,
 * the browser received it, and Firestore kept Stage 0's empty array — so a
 * clause allocating both utilities and repairs was later reported as
 * "missing a repairs term" by anything that read it back.
 */
describe("clauseAnalysisPatch", () => {
  it("persists the secondary topics Stage 2 assigned", () => {
    const patch = clauseAnalysisPatch(clause(), finding);
    expect(patch.alsoCovers).toEqual(["maintenance_repairs"]);
  });

  it("persists the primary clause type", () => {
    expect(clauseAnalysisPatch(clause(), finding).clauseType).toBe(
      "utilities_charges"
    );
  });

  it("persists the finding, and null when there isn't one", () => {
    expect(clauseAnalysisPatch(clause(), finding).finding).toBe(finding);
    expect(clauseAnalysisPatch(clause(), null).finding).toBeNull();
  });

  it("writes an empty array rather than undefined when nothing else is covered", () => {
    // Firestore rejects undefined values, and a merge:true write that omits
    // the field would leave a stale one in place.
    const patch = clauseAnalysisPatch(clause({ alsoCovers: [] }), finding);
    expect(patch.alsoCovers).toEqual([]);
    expect(patch.alsoCovers).not.toBeUndefined();
  });

  it("tolerates a clause created before alsoCovers existed", () => {
    const legacy = clause();
    delete (legacy as Partial<Clause>).alsoCovers;
    expect(clauseAnalysisPatch(legacy, finding).alsoCovers).toEqual([]);
  });

  it("does not write back text or offsets, which Stage 2 must never change", () => {
    const patch = clauseAnalysisPatch(clause(), finding) as Record<string, unknown>;
    // A merge write that carried these would risk overwriting the spans that
    // every citation and highlight depends on.
    expect(patch.text).toBeUndefined();
    expect(patch.startOffset).toBeUndefined();
    expect(patch.endOffset).toBeUndefined();
    expect(Object.keys(patch).sort()).toEqual(["alsoCovers", "clauseType", "finding"]);
  });
});
