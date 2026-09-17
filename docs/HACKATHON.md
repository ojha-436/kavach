# Hackathon Context — PromptWar Virtual Edition

> Single source of truth for this project. Claude: treat everything here as hard constraints.

## Event
- **Hackathon:** PromptWar — Virtual Edition
- **Track / theme:** GenAI for legal information and basic legal assistance
- **Submission deadline:** not supplied to this repo. Left unstated rather than guessed —
  a wrong date here is worse than an absent one.
- **Deliverables:** deployed URL and public repo are live (see Live links). Whether a pitch
  video or deck is also required has not been confirmed.
- **Format:** Solo, 7 days

## Problem statement (verbatim from organiser)

> Legal information can often be complex, difficult to understand, and challenging to navigate
> without professional assistance. Build a GenAI-powered solution that makes legal information and
> basic legal assistance more accessible by helping users understand, compare, and navigate legal
> documents and information.
>
> Potential use cases include:
>
> - Simplifying complex legal documents
> - Comparing contracts, agreements, or policies
> - Highlighting important clauses, obligations, risks, or inconsistencies
> - Answering questions based on provided legal documents
> - Helping users understand their options and potential next steps
> - Generating summaries, checklists, or other actionable outputs
> - Helping users prepare information or questions for a legal professional
>
> NOTE:
>
> - Solutions should provide information and assistance, rather than replace professional legal advice.
> - The use cases listed above are intended as potential directions and are not exhaustive or prescriptive.
> - Participants are encouraged to explore the problem space, think creatively, and develop
>   innovative approaches or entirely different use cases within the theme. Original ideas,
>   experimentation, and out-of-the-box thinking are encouraged.

## Required / recommended tech stack (from organiser)

No stack was mandated. The choice below is ours and the reasoning is in `docs/ARCHITECTURE.md`.

Google Cloud — Cloud Run, Vertex AI (`gemini-2.5-flash`), Firestore, Cloud Storage,
Secret Manager, Firebase Auth — region `asia-south1` throughout.

Document AI appeared in an earlier draft of this list and is **not** used: scanned, image-only
PDFs are refused with a message saying so rather than silently analysed as empty. Listed under
known limits in the README.

## Judging rubric

Six criteria, graded in three impact tiers. The tier is what decides where effort goes: a
point of Code Quality is worth more to the final standing than a point of Accessibility, even
though both are graded out of the same total.

| Criterion | Impact | Where this repo answers it |
|---|---|---|
| **Code Quality** — structure, readability, maintainability | **High** | Zero `any` and zero eslint-disables in `src/`; every non-obvious decision carries its reasoning in a comment; deterministic logic extracted from routes into testable modules (`clauseAnalysisPatch`, `ingestTokenMatches`, `mapWithConcurrency`, `modelCacheKey`) |
| **Problem Statement Alignment** | **High** | README §"Against the problem statement" maps all seven of the organiser's use cases to where each is implemented, plus the information-not-advice constraint |
| **Security** — safe and responsible implementation | Medium | `SECURITY.md`; `npm audit` clean at every severity; ownership checks returning 404 not 403; rate limiting keyed on the unforgeable forwarded hop; constant-time token comparison; Firestore closed to clients and verified so |
| **Efficiency** — optimal use of resources | Medium | README §Efficiency; model responses cached by full request; bounded concurrency rather than unbounded fan-out; the Firebase SDK kept out of first-load JS; cache headers on immutable responses |
| **Testing** — validation of functionality | Low | 109 unit tests + 20 browser tests; every regression test names the bug it pins |
| **Accessibility** — inclusive and usable design | Low | axe at WCAG 2.1 AA across five pages in both themes, in CI, against the production build |

Low impact is not optional — a perfect score still needs them. It means they cannot rescue a
weak showing on the two High rows.

## Our solution (one paragraph)

**Kavach** analyses Indian rental agreements and employment offer letters at the clause level and
answers two questions no summarizer can: *which clauses in this contract cannot legally be used
against you*, and *which protections are missing from it*. Each clause is matched to a
hand-curated pack of Indian statutory rules through a deterministic join — not semantic search —
so every verdict carries a real, verifiable citation (S.27 Indian Contract Act, S.35 Indian Stamp
Act, Model Tenancy Act 2021) and links back to the exact span in the document. Where a question
turns on facts outside the document, Kavach refuses and hands the user the precise question to put
to a lawyer.

## Live links
- **Deployed app:** https://kavach-823065407403.asia-south1.run.app
  - `/analyze` upload and clause-level verdicts · `/compare` two documents diffed ·
    `/judgments` judgment search and explainer · `/history` your past activity.
    The agent has no page of its own: Ask sits beside the document on `/analyze` and beside
    the judgment on `/judgments/{id}`, because a question about a document belongs next to it.
