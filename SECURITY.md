# Security

Kavach handles documents people have not signed yet — employment offers,
tenancy agreements — and the questions they are afraid to ask about them. That
is sensitive material, and the threat model is written around it rather than
around a generic web app.

## Reporting

Open a private security advisory on the repository, or raise an issue with no
technical detail and a request to be contacted. Please don't file a public
issue describing an exploitable flaw.

## What this product is actually protecting

**The documents.** An uploaded contract identifies its parties, their address
or employer, and their money. A leak is not abstract.

**The questions.** "Can they fire me for this" is more sensitive than the
contract it is about. Questions are never logged for signed-out users at all.

**The citations.** A fabricated statute reference in a legal tool is a safety
problem, not a quality problem — someone may act on it. The integrity controls
around citations are described in the README under *How the grounding actually
works*, and they are enforced in code and covered by tests.

## Controls

| Area | Control |
|---|---|
| Database | Firestore denies all direct client access ([`firestore.rules`](firestore.rules)). Every read and write goes through the server with the Admin SDK. Verified against the live project: anonymous read and write both return 403 |
| Runtime identity | A dedicated least-privilege service account. It replaced the default compute SA, which carried project-wide `roles/editor` |
| Secrets | Secret Manager, mounted at deploy. Nothing in the image, nothing in the repo — full git history scanned |
| Uploads | Signed URLs straight to Cloud Storage, so the app never handles raw bytes on upload. 15 MB cap. Reads are pinned to our own bucket, so a caller cannot pass an arbitrary `gs://` URI and use the service as a proxy |
| Data lifetime | GCS lifecycle deletes objects after 1 day. A Firestore TTL policy deletes anonymous analyses after 24 hours. Both enforced by the platform, not by application code that might not run |
| Access control | An analysis that belongs to a signed-in user 404s for anyone else — on read *and* on adjudicate, since triggering someone else's analysis is a cost as well as a disclosure |
| Abuse and cost | Per-caller rate limits on every endpoint that spends model tokens. Request size caps (4,000-character questions, 20-turn conversations) |
| Prompt injection | Document and judgment text is wrapped in untrusted-data delimiters and declared non-instruction in the system layer. The agent has no free-form answer path — it may only report what a tool returned |
| Transport and headers | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| Authentication | Firebase Auth with Google as the only provider. The app never sees a password |

## Known limitations

Stated because a security page that lists only strengths is not useful.

1. **Anonymous analyses are protected by an unguessable ID**, not by an access
   check — there is no account to check against. They expire in 24 hours. Once
   a user signs in and the analysis stops expiring, a real ownership check
   applies.
2. **Rate limiting is per Cloud Run instance**, held in memory. Under multiple
   instances the effective limit is higher than the configured one. A shared
   counter or Cloud Armor is the production answer; this stops casual abuse.
   It is keyed on the last `X-Forwarded-For` hop, which is the address Cloud
   Run appends and the one value a caller cannot displace. Keying on the first
   hop — which it did until recently — made the limit bypassable by sending a
   different forged header each request; that is a regression test now, in
   `src/lib/rate-limit.test.ts`.
3. **CSP allows `'unsafe-inline'` for scripts.** A nonce policy is stronger but
   nonces are per-request and most of this app is statically prerendered, so
   there is no request in which to stamp one. The reasoning, and why the
   residual risk is low here, is in `next.config.ts`.
4. **Browser speech recognition leaves the region.** The "Speak" button uses the
   browser's own service, so spoken questions — never document text — go to the
   browser vendor. Stated in the UI, and typing avoids it entirely.
5. **Dependency advisories: none open.** `npm audit` reports zero
   vulnerabilities at every severity, with and without dev dependencies. Ten
   were open previously, and all ten came from two transitive packages that
   Google's Cloud SDKs and Next pin below their patched versions: `uuid`
   (GHSA-w5hq-g745-h8pq) and `postcss` (four advisories, worst a path
   traversal that reads arbitrary `.map` files). `npm audit fix` wanted major
   bumps of `firebase-admin`, `@google-cloud/storage`, `@google-cloud/firestore`
   and Next 16 to resolve them; `overrides` in `package.json` reaches the same
   patched versions without those. The transitive `uuid` is pinned with
   `$uuid` to the direct dependency so the two cannot drift apart again.
   CI fails the build on any advisory at moderate or above.

## Data residency

Every service runs in `asia-south1` (Mumbai), including the model. This is a
deliberate constraint for a product built around the DPDP Act 2023, and it is
why the pipeline uses `gemini-2.5-flash` throughout rather than routing
adjudication through a `global` endpoint — see `PLAN.md` §7.
