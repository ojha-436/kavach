import { JudgmentParagraph } from "./schema";

/**
 * Supreme Court judgment corpus.
 *
 * Source: the AWS Open Data mirror of eCourts SC judgments
 * (`indian-supreme-court-judgments`, ap-south-1, CC-BY-4.0, 1950-2025).
 * Verified on Day 2 to be readable with no credentials.
 *
 * Why not a government API: there isn't one. eCourts' judgment search is
 * CAPTCHA-gated, NJDG publishes pendency statistics rather than judgment
 * text, and data.gov.in's judiciary catalog contains no judgments at all.
 *
 * Legality: reproducing the text of a court judgment is not an infringement
 * of copyright under s.52(1)(q) of the Copyright Act, 1957. We take the
 * judgment body only. Law-report headnotes and editorial matter carry
 * separate copyright and are never ingested.
 */

const BUCKET_HOST =
  "https://indian-supreme-court-judgments.s3.ap-south-1.amazonaws.com";

export const CORPUS_ATTRIBUTION =
  "Supreme Court of India judgments via the AWS Open Data mirror of eCourts (CC-BY-4.0). Reproduced under s.52(1)(q), Copyright Act 1957.";

/** `1950_1_15_25` -> the English PDF for that reported case. */
export function pdfUrlFor(judgmentPath: string): string {
  const year = judgmentPath.split("_")[0];
  return `${BUCKET_HOST}/data/pdf/year=${year}/english/${judgmentPath}_EN.pdf`;
}

export function metadataUrlFor(judgmentPath: string): string {
  const year = judgmentPath.split("_")[0];
  return `${BUCKET_HOST}/metadata/json/year=${year}/${judgmentPath}.json`;
}

