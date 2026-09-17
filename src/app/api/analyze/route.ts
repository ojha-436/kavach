import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { v4 as uuidv4 } from "uuid";
import { downloadFromGcs } from "@/lib/storage";
import { extractText } from "@/lib/extract";
import { segmentDocument } from "@/lib/segment";
import { detectDocumentKind } from "@/lib/frame";
import {
  createAnalysis,
  setAnalysisStatus,
  setAnalysisKind,
  writeClauses,
  recordActivity,
  writeDocumentText,
} from "@/lib/firestore-admin";
import { getSessionUser } from "@/lib/auth-server";

export const maxDuration = 300;

/** Stage 0 (ingest + segment) and Stage 1 (document frame). No verdicts yet. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "expensive");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const { gcsUri, fileName, contentType } = body ?? {};

  if (
    typeof gcsUri !== "string" ||
    typeof fileName !== "string" ||
    typeof contentType !== "string"
  ) {
    return NextResponse.json(
      { error: "gcsUri, fileName and contentType are required" },
      { status: 400 }
    );
  }

  const user = await getSessionUser(req);
  const id = uuidv4();

  await createAnalysis({ id, fileName, gcsUri, ownerUid: user?.uid ?? null });

  try {
    const buffer = await downloadFromGcs(gcsUri);
    const extracted = await extractText(buffer, contentType);

    if (extracted.text.trim().length < 20) {
      throw new Error(
        "No extractable text found. Scanned or image-only PDFs need OCR, which isn't wired up yet."
      );
    }

    // Stage 1 and Stage 0 are independent, so run them together.
    const [kind, clauses] = await Promise.all([
      detectDocumentKind(extracted.text),
      segmentDocument(extracted),
    ]);

    await setAnalysisKind(id, {
      docType: kind.docType,
      docLabel: kind.label,
      state: kind.state ?? null,
      userSide: kind.userSide,
    });
    await writeClauses(id, clauses);
    // Stored so the analysis can be reopened from history. The page renders
    // the document by slicing this exact string with the clause offsets.
    await writeDocumentText(id, extracted.text);
    await setAnalysisStatus(id, "segmented", {
      progress: { total: clauses.length, done: clauses.length },
    });

    if (user) {
      await recordActivity({
        uid: user.uid,
        kind: "upload",
        summary: `Uploaded ${fileName}`,
        detail: `${kind.label} · ${clauses.length} clauses`,
        href: `/analyze?id=${id}`,
      });
    }

    return NextResponse.json({
      id,
      clauses,
      text: extracted.text,
      kind,
      // The rule pack covers two document types. Saying so up front is the
      // difference between limited coverage and a silent wrong answer.
      covered: kind.docType !== "other",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`analyze ${id} failed`, err);
    await setAnalysisStatus(id, "error", { error: message });
    return NextResponse.json({ error: message, id }, { status: 500 });
  }
}
