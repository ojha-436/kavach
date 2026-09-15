import { Storage } from "@google-cloud/storage";

const BUCKET = process.env.UPLOADS_BUCKET ?? "kavach-uploads-promptwar-501405";

let storage: Storage | null = null;

function client(): Storage {
  if (!storage) storage = new Storage();
  return storage;
}

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType);
}

/**
 * Stage 0 precondition: a signed PUT URL so the browser uploads straight to
 * GCS and Cloud Run never touches the raw bytes (Architecture SS2, SS5.1).
 */
export async function getSignedUploadUrl(
  objectName: string,
  contentType: string
): Promise<{ uploadUrl: string; gcsUri: string }> {
  const bucket = client().bucket(BUCKET);
  const file = bucket.file(objectName);

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 10 * 60 * 1000,
    contentType,
  });

  return { uploadUrl, gcsUri: `gs://${BUCKET}/${objectName}` };
}

export async function downloadFromGcs(gcsUri: string): Promise<Buffer> {
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid GCS URI: ${gcsUri}`);
  const [, bucketName, objectName] = match;
  const [buf] = await client().bucket(bucketName).file(objectName).download();
  return buf;
}
