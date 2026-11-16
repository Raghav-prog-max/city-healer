# Functional Test Report

**Legend:**

| Label | Meaning |
|---|---|
| PASS | Executed and behaved correctly |
| FAIL | Executed and misbehaved (bug ID given) |
| PARTIAL | Works with limits |
| NOT TESTED | Not executed; reason given |

**Sources:** existing automated suites (237 tests), audit scripts (`audit_scripts/`), and browser checks on the production build (port 3920) and the dev server (port 3000), all against local Firebase emulators.

## A. Frontend

| Check | Result | Evidence / notes |
|---|---|---|
| Startup (prod build) | PASS | `node dist/server.cjs` healthy; `/api/health` 200 |
| Landing renders (en) | PASS | No console errors, no broken images, CLS 0 |
| Hindi switching | PASS | `/hi`: `lang="hi"`, Hindi heading |
| Responsive: mobile 375×812 | PASS | No horizontal overflow; screenshot reviewed |
| Responsive: desktop 1440×900 | PASS | No horizontal overflow |
| Navigation guard | PASS | `/en/dashboard` without a session → `/en/sign-in?next=/en/dashboard` |
| Unknown URL | FAIL | Legacy app's own sign-in form instead of not-found (BUG-012) |
| Forms and validation (onboarding phone) | PASS | "Enter a valid Indian mobile number (10 digits, starting 6 to 9)." |
| Search, filters, sorting (booking tab) | PARTIAL | Filters are client-side over at most 100 verified doctors; exercised with one emulator doctor, not with many providers |
| Modals (booking, profile) | PASS | Booking and reschedule modals opened, slots listed in IST, confirmed |
| Empty states | PASS | "No verified doctors yet" message when the repository is empty |
| Error states | FAIL | Dashboard shows load failures as empty lists (BUG-016) |
| Loading states | PASS (visual) | Spinners present on booking and wallet; not timed |
| API connection failure | PARTIAL | New site shows errors; legacy app silently falls back to localStorage data (BUG-012) |
| Browser console errors | PASS | None on visited production pages. Dev-server Vite HMR WebSocket errors after a restart are dev-only noise. |
| End-to-end suite (Playwright) | NOT TESTED | Not installed, no E2E suite exists |

## B. Patient onboarding

| Check | Result | Notes |
|---|---|---|
| Patient / caregiver choice | PASS (rendered) | Step 1 offers "Myself" / "A family member" |
| Contact validation | PASS | Short number rejected |
| Continue without OTP | PASS | "Send the code first…" |
| OTP: real or simulated? | **Real Firebase phone auth** | Code issued by the Firebase Auth emulator (`/emulator/v1/.../verificationCodes`). Against a real project this needs reCAPTCHA and SMS billing; **not tested on a real project**. |
| Wrong OTP | PASS | "That code is not right…" |
| Correct OTP | PASS | Account created in the Auth emulator |
| Profile creation, NCR city, consent | FAIL in the observed run | After the OTP the app skipped steps 3–5 because `/api/v1/me` failed; no profile and no consent were saved (BUG-004). The normal path (profile → consent) was exercised in earlier sessions and by the server tests (`/api/v1/me/profile`, `/consents`). |
| Optional ABHA | NOT IMPLEMENTED | Only explanatory text ("You can connect an ABHA number later"); no ABHA field or integration |
| Invalid profile inputs | PASS (API) | Strict zod schema; covered by `tests/access-matrix.test.ts` |
| Session persistence | PASS | Firebase SDK persistence; dashboard reachable after reload in earlier sessions |
| Server-side consent enforcement | FAIL | BUG-005 |

## C. Doctor discovery and booking

| Check | Result | Notes |
|---|---|---|
| Directory (80 sample doctors) search and filters | PASS | Look-only; "Not verified · booking unavailable" |
| Unverified doctor cannot be booked (legacy route) | PASS | 409 `DOCTOR_NOT_VERIFIED` (`backend_audit`) |
| Pending or rejected provider not listed or bookable (Firestore) | PASS | `tests/booking.test.ts` |
| Registration number never public | PASS | `tests/booking.test.ts`; manual `curl /api/v1/doctors` |
| Frontend → backend → Firestore | PASS | Network log: `POST /api/v1/appointments` 201 → `reschedule` 200; documents created in the emulator |
| Slot selection, booking | PASS | Browser test (emulator doctor) |
| Consultation-type mismatch | PASS | 409 `CONSULTATION_TYPE_MISMATCH` |
| Past slot / unverified | PASS | Slots in the past are refused at publish and at booking |
| **Concurrent booking, same slot** | **PASS** | 5 rounds × 20 simultaneous patients → exactly **1×201 + 19×409** each round |
| Appointment history | PASS (booking tab) / FAIL (dashboard) | BUG-008 |
| Cancellation | PASS | Slot reopens; double cancel → 409 |
| Rescheduling | PASS | Old slot freed, new slot taken; other patient → 404 |
| Doctor application / slot publishing UI | NOT IMPLEMENTED | API and CLI only |
| Real verified providers | NONE | Repository empty outside tests |

## D. Backend

| Check | Result | Evidence |
|---|---|---|
| Firebase token verification (none, garbage, revoked) | PASS | `backend_audit` + access-matrix suite |
| Role-based authorization | PASS | Patient → admin routes 403; hospital → admin forecast 403 |
| IDOR on other patients' data | PASS | `/api/users/:uid` other → 403; appointments scoped to the token |
| Privilege escalation | PASS | `PUT /api/users/:uid {role: ADMIN}` → 403, role unchanged |
| Doctor ownership | PASS | Other doctor publishing slots → 403 |
| Hospital ownership | PASS | Other hospital's beds → 403 |
| Admin-only verification | PASS | Doctor or patient → 403 |
| Input validation | PASS | Strict schemas; over-long text 400; >5 MB upload 413 |
| Rate limiting (AI routes) | PASS | Quota 5 → 6th call 429 |
| Rate limiting (other routes) | FAIL | 150 rapid writes, no 429 (SECURITY_AUDIT S-05) |
| Error handling | PARTIAL | JSON errors in app routes; HTML for malformed JSON (BUG-015) |
| Audit logging | PASS (by inspection + tests) | `auditLogs` writes on profile, consent, booking, verification |
| Firestore transactions | PASS | Concurrency test above |
| Firestore security rules | PASS | REST probe with real emulator ID tokens: own profile 200; others' profile, audit logs, doctors, slots, appointments, writes → 403 |
