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
- **Deployed app:** TODO
- **Repo:** TODO
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
- **2026-09-15** — Model choice deferred to Day 1, pending Vertex AI Model Garden regional
  availability check. See `docs/ARCHITECTURE.md` §5.2.
