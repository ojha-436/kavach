import { synthesize as callModel } from "./llm";
import {
  ClauseFinding,
  Clause,
  DocumentKind,
  ExpectedProtection,
} from "./schema";

/**
 * Stage 6, synthesis (Architecture SS4.2).
 *
 * Turns ~20 validated verdicts into the things a person can actually act on:
 * a summary, a checklist, and a negotiation email.
 *
 * The checklist is assembled deterministically from the `negotiationAsk`
 * fields already carried by validated findings and curated protections — it
 * is a projection of checked data, not a generation, so it cannot invent an
 * action or cite a statute that was never established. Only the prose (the
 * summary and the email) goes through the model, and it is given the asks
 * rather than the raw document.
 */

export type ChecklistItem = {
  priority: "high" | "medium" | "low";
  action: string;
  because: string;
  source: string | null;
};

export type Synthesis = {
  summary: string;
  checklist: ChecklistItem[];
  negotiationEmail: string;
  lawyerQuestions: string[];
};

const PRIORITY: Record<string, ChecklistItem["priority"]> = {
  VOID: "high",
  UNENFORCEABLE_IN_PART: "high",
  ONEROUS_BUT_VALID: "medium",
  STANDARD: "low",
  FAVOURABLE: "low",
};

const ORDER: Record<ChecklistItem["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Deterministic: every item traces to a validated finding or curated protection. */
export function buildChecklist(
  findings: ClauseFinding[],
  clauses: Clause[],
  missing: ExpectedProtection[]
): ChecklistItem[] {
  const headingFor = new Map(clauses.map((c) => [c.id, c.heading]));
  const items: ChecklistItem[] = [];

  for (const f of findings) {
    if (!f.negotiationAsk) continue;
    const cite = f.statutoryBasis[0];
    items.push({
      priority: PRIORITY[f.verdict] ?? "low",
      action: f.negotiationAsk,
      because: `${headingFor.get(f.clauseId) ?? "A clause"}: ${f.plainEnglish}`,
      source: cite ? `${cite.statute} — ${cite.section}` : null,
    });
  }

  for (const p of missing) {
    items.push({
      priority: "medium",
      action: p.negotiationAsk,
      because: `${p.title}. ${p.absenceMeans}`,
      source: null,
    });
  }

  return items.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
}

/** Also deterministic: the questions were produced during adjudication. */
export function collectLawyerQuestions(findings: ClauseFinding[]): string[] {
  return [
    ...new Set(
      findings
        .filter((f) => f.needsLawyer && f.lawyerQuestion)
        .map((f) => f.lawyerQuestion as string)
    ),
  ];
}

const SYSTEM = `You write for someone who is about to sign an Indian contract and is not a lawyer.

You are given verdicts that have ALREADY been checked against statute, and the exact changes to
ask for. Your job is presentation, not analysis.

RULES:
- Use only what you are given. Do not add legal conclusions, statutes, sections or risks that are
  not in the input. You are not permitted to reason about the law yourself.
- Do not overstate. If nothing is void, do not imply the contract is dangerous.
- Do not tell the reader whether to sign. That is their decision and a lawyer's advice.

summary: 3-4 sentences. What kind of document this is, what the most serious issues are, and what
is missing. Plain words, no legalese, no drama.

negotiationEmail: a short, polite, professional email to the other party asking for the changes.
Indian business register — courteous and direct, not adversarial or apologetic. Reference the
specific clauses. Do not cite statutes in the email; asking plainly works better than quoting law
at someone. End with a neutral sign-off placeholder like [Your name]. No subject line preamble
beyond a single "Subject:" line.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    negotiationEmail: { type: "STRING" },
  },
  required: ["summary", "negotiationEmail"],
};

export async function synthesizeReport(params: {
  kind: DocumentKind;
  findings: ClauseFinding[];
  clauses: Clause[];
  missing: ExpectedProtection[];
  riskScore: number;
}): Promise<Synthesis> {
  const checklist = buildChecklist(params.findings, params.clauses, params.missing);
  const lawyerQuestions = collectLawyerQuestions(params.findings);

  const headingFor = new Map(params.clauses.map((c) => [c.id, c.heading]));
  const brief = {
    documentType: params.kind.label,
    state: params.kind.state,
    readerIs: params.kind.userSide,
    riskScore: params.riskScore,
    findings: params.findings
      .filter((f) => f.verdict !== "STANDARD")
      .map((f) => ({
        clause: headingFor.get(f.clauseId) ?? f.clauseId,
        verdict: f.verdict,
        plainEnglish: f.plainEnglish,
        ask: f.negotiationAsk,
      })),
    missingProtections: params.missing.map((m) => ({
      title: m.title,
      ask: m.negotiationAsk,
    })),
  };

  try {
    const raw = await callModel({
      systemInstruction: SYSTEM,
      prompt: JSON.stringify(brief),
      responseSchema: RESPONSE_SCHEMA,
    });
    const parsed = JSON.parse(raw) as {
      summary?: string;
      negotiationEmail?: string;
    };
    return {
      summary: parsed.summary ?? fallbackSummary(params),
      negotiationEmail: parsed.negotiationEmail ?? "",
      checklist,
      lawyerQuestions,
    };
  } catch {
    // The checklist is the load-bearing output and needs no model, so a
    // failed prose pass degrades rather than losing the whole report.
    return {
      summary: fallbackSummary(params),
      negotiationEmail: "",
      checklist,
      lawyerQuestions,
    };
  }
}

function fallbackSummary(params: {
  kind: DocumentKind;
  findings: ClauseFinding[];
  missing: ExpectedProtection[];
}): string {
  const counts = params.findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.verdict] = (acc[f.verdict] ?? 0) + 1;
    return acc;
  }, {});
  const bits: string[] = [];
  if (counts.VOID) bits.push(`${counts.VOID} clause(s) that cannot be enforced against you`);
  if (counts.UNENFORCEABLE_IN_PART)
    bits.push(`${counts.UNENFORCEABLE_IN_PART} enforceable only in part`);
  if (counts.ONEROUS_BUT_VALID)
    bits.push(`${counts.ONEROUS_BUT_VALID} lawful but one-sided`);

  return `This is a ${params.kind.label.toLowerCase()}. ${
    bits.length ? `It contains ${bits.join(", ")}.` : "No issues were flagged against the rule pack."
  } ${params.missing.length} protection(s) that would normally appear are absent.`;
}
