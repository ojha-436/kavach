import { NextRequest, NextResponse } from "next/server";
import { getJudgment } from "@/lib/firestore-admin";
import { explainJudgment } from "@/lib/explain-judgment";
import { CORPUS_ATTRIBUTION } from "@/lib/judgments";

export const maxDuration = 120;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getJudgment(id);
  if (!record) {
    return NextResponse.json({ error: "Judgment not found" }, { status: 404 });
  }

  const explain = req.nextUrl.searchParams.get("explain") === "1";
  if (!explain) {
    return NextResponse.json({
      judgment: record.judgment,
      paragraphs: record.paragraphs,
      attribution: CORPUS_ATTRIBUTION,
    });
  }

  try {
    const { explanation, droppedClaims, truncated } = await explainJudgment(
      record.paragraphs
    );
    return NextResponse.json({
      judgment: record.judgment,
      paragraphs: record.paragraphs,
      explanation,
      droppedClaims,
      truncated,
      attribution: CORPUS_ATTRIBUTION,
    });
  } catch (err) {
    console.error(`explain ${id} failed`, err);
    return NextResponse.json(
      { error: "Could not produce a grounded explanation for this judgment." },
      { status: 500 }
    );
  }
}
