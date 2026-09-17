"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const { authedFetch } = useAuth();
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/judgments?facets=1");
      if (res.ok) setFacets(await res.json());
    })();
  }, []);

  const runSearch = useCallback(
    async (filters: {
      q: string;
      court: string;
      year: string;
      caseNumber: string;
    }) => {
      if (!filters.q && !filters.court && !filters.year && !filters.caseNumber) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.court) params.set("court", filters.court);
        if (filters.year) params.set("year", filters.year);
        if (filters.caseNumber) params.set("caseNumber", filters.caseNumber);

        const res = await authedFetch(`/api/judgments?${params}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setError("Couldn't reach the judgment search. Please try again.");
        setResults([]);
      } finally {
        setBusy(false);
      }
    },
    [authedFetch]
  );

  /**
   * Replays a search arrived at from history, e.g.
   * /judgments?q=insolvency&court=Supreme%20Court%20of%20India.
   *
   * Split from the submit handler rather than faking a form submission: the
   * search is a function of its filters, and tying it to an event meant the
   * only way to run one was for a human to press the button.
   */
  const replayed = useRef(false);

  useEffect(() => {
    if (replayed.current) return;
    const params = new URLSearchParams(window.location.search);
    const restored = {
      q: params.get("q") ?? "",
      court: params.get("court") ?? "",
      year: params.get("year") ?? "",
      caseNumber: params.get("caseNumber") ?? "",
    };
    if (!Object.values(restored).some(Boolean)) return;
    replayed.current = true;

    // Put the filters back in the controls too, so the reopened search is
    // something the reader can see and adjust, not just a result list that
    // appeared from nowhere.
    setQuery(restored.q);
    setCourt(restored.court);
    setYear(restored.year);
    setCaseNumber(restored.caseNumber);
    void runSearch(restored);
  }, [runSearch]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    void runSearch({
      q: query.trim(),
      court,
      year,
      caseNumber: caseNumber.trim(),
    });
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
      <main id="main" className="mx-auto max-w-3xl px-5 py-14">
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
              aria-label="Search judgments by subject or party"
              placeholder="Subject or party — non-compete, arbitrator, tenancy"
              className="flex-1 border border-rule bg-paper-raised px-3 py-2.5 font-sans text-ink placeholder:text-ink-faint focus:border-attest"
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
              className="border border-rule bg-paper-raised px-3 py-2 font-sans text-sm text-ink focus:border-attest"
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
              className="border border-rule bg-paper-raised px-3 py-2 font-sans text-sm text-ink focus:border-attest"
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
              className="border border-rule bg-paper-raised px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus:border-attest"
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

        {error && (
          <p role="alert" className="mt-6 border border-seal bg-seal-wash px-4 py-3 font-sans text-sm text-seal">
            {error}
          </p>
        )}

        {results !== null && (
          <div aria-live="polite" className="mt-10">
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
