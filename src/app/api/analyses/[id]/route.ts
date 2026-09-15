import { NextRequest, NextResponse } from "next/server";
import { getAnalysis, listClauses } from "@/lib/firestore-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const clauses = await listClauses(id);
  return NextResponse.json({ analysis, clauses });
}
