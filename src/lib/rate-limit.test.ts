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

  it("reads the caller from the first X-Forwarded-For entry", () => {
    const r = new NextRequest("https://kavach.example/", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" },
    });
    expect(clientKey(r)).toBe("203.0.113.9");
  });

  it("still limits when the caller cannot be identified", () => {
    const anon = () => new NextRequest("https://kavach.example/");
    for (let i = 0; i < LIMITS.agent.limit; i++) rateLimit(anon(), "agent");
    expect(rateLimit(anon(), "agent")?.status).toBe(429);
  });
});
