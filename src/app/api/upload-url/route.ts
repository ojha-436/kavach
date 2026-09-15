import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getSignedUploadUrl, isAllowedContentType } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fileName = body?.fileName;
  const contentType = body?.contentType;

  if (typeof fileName !== "string" || typeof contentType !== "string") {
    return NextResponse.json(
      { error: "fileName and contentType are required" },
      { status: 400 }
    );
  }
  if (!isAllowedContentType(contentType)) {
    return NextResponse.json(
      { error: "Only PDF and DOCX are supported" },
      { status: 400 }
    );
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-100);
  const objectName = `uploads/${uuidv4()}/${safeName}`;

  try {
    const { uploadUrl, gcsUri } = await getSignedUploadUrl(objectName, contentType);
    return NextResponse.json({ uploadUrl, gcsUri });
  } catch (err) {
    console.error("Failed to sign upload URL", err);
    return NextResponse.json(
      { error: "Could not create an upload URL" },
      { status: 500 }
    );
  }
}
