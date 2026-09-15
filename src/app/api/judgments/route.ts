import { NextRequest, NextResponse } from "next/server";
import { searchJudgments } from "@/lib/firestore-admin";
import { CORPUS_ATTRIBUTION } from "@/lib/judgments";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchJudgments(q);
  return NextResponse.json({ results, attribution: CORPUS_ATTRIBUTION });
}
