import { describe, it, expect } from "vitest";
import { validateCitations } from "./adjudicate";
import type { ClauseFinding, RuleCard } from "./schema";

const RULE: RuleCard = {
  id: "ICA_S27_NONCOMPETE_POST",
  docType: "employment",
  clauseType: "non_compete",
  statute: "Indian Contract Act, 1872",
  section: "Section 27",
  authority: "Superintendence Co. of India (P) Ltd. v. Krishan Murgai (SC, 1980)",
  defaultVerdict: "VOID",
  appliesWhen: "restraint operates after employment ends",
  plainEnglish: "Agreements in restraint of trade are void in India.",
  negotiationAsk: "Ask for the post-employment restraint to be deleted.",
  verifiedOn: "2026-09-15",
};

function finding(overrides: Partial<ClauseFinding> = {}): ClauseFinding {
  return {
    clauseId: "clause-3",
    verdict: "VOID",
    severity: 5,
    plainEnglish: "This clause cannot be enforced against you.",
    whyItMatters: "You may be complying with something unenforceable.",
    statutoryBasis: [],
    negotiationAsk: null,
    confidence: "HIGH",
    needsLawyer: false,
    lawyerQuestion: null,
    ...overrides,
  };
}

/**
 * These tests cover the product's central claim: that a fabricated citation
 * cannot reach the screen. If they fail, the claim is false.
 */
describe("validateCitations", () => {
  it("keeps a citation whose ruleId exists in the pack", () => {
    const { finding: out, dropped } = validateCitations(
      finding({
        statutoryBasis: [
          {
            ruleId: "ICA_S27_NONCOMPETE_POST",
            statute: "Indian Contract Act, 1872",
            section: "Section 27",
          },
        ],
      }),
      [RULE]
    );

    expect(dropped).toBe(0);
    expect(out.statutoryBasis).toHaveLength(1);
    expect(out.statutoryBasis[0].ruleId).toBe("ICA_S27_NONCOMPETE_POST");
  });

  it("deletes a citation whose ruleId is not in the pack", () => {
    const { finding: out, dropped } = validateCitations(
      finding({
        statutoryBasis: [
          {
            ruleId: "ICA_S99_TOTALLY_INVENTED",
            statute: "Indian Contract Act, 1872",
            section: "Section 99",
          },
        ],
      }),
      [RULE]
    );

    expect(dropped).toBe(1);
    expect(out.statutoryBasis).toHaveLength(0);
  });

  it("re-derives statute and section from the pack, ignoring the model's copy", () => {
    // The model cites a real rule but misquotes the section. The pack wins.
    const { finding: out } = validateCitations(
      finding({
        statutoryBasis: [
          {
            ruleId: "ICA_S27_NONCOMPETE_POST",
            statute: "Contract Act 1872 (abbreviated)",
            section: "Section 72",
          },
        ],
      }),
      [RULE]
    );

    expect(out.statutoryBasis[0].statute).toBe("Indian Contract Act, 1872");
    expect(out.statutoryBasis[0].section).toBe("Section 27");
    expect(out.statutoryBasis[0].authority).toBe(RULE.authority);
  });

  it("downgrades confidence and flags a lawyer when every citation is dropped", () => {
    const { finding: out, dropped } = validateCitations(
      finding({
        confidence: "HIGH",
        needsLawyer: false,
        statutoryBasis: [
          { ruleId: "MADE_UP_A", statute: "x", section: "y" },
          { ruleId: "MADE_UP_B", statute: "x", section: "y" },
        ],
      }),
      [RULE]
    );

    expect(dropped).toBe(2);
    expect(out.statutoryBasis).toHaveLength(0);
    expect(out.confidence).toBe("LOW");
    expect(out.needsLawyer).toBe(true);
    expect(out.lawyerQuestion).toBeTruthy();
  });

  it("leaves confidence alone when at least one citation survives", () => {
    const { finding: out, dropped } = validateCitations(
      finding({
        confidence: "HIGH",
        statutoryBasis: [
          {
            ruleId: "ICA_S27_NONCOMPETE_POST",
            statute: "Indian Contract Act, 1872",
            section: "Section 27",
          },
          { ruleId: "MADE_UP", statute: "x", section: "y" },
        ],
      }),
      [RULE]
    );

    expect(dropped).toBe(1);
    expect(out.statutoryBasis).toHaveLength(1);
    expect(out.confidence).toBe("HIGH");
  });

  it("does not invent a citation when the model supplied none", () => {
    const { finding: out, dropped } = validateCitations(
      finding({ verdict: "STANDARD", severity: 0, statutoryBasis: [] }),
      [RULE]
    );

    expect(dropped).toBe(0);
    expect(out.statutoryBasis).toHaveLength(0);
    // Nothing was dropped, so nothing should be downgraded either.
    expect(out.confidence).toBe("HIGH");
  });
});
