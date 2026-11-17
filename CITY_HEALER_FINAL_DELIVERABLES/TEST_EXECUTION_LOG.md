# Test Execution Log

This log records the test and evaluation runs documented in the sources. The person drafting these deliverables did not run any tests. The final `npm test` output is kept verbatim in `final-npm-test.log` in this folder.

All runs used local Firebase emulators on one workstation: Windows, Intel Core Ultra 9 185H (22 logical CPUs), 34 GB RAM, Node v25.2.1. None of them ran against a production system.

## 1. How to run

| Command | What it does |
|---|---|
| `npm run lint` | `tsc --noEmit` |
| `npm run test:unit` | Runs 15 unit files, including `algorithms`, `emergency-safety`, `prescription-pdf` and `appointment-thread` |
| `npm run test:server` | Starts throwaway emulators, then runs 9 server files one at a time: `security-headers`, `access-matrix`, `resource-ownership`, `booking`, `consent`, `provider-admin`, `consultations`, `messages`, `checkin` |
| `npm test` | Runs `test:unit`, then `test:server` |
| `npx tsx CITY_HEALER_AUDIT_REPORT/audit_scripts/eval_emergency.ts` | Measures emergency recall and false alarms → `results/emergency_eval.json` |
| `npx tsx CITY_HEALER_AUDIT_REPORT/audit_scripts/eval_ai.ts` | Runs the AI evaluation → `results/ai_ml_evaluation.json` |
| `node scripts/dev-firebase.mjs --no-persist "npx tsx CITY_HEALER_AUDIT_REPORT/audit_scripts/backend_audit.ts"` | Runs the security, rules, concurrency and load checks → `results/backend_audit.json` |

## 2. Recorded runs

All times are UTC on 16 Nov 2026. Add 5 h 30 min for IST.

