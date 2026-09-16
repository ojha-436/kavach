"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/components/AuthProvider";

type Entry = {
  id: string;
  kind: "upload" | "question" | "judgment_search" | "judgment_view";
  summary: string;
  detail: string | null;
  href: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<Entry["kind"], string> = {
  upload: "Document",
  question: "Question",
  judgment_search: "Search",
  judgment_view: "Judgment",
};

const KIND_TONE: Record<Entry["kind"], string> = {
  upload: "text-attest",
  question: "text-ink-soft",
  judgment_search: "text-ink-faint",
  judgment_view: "text-brass",
};

function dayOf(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function HistoryPage() {
  const { user, loading, signIn, authedFetch } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setEntries([]);
      return;
    }
    try {
      const res = await authedFetch("/api/history");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      // Without this the page sits on "Loading…" forever on a network blip.
      setEntries([]);
      setError("Couldn't load your history. Please refresh.");
    }
  }, [user, authedFetch]);

  useEffect(() => {
    if (!loading) void load();
  }, [loading, user, load]);

  async function clearAll() {
    setBusy(true);
    try {
      await authedFetch("/api/history", { method: "DELETE" });
      setEntries([]);
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !user) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-xl px-5 py-20">
          <h1 className="font-display text-3xl font-medium text-ink">History</h1>
          <p className="prose-document mt-4 text-ink-soft">
            History is kept for signed-in users only. While you&apos;re signed out
            Kavach doesn&apos;t record what you upload, ask, or search — keeping a trail
            for someone who never identified themselves would collect more than the
            product needs.
          </p>
          <button
            onClick={() => void signIn()}
            className="mt-6 bg-ink px-5 py-3 font-sans font-medium text-paper"
          >
            Sign in with Google
          </button>
        </main>
      </>
    );
  }

  const grouped: Array<[string, Entry[]]> = [];
  for (const e of entries ?? []) {
    const day = dayOf(e.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last[0] === day) last[1].push(e);
    else grouped.push([day, [e]]);
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-5 py-14">
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="font-display text-3xl font-medium text-ink">History</h1>
          {entries && entries.length > 0 && (
            <button
              onClick={clearAll}
              disabled={busy}
              className="ml-auto font-sans text-sm text-seal underline-offset-4 hover:underline disabled:opacity-50"
            >
              {busy ? "Clearing…" : "Delete all history"}
            </button>
          )}
        </div>

        <p className="prose-document mt-3 text-ink-soft">
          Documents you&apos;ve uploaded, questions you&apos;ve asked, and judgments
          you&apos;ve searched or read.
        </p>

        {error && (
          <p role="alert" className="mt-6 border border-seal bg-seal-wash px-4 py-3 font-sans text-sm text-seal">
            {error}
          </p>
        )}

        {entries === null ? (
          <p className="mt-10 font-sans text-ink-faint">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="mt-10 prose-document text-ink-soft">
            Nothing here yet. Upload a document or search a judgment and it will show up.
          </p>
        ) : (
          <div className="mt-10 space-y-10">
            {grouped.map(([day, items]) => (
              <section key={day}>
                <h2 className="font-sans text-xs font-semibold tracking-wide text-ink-faint">
                  {day}
                </h2>
                <ul className="mt-3 divide-y divide-rule border-y border-rule">
                  {items.map((e) => (
                    <li key={e.id}>
                      <Row entry={e} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Row({ entry }: { entry: Entry }) {
  const time = new Date(entry.createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const inner = (
    <div className="flex gap-4 py-3">
      <span
        className={`w-24 shrink-0 font-sans text-xs ${KIND_TONE[entry.kind]}`}
      >
        {KIND_LABEL[entry.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-ink">{entry.summary}</p>
        {entry.detail && (
          <p className="mt-0.5 font-sans text-xs text-ink-faint">{entry.detail}</p>
        )}
      </div>
      <span className="shrink-0 font-sans text-xs text-ink-faint numeral-tabular">
        {time}
      </span>
    </div>
  );

  return entry.href ? (
    <Link href={entry.href} className="block transition-colors hover:bg-paper-raised">
      {inner}
    </Link>
  ) : (
    inner
  );
}
