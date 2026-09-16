import { describe, it, expect } from "vitest";
import { buildChecklist, collectLawyerQuestions } from "./synthesize";
import type { Clause, ClauseFinding, ExpectedProtection } from "./schema";

function clause(id: string, heading: string): Clause {
  return {
    id,
    heading,
    text: "x".repeat(60),
    startOffset: 0,
    endOffset: 60,
    page: 1,
    clauseType: "non_compete",
    alsoCovers: [],
  };
}

function finding(over: Partial<ClauseFinding> = {}): ClauseFinding {
  return {
    clauseId: "c1",
    verdict: "VOID",
    severity: 5,
    plainEnglish: "This cannot be enforced against you.",
    whyItMatters: "…",
    statutoryBasis: [
      {
        ruleId: "ICA_S27_NONCOMPETE_POST",
        statute: "Indian Contract Act, 1872",
        section: "Section 27",
      },
    ],
    negotiationAsk: "Ask for the restraint to be deleted.",
    confidence: "HIGH",
    needsLawyer: false,
    lawyerQuestion: null,
    ...over,
  };
}

const protection: ExpectedProtection = {
  docType: "rental",
  clauseType: "deposit_refund",
  title: "No deadline for returning your deposit",
  absenceMeans: "The agreement never says when the deposit comes back.",
  negotiationAsk: "Ask for a refund window of 15 days.",
};

describe("buildChecklist", () => {
  it("is a projection of validated findings, so it carries their citation", () => {
    const items = buildChecklist([finding()], [clause("c1", "NON-COMPETE")], []);
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe("Ask for the restraint to be deleted.");
    expect(items[0].source).toBe("Indian Contract Act, 1872 — Section 27");
    expect(items[0].because).toContain("NON-COMPETE");
  });

  it("ranks unenforceable terms above merely one-sided ones", () => {
    const items = buildChecklist(
      [
        finding({ clauseId: "c1", verdict: "ONEROUS_BUT_VALID", negotiationAsk: "B" }),
        finding({ clauseId: "c2", verdict: "VOID", negotiationAsk: "A" }),
      ],
      [clause("c1", "ONE"), clause("c2", "TWO")],
      []
    );
    expect(items[0].action).toBe("A");
    expect(items[0].priority).toBe("high");
    expect(items[1].priority).toBe("medium");
  });

  it("includes what is missing, not just what is present", () => {
    const items = buildChecklist([], [], [protection]);
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe(protection.negotiationAsk);
    expect(items[0].source).toBeNull();
  });

  it("skips findings with nothing to ask for", () => {
    const items = buildChecklist(
      [finding({ verdict: "STANDARD", negotiationAsk: null })],
      [clause("c1", "ONE")],
      []
    );
    expect(items).toHaveLength(0);
  });

  it("produces an empty checklist rather than inventing actions", () => {
    expect(buildChecklist([], [], [])).toHaveLength(0);
  });
});

describe("collectLawyerQuestions", () => {
  it("collects only questions from findings that asked for a lawyer", () => {
    const qs = collectLawyerQuestions([
      finding({ needsLawyer: true, lawyerQuestion: "Which state law governs this?" }),
      finding({ clauseId: "c2", needsLawyer: false, lawyerQuestion: null }),
    ]);
    expect(qs).toEqual(["Which state law governs this?"]);
  });

  it("de-duplicates the same question raised by several clauses", () => {
    const q = "Has your state adopted the Model Tenancy Act?";
    const qs = collectLawyerQuestions([
      finding({ clauseId: "c1", needsLawyer: true, lawyerQuestion: q }),
      finding({ clauseId: "c2", needsLawyer: true, lawyerQuestion: q }),
    ]);
    expect(qs).toHaveLength(1);
  });
});
