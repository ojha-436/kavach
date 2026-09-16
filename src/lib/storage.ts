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

/**
 * Signed URLs can't enforce a size limit without the client cooperating on
 * headers, so the cap is enforced here instead: check the object's size
 * before pulling it into memory. A 200 MB upload would otherwise be
 * downloaded in full into a 1 GiB container before anything rejected it.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function downloadFromGcs(gcsUri: string): Promise<Buffer> {
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid GCS URI: ${gcsUri}`);
  const [, bucketName, objectName] = match;

  // Only ever read from the bucket this service owns. Without this, a caller
  // could pass any gs:// URI the service account can reach and use the app
  // as a proxy to read it.
  if (bucketName !== BUCKET) {
    throw new Error("Refusing to read from an unexpected bucket");
  }

  const file = client().bucket(bucketName).file(objectName);

  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size ?? 0);
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `That file is ${(size / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB.`
    );
  }

  const [buf] = await file.download();
  return buf;
}
