import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/extract-pdf";
import {
  fetchJudgmentPdf,
  fetchJudgmentMetadata,
  pdfUrlFor,
  prepareJudgmentText,
  splitIntoParagraphs,
} from "@/lib/judgments";
import { writeJudgment } from "@/lib/firestore-admin";

export const maxDuration = 300;

/**
 * Populates the judgment corpus from the AWS mirror.
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
  if (req.headers.get("x-ingest-token") !== expected) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const paths: string[] = Array.isArray(body?.paths) ? body.paths : [];
  if (paths.length === 0) {
    return NextResponse.json({ error: "paths[] is required" }, { status: 400 });
  }

  const ingested: string[] = [];
  const failed: Array<{ path: string; reason: string }> = [];

  for (const path of paths.slice(0, 40)) {
    try {
      const [pdf, meta] = await Promise.all([
        fetchJudgmentPdf(path),
        fetchJudgmentMetadata(path),
      ]);
      const { text } = await extractPdfText(pdf);
      // Strip SCR editorial matter before anything else touches the text.
      const prepared = prepareJudgmentText(text);
      const paragraphs = splitIntoParagraphs(prepared.body);

      if (paragraphs.length === 0) {
        failed.push({ path, reason: "no extractable paragraphs (likely a scan)" });
        continue;
      }

      await writeJudgment({
        judgment: {
          id: path,
          year: meta.year,
          citation: meta.citation,
          title: deriveTitle(prepared.header, path),
          sourceUrl: pdfUrlFor(path),
          paragraphCount: paragraphs.length,
          ingestedAt: new Date().toISOString(),
        },
        paragraphs,
      });
      ingested.push(path);
    } catch (err) {
      failed.push({
        path,
        reason: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return NextResponse.json({ ingested, failed });
}

/**
 * Reports open with the parties either side of a "v." on its own line.
 * Party names and citations are facts about the case, not editorial work,
 * so taking the title from the header block is fine.
 *
 * Falling back to the file path is acceptable — a plain-looking title is a
 * cosmetic problem, whereas a wrong paragraph citation would not be.
 */
function deriveTitle(header: string, path: string): string {
  const lines = header
    .slice(0, 4000)
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

  const inline = lines.find((l) => /\s+(vs\.?|versus)\s+/i.test(l));
  if (inline) return cleanParty(inline);

  return path;
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
