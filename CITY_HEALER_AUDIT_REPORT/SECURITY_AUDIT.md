# Security and Privacy Audit

**Method:**
- Source inspection of the server, routes, rules, configuration and deploy files.
- Automated probes (`audit_scripts/backend_audit.ts`, 23 checks: 19 pass, 4 fail) against a throwaway server with Firebase emulators.
- The existing 128 server tests (access matrix, resource ownership, booking), all passing.

No real patient data was used. Nothing was sent to an external AI service (none is integrated). No production Firebase project exists or was touched.

## What is solid (verified)

- Every non-public API route requires a Firebase ID token, checked with `checkRevoked`. Missing or garbage tokens → 401.
- Roles come only from custom claims set by an admin CLI.
  - Patient → ADMIN escalation via `PUT /api/users/:uid` → 403, role unchanged.
  - Role changes revoke sessions (existing tests).
- Ownership is enforced:
  - Another patient's user record → 403.
  - Appointments are scoped to the token.
  - Another doctor's slots → 403.
  - Another hospital's beds → 403.
  - Cancel or reschedule of someone else's booking → 404.
- **Firestore rules** (`firebase/firestore.rules`), probed with real emulator ID tokens over REST:
  - A patient can read only their own profile.
  - Profile writes, audit logs, doctors, slots and appointments all return 403 to clients.
- Booking is a single Firestore transaction. 5 × 20 concurrent attempts gave exactly one success per slot.
- Provider registration numbers never leave the server. The discovery ranking ignores browser-supplied provider lists.
- Uploads: 5 MB cap (413), allowlisted content types, nothing stored, executable → `unsupported_type`.
- AI routes: per-user quota (verified 429 at the configured limit). Message text was not found in server logs.
- No server secrets in the repository. The only API-key-like string is a public Firebase **web** key in an unused file (S-09). Service-account JSON is gitignored.
- Same-origin API with no CORS headers emitted (a foreign `Origin` gets no `Access-Control-Allow-Origin`). `X-Powered-By` is disabled; `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy` are set.
- **Prompt injection:** no LLM, so no prompt to subvert. The copilot never performs actions (booking and verification are separate authorised routes). Injection probes produced no leakage and no actions.

## Findings

| ID | Severity | Title | Status |
|---|---|---|---|
| S-01 | **Critical** (patient safety) | Copilot misses self-harm and overdose emergencies | Open (BUG-001/002/003) |
| S-02 | **High** | Health data processed without server-side consent check | Open (BUG-005) |
| S-03 | **High** | Client consent gate fails open on `/api/v1/me` errors | Open (BUG-004) |
| S-04 | **High** | Docker build bakes `.env.local` (emulator mode) into the production frontend | Open (BUG-007) |
| S-05 | Medium | No rate limiting outside AI routes (bookings, hospital reports, SOS, profile, records) | Open |
| S-06 | Medium | No Content-Security-Policy; no HSTS | Open |
| S-07 | Medium | `DEMO_MODE="true"` in the local `.env.local` default; demo identity serves anonymous callers | Open (configuration) |
| S-08 | Medium | Legacy client falls back to a localStorage "database" on API errors (integrity and confusion; data in browser storage) | Open (BUG-012) |
| S-09 | Low | Unused `firebase-applet-config.json` (real project id + web API key) committed; stale root `firestore.rules` | Open (BUG-020) |
| S-10 | Low | Malformed-JSON responses are HTML with parser text; dev mode includes stack traces | Open (BUG-015) |
| S-11 | Low | Binary content named `.txt` is accepted and decoded | Open |
| S-12 | Informational | `trust proxy = 1` assumes exactly one proxy hop | Note |
| S-13 | Informational | Audit logs exist but no admin view, retention or deletion workflow; no data-retention policy for appointments and records | Note |

### S-01 — Copilot misses self-harm and overdose emergencies (Critical)

1. **Where:** `shared/triage.ts:60-87`, `server/ai/orchestrator.ts:129-140`.
2. **Description:** Emergency detection is substring keyword matching. Measured recall is 75 % on 16 emergency messages. "I want to kill myself" → doctor search; "I took 30 sleeping pills" → lab-report prompt.
3. **Reproduce:** `npx tsx CITY_HEALER_AUDIT_REPORT/audit_scripts/eval_ai.ts` → `results/ai_ml_evaluation.json` `copilot_audit_set.rows`.
4. **Impact:** A person in crisis receives no emergency guidance.
5. **Fix:** Expand the self-harm, overdose and breathing lexicons in en/hi/Hinglish with proximity matching, and add a crisis-helpline response (Tele-MANAS 14416, 112). Add a curated emergency regression set (aim for 100 % recall on it), and route the intent model's own `emergency` class to the emergency path as a second net.

