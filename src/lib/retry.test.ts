import { describe, it, expect, vi } from "vitest";
import { withRetry, isRetryableModelError } from "./retry";

const noSleep = { sleep: async () => {}, random: () => 0 };
const vertex429 = new Error(
  "[VertexAI.ClientError]: got status: 429 Too Many Requests. Resource exhausted."
);

describe("isRetryableModelError", () => {
  it("recognises the Vertex 429 shape seen in production", () => {
    expect(isRetryableModelError(vertex429)).toBe(true);
  });

  it("recognises the other back-pressure codes", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isRetryableModelError(new Error(`got status: ${status}`))).toBe(true);
    }
  });

  it("does not retry a request that was simply wrong", () => {
    expect(isRetryableModelError(new Error("got status: 400 Bad Request"))).toBe(
      false
    );
    expect(isRetryableModelError(new Error("got status: 403 Forbidden"))).toBe(
      false
    );
  });

  it("does not trip on a number that merely appears in the text", () => {
    // Model output can contain anything, including "429" or a section number.
    expect(isRetryableModelError(new Error("Section 429 of the Act"))).toBe(false);
    expect(isRetryableModelError(new Error("translated 429 paragraphs"))).toBe(
      false
    );
  });

  it("does not read a longer number as a status code", () => {
    // The lookahead exists for this: "4290" must not be seen as 429.
    expect(isRetryableModelError(new Error("got status: 4290"))).toBe(false);
  });

  it("handles non-Error throws without blowing up", () => {
    expect(isRetryableModelError(null)).toBe(false);
    expect(isRetryableModelError(undefined)).toBe(false);
    expect(isRetryableModelError({})).toBe(false);
    expect(isRetryableModelError("got status: 429")).toBe(true);
  });
});

describe("withRetry", () => {
  it("returns the first success without sleeping", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await withRetry(fn, noSleep)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("recovers when a transient failure is followed by success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(vertex429)
      .mockResolvedValue("ok");
    expect(await withRetry(fn, noSleep)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured attempts and rethrows the last error", async () => {
    const fn = vi.fn().mockRejectedValue(vertex429);
    await expect(withRetry(fn, { ...noSleep, attempts: 3 })).rejects.toThrow(
      /429/
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-transient error at all", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("got status: 400 Bad Request"));
    await expect(withRetry(fn, noSleep)).rejects.toThrow(/400/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("backs off exponentially", async () => {
    const waits: number[] = [];
    const fn = vi.fn().mockRejectedValue(vertex429);
    await expect(
      withRetry(fn, {
        attempts: 4,
        baseDelayMs: 100,
        random: () => 0,
        sleep: async (ms) => void waits.push(ms),
      })
    ).rejects.toThrow();
    expect(waits).toEqual([100, 200, 400]);
  });

  it("jitters, so concurrent callers do not retry in lockstep", async () => {
    // Several clauses adjudicate at once; if they hit quota together and all
    // slept the identical interval, they would recreate the same burst.
    const waits: number[] = [];
    await expect(
      withRetry(vi.fn().mockRejectedValue(vertex429), {
        attempts: 2,
        baseDelayMs: 100,
        random: () => 1,
        sleep: async (ms) => void waits.push(ms),
      })
    ).rejects.toThrow();
    expect(waits).toEqual([200]);
  });
});
