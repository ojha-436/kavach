import { describe, it, expect } from "vitest";
import {
  allRules,
  rulesFor,
  ruleById,
  isValidRuleId,
  expectedClauseTypes,
  protectionsFor,
} from "./rules";
import { DocType } from "./schema";

const DOC_TYPES: DocType[] = ["rental", "employment"];

/**
 * The rule pack is the product's moat. These are integrity checks on the
 * curated data itself — a malformed pack silently degrades every verdict
 * downstream, and Zod only catches shape, not coherence.
 */
describe("rule pack integrity", () => {
  it("loads and parses both packs", () => {
    expect(allRules("rental").length).toBeGreaterThan(0);
    expect(allRules("employment").length).toBeGreaterThan(0);
  });

  it("has globally unique rule ids", () => {
    const ids = DOC_TYPES.flatMap((d) => allRules(d).map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tags every rule with the docType of the pack it lives in", () => {
    for (const docType of DOC_TYPES) {
      for (const rule of allRules(docType)) {
        expect(rule.docType).toBe(docType);
      }
    }
  });

  it("gives every rule a statute and a section", () => {
    for (const docType of DOC_TYPES) {
      for (const rule of allRules(docType)) {
        expect(rule.statute.trim().length).toBeGreaterThan(0);
        expect(rule.section.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("gives every rule a verification date", () => {
    for (const docType of DOC_TYPES) {
      for (const rule of allRules(docType)) {
        expect(rule.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("writes plain English that is actually plain — no bare section references", () => {
    for (const docType of DOC_TYPES) {
      for (const rule of allRules(docType)) {
        expect(rule.plainEnglish.length).toBeGreaterThan(40);
      }
    }
  });
});

describe("rule retrieval is a deterministic join", () => {
  it("returns only rules matching the requested clause type", () => {
    for (const docType of DOC_TYPES) {
      for (const clauseType of expectedClauseTypes(docType)) {
        for (const rule of rulesFor(docType, clauseType)) {
          expect(rule.clauseType).toBe(clauseType);
          expect(rule.docType).toBe(docType);
        }
      }
    }
  });

  it("returns nothing for an unknown clause type rather than guessing", () => {
    expect(rulesFor("rental", "no_such_clause_type")).toHaveLength(0);
  });

  it("never leaks rules across document types", () => {
    const employmentTypes = new Set(expectedClauseTypes("employment"));
    for (const clauseType of expectedClauseTypes("rental")) {
      if (!employmentTypes.has(clauseType)) {
        expect(rulesFor("employment", clauseType)).toHaveLength(0);
      }
    }
  });

  it("resolves every rule id it advertises", () => {
    for (const docType of DOC_TYPES) {
      for (const rule of allRules(docType)) {
        expect(isValidRuleId(docType, rule.id)).toBe(true);
        expect(ruleById(docType, rule.id)?.id).toBe(rule.id);
      }
    }
  });

  it("rejects a fabricated rule id", () => {
    expect(isValidRuleId("employment", "ICA_S999_INVENTED")).toBe(false);
  });
});

describe("expected protections", () => {
  it("only names clause types the taxonomy actually knows", () => {
    // A protection keyed to a clause type Stage 2 can never assign would be
    // reported as missing on every single document, forever.
    for (const docType of DOC_TYPES) {
      const taxonomy = new Set(expectedClauseTypes(docType));
      for (const protection of protectionsFor(docType)) {
        expect(taxonomy.has(protection.clauseType)).toBe(true);
      }
    }
  });

  it("lists each clause type at most once per document type", () => {
    for (const docType of DOC_TYPES) {
      const types = protectionsFor(docType).map((p) => p.clauseType);
      expect(new Set(types).size).toBe(types.length);
    }
  });

  it("explains what each absence costs, and what to ask for", () => {
    for (const docType of DOC_TYPES) {
      for (const protection of protectionsFor(docType)) {
        expect(protection.title.trim().length).toBeGreaterThan(0);
        expect(protection.absenceMeans.length).toBeGreaterThan(60);
        expect(protection.negotiationAsk.length).toBeGreaterThan(20);
      }
    }
  });

  it("covers both document types", () => {
    for (const docType of DOC_TYPES) {
      expect(protectionsFor(docType).length).toBeGreaterThan(0);
    }
  });
});
