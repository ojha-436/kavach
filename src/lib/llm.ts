import { VertexAI } from "@google-cloud/vertexai";

/**
 * Single point of contact with the model provider (Architecture §5.2).
 * Swapping providers or tiers should be a one-file change.
 *
 * Day 1 decision: gemini-2.5-pro is not served in `asia-south1` for this
 * project (confirmed live: 404 regionally, 200 on the `global` endpoint).
 * Rather than route adjudication through `global`, every stage uses
 * `gemini-2.5-flash` in `asia-south1` so the "every service stays in Mumbai"
 * data-residency claim (Architecture §7) holds without caveats. Per-clause
 * adjudication context is narrow — a single clause plus its deterministically
 * joined rule cards, not open-ended legal reasoning — so Flash-tier is
 * adequate for the structured-output task this pipeline actually asks of it.
 */

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? "promptwar-501405";
const LOCATION = "asia-south1";
const MODEL = "gemini-2.5-flash";

let vertex: VertexAI | null = null;

function client(): VertexAI {
  if (!vertex) {
    vertex = new VertexAI({ project: PROJECT_ID, location: LOCATION });
  }
  return vertex;
}

export type GenerateOptions = {
  systemInstruction: string;
  prompt: string;
  responseSchema?: object;
};

async function generate({
  systemInstruction,
  prompt,
  responseSchema,
}: GenerateOptions): Promise<string> {
  const model = client().getGenerativeModel({
    model: MODEL,
    systemInstruction,
    generationConfig: responseSchema
      ? {
          responseMimeType: "application/json",
          responseSchema,
        }
      : undefined,
  });

  const result = await model.generateContent(prompt);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty model response");
  return text;
}

/** Stage 1 (document frame) and Stage 2 (clause typing) — classification tasks. */
export async function classify(opts: GenerateOptions): Promise<string> {
  return generate(opts);
}

/** Stage 4 — per-clause adjudication against joined rule cards. */
export async function adjudicate(opts: GenerateOptions): Promise<string> {
  return generate(opts);
}

/** Stage 6 — synthesis over the structured verdict set. */
export async function synthesize(opts: GenerateOptions): Promise<string> {
  return generate(opts);
}
