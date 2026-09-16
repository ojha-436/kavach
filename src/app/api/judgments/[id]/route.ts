import { NextRequest, NextResponse } from "next/server";
import { getJudgment, recordActivity } from "@/lib/firestore-admin";
import { explainJudgment } from "@/lib/explain-judgment";
import { CORPUS_ATTRIBUTION } from "@/lib/judgments";
import { translateExplanation, isSupportedLanguage, LANGUAGES } from "@/lib/translate";
import { getSessionUser } from "@/lib/auth-server";

export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getJudgment(id);
  if (!record) {
    return NextResponse.json({ error: "Judgment not found" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const explain = sp.get("explain") === "1";
  const lang = sp.get("lang");

  if (!explain) {
    return NextResponse.json({
      judgment: record.judgment,
      paragraphs: record.paragraphs,
      attribution: CORPUS_ATTRIBUTION,
      languages: LANGUAGES,
    });
  }

  try {
    const { explanation, droppedClaims, truncated } = await explainJudgment(
      record.paragraphs
    );

    let translated = null;
    let translationError: string | null = null;
    if (lang && isSupportedLanguage(lang)) {
      try {
        translated = await translateExplanation(explanation, lang);
      } catch (err) {
        console.error(`translation to ${lang} failed`, err);
        translationError =
          "The translation could not be produced reliably, so the English explanation is shown instead.";
      }
    }

    const user = await getSessionUser(req);
    if (user) {
      await recordActivity({
        uid: user.uid,
        kind: "judgment_view",
        summary: `Read ${record.judgment.title}`,
        detail: [record.judgment.court, record.judgment.year]
          .filter(Boolean)
          .join(" · "),
        href: `/judgments/${id}`,
      });
    }

    return NextResponse.json({
      judgment: record.judgment,
      paragraphs: record.paragraphs,
      explanation,
      translated,
      translationError,
      language: translated ? lang : null,
      droppedClaims,
      truncated,
      attribution: CORPUS_ATTRIBUTION,
      languages: LANGUAGES,
    });
  } catch (err) {
    console.error(`explain ${id} failed`, err);
    return NextResponse.json(
      { error: "Could not produce a grounded explanation for this judgment." },
      { status: 500 }
    );
  }
}
