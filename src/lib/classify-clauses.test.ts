import { describe, it, expect, vi, beforeEach } from "vitest";

const classify = vi.fn();
vi.mock("./llm", () => ({ classify: (...args: unknown[]) => classify(...args) }));

const { typeClauses, OTHER } = await import("./classify-clauses");
import type { Clause } from "./schema";

function clause(id: string, heading: string): Clause {
  return {
    id,
    heading,
    text: `${heading}. Some operative text that the model would read.`,
    startOffset: 0,
    endOffset: 10,
    page: 1,
    clauseType: null,
    alsoCovers: [],
  };
}

const clauses = [clause("c1", "Non-Competition"), clause("c2", "Probation")];

beforeEach(() => {
  classify.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("typeClauses when the model is unavailable", () => {
  /**
   * The bug this pins, seen in production: a batch that threw left every
   * clause labelled OTHER, OTHER means "no curated rule covers this", so the
   * document came back with no findings and a risk score of zero — on an
   * offer letter containing a twenty-four-month all-India non-compete. A
   * reader cannot tell that apart from a contract with nothing wrong in it.
   */
  it("reports the clauses as unchecked rather than silently typing them OTHER", async () => {
    classify.mockRejectedValue(new Error("got status: 429 Too Many Requests"));

    const result = await typeClauses(clauses, "employment");

    expect(result.unchecked).toEqual(["c1", "c2"]);
    // They still degrade to OTHER so the rest of the pipeline runs...
    expect(result.clauses.map((c) => c.clauseType)).toEqual([OTHER, OTHER]);
    // ...but the caller now has the means to say so.
    expect(result.unchecked.length).toBe(clauses.length);
  });

  it("reports unchecked when the response does not parse", async () => {
    classify.mockResolvedValue('{"labels": "not an array"}');
    const result = await typeClauses(clauses, "employment");
    expect(result.unchecked).toEqual(["c1", "c2"]);
  });

  it("does not fail the whole document", async () => {
    classify.mockRejectedValue(new Error("got status: 429"));
    await expect(typeClauses(clauses, "employment")).resolves.toBeTruthy();
  });
});

describe("typeClauses on a healthy run", () => {
  it("reports nothing unchecked and applies the labels", async () => {
    classify.mockResolvedValue(
      JSON.stringify({
        labels: [
          { id: "c1", clauseType: "non_compete", alsoCovers: [] },
          { id: "c2", clauseType: "probation", alsoCovers: [] },
        ],
      })
    );

    const result = await typeClauses(clauses, "employment");

    expect(result.unchecked).toEqual([]);
    expect(result.clauses.map((c) => c.clauseType)).toEqual([
      "non_compete",
      "probation",
    ]);
  });

  it("treats a genuine OTHER as checked, not as a failure", async () => {
    // The distinction the whole change exists for: the model answering
    // "nothing in the taxonomy fits" is a result, not an outage.
    classify.mockResolvedValue(
      JSON.stringify({
        labels: [
          { id: "c1", clauseType: OTHER },
          { id: "c2", clauseType: OTHER },
        ],
      })
    );

    const result = await typeClauses(clauses, "employment");

    expect(result.unchecked).toEqual([]);
    expect(result.clauses.every((c) => c.clauseType === OTHER)).toBe(true);
  });

  it("drops a label that is not in the taxonomy rather than joining to nothing", async () => {
    classify.mockResolvedValue(
      JSON.stringify({ labels: [{ id: "c1", clauseType: "invented_label" }] })
    );
    const result = await typeClauses(clauses, "employment");
    expect(result.clauses[0].clauseType).toBe(OTHER);
    // An invented label is a bad answer, not an absent one.
    expect(result.unchecked).toEqual([]);
  });
});
