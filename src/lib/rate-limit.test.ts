import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { rateLimit, clientKey, LIMITS, __resetRateLimits } from "./rate-limit";

function req(ip: string): NextRequest {
  return new NextRequest("https://kavach.example/api/agent", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rate limiting", () => {
  beforeEach(() => {
    __resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("allows requests up to the limit", () => {
    for (let i = 0; i < LIMITS.agent.limit; i++) {
      expect(rateLimit(req("1.1.1.1"), "agent")).toBeNull();
    }
  });

  it("blocks the request after the limit with a 429", () => {
    for (let i = 0; i < LIMITS.agent.limit; i++) rateLimit(req("1.1.1.1"), "agent");
    const blocked = rateLimit(req("1.1.1.1"), "agent");
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
  });

  it("counts each caller separately", () => {
    for (let i = 0; i < LIMITS.agent.limit; i++) rateLimit(req("1.1.1.1"), "agent");
    expect(rateLimit(req("1.1.1.1"), "agent")?.status).toBe(429);
    // A different caller must be unaffected by someone else's spending.
    expect(rateLimit(req("2.2.2.2"), "agent")).toBeNull();
  });

  it("counts each bucket separately", () => {
    for (let i = 0; i < LIMITS.expensive.limit; i++) {
      rateLimit(req("1.1.1.1"), "expensive");
    }
    expect(rateLimit(req("1.1.1.1"), "expensive")?.status).toBe(429);
    // Exhausting analysis must not lock the user out of asking questions.
    expect(rateLimit(req("1.1.1.1"), "agent")).toBeNull();
  });

  it("lets the caller back in once the window passes", () => {
    for (let i = 0; i < LIMITS.agent.limit; i++) rateLimit(req("1.1.1.1"), "agent");
    expect(rateLimit(req("1.1.1.1"), "agent")?.status).toBe(429);

    vi.advanceTimersByTime(LIMITS.agent.windowMs + 1000);
    expect(rateLimit(req("1.1.1.1"), "agent")).toBeNull();
  });

  // Was: "reads the caller from the first X-Forwarded-For entry", asserting
  // 203.0.113.9 for this chain. It passed, and it was wrong — the first entry
  // is whatever the caller sent. A green test asserting the broken behaviour
  // is worse than no test, because it makes the bug look deliberate.
  it("reads the caller from the last X-Forwarded-For entry", () => {
    const r = new NextRequest("https://kavach.example/", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" },
    });
    expect(clientKey(r)).toBe("10.0.0.2");
  });

  it("still limits when the caller cannot be identified", () => {
    const anon = () => new NextRequest("https://kavach.example/");
    for (let i = 0; i < LIMITS.agent.limit; i++) rateLimit(anon(), "agent");
    expect(rateLimit(anon(), "agent")?.status).toBe(429);
  });
});

/**
 * These pin the spoofing fix. The shapes below are the exact chains Cloud Run
 * was observed to hand the container when a caller supplies zero, one and two
 * forwarded hops of their own — see the comment on clientKey. If someone
 * "tidies" this back to reading the first hop, the limiter silently stops
 * limiting anything, which is the kind of regression that shows up as a
 * Vertex AI bill rather than as a failure.
 */
describe("clientKey against a forged X-Forwarded-For", () => {
  const withChain = (chain: string) =>
    clientKey(
      new NextRequest("https://kavach.example/api/agent", {
        headers: { "x-forwarded-for": chain },
      })
    );

  it("uses the only hop when the caller sends none of their own", () => {
    expect(withChain("203.0.113.9")).toBe("203.0.113.9");
  });

  it("ignores a single forged hop in favour of the appended one", () => {
    expect(withChain("198.51.100.7,203.0.113.9")).toBe("203.0.113.9");
  });

  it("ignores a whole forged chain", () => {
    expect(withChain("198.51.100.7, 198.51.100.8,203.0.113.9")).toBe(
      "203.0.113.9"
    );
  });

  it("gives a caller the same bucket however they vary the forged prefix", () => {
    // The actual attack: rotate the spoofed value to get a fresh allowance.
    const keys = new Set([
      withChain("1.1.1.1,203.0.113.9"),
      withChain("2.2.2.2,203.0.113.9"),
      withChain("3.3.3.3, 4.4.4.4,203.0.113.9"),
      withChain("203.0.113.9"),
    ]);
    expect(keys.size).toBe(1);
  });

  it("still separates genuinely different callers", () => {
    expect(withChain("203.0.113.9")).not.toBe(withChain("203.0.113.10"));
  });

  it("tolerates padding and empty hops rather than keying on blank", () => {
    expect(withChain("  198.51.100.7 ,  , 203.0.113.9  ")).toBe("203.0.113.9");
  });

  it("falls back to a constant when the header is absent or useless", () => {
    expect(
      clientKey(new NextRequest("https://kavach.example/api/agent"))
    ).toBe("unknown");
    expect(withChain("")).toBe("unknown");
    expect(withChain("  ,  ")).toBe("unknown");
  });
});

describe("rate limiting cannot be escaped by forging hops", () => {
  beforeEach(() => __resetRateLimits());

  it("429s on schedule even as the forged prefix changes every request", () => {
    const attempt = (n: number) =>
      rateLimit(
        new NextRequest("https://kavach.example/api/agent", {
          headers: { "x-forwarded-for": `198.51.100.${n},203.0.113.9` },
        }),
        "agent"
      );

    for (let i = 0; i < LIMITS.agent.limit; i++) {
      expect(attempt(i)).toBeNull();
    }
    expect(attempt(LIMITS.agent.limit)?.status).toBe(429);
  });
});
