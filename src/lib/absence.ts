import { protectionsFor } from "./rules";
import { Clause, DocType, DocumentKind, ExpectedProtection } from "./schema";

/**
 * Stage 5, the absence diff (Architecture SS4.2).
 *
 * The output nobody else ships: not what is in your contract, but what is
 * missing from it. An absence is structurally invisible to anything that
 * only reads what is there — it is not in the context window, so no amount
 * of prompting over the document text will surface it.
 *
 * No model call. The expected set is curated, the found set comes from
 * Stage 2, and the difference is a set operation. That means Stage 5 cannot
 * hallucinate a missing protection, and cannot miss one for want of the
 * model noticing.
 */
export function findMissingProtections(
  clauses: Clause[],
  kind: DocumentKind
): ExpectedProtection[] {
  if (kind.docType === "other") return [];

  // A clause counts as covering every topic it addresses, not just its
  // primary label — otherwise a term that allocates both repairs and utility
  // bills gets reported as a missing utilities term.
  const found = new Set<string>();
  for (const c of clauses) {
    if (c.clauseType) found.add(c.clauseType);
    for (const t of c.alsoCovers ?? []) found.add(t);
  }

  return protectionsFor(kind.docType as DocType).filter(
    (p) => !found.has(p.clauseType)
  );
}