- **Repo:** https://github.com/ojha-436/kavach (public)
- **Demo video:** not recorded yet. The shooting script, scene timings and captured
  screenshots are in [`WALKTHROUGH.md`](WALKTHROUGH.md); only the recording itself is outstanding.

## Scope decisions log

- **2026-09-15** — Two document types only (residential rental, employment offer letter) — a solo
  week cannot curate a trustworthy rule pack for more, and a thin pack of four types is worse than
  a deep pack of two.
- **2026-09-15** — Deterministic rule join instead of vector RAG over a statute corpus — semantic
  retrieval over legal text is the main source of fabricated section numbers, and a wrong citation
  in a legal demo is fatal. Trade-off: coverage is limited to what is curated. Stated openly in
  the pitch.
- **2026-09-15** — Region `asia-south1` (Mumbai) — data residency for a product built around the
  DPDP Act 2023.
- **2026-09-15** — Model choice resolved: **`gemini-2.5-flash`, region `asia-south1`, for every
  stage.** Verified live against the `promptwar-501405` project: `gemini-2.5-flash` returns 200 in
  `asia-south1`; `gemini-2.5-pro` returns 404 there (not served regionally for this project) and
  only answers on the `global` endpoint. Routing Pro-tier calls through `global` would break the
  "every service stays in Mumbai" data-residency claim in `docs/ARCHITECTURE.md` §7, so the pipeline
  uses Flash everywhere instead of a mixed Flash/Pro tier. This is a real quality-vs-residency
  trade-off, not the Flash/Pro split originally planned in §5.2 — worth re-checking Model Garden
  regional availability again closer to judging in case Pro-tier regional access opens up.
- **2026-09-15** — **Scope widened to three surfaces** (contracts, judgments, agent) plus Google
  accounts. Full reasoning, verified constraints and the honest cost are in `PLAN.md` §7. Headlines:
  Gemini Live does not exist in this project (asia-south1 serves exactly three models, none of them
  Live or native-audio, and Live 404s in `global` and `us-central1` too), so voice is browser speech
  plus an in-region Flash brain behind `src/lib/voice.ts`. There is no government API for judgment
  text either — eCourts is CAPTCHA-gated and data.gov.in's judiciary catalog has none — so judgments
  come from the AWS Open Data mirror (ap-south-1, CC-BY), which is lawful to reproduce under
  s.52(1)(q) Copyright Act 1957.
- **2026-09-15** — **Ingest only the judgment body, never law-report headnotes.** SCR PDFs wrap each
  judgment in editorial apparatus (Issue for Consideration, Headnotes, Case Law Cited, List of Acts,
  Keywords, Appearances, and a trailing "Headnotes prepared by" credit) which carries its own
  copyright that s.52(1)(q) does not cover. `prepareJudgmentText` strips it and **fails closed**:
  if editorial matter is present but the body start cannot be located, the judgment is refused
  rather than ingested. 3 of 14 in the first batch were refused on exactly that basis.
- **2026-09-15** — **Paragraph numbers must be the judgment's own, never a synthetic sequence.**
  Found during Day 2 verification that indices were off by one, so a citation to ¶14 pointed at
  the judgment's ¶15. For a product whose entire claim is verifiable citation, a lawyer checking
  one reference and finding the wrong text discredits every other claim on the page.
- **2026-09-15** — Rule pack v1 drafted (41 rules: 20 rental, 21 employment) covering the seed
  coverage list in `docs/ARCHITECTURE.md` §4.5, validated against the `RuleCard` Zod schema. One
  drafted rule (a wage-discussion confidentiality clause under Article 19) was dropped rather than
  shipped, because Article 19 does not bind private employers and the rule had no solid citable
  basis — falls short of the "defend it to a lawyer" bar. **The remaining 41 still need the human
  verification-against-the-bare-act pass `PLAN.md` Day 1 calls for** before being trusted for the
  demo; treat them as a strong first draft, not a checked rule pack yet.
- **2026-09-17** — **Upload is no longer gated on document type.** Any legal document can be
  uploaded; the earlier flow made the reader pick "rental agreement" or "offer letter" first.
  The scope decision above still holds for *rule coverage* — the curated pack is still those two
  types only — but the two questions were being conflated. A document outside the pack now gets
  extraction, clause segmentation and grounded Q&A, and is told plainly that no curated
  statutory rules cover it rather than being refused at the door or, worse, shown an empty
  verdict list that reads like "nothing is wrong with this contract".
- **2026-09-17** — **Model responses cached by the full request** (`src/lib/model-cache.ts`).
  Keyed on system instruction, prompt, response schema and model id together, not on the clause
  text alone. Keying on clause text would let boilerplate shared between two contracts hit the
  cache, which sounds like the whole point — but the adjudication prompt also carries the
  governing state, which side the reader is on and the joined rule cards, and each of those can
  change the verdict. The cheap key would serve a confident answer computed for a different
  question.
