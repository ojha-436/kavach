# PLAN.md — Kavach (कवच)

> **PromptWar Virtual Edition · 7 days · solo · Indian jurisdiction · Google Cloud**
>
> Companion docs: [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [HACKATHON.md](docs/HACKATHON.md)

---

## 1. Thesis

Most legal-AI submissions will build **"upload a PDF → get a summary → chat with it."** The problem
statement practically dictates it. That build is two hours of work, which means by hour three
everyone is competing on UI polish rather than on the idea.

Kavach answers a different question, and it is a question specific to India:

> **A large share of clauses in everyday Indian contracts are already unenforceable — and people
> comply with them anyway, because nobody ever told them.**

A US-focused tool has to hedge every enforceability claim. An India-focused tool can make hard,
citable statutory statements:

| What the contract says | What Indian law says |
|---|---|
| "2-year non-compete after leaving" | **Void.** S.27, Indian Contract Act 1872 |
| "Arbitrator appointed by the Company" | **Invalid.** *Perkins Eastman v. HSCC* (SC, 2019) |
| "Pay Rs 3,00,000 if you leave before 2 years" | Enforceable **only up to actual training cost.** S.74 ICA |
| "10 months security deposit" | Model Tenancy Act 2021 caps residential at **2 months** (adopting states) |
| "Tenant shall not approach any court" | **Void.** S.28 ICA |
| Agreement under-stamped | **Inadmissible in evidence.** S.35, Indian Stamp Act 1899 |

### The two outputs nobody else will ship

1. **What cannot be used against you** — void and partly-unenforceable clauses, each with the
   statute or judgment cited, each linked to the exact span in the document.
2. **What protection you do not have** — clauses that *should* be present and are absent.
   Absence is structurally invisible to a chat-with-PDF tool: it is not in the context window.

Everything else (summary, Q&A, timeline, negotiation email) is table stakes we get for free once
clause-level analysis exists.

---

## 2. Scope

### In scope (v1, demo-complete)

- Two document types: **residential rental / leave-and-license** and **employment offer letter**
- Upload PDF or DOCX; scanned PDFs via Document AI OCR
- Clause segmentation with character spans, so clicking a finding highlights the clause
- Per-clause verdict: `VOID` / `UNENFORCEABLE_IN_PART` / `ONEROUS_BUT_VALID` / `STANDARD` / `FAVOURABLE`
- Missing-protection diff
- Document risk report with a prioritised action list
- Draft negotiation email to the counterparty
- Grounded Q&A with three-tier answers and explicit refusal
- "Questions for your lawyer" export

### Explicitly out of scope — say this in the pitch; knowing your boundary is a maturity signal

- Jurisdictions outside India
- Document types beyond the two above
- Anything resembling legal advice on a specific live dispute
- Case-law search. The rule pack is hand-curated and finite, and that is a deliberate trade
- Multi-user accounts, billing, persistence beyond 24 hours

### Cut list, in order, if days slip

1. Scanned-PDF OCR (demo with text-layer PDFs only)
2. Grounded Q&A chat
3. Obligations timeline
4. Employment doc type (rental alone can carry the demo)

**Never cut:** the rule pack, span highlighting, the absence diff. Those three *are* the product.

---

## 3. Seven days

Each day has a Definition of Done. If DoD is not met by end of day, cut from the list above rather
than pushing the day into the next one.

### Day 1 — Foundations and the moat

- [x] **Move the repo off OneDrive** to `D:\projects\promptwar-kavach`. OneDrive offloads files
      inside `node_modules` and will break builds mid-week
- [~] `git init` done. GitHub repo **blocked**: `mcp__github` returned "Bad credentials" and no `gh`
      CLI is installed. `docs/HACKATHON.md` TODOs (deadline, deliverables, judging rubric) still need
      the organiser's actual rules pasted in — cannot be filled from assumptions
- [x] GCP project, region `asia-south1`, billing enabled. APIs on: Cloud Run, Vertex AI, Firestore
      (Native, asia-south1), Cloud Storage, Secret Manager, Cloud Build, Artifact Registry.
      **Document AI not yet enabled** — deferred with the rest of the OCR cut-list item
- [x] Next.js 15 skeleton + Dockerfile, **deployed to Cloud Run and reachable**:
      https://kavach-823065407403.asia-south1.run.app
- [x] **Rule pack v1**: `rules/rental.json` (20 rules) + `rules/employment.json` (21 rules), 41 total,
      Zod-validated. **Still needs the human bare-act verification pass** — see next line

> This is the bulk of Day 1 and it is the differentiator. Every rule carries
> `{ id, doc_type, clause_type, statute, section, authority, default_verdict, plain_english,
> negotiation_ask, applies_when }`. It cannot be rushed on Day 6, and it cannot be generated — it
> has to be written by a human who checks each citation against the bare act. **The 41 rules drafted
> today are a first pass, not that verification pass — budget time for it before Day 6.**

**DoD:** a public Cloud Run URL serving a page (done) — a rule pack you would defend to a lawyer
(drafted, not yet human-verified against the bare act; see above).

### Day 2 — Ingest and spans (the ugliest plumbing, so do it early)

- [ ] Signed-URL upload to Cloud Storage
- [ ] PDF text extraction **with character offsets**
- [ ] Clause segmentation: numbering heuristics first, one LLM repair pass second
- [ ] Viewer UI: document left, clause list right, hover a clause and the span highlights

**DoD:** upload a real rental agreement, see it split into clauses, click clause 14, watch it
highlight in the document. No AI verdicts yet — this is pure plumbing and it has to be solid.

### Day 3 — The pipeline, end to end, rental only

- [ ] Stage 1 document frame: doc type, state, and **which side of the contract the user is on**
- [ ] Stage 2 clause typing against the taxonomy
- [ ] Stage 3 deterministic rule join
- [ ] Stage 4 parallel per-clause adjudication, Zod-validated structured output
- [ ] Firestore progress document plus client listener, so clauses light up live as they are judged

**DoD:** upload a bad rental agreement, get real verdicts with real citations in under 30 seconds.

### Day 4 — The differentiating outputs

- [ ] Stage 5 absence diff: expected clause types minus found clause types
- [ ] Stage 6 synthesis: risk score, top-5 actions, negotiation email draft, obligations timeline
- [ ] A report screen worth screenshotting

**DoD:** tonight you have something you would be willing to demo. Everything after this is upside.

### Day 5 — Employment type, Q&A, refusal

- [ ] Employment taxonomy and rule pack wired in — this is where the S.27 moment lives
- [ ] Stage 7 grounded Q&A: route to clauses, answer over those clauses only
- [ ] Three-tier answers: document says / law says / not determinable → ask a lawyer *this question*
- [ ] Prompt-injection hardening on document text, tested with an adversarial PDF

**DoD:** upload an offer letter, ask "can I join a competitor?", get the S.27 answer with citation.

### Day 6 — Polish and harden

- [ ] Curate 3 demo documents containing genuinely bad clauses
- [ ] Document AI OCR path for scanned documents — timeboxed, cut if it fights back
- [ ] Empty, error and loading states; mobile layout; disclaimer placement
- [ ] Rehearse the demo end to end, twice, against the deployed URL

**DoD:** a stranger can use it without you standing next to them.

### Day 7 — Ship

- [ ] Demo video, under 3 minutes
- [ ] README with architecture diagram
- [ ] Pitch deck if the organiser requires one
- [ ] **Buffer.** Something will be on fire. This day exists for that

---

## 4. Demo script

Do not open on an upload screen. Open on an offer letter, full screen, and say:

> "This is a real Indian offer letter. Clause 14 is a two-year non-compete. Every candidate who
> signs this believes they cannot join a competitor for two years.
>
> **It is void. Section 27 of the Indian Contract Act, 1872.** It has been void since 1872.
> Nobody told them."

Then: upload, watch the clauses light up, the red VOID card, click it, the clause highlights in the
document, the citation, the draft email. About 40 seconds of screen time.

Second beat — the one judges remember, because no other submission will have it:

> "Now the harder question. Not what is *in* your contract. What is **missing** from it."

Show the absence panel: no notice period before landlord entry, no cap on rent escalation, no
refund timeline on the deposit.

Close on the refusal:

> "And when it does not know, it says so — and tells you exactly what to ask a lawyer. That is the
> difference between legal *information* and legal *advice*, and it is the line the problem
> statement drew."

---

## 5. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Rule pack citations are wrong | Medium | Verify every section against current bare act text on Day 1. Cite conservatively. Never invent a case name |
| Clause segmentation fails on real PDFs | **High** | Day 2, not Day 5. LLM repair pass. Test against 5 real documents early |
| Scanned agreements dominate the test set | Medium | Document AI path, but demo with text-layer PDFs |
| Vertex AI model unavailable in `asia-south1` | Medium | Verify on Day 1, not Day 6. Fallback documented in ARCHITECTURE.md §5.2 |
| Cloud Run cold start ruins the live demo | Low | `min-instances=1` for the 48 hours around judging |
| Scope creep into more document types | **High** | Two types. Written down. Re-read this line on Day 4 |
| Organiser mandates a different stack | Unknown | `docs/HACKATHON.md` is unfilled. Resolve on Day 1 |

---

## 6. Open decisions

- [ ] **Organiser's required stack and judging rubric.** Blocks final architecture sign-off.
      Still needed from you: submission deadline/timezone, required deliverables, and the rubric —
      paste them into `docs/HACKATHON.md` when you have them
- [x] Model choice: **`gemini-2.5-flash` in `asia-south1`, single-tier, everywhere.** Confirmed live
      that `gemini-2.5-pro` 404s regionally in this project and only serves from `global`; using
      Flash everywhere keeps the data-residency claim intact instead of splitting Flash/Pro across
      regions. See `docs/HACKATHON.md` scope log and `src/lib/llm.ts`
- [x] Product name: **Kavach**. Landing page and repo both use it — stop thinking about it
