import { NextRequest, NextResponse } from "next/server";
import {
  getAnalysis,
  listClauses,
  setAnalysisStatus,
  updateClauseAnalysis,
  writeReport,
  getReport,
  type DocumentReport,
} from "@/lib/firestore-admin";
import { typeClauses } from "@/lib/classify-clauses";
import { adjudicateClauses } from "@/lib/adjudicate";
import { findMissingProtections } from "@/lib/absence";
import { DocumentKind } from "@/lib/schema";

export const maxDuration = 300;

/** Severity weights, so one VOID clause outranks a pile of onerous ones. */
const WEIGHT: Record<string, number> = {
  VOID: 10,
  UNENFORCEABLE_IN_PART: 6,
  ONEROUS_BUT_VALID: 3,
  STANDARD: 0,
  FAVOURABLE: 0,
};

/** Stages 2, 4 and 5. Runs after Stage 0/1 so clauses render immediately. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: "No such analysis" }, { status: 404 });
  }

  const kind: DocumentKind = {
    docType: analysis.docType,
    label: analysis.docLabel,
    state: analysis.state,
    userSide: "unknown",
  };

  if (kind.docType === "other") {
    return NextResponse.json({
      covered: false,
      findings: [],
      missingProtections: [],
      report: null,
      message:
        "No curated statutory rules cover this document type, so it is not adjudicated.",
    });
  }

  try {
    const clauses = await listClauses(id);

    await setAnalysisStatus(id, "typing");
    const typed = await typeClauses(clauses, kind.docType);

    await setAnalysisStatus(id, "adjudicating", {
      progress: { total: typed.length, done: 0 },
    });
    const { findings, unanalysed, droppedCitations } = await adjudicateClauses(
      typed,
      kind
    );

    await setAnalysisStatus(id, "synthesizing");
    const missingProtections = findMissingProtections(typed, kind);

    const counts: Record<string, number> = {};
    let weighted = 0;
    for (const f of findings) {
      counts[f.verdict] = (counts[f.verdict] ?? 0) + 1;
      weighted += (WEIGHT[f.verdict] ?? 0) + f.severity;
    }
    // Normalised 0-100 against a notional "every clause is a severity-5 VOID"
    // ceiling, then capped, so the number is comparable between documents.
    const ceiling = Math.max(typed.length, 1) * 15;
    const riskScore = Math.min(100, Math.round((weighted / ceiling) * 100));

    const report: DocumentReport = {
      riskScore,
      counts,
      missingProtections,
      unanalysed,
      droppedCitations,
      generatedAt: new Date().toISOString(),
    };

    await updateClauseAnalysis(id, typed, findings);
    await writeReport(id, report);
    await setAnalysisStatus(id, "done", {
      progress: { total: typed.length, done: typed.length },
    });

    return NextResponse.json({
      covered: true,
      clauses: typed,
      findings,
      missingProtections,
      report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`adjudicate ${id} failed`, err);
    await setAnalysisStatus(id, "error", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ report: null });
  return NextResponse.json({ report, clauses: await listClauses(id) });
}
