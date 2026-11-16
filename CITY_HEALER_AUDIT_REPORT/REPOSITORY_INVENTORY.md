# Repository Inventory

Inspected 2026-11-16. "Integrated" below means the code is in the running application, not that
a document says so.

## 1. What exists on this machine

| Location | What it is | Status |
|---|---|---|
| `C:\Users\rishi\city-healer` | **The application.** Git repo, branch `feat/trained-triage-model`, last commit `c6921ec`. A large uncommitted working tree: 18 modified or deleted files and many untracked ones (Firebase, booking, ML, hospital-data work). | Active. Everything else was integrated into it. |
| `C:\Users\rishi\city-healer-landing-zip` | Extracted landing-page zip (Vite + React, `src/main.jsx`) | Reference copy. Integrated as `src/site/landing/ZipLanding.jsx` (scoped CSS `.chl`). |
| `C:\Users\rishi\city-healer-onboarding-zip` | Extracted onboarding zip | Reference copy. Integrated as `src/site/onboarding/Onboarding.jsx` (`.cho`). |
| `C:\Users\rishi\city-healer-dashboard-zip` | Extracted patient-dashboard zip | Reference copy. Integrated as `src/site/dashboard/PatientDashboard.jsx` (`.chd`). |
| `C:\Users\rishi\city-healer-booking-zip` | Extracted doctor-discovery zip (first version) | Reference copy. Integrated as `src/site/dashboard/DoctorDirectory.jsx` (`.chb.chb`). |
| `C:\Users\rishi\city-healer-auth-zip` | Extracted backend-auth foundation (Express + Firebase Admin, `src/routes/me.ts`) | Reference copy. Ported into `server/firebase/identity.ts` and `patients.ts`. |
| `Downloads\City_Healer_Integrated_Doctor_Booking_Source.zip` | Booking frontend + backend | Not kept extracted. Ported into `server/firebase/booking.ts` and `src/site/dashboard/BookingPage.jsx`. |
| `Downloads\City_Healer_Intelligence_Platform_Seven_Modules.zip` | Python/FastAPI seven-module service | Not kept extracted and **not run as a Python service**. Ported to TypeScript: `server/ai/platform.ts`, `server/ai/documents.ts`, `shared/forecast.ts`. |
| `Downloads\` (others) | Duplicate downloads: Backend_Auth ×2, Doctor_Discovery ×3, Onboarding ×3, Landing ×3, `city-healer*.zip` ×5, `City_Healer_Doctor_Appointment_Backend_Source.zip` | Not used. These are older or duplicate packages. |
| `C:\Users\rishi\SwasthAI*`, `cloud-healing-main.zip` | Other health projects | Out of scope; not inspected. |

## 2. The application (`city-healer`)

| Item | Value |
|---|---|
| Languages | TypeScript (server, shared, most of the frontend), JSX (the four zip UIs), Python 3.13 (ML training and data scripts) |
| Frontend | React 19.0, react-router-dom 7.18, Vite 6.4, Tailwind CSS 4.1, motion 12, lucide-react |
| Backend | Express 4.21 on Node (tested on v25.2.1; Docker uses node:22), run via `tsx` in development and an esbuild bundle (`dist/server.cjs`) in production |
| Databases | **SQLite** (`city_healer.db` through `database.ts`): hospitals (990 active, 17 hidden), 80 sample doctors, legacy appointments, queue, records, medicines, orders, emergency alerts, chat. **Cloud Firestore** (Admin SDK): `patientProfiles`, `patientConsents`, `auditLogs`, `doctors`, `doctorSlots`, `appointments`, `notificationOutbox` |
| Authentication | Firebase Authentication (phone OTP + email/password), ID tokens verified with `verifyIdToken(token, checkRevoked=true)`, roles from custom claims `role` / `doctorId` / `hospitalId` (`server/firebase/identity.ts`) |
| ML / AI | All in-process, no external AI service and **no LLM**. TF-IDF + logistic regression (triage, intent, facility); logistic regression (diabetes, heart, liver lab risk); TF-IDF retrieval (medicines); gradient boosting + K-means (diet); weighted rules (hospital and provider ranking); mean / trend / weekly-seasonal forecaster |
| External services | Firebase Auth + Firestore (emulators locally; **no real project configured**); Unsplash image CDN (landing page photos); data downloads: OpenStreetMap HDX, NIN registry via Esri, CGHS/DGEHS PDFs, Kaggle/Hugging Face datasets |
| Deployment configs | `Dockerfile` + `railway.json` (full stack); `vercel.json` (static frontend only, see INTEGRATION_STATUS) |

### Entry points

| Entry | Purpose |
|---|---|
| `server.ts` | Express API and static or Vite-middleware frontend (1,9xx lines) |
| `src/main.tsx` → `src/site/SiteRouter.tsx` | Frontend routes: `/{en,hi}`, `/sign-in`, `/get-started`, `/dashboard/*`, `/emergency`, `/models`, `/app/*` (redirect); `*` → legacy `src/App.tsx` |
| `scripts/dev-firebase.mjs` | Starts the Firebase emulators, then the server |
| `ml/*.py` | Training: `train.py` (triage), `train_intent.py`, `train_lab.py`, `train_diet.py`, `train_facility.py`, `build_medicine_index.py`, `fetch_data.py` |
| `scripts/*.ts` / `*.py` | Admin and data CLIs: `set-role`, `set-password`, `migrate-users`, `verify-doctor`, `review-providers`, `review-hospitals`, `import-osm-hospitals`, `enrich-hospitals`, `fetch-osm-hospitals.py`, `fetch-nin-facilities.py`, `parse-empanelment.py` |

### API endpoints (from `server.ts` and `server/firebase/*.ts`)

**Public, no token:** `GET /api/health`, `GET /api/hospitals`, `GET /api/doctors`, `GET /api/medicines`, `GET /api/v1/doctors`, `GET /api/v1/doctors/:id`, `GET /api/v1/doctors/:id/slots`, `GET /api/v1/platform/modules`, `GET /api/v1/models`.

**Signed in:**

| Area | Routes |
|---|---|
| Patient profile | `/api/v1/me`, `PUT /api/v1/me/profile`, `POST /api/v1/me/consents`, `/api/users/:uid` (GET/PUT) |
| Hospitals and doctors | hospital reports, listing, beds, CRUD and doctors (`/api/hospitals/...`); `PUT /api/doctors/:id/online` |
| Legacy SQLite appointments | `/api/appointments` (GET/POST), `/api/doctors/:id/booked`, `PUT /api/appointments/:id/status`, `POST /api/appointments/:id/prescription` |
| Records | `/api/records` (GET/POST), `/api/records/analyze`, `/api/records/analyze/panels` |
| Queue | `/api/queue` (GET), `POST /api/queue/take`, `PUT /api/queue/:id/status` |
| Medicines | `/api/medicines/search-nationwide`, `/api/medicines/orders`, `/api/medicines/order`, `/api/medicines/guide` |
| Emergency | `POST /api/emergency/sos`, `/api/emergency/alerts` (GET/PUT) |
| Chat | `/api/chat/...` |
| Symptoms and diet | `POST /api/symptoms/check`, `/api/diet/conditions`, `/api/diet/recommend` |
| AI | `POST /api/ai/copilot`, `/api/ai/models`, `/api/ai/monitoring` (admin), `POST /api/developer/ai-pipeline` |
| Intelligence Platform (`/api/v1/`) | `copilot/chat`, `nlp/analyze`, `documents/extract`, `ml/demand-forecast` (POST: hospital or admin; GET: admin), `discovery/rank` |
| Provider booking (Firestore) | `POST /api/v1/doctors/applications` (doctor), `POST /api/v1/doctors/:id/slots` (owning doctor), `PATCH /api/v1/doctors/:id/verification` (admin); patients: `POST /api/v1/appointments`, `GET /api/v1/appointments/mine`, `POST /api/v1/appointments/:id/cancel`, `POST /api/v1/appointments/:id/reschedule` |

### Environment variables (names only; values not recorded)

- **`.env.example`:** `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_EMULATORS`, `FIREBASE_JAVA_HOME`, `NODE_ENV`, `DB_PATH`, `PORT`, `DEMO_MODE`, `AI_RATE_LIMIT`, `API_ONLY`.
- **`.env.local`** (untracked, gitignored) sets `DEMO_MODE="true"` and `VITE_FIREBASE_EMULATORS=true` for local development.

### Build and test commands

| Command | What it does |
|---|---|
| `npm run dev` | Emulators + server + Vite (port 3000; emulator UI 4000) |
| `npm run build` | `vite build` + esbuild bundles for the server and CLIs |
| `npm start` | Production server |
| `npm run lint` | `tsc --noEmit` |
| `npm run test:unit` | 9 files under `tsx --test` |
| `npm run test:server` | 3 files under fresh emulators: `access-matrix`, `resource-ownership`, `booking` |
| `python ml/<script>.py` | Retrain a model (writes `shared/*.json` and `ml/*_report.json`) |

## 3. Duplicate, obsolete, disconnected or conflicting implementations

| Finding | Evidence |
|---|---|
| **Two appointment systems.** SQLite `/api/appointments` (legacy, with queue and prescriptions) and Firestore `/api/v1/appointments` (verified providers). The dashboard reads only the SQLite one. | BUG-008 |
| **Two doctor sets.** 80 sample doctors in SQLite (look-only, "Not verified") vs verified providers in Firestore `doctors` (none exist outside tests). | `database.ts`, `server/firebase/booking.ts` |
| **Two frontends.** The new site (`src/site/**`) and the legacy `src/App.tsx` (still reachable on any unmatched URL, own sign-in form, localStorage fallback database, 1.6 MB chunk). | BUG-012 |
| **Two copilot endpoints.** `/api/ai/copilot` (used by the UI) and `/api/v1/copilot/chat` (the zip's contract; no UI caller). Same engine. | `server.ts:1726`, `server.ts:1754` |
| **Two Firestore rules files.** Root `firestore.rules` (stale, role documents) vs `firebase/firestore.rules` (active, claims). | BUG-020 |
| **Two deployment targets.** Docker/Railway (full stack) vs `vercel.json` (static only, no API). On Vercel every API call would 404 and the legacy client would fall back to localStorage data. | `vercel.json`, `src/utils/api.ts:636-641` |
| **Unused committed config.** `firebase-applet-config.json`, `firebase-blueprint.json` (AI Studio leftovers). | BUG-020 |
| **Seven-module Python service not present.** Only its ideas were ported; there is no FastAPI process, no `X-API-Key` and no Python serving. | `server/ai/platform.ts` |
| **Seed/sample data mixed with real data.** `seedData.ts` (89 KB) seeds sample appointments, queue tokens and doctors into SQLite; 52 seeded hospitals sit beside 938 OpenStreetMap ones. | `database.ts:1-10` |

## 4. Implementation status by requested project

| # | Project | Status |
|---|---|---|
| 1 | Landing page | Integrated, renders en/hi, no console errors |
| 2 | Patient onboarding | Integrated with real Firebase Auth (emulator-tested); consent gate fails open (BUG-004/005) |
| 3 | Patient dashboard | Integrated; reads legacy appointments only (BUG-008) |
| 4 | Doctor discovery (look-only directory) | Integrated; sample doctors, booking disabled by design |
| 5 | Backend/auth foundation | Integrated (token verification, claims, profiles, consents, audit log) |
| 6 | Integrated doctor booking | Integrated, Firestore transactions verified; no doctor or admin UI (API and CLI only); zero real verified providers |
| 7 | Seven-module AI platform | Ported to TypeScript; module-by-module status in AI_ML_EVALUATION.md |
| 8 | Shared config, docs, assets | README, FIREBASE_SETUP.md, security_spec.md, model cards; conflicting and stale files listed above |
