# Viva Questions and Answers

These are prepared answers with their sources. Members should give them in their own words and quote every number with its source.

## A. Problem and design

**1. What problem does City Healer solve?**

Access to emergency and primary care in Delhi NCR is fragmented (Milestone 1, root causes R1–R5). City Healer puts one bilingual, role-secured path behind a single login: symptoms → triage → hospital → doctor → booking → check-in → messages → prescription → medicines → record.

**2. Why not rely on an AI symptom checker?**

Studies report appropriate triage in only 57 % of cases [9], and between 48.8 % and 90.1 % across a review of studies [10]. In City Healer, fixed rules decide emergencies first. A model answers only when it is confident, and the LLM output is validated against a schema.

**3. You planned an LLM. Is there one?**

Yes, as an optional layer (`server/ai/llm.ts`, PR #13):
- It has backoff, failover, JSON repair and schema validation (A8, A11).
- With no `GEMINI_API_KEY`, which is the current setup, it makes no network call and returns the offline result.
- It has never been run against the real Gemini API; all its tests use fake callers.

The primary engine is the in-repo trained models. They were chosen for cost (no paid API), privacy (text stays on the server) and determinism.

**4. Why Firebase Authentication instead of bcrypt + JWT (A13)?**

- No passwords or signing secrets are stored on the server.
- Phone OTP sign-in is supported.
- Tokens are RS256 JWTs verified with a revocation check, so a role change takes effect immediately (`identity.ts:47`).

bcrypt is used only to detect legacy passwords (`scripts/legacy-passwords.ts`).

**5. Why two databases?**

- **Firestore:** its transactions guarantee a single booking per slot. The final audit tried 20 simultaneous bookings per round and got exactly 1 every round. Its rules deny all client access by default.
- **SQLite:** holds directory-type data (hospitals, medicines, records, alerts).

The old SQLite booking system was removed (PR #12).

## B. AI and algorithms

**6. How does triage decide?**

1. The emergency rules run first (A2, A3). A red flag returns CRITICAL with SOS.
2. If a key is set, the LLM answers, validated by a schema.
3. Otherwise the trained model answers if its confidence is at least 0.40 and it recognises at least 3 terms.
4. Otherwise the rules answer, and they say "not assessed" rather than guess.

**7. How accurate is it?**

From the final evaluation (16 Nov 2026, 22:57 UTC, `ai_ml_evaluation.json`):
- 95.3 % on the public test set.
- 93.6 % on a fresh test set of everyday language written by the team.
- It answers 57.3 % of the time, and is correct 96.8 % of the time when it does answer.

The team-written test sets make these figures optimistic.

**8. Explain the emergency numbers, and the 5 % versus 5.7 %.**

| Run | Recall (development / held-out) | False positives on non-emergency messages |
|---|---|---|
| Before the fix | 30.6 % / 33.3 % | – |
| After the fix | 100 % / 100 % | 1 of 20 (5 %) |
| Final run | 100 % (n = 36) / 100 % (n = 24) | 2 of 35 (5.7 %) |

The 5.7 % is lower than it looks because the non-emergency set grew from 20 to 35 messages. The two false positives in the final run were:
- a past-tense mention of chest pain;
- "I fainted once last year …".

The set is a draft that no clinician has reviewed (`emergency_eval.json`).

**9. Why logistic regression?**

In 5-fold cross-validation it scored about the same as a linear SVM (84.1 % vs 84.7 %). It also gives a probability for each class, which the confidence threshold needs (`ml/README.md`).

**10. Explain the hospital score (A5).**

S = D + 10B + 20·I·U + max(0, 40 − d) − 40X

| Term | Meaning |
|---|---|
| D | Department evidence: 50, 30 or 15 points |
| B | A free bed |
| I | A free ICU bed, counted only when urgency U is HIGH or CRITICAL |
| d | Haversine distance |
| X | The listing is unconfirmed |

The maximum is 120 (`shared/hospitalRanking.ts`). The rating term from the original plan was dropped because ratings are unverified.

**11. How is the wait estimated (A7)?**

Wait = patients ahead × time per patient + overhead + doctor's delay.

- Time per patient is the median of recent consultations, otherwise the slot length, otherwise 12 minutes.
- With no data, this reduces to 12q + 10, the formula in the original plan.
- The patient sees a range (`shared/waitTime.ts:56`).

**12. What is A10 in your system?**

Retrieval-augmented answering over the medicine index (`POST /api/v1/knowledge/ask`). Answers come only from retrieved passages and cite them as [M1], [M2]. If nothing is retrieved, it abstains.

**13. Does the chat have an AI doctor?**

No. Messages go only between patient and doctor. Each patient message is checked by the deterministic rules. If it is flagged, a fixed "City Healer automatic notice" tells the patient to call 112 or use SOS, and the booking is marked urgent (`server/firebase/messages.ts:143`).

## C. Security and privacy

**14. How is patient data protected?**

In layers:
1. Security headers.
2. JSON error bodies.
3. Write limits.
4. Token verification.
5. The consent gate.
6. Role guards.
7. Ownership checks in transactions.
8. Firestore rules that deny by default.

SOS alerts are visible only to the desk of the facility they were routed to (Milestone 9, §9.6).

**15. What if consent cannot be checked?**

The request is refused and the failure is not cached. SOS is exempt from consent.

**16. Which audit findings are still open?**

- Demo mode is not refused in production.
- The order route trusts the `prescriptionAttached` flag.
- The CSP has not been tried in a browser.
- There is no data export or deletion.
- Low-severity hygiene items (Milestone 9, §9.7.2).

**17. An earlier audit run showed 19/23 security checks. Why, and what does the final run show?**

The final run of the corrected audit script passes 25 of 25. The earlier run's four FAILs were:
- **CSP and HSTS:** the audit server ran in development mode, and these headers are sent only in production. The production behaviour is covered by a test.
- **Two legacy-booking probes:** the routes they probe were deliberately removed and now return 404.

The audit script needs updating (Milestone 8, §8.12.3).

## D. Testing and performance

**18. How many tests, and do they pass?**

The final run had 225 unit and 309 server tests, with 0 failures and exit code 0 (`final-npm-test.log`). For comparison, the first audit had 109 + 128.

**19. What is not tested?**

- No end-to-end browser suite.
- No real Firebase project.
- The CSP has not been checked in a browser.
- Voice and PDF parsing are not evaluated.
- One race test may not catch the regression it targets.

**20. Performance?**

These are local measurements (Intel Core Ultra 9, emulators), not production:
- Triage at concurrency 1: 150–306 requests/s across four runs (p95 5.0–9.9 ms), up from about 51 requests/s at the first audit. The range is honest: throughput on one laptop varies by about 2× from run to run.
- Copilot at concurrency 50: p95 105–506 ms. The upper end comes from the run where the dev server, emulators and a browser were also running on the laptop.
- 0 % errors in every row.
- Cold start: 3.4–5.9 s.

## E. Honesty and scope

**21. Has it been used by real patients, or clinically validated?**

No. All data is synthetic or public, and nothing is clinically validated.

**22. Does SOS send an ambulance?**

No. The alert goes to the nearest hospital's desk, and the app tells the user to call 112.

**23. Are patients notified?**

Notification events are queued in `notificationOutbox`, but nothing delivers them.

**24. Was it deployed?**

No. There is no real Firebase project and no `docker build` has been run. The Firestore rules and the check-in index must be deployed first.

**25. What did each member do?**

PENDING. Each member answers for their own work (Milestone 10, §10.14.1).
