# Kavach — product walkthrough

A shooting script for a four-minute demo, recorded against the live service at
<https://kavach-823065407403.asia-south1.run.app>.

Screenshots for every scene are in [`screenshots/walkthrough/`](screenshots/walkthrough), captured
from that deployment at 1920×1080. They are there as a storyboard and as a fallback if a live
take goes wrong — but record live if you can. A real cursor moving through a real page is the
difference between a demo and a slide deck.

---

## Before you record

**The document.** The script uses an employment offer letter for a fictional company, Kestrel
Analytics. It is written to contain things a real offer letter contains: a twenty-four month
non-compete, a seven-day-versus-ninety-day notice asymmetry, a three-lakh training bond. Nothing
in it is exaggerated for the demo. Generate it with `scripts/demo-document.mjs` or reuse the
analysis captured in the screenshots.

**Warm the caches first.** Run the document through once before recording. Model responses are
cached by request, so the second run is a Firestore read rather than a fan-out of model calls —
about 1.5 seconds instead of 30 or more. This is not a cheat; it is the same path a returning
user takes, and it keeps you from narrating over a spinner. Do the same for the judgment
explanation and any translation you plan to show.

**One honest caveat.** `gemini-2.5-flash` in `asia-south1` draws on shared capacity, so a cold
first analysis can be slow or hit a 429 under load. If you want a guaranteed clean take, do the
upload in one take and cut to the warmed analysis.

**Voice direction.** Read it like you are showing the thing to a colleague who is slightly
sceptical, not like you are presenting to a room. Slow down on the numbers and section names —
"Section twenty-seven of the Indian Contract Act" is the moment the whole product either lands or
doesn't. Let the sentences that end on a hard fact just sit there. Do not smile through it; the
subject is somebody's job.

---

## Scene 1 — The problem · 0:00–0:22

**On screen:** `01-home.png`. Let the headline hold for a beat.

> Most people sign a contract they can't read. And much of what's in it can't be enforced anyway —
> you spend two years believing you're bound by something a court would throw out.
>
> Kavach tells you which parts can't be used against you, and shows you the law that says so.

---

## Scene 2 — Upload · 0:22–0:37

**On screen:** `02-upload.png`, then drop the offer letter in.

> Upload any Indian legal document. No category to pick first — Kavach works out what it is.
>
> It's processed in Mumbai, and signed out, it's deleted within twenty-four hours.

---

## Scene 3 — What it found · 0:37–1:10

**On screen:** `03-verdicts.png`. Pause on the summary bar.

> An employment offer letter, Karnataka law, twelve clauses.
>
> Risk twenty-nine out of a hundred. One void, two unenforceable in part, three one-sided. Each is
> a verdict against a statutory rule, and the document is tinted with them.

**Cut to:** click clause 6, Non-Competition (`08-void-finding.png`).

> Here's the one that matters. Twenty-four months, anywhere in India.
>
> Void. Section twenty-seven of the Indian Contract Act, and the Supreme Court in Superintendence
> Company versus Krishan Murgai. Underneath, what to ask for instead.

---

## Scene 4 — How it knows · 1:10–1:44

**On screen:** stay on the finding.

> This is where most tools of this shape go wrong. Kavach doesn't search legal text and hope the
> model summarises it. Each clause is matched to a
> curated pack of Indian statutory rules by plain lookup. No embeddings. Forty-one rules. The
> model applies a rule it's handed, and is never asked which law applies.
>
> Then every citation is checked back against the pack. Cite a rule that isn't there and it's
> deleted before you see it. A fabricated section number cannot reach the screen.

---

## Scene 5 — What isn't there · 1:44–2:04

**On screen:** `09-missing-protections.png`.

> Now the question a chat-with-your-PDF tool can't answer. Not what's in your contract — what's
> missing from it.
>
> No stated process before dismissal for cause. Nothing on the page to highlight, so nothing that
> only reads the page can find it.

---

## Scene 6 — Something to act on · 2:04–2:20

**On screen:** `11-checklist.png`, `12-lawyer-questions.png`.

> Which becomes three things you can use. A checklist ordered by what costs you most. A draft
> negotiation email. And the questions to put to a lawyer, because some of this turns on facts the
> document doesn't contain.

