import { describe, it, expect } from "vitest";
import { ingestTokenMatches } from "./ingest-auth";

describe("ingestTokenMatches", () => {
  it("accepts the exact token", () => {
    expect(ingestTokenMatches("s3cret-token", "s3cret-token")).toBe(true);
  });

  it("rejects a wrong token of the same length", () => {
    expect(ingestTokenMatches("s3cret-tokeX", "s3cret-token")).toBe(false);
  });

  it("rejects a token that is merely a correct prefix", () => {
    expect(ingestTokenMatches("s3cret", "s3cret-token")).toBe(false);
  });

  it("rejects differing lengths instead of throwing", () => {
    // timingSafeEqual throws on unequal buffer lengths; hashing first is what
    // turns that crash into a plain false.
    expect(() => ingestTokenMatches("a", "a-much-longer-token")).not.toThrow();
    expect(ingestTokenMatches("a", "a-much-longer-token")).toBe(false);
  });

  it("refuses when either side is missing", () => {
    // The route already 404s when INGEST_TOKEN is unset, but a comparison
    // that treated absent-vs-absent as a match would be a way in.
    expect(ingestTokenMatches(null, "token")).toBe(false);
    expect(ingestTokenMatches("token", undefined)).toBe(false);
    expect(ingestTokenMatches(null, null)).toBe(false);
    expect(ingestTokenMatches("", "")).toBe(false);
  });
});
