# City Healer – An Integrated, Bilingual Emergency and Care Platform for Delhi NCR

**Final Mini-Project Report – final draft (17 November 2026)**

| Item | Detail |
|---|---|
| Course outcomes | CO3, CO4, CO5 |
| Repository | github.com/Raghav-prog-max/city-healer |
| Final commit | `55443ec` |
| Team | PENDING (names, roll numbers, guide) |
| Institution and department | PENDING |

> **Note for the reviewer.** This report is assembled from:
> - the Milestones 1–4 document;
> - the system audit (`CITY_HEALER_AUDIT_REPORT/`): first run on 16 Nov 2026, results re-generated 16 Nov 2026 between 22:57 and 23:07 UTC;
> - merged PRs #2–#16;
> - `docs/ALGORITHMS.md`;
> - the final test log (`final-npm-test.log`).
>
> Items marked PENDING are still missing. The prescribed institutional format (front matter, certificate, declaration, fonts) was not among the sources. It must be applied when this report is converted to the final document.

---

## Front matter (PENDING)

Certificate · Declaration · Acknowledgements · Table of contents · List of figures · List of tables · Abbreviations.

## Abstract

People in Delhi NCR who fall ill must use separate apps and phone lines for each step of care:

- judging how urgent their symptoms are;
- finding a hospital with the right department and a free bed;
- seeing a doctor;
- getting medicines;
- calling an ambulance.

Published studies show that AI symptom checkers on their own are not accurate enough to rely on [9–11]. City Healer brings these steps into one web application. It works in English and Hindi (including romanised Hindi) and enforces four roles: patient, doctor, hospital and admin.

**Triage.** Deterministic emergency rules run first. Small models trained in the repository answer only when they are confident. An optional LLM path exists, but it is switched off without an API key and has never been run against the real service.

On the final evaluation (16 Nov 2026):

| Measure | Result |
|---|---|
| Emergency recall, draft safety set | 100 % (60 critical messages) |
| False positives, non-emergency messages | 5.7 % (2 of 35) |
| Triage model, public test | 95.3 % |
| Triage model, project-written everyday-language test | 93.6 % |

**Care.** Hospitals are ranked by department evidence, bed and ICU availability, and distance. Patients book verified doctors through Firestore transactions. In a local test, 20 simultaneous attempts on one slot produced exactly one booking in every round. Patients check in on the day and see a wait range. They message the doctor, and emergency wording in a message triggers a fixed safety notice. They receive a prescription (also as a PDF) and order medicines from a demo pharmacy.

**Testing.** The final run passed 225 unit and 309 server tests with 0 failures.

**Limits.** The system has not been deployed. It uses synthetic data and has no clinical validation. It does not dispatch ambulances or deliver notifications.

**Keywords:** digital health, symptom triage, hybrid rule–ML system, multi-criteria ranking, role-based access control, Firebase, bilingual NLP

## 1. Problem Domain Identification and Analysis (Milestone 1)

As in the Milestones 1–4 document, sections 1.1–1.7: problem statement, stakeholders, root causes R1–R5 and the language barrier, the current versus proposed patient journey, justification, scope and expected outcomes.

PENDING: paste sections 1.1–1.7 during final formatting.

## 2. Review of Existing Systems and Feasibility (Milestone 2)

Sections 2.1–2.4 are unchanged: existing systems [1–8], literature [9–17], the capability comparison and the gaps.

PENDING: paste these sections from the Milestones 1–4 document.

### 2.6 Feasibility, as built

| Type | Milestone 2 verdict | As built |
|---|---|---|
| Technical | Open-source stack; ML with fallback | Confirmed. Models run in-process. The optional LLM falls back offline. |
| Economic | Near-zero cost | Confirmed. No paid service is used; the LLM is off without a key. |
| Operational | Demo yes; live partial | Demo works on local emulators. Not deployed. No real Firebase project. |
| Legal / ethical | bcrypt, JWT, rate limits, owner-scoped records | Firebase Authentication; server-side consent gate; write limits; production CSP and HSTS. No data export or deletion yet. |
| Schedule | 85 tests; Docker/Railway ready | 534 tests passing. Release-build checks in place. A `docker build` has not been run. |

## 3. Objectives and Methodology (Milestone 3)

