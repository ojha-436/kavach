import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compares a supplied ingest token against the configured one in constant
 * time, so response latency does not leak how many leading characters of a
 * guess were correct.
 *
 * Both sides are hashed first for two reasons: timingSafeEqual throws when
 * the buffers differ in length, and comparing raw values would make the
 * response time depend on the length of the real token — which is itself
 * worth not leaking.
 *
 * Lives here rather than inline in the route so it can be tested directly; a
 * constant-time comparison that quietly stopped comparing correctly would
 * otherwise be invisible.
 */
export function ingestTokenMatches(
  supplied: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!supplied || !expected) return false;
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}
