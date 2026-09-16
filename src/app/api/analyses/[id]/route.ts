import { NextRequest, NextResponse } from "next/server";
import { getAnalysis, listClauses } from "@/lib/firestore-admin";
import { getSessionUser } from "@/lib/auth-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Anonymous analyses are protected only by an unguessable id and expire in
  // 24h — a documented v1 limitation. But once an analysis belongs to a
  // signed-in user it stops expiring, so from then on it needs a real
  // ownership check rather than obscurity.
  const owner = (analysis as { ownerUid?: string }).ownerUid;
  if (owner) {
    const user = await getSessionUser(req);
    if (user?.uid !== owner) {
      // 404 rather than 403: confirming that an id exists is itself a leak.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const clauses = await listClauses(id);
  return NextResponse.json({ analysis, clauses });
}
