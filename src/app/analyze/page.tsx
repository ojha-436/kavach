"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { AskPanel } from "@/components/AskPanel";
import { ActionReport, type Synthesis } from "@/components/ActionReport";
import { useAuth } from "@/components/AuthProvider";
import {
  FindingCard,
  MissingProtections,
  RiskScore,
  VerdictDot,
  verdictHighlight,
} from "@/components/Verdict";
import {
  Clause,
  ClauseFinding,
  DocumentKind,
  ExpectedProtection,
} from "@/lib/schema";

type Status = "idle" | "restoring" | "uploading" | "working" | "ready" | "error";

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
  const { user, loading: authLoading, authedFetch } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [statusDetail, setStatusDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [kind, setKind] = useState<DocumentKind | null>(null);
  const [covered, setCovered] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const clauseRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  /** Guards against a previous document's in-flight verdicts landing on this one. */
  const currentAnalysis = useRef<string | null>(null);
  const [judgeError, setJudgeError] = useState<string | null>(null);

  // Stages 2/4/5 run after the clauses are already on screen.
  const [judging, setJudging] = useState(false);
  const [findings, setFindings] = useState<Record<string, ClauseFinding>>({});
  const [missing, setMissing] = useState<ExpectedProtection[]>([]);
  const [report, setReport] = useState<{
    riskScore: number;
    counts: Record<string, number>;
    unanalysed: string[];
    synthesis?: Synthesis;
  } | null>(null);

  /**
   * Reopening an analysis from the history page, via /analyze?id=<id>.
   *
   * History entries have always linked here with the id attached; nothing
   * ever read it, so following your own history landed on an empty upload
   * page. Everything needed was already in Firestore — the clauses carry
   * their verdicts and the report is its own document — except the document
   * text, which was returned to the browser and then dropped. It is stored
   * now, because the rendering below slices it with the clause offsets and a
   * reconstruction from the clauses alone would lose every gap between them.
   *
   * Read from window.location rather than useSearchParams deliberately.
   * useSearchParams would force this page out of static prerendering unless
   * the whole component is split behind a Suspense boundary, and the page is
   * prerendered today — the accessibility suite runs against that output.
   * The restore happens in an effect either way, so there is nothing to gain
   * from the hook and a working prerender to lose.
   *
   * Waits for auth to settle first. An owned analysis returns 404 to anyone
   * who is not its owner, and an unauthenticated request during the auth
   * round trip looks exactly like someone else asking.
   */
  const restoredId = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || restoredId.current === id) return;
    restoredId.current = id;

    let cancelled = false;

    void (async () => {
      setStatus("restoring");
      setStatusDetail("Reopening your analysis…");
      setError(null);
      try {
        const res = await authedFetch(`/api/analyses/${id}`);
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setStatus("error");
          setError(
            res.status === 404
              ? "That analysis has expired or belongs to another account."
              : (data.error ?? "That analysis could not be reopened.")
          );
          return;
        }

        if (!data.text) {
          // Analyses created before the text was persisted cannot be redrawn,
          // and half a document is worse than an honest refusal.
          setStatus("error");
          setError(
            "This analysis was created before documents were saved for reopening. Upload it again to see it."
          );
          return;
        }

        const analysis = data.analysis ?? {};
        const clauseList: Clause[] = data.clauses ?? [];

        currentAnalysis.current = id;
        setAnalysisId(id);
        setText(data.text);
        setClauses(clauseList);
        setKind({
          docType: analysis.docType,
          label: analysis.docLabel ?? "Document",
          state: analysis.state ?? null,
          userSide: analysis.userSide ?? "reader",
        });
        setCovered(analysis.docType !== "other");
        setFindings(
          Object.fromEntries(
            clauseList
              .map((c) => (c as Clause & { finding?: ClauseFinding | null }).finding)
              .filter((f): f is ClauseFinding => !!f)
              .map((f) => [f.clauseId, f])
          )
        );
        setMissing(data.report?.missingProtections ?? []);
        setReport(data.report ?? null);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("That analysis could not be reopened. Please try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authedFetch]);

  async function adjudicate(id: string) {
    setJudging(true);
    setJudgeError(null);
    try {
      const res = await authedFetch(`/api/analyses/${id}/adjudicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();

      // A second upload may have started while this was in flight; painting
      // the first document's verdicts onto the second would be worse than
      // showing none.
      if (currentAnalysis.current !== id) return;

      if (!res.ok) {
        setJudgeError(
          data.error ?? "The clause-by-clause check didn't finish. The document above is still accurate."
        );
        return;
      }
      if (!data.covered) return;

      setClauses(data.clauses ?? []);
      setFindings(
        Object.fromEntries(
          (data.findings ?? []).map((f: ClauseFinding) => [f.clauseId, f])
        )
      );
      setMissing(data.missingProtections ?? []);
      setReport(data.report ?? null);
    } catch {
      if (currentAnalysis.current === id) {
        setJudgeError(
          "The clause-by-clause check couldn't be reached. The document above is still accurate."
        );
      }
    } finally {
      if (currentAnalysis.current === id) setJudging(false);
    }
  }

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
      const res = await authedFetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gcsUri, fileName: file.name, contentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      setAnalysisId(data.id);
      currentAnalysis.current = data.id;
      setText(data.text);
      setClauses(data.clauses);
      setKind(data.kind);
      setCovered(data.covered);
      setFindings({});
      setMissing([]);
      setReport(null);
      setStatus("ready");

      if (data.covered) void adjudicate(data.id);
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
        <main id="main" className="mx-auto max-w-6xl px-5 pb-20">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-rule py-4">
            <h1 className="font-display text-lg text-ink">{kind?.label}</h1>
            <p className="font-sans text-sm text-ink-soft numeral-tabular">
              {clauses.length} clauses
              {kind?.state ? ` · ${kind.state}` : ""}
            </p>
            <p role="status" aria-live="polite" className="font-sans text-sm text-ink-faint">
              {judging ? "Checking each clause against the statute…" : ""}
            </p>
            {report && <RiskScore score={report.riskScore} counts={report.counts} />}
            <button
              onClick={() => {
                currentAnalysis.current = null;
                setStatus("idle");
                setClauses([]);
                setText("");
                setSelectedId(null);
                setKind(null);
                setJudgeError(null);
              }}
              className="ml-auto font-sans text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              New document
            </button>
          </div>

          {judgeError && (
            <p
              role="alert"
              className="mt-4 border border-caution bg-caution-wash px-4 py-3 font-sans text-sm text-caution"
            >
              {judgeError}
            </p>
          )}

          {/* Two different situations that both leave the document unjudged.
              Saying "this is an unrecognised document" when the truth is "we
              could not reach the model" states something false about the
              reader's contract, and invites them to conclude their offer
              letter is somehow unusual. */}
          {!covered && kind?.detectionFailed && (
            <p
              role="status"
              className="mt-4 border border-caution bg-caution-wash px-4 py-3 font-sans text-sm text-caution"
            >
              Kavach couldn&apos;t identify what kind of document this is — the
              service was briefly unavailable, not something about your document.
              Your clauses are below and you can still ask questions about them.
              Re-uploading in a minute will usually get the clause-by-clause check
              running.
            </p>
          )}

          {!covered && !kind?.detectionFailed && (
            <p
              role="status"
              className="mt-4 border border-caution bg-caution-wash px-4 py-3 font-sans text-sm text-caution"
            >
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
            {/* Each clause is a real button: it is an interactive control, so
                it must be reachable and operable from the keyboard. */}
            <div className="prose-document whitespace-pre-wrap text-ink">
              {segments.map((seg) =>
                seg.clauseId ? (
                  <button
                    key={seg.key}
                    type="button"
                    ref={(el) => {
                      clauseRefs.current[seg.clauseId!] = el;
                    }}
                    onClick={() => select(seg.clauseId!)}
                    aria-pressed={selectedId === seg.clauseId}
                    aria-label={`Clause: ${
                      clauses.find((c) => c.id === seg.clauseId)?.heading ??
                      "untitled"
                    }${
                      findings[seg.clauseId!]
                        ? `, verdict ${findings[seg.clauseId!].verdict.toLowerCase().replace(/_/g, " ")}`
                        : ""
                    }`}
                    className={`cursor-pointer whitespace-pre-wrap text-left transition-colors ${
                      selectedId === seg.clauseId
                        ? "bg-attest-wash"
                        : verdictHighlight(findings[seg.clauseId!]?.verdict) ||
                          "hover:bg-paper-sunk"
                    }`}
                  >
                    {seg.text}
                  </button>
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
                  <VerdictDot verdict={findings[c.id]?.verdict} />
                </button>
              ))}
            </aside>
          </div>

          {selectedId && findings[selectedId] && (
            <section className="border-t border-rule py-8">
              <h2 className="font-sans text-xs font-semibold tracking-wide text-ink-faint">
                {clauses.find((c) => c.id === selectedId)?.heading ?? "This clause"}
              </h2>
              <div className="mt-4">
                <FindingCard finding={findings[selectedId]} />
              </div>
            </section>
          )}

          <MissingProtections protections={missing} />

          {report?.synthesis && <ActionReport synthesis={report.synthesis} />}

          {report && report.unanalysed.length > 0 && (
            <p className="mt-8 border-t border-rule pt-5 font-sans text-xs text-ink-faint">
              {report.unanalysed.length} of {clauses.length} clauses fall outside the
              curated rule pack and were left unanalysed rather than guessed at. That is
              a deliberate precision-over-recall trade, and it is why the citations above
              can be trusted.
            </p>
          )}

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

  // "restoring" belongs here too: reopening from history is a wait like any
  // other, and without it the page shows an idle dropzone while a fetch is in
  // flight, which reads as "nothing happened" and invites a second upload.
  const working =
    status === "uploading" || status === "working" || status === "restoring";

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-5 py-16">
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

        {/* sr-only rather than `hidden`: display:none removes the input from
            the accessibility tree entirely, which made the app's primary
            action unreachable by keyboard and invisible to screen readers. */}
        <label
          htmlFor="document-upload"
          className="mt-8 flex cursor-pointer items-center justify-center border border-dashed border-rule bg-paper-raised px-6 py-16 text-center transition-colors hover:border-attest"
        >
          <input
            id="document-upload"
            type="file"
            accept=".pdf,.docx"
            className="sr-only"
            disabled={working}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <span className="font-sans text-ink-soft">
            {working ? statusDetail : "Choose a file (PDF or DOCX, up to 15 MB)"}
          </span>
        </label>

        <p role="status" aria-live="polite" className="sr-only">
          {working ? statusDetail : ""}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 border border-seal bg-seal-wash px-4 py-3 font-sans text-sm text-seal"
          >
            {error}
          </p>
        )}
      </main>
    </>
  );
}
