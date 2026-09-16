"use client";

import { useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/components/AuthProvider";

type Slot = "a" | "b";

type SlotState = {
  fileName: string;
  analysisId: string;
  label: string;
  status: "uploading" | "analysing" | "ready" | "error";
  detail: string;
};

type Row = {
  clauseType: string;
  title: string;
  absenceMeans: string | null;
  a: { present: boolean; verdict: string | null; heading: string | null };
  b: { present: boolean; verdict: string | null; heading: string | null };
  betterFor: "a" | "b" | "same";
  note: string;
};

type Comparison = {
  a: { label: string; fileName: string; riskScore: number; clauseCount: number };
  b: { label: string; fileName: string; riskScore: number; clauseCount: number };
  rows: Row[];
  summary: string;
};

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const VERDICT_LABEL: Record<string, string> = {
  VOID: "Void",
  UNENFORCEABLE_IN_PART: "Partly unenforceable",
  ONEROUS_BUT_VALID: "One-sided",
  STANDARD: "Standard",
  FAVOURABLE: "In your favour",
};

const VERDICT_TONE: Record<string, string> = {
  VOID: "text-seal",
  UNENFORCEABLE_IN_PART: "text-caution",
  ONEROUS_BUT_VALID: "text-brass",
  STANDARD: "text-ink-soft",
  FAVOURABLE: "text-favour",
};

export default function ComparePage() {
  const { token } = useAuth();
  const [slots, setSlots] = useState<Partial<Record<Slot, SlotState>>>({});
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<Slot, HTMLInputElement | null>>({ a: null, b: null });

  async function handleFile(slot: Slot, file: File) {
    setError(null);
    setComparison(null);

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      setError("Kavach reads .pdf and .docx files.");
      return;
    }

    const set = (patch: Partial<SlotState>) =>
      setSlots((s) => ({
        ...s,
        [slot]: { ...(s[slot] as SlotState), ...patch } as SlotState,
      }));

    setSlots((s) => ({
      ...s,
      [slot]: {
        fileName: file.name,
        analysisId: "",
        label: "",
        status: "uploading",
        detail: "Uploading…",
      },
    }));

    try {
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType }),
      });
      if (!urlRes.ok) throw new Error((await urlRes.json()).error ?? "Upload failed");
      const { uploadUrl, gcsUri } = await urlRes.json();

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed");

      set({ status: "analysing", detail: "Reading the document…" });
      const idToken = await token();
      const auth: Record<string, string> = idToken
        ? { Authorization: `Bearer ${idToken}` }
        : {};

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ gcsUri, fileName: file.name, contentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      set({
        analysisId: data.id,
        label: data.kind?.label ?? "Document",
        detail: "Checking clauses against the statute…",
      });

      if (data.covered) {
        await fetch(`/api/analyses/${data.id}/adjudicate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...auth },
          body: "{}",
        });
      }
      set({ status: "ready", detail: data.covered ? "Ready" : "Outside the rule pack" });
    } catch (err) {
      set({
        status: "error",
        detail: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  async function compare() {
    if (!slots.a?.analysisId || !slots.b?.analysisId) return;
    setComparing(true);
    setError(null);
    try {
      const idToken = await token();
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ a: slots.a.analysisId, b: slots.b.analysisId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Comparison failed");
      setComparison(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setComparing(false);
    }
  }

  const bothReady = slots.a?.status === "ready" && slots.b?.status === "ready";

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-5xl px-5 py-14 pb-20">
        <h1 className="font-display text-3xl font-medium text-ink">
          Compare two documents
        </h1>
        <p className="prose-document mt-4 text-ink-soft">
          Two offers, two tenancy agreements, or the same contract before and after their
          edits. Kavach reads both, then compares them topic by topic — and against the
          protections a document of this kind should contain.
        </p>
        <p className="prose-document mt-3 text-ink-soft">
          It will not tell you which to sign.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(["a", "b"] as const).map((slot) => {
            const s = slots[slot];
            return (
              <div key={slot}>
                <label
                  htmlFor={`upload-${slot}`}
                  className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-rule bg-paper-raised px-5 py-10 text-center transition-colors hover:border-attest"
                >
                  <input
                    id={`upload-${slot}`}
                    ref={(el) => {
                      inputs.current[slot] = el;
                    }}
                    type="file"
                    accept=".pdf,.docx"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(slot, f);
                    }}
                  />
                  <span className="font-sans text-xs text-ink-faint">
                    {slot === "a" ? "First document" : "Second document"}
                  </span>
                  <span className="mt-1 font-sans text-ink-soft">
                    {s ? s.fileName : "Choose a file"}
                  </span>
                </label>
                <p
                  role="status"
                  aria-live="polite"
                  className={`mt-2 font-sans text-xs ${
                    s?.status === "error" ? "text-seal" : "text-ink-faint"
                  }`}
                >
                  {s ? `${s.label ? s.label + " · " : ""}${s.detail}` : ""}
                </p>
              </div>
            );
          })}
        </div>

        <button
          onClick={compare}
          disabled={!bothReady || comparing}
          className="mt-6 bg-ink px-5 py-3 font-sans font-medium text-paper disabled:opacity-40"
        >
          {comparing ? "Comparing…" : "Compare"}
        </button>

        {error && (
          <p
            role="alert"
            className="mt-4 border border-seal bg-seal-wash px-4 py-3 font-sans text-sm text-seal"
          >
            {error}
          </p>
        )}

        {comparison && (
          <section aria-live="polite" className="mt-12">
            <p className="prose-document text-ink">{comparison.summary}</p>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Topic by topic comparison of the two documents
                </caption>
                <thead>
                  <tr className="border-y border-rule">
                    <th scope="col" className="py-3 pr-4 font-sans text-xs font-semibold tracking-wide text-ink-faint">
                      Topic
                    </th>
                    <th scope="col" className="py-3 pr-4 font-sans text-xs font-semibold tracking-wide text-ink-faint">
                      {comparison.a.fileName}
                    </th>
                    <th scope="col" className="py-3 pr-4 font-sans text-xs font-semibold tracking-wide text-ink-faint">
                      {comparison.b.fileName}
                    </th>
                    <th scope="col" className="py-3 font-sans text-xs font-semibold tracking-wide text-ink-faint">
                      Better for you
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((r) => (
                    <tr key={r.clauseType} className="border-b border-rule align-top">
                      <th scope="row" className="py-4 pr-4 font-display font-normal text-ink">
                        {r.title}
                        <span className="mt-1 block font-sans text-xs text-ink-faint">
                          {r.note}
                        </span>
                      </th>
                      <Cell side={r.a} />
                      <Cell side={r.b} />
                      <td className="py-4 font-sans text-sm">
                        {r.betterFor === "same" ? (
                          <span className="text-ink-faint">Comparable</span>
                        ) : (
                          <span className="text-favour">
                            {r.betterFor === "a" ? "First" : "Second"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function Cell({ side }: { side: Row["a"] }) {
  if (!side.present) {
    return (
      <td className="py-4 pr-4 font-sans text-sm text-ink-faint">Not addressed</td>
    );
  }
  return (
    <td className="py-4 pr-4 font-sans text-sm">
      <span className={VERDICT_TONE[side.verdict ?? "STANDARD"] ?? "text-ink-soft"}>
        {VERDICT_LABEL[side.verdict ?? "STANDARD"] ?? "Present"}
      </span>
      {side.heading && (
        <span className="mt-0.5 block text-xs text-ink-faint">{side.heading}</span>
      )}
    </td>
  );
}
