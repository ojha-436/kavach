import { NextRequest, NextResponse } from "next/server";

/**
 * In-process rate limiting for the endpoints that cost money.
 *
 * Upload, analysis, adjudication and the agent each spend Vertex AI tokens
 * on an unauthenticated request. Without a limit, a single script can run up
 * a bill and exhaust quota for everyone else — the realistic attack on a
 * demo like this is not data theft, it is cost.
 *
 * Deliberately simple: a fixed window in memory. Cloud Run may run several
 * instances, so the effective limit is per instance rather than global. That
 * is a real limitation, honestly stated — the correct production answer is a
 * shared counter or Cloud Armor, which is more infrastructure than a
 * hackathon build needs. It still stops the trivial abuse case.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Keeps the map from growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function clientKey(req: NextRequest): string {
  // Cloud Run puts the caller first in X-Forwarded-For.
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip || "unknown";
}

export type RateLimit = { limit: number; windowMs: number };

export const LIMITS = {
  /** LLM-heavy: full document analysis and adjudication. */
  expensive: { limit: 10, windowMs: 10 * 60 * 1000 },
  /** LLM-heavy but conversational, so a little more headroom. */
  agent: { limit: 30, windowMs: 10 * 60 * 1000 },
  /** Cheap but writes to storage. */
  upload: { limit: 20, windowMs: 10 * 60 * 1000 },
} satisfies Record<string, RateLimit>;

/**
 * Returns a 429 response when the caller is over budget, or null to proceed.
 */
export function rateLimit(
  req: NextRequest,
  name: keyof typeof LIMITS
): NextResponse | null {
  const { limit, windowMs } = LIMITS[name];
  const now = Date.now();
  sweep(now);

  const key = `${name}:${clientKey(req)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= limit) return null;

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  return NextResponse.json(
    {
      error:
        "You've made a lot of requests in a short time. Please wait a few minutes and try again.",
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/** Test seam: resets state between cases. */
export function __resetRateLimits() {
  buckets.clear();
}
