# Kavach — product walkthrough

A shooting script for a five-minute demo, recorded against the live service at
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

## Scene 1 — The problem · 0:00–0:28

**On screen:** `01-home.png`. The landing page. Let the headline hold for a beat before speaking.

> Most people sign a contract they can't read. Not because they're careless, but because an
> offer letter is written in language that takes training to parse, and the person signing it
> rarely has a lawyer on call.
>
> Here's the part that surprises people: a lot of what's in those contracts can't be enforced
> anyway. You sign it, and you spend two years believing you're bound by something a court would
> throw out.
>
> Kavach tells you which parts can't be used against you, and shows you the law that says so.

---

## Scene 2 — Upload · 0:28–0:50

**On screen:** `02-upload.png`, then drag the offer letter in. Let the real upload run.

> You upload any Indian legal document. There's no category to pick first, because asking a
> worried person to classify their own contract before you'll look at it is a strange thing to do.
>
> The file goes straight from your browser to storage. It's processed in Mumbai, and if you're
> not signed in, it's deleted within twenty-four hours.

---

## Scene 3 — What it found · 0:50–1:22

**On screen:** `03-verdicts.png`. Pause on the summary bar before scrolling.

> It's identified this as an employment offer letter under Karnataka law, and split it into
> twelve clauses.
>
> Risk score twenty-nine out of a hundred. One clause void. Two unenforceable in part. Three
> one-sided. Three standard. Each of those is a verdict against a specific statutory rule, and the
> document itself is tinted with them.

**Cut to:** click clause 6, Non-Competition (`08-void-finding.png`).

> Here's the one that matters. Twenty-four months, anywhere in India, any competing business.
>
> Void. Not harsh, not unusual. Void. Section twenty-seven of the Indian Contract Act, and the
> Supreme Court in Superintendence Company versus Krishan Murgai.
>
> And underneath, what to ask for instead.

---

## Scene 4 — How it knows · 1:22–2:00

**On screen:** stay on the finding, or cut to the rule pack JSON.

> This next part is where most tools of this shape go wrong.
>
> Kavach doesn't search a pile of legal text and hope the model summarises it correctly. Each
> clause is matched to a hand-curated pack of Indian statutory rules through a plain lookup. No
> embeddings, no similarity score. Forty-one rules.
>
> The model applies a rule it's been handed. It's never asked which law applies.
>
> Then every citation is checked back against the pack. Cite a rule that isn't in there and the
> citation is deleted before you see it. Lose all your citations and the finding is downgraded and
> flagged for a lawyer.
>
> That's the difference between usually citing correctly, and a made-up section number being
> unable to reach the screen.

---

## Scene 5 — What isn't there · 2:05–2:30

**On screen:** `09-missing-protections.png`.

> The harder question is one a chat-with-your-PDF tool structurally cannot answer. Not what's in
> your contract, but what's missing from it.
>
> This offer letter has no stated process before dismissal for cause. No notice, no inquiry, no
> chance to respond. There's nothing on the page to highlight, so nothing that only reads the page
> can find it.
>
> Kavach checks the document against the protections that should be there, and tells you which
> ones aren't.

---

## Scene 6 — Something to act on · 2:30–2:55

**On screen:** `10-what-to-do.png`, `11-checklist.png`, `12-lawyer-questions.png`.

> A verdict you can't act on isn't much use. So this becomes three things you can take away.
>
> A checklist, ordered by what costs you most if you ignore it. A draft negotiation email. And the
> questions to put to a lawyer, because some of this turns on facts the document doesn't contain.

---

## Scene 7 — Ask it something · 2:55–3:20

**On screen:** `13-ask.png`. Type a real question: *"Can they really stop me joining a competitor?"*

> You can ask about your own document. The assistant answers from tools that read your clauses
> and the rule pack. It has no free-form path to a legal answer, so it can't invent one.
>
> When a question turns on something outside the document, it says so and hands you the question
> to ask instead. Refusing is a feature here. The brief was information, not replacing a lawyer,
> and that line is drawn in the code rather than in a footer.

---

## Scene 8 — Two documents side by side · 3:20–3:42

**On screen:** `04-compare.png`, then load two offer letters and run it.

> If you're holding two offers, or the same contract before and after your edits, Kavach compares
> them topic by topic, and each against the protections that document should contain.
>
> The comparison is deterministic. It isn't a model deciding which contract it prefers.
>
> It won't tell you which one to sign. That's a judgement about your life, and it isn't the
> software's to make.

---

## Scene 9 — Judgments · 3:42–4:20

**On screen:** `05-judgment-search.png` → `06-judgment-explain.png` → switch language.

> The second surface is court judgments. A Supreme Court judgment runs to dozens of pages and
> often doesn't say who won until the end.
>
> Search by court, year or case number. Then: what the court was asked, what it decided, and why,
> in plain English, with every claim citing the paragraph it came from.
>
> Same discipline. A citation that can't be resolved is dropped, and the page tells you how many
> were dropped rather than quietly showing a claim with nothing behind it.
>
> And it reads in twelve Indian languages.

---

## Scene 10 — It remembers · 4:20–4:48

**On screen:** `07-history.png` signed out, then reopen the analysis by its link.

> Sign in and your work is kept. Every upload, every question, every search.
>
> Signed out, nothing is recorded at all. Keeping a trail for someone who never identified
> themselves collects more than this product needs, so it doesn't.
>
> And reopening one doesn't just take you to the page. The document, the verdicts, the report all
> come back exactly as you left them. Not the page. The session.

---

## Scene 11 — Close · 4:40–4:55

**On screen:** `01-home-dark.png` or the summary bar again.

> Everything runs in Mumbai, including the model, because a product built around the DPDP Act
> shouldn't ship your rental agreement overseas to read it.
>
> Kavach won't tell you what to do. It'll tell you what isn't enforceable, what's missing, and
> what to ask for, with the section number, so you can check it yourself.

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

`kavach-walkthrough.mp4` (6:43, 1920×1080) was produced entirely from this script against the
live service, and can be regenerated:

- **Narration** — `edge-tts` with `en-IN-PrabhatNeural` at `-4%` rate, one file per scene, taken
  from the blockquotes below. Scene-by-scene rather than one block, so a single awkward sentence
  costs one take rather than all of them.
- **Screen** — Playwright drives the deployed site at 1920×1080 with an eased scroll, and each
  scene's choreography is padded to the exact duration of its narration file. Video and audio
  came out 0.18s apart across six and a half minutes.
- **Mux** — ffmpeg, H.264 CRF 23 + AAC 160k, `+faststart`.

Two notes for anyone re-recording it.

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
