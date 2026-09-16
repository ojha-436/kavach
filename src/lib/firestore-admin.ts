import { Firestore } from "@google-cloud/firestore";
import {
  Analysis,
  AnalysisStatus,
  Clause,
  Judgment,
  JudgmentParagraph,
} from "./schema";

let db: Firestore | null = null;

function client(): Firestore {
  if (!db) db = new Firestore();
  return db;
}

const TTL_HOURS = 24;

export async function createAnalysis(params: {
  id: string;
  fileName: string;
  gcsUri: string;
  ownerUid?: string | null;
}): Promise<Analysis> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000);

  const analysis: Analysis = {
    id: params.id,
    status: "ingesting",
    fileName: params.fileName,
    gcsUri: params.gcsUri,
    docType: "other",
    docLabel: "Identifying…",
    state: null,
    progress: { total: 0, done: 0 },
    error: null,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await client()
    .collection("analyses")
    .doc(params.id)
    // A signed-in user owns their document from the moment it is created, so
    // it survives the 24h TTL without a separate "save" step.
    .set(
      params.ownerUid
        ? { ...analysis, ownerUid: params.ownerUid, expiresAt: null }
        : analysis
    );
  return analysis;
}

export async function setAnalysisKind(
  id: string,
  kind: { docType: Analysis["docType"]; docLabel: string; state: string | null }
): Promise<void> {
  await client().collection("analyses").doc(id).set(kind, { merge: true });
}

export async function setAnalysisStatus(
  id: string,
  status: AnalysisStatus,
  extra?: Partial<Pick<Analysis, "error" | "progress">>
): Promise<void> {
  await client()
    .collection("analyses")
    .doc(id)
    .set({ status, ...extra }, { merge: true });
}

export async function getAnalysis(id: string): Promise<Analysis | null> {
  const snap = await client().collection("analyses").doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as Analysis;
}

export async function writeClauses(
  analysisId: string,
  clauses: Clause[]
): Promise<void> {
  const batch = client().batch();
  const col = client().collection("analyses").doc(analysisId).collection("clauses");
  for (const clause of clauses) {
    batch.set(col.doc(clause.id), clause);
  }
  await batch.commit();
}

export async function listClauses(analysisId: string): Promise<Clause[]> {
  const snap = await client()
    .collection("analyses")
    .doc(analysisId)
    .collection("clauses")
    .orderBy("startOffset", "asc")
    .get();
  return snap.docs.map((d) => d.data() as Clause);
}

/** Ties an anonymous analysis to a signed-in user so it survives past the 24h TTL. */
export async function claimAnalysisForUser(
  analysisId: string,
  uid: string
): Promise<void> {
  await client()
    .collection("analyses")
    .doc(analysisId)
    .set({ ownerUid: uid, expiresAt: null }, { merge: true });
}

export async function listAnalysesForUser(uid: string): Promise<Analysis[]> {
  const snap = await client()
    .collection("analyses")
    .where("ownerUid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => d.data() as Analysis);
}

/* ---------- Session history ---------- */

export type ActivityKind = "upload" | "question" | "judgment_search" | "judgment_view";

export type ActivityEntry = {
  id: string;
  uid: string;
  kind: ActivityKind;
  /** What the user sees in the history list. */
  summary: string;
  /** Where clicking the entry goes, when there is somewhere to go. */
  href: string | null;
  detail: string | null;
  createdAt: string;
};

/**
 * History is per signed-in user. Anonymous sessions are not logged at all —
 * writing an activity trail for someone who never identified themselves
 * would be collecting more than the product needs, which is the opposite of
 * what the privacy pitch promises.
 */
export async function recordActivity(
  entry: Omit<ActivityEntry, "id" | "createdAt">
): Promise<void> {
  const db = client();
  const ref = db.collection("users").doc(entry.uid).collection("activity").doc();
  await ref.set({
    ...entry,
    id: ref.id,
    createdAt: new Date().toISOString(),
  });
}

export async function listActivity(uid: string, limit = 100): Promise<ActivityEntry[]> {
  const snap = await client()
    .collection("users")
    .doc(uid)
    .collection("activity")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as ActivityEntry);
}

