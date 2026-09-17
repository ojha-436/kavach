import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/extract-pdf";
import {
  fetchJudgmentPdf,
  fetchJudgmentMetadata,
  fetchHcJudgmentPdf,
  pdfUrlFor,
  hcPdfUrlFor,
  prepareJudgmentText,
  splitIntoParagraphs,
  deriveCourt,
  deriveCaseNumber,
} from "@/lib/judgments";
import { writeJudgment } from "@/lib/firestore-admin";
import { ingestTokenMatches } from "@/lib/ingest-auth";
import { mapWithConcurrency } from "@/lib/concurrency";

export const maxDuration = 300;

/**
 * Populates the judgment corpus from the AWS mirrors.
 *
 * Fails closed: without INGEST_TOKEN configured on the service this route
 * refuses outright, so a public deployment never exposes an unauthenticated
 * write path into Firestore.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Ingest is disabled" }, { status: 404 });
  }
  if (!ingestTokenMatches(req.headers.get("x-ingest-token"), expected)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const paths: string[] = Array.isArray(body?.paths) ? body.paths : [];
  const source: "sc" | "hc" = body?.source === "hc" ? "hc" : "sc";
  if (paths.length === 0) {
    return NextResponse.json({ error: "paths[] is required" }, { status: 400 });
  }

  const ingested: string[] = [];
  const failed: Array<{ path: string; reason: string }> = [];

  /**
   * Four at a time. Each item is dominated by network waits — fetch the PDF,
   * fetch its metadata, write to Firestore — so running them one after
   * another left the container idle for most of the batch. Four is chosen
   * against memory rather than speed: extractPdfText holds a parsed document
   * in memory, and the service has 1 GiB.
   */
  const outcomes = await mapWithConcurrency(
    paths.slice(0, 40),
    4,
    async (path): Promise<{ path: string; reason?: string }> => {
      try {
        // Independent fetches against the same mirror; no reason to queue them.
        const [pdf, meta] = await Promise.all([
          source === "hc" ? fetchHcJudgmentPdf(path) : fetchJudgmentPdf(path),
          source === "hc"
            ? Promise.resolve({ citation: null, year: yearFromHcKey(path) })
            : fetchJudgmentMetadata(path),
        ]);

        const { text } = await extractPdfText(pdf);
        // Strip law-report editorial matter before anything else touches it.
        const prepared = prepareJudgmentText(text);
        const paragraphs = splitIntoParagraphs(prepared.body);

        if (paragraphs.length === 0) {
          return { path, reason: "no extractable paragraphs (likely a scan)" };
        }

        await writeJudgment({
          judgment: {
            id: source === "hc" ? hcIdFor(path) : path,
            year: meta.year,
            citation: meta.citation,
            title: deriveTitle(prepared.header, text, path),
            court: deriveCourt(text, source),
            caseNumber: deriveCaseNumber(text),
            sourceUrl: source === "hc" ? hcPdfUrlFor(path) : pdfUrlFor(path),
            paragraphCount: paragraphs.length,
            ingestedAt: new Date().toISOString(),
          },
          paragraphs,
        });
        return { path };
      } catch (err) {
        // Returned rather than thrown: one unreadable PDF should not discard
        // the thirty-nine that worked.
        return {
          path,
          reason: err instanceof Error ? err.message : "unknown error",
        };
      }
    },
  );

  for (const outcome of outcomes) {
    if (outcome.reason)
      failed.push({ path: outcome.path, reason: outcome.reason });
    else ingested.push(outcome.path);
  }

  return NextResponse.json({ ingested, failed });
}

/** Firestore ids can't contain "/", and HC keys are full object paths. */
function hcIdFor(objectKey: string): string {
  return objectKey.replace(/[^A-Za-z0-9_-]/g, "_").slice(-180);
}

function yearFromHcKey(objectKey: string): string {
  return objectKey.match(/year=(\d{4})/)?.[1] ?? "unknown";
}

/**
 * Reports open with the parties either side of a "v." on its own line.
 * Party names and citations are facts about the case, not editorial work,
 * so taking the title from the header block is fine.
 *
 * Falling back to the file path is acceptable — a plain-looking title is a
 * cosmetic problem, whereas a wrong paragraph citation would not be.
 */
function deriveTitle(header: string, fullText: string, path: string): string {
  const fromHeader = titleFromBlock(header);
  if (fromHeader) return fromHeader;

  // High Court PDFs have no law-report header block, so look at the document.
  const fromBody = titleFromBlock(fullText.slice(0, 6000));
  if (fromBody) return fromBody;

  return path.split("/").pop() ?? path;
}

function titleFromBlock(block: string): string | null {
  const lines = block
    .slice(0, 6000)
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const vsIndex = lines.findIndex((l) => /^(versus|vs?\.?|v\/s)$/i.test(l));
  if (vsIndex > 0 && vsIndex < lines.length - 1) {
    const before = cleanParty(lines[vsIndex - 1]);
    const after = cleanParty(lines[vsIndex + 1]);
    if (before && after) return `${before} v. ${after}`;
  }

  const inline = lines.find((l) => /\s+(vs\.?|versus|v\/s)\s+/i.test(l));
  if (inline) {
    const cleaned = cleanParty(inline);
    if (cleaned.length > 5) return cleaned;
  }

  return null;
}

function cleanParty(line: string): string {
  return line
    .replace(/\.{3,}.*$/, "")
    .replace(/\s*\.\.+\s*(appellant|respondent|petitioner)s?\b.*$/i, "")
    .replace(/\s*\b(appellant|respondent|petitioner)s?\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}