---

## Scene 7 — Ask it something · 2:20–2:41

**On screen:** `13-ask.png`. Type the question live.

> You can ask about your own document. The assistant answers from tools that read your clauses
> and the rule pack, so it can't invent a legal answer.
>
> Ask something the document can't settle and it says so, and hands you the question instead.
> Refusing is a feature here.

---

## Scene 8 — Two documents · 2:41–2:57

**On screen:** `04-compare.png`.

> Two offers, or the same contract before and after your edits, compared topic by topic and each
> against the protections it should contain.
>
> It won't tell you which to sign. That's a judgement about your life.

---

## Scene 9 — Judgments · 2:57–3:23

**On screen:** `05-judgment-search.png` → `06-judgment-explain.png` → switch language.

> The second surface is judgments. Search by court, year or case number.
>
> What the court was asked, what it decided, and why — every claim citing the paragraph it came
> from, and an unresolvable citation is dropped rather than shown.
>
> And it reads in twelve Indian languages.

---

## Scene 10 — It remembers · 3:23–3:42

**On screen:** `07-history.png`, then reopen the analysis.

> Sign in and your work is kept. Signed out, nothing is recorded at all.
>
> And reopening doesn't just take you to the page. The document, the verdicts and the report come
> back as you left them. Not the page — the session.

---

## Scene 11 — Close · 3:42–3:56

**On screen:** `01-home-dark.png`.

> Everything runs in Mumbai, including the model.
>
> Kavach won't tell you what to do. It tells you what isn't enforceable, what's missing, and what
> to ask for — with the section number, so you can check it.

---

## Shot list

| # | File | Scene |
|---|---|---|
| 1 | `01-home.png` · `01-home-dark.png` | Opening, close |
| 2 | `02-upload.png` | Upload |
| 3 | `03-verdicts.png` · `03-verdicts-dark.png` | Summary bar, tinted document |
| 4 | `08-void-finding.png` | The void non-compete + citation |
| 5 | `09-missing-protections.png` | Absence detection |
| 6 | `10-what-to-do.png` · `11-checklist.png` · `12-lawyer-questions.png` | Actionable output |
| 7 | `13-ask.png` | Grounded Q&A |
| 8 | `04-compare.png` | Comparing two documents |
| 9 | `05-judgment-search.png` · `06-judgment-explain.png` | Judgments |
| 10 | `07-history.png` | Session history |

`*-full.png` variants are full-page captures, useful for slow scrolling shots in the edit.

## How the recorded cut was made

`kavach-walkthrough.mp4` (3:55, 1920×1080) was produced entirely from this script against the
live service, and can be regenerated:

- **Narration** — `edge-tts` with `en-IN-PrabhatNeural` at `+3%` rate, one file per scene, taken
  from the blockquotes below. Scene-by-scene rather than one block, so a single awkward sentence
  costs one take rather than all of them.
- **Screen** — Playwright drives the deployed site at 1920×1080 with an eased scroll, and each
  scene's choreography is padded to the exact duration of its narration file, so the two stay
  locked together; the recorder reports any scene whose actions overrun its narration.
- **Mux** — ffmpeg, H.264 CRF 23 + AAC 160k, `+faststart`.

Two notes for anyone re-recording it.

**Load pages with `domcontentloaded`, not `networkidle`.** A cold home page sat on networkidle
long enough to overrun its scene by seven seconds, and because every later scene is padded
relative to the one before, that pushed the whole recording out of sync with its own narration.

**Warm the translation you plan to show.** Scene 9 switches to Tamil because Tamil is in the
cache and renders in under half a second. Hindi was the first choice and it spent eighty seconds
retrying before giving up — not a Hindi bug, just an exhausted shared quota on the day.

**Check that your check can fail.** An earlier take verified the language switch by testing the
page for any Devanagari character, which is always true, because the wordmark in the header is
कवच. It reported success and shipped a scene showing English under narration claiming twelve
languages. Counting characters, and requiring hundreds, is what caught it.

## If you'd rather narrate it yourself

Better, if you can. The script is written to be spoken and an Indian English speaker who
understands Section 27 will beat any synthetic voice on the lines that carry the argument. Read
it aloud once first — anywhere you run out of breath is a sentence worth cutting.
