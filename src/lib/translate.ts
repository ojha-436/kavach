import { synthesize } from "./llm";
import { JudgmentExplanation } from "./schema";

/**
 * Translation of a judgment explanation into an Indian regional language.
 *
 * Deliberately translates the ALREADY-VALIDATED explanation rather than
 * re-running the explainer against the judgment in another language. The
 * grounding guarantee is established once, in English, against the source
 * text; translating the validated output carries that guarantee across
 * instead of asking a second generation pass to re-earn it. Paragraph
 * citations are never sent to the model — they are reattached afterwards,
 * so no translation error can move a citation.
 */

export const LANGUAGES: Record<string, string> = {
  hi: "Hindi",
  bn: "Bengali",
  mr: "Marathi",
  te: "Telugu",
  ta: "Tamil",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  or: "Odia",
  as: "Assamese",
  ur: "Urdu",
};

export function isSupportedLanguage(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, code);
}

const SYSTEM = `You are a translator working on Indian legal explanations written for non-lawyers.

Translate each numbered string into the target language. Rules:
- Translate meaning, not word for word. The result must read naturally to an ordinary speaker.
- Keep legal terms of art recognisable: give the accepted term in the target language, and where
  there is no settled equivalent, keep the English term in brackets after it.
- Do not add anything. Do not explain, expand, soften, or comment. Do not add caveats.
- Do not drop anything either. Every input string must produce exactly one output string.
- Preserve numbers, dates, amounts, statute names and section numbers exactly as given.

Return the translations in the same order as the input, as a JSON array of strings.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    translations: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["translations"],
};

async function translateStrings(
  strings: string[],
  languageCode: string
): Promise<string[]> {
  if (strings.length === 0) return [];

  const language = LANGUAGES[languageCode];
  const numbered = strings.map((s, i) => `${i + 1}. ${s}`).join("\n\n");

  const raw = await synthesize({
    systemInstruction: SYSTEM,
    prompt: `Target language: ${language}\n\nStrings to translate:\n\n${numbered}`,
    responseSchema: RESPONSE_SCHEMA,
  });

  const parsed = JSON.parse(raw) as { translations?: unknown };
  const out = Array.isArray(parsed.translations)
    ? parsed.translations.map((t) => String(t))
    : [];

  // A length mismatch means strings were merged or dropped, and we would be
  // pairing translated text with the wrong paragraph citations. Fail rather
  // than mislabel.
  if (out.length !== strings.length) {
    throw new Error(
      `Translation returned ${out.length} strings for ${strings.length} inputs`
    );
  }
  return out;
}

export async function translateExplanation(
  explanation: JudgmentExplanation,
  languageCode: string
): Promise<JudgmentExplanation> {
  const sections = ["issue", "held", "reasoning", "outcome"] as const;

  // Flatten to one ordered list so the whole explanation is translated in a
  // single call and reads consistently.
  const flat: string[] = [];
  for (const key of sections) for (const p of explanation[key]) flat.push(p.text);
  const doesNotDecideStart = flat.length;
  for (const s of explanation.doesNotDecide) flat.push(s);

  const translated = await translateStrings(flat, languageCode);

  let cursor = 0;
  const rebuilt = {} as JudgmentExplanation;
  for (const key of sections) {
    rebuilt[key] = explanation[key].map((p) => ({
      // Citations come from the validated original, never from the model.
      paragraphs: p.paragraphs,
      text: translated[cursor++],
    }));
  }
  rebuilt.doesNotDecide = explanation.doesNotDecide.map(
    (_, i) => translated[doesNotDecideStart + i]
  );

  return rebuilt;
}
