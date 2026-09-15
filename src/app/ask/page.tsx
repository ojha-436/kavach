"use client";

import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  speak,
  startListening,
  stopSpeaking,
  voiceInputSupported,
} from "@/lib/voice";

type ToolStep = { type: "tool"; name: string; args: Record<string, unknown> };

type Message = {
  role: "user" | "assistant";
  text: string;
  steps?: ToolStep[];
};

const TOOL_LABEL: Record<string, string> = {
  lookup_rule: "Looked up the statute",
  analyse_clause: "Read your document",
  search_judgments: "Searched judgments",
  explain_judgment: "Read the judgment",
  ask_a_lawyer: "Referred to a lawyer",
};

const SUGGESTIONS = [
  "My offer letter says I can't join a competitor for 2 years. Is that enforceable?",
  "My landlord wants 10 months' rent as deposit. Is there a limit?",
  "The agreement says I can't take the dispute to court. Can they do that?",
];

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      const answer = res.ok
        ? data.answer
        : (data.error ?? "Something went wrong.");
      setMessages((m) => [
        ...m,
        { role: "assistant", text: answer, steps: data.steps ?? [] },
      ]);
      if (voiceOut && res.ok) speak(answer);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "I couldn't reach the assistant just now." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function toggleListening() {
    if (listening) {
      stopRef.current?.();
      setListening(false);
      return;
    }
    setListening(true);
    stopRef.current = startListening(
      (transcript, isFinal) => {
        setInput(transcript);
        if (isFinal) {
          setListening(false);
          void send(transcript);
        }
      },
      () => setListening(false)
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl flex-col px-5">
        {messages.length === 0 ? (
          <div className="py-14">
            <h1 className="font-display text-3xl font-medium text-ink">
              Ask about your contract or a judgment
            </h1>
            <p className="prose-document mt-4 text-ink-soft">
              This assistant has no legal knowledge it is permitted to use on its own.
              Every answer is assembled from a statutory rule it looked up, a clause in a
              document you uploaded, or a judgment it can cite by paragraph. You&apos;ll see
              which of those it used under each answer.
            </p>

            <div className="mt-8 space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="block w-full border border-rule bg-paper-raised px-4 py-3 text-left font-display text-ink-soft transition-colors hover:border-attest hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-8 py-10">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] bg-paper-sunk px-4 py-2.5 font-sans text-ink">
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={i}>
                  <p className="prose-document whitespace-pre-wrap text-ink">{m.text}</p>
                  {m.steps && m.steps.length > 0 && (
                    <ul className="mt-4 space-y-1 border-l-2 border-attest pl-3 font-sans text-xs text-ink-faint">
                      {m.steps.map((s, j) => (
                        <li key={j}>
                          {TOOL_LABEL[s.name] ?? s.name}
                          {s.name === "lookup_rule" && s.args.clauseType
                            ? `: ${String(s.args.clauseType).replace(/_/g, " ")}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            )}
            {busy && (
              <p className="font-sans text-sm text-ink-faint">Checking the sources…</p>
            )}
            <div ref={endRef} />
          </div>
        )}

        <div className="sticky bottom-0 border-t border-rule bg-paper py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              placeholder={listening ? "Listening…" : "Ask a question"}
              className="flex-1 resize-none border border-rule bg-paper-raised px-3 py-2.5 font-sans text-ink placeholder:text-ink-faint focus:border-attest focus:outline-none"
            />
            {voiceInputSupported() && (
              <button
                type="button"
                onClick={toggleListening}
                aria-pressed={listening}
                className={`border px-3 py-2.5 font-sans text-sm transition-colors ${
                  listening
                    ? "border-seal bg-seal text-paper"
                    : "border-rule text-ink-soft hover:border-ink hover:text-ink"
                }`}
              >
                {listening ? "Stop" : "Speak"}
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-ink px-4 py-2.5 font-sans font-medium text-paper disabled:opacity-40"
            >
              Ask
            </button>
          </form>

          <div className="mt-2 flex flex-wrap items-center gap-4 font-sans text-xs text-ink-faint">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={voiceOut}
                onChange={(e) => {
                  setVoiceOut(e.target.checked);
                  if (!e.target.checked) stopSpeaking();
                }}
              />
              Read answers aloud
            </label>
            <span>
              Legal information, not legal advice. Reasoning runs in asia-south1; speech
              recognition is your browser&apos;s and leaves the region — type instead if
              that matters.
            </span>
          </div>
        </div>
      </main>
    </>
  );
}
