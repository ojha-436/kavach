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

/* ---------- Tool-calling (the agent, Surface C) ---------- */

export type ToolCall = { name: string; args: Record<string, unknown> };

export type TurnResult =
  | { kind: "text"; text: string }
  | { kind: "calls"; calls: ToolCall[] };

export type ConversationTurn =
  | { role: "user"; text: string }
  | { role: "model"; text: string }
  | { role: "toolResult"; name: string; result: unknown };

/**
 * One turn of the agent loop. Returns either the model's prose or the tools
 * it wants to run — the caller runs them and calls back with the results, so
 * tool execution stays in our code rather than inside a model abstraction.
 */
export async function converse(params: {
  systemInstruction: string;
  functionDeclarations: object[];
  history: ConversationTurn[];
}): Promise<TurnResult> {
  const model = client().getGenerativeModel({
    model: MODEL,
    systemInstruction: params.systemInstruction,
    tools: [{ functionDeclarations: params.functionDeclarations }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const contents = params.history.map((turn) => {
    if (turn.role === "toolResult") {
      return {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: turn.name,
              response: { result: turn.result },
            },
          },
        ],
      };
    }
    return { role: turn.role, parts: [{ text: turn.text }] };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (model as any).generateContent({ contents });
  const parts = result.response?.candidates?.[0]?.content?.parts ?? [];

  const calls: ToolCall[] = parts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.functionCall)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({
      name: p.functionCall.name as string,
      args: (p.functionCall.args ?? {}) as Record<string, unknown>,
    }));

  if (calls.length > 0) return { kind: "calls", calls };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = parts.map((p: any) => p.text ?? "").join("").trim();
  return { kind: "text", text };
}