| # | Time | Code | Command | Result | Source |
|---|---|---|---|---|---|
| 1 | First audit | Before PR #5 | typecheck / unit / server / build | PASS / 109/109 / 128/128 / PASS | `results/test_summary.json` |
| 2 | First audit | Before PR #5 | `backend_audit.ts` | 19/23 checks; load and concurrency figures in `PERFORMANCE_AND_EFFICIENCY.md` | Audit reports (that JSON file has since been overwritten) |
| 3 | 14:47 | Before the P0.1 fix | `eval_emergency.ts` | Recall: dev 30.6 % (n = 36), held-out 33.3 % (n = 24). False positives: 5 % (1 of 20) | `emergency_eval.json` label `before` |
| 4 | 14:51 | After the P0.1 fix | `eval_emergency.ts` | Recall 100 % / 100 %. False positives 5 % (1 of 20) | label `after` |
| 5 | 16:35–17:56 | PRs #5–#10 | `npm test` | Pass; counts recorded for #8 (162/182), #9 (162/203) and #10 (162/225) | PR bodies |
| 6 | 22:07 | PR #11 | `npm test` | 162 unit / 244 server | PR #11 body |
| 7 | 22:36 | PR #12 | `npm test` | 157 unit / 228 server | Coordinator's final facts (the PR body defers to a merge comment) |
| 8 | 22:46 | PR #13 | `npm test` | 193 unit / 231 server, 0 fail. The emergency-safety suite passed on its own, then was added to `test:unit` | PR #13 body |
| 9 | 22:56 | PR #14 | `npm test` | 207 unit / 239 server, 0 fail. `tsc` clean. Vite main chunk 689.6 kB (196.4 kB gzip) | PR #14 body (agent-reported) |
| 10 | 22:57 | `main` | `eval_emergency.ts` | Recall 100 % (dev, n = 36) and 100 % (held-out, n = 24). False positives 5.7 % (2 of 35). Copilot latency p50 0.032 ms, p95 8.07 ms | label `final_2026-11-17` |
| 11 | 22:57 | `main` | `eval_ai.ts` | Intent 93.8 %. Triage public 95.3 %, fresh 93.6 %. Copilot route accuracy 81.1 %, emergency recall 100 %, false positives 4.8 %. Entity extraction F1 88.2 %. Lab reader precision and recall 96.4 % | `ai_ml_evaluation.json` (`generated_at` 22:57:20Z) |
| 12 | 23:06 | PR #15 merged with `main` (**final**) | `npm test` | **225 unit pass, 0 fail (1.6 s); 309 server pass, 0 fail (155.9 s); exit 0** | `final-npm-test.log` |
| 13 | 23:07 | `main` | `backend_audit.ts` | Cold start 4.05 s. 19/23 checks pass (see §4; corrected and re-run as 13b: 25/25). Rules probe denies everything except reading one's own profile. Booking: 1 × 201 and 19 × 409 in every round. 0 log lines with message text. 0 % errors in all 40 load rows | `backend_audit.json` (`generated_at` 23:07:02Z) |
| 14 | after 23:12 | PR #16 (`55443ec`) | `npx tsc`; `npm run test:unit` | `tsc` clean; 225 unit pass, 0 fail. Server suite not re-run (client-only change) | Coordinator's final facts |
| 15 | after 23:12 | `main` | `npx vite build` | Main JS 691.9 kB (197.0 kB gzip). jsPDF chunk 390.6 kB (128.8 kB gzip). CSS 61.6 kB (13.5 kB gzip). `dist/` 1.9 MB. Built in 5.8 s | Coordinator's final facts |
| 16 | 17 Nov 00:14–00:23 | `main` (`81f23c0`, independent handover audit) | typecheck / unit / server / build / both evaluations / `backend_audit.ts` | `tsc` clean; 225 unit and 309 server pass, 0 fail, 0 skipped; build exit 0; every accuracy figure reproduced; 25/25 checks; triage c=1 181 req/s; cold start 5.9 s | `results/backend_audit_2026-11-17T0019Z.json` and the handover test logs |
| 17 | 17 Nov 00:57–01:03 | `main` (`193f5cd`, after the LLM no-de-escalation fix in PR #21) | typecheck / unit / server / build / both evaluations / `backend_audit.ts` | `tsc` clean; 228 unit and 309 server pass, 0 fail, 0 skipped; build exit 0; every accuracy figure reproduced; 25/25 checks; triage c=1 176 req/s; cold start 3.6 s; higher c=50 latencies (the dev server was running alongside) | `results/backend_audit_2026-11-17T0100Z.json` and the handover test logs |

## 3. Final run (summary of `final-npm-test.log`)

| Field | Value |
|---|---|
| Code | PR #15 branch merged with `main`, i.e. everything except the client-only PR #16 |
| `test:unit` | tests 225, pass 225, fail 0, 1,581.6 ms (log lines 356–363) |
| `test:server` | tests 309, suites 63, pass 309, fail 0, cancelled 0, skipped 0, 155,895 ms (log lines 831–838) |
| Exit code | 0 |
| Warning | Node DEP0190 (child process with `shell: true`). This is a deprecation warning, not a failure. |

## 4. Audit checks marked FAIL in the final `backend_audit.json`

| Check | Why it is marked FAIL |
|---|---|
| Content-Security-Policy header present | The audit server ran in development mode. CSP is sent only in production (`server/httpHardening.ts:32-50`), and this is covered by the security-headers test "production adds HSTS and a CSP …" |
| Strict-Transport-Security header present | Same reason: production only |
| "legacy SQLite booking refuses an unverified directory doctor" | The route was removed in PR #12, so it now answers 404 |
| "legacy booking refuses a past date" | Same reason: the route was removed and answers 404 |

**Done:** `backend_audit.ts` now checks the headers on a production-mode server and expects 404 from the removed routes. The 23:26Z re-run (`results/backend_audit.json`) and the 17 Nov 00:19Z run both pass 25 of 25.

## 5. Not run

| Item | Note |
|---|---|
| Playwright end-to-end tests | Not run |
| Lighthouse, INP, paint metrics on the final build | Last paint metrics are from the first audit |
| PDF extraction | `pdfjs-dist` is not installed |
| OCR | Not implemented |
| Voice | Not run |
| Real Firebase project | None exists |
| `docker build` | Not run |
| Soak test | Not run |
| LLM path against real Gemini | No key is available |
