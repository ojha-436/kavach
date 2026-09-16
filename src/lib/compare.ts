import { protectionsFor } from "./rules";
import {
  Clause,
  ClauseFinding,
  DocType,
  DocumentKind,
  ExpectedProtection,
} from "./schema";

/**
 * Document comparison.
 *
 * Deterministic. Two documents are compared topic by topic, using the clause
 * types Stage 2 assigned and the verdicts Stage 4 already validated — so a
 * comparison cannot claim a difference that the underlying analyses do not
 * contain. No model call.
 *
 * "Better" means better for the reader, which is not the same as better
 * drafted. A clause that is VOID is ranked worse than one that is merely
 * one-sided, because the reader is likely to comply with it either way.
 */

const SEVERITY: Record<string, number> = {
  FAVOURABLE: 0,
  STANDARD: 1,
  ONEROUS_BUT_VALID: 2,
  UNENFORCEABLE_IN_PART: 3,
  VOID: 4,
};

export type Side = {
  id: string;
  label: string;
  fileName: string;
  riskScore: number;
  clauseCount: number;
};

export type ComparisonRow = {
  clauseType: string;
  title: string;
  /** Curated meaning of this topic being absent, when it is a protection. */
  absenceMeans: string | null;
  a: { present: boolean; verdict: string | null; heading: string | null };
  b: { present: boolean; verdict: string | null; heading: string | null };
  betterFor: "a" | "b" | "same";
  note: string;
};

export type Comparison = {
  a: Side;
  b: Side;
  rows: ComparisonRow[];
  summary: string;
};

export type SideInput = {
  side: Side;
  kind: DocumentKind;
  clauses: Clause[];
  findings: ClauseFinding[];
};

function topicsOf(clauses: Clause[]): Map<string, Clause> {
  const map = new Map<string, Clause>();
  for (const c of clauses) {
    if (c.clauseType && c.clauseType !== "OTHER" && !map.has(c.clauseType)) {
      map.set(c.clauseType, c);
    }
    for (const t of c.alsoCovers ?? []) {
      if (!map.has(t)) map.set(t, c);
    }
  }
  return map;
}

function humanise(clauseType: string): string {
  return clauseType.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());
}

export function compareAnalyses(a: SideInput, b: SideInput): Comparison {
  const topicsA = topicsOf(a.clauses);
  const topicsB = topicsOf(b.clauses);
  const findingA = new Map(a.findings.map((f) => [f.clauseId, f]));
  const findingB = new Map(b.findings.map((f) => [f.clauseId, f]));

  const protections = new Map<string, ExpectedProtection>();
  for (const kind of [a.kind, b.kind]) {
    if (kind.docType === "other") continue;
    for (const p of protectionsFor(kind.docType as DocType)) {
      protections.set(p.clauseType, p);
    }
  }

  const allTopics = [...new Set([...topicsA.keys(), ...topicsB.keys(), ...protections.keys()])].sort();

  const rows: ComparisonRow[] = [];
  for (const clauseType of allTopics) {
    const ca = topicsA.get(clauseType);
    const cb = topicsB.get(clauseType);
    const fa = ca ? (findingA.get(ca.id) ?? null) : null;
    const fb = cb ? (findingB.get(cb.id) ?? null) : null;
    const protection = protections.get(clauseType) ?? null;

    // Absent expected protection scores worse than a merely standard term.
    const scoreA = ca ? (SEVERITY[fa?.verdict ?? "STANDARD"] ?? 1) : protection ? 2.5 : 1;
    const scoreB = cb ? (SEVERITY[fb?.verdict ?? "STANDARD"] ?? 1) : protection ? 2.5 : 1;

    let betterFor: ComparisonRow["betterFor"] = "same";
    if (scoreA < scoreB) betterFor = "a";
    else if (scoreB < scoreA) betterFor = "b";

    if (betterFor === "same" && !ca && !cb) continue;

    rows.push({
      clauseType,
      title: protection?.title ?? humanise(clauseType),
      absenceMeans: protection?.absenceMeans ?? null,
      a: { present: !!ca, verdict: fa?.verdict ?? null, heading: ca?.heading ?? null },
      b: { present: !!cb, verdict: fb?.verdict ?? null, heading: cb?.heading ?? null },
      betterFor,
      note: noteFor(!!ca, !!cb, fa, fb, !!protection, betterFor),
    });
  }

  // Differences first: a comparison that opens with twenty identical rows
  // buries the thing the reader opened it for.
  rows.sort((x, y) => {
    const diff = (r: ComparisonRow) => (r.betterFor === "same" ? 1 : 0);
    return diff(x) - diff(y) || x.title.localeCompare(y.title);
  });

  return { a: a.side, b: b.side, rows, summary: summarise(a.side, b.side, rows) };
}

function noteFor(
  inA: boolean,
  inB: boolean,
  fa: ClauseFinding | null,
  fb: ClauseFinding | null,
  isProtection: boolean,
  betterFor: ComparisonRow["betterFor"]
): string {
  // Presence can differ without either side being better off — a document
  // with no lock-in or escalation clause is not worse for having none. Say
  // so, rather than leaving a note that implies a difference the verdict
  // column contradicts.
  const neutral =
    betterFor === "same"
      ? " Neither side is better off for it."
      : "";

  if (inA && !inB) {
    return isProtection
      ? "Only the first document contains this protection."
      : `Only the first document addresses this.${neutral}`;
  }
  if (!inA && inB) {
    return isProtection
      ? "Only the second document contains this protection."
      : `Only the second document addresses this.${neutral}`;
  }
  if (fa && fb && fa.verdict !== fb.verdict) {
    return `First: ${fa.verdict.toLowerCase().replace(/_/g, " ")}. Second: ${fb.verdict
      .toLowerCase()
      .replace(/_/g, " ")}.`;
  }
  if (!inA && !inB && isProtection) return "Neither document contains this protection.";
  return "Both documents treat this comparably.";
}

function summarise(a: Side, b: Side, rows: ComparisonRow[]): string {
  const forA = rows.filter((r) => r.betterFor === "a").length;
  const forB = rows.filter((r) => r.betterFor === "b").length;
  const same = rows.length - forA - forB;

  const lead =
    a.riskScore === b.riskScore
      ? `Both documents score ${a.riskScore}/100 for risk.`
      : a.riskScore < b.riskScore
        ? `The first document carries less risk (${a.riskScore}/100 against ${b.riskScore}/100).`
        : `The second document carries less risk (${b.riskScore}/100 against ${a.riskScore}/100).`;

  return `${lead} On a topic-by-topic reading, ${forA} term(s) favour the first document, ${forB} favour the second, and ${same} are comparable. This compares the two documents against each other and against the protections a document of this kind should contain — it does not tell you which to sign.`;
}
