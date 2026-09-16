"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/components/AuthProvider";

type Result = {
  id: string;
  title: string;
  citation: string | null;
  year: string;
  court: string;
  caseNumber: string | null;
};

export default function JudgmentsPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [court, setCourt] = useState("");
  const [year, setYear] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [facets, setFacets] = useState<{ courts: string[]; years: string[] }>({
    courts: [],
    years: [],
  });
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/judgments?facets=1");
      if (res.ok) setFacets(await res.json());
    })();
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() && !court && !year && !caseNumber.trim()) return;
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (court) params.set("court", court);
      if (year) params.set("year", year);
      if (caseNumber.trim()) params.set("caseNumber", caseNumber.trim());

      const idToken = await token();
      const res = await fetch(`/api/judgments?${params}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQuery("");
    setCourt("");
    setYear("");
    setCaseNumber("");
    setResults(null);
  }

  const hasFilters = !!(court || year || caseNumber.trim());

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="font-display text-3xl font-medium text-ink">
          Judgments, in plain English
        </h1>
        <p className="prose-document mt-4 text-ink-soft">
          A judgment is written for lawyers, by lawyers, and it can run to a hundred
          pages before it says who won. Kavach sets out what the court was asked, what it
          decided, and why — with every line traceable to the paragraph of the original
          it came from, and readable in your own language.
        </p>
        <p className="prose-document mt-4 text-ink-soft">
          It will not tell you how your own case would go. No judgment decides a case it
          did not hear.
        </p>

        <form onSubmit={search} className="mt-8 space-y-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Subject or party — non-compete, arbitrator, tenancy"
              className="flex-1 border border-rule bg-paper-raised px-3 py-2.5 font-sans text-ink placeholder:text-ink-faint focus:border-attest focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="bg-ink px-5 py-2.5 font-sans font-medium text-paper disabled:opacity-40"
            >
              {busy ? "Searching…" : "Search"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={court}
              onChange={(e) => setCourt(e.target.value)}
              aria-label="Court"
              className="border border-rule bg-paper-raised px-3 py-2 font-sans text-sm text-ink focus:border-attest focus:outline-none"
            >
              <option value="">Any court</option>
              {facets.courts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              aria-label="Year"
              className="border border-rule bg-paper-raised px-3 py-2 font-sans text-sm text-ink focus:border-attest focus:outline-none"
            >
              <option value="">Any year</option>
              {facets.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <input
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="Case number"
              aria-label="Case number"
              className="border border-rule bg-paper-raised px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus:border-attest focus:outline-none"
            />
          </div>

          {(hasFilters || results) && (
            <button
              type="button"
              onClick={reset}
              className="font-sans text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline"
            >
              Clear search and filters
            </button>
          )}
        </form>

        {results !== null && (
          <div className="mt-10">
            {results.length === 0 ? (
              <p className="prose-document text-ink-soft">
                Nothing in the ingested corpus matches that. The corpus is a curated
                subset, so this means Kavach does not hold the case — not that no such
                case exists.
              </p>
            ) : (
              <>
                <p className="font-sans text-sm text-ink-faint">
                  {results.length} judgment{results.length === 1 ? "" : "s"}
                </p>
                <ul className="mt-3 divide-y divide-rule border-y border-rule">
                  {results.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/judgments/${r.id}`}
                        className="block py-4 transition-colors hover:bg-paper-raised"
                      >
                        <p className="font-display text-lg text-ink">{r.title}</p>
                        <p className="mt-1 font-sans text-sm text-ink-faint numeral-tabular">
                          {r.court} · {r.year}
                          {r.citation ? ` · ${r.citation}` : ""}
                        </p>
                        {r.caseNumber && (
                          <p className="font-sans text-xs text-ink-faint">
                            {r.caseNumber}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
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
