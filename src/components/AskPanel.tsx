"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import {
  speak,
  startListening,
  stopSpeaking,
  voiceInputSupported,
} from "@/lib/voice";

type ToolStep = { type: "tool"; name: string; args: Record<string, unknown> };

type Message = { role: "user" | "assistant"; text: string; steps?: ToolStep[] };

const TOOL_LABEL: Record<string, string> = {
  lookup_rule: "Looked up the statute",
  analyse_clause: "Read the document",
  search_judgments: "Searched judgments",
  explain_judgment: "Read the judgment",
  ask_a_lawyer: "Referred to a lawyer",
};

export function AskPanel({
  analysisId,
  judgmentId,
  suggestions,
  title,
  blurb,
}: {
  analysisId?: string;
  judgmentId?: string;
  suggestions: string[];
  title: string;
  blurb: string;
}) {
  const { authedFetch } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const voiceOutRef = useRef(false);
  const stopRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);

    try {
      const res = await authedFetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, analysisId, judgmentId }),
      });
      const data = await res.json();
      const answer = res.ok ? data.answer : (data.error ?? "Something went wrong.");
      setMessages((m) => [
        ...m,
        { role: "assistant", text: answer, steps: data.steps ?? [] },
      ]);
      if (voiceOutRef.current && res.ok) speak(answer);
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
    <section className="border-t border-rule pt-8">
      <h2 className="font-display text-2xl font-medium text-ink">{title}</h2>
      <p className="prose-document mt-2 text-ink-soft">{blurb}</p>

      {messages.length === 0 && (
        <div className="mt-5 space-y-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => void send(s)}
              className="block w-full border border-rule bg-paper-raised px-4 py-2.5 text-left font-display text-ink-soft transition-colors hover:border-attest hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div aria-live="polite" className="mt-6 space-y-6">
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
                  <ul className="mt-3 space-y-1 border-l-2 border-attest pl-3 font-sans text-xs text-ink-faint">
                    {m.steps.map((s, j) => (
                      <li key={j}>{TOOL_LABEL[s.name] ?? s.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          )}
          {busy && (
            <p role="status" className="font-sans text-sm text-ink-faint">
              Checking the sources…
            </p>
          )}
          <div ref={endRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="mt-5 flex items-end gap-2"
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
          aria-label="Ask a question about this document"
          placeholder={listening ? "Listening…" : "Ask a question"}
          className="flex-1 resize-none border border-rule bg-paper-raised px-3 py-2.5 font-sans text-ink placeholder:text-ink-faint focus:border-attest"
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
              voiceOutRef.current = e.target.checked;
              if (!e.target.checked) stopSpeaking();
            }}
          />
          Read answers aloud
        </label>
        <span>
          Legal information, not legal advice. Reasoning runs in asia-south1; speech
          recognition is your browser&apos;s and leaves the region.
        </span>
      </div>
    </section>
  );
}
