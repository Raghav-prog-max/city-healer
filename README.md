# City Healer

An integrated emergency and care platform for Delhi NCR: AI symptom triage, live
hospital bed and ICU census, doctor consultation with digital prescriptions,
e-pharmacy, health records, and ambulance SOS dispatch — across four enforced
roles (patient, doctor, hospital, admin).

React 19 + Vite + Tailwind v4 on the front, Express + SQLite on the back, Firebase
Authentication and Firestore for sign-in and patient profiles, and AI models trained in
this repository (see [ml/README.md](ml/README.md)). One process serves both the API and
the frontend; no external AI service is called.

## Run it locally

**Prerequisites:** Node.js 20+, and Java 11+ for the Firestore emulator.

```bash
npm install
```

```bash
npm run dev
```

This starts the Firebase emulators (local sign-in and Firestore, no project or billing)
and the app on http://localhost:3000. The Emulator UI at http://127.0.0.1:4000 shows
accounts, profiles and the phone sign-in codes, which are never texted locally. Add
`DEMO_MODE="true"` to `.env.local` for the no-account demo. [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
covers the emulators and setting up a real Firebase project; [.env.example](.env.example)
lists every variable.

First boot creates the SQLite schema and seeds 52 hospitals, 80 doctors and 31 medicines.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Firebase emulators + server + Vite middleware with HMR |
| `npm run dev:server` | Server only (needs a real Firebase project configured) |
| `npm run build` | Builds the client to `dist/` and bundles the server to `dist/server.cjs` |
| `npm start` | Runs the production build (set `NODE_ENV=production`) |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Unit tests, then the access-control and resource-ownership suites against fresh Firebase emulators |
| `python ml/train.py` | Retrains the triage model and rewrites `shared/triage-model.json` |
| `npm run set-role` | Grants a role (Firebase custom claims), links doctors and hospital staff |
| `npm run set-password` | Sets a new password on an email account |
| `npm run migrate-users` | Moves accounts from the old SQLite `users` table into Firebase |
| `npm run verify-doctor` | Marks a directory doctor verified (bookable) after their registration is checked |
| `npm run review-providers` | Lists doctor applications for online booking; `--verify <uid> --council "..."` or `--reject <uid>` |
| `python scripts/fetch-osm-hospitals.py` | Downloads the OpenStreetMap hospital export for India (HDX, ODbL) |
| `npm run import-hospitals` | Imports Delhi NCR hospitals from it (`--dry-run` first) |
| `python scripts/fetch-nin-facilities.py` | Downloads the government health-facility registry (NIN, OGD India) for Delhi NCR |
| `python scripts/parse-empanelment.py` | Downloads and reads the official CGHS and DGEHS empanelled-hospital lists |
| `python ml/train_facility.py` | Retrains the facility-name model (hospital / clinic / pharmacy / dentist / lab) |
| `npm run enrich-hospitals` | Hides non-hospitals, matches the registry and scheme lists, adds departments with their sources, scores each listing |
| `npm run review-hospitals` | Lists reported problems, hidden and unconfirmed listings; hides or restores a listing |
| `npm run review-hospitals -- --unconfirmed --csv out.csv` | Unconfirmed listings with openstreetmap.org links, to correct the map itself |

## Accounts and roles

Patients sign up through onboarding (`/en/get-started`) with a **phone code** or **email and
password** (Firebase Authentication); their profile and consent go to Firestore. Staff roles
(`doctor`, `hospital`, `admin`; `caregiver` is reserved) are Firebase **custom claims** that
only an administrator can set. Nobody can give themselves a role. The server verifies the
Firebase ID token on every request, including whether the account was disabled, deleted or
signed out by a role change, so those take effect immediately.

```bash
npm run set-role -- --email you@example.com --role ADMIN
npm run set-role -- --phone +919876543210 --role DOCTOR --doctorId doc-3
npm run set-role -- --email desk@apollo.example --role HOSPITAL --hospitalId hosp-1
npm run set-role -- --list
```

A doctor sees patients only through the `doctorId` claim (their row in `doctors`), and
hospital staff can change only the facility in `hospitalId`. An unlinked doctor or hospital
account sees and changes nothing. Add `--emulators` to run these against `npm run dev`. See
[FIREBASE_SETUP.md](FIREBASE_SETUP.md).

## Security

There are no passwords or session secrets in this server: Firebase holds credentials and
issues the tokens, and the server only verifies them with the Admin SDK. Firestore rules
deny everything a client is not explicitly allowed (patients may read only their own profile
and consents; audit logs are never readable), and all writes go through the server.

`DEMO_MODE=true` binds anonymous callers to a synthetic sandbox identity whose uid matches
no real patient. It is for public demos only. Never enable it on a deployment holding real
data.

[security_spec.md](security_spec.md) documents the data invariants and twelve
named attack payloads. `npm test` asserts them.

## Deploying

`Dockerfile` and `railway.json` build and run the production bundle. Point
`DB_PATH` at a mounted volume — on ephemeral disk every deploy silently resets
the database. Configure Firebase as in [FIREBASE_SETUP.md](FIREBASE_SETUP.md) (the
`VITE_FIREBASE_*` values before building) and leave `DEMO_MODE` unset.

The frontend's Firebase web config is compiled in at build time, so the image takes it as
build arguments; local `.env` files are kept out of the image (`.dockerignore`):

```bash
docker build --build-arg VITE_FIREBASE_API_KEY=... --build-arg VITE_FIREBASE_AUTH_DOMAIN=... --build-arg VITE_FIREBASE_PROJECT_ID=... --build-arg VITE_FIREBASE_APP_ID=... -t city-healer .
```

On Railway, set the four `VITE_FIREBASE_*` service variables; they are passed to the build.
The image build fails if any is missing or if emulator mode is on, and the production server
refuses to start with a frontend built for the emulators or for a different Firebase project
than `FIREBASE_PROJECT_ID` (`dist/build-info.json` records what a build was compiled for).

## Hospital and doctor data

Hospitals come from OpenStreetMap (about 1,000 in the six Delhi NCR launch cities, imported
with `npm run import-hospitals`; © OpenStreetMap contributors, ODbL). OpenStreetMap has no bed
counts, so beds and ICU show **"not reported"** until a hospital's staff report them; every
report is timestamped.

Map data has errors, so `npm run enrich-hospitals` checks it: entries whose names show they are
not hospitals for people (offices, pharmacies, labs, campus gates, animal hospitals) are hidden
with the reason; hospitals that match the government facility registry are marked "In
government registry" with their official type and landline. Anyone signed in can "Report a
problem" with a listing; `npm run review-hospitals` lists reports and hides or restores listings.

Every department carries its source, and routing trusts them accordingly: **listed** (the
listing, OpenStreetMap, registry type or hospital staff) and **name** ("... Eye Hospital") count
fully; **empanelled** departments, the specialities a hospital is empanelled for in the official
CGHS (list of 22 Dec 2025) and DGEHS (26 Jun 2025) lists, count fully too, and the card names the
scheme and NABH status as listed. **Standard** departments, which a public hospital of that registry type must run under the
Indian Public Health Standards 2022, count partly and are shown as "Usually has ... - call to
confirm". Large general hospitals without listed departments are suggested with "departments not
listed - call to confirm". A list entry is matched to a listing only in the same city, with the
distinctive name words agreeing and the address agreeing (PIN, sector or locality); a chain's
branches must match on address, and entries a list marks suspended or closed are skipped.
About 94 hospitals match; the remaining private hospitals' departments still need the hospitals
themselves (provider onboarding) or the National Hospital Directory (data.gov.in, free API key).

Some map entries are mis-tagged without any telltale word in their name. A facility-name model
(`ml/train_facility.py`; TF-IDF + logistic regression on about 74,000 OpenStreetMap India names
outside Delhi NCR plus the official lists) scores every listing. A listing that nothing confirms
(not in the registry, not empanelled, not reviewed), whose name does not say hospital or nursing
home, and that the model doubts is a hospital, is shown as **"Unconfirmed - may not be a
hospital"**, ranked lower, and listed by `npm run review-hospitals -- --unconfirmed`. It is
never hidden by the model alone. `--csv` writes those listings with openstreetmap.org view and
edit links so the tag can be corrected at the source (this needs an OpenStreetMap account); the
next import picks the fix up.

### The seven AI modules

`City_Healer_Intelligence_Platform_Seven_Modules.zip` was a separate Python/FastAPI baseline
(keyword routing, a linear forecast, text extraction). Its routes are served by this server
under `/api/v1` behind the same Firebase sign-in, using the models trained in `ml/` where the app
already had them; `GET /api/v1/platform/modules` and the AI models page list where each runs.

| Module | Here |
| --- | --- |
| 1 Copilot | `POST /api/v1/copilot/chat`: the orchestrator, in the zip's shape (answer, route, safety flags) |
| 2 NLP | `POST /api/v1/nlp/analyze`: trained intent model, language, symptom and lab-value entities |
| 3 Documents | `POST /api/v1/documents/extract` and Health wallet → "Read values from a report file": fills the lab form for the patient to check; the file is not kept |
| 4 Prediction | `POST/GET /api/v1/ml/demand-forecast` (hospital staff / admin): mean, trend or weekly model, picked on held-out days, with its error |
| 5 Discovery | `POST /api/v1/discovery/rank`: verified, active providers only, with reasons |
| 6 Research | `ml/` training scripts, reports and model cards |
| 7 Operations | `/api/ai/monitoring`, module inventory |

The zip's urgent phrases that the emergency rules missed ("difficulty breathing", "severe
bleeding", "saans nahi", "chest mein dard") are now emergencies. PDFs are read only when the
`pdfjs-dist` package is installed (`npm install pdfjs-dist@6.4.299`); without it the page asks for
a .txt copy. Scanned reports need OCR, which is not set up.

### Booking verified doctors

Find care → **Book appointment** lists doctors who applied, were checked, and published open
times (from City_Healer_Integrated_Doctor_Booking; `server/firebase/booking.ts`, Firestore):

1. A doctor account (`npm run set-role -- ... --role DOCTOR`) submits its registration, specialty,
   city and consultation types: `POST /api/v1/doctors/applications`. It starts pending and hidden.
2. An administrator checks the registration with the State Medical Council or NMC, then
   `npm run review-providers -- --verify <uid> --council "<council>"` (or an admin account calls
   `PATCH /api/v1/doctors/<uid>/verification`).
3. The verified doctor publishes future, non-overlapping times: `POST /api/v1/doctors/<uid>/slots`.
4. Patients book, cancel and reschedule (same doctor and consultation type) from the tab. Each
   change is one Firestore transaction, so a slot can never be booked twice, and leaves an
   audit event and a pending notification in `notificationOutbox` (nothing is sent yet).

Registration numbers are never returned by the API, the four collections are closed to client
SDKs (`firebase/firestore.rules`), and staff and demo accounts cannot book. There is no doctor
or admin screen for steps 1 to 3 yet, and no cancellation cutoff, fees or payments.

### Sample directory

The 80 doctors are a sample directory using real practitioners' names with unverified details.
They are **look-only**: "Not verified · booking unavailable", and the server refuses to book
them. A doctor becomes bookable only after `npm run verify-doctor` records a checked
registration. No open dataset links Indian doctors to hospitals; doctors are meant to be added
by their hospitals during provider onboarding.

## Scope

Hospital, doctor, AQI and outbreak data is seeded, not live. Ambulance dispatch,
ABHA/NDHM registry sync and insurance claims are simulated pending institutional
access. The stack, the role and ownership enforcement, the test suite and the trained
triage model are real and running.
