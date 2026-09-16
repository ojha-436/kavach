import rental from "../../rules/rental.json";
import employment from "../../rules/employment.json";
import expectedProtections from "../../rules/expected-protections.json";
import {
  DocType,
  ExpectedProtection,
  ExpectedProtectionPack,
  RuleCard,
  RulePack,
} from "./schema";

const PACKS: Record<DocType, RulePack> = {
  rental: RulePack.parse(rental),
  employment: RulePack.parse(employment),
};

const PROTECTIONS: ExpectedProtectionPack =
  ExpectedProtectionPack.parse(expectedProtections);

/** Stage 5: the terms whose absence actually costs the reader something. */
export function protectionsFor(docType: DocType): ExpectedProtection[] {
  return PROTECTIONS.filter((p) => p.docType === docType);
}

/** Stage 3 — deterministic join. No embeddings, no top-K, no model call. */
export function rulesFor(docType: DocType, clauseType: string): RuleCard[] {
  return PACKS[docType].filter((rule) => rule.clauseType === clauseType);
}

export function ruleById(docType: DocType, ruleId: string): RuleCard | undefined {
  return PACKS[docType].find((rule) => rule.id === ruleId);
}

/** Validate a model-returned ruleId actually exists in the loaded pack (Architecture §4.4). */
export function isValidRuleId(docType: DocType, ruleId: string): boolean {
  return ruleById(docType, ruleId) !== undefined;
}

export function expectedClauseTypes(docType: DocType): string[] {
  return [...new Set(PACKS[docType].map((rule) => rule.clauseType))];
}

export function allRules(docType: DocType): RuleCard[] {
  return PACKS[docType];
}
