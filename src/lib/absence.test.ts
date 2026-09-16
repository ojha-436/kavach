import { describe, it, expect } from "vitest";
import { findMissingProtections } from "./absence";
import { protectionsFor } from "./rules";
import type { Clause, DocumentKind } from "./schema";

function clause(clauseType: string | null, alsoCovers: string[] = []): Clause {
  return {
    id: `c-${clauseType ?? "none"}-${alsoCovers.join("-")}`,
    heading: null,
    text: "x".repeat(60),
    startOffset: 0,
    endOffset: 60,
    page: 1,
    clauseType,
    alsoCovers,
  };
}

const RENTAL: DocumentKind = {
  docType: "rental",
  label: "Leave and License Agreement",
  state: null,
  userSide: "tenant",
};

describe("findMissingProtections", () => {
  it("reports a protection the document never addresses", () => {
    const missing = findMissingProtections([clause("security_deposit")], RENTAL);
    expect(missing.map((p) => p.clauseType)).toContain("deposit_refund");
  });

  it("does not report a protection the document does address", () => {
    const missing = findMissingProtections(
      [clause("security_deposit"), clause("deposit_refund")],
      RENTAL
    );
    expect(missing.map((p) => p.clauseType)).not.toContain("deposit_refund");
  });

  it("counts secondary topics a clause also covers", () => {
    // Regression: a clause allocating both repairs and utility bills was
    // reported as "missing a utilities term" — a false claim about the
    // user's own document — because only the primary label was considered.
    const withPrimaryOnly = findMissingProtections(
      [clause("maintenance_repairs")],
      RENTAL
    );
    expect(withPrimaryOnly.map((p) => p.clauseType)).toContain("utilities_charges");

    const withSecondary = findMissingProtections(
      [clause("maintenance_repairs", ["utilities_charges"])],
      RENTAL
    );
    expect(withSecondary.map((p) => p.clauseType)).not.toContain("utilities_charges");
  });

  it("never reports a clause type the reader would not want present", () => {
    // A naive set difference over the rule pack would announce that the
    // contract is "missing a non-compete clause".
    const missing = findMissingProtections([], RENTAL);
    const types = missing.map((p) => p.clauseType);
    for (const unwanted of [
      "non_compete",
      "lock_in_period",
      "jurisdiction_ouster",
      "rent_escalation",
    ]) {
      expect(types).not.toContain(unwanted);
    }
  });

  it("reports every curated protection for an empty document", () => {
    const missing = findMissingProtections([], RENTAL);
    expect(missing).toHaveLength(protectionsFor("rental").length);
  });

  it("returns nothing for a document type outside the rule pack", () => {
    const missing = findMissingProtections([clause(null)], {
      docType: "other",
      label: "Loan agreement",
      state: null,
      userSide: "unknown",
    });
    expect(missing).toHaveLength(0);
  });

  it("ignores clauses typed OTHER", () => {
    const missing = findMissingProtections([clause("OTHER")], RENTAL);
    expect(missing).toHaveLength(protectionsFor("rental").length);
  });
});
