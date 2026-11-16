# City Healer – Final Deliverables (final draft, 17 Nov 2026)

These are the academic deliverables for Milestones 5–10 of the City Healer mini-project. They follow the numbering of the Milestones 1–4 document and describe the final code: `origin/main` at commit `55443ec`, the merge of PR #16 at 16 Nov 2026 23:12 UTC.

Whoever wrote these documents did not run any tests, servers or builds. Every result comes from one of the sources listed below.

## Sources

| Source | What it contains |
|---|---|
| Milestones 1–4 document | Objectives O1–O7 and algorithms A1–A14 |
| `Mini_Project_Evaluation_Rubrics (2).xlsx` | Assessment rubric |
| Build Summary PDF | Project summary |
| `CITY_HEALER_AUDIT_REPORT/` | First audit of 16 Nov 2026; results re-generated 16 Nov 2026, 22:57–23:07 UTC |
| PR bodies #2–#16 | Change descriptions and verification |
| `docs/ALGORITHMS.md` | Algorithm documentation |
| `final-npm-test.log` (this folder) | Final test run |
| Coordinator's final facts (17 Nov 2026) | Vite build sizes, test counts after PR #16, PR #12 test counts, demo accounts |

## Folder layout

| Path | Content |
|---|---|
| `Milestone_05/M05_System_Architecture_and_Integration.md` | Architecture as built, request path, merged-PR table, deviation register |
| `Milestone_06/M06_Core_Module_Implementation.md` | Each module: routes, files, tests, screenshots, known issues |
| `Milestone_07/M07_AI_ML_Algorithms_and_Intelligence.md` | Models, final evaluation, emergency runs, A1–A14 |
| `Milestone_08/M08_Testing_Evaluation_and_Performance.md` | Test inventory, execution history, final load table, build |
| `Milestone_09/M09_Security_Deployment_and_Reliability.md` | Security layers, audit findings and their status, deployment, reliability |
| `Milestone_10/M10_Final_System_Demonstration_and_Documentation.md` | Demo set-up, evidence map, team contributions table |
| `FINAL_PROJECT_REPORT_DRAFT.md` | Consolidated report |
| `FINAL_PRESENTATION_OUTLINE.md` | 22-slide outline |
| `VIVA_QUESTIONS_AND_ANSWERS.md` | 25 questions with sourced answers |
| `RUBRIC_TRACEABILITY.md` | Rubric → feature → file → test → screenshot → section → status |
| `EVIDENCE_REGISTER.md` | Claims E-01 to E-73 |
| `DEMO_SCRIPT.md` | Demo script with demo accounts and figures |
| `TEST_EXECUTION_LOG.md` | All recorded runs with timestamps |
| `final-npm-test.log` | Final `npm test` output: 225 unit and 309 server tests pass, 0 fail |
| `screenshots/` | Captured figures (see below) |

Each milestone report has the same 15 sections, numbered X.1 to X.15, from Abstract to References.

## Figures

### Captured

These were taken from the running app on local emulators with synthetic demo accounts. Each is an 800×600 JPEG.

| Fig | File | Shows |
|---|---|---|
| 1 | `screenshots/fig-01-landing-page.jpg` | Landing page |
| 2 | `screenshots/fig-02-patient-dashboard.jpg` | Patient dashboard |
| 3 | `screenshots/fig-03-ai-triage-hinglish.jpg` | Triage of a Hinglish message |
| 4 | `screenshots/fig-04-triage-hospital-recommendations.jpg` | Top-3 hospital recommendations |
| 5 | `screenshots/fig-05-same-day-check-in.jpg` | Same-day check-in |
| 6 | `screenshots/fig-06-messages-emergency-safety-notice.jpg` | Message thread with the emergency safety notice |
| 7 | `screenshots/fig-07-doctor-today-and-times.jpg` | Doctor's Today card and published times |
| 8 | `screenshots/fig-08-doctor-messages-panel.jpg` | Doctor's messages panel |
| 9 | `screenshots/fig-09-prescription-in-health-wallet.jpg` | Prescription in the health wallet |
| 10 | `screenshots/fig-10-demo-pharmacy-cart.jpg` | Demo pharmacy cart |
| 11 | `screenshots/fig-11-emergency-sos-page.jpg` | Emergency SOS page |
| 12 | `screenshots/fig-12-hospital-desk.jpg` | Hospital workspace |
| 13 | `screenshots/fig-13-hospital-beds-updated.jpg` | Beds and ICU updated |
| 14 | `screenshots/fig-14-admin-provider-review.jpg` | Admin provider review |
| 15 | `screenshots/fig-15-admin-hospital-listings.jpg` | Admin hospital listings |
| 16 | `screenshots/fig-16-hindi-patient-dashboard.jpg` | Patient dashboard in Hindi |
| 17 | `screenshots/fig-17-hindi-sign-in.jpg` | Sign-in page in Hindi |
| 18 | `screenshots/fig-18-404-page.jpg` | 404 page |

