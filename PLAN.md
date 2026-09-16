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

> **Scope was widened on Day 2** (see §7 Scope amendment) from "contract analyser" to a three-surface
> platform: contracts, judgments, and an agent that can reach both. Two boundaries written in the
> original plan were deliberately reversed. They are recorded as reversals in §7 rather than quietly
> deleted, because the reasons they were drawn are still real and still constrain the build.

### Surface A — Contract analysis (the original product, Days 1–4)

- Two document types: **residential rental / leave-and-license** and **employment offer letter**
- Upload PDF or DOCX; scanned PDFs via Document AI OCR
- Clause segmentation with character spans, so clicking a finding highlights the clause
- Per-clause verdict: `VOID` / `UNENFORCEABLE_IN_PART` / `ONEROUS_BUT_VALID` / `STANDARD` / `FAVOURABLE`
- Missing-protection diff
- Document risk report with a prioritised action list
- Draft negotiation email to the counterparty
- "Questions for your lawyer" export

### Surface B — Judgment explainer (new)

- Look up a Supreme Court judgment and get it in plain English
- Source: the **AWS Open Data mirror** of SC judgments (`indian-supreme-court-judgments`,
  `ap-south-1`, CC-BY-4.0, 1950–2025). Verified readable with no credentials on Day 2
- Legality: reproducing a court judgment is **not** infringement — s.52(1)(q), Copyright Act 1957.
  We use the judgment body, never law-report headnotes (those carry separate editorial copyright)
- **The model may only interpret within the four corners of the judgment.** Every sentence of an
  explanation carries a span citation into the judgment text, validated against the source after
  generation. An assertion with no locatable span is dropped, not shown. This is the same structural
  trick as validating `ruleId` against the rule pack — enforced in code, not asked for in a prompt
- No prediction, no "what this means for your case", no extension to facts outside the judgment

### Surface C — The agent (new)

A tool-using agent, not a chatbot. It has no free-form legal knowledge to offer: everything it says
comes back from a tool that returns citable data.

- `search_judgments` · `explain_judgment` · `analyse_clause` · `lookup_rule` · `ask_a_lawyer`
- Voice in and out (see §6 for why this is not Gemini Live)
- The refusal path is a tool, not a failure: when a question turns on facts outside the document or
  the judgment, it produces the precise question to put to a lawyer

### Surface D — Accounts

- Google Sign-In (already enabled on the GCP project; Kavach web app registered Day 2)
- Profile with saved documents and past analyses

### Explicitly out of scope — say this in the pitch; knowing your boundary is a maturity signal

- Jurisdictions outside India
- Document types beyond the two above
- Anything resembling legal advice on a specific live dispute
- **Predicting** case outcomes, or applying a judgment to the user's own facts
- High Court judgments in v1 (the corpus exists; the curation time does not)
- Billing

### Cut list, in order, if days slip

1. Voice I/O (the agent works as text; voice is a demo flourish)
2. Scanned-PDF OCR (demo with text-layer PDFs only)
3. Obligations timeline
4. Judgment semantic search (ship a curated set of ~20 landmark judgments instead of the full corpus)
5. Employment doc type (rental alone can carry the demo)

**Never cut:** the rule pack, span highlighting, the absence diff, and span-validated grounding on
judgment explanations. Those four *are* the product. Everything else is surface area.

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

- [x] Signed-URL upload to Cloud Storage — dedicated `kavach-uploads-promptwar-501405` bucket,
      1-day lifecycle delete, CORS opened for the Cloud Run origin (caught by testing the real
      upload button in a browser, not just curl — the direct browser-to-GCS PUT needs CORS that a
      server-side curl test never exercises)
- [x] PDF text extraction **with character offsets** — `pdfjs-dist`, page-mapped. DOCX via `mammoth`
- [x] Clause segmentation: numbering/labelled-line heuristics, ALL-CAPS and paragraph fallbacks,
      one LLM repair pass (merge-only + heading cleanup, never invents offsets)
- [x] Viewer UI: document left, clause list right, click a clause and the span highlights

