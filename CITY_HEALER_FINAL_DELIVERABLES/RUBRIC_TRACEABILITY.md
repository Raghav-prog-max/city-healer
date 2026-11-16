# Rubric Traceability Matrix

**Source rubric:** `Mini_Project_Evaluation_Rubrics (2).xlsx`, "Mini-Project Evaluation Rubrics (CO3, CO4, CO5) – 20 Marks". Each sub-criterion is scored 3 (Excellent), 2 (Good), 1 (Acceptable) or 0 (Poor). The rubric notes: "The marks will be scaled down to 20 marks."

PENDING: confirm the other two copies of the rubric file are identical to this one.

## 1. Criteria and "Excellent – 3" descriptors

| # | Criterion | Sub-criterion | Timeline | Excellent – 3 |
|---|---|---|---|---|
| R1 | Problem Analysis | Problem Domain Identification & Analysis | 1–5 Sept | Clearly identified with in-depth analysis and strong justifications |
| R2 | Problem Analysis | Review of Existing Systems & Project Feasibility | 14–19 Sept | Comprehensive review with clear feasibility analysis |
| R3 | Project Design | Objectives & Methodology of Proposed Work | 14–19 Sept | Clear, measurable objectives with well-defined methodology |
| R4 | Project Design | Relevance of Algorithms / Techniques | 14–19 Sept | Highly relevant and well-justified |
| R5 | Project Implementation | Synchronization of Design & Implementation | 27–31 Oct | Fully aligned and consistent |
| R6 | Project Implementation | Implementation & Demonstration of Modules | 27–31 Oct | All modules correctly implemented and demonstrated |
| R7 | Project Report | Organization & Structure of Project Report | 3–5 Nov | Well-organized, logical, easy to follow |
| R8 | Project Report | Compliance with Prescribed Report Format | 24–28 Nov | Fully compliant |
| R9 | Communication | Clarity & Organization of Presentation | 1–3 Dec | Clear, confident, and well-structured |
| R10 | Communication | Contribution by Each Team Member | 1–3 Dec | All members contributed equally and effectively |

## 2. Matrix (state at `55443ec`)

**Status key:**

- **Done:** the evidence exists and was checked.
- **Done, with stated limits:** the evidence exists, and its limitations are recorded in the report.
- **PENDING:** the evidence has not been produced yet.

"Final run" means `final-npm-test.log` (225 unit and 309 server tests passing, 0 failing).

