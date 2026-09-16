import { describe, it, expect } from "vitest";
import { compareAnalyses, type SideInput } from "./compare";
import type { Clause, ClauseFinding, DocumentKind } from "./schema";

const KIND: DocumentKind = {
  docType: "rental",
  label: "Leave and License Agreement",
  state: null,
  userSide: "tenant",
};

function clause(id: string, clauseType: string, alsoCovers: string[] = []): Clause {
  return {
    id,
    heading: clauseType.toUpperCase(),
    text: "x".repeat(80),
    startOffset: 0,
    endOffset: 80,
    page: 1,
    clauseType,
    alsoCovers,
  };
}

function finding(clauseId: string, verdict: ClauseFinding["verdict"]): ClauseFinding {
  return {
    clauseId,
    verdict,
    severity: 3,
    plainEnglish: "…",
    whyItMatters: "…",
    statutoryBasis: [],
    negotiationAsk: null,
    confidence: "HIGH",
    needsLawyer: false,
    lawyerQuestion: null,
  };
}

function side(
  id: string,
  riskScore: number,
  clauses: Clause[],
  findings: ClauseFinding[]
): SideInput {
  return {
    side: { id, label: KIND.label, fileName: `${id}.pdf`, riskScore, clauseCount: clauses.length },
    kind: KIND,
    clauses,
    findings,
  };
}

describe("compareAnalyses", () => {
  it("prefers the document whose shared term is less damaging to the reader", () => {
    const a = side("a", 10, [clause("c1", "landlord_entry")], [
      finding("c1", "STANDARD"),
    ]);
    const b = side("b", 40, [clause("c1", "landlord_entry")], [
      finding("c1", "ONEROUS_BUT_VALID"),
    ]);

    const row = compareAnalyses(a, b).rows.find(
      (r) => r.clauseType === "landlord_entry"
    );
    expect(row?.betterFor).toBe("a");
  });

  it("ranks VOID as worse for the reader than merely one-sided", () => {
    const a = side("a", 10, [clause("c1", "jurisdiction_ouster")], [
      finding("c1", "ONEROUS_BUT_VALID"),
    ]);
    const b = side("b", 40, [clause("c1", "jurisdiction_ouster")], [
      finding("c1", "VOID"),
    ]);

    const row = compareAnalyses(a, b).rows.find(
      (r) => r.clauseType === "jurisdiction_ouster"
    );
    expect(row?.betterFor).toBe("a");
  });

  it("counts a missing protection against the document that lacks it", () => {
    const a = side("a", 10, [clause("c1", "deposit_refund")], [
      finding("c1", "STANDARD"),
    ]);
    const b = side("b", 10, [clause("c9", "security_deposit")], []);

    const row = compareAnalyses(a, b).rows.find(
      (r) => r.clauseType === "deposit_refund"
    );
    expect(row?.a.present).toBe(true);
    expect(row?.b.present).toBe(false);
    expect(row?.betterFor).toBe("a");
    expect(row?.note).toMatch(/only the first document/i);
  });

  it("treats a topic covered only as a secondary label as present", () => {
    const a = side(
      "a",
      10,
      [clause("c1", "maintenance_repairs", ["utilities_charges"])],
      []
    );
    const b = side("b", 10, [clause("c1", "maintenance_repairs")], []);

    const row = compareAnalyses(a, b).rows.find(
      (r) => r.clauseType === "utilities_charges"
    );
    expect(row?.a.present).toBe(true);
    expect(row?.b.present).toBe(false);
  });

  it("surfaces differing rows before comparable ones", () => {
    const a = side(
      "a",
      10,
      [clause("c1", "landlord_entry"), clause("c2", "subletting")],
      [finding("c1", "STANDARD"), finding("c2", "STANDARD")]
    );
    const b = side(
      "b",
      10,
      [clause("c1", "landlord_entry"), clause("c2", "subletting")],
      [finding("c1", "VOID"), finding("c2", "STANDARD")]
    );

    const rows = compareAnalyses(a, b).rows;
    const firstSame = rows.findIndex((r) => r.betterFor === "same");
    const lastDiff = rows.map((r) => r.betterFor !== "same").lastIndexOf(true);
    expect(lastDiff).toBeLessThan(firstSame);
  });

  it("names the lower-risk document without recommending either", () => {
    const a = side("a", 12, [clause("c1", "landlord_entry")], []);
    const b = side("b", 48, [clause("c1", "landlord_entry")], []);

    const { summary } = compareAnalyses(a, b);
    expect(summary).toMatch(/first document carries less risk/i);
    expect(summary).toMatch(/does not tell you which to sign/i);
  });

  it("never reports a difference neither document contains", () => {
    const a = side("a", 0, [], []);
    const b = side("b", 0, [], []);
    for (const row of compareAnalyses(a, b).rows) {
      // Only curated protections may appear for two empty documents, and
      // they must be marked absent on both rather than favouring either.
      expect(row.betterFor).toBe("same");
      expect(row.note).toMatch(/neither document/i);
    }
  });
});