| # | Objective | Status at `55443ec` | Evidence |
|---|---|---|---|
| O1 | Bilingual triage with an emergency flag | **Met** | `shared/triageModel.ts:180`; `server/ai/llm.ts:286`; `emergency_eval.json` (final) |
| O2 | Top-3 hospitals | **Met.** The rating term is not used because ratings are unverified. | `shared/hospitalRanking.ts:42` |
| O3 | Owner-only bed and ICU census | **Met** | `server.ts:515`; Hospital workspace; Figures 12–13 |
| O4 | Booking, wait estimate, chat, prescription saved and as PDF | **Met.** The queue token became same-day check-in with a wait range. The PDF cannot render Devanagari. | PRs #8–#15 |
| O5 | SOS from the patient's location | **Partly met.** The alert reaches the nearest hospital's desk. No ambulance is dispatched; the app tells the user to call 112. | `server.ts:1059-1160`; Figures 11–12 |
| O6 | Privacy across 4 roles; "all 85 access tests pass" | **Met and exceeded.** 534 tests pass. | `final-npm-test.log` |
| O7 | Every AI route answers when AI fails | **Met** | Test "A9: a timeout on every model falls back to offline" |

**Methodology as practised.** The method was iterative: branch, verify (tests, `tsc`, browser walk-through against the emulators), review, then merge by pull request. The audit set the order of work, P0 items before P1. Multi-lens reviews before PRs #11 and #15 each found 9 issues, and all were fixed before merging.

## 4. Algorithms and Techniques (Milestone 4)

