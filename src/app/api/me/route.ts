import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";
import { claimAnalysisForUser, listAnalysesForUser } from "@/lib/firestore-admin";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ user: null, analyses: [] });

  const analyses = await listAnalysesForUser(user.uid);
  return NextResponse.json({ user, analyses });
}

/** Saves an anonymous analysis to the signed-in user's profile. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in to save a document" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const analysisId = body?.analysisId;
  if (typeof analysisId !== "string") {
    return NextResponse.json({ error: "analysisId is required" }, { status: 400 });
  }

  await claimAnalysisForUser(analysisId, user.uid);
  return NextResponse.json({ saved: true });
}
