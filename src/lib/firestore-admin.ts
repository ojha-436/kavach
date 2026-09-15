import { Firestore } from "@google-cloud/firestore";
import { Analysis, AnalysisStatus, Clause } from "./schema";

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
