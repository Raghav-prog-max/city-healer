# Test Execution Log

**Date:** 2026-11-16. **Working directory:** `C:\Users\rishi\city-healer`. **Shell:** Git Bash on Windows 11.

**Environment** (`logs/environment.txt`):
- Node v25.2.1, npm 11.7.0
- Python 3.13.1 (scikit-learn 1.9.1, numpy 2.4.6, pytest 9.1.1)
- Java for emulators: portable JDK 21 via `FIREBASE_JAVA_HOME`
- CPU Intel Core Ultra 9 185H (22 logical), 34 GB RAM

**Firebase:** local emulators only.
- Dev: Auth 9099, Firestore 8085.
- Throwaway: 9199 / 8185 via `firebase.test.json`.
- No real project is configured.

**Production code was not modified during this audit.**
- New files are only under `CITY_HEALER_AUDIT_REPORT/`.
- The audit scripts import production modules read-only.
- Load tests used a copy of `city_healer.db` in the temp directory.

## Existing suites

| # | Command | Result | Duration | Log |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit -p .` | PASS (exit 0) | 29.3 s | `logs/typecheck.log` |
| 2 | `npm run test:unit` | **109/109 pass**, 25 suites, 0 skipped | 3.6 s | `logs/test_unit.log` |
| 3 | `npm run test:server` (emulators) | **128/128 pass**, 25 suites, 0 skipped | 66.5 s | `logs/test_server.log` |
| 4 | `npm run build` | PASS; warning: chunks > 500 kB | about 15 s | `logs/build.log` |
| 5 | `npx tsx --test --experimental-test-coverage <unit files>` | PASS. Coverage of loaded modules: lines 97.06 %, branches 86.75 %, functions 95.41 %. Server, Firebase routes, DB and frontend **not measured**. | — | `logs/coverage_unit.log` |

Existing test files:
- **Unit:** `triage-heuristic`, `triage-model`, `voice-commands`, `geo`, `specialties`, `hospital-data`, `facility-model`, `platform`, `ai-models`.
- **Server:** `access-matrix`, `resource-ownership`, `booking`.

## Scripts created for this audit (new; they do not change application behaviour)

| # | Command | Result | Output |
|---|---|---|---|
| 6 | `npx tsx CITY_HEALER_AUDIT_REPORT/audit_scripts/eval_ai.ts` | Ran. Intent, triage, copilot (37 msgs), entities (12), documents (10 + failure modes), forecast (9 synthetic series), discovery, facility model on 208 confirmed listings | `results/ai_ml_evaluation.json` |
| 7 | `node scripts/dev-firebase.mjs --no-persist "npx tsx CITY_HEALER_AUDIT_REPORT/audit_scripts/backend_audit.ts"` | Ran (exit 0). 23 security checks: 19 PASS, 4 FAIL. Firestore rules probe; 5 × 20 concurrent bookings; 8 endpoints × 5 concurrency levels; AI rate-limit test | `results/backend_audit.json`, `logs/backend_audit.log` |
| 8 | Intent retrain in a temp copy: `python -X utf8 -I <tmp>/ml/train_intent.py` | Ran in 4.3 s; output bit-identical to `shared/intent-model.json` | `logs/repro_intent.log` |
| 8a | The same with `python -I` (no UTF-8 mode) | **FAIL**: `UnicodeEncodeError` (cp1252), BUG-018 | — |
| 9 | Production server for frontend checks: `NODE_ENV=production PORT=3920 DB_PATH=<tmp copy> node scripts/dev-firebase.mjs --no-persist "node dist/server.cjs"` | Started, measured, stopped | `logs/prod_server.log` |

## Browser checks (built-in browser pane, Chromium)

| Check | Result |
|---|---|
| Landing `/en` cold (679 px): Performance API timings | Recorded (`results/frontend_performance.json`) |
| Landing at 375×812 (mobile UA) and 1440×900, warm | Recorded; no overflow, CLS 0 |
| `/hi` language | PASS |
| `/en/dashboard` without a session | PASS (redirect to sign-in) |
| `/en/get-started` → invalid phone, missing OTP, wrong OTP, emulator OTP | PASS for validation and OTP; **observed consent bypass** (BUG-004) |
| `/some/unknown/page` | FAIL (legacy app, BUG-012) |
| Console errors (production pages) | None |
| Earlier in this session (dev server): Book appointment → book, reschedule | PASS |
| Earlier in this session (dev server): Health wallet report upload | PASS |

## Skipped or not possible

| Test | Why | How to run it |
|---|---|---|
| Playwright E2E | Not installed; no E2E suite in the repo; installing packages is outside an audit-only pass (an earlier `npm install` was blocked by the permission system) | `npm i -D @playwright/test && npx playwright install chromium`, then write specs for onboarding → dashboard → booking |
| Lighthouse (mobile/desktop, throttled) | Not installed | `npx lighthouse http://localhost:3920/en --preset=desktop` and the default mobile preset, against `npm start` |
| INP | Needs interaction tracing | Lighthouse timespan or the web-vitals library in the page |
| PDF extraction | `pdfjs-dist` not installed → `dependency_missing` | `npm install pdfjs-dist@6.4.299`, then re-run `eval_ai.ts` with PDF fixtures |
| OCR | Not implemented | — |
| Voice STT/TTS | Browser Web Speech API needs a microphone and an interactive session | Manual test in Chrome with hi-IN and en-IN |
| Real Firebase project (phone OTP with reCAPTCHA, rules deploy) | No project configured; must not touch production | Create a staging project, deploy `firebase/firestore.rules`, run the server suites against it |
| Zip's Python pytest suite | The FastAPI service is not in the repo (ported to TypeScript; its tests were ported to `tests/platform.test.ts` and pass) | Extract the zip, then `pip install -e ".[dev]" && pytest` |
| Retraining triage, lab, diet and facility models | Would overwrite shipped artefacts; facility needs a 100 MB OSM download | Copy `ml/` and the data into a temp root and run as in #8 |
| DB query counts, React re-render profiling | No instrumentation in the code | Add SQLite query tracing; React Profiler in a dev build |
| Long soak / memory-leak test | Out of time budget | Run `backend_audit.ts` load phases for 30+ minutes and watch the working set |

## Side effects of testing

- Test accounts and documents were created only in **local emulators**:
  - the throwaway ones are discarded on exit;
  - the dev emulators got one phone-OTP account (`+91 9999900001`, no profile) and the earlier booking test patient.
- Temporary SQLite copies were written to `%TEMP%`.
