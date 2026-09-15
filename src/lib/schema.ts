import { z } from "zod";

export const Verdict = z.enum([
  "VOID",
  "UNENFORCEABLE_IN_PART",
  "ONEROUS_BUT_VALID",
  "STANDARD",
  "FAVOURABLE",
]);
export type Verdict = z.infer<typeof Verdict>;

export const Confidence = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type Confidence = z.infer<typeof Confidence>;

export const StatutoryBasis = z.object({
  ruleId: z.string(),
  statute: z.string(),
  section: z.string(),
  authority: z.string().optional(),
});
export type StatutoryBasis = z.infer<typeof StatutoryBasis>;

export const ClauseFinding = z.object({
  clauseId: z.string(),
  verdict: Verdict,
  severity: z.number().int().min(0).max(5),
  plainEnglish: z.string(),
  whyItMatters: z.string(),
  statutoryBasis: z.array(StatutoryBasis),
  negotiationAsk: z.string().nullable(),
  confidence: Confidence,
  needsLawyer: z.boolean(),
  lawyerQuestion: z.string().nullable(),
});
export type ClauseFinding = z.infer<typeof ClauseFinding>;

export const DocType = z.enum(["rental", "employment"]);
export type DocType = z.infer<typeof DocType>;

export const UserSide = z.enum([
  "tenant",
  "landlord",
  "employee",
  "employer",
  "unknown",
]);
export type UserSide = z.infer<typeof UserSide>;

export const DocumentFrame = z.object({
  docType: DocType,
  state: z.string().nullable(),
  language: z.string(),
  parties: z.array(z.string()),
  userSide: UserSide,
});
export type DocumentFrame = z.infer<typeof DocumentFrame>;

export const Clause = z.object({
  id: z.string(),
  heading: z.string().nullable(),
  text: z.string(),
  startOffset: z.number().int(),
  endOffset: z.number().int(),
  page: z.number().int().nullable(),
  clauseType: z.string().nullable(),
});
export type Clause = z.infer<typeof Clause>;

export const RuleCard = z.object({
  id: z.string(),
  docType: DocType,
  clauseType: z.string(),
  statute: z.string(),
  section: z.string(),
  authority: z.string().optional(),
  defaultVerdict: Verdict,
  appliesWhen: z.string(),
  doesNotApplyWhen: z.string().optional(),
  plainEnglish: z.string(),
  negotiationAsk: z.string().nullable(),
  verifiedOn: z.string(),
});
export type RuleCard = z.infer<typeof RuleCard>;

export const RulePack = z.array(RuleCard);
export type RulePack = z.infer<typeof RulePack>;

/**
 * 'ingesting' -> extracting text from the uploaded file
 * 'segmented' -> Stage 0 done: clauses exist with offsets, nothing typed or judged yet
 * The remaining states belong to Stages 1-6 (Day 3+).
 */
export const AnalysisStatus = z.enum([
  "ingesting",
  "segmented",
  "framing",
  "typing",
  "adjudicating",
  "synthesizing",
  "done",
  "error",
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatus>;

/* ---------- Judgments (Surface B) ---------- */

export const JudgmentParagraph = z.object({
  index: z.number().int(),
  text: z.string(),
  startOffset: z.number().int(),
  endOffset: z.number().int(),
});
export type JudgmentParagraph = z.infer<typeof JudgmentParagraph>;

export const Judgment = z.object({
  id: z.string(),
  year: z.string(),
  /** Neutral citation as published, e.g. "1950INSC1". */
  citation: z.string().nullable(),
  title: z.string(),
  sourceUrl: z.string(),
  paragraphCount: z.number().int(),
  ingestedAt: z.string(),
});
export type Judgment = z.infer<typeof Judgment>;

/**
 * Every assertion the model makes about a judgment must name the paragraphs
 * it came from. Points whose citations don't resolve are dropped before the
 * user ever sees them — see validateExplanation in explain-judgment.ts.
 */
export const GroundedPoint = z.object({
  text: z.string(),
  paragraphs: z.array(z.number().int()),
});
export type GroundedPoint = z.infer<typeof GroundedPoint>;

export const JudgmentExplanation = z.object({
  /** The question the court was answering. */
  issue: z.array(GroundedPoint),
  /** What it decided. */
  held: z.array(GroundedPoint),
  /** Why. */
  reasoning: z.array(GroundedPoint),
  /** The operative order — who won, what relief. */
  outcome: z.array(GroundedPoint),
  /**
   * The guardrail, and the most useful section for a non-lawyer: the limits
   * the judgment itself sets. Uncited by design — these are statements of
   * absence, and you cannot cite a paragraph for what a court did not say.
   */
  doesNotDecide: z.array(z.string()),
});
export type JudgmentExplanation = z.infer<typeof JudgmentExplanation>;

export const Analysis = z.object({
  id: z.string(),
  status: AnalysisStatus,
  fileName: z.string(),
  gcsUri: z.string(),
  docTypeHint: DocType.nullable(),
  progress: z.object({ total: z.number().int(), done: z.number().int() }),
  error: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type Analysis = z.infer<typeof Analysis>;
