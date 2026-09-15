"use client";

import { useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/components/AuthProvider";
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
  const { user, token } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [statusDetail, setStatusDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>("rental");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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

      setStatus("segmenting");
      setStatusDetail("Splitting the document into clauses…");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gcsUri,
          fileName: file.name,
          contentType,
          docTypeHint: docType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      setAnalysisId(data.id);
      setText(data.text);
      setClauses(data.clauses);
      setSaved(false);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  async function saveToProfile() {
    const idToken = await token();
    if (!idToken || !analysisId) return;
    const res = await fetch("/api/me", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ analysisId }),
    });
    if (res.ok) setSaved(true);
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
        <main className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap items-center gap-4 border-b border-rule py-4">
            <p className="font-sans text-sm text-ink-soft numeral-tabular">
              {clauses.length} clauses found
            </p>
            <p className="font-sans text-xs text-ink-faint">
              No verdicts yet — clause segmentation only.
            </p>
            <div className="ml-auto flex items-center gap-4 font-sans text-sm">
              {user ? (
                <button
                  onClick={saveToProfile}
                  disabled={saved}
                  className="text-attest underline-offset-4 hover:underline disabled:text-ink-faint disabled:no-underline"
                >
                  {saved ? "Saved to your profile" : "Save to my profile"}
                </button>
              ) : (
                <span className="text-ink-faint">
                  Signed out — this is deleted in 24 hours
                </span>
              )}
              <button
                onClick={() => {
                  setStatus("idle");
                  setClauses([]);
                  setText("");
                  setSelectedId(null);
                }}
                className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                New document
              </button>
            </div>
          </div>

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
        </main>
      </>
    );
  }

  const working = status === "uploading" || status === "segmenting";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-3xl font-medium text-ink">
          Your document
        </h1>
        <p className="prose-document mt-4 text-ink-soft">
          A residential rental agreement or an employment offer letter, as PDF or DOCX.
          It is processed in asia-south1 and, if you are not signed in, deleted within 24
          hours.
        </p>

        <div className="mt-8 flex gap-2">
          {(["rental", "employment"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setDocType(t)}
              className={`border px-4 py-2 font-sans text-sm capitalize transition-colors ${
                docType === t
                  ? "border-ink bg-ink text-paper"
                  : "border-rule text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {t === "rental" ? "Rental agreement" : "Offer letter"}
            </button>
          ))}
        </div>

        <label className="mt-6 flex cursor-pointer items-center justify-center border border-dashed border-rule bg-paper-raised px-6 py-14 text-center transition-colors hover:border-attest">
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
