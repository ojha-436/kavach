import { describe, it, expect } from "vitest";
import { modelCacheKey } from "./model-cache";

const base = {
  model: "gemini-2.5-flash",
  systemInstruction: "You adjudicate clauses.",
  prompt: "clause text",
};

describe("modelCacheKey", () => {
  it("is stable for an identical request", () => {
    expect(modelCacheKey(base)).toBe(modelCacheKey({ ...base }));
  });

  it("changes when the prompt changes", () => {
    expect(modelCacheKey({ ...base, prompt: "other" })).not.toBe(
      modelCacheKey(base)
    );
  });

  it("changes when the system instruction changes", () => {
    // Same clause, different instructions, different meaning of the answer.
    expect(
      modelCacheKey({ ...base, systemInstruction: "You summarise." })
    ).not.toBe(modelCacheKey(base));
  });

  it("changes when the model changes", () => {
    // Serving one model's output as another's would misattribute it.
    expect(modelCacheKey({ ...base, model: "gemini-9" })).not.toBe(
      modelCacheKey(base)
    );
  });

  it("distinguishes no schema from an empty schema", () => {
    // JSON.stringify drops undefined keys, so these would otherwise collide
    // even though they are different requests.
    expect(modelCacheKey({ ...base, responseSchema: {} })).not.toBe(
      modelCacheKey(base)
    );
  });

  it("changes when the response schema changes", () => {
    expect(
      modelCacheKey({ ...base, responseSchema: { type: "object" } })
    ).not.toBe(modelCacheKey({ ...base, responseSchema: { type: "string" } }));
  });

  it("produces a plain hex digest usable as a Firestore document id", () => {
    // Firestore ids cannot contain "/" and are capped at 1500 bytes.
    const key = modelCacheKey(base);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
