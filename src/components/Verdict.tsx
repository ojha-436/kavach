"use client";

import { ClauseFinding, ExpectedProtection } from "@/lib/schema";

export const VERDICT_LABEL: Record<string, string> = {
  VOID: "Void",
  UNENFORCEABLE_IN_PART: "Partly unenforceable",
  ONEROUS_BUT_VALID: "One-sided",
  STANDARD: "Standard",
  FAVOURABLE: "In your favour",
};

const TONE: Record<string, string> = {
  VOID: "text-seal",
  UNENFORCEABLE_IN_PART: "text-caution",
  ONEROUS_BUT_VALID: "text-brass",
  STANDARD: "text-ink-faint",
  FAVOURABLE: "text-favour",
};

const HIGHLIGHT: Record<string, string> = {
  VOID: "bg-seal-wash",
  UNENFORCEABLE_IN_PART: "bg-caution-wash",
  ONEROUS_BUT_VALID: "bg-brass-wash",
  STANDARD: "",
  FAVOURABLE: "bg-favour-wash",
};

export function verdictHighlight(verdict?: string | null): string {
  return verdict ? (HIGHLIGHT[verdict] ?? "") : "";
}

/** The one bold moment: a verdict landing on a clause like a court stamp. */
export function VerdictStamp({
  verdict,
  animate = false,
}: {
  verdict: string;
  animate?: boolean;
}) {
  return (
    <span
      className={`verdict-stamp ${TONE[verdict] ?? "text-ink-faint"}`}
      data-animate={animate ? "true" : undefined}
    >
      {VERDICT_LABEL[verdict] ?? verdict}
    </span>
  );
}

export function VerdictDot({ verdict }: { verdict?: string | null }) {
  if (!verdict) return null;
  return (
    <span className={`font-sans text-xs font-medium ${TONE[verdict] ?? "text-ink-faint"}`}>
      {VERDICT_LABEL[verdict] ?? verdict}
    </span>
  );
}

export function FindingCard({ finding }: { finding: ClauseFinding }) {
  return (
    <div className="border-l-2 border-rule pl-4">
      <VerdictStamp verdict={finding.verdict} animate />

      <p className="prose-document mt-4 text-ink">{finding.plainEnglish}</p>
      <p className="prose-document mt-3 text-ink-soft">{finding.whyItMatters}</p>

      {finding.statutoryBasis.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {finding.statutoryBasis.map((b) => (
            <li key={b.ruleId} className="font-sans text-sm">
              <span className="text-attest">{b.statute}</span>
              <span className="text-ink-soft"> — {b.section}</span>
              {b.authority && (
                <span className="block text-xs text-ink-faint">{b.authority}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {finding.negotiationAsk && (
        <div className="mt-4 border border-rule bg-paper-raised px-4 py-3">
          <p className="font-sans text-xs font-semibold tracking-wide text-ink-faint">
            What to ask for
          </p>
          <p className="prose-document mt-1 text-ink-soft">{finding.negotiationAsk}</p>
        </div>
      )}

      {finding.needsLawyer && finding.lawyerQuestion && (
        <div className="mt-3 border border-seal px-4 py-3">
          <p className="font-sans text-xs font-semibold tracking-wide text-seal">
            Ask a lawyer this
          </p>
          <p className="prose-document mt-1 text-ink-soft">{finding.lawyerQuestion}</p>
        </div>
      )}

      <p className="mt-3 font-sans text-xs text-ink-faint">
        Confidence: {finding.confidence.toLowerCase()}
      </p>
    </div>
  );
}

export function MissingProtections({
  protections,
}: {
  protections: ExpectedProtection[];
}) {
  if (protections.length === 0) return null;

  return (
    <section className="border-t border-rule pt-8">
      <h2 className="font-display text-2xl font-medium text-ink">
        What is missing from this document
      </h2>
      <p className="prose-document mt-2 text-ink-soft">
        Not what your contract says — what it doesn&apos;t. These are terms that would protect you
        and are absent. An absence is invisible to anything that only reads what is there.
      </p>

      <ul className="mt-6 space-y-6">
        {protections.map((p) => (
          <li key={p.clauseType} className="border-l-2 border-caution pl-4">
            <p className="font-display text-lg text-ink">{p.title}</p>
            <p className="prose-document mt-1 text-ink-soft">{p.absenceMeans}</p>
            <p className="prose-document mt-2 text-ink-soft">
              <span className="font-sans text-xs font-semibold tracking-wide text-ink-faint">
                Ask for:{" "}
              </span>
              {p.negotiationAsk}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RiskScore({
  score,
  counts,
}: {
  score: number;
  counts: Record<string, number>;
}) {
  const order = [
    "VOID",
    "UNENFORCEABLE_IN_PART",
    "ONEROUS_BUT_VALID",
    "FAVOURABLE",
    "STANDARD",
  ];
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
      <p className="font-sans text-sm text-ink-soft numeral-tabular">
        Risk score <span className="font-semibold text-ink">{score}</span>/100
      </p>
      {order
        .filter((v) => counts[v])
        .map((v) => (
          <p key={v} className={`font-sans text-sm ${TONE[v]} numeral-tabular`}>
            {counts[v]} {VERDICT_LABEL[v].toLowerCase()}
          </p>
        ))}
    </div>
  );
}
