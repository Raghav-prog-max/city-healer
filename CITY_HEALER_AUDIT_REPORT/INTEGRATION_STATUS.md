# Integration Status

Each link was checked against the code and, where marked, against a running system:
- network logs in the browser pane
- emulator documents
- audit scripts

| # | Link | Status | Evidence |
|---|---|---|---|
| 1 | Patient onboarding → Firebase Authentication | **Connected** (emulator). Real project: **not tested**. | Phone OTP issued by the Auth emulator and verified in the browser; account created (`accounts:query`). Email sign-up covered by earlier sessions and tests. Against a real project, reCAPTCHA and SMS billing setup are untested. |
| 2 | Patient dashboard → backend APIs | **Partially connected** | Profile: `/api/v1/me` (Firestore). Records: `/api/records` (SQLite). Appointments: **legacy SQLite** `/api/appointments` only (`PatientDashboard.jsx:98`). Errors are swallowed into empty lists (BUG-016). |
| 3 | Doctor discovery → verified doctor repository | **Two separate repositories** | Doctors tab = 80 SQLite sample doctors, look-only. Book appointment tab = Firestore `doctors` with `verificationStatus=verified` and `listingStatus=active`. No real verified providers exist; one emulator doctor was used for testing. |
| 4 | Booking frontend → appointment backend | **Connected** | Network log: `GET /api/v1/doctors/:id/slots` 200 → `POST /api/v1/appointments` 201 → `GET /api/v1/appointments/mine` 200 → `POST …/reschedule` 200 |
| 5 | Appointment backend → Firestore | **Connected** | Admin-SDK transactions; 5 × 20-way race → exactly 1 success per round; documents visible in the emulator |
| 6 | AI Copilot → AI service | **In-process, no separate service** | The zip's Python FastAPI service is **not running and not in the repo**; its routes were ported into `server.ts`. The UI calls `/api/ai/copilot`. `/api/v1/copilot/chat` (zip contract) has no UI caller. |
| 7 | AI service → trusted healthcare knowledge sources | **Not connected** | No clinical guideline, drug-label or knowledge-base integration. Answers come from templates, a 1mg-scraped medicine dataset (11,498 products, research dataset), coded adult reference ranges in `shared/labModels.ts`, and IPHS 2022 standard departments. None is retrieved live or cited per answer. |
| 8 | AI care discovery → verified doctor repository | **Connected but empty** | `/api/v1/discovery/rank` queries Firestore `doctors` server-side (verified by test: a smuggled provider list is ignored). No UI calls it. The copilot's "find a doctor" path uses the **SQLite sample doctors** (`findDoctors`), not the verified repository. |
| 9 | AI service → patient dashboard | **Connected (UI pieces)** | Assistant page → `/api/ai/copilot`. Health wallet → `/api/records/analyze` and `/api/v1/documents/extract`. Models page → `/api/ai/models`, `/api/v1/platform/modules`, admin forecast. Nutrition and medicines pages → their routes. |

## Disconnected or inconsistent pieces

1. **Two appointment systems.** SQLite (legacy, with queue, prescriptions, chat and hospital views) vs Firestore (verified providers). The dashboard, doctor and hospital tools read SQLite; the new booking flow writes Firestore. A doctor has no way to see Firestore bookings: there is no doctor UI or route listing them.
2. **Two doctor sets** with different identifiers. SQLite `doc-1…doc-80` (linked to doctor accounts through the `doctorId` claim) vs Firestore `doctors/{uid}`. The copilot recommends SQLite doctors; booking uses Firestore.
3. **Two API contracts for the copilot** (`/api/ai/copilot` vs `/api/v1/copilot/chat`) with different response shapes.
4. **Legacy frontend** (`src/App.tsx`) is still routed for unmatched URLs, with its own sign-in and an offline data fallback.
5. **Deployment targets disagree.**
   - `vercel.json` deploys only the static frontend. API calls would 404, and the legacy client would fall back to localStorage.
   - `Dockerfile`/`railway.json` deploy the full stack, but affected by BUG-007.
6. **Authentication propagation.** Consistent: every route uses the same `verifyFirebaseToken`. The zip's `X-API-Key` and `users/{uid}` role-document models were **not** adopted (good). The stale root `firestore.rules` still describes the role-document model.
7. **The seven-module zip as a separate service:** absent by design. If a separate Python AI service is still wanted, nothing exists for service-to-service auth, networking or deployment.
8. **No doctor or admin UI** for provider onboarding (apply, verify, publish slots). This is API and CLI only, so the booking side cannot be operated by non-developers.

## Overall

- **Patient flows** (onboarding → dashboard → booking a verified doctor) work end to end on emulators, with the gaps above.
- **Provider and admin flows** exist only as APIs and CLIs.
- **AI features** are wired into the patient UI, but use the sample-doctor repository, not the verified one.
- Nothing has been exercised against a real Firebase project.
