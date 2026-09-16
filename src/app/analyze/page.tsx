"use client";

import { useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { AskPanel } from "@/components/AskPanel";
import { useAuth } from "@/components/AuthProvider";
import { Clause, DocumentKind } from "@/lib/schema";

type Status = "idle" | "uploading" | "working" | "ready" | "error";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function contentTypeFor(fileName: string): string | null {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[ext] ?? null;
}

export default function AnalyzePage() {
  const { user, token } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [statusDetail, setStatusDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [kind, setKind] = useState<DocumentKind | null>(null);
  const [covered, setCovered] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const clauseRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  async function handleFile(file: File) {
    setError(null);
    const contentType = contentTypeFor(file.name);
    if (!contentType) {
      setError("Kavach reads .pdf and .docx files.");
      setStatus("error");
      return;
    }

    try {
      setStatus("uploading");
      setStatusDetail("Preparing a secure upload…");
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType }),
      });
      if (!urlRes.ok) throw new Error((await urlRes.json()).error ?? "Upload failed");
      const { uploadUrl, gcsUri } = await urlRes.json();

      setStatusDetail("Uploading…");
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      setStatus("working");
      setStatusDetail("Identifying the document and splitting it into clauses…");
      const idToken = await token();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ gcsUri, fileName: file.name, contentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      setAnalysisId(data.id);
      setText(data.text);
      setClauses(data.clauses);
      setKind(data.kind);
      setCovered(data.covered);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  function select(id: string) {
    setSelectedId(id);
    clauseRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const segments = useMemo(() => {
    if (!text || clauses.length === 0) return [];
    const sorted = [...clauses].sort((a, b) => a.startOffset - b.startOffset);
    const parts: { key: string; clauseId: string | null; text: string }[] = [];
    let cursor = 0;
    for (const c of sorted) {
      if (c.startOffset > cursor) {
        parts.push({
          key: `gap-${cursor}`,
          clauseId: null,
          text: text.slice(cursor, c.startOffset),
        });
      }
      parts.push({
        key: c.id,
        clauseId: c.id,
        text: text.slice(c.startOffset, c.endOffset),
      });
      cursor = c.endOffset;
    }
    if (cursor < text.length) {
      parts.push({ key: `gap-${cursor}`, clauseId: null, text: text.slice(cursor) });
    }
    return parts;
  }, [text, clauses]);

  if (status === "ready") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-5 pb-20">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-rule py-4">
            <p className="font-display text-lg text-ink">{kind?.label}</p>
            <p className="font-sans text-sm text-ink-soft numeral-tabular">
              {clauses.length} clauses
              {kind?.state ? ` · ${kind.state}` : ""}
            </p>
            <button
              onClick={() => {
                setStatus("idle");
                setClauses([]);
                setText("");
                setSelectedId(null);
                setKind(null);
              }}
              className="ml-auto font-sans text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              New document
            </button>
          </div>

          {!covered && (
            <p className="mt-4 border border-caution bg-caution-wash px-4 py-3 font-sans text-sm text-caution">
              Kavach&apos;s statutory rule pack covers Indian residential rental
              agreements and employment offer letters. This looks like a{" "}
              {kind?.label.toLowerCase()}, so there are no curated rules to check it
              against. You can still read it clause by clause and ask questions about
              what it says — but the assistant will not tell you what the law provides
              about this document type, because we haven&apos;t verified those rules.
            </p>
          )}

          {!user && (
            <p className="mt-4 font-sans text-xs text-ink-faint">
              You&apos;re signed out, so this document is deleted within 24 hours and
              won&apos;t appear in your history.
            </p>
          )}

          <div className="grid gap-10 py-8 lg:grid-cols-[1fr_320px] lg:gap-12">
            <div className="prose-document whitespace-pre-wrap text-ink">
              {segments.map((seg) =>
                seg.clauseId ? (
                  <span
                    key={seg.key}
                    ref={(el) => {
                      clauseRefs.current[seg.clauseId!] = el;
                    }}
                    onClick={() => select(seg.clauseId!)}
                    className={`cursor-pointer transition-colors ${
                      selectedId === seg.clauseId
                        ? "bg-attest-wash"
                        : "hover:bg-paper-sunk"
                    }`}
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span key={seg.key} className="text-ink-faint">
                    {seg.text}
                  </span>
                )
              )}
            </div>

            <aside className="lg:max-h-[75vh] lg:overflow-y-auto lg:border-l lg:border-rule lg:pl-6">
              {clauses.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={`block w-full border-b border-rule py-3 text-left transition-colors ${
                    selectedId === c.id ? "bg-attest-wash" : "hover:bg-paper-raised"
                  }`}
                >
                  <p className="font-sans text-xs text-ink-faint numeral-tabular">
                    Clause {i + 1}
                    {c.page ? ` · page ${c.page}` : ""}
                  </p>
                  <p className="mt-0.5 font-display text-ink">
                    {c.heading ?? "Untitled clause"}
                  </p>
                </button>
              ))}
            </aside>
          </div>

          <AskPanel
            analysisId={analysisId ?? undefined}
            title="Ask about this document"
            blurb="Questions are answered from this document and, where the rule pack covers it, the statute behind it. You'll see which sources each answer used."
            suggestions={[
              "Summarise this document in plain English.",
              "Which clauses are one-sided against me?",
              "What should I ask a lawyer before signing this?",
            ]}
          />
        </main>
      </>
    );
  }

  const working = status === "uploading" || status === "working";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-3xl font-medium text-ink">Your document</h1>
        <p className="prose-document mt-4 text-ink-soft">
          Upload any Indian legal document as PDF or DOCX — a rental agreement, an offer
          letter, a loan agreement, a notice. Kavach works out what it is, splits it into
          clauses, and lets you ask questions about it.
        </p>
        <p className="prose-document mt-3 text-ink-soft">
          Processed in asia-south1. If you&apos;re not signed in, it&apos;s deleted within
          24 hours.
        </p>

        <label className="mt-8 flex cursor-pointer items-center justify-center border border-dashed border-rule bg-paper-raised px-6 py-16 text-center transition-colors hover:border-attest">
          <input
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            disabled={working}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <span className="font-sans text-ink-soft">
            {working ? statusDetail : "Choose a file"}
          </span>
        </label>

        {error && (
          <p className="mt-4 border border-seal bg-seal-wash px-4 py-3 font-sans text-sm text-seal">
            {error}
          </p>
        )}
      </main>
    </>
  );
}
