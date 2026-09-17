import { describe, it, expect } from "vitest";
import { chunkText, TEXT_CHUNK_CHARS } from "./chunk-text";

describe("chunkText", () => {
  it("round-trips exactly, which is the whole point", () => {
    // Clause offsets are indices into this string. One character gained or
    // lost anywhere moves every offset after it.
    const text = "A".repeat(1000) + "\n\nsigned\n\n" + "B".repeat(1000);
    expect(chunkText(text, 128).join("")).toBe(text);
  });

  it("preserves whitespace and newlines at a chunk boundary", () => {
    const text = "abc\n\n  def";
    expect(chunkText(text, 4).join("")).toBe(text);
    expect(chunkText(text, 1).join("")).toBe(text);
  });

  it("returns one chunk when the text fits", () => {
    expect(chunkText("short", 100)).toEqual(["short"]);
  });

  it("splits at exactly the requested size", () => {
    expect(chunkText("abcdefg", 3)).toEqual(["abc", "def", "g"]);
  });

  it("returns nothing for empty text rather than one empty chunk", () => {
    // An empty chunk would write a pointless document on every analysis.
    expect(chunkText("")).toEqual([]);
  });

  it("handles text that is an exact multiple of the chunk size", () => {
    expect(chunkText("abcdef", 3)).toEqual(["abc", "def"]);
  });

  it("keeps a default chunk comfortably under the 1 MiB document cap", () => {
    // Worst case 4 bytes per code unit in UTF-8; the cap is 1 MiB.
    expect(TEXT_CHUNK_CHARS * 4).toBeLessThan(1024 * 1024);
  });

  it("rejects a nonsensical size rather than looping forever", () => {
    expect(() => chunkText("abc", 0)).toThrow(RangeError);
  });
});
