import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5">
        {/* The hero is the artifact itself: a real clause, with the verdict
            landing on it. The product's whole claim in one object. */}
        <section className="grid gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:py-24">
          <figure className="relative border border-rule bg-paper-raised p-7 sm:p-9">
            <figcaption className="mb-5 font-sans text-xs text-ink-faint">
              Offer letter, Bengaluru, 2026
            </figcaption>

            <p className="prose-document text-ink">
              <span className="font-semibold">14. Non-Competition.</span> The Employee shall
              not, for a period of twenty-four (24) months following cessation of
              employment, directly or indirectly engage with, consult for, or be employed
              by any business which competes with the Company within the territory of
              India.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-rule pt-6">
              <span className="verdict-stamp text-seal">Void</span>
              <span className="font-display text-[0.95rem] text-ink-soft">
                Section 27, Indian Contract Act, 1872
              </span>
            </div>
          </figure>

          <div>
            <h1 className="font-display text-4xl leading-[1.15] font-medium text-ink sm:text-5xl">
              This clause has been unenforceable since 1872.
            </h1>
            <p className="prose-document mt-6 text-ink-soft">
              Every candidate who signs it believes they cannot join a competitor for two
              years. A great many Indian contracts are built on clauses that could never
              be enforced — and the person signing is almost never the person who knows
              that.
            </p>
            <p className="prose-document mt-4 text-ink-soft">
              Kavach reads your rental agreement or offer letter clause by clause, tells
              you which terms cannot legally be used against you, and shows you the
              statute that says so.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                href="/analyze"
                className="bg-ink px-5 py-3 font-medium text-paper transition-opacity hover:opacity-88"
              >
                Read my document
              </Link>
              <Link
                href="/judgments"
                className="border-b border-ink pb-0.5 text-ink transition-colors hover:border-attest hover:text-attest"
              >
                Or explain a Supreme Court judgment
              </Link>
            </div>
          </div>
        </section>

        {/* Two claims, deliberately given different visual weight rather than
            matching cards - the absence diff is the harder and rarer one. */}
        <section className="border-t border-rule py-16">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="font-display text-2xl font-medium text-ink">
                What cannot be used against you
              </h2>
              <p className="prose-document mt-3 text-ink-soft">
                Each clause is matched against a hand-curated pack of Indian statutory
                rules through a deterministic lookup — not a similarity search. So every
                verdict carries a real section number, and clicking it highlights the
                exact words in your document.
              </p>
              <dl className="mt-6 space-y-3 font-sans text-sm">
                <Row verdict="Void" tone="text-seal" rule="S.27 — restraint of trade" />
                <Row
                  verdict="Partly unenforceable"
                  tone="text-caution"
                  rule="S.74 — penalty beyond actual loss"
                />
                <Row
                  verdict="Inadmissible"
                  tone="text-brass"
                  rule="S.35 Stamp Act — unstamped agreement"
                />
              </dl>
            </div>

            <div>
              <h2 className="font-display text-2xl font-medium text-ink">
                What protection you do not have
              </h2>
              <p className="prose-document mt-3 text-ink-soft">
                The harder question, and the one a chat-with-your-PDF tool structurally
                cannot answer: not what is in your contract, but what is missing from it.
                No notice before the landlord enters. No cap on rent escalation. No
                deadline for returning your deposit.
              </p>
              <p className="prose-document mt-4 text-ink-soft">
                An absence is invisible to anything that only reads what is there.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-rule py-16">
          <h2 className="font-display text-2xl font-medium text-ink">
            And when it does not know, it says so
          </h2>
          <p className="prose-document mt-3 text-ink-soft">
            The assistant has no legal knowledge it is allowed to use. Everything it tells
            you comes from a statutory rule it looked up, a clause in your own document, or
            a judgment it can cite by paragraph. When your question turns on facts outside
            the document, it stops and hands you the precise question to put to a lawyer.
          </p>
          <p className="prose-document mt-4 text-ink-soft">
            That is the line between legal information and legal advice, and it is built
            into the output format rather than printed in a footer.
          </p>
        </section>

        <footer className="border-t border-rule py-10 font-sans text-sm text-ink-faint">
          <p className="max-w-2xl">
            Kavach provides legal information, not legal advice, and is not a substitute
            for a lawyer. It covers Indian residential rental agreements and employment
            offer letters only. Documents are processed and stored in{" "}
            <span className="text-ink-soft">asia-south1 (Mumbai)</span>. Anonymous analyses
            are deleted automatically after 24 hours; signed-in users keep their documents
            until they delete them.
          </p>
        </footer>
      </main>
    </>
  );
}

function Row({
  verdict,
  tone,
  rule,
}: {
  verdict: string;
  tone: string;
  rule: string;
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-rule pb-3">
      <dt className={`w-44 shrink-0 font-medium ${tone}`}>{verdict}</dt>
      <dd className="text-ink-soft">{rule}</dd>
    </div>
  );
}
