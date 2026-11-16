# City Healer — Executive Summary (Audit, 2026-11-16)

## Release recommendation

**NOT READY for real patients.** Two blockers are patient-safety issues; three are privacy or deployment issues. Detail in BUG_REGISTER.md and SECURITY_AUDIT.md.

1. The copilot's emergency detection missed **4 of 16** emergency messages in an audit test set. The misses include **suicidal intent** ("I want to kill myself" → doctor search) and an **overdose** ("I took 30 sleeping pills" → lab-report prompt).
2. **Consent is not enforced.** The server never checks it, and the client skips the consent step if the profile check fails.
3. The report reader can pre-fill **wrong** lab values: "1.5 lakh" platelets becomes 1,500.
4. A Docker production build would bake in the local emulator settings (`.env.local`).

**Suitable today for:** internal demos on local emulators.

**Estimate:** the P0 fixes are about 4–6 days of work. The audit scripts should then be re-run.

## What actually works (verified by execution)

- **237 automated tests pass** (109 unit + 128 server on emulators). Type-check and production build pass.
- **Firebase identity and authorization are solid.**
  - Tokens are verified with revocation checks; roles come only from admin-set claims.
  - IDOR and privilege-escalation probes fail as they should.
  - Firestore rules deny all client access except a patient's own profile (probed over REST with real emulator tokens).
- **Booking integrity holds.** 5 rounds of 20 simultaneous bookings of one slot gave exactly one success each. Cancel and reschedule free and take slots correctly. Unverified, pending and rejected doctors cannot be booked. Registration numbers stay private.
- **Onboarding uses real Firebase phone auth** (emulator-issued OTP, not a simulation). Validation messages work.
- **Frontend renders** in English and Hindi, at mobile and desktop widths, with no console errors, no broken images and CLS 0.
- **Trained models are genuinely trained here and reproducible.** The intent model retrains bit-identically.
  - Triage: public test **95.3 %**.
  - Intent: held-out **93.8 %**.
  - Lab risk models: test AUC **0.81 / 0.91 / 0.82** (diabetes / heart / liver).

## What does not work, or is only partial

- **No LLM or generative AI anywhere.** The copilot is trained classifiers plus rules plus templates. LLM token usage and cost: NOT APPLICABLE.
- Copilot route accuracy is **70 %** on the audit set. Emergency recall is **75 %**; the false-positive rate is 4.8 %.
- **Document intelligence works on TXT only.**
  - PDF needs a package that is not installed.
  - There is **no OCR**.
  - On 10 synthetic reports, field precision is 84 % and recall 75 %, including some wrong values.
- **Voice** relies on the browser's built-in speech API. **Not evaluated.**
- **Forecasting:** no real data exists. **Real accuracy NOT EVALUATED.**
  - On synthetic series it beats a naive baseline on 8 of 9 shapes.
  - It is worse than naive when there are spikes.
- **Care-discovery ranking quality: NOT EVALUATED** (no verified providers, no relevance judgments).
- **Integration gaps:**
  - Two appointment systems: the dashboard shows only the legacy SQLite one, so new Firestore bookings are invisible there.
  - Two doctor repositories: the copilot recommends the 80 sample doctors, not verified providers.
  - The legacy app still loads on any unknown URL, with its own sign-in and a localStorage fallback "database".
  - There is no doctor or admin UI for provider onboarding.
- **"Seven-module Python service" does not exist as a service.** It was ported into the Node server. No external healthcare knowledge source is integrated.

## Efficiency (measured locally; see PERFORMANCE_AND_EFFICIENCY.md)

| Route | Throughput | Latency |
|---|---|---|
| Light (health, NLP, document extract) | 1,700–4,500 req/s | p95 under 50 ms at 50 concurrent |
| Copilot and triage | **~60 req/s**, CPU-bound | p95 about **1 s** at 50 concurrent |
| `/api/hospitals` | ~50 req/s | — |

