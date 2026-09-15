import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import type { ConversationTurn } from "@/lib/llm";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const message = body?.message;
  const history = Array.isArray(body?.history) ? body.history : [];

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const turns: ConversationTurn[] = [
    ...(history as ConversationTurn[]),
    { role: "user", text: message },
  ];

  try {
    const { steps, answer } = await runAgent(turns);
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