### Figures 19–28 (added 17 Nov 2026)

Figure 19 is drawn (SVG source next to the PNG); 26 and 28 are rendered from HTML sources in `screenshots/`; the rest are captures of the running app with the synthetic demo accounts.

| Fig | File | Shows |
|---|---|---|
| 19 | `screenshots/fig-19-architecture-diagram.png` | Drawn diagram: browser → Firebase Auth → Express check chain → modules → Firestore, SQLite and JSON models (from M05 §5.6.1) |
| 20 | `screenshots/fig-20-doctor-prescription-form.jpg` | Doctor writing a prescription in the Provider workspace |
| 21 | `screenshots/fig-21-order-confirmation.jpg` | Demo pharmacy order placed, shown in My orders |
| 22 | `screenshots/fig-22-onboarding-consent.jpg` | Onboarding consent step |
| 23 | `screenshots/fig-23-models-page.jpg` | `/en/models` model cards |
| 24 | `screenshots/fig-24-copilot-crisis-reply.jpg` | Copilot reply to a self-harm message (Tele-MANAS 14416, 112) |
| 25 | `screenshots/fig-25-lab-prefill.jpg` | Lab values read from a `.txt` report and highlighted for confirmation |
| 26 | `screenshots/fig-26-npm-test-output.png` | Summary lines of the final `npm test` (from `final-npm-test.log`) |
| 27 | `screenshots/fig-27-access-denied.jpg` | 401/403 responses on a privileged route |
| 28 | `screenshots/fig-28-presentation-title.png` | Title slide |

## Remaining PENDING items

### Evidence and verification

1. Done: Figures 19–28 (list above).
2. Done: `backend_audit.ts` now checks CSP and HSTS on a production-mode server and expects the retired routes to answer 404; the re-run (23:26Z) passes 25 of 25 security checks.
3. An actual `docker build`.
4. A staging deployment on a real Firebase project: deploy the rules and the check-in index, and check phone sign-in under the production CSP in a browser.
5. Paint metrics (LCP and similar) on the final build, optionally with Lighthouse.
6. State which change made triage, copilot and `/api/hospitals` faster than at the first audit. No PR body read for this report says so.
7. Re-score the audit categories. The 78/100, 50/100 and other scores predate PRs #5–#16.
8. Map the twelve `security_spec.md` payloads to current tests.
9. Optional: whole-project test coverage.
10. Confirm that `scripts/seed-demo.ts` is merged. It is in the local checkout but was not on `origin/main` at `55443ec`.

### Demonstration

11. Rehearse and record pass/fail for TC10-01 to TC10-08 (Milestone 10).
12. Record a backup demo video.
13. Record the demonstration machine, if it differs from the measurement machine.

### Team and format

14. Team names, roles and contributions: Milestone 10 §10.14.1, Final report §14, slide 21, viva question 25.
15. Presentation speaker assignments, and the slides themselves.
16. Apply the prescribed institutional report format and front matter. It was not among the sources.
17. Paste the Milestone 1–2 text and references [1]–[25] in full into the final report.
18. Verify every reference marked "to be checked".
19. Confirm the three rubric spreadsheet copies are identical.
20. Have a fluent speaker review all Hindi wording, in the app and in any Hindi quoted in the report.

## Known issues (stated in the reports; do not remove without new evidence)

- Notifications are queued and never delivered.
- The medicine order route trusts the `prescriptionAttached` flag.
- The prescription PDF cannot render Devanagari.
- The production CSP has not been tried in a browser.
- The check-in index must be deployed before production.
- Hindi wording needs fluent review.
- The post-vs-cancel race test may not catch its target regression.
- The LLM path (A1, A8, A10) has never run against a real Gemini key.
- Nothing is clinically validated.
- The app has never been deployed or run against a real Firebase project.
- SOS does not dispatch ambulances; the app tells users to call 112.
- Hospital beds and directory doctors are sample data, labelled as such in the UI.
- Demo mode is not refused in production.
- No data export or deletion.

**Demo password:** never write it in these deliverables. It is in `scripts/seed-demo.ts` in the repository.
