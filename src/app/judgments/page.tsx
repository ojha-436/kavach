"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

type Result = {
  id: string;
  title: string;
  citation: string | null;
  year: string;
};

export default function JudgmentsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/judgments?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="font-display text-3xl font-medium text-ink">
          Supreme Court judgments, in plain English
        </h1>
        <p className="prose-document mt-4 text-ink-soft">
          A judgment is written for lawyers, by lawyers, and it can run to a hundred pages
          before it says who won. Kavach sets out what the court was asked, what it
          decided, and why — with every single line traceable to the paragraph of the
          original it came from.
        </p>
        <p className="prose-document mt-4 text-ink-soft">
          It will not tell you how your own case would go. No judgment decides a case it
          did not hear.
        </p>

        <form onSubmit={search} className="mt-8 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by subject or party — non-compete, arbitrator, tenancy"
            className="flex-1 border border-rule bg-paper-raised px-3 py-2.5 font-sans text-ink placeholder:text-ink-faint focus:border-attest focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-ink px-4 py-2.5 font-sans font-medium text-paper disabled:opacity-40"
          >
            Search
          </button>
        </form>

        {results !== null && (
          <div className="mt-10">
            {results.length === 0 ? (
              <p className="prose-document text-ink-soft">
                Nothing in the ingested corpus matches that. The corpus is a curated subset
                of Supreme Court judgments, so this means Kavach does not hold the case —
                not that no such case exists.
              </p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {results.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/judgments/${r.id}`}
                      className="block py-4 transition-colors hover:bg-paper-raised"
                    >
                      <p className="font-display text-lg text-ink">{r.title}</p>
                      <p className="mt-1 font-sans text-sm text-ink-faint numeral-tabular">
                        {r.citation ? `${r.citation} · ` : ""}
                        {r.year}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="mt-16 border-t border-rule pt-6 font-sans text-xs text-ink-faint">
          Judgment texts come from the AWS Open Data mirror of eCourts (CC-BY-4.0).
          Reproducing the text of a judgment is not an infringement of copyright under
          s.52(1)(q) of the Copyright Act, 1957. Kavach ingests the judgment body only,
          never law-report headnotes.
        </p>
      </main>
    </>
  );
}
