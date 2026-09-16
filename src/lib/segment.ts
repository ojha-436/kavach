import { z } from "zod";
import { classify } from "./llm";
import { Clause } from "./schema";
import { ExtractedDocument } from "./extract";

type RawClause = {
  heading: string | null;
  startOffset: number;
  endOffset: number;
};

const NUMBERED_LINE = /^[ \t]*(\d{1,3})[.)]\s+(\S.*)$/;
const LABELLED_LINE = /^[ \t]*(?:ARTICLE|Article|CLAUSE|Clause)\s+([A-Za-z0-9]+)\.?[:\-]?\s*(.*)$/;
const ALL_CAPS_HEADING = /^[ \t]*([A-Z][A-Z \t&,'-]{4,60})[ \t]*$/;

type Boundary = { offset: number; heading: string | null };

/**
 * Tier 1: numbered ("1. Rent") or labelled ("Article 4") clause markers, the
 * common case for Indian rental/employment contracts. A numeric boundary is
 * only accepted if its number is greater than the last accepted one, so a
 * numbered sub-list inside a clause's body doesn't get promoted to a new
 * top-level clause.
 */
function findNumberedOrLabelledBoundaries(text: string): Boundary[] {
  const boundaries: Boundary[] = [];
  let lastNumber = 0;
  let offset = 0;

  for (const rawLine of text.split("\n")) {
    const line = rawLine;
    const lineLength = line.length + 1; // + the \n split removed

    const numbered = line.match(NUMBERED_LINE);
    const labelled = line.match(LABELLED_LINE);

    if (numbered) {
      const n = parseInt(numbered[1], 10);
      const atLineStart = /^[ \t]*\d/.test(line);
      if (atLineStart && n > lastNumber && n <= lastNumber + 10) {
        boundaries.push({ offset, heading: numbered[2].trim() || null });
        lastNumber = n;
      }
    } else if (labelled) {
      boundaries.push({ offset, heading: labelled[2].trim() || labelled[1] });
    }

    offset += lineLength;
  }

  return boundaries;
}

/** Tier 2 fallback: ALL-CAPS heading lines, for documents without numbering. */
function findAllCapsBoundaries(text: string): Boundary[] {
  const boundaries: Boundary[] = [];
  let offset = 0;

  for (const line of text.split("\n")) {
    const lineLength = line.length + 1;
    const match = line.match(ALL_CAPS_HEADING);
    if (match && match[1].trim().split(/\s+/).length <= 8) {
      boundaries.push({ offset, heading: match[1].trim() });
    }
    offset += lineLength;
  }

  return boundaries;
}

/** Tier 3 fallback: blank-line-separated paragraphs, so we always produce something. */
function findParagraphBoundaries(text: string): Boundary[] {
  const boundaries: Boundary[] = [{ offset: 0, heading: null }];
  const re = /\n[ \t]*\n+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const next = match.index + match[0].length;
    if (next < text.length) boundaries.push({ offset: next, heading: null });
  }
  return boundaries;
}

function boundariesToClauses(text: string, boundaries: Boundary[]): RawClause[] {
  const sorted = [...boundaries].sort((a, b) => a.offset - b.offset);
  const clauses: RawClause[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].offset;
    const end = i + 1 < sorted.length ? sorted[i + 1].offset : text.length;

    // Trim trailing/leading whitespace by shrinking the offset range itself,
    // so `text.slice(startOffset, endOffset) === clause.text` always holds.
    let s = start;
    let e = end;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e - s < 10) continue; // drop near-empty fragments (stray boundary lines)

    clauses.push({ heading: sorted[i].heading, startOffset: s, endOffset: e });
  }

  return clauses;
}

function heuristicSegment(text: string): RawClause[] {
  const numbered = findNumberedOrLabelledBoundaries(text);
  if (numbered.length >= 3) return boundariesToClauses(text, numbered);

  const caps = findAllCapsBoundaries(text);
  if (caps.length >= 3) return boundariesToClauses(text, caps);

  return boundariesToClauses(text, findParagraphBoundaries(text));
}

const RepairResponse = z.object({
  merges: z.array(z.array(z.number().int())),
  headings: z.array(z.object({ index: z.number().int(), heading: z.string() })),
});

