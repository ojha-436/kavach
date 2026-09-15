import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { downloadFromGcs } from "@/lib/storage";
import { extractText } from "@/lib/extract";
import { segmentDocument } from "@/lib/segment";
import { createAnalysis, setAnalysisStatus, writeClauses } from "@/lib/firestore-admin";
import { DocType } from "@/lib/schema";

/** Stage 0 (Architecture SS4.2): GCS -> text + offsets -> Clause[]. No adjudication yet. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { gcsUri, fileName, contentType, docTypeHint } = body ?? {};

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

  const parsedDocType = DocType.safeParse(docTypeHint);
  const id = uuidv4();

  await createAnalysis({
    id,
    fileName,
    gcsUri,
    docTypeHint: parsedDocType.success ? parsedDocType.data : null,
  });

  try {
    const buffer = await downloadFromGcs(gcsUri);
    const extracted = await extractText(buffer, contentType);

    if (extracted.text.trim().length < 20) {
      throw new Error(
        "No extractable text found. Scanned/image-only PDFs need OCR, which isn't wired up yet."
      );
    }

    const clauses = await segmentDocument(extracted);

    await writeClauses(id, clauses);
    await setAnalysisStatus(id, "segmented", {
      progress: { total: clauses.length, done: clauses.length },
    });

    return NextResponse.json({ id, clauses, text: extracted.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`analyze ${id} failed`, err);
    await setAnalysisStatus(id, "error", { error: message });
    return NextResponse.json({ error: message, id }, { status: 500 });
  }
}
