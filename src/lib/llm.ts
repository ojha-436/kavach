import { modelCacheKey } from "./model-cache";
import {
  getCachedModelResponse,
  putCachedModelResponse,
} from "./firestore-admin";
import {
  VertexAI,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type Part,
} from "@google-cloud/vertexai";

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

/**
 * generate(), with the response cached against the full request.
 *
 * Every stage that goes through here is a deterministic structured task, so
 * asking the model the identical question twice spends seconds and tokens to
 * get back the same JSON. Re-analysing a document — the repeat demo, the
 * shared link, the refresh — becomes a Firestore read instead of a fan-out of
 * model calls.
 *
 * The agent does not come through here. converse() is a conversation, where
 * repeating yourself is the point, and caching it would make the assistant
 * answer the second question with the first answer.
 *
 * Cache failures are not request failures. If Firestore is unreachable, or
 * this is running somewhere without credentials at all, the model call still
 * happens — a cache that can take the pipeline down with it is worse than no
 * cache.
 */
async function generateCached(opts: GenerateOptions): Promise<string> {
  const key = modelCacheKey({
    model: MODEL,
    systemInstruction: opts.systemInstruction,
    prompt: opts.prompt,
    responseSchema: opts.responseSchema,
  });

  try {
    const hit = await getCachedModelResponse(key);
    if (hit) return hit;
  } catch {
    // Fall through to the model.
  }

  const text = await generate(opts);

  try {
    await putCachedModelResponse(key, text);
  } catch {
    // The answer is already in hand; failing to store it changes nothing.
  }

  return text;
}

/** Stage 1 (document frame) and Stage 2 (clause typing) — classification tasks. */
export async function classify(opts: GenerateOptions): Promise<string> {
  return generateCached(opts);
}

/** Stage 4 — per-clause adjudication against joined rule cards. */
export async function adjudicate(opts: GenerateOptions): Promise<string> {
  return generateCached(opts);
}

/** Stage 6 — synthesis over the structured verdict set. */
export async function synthesize(opts: GenerateOptions): Promise<string> {
  return generateCached(opts);
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
  functionDeclarations: FunctionDeclaration[];
  history: ConversationTurn[];
}): Promise<TurnResult> {
  const model = client().getGenerativeModel({
    model: MODEL,
    systemInstruction: params.systemInstruction,
    tools: [{ functionDeclarations: params.functionDeclarations }],
  });

  const contents: Content[] = params.history.map((turn) => {
    if (turn.role === "toolResult") {
      return {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: turn.name,
              response: { result: turn.result } as object,
            },
          },
        ],
      };
    }
    return { role: turn.role, parts: [{ text: turn.text }] };
  });

  const result = await model.generateContent({ contents });
  const parts: Part[] = result.response?.candidates?.[0]?.content?.parts ?? [];

  const calls: ToolCall[] = parts
    .filter((p): p is Part & { functionCall: FunctionCall } => "functionCall" in p)
    .map((p) => ({
      name: p.functionCall.name,
      args: (p.functionCall.args ?? {}) as Record<string, unknown>,
    }));

  if (calls.length > 0) return { kind: "calls", calls };

  const text = parts
    .map((p) => ("text" in p ? (p.text ?? "") : ""))
    .join("")
    .trim();
  return { kind: "text", text };
}