const REPAIR_SCHEMA = {
  type: "OBJECT",
  properties: {
    merges: {
      type: "ARRAY",
      description:
        "Groups of consecutive clause indices that were incorrectly split and should be merged into one clause. Omit any group you are not confident about.",
      items: { type: "ARRAY", items: { type: "INTEGER" } },
    },
    headings: {
      type: "ARRAY",
      description: "Better headings for clauses whose heading is missing or clearly wrong.",
      items: {
        type: "OBJECT",
        properties: { index: { type: "INTEGER" }, heading: { type: "STRING" } },
        required: ["index", "heading"],
      },
    },
  },
  required: ["merges", "headings"],
};

const REPAIR_SYSTEM = `You repair a heuristic clause segmentation of a legal contract. You are given
a numbered list of candidate clauses (index, current heading, a text preview). You do not see the
full document text and cannot change clause boundaries except by merging ADJACENT candidates whose
indices are consecutive. Only propose a merge when you are confident the split was wrong (e.g. a
clause was cut mid-sentence, or a sub-point was wrongly promoted to its own top-level clause). Only
propose a heading when the current one is null or clearly not a real heading. Output must satisfy
the provided JSON schema exactly.`;

/**
 * Tier 4: one LLM repair pass over the heuristic output (Architecture SS4.2).
 * The model only proposes merges of adjacent indices and better headings —
 * it never invents offsets, so `text.slice(start, end)` stays correct by
 * construction even if the repair call fails or returns garbage.
 */
async function repairWithLlm(text: string, raw: RawClause[]): Promise<RawClause[]> {
  if (raw.length < 2) return raw;

  const preview = raw.map((c, i) => ({
    index: i,
    heading: c.heading,
    preview: text.slice(c.startOffset, Math.min(c.endOffset, c.startOffset + 220)),
  }));

  let parsed: z.infer<typeof RepairResponse> | null = null;

  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    try {
      const raw_response = await classify({
        systemInstruction: REPAIR_SYSTEM,
        prompt: JSON.stringify(preview),
        responseSchema: REPAIR_SCHEMA,
      });
      const candidate = RepairResponse.safeParse(JSON.parse(raw_response));
      if (candidate.success) parsed = candidate.data;
    } catch {
      // retried once, then degrades to heuristic-only below
    }
  }

  if (!parsed) return raw;

  const headingByIndex = new Map(parsed.headings.map((h) => [h.index, h.heading]));

  // Validate merge groups: in-range, strictly consecutive, non-overlapping.
  const used = new Set<number>();
  const validMerges: number[][] = [];
  for (const group of parsed.merges) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a - b);
    const inRange = sorted.every((i) => i >= 0 && i < raw.length);
    const consecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
    const untouched = sorted.every((i) => !used.has(i));
    if (inRange && consecutive && untouched) {
      sorted.forEach((i) => used.add(i));
      validMerges.push(sorted);
    }
  }

  const mergedStart = new Map(validMerges.map((g) => [g[0], g]));
  const skip = new Set(validMerges.flatMap((g) => g.slice(1)));

  const result: RawClause[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (skip.has(i)) continue;
    const group = mergedStart.get(i);
    if (group) {
      const last = raw[group[group.length - 1]];
      result.push({
        heading: headingByIndex.get(i) ?? raw[i].heading,
        startOffset: raw[i].startOffset,
        endOffset: last.endOffset,
      });
    } else {
      result.push({
        heading: headingByIndex.get(i) ?? raw[i].heading,
        startOffset: raw[i].startOffset,
        endOffset: raw[i].endOffset,
      });
    }
  }

  return result;
}

export async function segmentDocument(doc: ExtractedDocument): Promise<Clause[]> {
  const raw = heuristicSegment(doc.text);
  const repaired = await repairWithLlm(doc.text, raw);

  return repaired.map((c, i) => ({
    id: `clause-${i}`,
    heading: c.heading,
    text: doc.text.slice(c.startOffset, c.endOffset),
    startOffset: c.startOffset,
    endOffset: c.endOffset,
    page: doc.pageForOffset(c.startOffset),
    clauseType: null,
    alsoCovers: [],
  }));
}
