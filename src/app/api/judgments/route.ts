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
    // Facets only change when the corpus is ingested, which is an admin
    // action measured in weeks. Re-reading them from Firestore on every load
    // of the search page is a round trip spent to learn nothing new.
    return NextResponse.json(await judgmentFacets(), {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  const q = sp.get("q") ?? "";
  const filters = {
    court: sp.get("court"),
    year: sp.get("year"),
    caseNumber: sp.get("caseNumber"),
  };

  // Independent of each other: the search hits Firestore, the session check
  // verifies a bearer token. Running them in series made every search wait
  // for a token verification whose result it does not need to produce results.
  const [results, user] = await Promise.all([
    searchJudgments(q, filters),
    getSessionUser(req),
  ]);
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