export async function fetchJudgmentPdf(judgmentPath: string): Promise<Buffer> {
  const res = await fetch(pdfUrlFor(judgmentPath));
  if (!res.ok) {
    throw new Error(`Judgment PDF not available for ${judgmentPath} (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function fetchJudgmentMetadata(
  judgmentPath: string
): Promise<{ citation: string | null; year: string }> {
  const res = await fetch(metadataUrlFor(judgmentPath));
  if (!res.ok) return { citation: null, year: judgmentPath.split("_")[0] };
  const json = (await res.json()) as { nc_display?: string; citation_year?: string };
  return {
    citation: json.nc_display ?? null,
    year: json.citation_year ?? judgmentPath.split("_")[0],
  };
}

/**
 * Markers of Supreme Court Reports editorial apparatus. Everything from the
 * first of these until the judgment body proper is written by the SCR
 * editorial team, not the court, and carries its own copyright — s.52(1)(q)
 * covers the judgment, not the headnotes wrapped around it.
 */
const EDITORIAL_MARKERS = [
  /\bIssue for Consideration\b/i,
  /\bHeadnotes?\b/i,
  /\bCase Law Cited\b/i,
  /\bCase Law Reference\b/i,
  /\bList of Acts\b/i,
  /\bList of Keywords\b/i,
  /\bAppearances? for Parties\b/i,
];

export type PreparedJudgment = {
  /** The court's own words. This is the only text we store or send to a model. */
  body: string;
  /** Citation and party block, ahead of any editorial matter. Title only. */
  header: string;
  /** True when SCR editorial apparatus was found and removed. */
  strippedEditorial: boolean;
};

/**
 * Separates the court's judgment from the law report's editorial matter.
 *
 * Fails closed: if editorial matter is present but the start of the judgment
 * cannot be located confidently, this throws rather than ingesting text we
 * have no right to reproduce. Missing a judgment is recoverable; publishing
 * someone else's copyrighted headnotes is not.
 */
export function prepareJudgmentText(fullText: string): PreparedJudgment {
  const firstEditorial = EDITORIAL_MARKERS.map((re) => fullText.search(re))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];

  if (firstEditorial === undefined) {
    // No law-report apparatus: this is a bare judgment PDF, take it whole.
    return { body: fullText, header: fullText.slice(0, 1200), strippedEditorial: false };
  }

  const lastEditorial = EDITORIAL_MARKERS.map((re) => {
    const i = fullText.search(re);
    return i >= 0 ? i : -1;
  }).reduce((a, b) => Math.max(a, b), -1);

  // The judgment body opens at its first numbered paragraph after the last
  // piece of editorial apparatus.
  const after = fullText.slice(lastEditorial);
  const bodyStartRel = after.search(/\n\s*1\.\s+\S/);
  if (bodyStartRel < 0) {
    throw new Error(
      "Editorial matter present but judgment body start not found; refusing to ingest"
    );
  }

  const bodyStart = lastEditorial + bodyStartRel + 1;
  return {
    body: stripTrailingEditorial(fullText.slice(bodyStart)),
    header: fullText.slice(0, firstEditorial),
    strippedEditorial: true,
  };
}

/**
 * Law reports close with their own apparatus too — a "Result of the case"
 * line and the headnote author's credit. Same copyright position as the
 * leading block, so it goes as well. Only cut in the tail of the text, so a
 * judgment that happens to discuss these words mid-argument is untouched.
 */
const TRAILING_MARKERS = [
  /\n\s*Result of the case\s*:/i,
  /†\s*\n?\s*Headnotes prepared by/i,
];

function stripTrailingEditorial(body: string): string {
  let cut = body.length;
  for (const re of TRAILING_MARKERS) {
    const i = body.search(re);
    if (i > body.length * 0.5 && i < cut) cut = i;
  }
  return body.slice(0, cut).trimEnd();
}

/**
 * Judgments are paragraph-numbered by convention, and those numbers are how
 * lawyers cite them ("at para 14"). We segment on that convention so a
 * citation in an explanation points at something a reader can verify in the
 * original, and keep character offsets so the UI can highlight the span.
 *
 * Offsets are relative to the prepared body, which is also what is stored
 * and rendered, so a citation always resolves against what the reader sees.
 */
export function splitIntoParagraphs(text: string): JudgmentParagraph[] {
  const numbered = /(?:^|\n)\s*(\d{1,3})[.)]\s+/g;

  // Carry the judgment's OWN paragraph number, never a synthetic sequence.
  // A citation that reads "¶14" has to be paragraph 14 of the real judgment,
  // or a lawyer checking it against the original finds the wrong text and
  // every other claim in the explanation becomes suspect.
  const marks: Array<{ offset: number; number: number }> = [];
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = numbered.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n === last + 1) {
      marks.push({ offset: m.index === 0 ? 0 : m.index + 1, number: n });
      last = n;
    }
  }

  const paragraphs: JudgmentParagraph[] = [];

  if (marks.length >= 3) {
    for (let i = 0; i < marks.length; i++) {
      const span = trimmedSpan(
        text,
        marks[i].offset,
        i + 1 < marks.length ? marks[i + 1].offset : text.length
      );
      // No minimum length here: "1. Leave granted." is a real, citable
      // paragraph and dropping it shifts every number after it.
      if (!span) continue;
      paragraphs.push({
        index: marks[i].number,
        text: text.slice(span.start, span.end),
        startOffset: span.start,
        endOffset: span.end,
      });
    }
    return paragraphs;
  }

  // Judgments without usable numbering fall back to blank-line blocks, which
  // are sequential by necessity — there is no source numbering to preserve.
  const boundaries = blankLineBoundaries(text);
  for (let i = 0; i < boundaries.length; i++) {
    const span = trimmedSpan(
      text,
      boundaries[i],
      i + 1 < boundaries.length ? boundaries[i + 1] : text.length
    );
    if (!span || span.end - span.start < 40) continue;
    paragraphs.push({
      index: paragraphs.length + 1,
      text: text.slice(span.start, span.end),
      startOffset: span.start,
      endOffset: span.end,
    });
  }

  return paragraphs;
}

function trimmedSpan(
  text: string,
  start: number,
  end: number
): { start: number; end: number } | null {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return e > s ? { start: s, end: e } : null;
}

function blankLineBoundaries(text: string): number[] {
  const out = [0];
  const re = /\n[ \t]*\n+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const next = m.index + m[0].length;
    if (next < text.length) out.push(next);
  }
  return out;
}