| Rubric | Feature / artefact | Source file(s) | Test(s) | Screenshot | Report section | Status |
|---|---|---|---|---|---|---|
| R1 | Problem domain, stakeholders, root causes | Milestones 1–4 document, §1 | – | – | Final report §1 | Done |
| R2 | Existing systems, literature, feasibility | Milestones 1–4, §2; feasibility update | – | – | Final report §2, §2.6 | Done |
| R3 | O1–O7 and status as built | Milestones 1–4, §3; M06 §6.2 | All rows below | – | Final report §3 | Done, with stated limits: O5 has no ambulance dispatch |
| R4 | A1–A14: justification, implementation, tests, documentation | `docs/ALGORITHMS.md`; `server/ai/llm.ts`, `rag.ts`; `shared/hospitalRanking.ts`, `geo.ts`, `waitTime.ts`; `server/rateLimit.ts` | `tests/algorithms.test.ts` (36), `tests/emergency-safety.test.ts` | Fig 3, 4, 5, 6 | M07 §7.8 | Done. A13 is a documented deviation; the LLM path has never been run against a real key. |
| R5 | Architecture as built; deviation register | `server.ts`, `server/firebase/*`, `server/httpHardening.ts`, `firebase/firestore.rules` | access-matrix, security-headers | Fig 18 (Fig 19 diagram PENDING) | M05 §5.6, §5.7.4 | Done; architecture diagram PENDING |
| R5 | One appointment system; legacy app removed | `booking.ts`, `consultations.ts`; PR #12 | Removed-route 404 tests | Fig 18 | M05 §5.7.3 | Done |
| R6 | Identity, onboarding, consent | `Onboarding.jsx`, `patients.ts`, `consent.ts`, `session.tsx` | consent, consent-rules | Fig 17 (consent step Fig 22 PENDING) | M06 §6.7.1 | Done |
| R6 | Triage and copilot (English, Hindi, Hinglish) | `server.ts:1176`, `:1276`; `orchestrator.ts`; `llm.ts` | ai-models, triage-*, algorithms, emergency-safety | Fig 3 | M06 §6.7.2; M07 | Done |
| R6 | Top-3 hospitals | `server.ts:348`; `hospitalRanking.ts` | algorithms A5; access-matrix | Fig 4 | M06 §6.7.3 | Done; ranking quality not evaluated |
| R6 | Verified-doctor booking | `booking.ts:141` | booking | Fig 7 | M06 §6.7.4 | Done |
| R6 | Same-day check-in with wait range | `checkin.ts`; `waitTime.ts` | checkin; algorithms A7 | Fig 5, 7 | M06 §6.7.4 | Done |
| R6 | Consultation messages with safety notice | `messages.ts` | messages; appointment-thread | Fig 6, 8 | M06 §6.7.4 | Done |
| R6 | Prescription and PDF | `consultations.ts:137`; `prescriptionPdf.ts` | consultations; prescription-pdf | Fig 9 (writing form Fig 20 PENDING) | M06 §6.7.4 | Done, with stated limits: no Devanagari in the PDF |
| R6 | Medicine order (demo pharmacy) | `PharmacyOrder.tsx`; `server.ts:970` | order integrity | Fig 10 (confirmation Fig 21 PENDING) | M06 §6.7.6 | Done, with stated limits: demo only; trusts `prescriptionAttached` |
| R6 | Health records and lab reader | `WalletPage.tsx`; `labValues.ts` | lab-values | Fig 9 (Fig 25 PENDING) | M06 §6.7.5 | Done (TXT only) |
| R6 | Emergency / SOS | `EmergencyPage.tsx`; `server.ts:1059`, `:1114-1160` | access-matrix SOS scoping; algorithms A6 | Fig 11, 12 | M06 §6.7.7 | Done, with stated limits: no dispatch; directs to 112 |
| R6 | Hospital workspace | `HospitalWorkspace.tsx`; `server.ts:515`, `:573` | access-matrix bed census and facility route | Fig 12, 13 | M06 §6.7.8 | Done |
| R6 | Admin screens | `AdminProviders.tsx`, `AdminHospitals.tsx` | provider-admin | Fig 14, 15 | M06 §6.7.8 | Done |
| R6 | Bilingual interface | `src/site/i18n/messages.ts` | ai-models "replies in Hindi to Hindi" | Fig 16, 17 | M06 §6.7.9 | Done, with stated limits: Hindi needs fluent review |
| R6 | Testing and performance | `tests/*`; audit scripts | Final run; final evaluations | Fig 26 (PENDING; log available) | M08 | Done |
| R6 | Security and deployment | `httpHardening.ts`, `consent.ts`, `buildEnv.ts`, `Dockerfile` | security-headers, consent, build-env | Fig 11, 12, 14 | M09 | Done, with stated limits: not deployed; no `docker build`; CSP not tried in a browser |
| R6 | Live demonstration | `DEMO_SCRIPT.md` | TC10-01…08 | Fig 1–18 | M10 | PENDING: rehearsal and recording |
| R7 | Numbered report structure | `FINAL_PROJECT_REPORT_DRAFT.md`, `Milestone_05`–`10` | – | – | All | Done (draft) |
| R8 | Prescribed format | – | – | – | – | PENDING: the institutional template was not among the sources |
| R9 | Presentation | `FINAL_PRESENTATION_OUTLINE.md`, `VIVA_QUESTIONS_AND_ANSWERS.md` | – | Fig 1–18 | M10 | Outline done; slides PENDING |
| R10 | Team contributions | M10 §10.14.1; Final report §14 | – | – | – | PENDING: to be filled in by the team |