- Copilot and triage are slow because every call scans and JSON-parses all 990 hospitals.
- `/api/hospitals` ships 918 KB.
- **No HTTP compression.** The 762 kB entry script is sent uncompressed; it would be 213 kB gzipped. Assets are cached with `max-age=0`.
- Landing page LCP: 180 ms desktop and 1.16 s mobile (warm cache, no throttling, so best case).

## Scorecard

Scores reflect evidence gathered in this audit. "NOT EVALUATED" means there was not enough evidence to score.

| Category | Score | Evidence behind the score |
|---|---|---|
| Frontend functionality | **62/100** | Renders, i18n, responsive, no console errors; but legacy catch-all, errors shown as empty states, dashboard misses Firestore bookings, no E2E suite |
| Patient onboarding | **55/100** | Real Firebase OTP and validation work (emulator); consent gate fails open and is not enforced server-side; no ABHA field; never run against a real project |
| Doctor discovery and booking | **70/100** | Transactional booking proven under contention; verification gates hold; but no provider/admin UI, zero real verified providers, split repositories |
| Backend reliability | **66/100** | 237 tests pass, 0 % errors under load; CPU-bound hot routes, HTML error responses, no general rate limiting, memory growth unexplained |
| Authentication and authorization | **78/100** | Strong token, claims and ownership checks and locked-down rules (all probes pass); deducted for consent not enforced and the demo-mode default |
| AI Copilot | **40/100** | Deterministic and injection-proof by design, but emergency recall 75 % with self-harm and overdose misses (safety-critical), route accuracy 70 %; rule + ML hybrid, not an LLM |
| NLP and Voice | **55/100** | Intent 93.8 % held-out but 75 % CV on a small team-written set; entities are a word list (F1 88 % on 12 sentences); voice NOT EVALUATED (browser API only) |
| Document Intelligence | **30/100** | TXT only, PDF non-functional, no OCR; wrong values pre-filled on Indian number formats |
| Predictive ML | **NOT EVALUATED** | Implemented and sound on synthetic series (beats naive 8/9), but no real dataset exists to evaluate it on |
| Care Discovery | **45/100** | Hospital ranking and facility model work (facility recall 87 % on confirmed hospitals); provider ranking is connected but the repository is empty; ranking quality NOT EVALUATED; copilot uses sample doctors |
| Proprietary Model Research | **58/100** | 8 models genuinely trained on documented public data, with model cards, parity tests and verified reproducibility (intent); but small team-written test sets, no dataset cards, no artefact registry, no clinical validation |
| AI Operations | **40/100** | Health, inventory and in-memory latency/abstention monitoring are real; no persistence, alerting, drift detection, versioned rollback or error monitoring |
| Performance and efficiency | **52/100** | Light routes fast; hot AI and hospital routes cap near 60 req/s; no compression or long caching; 918 KB hospital payload; 1.6 MB legacy chunk |
| Security and privacy | **50/100** | Authz and rules strong; consent not enforced (High), deploy env leak (High), no CSP/HSTS, no general rate limit; plus the safety finding |
| Overall integration | **50/100** | Patient path works end to end on emulators; split appointment and doctor systems, legacy app, no provider UI, no real Firebase project, no external knowledge sources |

## Where to read more

| Question | Document |
|---|---|
| What is where, and what is duplicated? | REPOSITORY_INVENTORY.md |
| What is the feature-by-feature evidence? | FUNCTIONAL_TEST_REPORT.md |
| How do the seven modules perform, with metrics and datasets? | AI_ML_EVALUATION.md |
| Latency, throughput, bundle and paint numbers? | PERFORMANCE_AND_EFFICIENCY.md |
| Security findings with severity and fixes? | SECURITY_AUDIT.md |
| Which systems genuinely talk to each other? | INTEGRATION_STATUS.md |
| What are the 21 reproducible bugs? | BUG_REGISTER.md |
| What should be fixed first? | RECOMMENDED_ACTION_PLAN.md |
| Which commands ran, and what was skipped? | TEST_EXECUTION_LOG.md |
| Machine-readable results | `results/*.json` |
| Audit scripts to re-run | `audit_scripts/` |
