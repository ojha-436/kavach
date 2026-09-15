# Hackathon Context — PromptWar Virtual Edition

> Single source of truth for this project. Claude: treat everything here as hard constraints.
>
> ⚠️ **INCOMPLETE — fill the TODO sections on Day 1.** The required stack and judging rubric are
> unknown, and both can invalidate decisions already made in `docs/ARCHITECTURE.md`.

## Event
- **Hackathon:** PromptWar — Virtual Edition
- **Track / theme:** GenAI for legal information and basic legal assistance
- **Submission deadline:** TODO — date and timezone
- **Deliverables:** TODO — deployed URL? repo? pitch video? deck?
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

**TODO — blocks architecture sign-off.** If the organiser mandates a stack, it overrides
`docs/ARCHITECTURE.md` entirely.

Current working assumption (chosen by us, not mandated):
Google Cloud — Cloud Run, Vertex AI, Firestore, Cloud Storage, Document AI — region `asia-south1`.

## Judging rubric

**TODO — paste the real rubric.** Weights drive where the last two days go.

| Criterion | Weight | Notes on how to score max |
|---|---|---|
| TODO | | |

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
  - `/analyze` contract clause segmentation · `/judgments` judgment explainer · `/ask` the agent
- **Repo:** TODO — local git initialised at `D:\projects\promptwar-kavach`, not yet pushed. GitHub
  push blocked on Day 1 by an invalid/expired credential (`mcp__github` returned "Bad credentials")
  and no `gh` CLI installed. Reconnect GitHub auth (or install/login `gh`), then push.
- **Demo video:** TODO

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
