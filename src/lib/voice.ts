"use client";

/**
 * Voice seam.
 *
 * What this is NOT: Gemini Live. Verified on Day 2 that no Live or
 * native-audio model is served to this project in asia-south1, global, or
 * us-central1 — asia-south1 publishes exactly three models, and none of
 * them speak. See PLAN.md §7.
 *
 * What this IS: browser-native speech recognition for the question, with
 * all legal reasoning still done by gemini-2.5-flash in asia-south1.
 *
 * The honest caveat, surfaced in the UI rather than buried here: browser
 * speech recognition sends the spoken audio to the browser vendor's service,
 * which is not in India. Only the user's spoken question goes that way —
 * never document or judgment text. Users who want nothing leaving the region
 * should type instead.
 *
 * The in-region upgrade is Cloud Speech-to-Text in asia-south1; it swaps in
 * behind this same interface without touching the agent.
 */

type SpeechResultHandler = (transcript: string, isFinal: boolean) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

function recognitionCtor(): AnySpeechRecognition | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceInputSupported(): boolean {
  return recognitionCtor() !== null;
}

export function startListening(
  onResult: SpeechResultHandler,
  onEnd: () => void
): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    onEnd();
    return () => {};
  }

  const recognition = new Ctor();
  recognition.lang = "en-IN";
  recognition.interimResults = true;
  recognition.continuous = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onresult = (event: any) => {
    let transcript = "";
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    onResult(transcript, isFinal);
  };
  recognition.onerror = onEnd;
  recognition.onend = onEnd;

  recognition.start();
  return () => recognition.stop();
}

export function speak(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1.02;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