All fourteen techniques have source code, a call site, tests and documentation (`docs/ALGORITHMS.md`; PR #13; `tests/algorithms.test.ts`, 36 tests). A13 is the one deviation: sign-in uses Firebase ID tokens instead of bcrypt + JWT. Section 7.8 of Milestone 7 maps each technique to its source and tests.

## 5. System Architecture and Integration (Milestone 5)

One Express process serves the single-page app and the API. Each request passes through a fixed chain of checks: security headers, JSON errors, write limits, token verification, the consent gate, then the role guard.

- **Firestore** holds identity-linked and clinical data.
- **SQLite** holds directory data.
- **Models** run in-process.

The legacy app and the SQLite booking system have been removed. See `Milestone_05/`.

## 6. Core Module Implementation (Milestone 6)

Every step of the Milestone 1 patient journey is implemented:

symptoms → triage → top-3 hospitals → doctor → booking → check-in → messages → prescription (PDF) → demo medicine order → health record.

Workspaces exist for doctors, hospital desks and administrators. See `Milestone_06/`.

## 7. AI/ML Algorithms and Intelligence (Milestone 7)

The rules decide emergencies first. Trained models answer within their range and abstain outside it. An optional LLM and retrieval layer is bounded by schema validation and citations. Each model has documented data, metrics and parity tests. See `Milestone_07/`.

## 8. Testing, Evaluation and Performance (Milestone 8)

- The final run passed 225 unit and 309 server tests with 0 failures.
- In four local runs (16 Nov 23:07Z and 23:26Z; 17 Nov 00:19Z and 01:00Z) of the final local load test, no request failed in any row. Triage served 150–306 requests per second at concurrency 1 (p95 5.0–9.9 ms), compared with about 51 at the first audit. Throughput on this machine varies by about 2× between runs, so the range is reported rather than the best run.

See `Milestone_08/`.

## 9. Security, Deployment and Reliability (Milestone 9)

Every critical, high and medium finding from the first audit is now closed in code. The remaining open items are listed in Milestone 9, section 9.7.2. The system is not deployed. See `Milestone_09/`.

## 10. Final Demonstration and Documentation (Milestone 10)

See `Milestone_10/` and `DEMO_SCRIPT.md`. The demo uses four synthetic demo accounts on local emulators. The script that recreates them is `scripts/seed-demo.ts`; the password is not written in these deliverables.

## 11. Results and Discussion

| Area | Result | Source (UTC, 16 Nov 2026) |
|---|---|---|
| Tests | 225 unit and 309 server pass, 0 fail | `final-npm-test.log` (23:06) |
| Booking integrity | 20 concurrent attempts → 1 created, 19 conflicts, in every round | `backend_audit.json` (23:07) |
| Firestore rules | Every client access denied except reading one's own profile | same |
| Emergency rules | Recall 100 % (dev n = 36, held-out n = 24); false positives 5.7 % (2 of 35) | `emergency_eval.json` (22:57) |
| Triage model | 95.3 % public test; 93.6 % fresh test (96.8 % when it answers) | `ai_ml_evaluation.json` (22:57) |
| Intent model | 93.8 % held-out | same |
| Copilot | Route accuracy 81.1 %; emergency recall 100 %; false positives 4.8 % (37 messages) | same |
| Lab-report reader | Precision and recall 96.4 %, up from 84 % / 75 % before PR #6 | same; first audit |
| Performance (local) | Triage c=1: 150–306 req/s, p95 5.0–9.9 ms. Copilot c=50: p95 105–506 ms. 0 % errors in all rows. Cold start 3.4–5.9 s (four runs). | the four `backend_audit*.json` files |
| Build | Main JS 691.9 kB (197.0 kB gzip); `dist/` 1.9 MB | Vite build (coordinator's final facts) |

**Discussion.**

- **Strongest results:** access control, transactional booking, and the deterministic safety layer. That safety layer now also screens consultation messages.
- **Weakest results:** AI breadth (22 triage conditions, small team-written test sets), document reading (TXT only), and the lack of any real deployment.
- **Design trade-off:** the hybrid design trades coverage for safety. On the fresh test set, the model abstains on 42.7 % of inputs and hands them to rules, which answer "not assessed" rather than guess.
- **Earlier scores are out of date:** the first audit's scores were measured before PRs #5–#16. PENDING: re-score.

## 12. Limitations and Known Issues

1. Only synthetic and public demonstration data are used. Hospital beds and directory doctors are sample data and are labelled as such in the UI.
2. Nothing is clinically validated. The emergency rules are pattern rules tested on a draft set that no clinician has reviewed.
3. SOS does not dispatch an ambulance; the app tells users to call 112. Hospital IT, ABHA/ABDM and payments are not integrated.
4. Notifications are queued but never delivered.
5. The medicine order route trusts the `prescriptionAttached` flag. It does not verify the chosen prescription on the server.
6. The prescription PDF cannot render Devanagari.
7. The production CSP has not been tried in a browser.
8. The check-in composite Firestore index must be deployed before production.
9. The Hindi wording needs review by a fluent speaker.
10. The post-vs-cancel race test may not catch the regression it targets.
11. The LLM path (A1, A8, A10) has never run against a real Gemini key.
12. The system has never been deployed or run against a real Firebase project, and a `docker build` has not been run.
13. Demo mode is not refused in production. Data export and deletion are not implemented.
14. **Deviations from the Milestone 1–4 plan, with reasons:**
    - Firebase Authentication instead of bcrypt + JWT: no stored passwords, phone sign-in, and immediate revocation.
    - Offline trained models as the primary engine instead of a paid LLM: cost, privacy and determinism. The LLM remains as an optional layer.
    - SQLite + Firestore split instead of SQLite alone: transactions and deny-by-default rules for clinical data.

## 13. Conclusion and Future Work

City Healer shows that a student team can build a single, bilingual, role-secured path from symptoms to care. Safety rules decide emergencies before any model does, and every claim is backed by tests and measurements.

Future work, in order:

1. Clinician review of the safety set.
2. A staging deployment on a real Firebase project, with the CSP checked in a browser and the rules and indexes deployed.
3. Notification delivery.
4. Server-side verification of the attached prescription.
5. A Devanagari font in the prescription PDF.
6. Fluent review of the Hindi wording.
7. An end-to-end browser test suite.
8. Data export and deletion.
9. Evaluation with real users under ethics approval.

## 14. Team Contributions

**TO BE FILLED IN BY THE TEAM** (see Milestone 10, section 10.14.1). Do not invent or estimate contributions.

| Member | Role | Contribution | Evidence |
|---|---|---|---|
| PENDING | PENDING | PENDING | PENDING |

## References

[1]–[25]: as in the Milestones 1–4 document. PENDING: paste in full.

Added in Milestones 5–10. Every entry marked "to be checked" must be verified before submission.

26. Google, "Firebase Authentication documentation." https://firebase.google.com/docs/auth (to be checked)
27. Google, "Cloud Firestore: transactions and batched writes." https://firebase.google.com/docs/firestore/manage-data/transactions (to be checked)
28. City Healer system audit, `CITY_HEALER_AUDIT_REPORT/` (16 Nov 2026; results re-generated 22:57–23:07 UTC), in [25].
29. City Healer, `docs/ALGORITHMS.md`, in [25].
30. F. Pedregosa et al., "Scikit-learn: Machine learning in Python," JMLR, vol. 12, pp. 2825–2830, 2011.
31. gretelai, "symptom_to_diagnosis," Hugging Face dataset, Apache-2.0.
32. UCI Machine Learning Repository: Heart Disease (Cleveland); Indian Liver Patient Dataset (to be checked)
33. Pima Indians Diabetes Database (NIDDK), CC0 (to be checked)
34. OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright
35. MoHFW, Tele-MANAS helpline 14416 (to be checked)
36. Google, "Firebase Security Rules for Cloud Firestore" (to be checked)
37. Digital Personal Data Protection Act, 2023, Government of India (to be checked)
38. OWASP Top 10 (to be checked)
39. W3C, "Content Security Policy Level 3" (to be checked)

## Appendices

| Appendix | Content | Status |
|---|---|---|
| A | Screenshots (`screenshots/`, Figures 1–18) | Captured: Figures 1–18 (app), 19 (architecture diagram), 20–27 (app and test run), 28 (title slide) |
| B | `TEST_EXECUTION_LOG.md` and `final-npm-test.log` | Done |
| C | `EVIDENCE_REGISTER.md` | Done |
| D | `RUBRIC_TRACEABILITY.md` | Done |
| E | `docs/ALGORITHMS.md` (repository) | Done |
