import { extractPdfText, pageForOffset } from "./extract-pdf";
import { extractDocxText } from "./extract-docx";

export type ExtractedDocument = {
  text: string;
  pageForOffset: (offset: number) => number | null;
};

export async function extractText(
  buffer: Buffer,
  contentType: string
): Promise<ExtractedDocument> {
  if (contentType === "application/pdf") {
    const { text, pageBreaks } = await extractPdfText(buffer);
    return { text, pageForOffset: (offset) => pageForOffset(pageBreaks, offset) };
  }

  if (
    contentType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { text } = await extractDocxText(buffer);
    return { text, pageForOffset: () => null };
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}
