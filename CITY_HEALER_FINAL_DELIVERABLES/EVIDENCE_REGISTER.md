# Evidence Register

This register lists every technical claim in the deliverables with the evidence behind it.

**Conventions:**

- **Line numbers** refer to `origin/main` at commit `55443ec` (merge of PR #16, 16 Nov 2026 23:12 UTC). To read a file at that commit: `git -C C:\Users\rishi\code\city-healer show origin/main:<path>`.
- **"Results"** means `CITY_HEALER_AUDIT_REPORT/results/` in the repository. The final files were generated on 16 Nov 2026 between 22:57 and 23:07 UTC on a local machine with emulators.
- **"First audit"** means the audit reports dated 16 Nov 2026, written before PR #5.

**Status values:**

| Status | Meaning |
|---|---|
| Verified | Code, test, PR body or log was read |
| Measured | Number taken from a results file or report |
| Known issue | Gap confirmed in the code or a PR |
| PENDING | Not yet available |

## A. Architecture and identity

| ID | Claim | Evidence | Status |
|---|---|---|---|
| E-01 | One Express process serves the API and the built frontend | `server.ts:1459` `initServer`; `express.static` at `:1488` | Verified |
| E-02 | Security headers on every response; HSTS and CSP in production only | `server/httpHardening.ts:17-50`; mounted at `server.ts:77`; tests in `tests/security-headers.test.ts` | Verified |
| E-03 | JSON 400 for malformed JSON, JSON 404 for unknown `/api` routes, JSON 500 without stack | `httpHardening.ts:52`, `:59`; `server.ts:1467`, `:1495`; test "malformed JSON is a JSON 400 INVALID_JSON without the parser message" | Verified |
| E-04 | Public GET allow-list | `server.ts:113` | Verified |
| E-05 | Firebase ID token verified with a revocation check | `server/firebase/identity.ts:47` | Verified |
| E-06 | Roles come from admin-set claims; a role change revokes sessions | `identity.ts:1-37`; test "an administrator's role change revokes the account's existing sessions" | Verified |
| E-07 | `requireRole` guard | `server.ts:190` | Verified |
| E-08 | Firestore denies clients by default; patients may read only their own profile and consents | `firebase/firestore.rules`; `backend_audit.json` `firestore_rules_probe` | Verified, Measured |
| E-09 | Frontend routes, including the Hospital workspace, admin listings and the 404 page | `src/site/SiteRouter.tsx:84-104` | Verified |
| E-10 | Legacy app and localStorage fallback removed | `src/App.tsx` and `src/utils/api.ts` are absent from `origin/main`; PR #12 | Verified |
| E-11 | Retired SQLite routes answer 404 | PR #12; access-matrix "`${method} ${route}` -> 404 for patient, doctor and admin" | Verified |

## B. Consent and privacy

| ID | Claim | Evidence | Status |
|---|---|---|---|
| E-12 | Consent gate is default-deny and refuses access when consent cannot be checked; SOS is exempt | `server/firebase/consent.ts:1-60` (exemptions at `:22-31`); mounted at `server.ts:173` | Verified |
| E-13 | Consent tests | `tests/consent.test.ts`, `tests/consent-rules.test.ts`; PR #5 | Verified |
| E-14 | Audit events hold ids only, with no diagnoses or message text | Test "the audit trail records the act, not the diagnosis or medicines"; PR #15 | Verified |
| E-15 | No message text in server logs under load | `backend_audit.json` `server_log_lines_containing_message_text = 0` | Measured |
| E-16 | Uploaded reports are not stored | Test "a report file is read without being stored" | Verified |

## C. AI and algorithms

| ID | Claim | Evidence | Status |
|---|---|---|---|
| E-17 | A1–A14 are implemented and documented; A13 is a documented deviation | `docs/ALGORITHMS.md`; PR #13; `tests/algorithms.test.ts` (36 tests) | Verified |
| E-18 | The LLM path is off without a key and has never run against real Gemini | PR #13; `server/ai/llm.ts:206` `llmConfigFromEnv`; test "A9: no key configured means exactly the offline result plus engine: offline" | Verified |
| E-19 | Emergency rules run first and override the LLM | `shared/emergencySafety.ts:104`; `shared/triage.ts:406`; test "A2: emergency rules override the LLM - the model is never called" | Verified |
| E-20 | Hybrid offline triage (threshold 0.40) | `shared/triageModel.ts:38`, `:180` | Verified |
| E-21 | Language detection by Devanagari range | `shared/triage.ts:40` | Verified |
| E-22 | Hospital score; no rating term; maximum 120 | `shared/hospitalRanking.ts:19`, `:42`, `:74`, `:83`; used at `server.ts:369-376` | Verified |
| E-23 | Nearest-hospital scan used by SOS | `shared/geo.ts:56`; `server.ts:1072` | Verified |
| E-24 | Wait estimate; equals 12q + 10 when there is no data | `shared/waitTime.ts:44-56`; test "A7: with no timing data it equals the original 12q + 10" | Verified |
| E-25 | Backoff with jitter and model failover | `server/ai/llm.ts:139`, `:149`, `:176` | Verified |
| E-26 | RAG with citations; abstains when nothing is retrieved | `server/ai/rag.ts:44-78`; `server.ts:1294` | Verified |
| E-27 | Robust JSON extraction and zod validation | `server/ai/llm.ts:35`, `:56`, `:79`, `:95` | Verified |
| E-28 | Emergency set, final run: recall 100 % dev (n = 36) and held-out (n = 24); false positives 5.7 % (2 of 35); latency p50 0.032 ms | `emergency_eval.json` label `final_2026-11-17` (22:57 UTC) | Measured |
| E-29 | Earlier emergency runs: recall 30.6 %/33.3 % before the fix, 100 %/100 % after; false positives 5 % (1 of 20) | `emergency_eval.json` labels `before`, `after` (14:47, 14:51 UTC) | Measured |
| E-30 | The 5 % vs 5.7 % discrepancy is resolved: the non-emergency set grew from 20 to 35 messages | E-28, E-29 | Verified |
| E-31 | Triage 95.3 % public test; 93.6 % fresh test; answers 57.3 % of inputs and is right on 96.8 % of those | `ai_ml_evaluation.json` (22:57 UTC); `ml/README.md` | Measured |
| E-32 | Intent model 93.8 % held-out; 100 % on the robustness set | `ai_ml_evaluation.json` | Measured |
| E-33 | Copilot route accuracy 81.1 %, emergency recall 100 %, false positives 4.8 % (37 messages) | `ai_ml_evaluation.json` `copilot_audit_set` | Measured |
| E-34 | Entity extraction P 93.8 %, R 83.3 %, F1 88.2 % | same | Measured |
| E-35 | Lab-report reader precision and recall 96.4 %, up from 84 %/75 % in the first audit | same; first-audit AI_ML_EVALUATION Module 3 | Measured |
| E-36 | Lab AUC 0.808 / 0.907 / 0.817; medicine search P@5 72 %; diet MAE 0.659 g | First-audit AI_ML_EVALUATION Module 6 | Measured (first audit) |
| E-37 | Facility classifier: 87.0 % recall on 208 confirmed hospitals; not re-measured in the final run (0 confirmed listings in the local database) | First-audit Module 5; final `facility_model_on_confirmed_hospitals` | Measured (first audit) |
| E-38 | No LLM in use during any evaluation | `ai_ml_evaluation.json` `copilot_audit_set.engine`; PR #13 | Verified |

## D. Booking, consultation and other modules

| ID | Claim | Evidence | Status |
|---|---|---|---|
| E-39 | Booking, cancel and reschedule each run as a Firestore transaction | `server/firebase/booking.ts:141`, `:163`, `:241` | Verified |
| E-40 | 20 concurrent bookings per round → exactly 1 created and 19 conflicts, in every round | `backend_audit.json` `concurrent_booking` | Measured |
| E-41 | Refusing a doctor cancels their upcoming appointments; notices are queued, never sent | `booking.ts:208`; PR #11 | Verified |
| E-42 | Consultation: complete, cancel, prescription, records inside a 24 h before / 14 days after window | `server/firebase/consultations.ts:40-41`, `:107`, `:122`, `:137` | Verified |
| E-43 | Messages: no AI reply; fixed safety notice; urgent flag; 200-message cap | `server/firebase/messages.ts:50`, `:143`, `:216`; PR #15; messages tests | Verified |
| E-44 | Check-in: IST day, from 60 min before start, at most 3 check-ins, ordered by booked time | `server/firebase/checkin.ts:45`, `:47`, `:147`; PR #15 | Verified |
| E-45 | Check-in composite index must be deployed before production | PR #15; `firebase/firestore.indexes.json` | Known issue |
| E-46 | Prescription PDF; jsPDF is lazy-loaded; no Devanagari | `src/site/lib/prescriptionPdf.ts:30`, `:95`; PR #14 | Verified, Known issue |
| E-47 | Demo pharmacy: server recomputes the total and checks the prescription requirement and stock | `src/site/app/PharmacyOrder.tsx`; `server.ts:970-1050`; tests under "order integrity" | Verified |
| E-48 | Order route trusts `prescriptionAttached` | `server.ts:1017`; PR #14 "Not done" | Known issue |
| E-49 | SOS: nearest hospital; simulated ambulance reference; the UI says to call 112 | `server.ts:1059-1110`; `EmergencyPage.tsx:1-5` | Verified |
| E-50 | SOS alerts are scoped to the desk's own facility | `server.ts:1114-1160`; test "a hospital desk sees and updates only the SOS alerts routed to its own facility" | Verified |
| E-51 | Hospital workspace and facility route | `src/site/staff/HospitalWorkspace.tsx`; `server.ts:573` | Verified |
| E-52 | Write limits: 120 per 10 min (bookings, records, reports, orders); 10 per 10 min (SOS) | `server.ts:181-187`; PR #14 | Verified |
| E-53 | AI quota 300 per hour per user | `server.ts:209-237` | Verified |
| E-54 | Session restored on reload; prescriptions shown in the patient's local date | PR #16; `src/site/lib/session.tsx` | Verified |
| E-55 | Sample hospital and directory-doctor data are labelled as such in the UI | Coordinator's final facts; README "Sample directory" | Verified (secondary source) |

## E. Tests, performance, build and deployment

| ID | Claim | Evidence | Status |
|---|---|---|---|
| E-56 | Final run: 225 unit and 309 server tests pass, 0 fail, exit 0 | `final-npm-test.log` lines 356–363 and 831–846 | Verified |
| E-57 | After PR #16: `tsc` clean, 225 unit tests pass | Coordinator's final facts | Verified (secondary source) |
| E-58 | Per-PR test counts | PR bodies #8–#11, #13–#15; #12 from the coordinator | Verified |
| E-59 | The emergency-safety suite is in `test:unit` | `package.json` on `origin/main`; PR #13 | Verified |
| E-60 | Load tests: 0 % errors in all 120 rows of three local runs (16 Nov 23:07Z and 23:26Z, 17 Nov 00:19Z); triage at c=1 150–306 req/s, p95 5.0–9.9 ms; `/api/hospitals` at c=1 322–550 req/s | `results/backend_audit_2026-11-16T2307Z.json`, `results/backend_audit.json` (23:26Z) and `results/backend_audit_2026-11-17T0019Z.json` (local) | Measured |
| E-61 | Cold start 3.4–5.9 s; working set 190–349 MB (three runs); hospitals payload 51 KB | `results/backend_audit_2026-11-16T2307Z.json`, `results/backend_audit.json` (23:26Z) and `results/backend_audit_2026-11-17T0019Z.json` | Measured |
| E-62 | Security checks 25/25 pass on the corrected audit (23:26Z); the earlier 23:07Z run had 19/23 (4 FAILs: development-mode headers and probes of removed routes) | `backend_audit.json` `security_checks` | Measured (the coordinator summary said 23/23; corrected here) |
| E-63 | First-audit performance: triage about 51–61 req/s; `/api/hospitals` 918 KB | First-audit PERFORMANCE_AND_EFFICIENCY.md | Measured (first audit) |
| E-64 | Vite build: main 691.9 kB (197.0 kB gzip), jsPDF 390.6 kB, CSS 61.6 kB, `dist/` 1.9 MB, 5.8 s | Coordinator's final facts | Verified (secondary source) |
| E-65 | Release-build safeguards | `shared/buildEnv.ts:29`, `:45`; `tests/build-env.test.ts`; PR #7 | Verified |
| E-66 | No `docker build` run; not deployed; no real Firebase project | PRs #7, #14; Build Summary §10 | Verified |
| E-67 | Production CSP not tried in a browser | PR #14 | Known issue |
| E-68 | Post-vs-cancel race test may not catch its target regression | PR #15 | Known issue |
| E-69 | Hindi wording needs fluent review | PR bodies #5–#15 | Known issue |
| E-70 | First-audit scores (15 categories) predate PRs #5–#16 | `results/scorecard.json` | Measured (outdated) |
| E-71 | 28 figures: 25 screenshots captured from the running app (local emulators, synthetic accounts), the architecture diagram (fig-19), the test-output capture (fig-26) and the title slide (fig-28) | `screenshots/fig-01…fig-28` | Verified |
| E-72 | Demo accounts and `scripts/seed-demo.ts` | Coordinator's final facts. The file is in the local checkout but was not on `origin/main` at `55443ec` | PENDING (merge) |
| E-73 | Nothing is clinically validated | `shared/emergencySafety.ts:1-5`; `ml/README.md`; PR #13 | Verified |
