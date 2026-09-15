"use client";

import { useMemo, useRef, useState } from "react";
import { Clause, DocType } from "@/lib/schema";

type Status = "idle" | "uploading" | "segmenting" | "ready" | "error";

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
  const [status, setStatus] = useState<Status>("idle");
  const [statusDetail, setStatusDetail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>("rental");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [text, setText] = useState<string>("");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const clauseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function handleFile(file: File) {
    setError(null);
    const contentType = contentTypeFor(file.name);
    if (!contentType) {
      setError("Only .pdf and .docx files are supported.");
      setStatus("error");
      return;
    }

    try {
      setStatus("uploading");
      setStatusDetail("Requesting upload URL…");
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType }),
      });
      if (!urlRes.ok) throw new Error((await urlRes.json()).error ?? "Upload URL failed");
      const { uploadUrl, gcsUri } = await urlRes.json();

      setStatusDetail("Uploading document…");
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      setStatus("segmenting");
      setStatusDetail("Extracting text and splitting into clauses…");
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gcsUri,
          fileName: file.name,
          contentType,
          docTypeHint: docType,
        }),
      });
      const data = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(data.error ?? "Analysis failed");

      setAnalysisId(data.id);
      setText(data.text);
      setClauses(data.clauses);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  function selectClause(id: string) {
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
        parts.push({ key: `gap-${cursor}`, clauseId: null, text: text.slice(cursor, c.startOffset) });
      }
      parts.push({ key: c.id, clauseId: c.id, text: text.slice(c.startOffset, c.endOffset) });
      cursor = c.endOffset;
    }
    if (cursor < text.length) {
      parts.push({ key: `gap-${cursor}`, clauseId: null, text: text.slice(cursor) });
    }
    return parts;
  }, [text, clauses]);

  if (status === "ready") {
    return (
      <main className="flex h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
          <p className="text-sm text-white/60">
            KAVACH · {clauses.length} clauses · analysis <code className="text-white/40">{analysisId}</code>
          </p>
          <button
            className="text-sm text-white/50 hover:text-white"
            onClick={() => {
              setStatus("idle");
              setClauses([]);
              setText("");
              setSelectedId(null);
            }}
          >
            New document
          </button>
        </header>
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_360px]">
          <div className="overflow-y-auto whitespace-pre-wrap px-8 py-6 text-sm leading-relaxed text-white/80">
            {segments.map((seg) =>
              seg.clauseId ? (
                <span
                  key={seg.key}
                  ref={(el) => {
                    clauseRefs.current[seg.clauseId!] = el as unknown as HTMLDivElement;
                  }}
                  onClick={() => selectClause(seg.clauseId!)}
                  onMouseEnter={() => setHoveredId(seg.clauseId)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`cursor-pointer rounded px-0.5 transition-colors ${
                    selectedId === seg.clauseId
                      ? "bg-[var(--accent)]/40"
                      : hoveredId === seg.clauseId
                        ? "bg-white/10"
                        : ""
                  }`}
                >
                  {seg.text}
                </span>
              ) : (
                <span key={seg.key} className="text-white/30">
                  {seg.text}
                </span>
              )
            )}
          </div>
          <aside className="overflow-y-auto border-t border-white/10 md:border-l md:border-t-0">
            {clauses.map((c, i) => (
              <button
                key={c.id}
                onClick={() => selectClause(c.id)}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`block w-full border-b border-white/5 px-4 py-3 text-left text-sm transition-colors ${
                  selectedId === c.id ? "bg-[var(--accent)]/20" : hoveredId === c.id ? "bg-white/5" : ""
                }`}
              >
                <p className="text-xs text-white/40">
                  Clause {i + 1}
                  {c.page ? ` · p.${c.page}` : ""}
                </p>
                <p className="mt-0.5 font-medium text-white/90">
                  {c.heading ?? "Untitled clause"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{c.text}</p>
              </button>
            ))}
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-24">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-white/50">Kavach</p>
        <h1 className="mt-2 text-3xl font-semibold">Upload your document</h1>
        <p className="mt-2 text-white/60">
          A rental agreement or employment offer letter, as PDF or DOCX. It stays in{" "}
          <code className="text-white/40">asia-south1</code> and is deleted after 24 hours.
        </p>
      </div>

      <div className="flex gap-3">
        {(["rental", "employment"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setDocType(t)}
            className={`rounded-full border px-4 py-1.5 text-sm capitalize transition-colors ${
              docType === t
                ? "border-[var(--accent)] bg-[var(--accent)]/20 text-white"
                : "border-white/15 text-white/60 hover:border-white/30"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 px-6 py-12 text-center hover:border-white/40">
        <input
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          disabled={status === "uploading" || status === "segmenting"}
        />
        <span className="text-white/70">
          {status === "uploading" || status === "segmenting" ? statusDetail : "Click to choose a file"}
        </span>
      </label>

      {error && (
        <p className="rounded-lg border border-[var(--void)]/40 bg-[var(--void)]/10 px-4 py-3 text-sm text-[var(--void)]">
          {error}
        </p>
      )}
    </main>
  );
}
