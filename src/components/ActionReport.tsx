"use client";

import { useState } from "react";

type ChecklistItem = {
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

const PRIORITY_TONE: Record<ChecklistItem["priority"], string> = {
  high: "text-seal",
  medium: "text-caution",
  low: "text-ink-faint",
};

const PRIORITY_LABEL: Record<ChecklistItem["priority"], string> = {
  high: "Do first",
  medium: "Worth asking",
  low: "Optional",
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      onClick={copy}
      className="border border-rule px-3 py-1.5 font-sans text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function ActionReport({ synthesis }: { synthesis: Synthesis }) {
  const { summary, checklist, negotiationEmail, lawyerQuestions } = synthesis;

  const checklistText = checklist
    .map(
      (i, n) =>
        `${n + 1}. [${PRIORITY_LABEL[i.priority]}] ${i.action}\n   Why: ${i.because}${
          i.source ? `\n   Basis: ${i.source}` : ""
        }`
    )
    .join("\n\n");

  return (
    <section className="border-t border-rule pt-8">
      <h2 className="font-display text-2xl font-medium text-ink">
        What to do about it
      </h2>

      {summary && <p className="prose-document mt-3 text-ink-soft">{summary}</p>}

      {checklist.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="font-sans text-xs font-semibold tracking-wide text-ink-faint">
              Your checklist before signing
            </h3>
            <CopyButton text={checklistText} label="Copy checklist" />
          </div>

          <ol className="mt-4 space-y-4">
            {checklist.map((item, i) => (
              <li key={i} className="border-l-2 border-rule pl-4">
                <p
                  className={`font-sans text-xs font-semibold tracking-wide ${PRIORITY_TONE[item.priority]}`}
                >
                  {PRIORITY_LABEL[item.priority]}
                </p>
                <p className="prose-document mt-1 text-ink">{item.action}</p>
                <p className="mt-1 font-sans text-sm text-ink-soft">{item.because}</p>
                {item.source && (
                  <p className="mt-0.5 font-sans text-xs text-attest">{item.source}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {negotiationEmail && (
        <div className="mt-10">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="font-sans text-xs font-semibold tracking-wide text-ink-faint">
              Draft email to the other party
            </h3>
            <CopyButton text={negotiationEmail} label="Copy email" />
          </div>
          <pre className="prose-document mt-3 whitespace-pre-wrap border border-rule bg-paper-raised px-5 py-4 text-ink">
            {negotiationEmail}
          </pre>
        </div>
      )}

      {lawyerQuestions.length > 0 && (
        <div className="mt-10">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="font-sans text-xs font-semibold tracking-wide text-seal">
              Questions to put to a lawyer
            </h3>
            <CopyButton
              text={lawyerQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}
              label="Copy questions"
            />
          </div>
          <p className="prose-document mt-2 text-ink-soft">
            These turn on facts outside the document, so Kavach cannot answer them.
          </p>
          <ul className="mt-3 space-y-2">
            {lawyerQuestions.map((q, i) => (
              <li key={i} className="prose-document border-l-2 border-seal pl-4 text-ink">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
