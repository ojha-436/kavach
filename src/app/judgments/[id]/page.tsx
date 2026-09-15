"use client";

import { use, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";

type Paragraph = { index: number; text: string };
type Point = { text: string; paragraphs: number[] };

type Explanation = {
  issue: Point[];
  held: Point[];
  reasoning: Point[];
  outcome: Point[];
  doesNotDecide: string[];
};

type Payload = {
  judgment: { id: string; title: string; citation: string | null; year: string };
  paragraphs: Paragraph[];
  explanation?: Explanation;
  droppedClaims?: number;
  truncated?: boolean;
  error?: string;
};

const SECTIONS: Array<{ key: keyof Explanation; title: string; note?: string }> = [
  { key: "issue", title: "What the court was asked" },
  { key: "held", title: "What it decided" },
  { key: "reasoning", title: "Why" },
  { key: "outcome", title: "What actually happened" },
];

export default function JudgmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const paraRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/judgments/${id}?explain=1`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(json.error ?? "Could not load this judgment.");
        else setData(json);
      } catch {
        if (!cancelled) setError("Could not load this judgment.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function goToParagraph(n: number) {
    setActive(n);
    paraRefs.current[n]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (error) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-20">
          <p className="prose-document text-ink-soft">{error}</p>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-20">
          <p className="font-sans text-ink-faint">
            Reading the judgment and checking every claim against it…
          </p>
        </main>
      </>
    );
  }

  const { judgment, paragraphs, explanation, droppedClaims } = data;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <header className="border-b border-rule pb-6">
          <h1 className="font-display text-3xl font-medium text-ink">{judgment.title}</h1>
          <p className="mt-2 font-sans text-sm text-ink-faint numeral-tabular">
            Supreme Court of India
            {judgment.citation ? ` · ${judgment.citation}` : ""} · {judgment.year} ·{" "}
            {paragraphs.length} paragraphs
          </p>
        </header>

        <div className="grid gap-12 py-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
          {/* Explanation: every claim carries the paragraph it came from. */}
          <div>
            {explanation ? (
              <>
                {SECTIONS.map(({ key, title }) => {
                  const points = explanation[key] as Point[];
                  if (!points?.length) return null;
                  return (
                    <section key={key} className="mb-9">
                      <h2 className="font-sans text-xs font-semibold tracking-wide text-ink-faint">
                        {title}
                      </h2>
                      <ul className="mt-3 space-y-4">
                        {points.map((p, i) => (
                          <li key={i}>
                            <p className="prose-document text-ink">{p.text}</p>
                            <p className="mt-1.5 flex flex-wrap gap-1.5 font-sans text-xs">
                              {p.paragraphs.map((n) => (
                                <button
                                  key={n}
                                  onClick={() => goToParagraph(n)}
                                  className="border border-attest px-1.5 py-0.5 text-attest transition-colors hover:bg-attest hover:text-paper numeral-tabular"
                                >
                                  ¶{n}
                                </button>
                              ))}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}

                {explanation.doesNotDecide.length > 0 && (
                  <section className="border-t border-rule pt-6">
                    <h2 className="font-sans text-xs font-semibold tracking-wide text-seal">
                      What this judgment does not decide
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {explanation.doesNotDecide.map((s, i) => (
                        <li key={i} className="prose-document text-ink-soft">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <p className="mt-8 border-t border-rule pt-5 font-sans text-xs text-ink-faint">
                  Every statement above cites the paragraph it was drawn from, and those
                  citations were checked against this judgment&apos;s text after they were
                  written.
                  {typeof droppedClaims === "number" && droppedClaims > 0
                    ? ` ${droppedClaims} statement${droppedClaims === 1 ? "" : "s"} failed that check and ${droppedClaims === 1 ? "was" : "were"} removed before you saw ${droppedClaims === 1 ? "it" : "them"}.`
                    : " No statements failed that check."}{" "}
                  Kavach explains this judgment only. It does not predict any other case.
                </p>
              </>
            ) : (
              <p className="prose-document text-ink-soft">
                No grounded explanation could be produced for this judgment.
              </p>
            )}
          </div>

          {/* The judgment itself, so a reader can verify any claim in place. */}
          <div className="lg:max-h-[75vh] lg:overflow-y-auto lg:border-l lg:border-rule lg:pl-10">
            {paragraphs.map((p) => (
              <div
                key={p.index}
                ref={(el) => {
                  paraRefs.current[p.index] = el;
                }}
                className={`mb-5 border-l-2 pl-4 transition-colors ${
                  active === p.index
                    ? "border-attest bg-attest-wash"
                    : "border-transparent"
                }`}
              >
                <p className="font-sans text-xs text-ink-faint numeral-tabular">
                  ¶{p.index}
                </p>
                <p className="prose-document mt-1 text-ink-soft">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
