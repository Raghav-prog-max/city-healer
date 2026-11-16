# Final Presentation Outline

Target length is about 15 minutes of slides and live demo, followed by questions.

Two rubric criteria apply:
- R9: the presentation should be "clear, confident, and well-structured".
- R10: every team member presents.

Speakers have not been assigned (PENDING). The team decides; nothing has been assigned by default. Figures refer to the files in `screenshots/`.

| # | Slide | Content | Evidence / figure | Speaker |
|---|---|---|---|---|
| 1 | Title | City Healer: a bilingual emergency and care platform for Delhi NCR; team and guide | Fig 28 | PENDING |
| 2 | The problem | One patient, five separate systems; minutes lost in emergencies, and Hindi speakers left out | Milestone 1, §1.1–1.4 | PENDING |
| 3 | Why AI alone is not enough | Studies show symptom checkers give appropriate triage in 57 % of cases [9], and range from 48.8 % to 90.1 % across studies [10]. Hence a hybrid design. | Milestone 2, §2.2 | PENDING |
| 4 | The gap | Capability comparison: no existing system covers the whole journey | Milestone 2, §2.3 | PENDING |
| 5 | Objectives O1–O7 | Status of each objective in the final build | Final report §3 | PENDING |
| 6 | Architecture | One process; a chain of checks (headers → token → consent → role → ownership); Firestore + SQLite | Fig 19 | PENDING |
| 7 | Plan vs build | Firebase Authentication instead of bcrypt + JWT; trained models first, with the LLM optional; Firestore + SQLite instead of SQLite alone; and why | Milestone 5, §5.7.4 | PENDING |
| 8 | Hybrid triage (A1–A4, A9) | Rules run first; then the model (answers only at ≥ 0.40 confidence); then rules again; the optional LLM falls back offline | Fig 3; Milestone 7, §7.8 | PENDING |
| 9 | Emergency safety | Recall rose from 30.6 % to 100 % after the fix. Final run: 100 % on 60 critical messages, 5.7 % false positives (2 of 35). The test set is a draft and has not been reviewed by a clinician. | `emergency_eval.json`; Fig 6 | PENDING |
| 10 | Models and results | Triage 95.3 % / 93.6 %; intent 93.8 %; copilot routing 81.1 %; lab-report reader 96.4 %, each shown with its caveats | Milestone 7, §7.7 | PENDING |
| 11 | Hospital ranking (A5) | Score S = D + 10B + 20IU + max(0, 40 − d) − 40X: department evidence beats raw distance | Fig 4 | PENDING |
| 12 | Booking, check-in and wait estimate (A7) | 20 simultaneous attempts on one slot → 1 booking, every round; patients are seen in booked-time order; the wait is shown as a range | Fig 5, Fig 7 | PENDING |
| 13 | Messages, prescription, pharmacy | No AI replies in messages; a fixed safety notice for emergency wording; prescription as PDF; demo pharmacy | Fig 6, 8, 9, 10 | PENDING |
| 14 | Staff and roles | Hospital workspace, alerts limited to the hospital's own facility, admin screens, 404 page | Fig 12–15, 18 | PENDING |
| 15 | Security | Defaults deny access; consent gate; write limits; CSP and HSTS in production; every critical, high and medium audit finding closed in code | Milestone 9 | PENDING |
| 16 | Live demo | `DEMO_SCRIPT.md` parts A–E, about 7–8 minutes | Fig 1–18 | PENDING |
| 17 | Testing | 109 + 128 tests at the first audit → 225 + 309 at the final run, all passing | `final-npm-test.log`; Fig 26 | PENDING |
| 18 | Performance (local) | Triage: 51 → 306 requests/s at concurrency 1; 0 % errors in every row | Milestone 8, §8.12.5 | PENDING |
| 19 | Limitations | Synthetic data; no clinical validation; no ambulance dispatch; notifications not delivered; Hindi wording not reviewed; not deployed; LLM never run against a real key | Final report §12 | PENDING |
| 20 | Future work | The ordered list from the final report | Final report §13 | PENDING |
| 21 | Team contributions | One line per member, with evidence | Milestone 10, §10.14.1 | PENDING |
| 22 | Questions | Repository link | – | PENDING |

## Rules for the team

1. Put the source and date of every number in the slide footer.
2. Use the honest names for each part:
   - say "pattern rules" for emergency detection;
   - say "trained classifiers" for the models;
   - say "optional, untested against the real API" for the LLM.
3. Never show or say the demo password.
4. Do not claim any of the following: ambulance dispatch, delivered notifications, payments, or clinical validation.
5. Keep a backup video of the demo (PENDING).
