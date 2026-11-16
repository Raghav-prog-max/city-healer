# Demonstration Script

**Environment:** local machine. Run `npm run dev` to start the Firebase emulators, the server and the frontend on http://localhost:3000.

**Commit:** `55443ec`.

**Length:** about 12 minutes, plus questions.

**Data:** all synthetic. The screens below match the captured figures in `screenshots/`.

## Demo accounts (local emulators only, synthetic)

| Account | Role |
|---|---|
| `patient.demo@cityhealer.test` | Patient, Delhi, consent already given |
| `doctor.demo@cityhealer.test` | Verified General Physician "Dr Kavya Menon", registration DMC-DEMO-2026-001 (synthetic) |
| `hospital.demo@cityhealer.test` | Hospital desk for `hosp-1` |
| `admin.demo@cityhealer.test` | Administrator |

The password and a one-command way to recreate all four accounts are in `scripts/seed-demo.ts` in the repository. **Do not write the password into slides or reports.**

PENDING: confirm that `scripts/seed-demo.ts` has been merged to `main`.

## Before the demo

1. `npm test` passes. Reference run: 225 unit and 309 server tests, 0 fail (`final-npm-test.log`).
2. Recreate the demo accounts with the seed script, and make sure the doctor has an in-person booking with the patient today. Check-in opens 60 minutes before the start time.
3. Decide the browser location permission in advance.
4. PENDING: record a backup video of a full rehearsal.

## Part A – Patient journey (about 7 minutes)

| # | Say | Do | Audience sees | Figure / evidence |
|---|---|---|---|---|
| A1 | "A patient in Delhi NCR opens City Healer." | Open `/en`. | Landing page. | Fig 1 |
| A2 | "Sign-in uses Firebase. Consent is checked on the server before any health data is used." | Sign in as `patient.demo@cityhealer.test`. | Patient dashboard. | Fig 2; `consent.ts:54` |
| A3 | "She describes symptoms in her own words, here in Hinglish." | Assistant: type a romanised-Hindi symptom message. | Condition, urgency, specialist, disclaimer; answered by the offline engine. | Fig 3; `llm.ts:286` |
| A4 | "The three best hospitals are ranked by department, beds and ICU, and distance – not only the nearest." | Show the hospital cards. | Top 3 with distance, travel time and match reason. | Fig 4; `hospitalRanking.ts:42` |
| A5 | "Verified doctors come first; directory doctors are look-only sample data." | Find care → Book appointment → Dr Kavya Menon. | Open slots; sample doctors marked as not bookable. | PR #8 |
| A6 | "Today she has an in-person visit. She checks in and sees roughly how long she will wait." | Dashboard → check in on today's booking. | "N patients before you" and a wait range. | Fig 5; `waitTime.ts:56` |
| A7 | "She can message the doctor. There is no AI reply. If she writes something that sounds like an emergency, a fixed notice tells her to call 112." | Open Messages: send a normal message, then a message with emergency wording. | The "City Healer automatic notice" and the red Call 112 / Open SOS banner. | Fig 6; `messages.ts:143` |
| A8 | "The doctor sees today's patients in booked-time order, and their messages." | Sign in as `doctor.demo@cityhealer.test` → `/en/provider`. | Today card (Waiting / With you / Done; Call in / Not here), published times, Messages panel with "Possible emergency message". | Fig 7, Fig 8 |
| A9 | "The doctor writes a prescription once; it is signed with the booked doctor's name." | Open the booking → write a prescription. | Prescription form. | Fig 20 (PENDING); `consultations.ts:137` |
| A10 | "It is in her health wallet, and she can download it as a PDF." | Sign in as the patient again → Health wallet → Download PDF. | Prescription in the wallet; the PDF downloads. | Fig 9; `prescriptionPdf.ts:95` |
| A11 | "She orders the medicines from a demo pharmacy, with her prescription attached. There is no payment and no delivery." | Medicines → add items → attach prescription → place order → My orders. | Cart with prescription-required badges and stock. | Fig 10; order confirmation is Fig 21 (PENDING) |
| A12 | "Her health record holds her prescriptions and her lab values." | Health wallet. | Records and prescriptions. | Fig 9 |

## Part B – Emergency (about 2 minutes)

| # | Say | Do | Expected | Evidence |
|---|---|---|---|---|
| B1 | "Emergency wording always comes first." | Assistant: type an English red-flag message, e.g. chest pain with sweating. | CRITICAL, "Call 112 now, or press SOS", emergency hospitals. | `orchestrator.ts`; tests in the emergency-safety suite |
| B2 | "Self-harm gets crisis-support wording." | Type a prepared self-harm message from `tests/fixtures/emergency_safety_set.json`. | Tele-MANAS 14416 and 112. | `emergencySafety.ts:111` |
| B3 | "The Emergency page needs no account. City Healer does not send an ambulance; it tells you to call 112." | Open `/en/emergency`. | 112 and 102 buttons, nearest emergency hospitals. | Fig 11; `EmergencyPage.tsx:1-5` |

## Part C – Hospital desk and administrator (about 1.5 minutes)

| # | Do | Expected | Evidence |
|---|---|---|---|
| C1 | Sign in as `hospital.demo@cityhealer.test` → `/en/hospital`. | Own facility (`hosp-1`), beds and ICU, and only the SOS alerts routed to this hospital. | Fig 12; `server.ts:1114-1160` |
| C2 | Update the bed and ICU numbers. | Saved; only this facility can be edited. | Fig 13; `server.ts:515` |
| C3 | Sign in as `admin.demo@cityhealer.test` → `/en/admin/providers`. | Provider review: applications, with verify and refuse. | Fig 14; PRs #9, #11 |
| C4 | Go to `/en/admin/hospitals`. | Reported listings, each with hide or keep. | Fig 15; PR #12 |

## Part D – Role-based access (about 1 minute)

| # | Do | Expected | Evidence |
|---|---|---|---|
| D1 | As the patient, open `/en/provider` and then `/en/admin/hospitals`. | Refused by `RequireRole`. | `SiteRouter.tsx:91-94` |
| D2 | Open an unknown URL, e.g. `/en/does-not-exist`. | Bilingual 404 page. | Fig 18 |
| D3 | Explain how access is controlled. | Roles are Firebase claims set only by an admin; a role change signs the account out; the server checks ownership on every booking, thread and alert. | access-matrix tests |

## Part E – Hindi and Hinglish (about 1 minute)

| # | Do | Expected | Evidence |
|---|---|---|---|
| E1 | Open `/hi/sign-in`. | Sign-in in Hindi. | Fig 17 |
| E2 | Show the patient dashboard in Hindi. | Hindi interface. | Fig 16 |
| E3 | Type a Devanagari symptom message. | Reply in Hindi. | `shared/triage.ts:40` |
| E4 | Say: "The Hindi wording has not yet been reviewed by a fluent speaker." | – | PR bodies |

## Closing (30 seconds)

"Everything you saw runs on one server, with models trained in the repository and no external AI service.

It runs on local emulators with synthetic data. It has not been clinically validated or deployed, notifications are not delivered, and it does not dispatch ambulances. The test suite passes: 225 unit and 309 server tests."

## If something fails

| Problem | What to do |
|---|---|
| Server does not start | Show the backup video (PENDING). |
| Check-in is not available | Check-in opens only 60 minutes before an in-person booking on the IST day. Explain the window, or use the screenshot (Fig 5). |
| Unexpected model answer | Show the engine and confidence, and explain the abstention rule. |
| Emulator data lost | Re-run `scripts/seed-demo.ts`. |
