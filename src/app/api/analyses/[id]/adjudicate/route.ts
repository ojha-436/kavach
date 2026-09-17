import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
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
import { synthesizeReport } from "@/lib/synthesize";
import { DocumentKind } from "@/lib/schema";
import { getSessionUser } from "@/lib/auth-server";

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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // The most expensive endpoint in the app: one Vertex AI call per clause.
  const limited = rateLimit(req, "expensive");
  if (limited) return limited;

  const { id } = await params;

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: "No such analysis" }, { status: 404 });
  }

  // Same ownership rule as reading it: once an analysis belongs to someone
  // it must not be readable — or chargeable — by anyone else.
  const owner = (analysis as { ownerUid?: string }).ownerUid;
  if (owner) {
    const user = await getSessionUser(req);
    if (user?.uid !== owner) {
      return NextResponse.json({ error: "No such analysis" }, { status: 404 });
    }
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
    const { clauses: typed, unchecked } = await typeClauses(
      clauses,
      kind.docType
    );

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

    // Stage 6: the actionable outputs.
    const synthesis = await synthesizeReport({
      kind,
      findings,
      clauses: typed,
      missing: missingProtections,
      riskScore,
    });

    const report: DocumentReport = {
      riskScore,
      counts,
      missingProtections,
      unanalysed,
      // Clauses whose typing never completed. Distinct from `unanalysed`,
      // which means "typed fine, no curated rule covers it". Without the
      // distinction a provider outage produces an empty findings list and a
      // risk score of zero, which reads as a clean bill of health.
      unchecked,
      droppedCitations,
      synthesis,
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
      unchecked,
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