**DoD:** met — verified against a real deployed browser session, not just the API: uploaded a
synthetic rental agreement, got clean clause segmentation with correct character offsets and
page numbers, clicked a clause in the list and only the matching span in the document highlighted.
No AI verdicts yet, as planned.

Also fixed along the way, not originally itemised here: the Cloud Run service was running on the
default compute service account with project-wide `roles/editor` — replaced with a dedicated
`kavach-run` SA scoped to exactly what Architecture §5.3 lists, plus a Firestore TTL policy on
`analyses.expiresAt` (the field existed since Day 1 scaffolding but nothing was actually enforcing
the 24h deletion promised in the privacy pitch until now).

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

### Day 5 — Employment type, the agent, refusal

- [ ] Employment taxonomy and rule pack wired in — this is where the S.27 moment lives
- [ ] Stage 7 grounded Q&A, now expressed as **the agent's tool loop** rather than a separate feature:
      route to clauses, answer over those clauses only
- [ ] Three-tier answers: document says / law says / not determinable → ask a lawyer *this question*
- [ ] Prompt-injection hardening on document text, tested with an adversarial PDF

**DoD:** upload an offer letter, ask "can I join a competitor?", get the S.27 answer with citation.

### Day 5b — Judgments (added by the Day 2 scope amendment, §7)

- [ ] Ingest a curated set of landmark SC judgments from the AWS mirror into GCS + Firestore
- [ ] Judgment text extraction reusing the Day 2 offset pipeline
- [ ] Span-validated explanation: every sentence cites a paragraph span, unlocatable claims dropped
- [ ] Embedding search over the curated set (`text-multilingual-embedding-002`, in-region)

**DoD:** search "non-compete", open a judgment, and every line of the plain-English explanation can
be clicked back to the exact paragraph of the original that supports it.

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
| **Three surfaces, none finished** | **High** | The Day 2 amendment doubled the product. Surface A alone was already a complete submission. If Day 5 arrives and A is not demo-complete, cut B and C entirely and ship the contract analyser |
| **Judgment explanation drifts into advice** | **High** | Span validation in code, not prompting. No prediction, no application to the user's facts. See §2 Surface B |
| **Agent answers from its own legal knowledge** | **High** | The agent has no free-form answer path — every response is assembled from tool output, and a tool that returns nothing produces a refusal, not a guess |

---

## 6. Open decisions

- [ ] **Organiser's required stack and judging rubric.** Blocks final architecture sign-off.
      Still needed from you: submission deadline/timezone, required deliverables, and the rubric —
      paste them into `docs/HACKATHON.md` when you have them
- [ ] **Voice: accept in-region STT/TTS, or take Gemini Live and lose data residency?**
      Default taken: in-region. Reversible in one file (`src/lib/voice.ts`). See §7
- [x] Model choice: **`gemini-2.5-flash` in `asia-south1`, single-tier, everywhere.** Confirmed live
      that `gemini-2.5-pro` 404s regionally in this project and only serves from `global`; using
      Flash everywhere keeps the data-residency claim intact instead of splitting Flash/Pro across
      regions. See `docs/HACKATHON.md` scope log and `src/lib/llm.ts`
- [x] Product name: **Kavach**. Landing page and repo both use it — stop thinking about it
- [x] Judgment source: **AWS Open Data mirror**, not a government API. See §7

---

## 7. Scope amendment — Day 2

The brief widened from "contract analyser" to "contracts + judgments + a conversational agent, with
accounts". What follows is what was verified before building, and what it costs.

### Two earlier boundaries were reversed

The original plan said **"Case-law search — out of scope. The rule pack is hand-curated and finite,
and that is a deliberate trade"** and **"no multi-user accounts, no persistence beyond 24 hours."**
Both are now in scope. The reasoning that produced those lines has not gone away:

- Case law was excluded because **semantic retrieval over legal text is the main source of fabricated
  citations**, which is fatal in a legal demo. That risk is unchanged. It is contained differently
  now: retrieval only ever returns *whole judgments that exist in our own ingested corpus*, and the
  model is never asked to recall a case — only to explain a document already in front of it, with
  every claim span-checked against that document. Retrieval finds; it never asserts.
