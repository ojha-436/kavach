import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-24">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-white/50">
          Kavach · कवच
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Know what&apos;s void before you sign.
        </h1>
      </div>

      <p className="max-w-xl text-lg text-white/70">
        Clause-level analysis of Indian rental agreements and employment
        offer letters. Every verdict cites a statute — Section 27 of the
        Indian Contract Act, the Model Tenancy Act, the Indian Stamp Act —
        and links back to the exact line in your document.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 p-5">
          <p className="text-sm font-medium text-[var(--void)]">
            What can&apos;t be used against you
          </p>
          <p className="mt-1 text-sm text-white/60">
            Void and partly-unenforceable clauses, cited, span-highlighted.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 p-5">
          <p className="text-sm font-medium text-[var(--accent)]">
            What protection you&apos;re missing
          </p>
          <p className="mt-1 text-sm text-white/60">
            The clauses that should be in your contract and aren&apos;t.
          </p>
        </div>
      </div>

      <Link
        href="/analyze"
        className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Upload a document
      </Link>

      <p className="text-xs text-white/40">
        Legal information, not legal advice. Two document types, India only.
        Analyses are deleted after 24 hours.
      </p>
    </main>
  );
}