export async function clearActivity(uid: string): Promise<void> {
  const col = client().collection("users").doc(uid).collection("activity");
  const snap = await col.get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

/* ---------- Judgments ---------- */

export type JudgmentRecord = {
  judgment: Judgment;
  paragraphs: JudgmentParagraph[];
};

export async function writeJudgment(record: JudgmentRecord): Promise<void> {
  const db = client();
  const ref = db.collection("judgments").doc(record.judgment.id);
  await ref.set({
    ...record.judgment,
    // Lowercased haystack so the keyword tool can match without a separate
    // search service. Body text is included, not just the title: a judgment
    // about staying an arbitral award rarely says so in its case name.
    // Embedding search (text-multilingual-embedding-002, in-region) is the
    // Day 5b upgrade.
    searchText: [
      record.judgment.title,
      record.judgment.citation ?? "",
      record.judgment.court,
      record.judgment.caseNumber ?? "",
      record.paragraphs
        .slice(0, 12)
        .map((p) => p.text)
        .join(" ")
        .slice(0, 8000),
    ]
      .join(" ")
      .toLowerCase(),
  });

  // Clear existing chunks first: a re-ingest that produces fewer paragraphs
  // would otherwise leave orphaned tail chunks behind, and those would show
  // up as phantom paragraphs that citations could point at.
  const existing = await ref.collection("paragraphs").get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));

  // Paragraphs can exceed the 1 MiB document limit on long judgments, so
  // they live in chunked child documents rather than on the parent.
  const CHUNK = 40;
  for (let i = 0; i < record.paragraphs.length; i += CHUNK) {
    await ref
      .collection("paragraphs")
      .doc(String(i / CHUNK))
      .set({ items: record.paragraphs.slice(i, i + CHUNK) });
  }
}

export async function getJudgment(id: string): Promise<JudgmentRecord | null> {
  const ref = client().collection("judgments").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const chunks = await ref.collection("paragraphs").get();
  const paragraphs = chunks.docs
    .sort((a, b) => Number(a.id) - Number(b.id))
    .flatMap((d) => (d.data().items ?? []) as JudgmentParagraph[]);

  return { judgment: snap.data() as Judgment, paragraphs };
}

export type JudgmentFilters = {
  court?: string | null;
  year?: string | null;
  caseNumber?: string | null;
};

export type JudgmentHit = Pick<
  Judgment,
  "id" | "title" | "citation" | "year" | "court" | "caseNumber"
>;

export async function searchJudgments(
  query: string,
  filters: JudgmentFilters = {}
): Promise<JudgmentHit[]> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const caseNo = filters.caseNumber?.toLowerCase().trim();

  // A filter-only search is valid: "show me everything from this court in
  // 2024" is a reasonable thing to ask without any keywords.
  const hasCriteria =
    terms.length > 0 || !!caseNo || !!filters.court || !!filters.year;
  if (!hasCriteria) return [];

  const snap = await client().collection("judgments").limit(500).get();

  return snap.docs
    .map((d) => d.data() as Judgment & { searchText?: string })
    .filter((j) => !filters.court || j.court === filters.court)
    .filter((j) => !filters.year || j.year === filters.year)
    .filter((j) => {
      if (!caseNo) return true;
      const digits = (s: string) => s.replace(/[^0-9]/g, "");
      const hay = `${j.caseNumber ?? ""} ${j.citation ?? ""} ${j.id}`.toLowerCase();
      // Match on digits too, so "11030/2024" finds "Civil Appeal No. 11030 of 2024".
      return hay.includes(caseNo) || digits(hay).includes(digits(caseNo));
    })
    .map((j) => ({
      j,
      score: terms.length
        ? terms.filter((t) => (j.searchText ?? "").includes(t)).length
        : 1,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.j.year) - Number(a.j.year))
    .slice(0, 20)
    .map(({ j }) => ({
      id: j.id,
      title: j.title,
      citation: j.citation,
      year: j.year,
      court: j.court,
      caseNumber: j.caseNumber,
    }));
}

/** Distinct courts and years present in the corpus, for the filter controls. */
export async function judgmentFacets(): Promise<{
  courts: string[];
  years: string[];
}> {
  const snap = await client().collection("judgments").limit(500).get();
  const courts = new Set<string>();
  const years = new Set<string>();
  for (const d of snap.docs) {
    const j = d.data() as Judgment;
    if (j.court) courts.add(j.court);
    if (j.year) years.add(j.year);
  }
  return {
    courts: [...courts].sort(),
    years: [...years].sort((a, b) => Number(b) - Number(a)),
  };
}
