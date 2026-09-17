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

> Most people sign a contract they can't read. Not because they're careless — because a rental
> agreement or an offer letter is written in language that takes training to parse, and the
> person signing it usually has neither the training nor a lawyer on call.
>
> The interesting part is that a lot of what's in those contracts can't legally be enforced
> anyway. The clause is there, you sign it, and you spend two years believing you're bound by
> something a court would throw out.
>
> Kavach reads the document and tells you which parts of it can't be used against you — and shows
> you the law that says so.

---

## Scene 2 — Upload · 0:28–0:50

**On screen:** `02-upload.png`, then drag the offer letter in. Let the real upload run.

> You upload any Indian legal document. A rental agreement, an offer letter, a loan agreement, a
> notice — there's no category to pick first, because asking a worried person to classify their
> own contract before you'll look at it is a strange thing to do. Kavach works out what it is.
>
> The file goes straight from the browser to storage. It's processed in Mumbai, and if you're not
> signed in it's deleted within twenty-four hours.

---

## Scene 3 — What it found · 0:50–1:30

**On screen:** `03-verdicts.png`. Pause on the summary bar before scrolling.

> It's identified this as an employment offer letter governed by Karnataka law, and split it into
> twelve clauses.
>
> Risk score twenty-nine out of a hundred. One clause void. Two partly unenforceable. Three
> one-sided but valid. Three standard.
>
> Those aren't sentiment labels. Each one is a verdict against a specific statutory rule, and the
> document itself is tinted with them — so you can see, reading down the page, which paragraphs
> are the problem.

**Cut to:** click clause 6, Non-Competition (`08-void-finding.png`).

> Here's the one that matters. Twenty-four months, anywhere in India, any competing business.
>
> Void. Not "harsh", not "unusual" — void. Section twenty-seven of the Indian Contract Act, 1872,
> and the Supreme Court in Superintendence Company versus Krishan Murgai. A restraint on your
> trade after employment ends is not enforceable in India.
>
> And underneath: what to ask for instead. Ask for it to be deleted, or narrowed so it only
> applies while you're still employed.

---

## Scene 4 — How it knows · 1:30–2:05

**On screen:** stay on the finding; optionally cut to `README.md` §"How the grounding actually
works" or the rule pack JSON.

> This is the part worth being precise about, because it's where most tools of this shape go
> wrong.
>
> Kavach doesn't search a pile of legal text and hope the model summarises it correctly. Every
> clause is matched to a hand-curated pack of Indian statutory rules through a plain lookup —
> clause type to rule, no embeddings, no similarity score. Forty-one rules across rental and
> employment.
>
> The model's job is to apply a rule it's been handed and explain it in plain English. It is never
> asked which law applies.
>
> Then, after it answers, every citation is checked back against the pack. If the model cites a
> rule that isn't in there, the citation is deleted before you ever see it — and if a finding
> loses all of its citations, its confidence is downgraded and it's flagged for a lawyer.
>
> That's the difference between a tool that usually cites correctly and one where a fabricated
> section number is structurally unable to reach the screen.

---

## Scene 5 — What isn't there · 2:05–2:30

**On screen:** `09-missing-protections.png`.

> The harder question is the one a chat-with-your-PDF tool structurally cannot answer: not what's
> in your contract, but what's missing from it.
>
> This offer letter has no stated process before dismissal for cause. No show-cause notice, no
> inquiry, no chance to respond. That absence is invisible to anything that only reads what's on
> the page — there's nothing to highlight.
>
> Kavach compares the document against the protections that ought to be there for its type, and
> tells you which ones aren't, and what to ask for.

---

## Scene 6 — Something to act on · 2:30–2:55

**On screen:** `10-what-to-do.png`, `11-checklist.png`, `12-lawyer-questions.png`.

> A verdict you can't act on isn't much use. So the last step turns all of it into three things
> you can actually take away.
>
> A checklist, ordered by what costs you most if you ignore it. A draft negotiation email you can
> copy. And the specific questions to put to a lawyer — because some of this turns on facts the
> document doesn't contain, and the honest answer there is a question, not an opinion.

---

## Scene 7 — Ask it something · 2:55–3:20

**On screen:** `13-ask.png`. Type a real question: *"Can they really stop me joining a competitor?"*

> You can ask about your own document. The assistant answers from tools that read your clauses and
> the rule pack — it has no free-form path to a legal answer, which means it can't invent one.
>
> And when a question turns on something outside the document, it says so and hands you the
> question to ask instead. Refusing is a feature here, not a failure. The brief was information
> and assistance, not replacing a lawyer, and that line is drawn in the code rather than in a
> footer.

---

## Scene 8 — Two documents side by side · 3:20–3:42

**On screen:** `04-compare.png`, then load two offer letters and run it.

> If you're holding two offers, or the same contract before and after the edits you asked for,
> Kavach compares them topic by topic — and each of them against the protections a document of
> that kind should contain.
>
> The comparison is deterministic. It isn't a model deciding which contract it prefers; it's the
> same statutory rules applied to both, with the differences ranked by what they cost the person
> signing.
>
> It will not tell you which one to sign. That's a judgement about your life, and it isn't the
> software's to make.

---

## Scene 9 — Judgments · 3:42–4:20

**On screen:** `05-judgment-search.png` → `06-judgment-explain.png` → switch language.

> The second surface is court judgments. A Supreme Court judgment runs to dozens of pages and
> often doesn't say who won until the end.
>
> Search by court, year or case number. Then: what the court was asked, what it decided, and why —
> in plain English, with every claim citing the paragraph of the judgment it came from. Click one
> and you land on that paragraph.
>
> Same discipline as before. A paragraph citation that can't be resolved is dropped, and the page
> tells you how many were dropped rather than quietly rendering a claim with nothing behind it.
>
> And it reads in twelve Indian languages — the judgment is about your life whether or not you
> read English.

---

## Scene 10 — It remembers · 4:20–4:40

**On screen:** `07-history.png`, signed in. Click an entry and let it reopen.

> Sign in with Google and your work is kept. Every upload, every question, every judgment search.
>
> Click one and you're back where you left it — the document, the verdicts, the report, exactly as
> it was. Not the page it was on. The session.
>
> History is only recorded for signed-in users, and clearing it actually deletes it.

---

## Scene 11 — Close · 4:40–4:55

**On screen:** `01-home-dark.png` or the summary bar again.

> Everything runs in Mumbai, including the model, because a product built around the DPDP Act
> shouldn't ship your rental agreement overseas to read it.
>
> Kavach won't tell you what to do. It'll tell you which parts of what you're about to sign
> aren't enforceable, what's missing, and what to ask for — with the section number, so you can
> check it yourself.

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

## If you'd rather not narrate it yourself

The script is written to be spoken, so it reads acceptably through a good synthetic voice. Two
things matter more than which tool you pick: choose an Indian English voice, and turn the pace
down slightly from default — the statutory references need room. Feed it scene by scene rather
than as one block, so a single awkward sentence doesn't cost you the whole take.

Read it aloud once before recording. Anywhere you run out of breath is a sentence worth cutting.
