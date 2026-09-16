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

/*
 * The Web Speech API has no lib.dom typing, so the surface this file uses is
 * declared here. "No types exist upstream" is a reason to write the shape
 * down once, not a reason to reach for `any` at every call site — these are
 * the five members actually touched, and a typo in any of them is now a
 * compile error rather than a silent runtime failure.
 */
interface SpeechRecognitionAlternative {
  readonly transcript: string;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechCapableWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

type SpeechResultHandler = (transcript: string, isFinal: boolean) => void;

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechCapableWindow;
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

  recognition.onresult = (event) => {
    let transcript = "";
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      transcript += result[0].transcript;
      if (result.isFinal) isFinal = true;
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
