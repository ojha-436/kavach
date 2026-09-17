/**
 * Retry for transient model-provider failures.
 *
 * Vertex AI returns 429 RESOURCE_EXHAUSTED when the project's quota is
 * momentarily exhausted, and that quota is per-project and shared — not just
 * across this app's surfaces, but with anything else running in the same
 * Google Cloud project. It is a back-pressure signal, not a rejection of the
 * request, and the correct response is to wait and ask again.
 *
 * Without this, a single 429 became a user-visible feature failure: judgment
 * translation made one call, caught the error, and told the reader the
 * translation "could not be produced reliably" — indistinguishable, from the
 * outside, from the model refusing the content. Observed in production.
 *
 * Backoff is exponential with jitter. The jitter matters more than it looks:
 * the pipeline adjudicates several clauses concurrently, so without it a
 * burst that hits quota together would retry together, recreating the same
 * burst and failing again in lockstep.
 */

/** Status codes that mean "ask again later" rather than "this was wrong". */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * The Vertex SDK folds the status into the message rather than exposing it as
 * a field, e.g. "[VertexAI.ClientError]: got status: 429 Too Many Requests".
 *
 * A regex literal, not one assembled per status with `new RegExp`. The
 * assembled version is where this first went wrong: inside a template literal
 * the backslash escapes are resolved by JavaScript before the regex engine
 * ever sees them, so the pattern quietly lost them and matched nothing. It
 * failed in the worse direction — nothing retried, and the bug wore the
 * costume of a flaky provider.
 *
 * The number has to follow the word "status", because a bare three-digit
 * match would trip on a section number or a figure inside a translated
 * paragraph. The trailing lookahead stops "4290" reading as a 429.
 */
const STATUS_IN_MESSAGE = /status:?[ \t]*([0-9]{3})(?![0-9])/i;

export function isRetryableModelError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!message) return false;

  const match = STATUS_IN_MESSAGE.exec(message);
  return match ? RETRYABLE_STATUS.has(Number(match[1])) : false;
}

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  /** Ceiling per wait, so six attempts stay inside Cloud Run's 300s. */
  maxDelayMs?: number;
  /** Injected in tests so they do not spend real seconds sleeping. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    // Six attempts with a capped backoff spans roughly a minute, which is the
    // horizon that matters: gemini-2.5-flash in asia-south1 runs on shared
    // capacity rather than a fixed per-project allowance, so 429s come in
    // bursts lasting tens of seconds. Three attempts over seven seconds --
    // the first version of this -- gave up while the pool was still busy and
    // surfaced the outage as a conclusion about the user's document.
    attempts = 6,
    baseDelayMs = 1000,
    maxDelayMs = 16000,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    random = Math.random,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // A malformed prompt fails identically however many times it is sent;
      // retrying it just spends the caller's time to reach the same error.
      if (!isRetryableModelError(err)) throw err;
      if (attempt === attempts - 1) break;

      const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      await sleep(backoff + random() * backoff);
    }
  }

  throw lastError;
}
