import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { runAgent } from "@/lib/agent";
import type { ConversationTurn } from "@/lib/llm";
import { getSessionUser } from "@/lib/auth-server";
import { recordActivity } from "@/lib/firestore-admin";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "agent");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const message = body?.message;
  const history = Array.isArray(body?.history) ? body.history : [];
  const analysisId = typeof body?.analysisId === "string" ? body.analysisId : null;
  const judgmentId = typeof body?.judgmentId === "string" ? body.judgmentId : null;

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Bound what reaches the model. Without a cap, one request can carry an
  // arbitrarily large prompt — a cost and latency problem, and a way to
  // bury instructions far from the system layer.
  const MAX_MESSAGE = 4000;
  const MAX_HISTORY = 20;
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Questions are limited to ${MAX_MESSAGE} characters.` },
      { status: 413 }
    );
  }
  if (history.length > MAX_HISTORY) {
    return NextResponse.json(
      { error: "That conversation is too long. Start a new one." },
      { status: 413 }
    );
  }

  const turns: ConversationTurn[] = [
    ...(history as ConversationTurn[]),
    { role: "user", text: message },
  ];

  try {
    const { steps, answer } = await runAgent(turns, { analysisId, judgmentId });

    const user = await getSessionUser(req);
    if (user) {
      await recordActivity({
        uid: user.uid,
        kind: "question",
        summary: message.slice(0, 180),
        detail: steps
          .filter((s) => s.type === "tool")
          .map((s) => (s as { name: string }).name)
          .join(", "),
        href: analysisId
          ? `/analyze?id=${analysisId}`
          : judgmentId
            ? `/judgments/${judgmentId}`
            : null,
      });
    }

    return NextResponse.json({
      answer,
      // The tool trace is returned deliberately: the product's claim is that
      // it only speaks from sources, and showing which tools ran is how a
      // user (or a judge) checks that claim rather than taking it on faith.
      steps: steps.filter((s) => s.type === "tool"),
    });
  } catch (err) {
    console.error("agent failed", err);
    return NextResponse.json(
      { error: "The assistant could not complete that request." },
      { status: 500 }
    );
  }
}
