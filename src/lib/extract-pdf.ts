import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfExtraction = {
  text: string;
  /** pageBreaks[i] = char offset in `text` where page i+1 starts. */
  pageBreaks: number[];
};

/**
 * Stage 0 ingest (Architecture SS4.2): plain text plus enough structure to
 * map any character offset back to a page number. No LLM involved here.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfExtraction> {
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  let text = "";
  const pageBreaks: number[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    pageBreaks.push(text.length);
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    let pageText = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 1) {
        pageText += "\n";
      }
      pageText += item.str;
      if (item.hasEOL) pageText += "\n";
      lastY = y;
    }

    text += pageText;
    if (pageNum < doc.numPages) text += "\n\n";
    await page.cleanup();
  }

  await doc.destroy();
  return { text, pageBreaks };
}

export function pageForOffset(pageBreaks: number[], offset: number): number {
  let page = 1;
  for (let i = 0; i < pageBreaks.length; i++) {
    if (offset >= pageBreaks[i]) page = i + 1;
    else break;
  }
  return page;
}
