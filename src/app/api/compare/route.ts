import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getAnalysis, listClauses, getReport } from "@/lib/firestore-admin";
import { compareAnalyses, type SideInput } from "@/lib/compare";
import { getSessionUser } from "@/lib/auth-server";
import type { ClauseFinding, DocumentKind } from "@/lib/schema";

export const maxDuration = 120;

async function loadSide(
  id: string,
  req: NextRequest
): Promise<SideInput | { error: string; status: number }> {
  const analysis = await getAnalysis(id);
  if (!analysis) return { error: "One of those analyses no longer exists.", status: 404 };

  const owner = (analysis as { ownerUid?: string }).ownerUid;
  if (owner) {
    const user = await getSessionUser(req);
    if (user?.uid !== owner) {
      return { error: "One of those analyses no longer exists.", status: 404 };
    }
  }

  const clauses = await listClauses(id);
  const report = await getReport(id);

  const findings = clauses
    .map((c) => (c as unknown as { finding?: ClauseFinding }).finding)
    .filter((f): f is ClauseFinding => !!f);

  const kind: DocumentKind = {
    docType: analysis.docType,
    label: analysis.docLabel,
    state: analysis.state,
    userSide: "unknown",
  };

  return {
    side: {
      id,
      label: analysis.docLabel,
      fileName: analysis.fileName,
      riskScore: report?.riskScore ?? 0,
      clauseCount: clauses.length,
    },
    kind,
    clauses,
    findings,
  };
}

/** Compares two already-analysed documents. Deterministic — no model call. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "agent");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const a = body?.a;
  const b = body?.b;

  if (typeof a !== "string" || typeof b !== "string") {
    return NextResponse.json(
      { error: "Two analysis ids are required" },
      { status: 400 }
    );
  }
  if (a === b) {
    return NextResponse.json(
      { error: "Those are the same document." },
      { status: 400 }
    );
  }

  const [sideA, sideB] = await Promise.all([loadSide(a, req), loadSide(b, req)]);
  for (const side of [sideA, sideB]) {
    if ("error" in side) {
      return NextResponse.json({ error: side.error }, { status: side.status });
    }
  }

  return NextResponse.json(
    compareAnalyses(sideA as SideInput, sideB as SideInput)
  );
}
