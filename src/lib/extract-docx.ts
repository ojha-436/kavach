import mammoth from "mammoth";

export async function extractDocxText(buffer: Buffer): Promise<{ text: string }> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value };
}
