/**
 * Splits a document into pieces that fit inside Firestore documents.
 *
 * The analysis page renders the original text and slices it with each
 * clause's start and end offsets, including the gaps between clauses — the
 * preamble, the signature block, the sentence that belongs to no clause. So
 * the stored text has to be the exact string the offsets were computed
 * against. Reassembling it from the clauses would silently drop every gap and
 * shift every offset after the first one.
 *
 * Firestore caps a document at 1 MiB, which a long agreement can approach
 * once the text sits alongside everything else, so it lives in chunked child
 * documents — the same shape judgments already use for paragraphs.
 *
 * The split is by code unit and nothing else. It is tempting to break on
 * paragraph boundaries for tidiness, but any boundary-seeking rule risks
 * adjusting the content, and a single character added or removed moves every
 * offset after it and mislabels the rest of the document.
 */
export const TEXT_CHUNK_CHARS = 200_000;

export function chunkText(text: string, size = TEXT_CHUNK_CHARS): string[] {
  if (size < 1) throw new RangeError("chunk size must be at least 1");
  if (text.length === 0) return [];

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
