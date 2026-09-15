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
  docTypeHint: Analysis["docTypeHint"];
}): Promise<Analysis> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000);

  const analysis: Analysis = {
    id: params.id,
    status: "ingesting",
    fileName: params.fileName,
    gcsUri: params.gcsUri,
    docTypeHint: params.docTypeHint,
    progress: { total: 0, done: 0 },
    error: null,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await client().collection("analyses").doc(params.id).set(analysis);
  return analysis;
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

export async function searchJudgments(
  query: string
): Promise<Array<Pick<Judgment, "id" | "title" | "citation" | "year">>> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];

  const snap = await client().collection("judgments").limit(500).get();
  return snap.docs
    .map((d) => d.data() as Judgment & { searchText?: string })
    .map((j) => ({
      j,
      score: terms.filter((t) => (j.searchText ?? "").includes(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ j }) => ({
      id: j.id,
      title: j.title,
      citation: j.citation,
      year: j.year,
    }));
}
