import { createHash } from "node:crypto";

/**
 * Cache key for a single-shot model call.
 *
 * The pipeline's structured stages — document framing, clause typing,
 * adjudication, synthesis — are deterministic functions of their prompt. Re-running
 * one costs seconds of latency and real tokens to produce text that is, for
 * the same input, meant to be the same text.
 *
 * The key is the whole request, not a summary of it: system instruction,
 * prompt, response schema and model id. That is deliberately conservative.
 * It would be tempting to key adjudication on just the clause text, so that
 * boilerplate shared between two different contracts hits the cache — but the
 * adjudication prompt also carries the document label, the governing state,
 * which side the reader is on, the joined rule cards and the neighbouring
 * clause headings, and every one of those can legitimately change the
 * verdict. A cache that ignored them would serve a confident answer computed
 * for a different question, which in this application means a wrong statement
 * about someone's legal position. Slower and right beats faster and wrong.
 *
 * Keying on the full prompt still collects the case that actually matters:
 * the same document analysed again. That is the repeat demo, the shared link,
 * the user who re-uploads after a refresh.
 *
 * The model id is in the key so that changing models invalidates everything
 * rather than serving one model's output as another's.
 */
export function modelCacheKey(input: {
  model: string;
  systemInstruction: string;
  prompt: string;
  responseSchema?: object;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        model: input.model,
        systemInstruction: input.systemInstruction,
        prompt: input.prompt,
        // undefined and {} are different requests; JSON.stringify would
        // collapse a missing key, so normalise it to an explicit null.
        responseSchema: input.responseSchema ?? null,
      })
    )
    .digest("hex");
}
