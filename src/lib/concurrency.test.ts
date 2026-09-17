import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./concurrency";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("mapWithConcurrency", () => {
  it("returns results in input order, not completion order", async () => {
    // Deliberately inverted delays: if the implementation collected results
    // as they finished, this would come back reversed.
    const out = await mapWithConcurrency([30, 20, 10], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual([30, 20, 10]);
  });

  it("never exceeds the concurrency ceiling", async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
      return null;
    });
    expect(peak).toBe(4);
  });

  it("still overlaps work rather than running serially", async () => {
    let peak = 0;
    let running = 0;
    await mapWithConcurrency([1, 2, 3, 4], 4, async () => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
      return null;
    });
    expect(peak).toBeGreaterThan(1);
  });

  it("handles an empty list without spawning workers", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });

  it("does not spawn more workers than there are items", async () => {
    let peak = 0;
    let running = 0;
    await mapWithConcurrency([1, 2], 10, async () => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
      return null;
    });
    expect(peak).toBe(2);
  });

  it("rejects a nonsensical limit rather than hanging forever", async () => {
    // A limit of 0 would start no workers and await nothing, so the call
    // would resolve with a hole-filled array and no work done.
    await expect(mapWithConcurrency([1], 0, async () => 1)).rejects.toThrow(
      RangeError
    );
  });

  it("propagates a rejection", async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      })
    ).rejects.toThrow("boom");
  });
});
