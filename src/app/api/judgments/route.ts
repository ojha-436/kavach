import { NextRequest, NextResponse } from "next/server";
import {
  searchJudgments,
  judgmentFacets,
  recordActivity,
} from "@/lib/firestore-admin";
import { CORPUS_ATTRIBUTION } from "@/lib/judgments";
import { getSessionUser } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // Filter controls need to know what's actually in the corpus; offering a
  // court with nothing behind it is worse than offering no filter.
  if (sp.get("facets") === "1") {
    return NextResponse.json(await judgmentFacets());
  }

  const q = sp.get("q") ?? "";
  const filters = {
    court: sp.get("court"),
    year: sp.get("year"),
    caseNumber: sp.get("caseNumber"),
  };

  const results = await searchJudgments(q, filters);

  const user = await getSessionUser(req);
  if (user && (q.trim() || filters.court || filters.year || filters.caseNumber)) {
    const bits = [
      q.trim(),
      filters.court,
      filters.year,
      filters.caseNumber ? `case ${filters.caseNumber}` : null,
    ].filter(Boolean);
    await recordActivity({
      uid: user.uid,
      kind: "judgment_search",
      summary: `Searched judgments: ${bits.join(" · ")}`,
      detail: `${results.length} result${results.length === 1 ? "" : "s"}`,
      href: null,
    });
  }

  return NextResponse.json({ results, attribution: CORPUS_ATTRIBUTION });
}