- Persistence was excluded to keep the privacy story absolute ("deleted in 24 hours"). With accounts,
  that claim now has to be stated precisely: **anonymous analyses still expire in 24h; signed-in users
  keep their own documents until they delete them.** The pitch must say the second half too, or the
  privacy slide becomes a lie by omission.

### Verified on Day 2, before any of it was built

| Question | Answer | Consequence |
|---|---|---|
| Is Gemini Live available? | **No.** `asia-south1` publishes exactly 3 models to this project: `gemini-2.5-flash`, `text-embedding-005`, `text-multilingual-embedding-002`. Live and native-audio 404 in `asia-south1`, `global` and `us-central1` | Voice = Cloud STT/TTS in `asia-south1` + Flash brain, behind `src/lib/voice.ts` |
| Is there a government API for judgment text? | **No.** eCourts/NJDG is CAPTCHA-gated and institution-only; data.gov.in's judiciary catalog has 62 resources and **zero** judgment text | Use the AWS Open Data mirror |
| Can we legally reproduce judgments? | **Yes** — s.52(1)(q), Copyright Act 1957. Judgment body only; law-report headnotes carry separate editorial copyright | Never ingest SCR headnotes |
| Is the corpus reachable? | **Yes** — `indian-supreme-court-judgments`, `ap-south-1`, no credentials needed, `data/pdf/` + `metadata/{json,parquet}/`. Verified HTTP 200 | Reuse the Day 2 PDF→offset pipeline |
| Is Google Sign-In available? | **Already enabled** on the project | Kavach web app registered Day 2 |

### The honest cost

This roughly doubles the product surface on Day 2 of 7, in a solo build where Surface A — the
contract analyser — was already a complete, defensible submission and is still **not finished**
(Stages 1–6 remain unbuilt). Surfaces B, C and D are additive, not substitutes. The mitigation is
the cut list in §2 and the risk row above: **if Day 5 arrives and Surface A is not demo-complete,
B and C get cut, not compressed.** A finished contract analyser beats three half-built surfaces,
and a judge can tell the difference in about fifteen seconds.

### Day 2 addendum — UX changes that moved a scope line again

- **The document-type picker is gone.** Users upload anything; Stage 1 detects what it is. This is
  what Architecture §4.2 always specified, and asking a worried person to categorise their own
  contract before we'd look at it was a bad trade. **The rule pack did not get any wider.** A
  document detected as `other` is segmented and answerable, but the agent is told, in the tool
  result itself, that it may describe what the document says and may not state what the law
  provides about it. Coverage is surfaced to the user in the UI rather than silently degraded.
- **The standalone Ask page is gone.** Asking now happens beside the thing being asked about — the
  document, or the judgment — with the open item's id passed to the agent as context. One fewer
  page, and the question is never detached from its subject.
- **Judgments gained court/year/case-number filters and regional-language translation.** Translation
  runs over the *already-validated* English explanation, never as a second pass against the source,
  and paragraph citations are reattached from the validated original rather than round-tripped
  through the model — so a translation error cannot move a citation. A length mismatch between
  input and output strings fails the translation rather than risk pairing text with the wrong
  paragraph.
- **History is signed-in only.** Uploads, questions, searches and judgment views are recorded for
  authenticated users, with a delete-everything control. Anonymous sessions are not logged at all:
  keeping a trail for someone who never identified themselves collects more than the product needs.

### Why "agentic" here means tools, not personality

The agent has no free-form legal answer path. It holds five tools — `search_judgments`,
`explain_judgment`, `analyse_clause`, `lookup_rule`, `ask_a_lawyer` — and every sentence it produces
is assembled from what those returned. `ask_a_lawyer` is the refusal path promoted to a first-class
tool: when the question turns on facts outside the document, the correct output is the question the
user should put to a lawyer, not an answer. This is the same instruction-hierarchy discipline as
Architecture §4.3, extended from one prompt to a loop.
