import { NextRequest, NextResponse } from "next/server";
import {
  getJudgment,
  recordActivity,
  getCachedExplanation,
  putCachedExplanation,
} from "@/lib/firestore-admin";
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

  // A judgment's text is immutable once ingested, so it is safe to let the
  // browser and any CDN in front of Cloud Run hold onto it.
  const IMMUTABLE = {
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
  };

  if (!explain) {
    return NextResponse.json(
      {
        judgment: record.judgment,
        paragraphs: record.paragraphs,
        attribution: CORPUS_ATTRIBUTION,
        languages: LANGUAGES,
      },
      { headers: IMMUTABLE }
    );
  }

  try {
    // A judgment's text never changes, so its explanation is a pure function
    // of it. Regenerating per page view cost ~25s and real money for
    // byte-identical output.
    let cached = await getCachedExplanation(id, "en");
    if (!cached) {
      const fresh = await explainJudgment(record.paragraphs);
      cached = { ...fresh, generatedAt: new Date().toISOString() };
      await putCachedExplanation(id, "en", cached);
    }
    const { explanation, droppedClaims, truncated } = cached;

    let translated = null;
    let translationError: string | null = null;
    if (lang && isSupportedLanguage(lang)) {
      try {
        const cachedTranslation = await getCachedExplanation(id, lang);
        if (cachedTranslation) {
          translated = cachedTranslation.explanation;
        } else {
          translated = await translateExplanation(explanation, lang);
          await putCachedExplanation(id, lang, {
            explanation: translated,
            droppedClaims,
            truncated,
            generatedAt: new Date().toISOString(),
          });
        }
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

    return NextResponse.json(
      {
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
      },
      // Don't cache a response that fell back to English after a failed
      // translation, or the reader is stuck with it for an hour.
      { headers: translationError ? {} : IMMUTABLE }
    );
  } catch (err) {
    console.error(`explain ${id} failed`, err);
    return NextResponse.json(
      { error: "Could not produce a grounded explanation for this judgment." },
      { status: 500 }
    );
  }
}