### S-02 — Health data processed without server-side consent (High)

1. **Where:** `server/firebase/patients.ts:121-131` (record only); no check in `server.ts` or `server/firebase/booking.ts`.
2. **Description:** Any Firebase account, including one created directly with the SDK and never onboarded, can use records, AI analysis, uploads and booking.
3. **Reproduce:** The `backend_audit.ts` accounts had no consent and got 200/201 on `/api/v1/copilot/chat`, `/api/v1/documents/extract`, `/api/symptoms/check`, `POST /api/v1/appointments`.
4. **Impact:** Processing sensitive personal data without consent; DPDP Act exposure.
5. **Fix:** A `requireConsent(currentTermsVersion, currentPrivacyVersion)` middleware on patient data routes → `403 CONSENT_REQUIRED`, which the UI routes to onboarding.

### S-03 — Consent gate fails open (High)

1. **Where:** `src/site/lib/session.tsx:65-67` (catch → `needsOnboarding(false)`); `src/site/onboarding/Onboarding.jsx:30`.
2. **Reproduce:** Make `/api/v1/me` fail (server down, 5xx, token rejected) after an OTP sign-in. The app navigates to the dashboard with no profile or consent (observed; see BUG-004).
3. **Fix:** Fail closed, and rely on S-02 for enforcement.

### S-04 — `.env.local` in Docker builds (High)

1. **Where:** `.dockerignore` lists `.env` only; `Dockerfile` `COPY . .` then `npm run build`.
2. **Impact:** The production bundle is compiled with `VITE_FIREBASE_EMULATORS=true`, and with whatever web config is in the developer's local file. Sign-in breaks in production, or a dev project is wired in.
3. **Fix:** `.dockerignore`: `.env*` with `!.env.example`; supply `VITE_*` as build args or CI secrets.

### S-05 — No general rate limiting (Medium)

1. **Where:** `server.ts` (only `aiRateLimit`, lines 185-230).
2. **Reproduce:** 150 rapid `POST /api/hospitals/hosp-1/report` calls → no 429.
3. **Impact:** Unthrottled booking attempts, slot scraping, SOS spam, Firestore cost amplification.
4. **Fix:** A per-user and per-IP limiter on all writes, with stricter limits on `/api/emergency/sos` and booking.

### S-06 — Missing CSP and HSTS (Medium)

1. **Where:** `server.ts:66-74` (headers middleware).
2. **Fix:**
   - A CSP that allows self, Firebase and Google endpoints and `images.unsplash.com` (or self-host the images).
   - HSTS when served over HTTPS.

### S-07 — Demo mode on by default locally (Medium)

1. **Where:** `.env.local` (`DEMO_MODE="true"`), loaded by `env.ts` and `scripts/dev-firebase.mjs`.
2. **Impact:** Local development runs with an anonymous shared identity. The README warns never to enable it in production. The runtime image does not include `.env.local`, but hosts that load it (non-Docker deploys) would inherit it.
3. **Fix:** Default to false; enable only explicitly.

### S-08 — localStorage fallback database (Medium)

1. **Where:** `src/utils/api.ts:636-641`, reachable through `src/site/SiteRouter.tsx:67`.
2. **Impact:** On network errors or 404s (for example a Vercel static deploy), the legacy UI shows and stores data that never reached the server. Health-like data stays in browser storage.
3. **Fix:** Remove the legacy catch-all and the fallback.

### Lower-severity findings

- **S-09:** Delete `firebase-applet-config.json`, `firebase-blueprint.json` and the root `firestore.rules`, or mark them archival.
- **S-10:** Add a JSON error handler after `express.json()`.
- **S-11:** Reject non-UTF-8 or binary content in `.txt` uploads.

## Privacy review

| Topic | Observation |
|---|---|
| Data collected at onboarding | Name, phone or email, NCR city, optional locality, language, optional date of birth and gender. Proportionate. ABHA is **not** collected (text only). |
| Health data | Lab values and records (SQLite `medical_records`), appointments with an optional reason (Firestore), copilot messages (processed, not stored or logged). |
| Uploaded reports | Read in memory, never stored (verified by code; no write paths). |
| Consent | Recorded append-only with versions; **not enforced** (S-02, S-03). |
| Audit trail | Firestore `auditLogs`, client-denied; no retention policy. |
| Third parties | Firebase (Google); Unsplash images load in the visitor's browser and expose IP and user agent to Unsplash. |
| Data at rest | SQLite file unencrypted on disk or volume; Firestore managed. |
| Deletion / export (data-principal rights) | Not implemented. |
