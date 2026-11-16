# Firebase for City Healer

City Healer signs people in with **Firebase Authentication** (a phone code by SMS, or email
and password) and keeps patient profiles, consents and an audit log in **Cloud Firestore**.
Clinical and directory data (hospitals, doctors, appointments, records, prescriptions) stays
in SQLite, keyed by the Firebase user id.

This follows *City_Healer_Backend_Auth_Foundation.zip*: phone OTP on the client, Firebase ID
tokens verified on the server with the Admin SDK, roles as custom claims, strict Zod schemas,
deny-by-default Firestore rules, and append-only consent and audit records.

## Local development: no project needed

```bash
npm run dev
```

This starts the Firebase **emulators** (Google's local copies of Auth and Firestore) and the
app. Nothing reaches Google, no SMS is sent and nothing is billed.

- App: http://localhost:3000
- Emulator UI: http://127.0.0.1:4000. Accounts are under **Authentication**; profiles,
  consents and audit events are under **Firestore**.
- **Phone codes** are not texted. Find them in the Emulator UI, in the terminal log, or at
  `http://127.0.0.1:9099/emulator/v1/projects/demo-city-healer/verificationCodes`.
- Local accounts and data are kept in `.firebase-emulator-data/` (gitignored) between runs.
  Delete that folder to start empty.
- The Firestore emulator needs Java 11 or newer. `FIREBASE_JAVA_HOME` in `.env.local` points
  at a JDK if the system `java` is older.

`npm test` runs the unit tests and then the server tests against fresh emulators.

## Admin tasks

Staff roles are Firebase custom claims. Only these scripts (or an administrator through the
app) can set them, and a user can never set their own.

```bash
npm run set-role -- --email you@example.com --role ADMIN
npm run set-role -- --phone +919876543210 --role DOCTOR --doctorId doc-3
npm run set-role -- --email desk@hospital.example --role HOSPITAL --hospitalId hosp-1
npm run set-role -- --list
npm run set-role -- --list-doctors
npm run set-password -- --email someone@example.com --password <new password>
```

Add `--emulators` to run them against the local emulators while `npm run dev` is running.
A doctor sees only the patients of the `doctors` row in `doctorId`, and hospital staff can
update only the facility in `hospitalId`. Changing a role signs that person out everywhere,
so the change applies at once.

## Setting up the real project

These steps need your Google account, so you do them yourself:

1. **Create the project.** Go to https://console.firebase.google.com and click
   *Add project*. A project id such as `city-healer-prod` works.
2. **Choose a plan.** Phone sign-in needs the **Blaze (pay as you go)** plan, and SMS
   messages are billed per message. Set a budget alert under
   *Google Cloud console > Billing > Budgets*.
3. **Turn on sign-in methods.** Under *Authentication > Sign-in method*, enable
   **Phone** and **Email/Password**. Under *Settings > Authorized domains*, add your
   app's domain.
4. **Create the database.** Under *Firestore Database*, click *Create database* and
   choose a region in India (e.g. `asia-south1`, Mumbai). Start in production mode.
5. **Deploy the security rules** from this repository:
   ```bash
   npx firebase login
   npx firebase deploy --only firestore:rules --project <your-project-id>
   ```
6. **Configure the browser.** Under *Project settings > Your apps*, add a **Web app** and
   copy its config into the environment:
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=<project-id>
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_EMULATORS=false
   ```
   These values are not secrets, but Vite builds them into the frontend, so set them
   before `npm run build`.
7. **Configure the server.** Set `FIREBASE_PROJECT_ID=<project-id>`, then give the server
   Google credentials:
   - **Deployed:** run the service as a Google service account with the
     *Firebase Authentication Admin* and *Cloud Datastore User* roles. Use workload
     identity, not a key file.
   - **Local, against the real project:** create a key under *Project settings >
     Service accounts*, save it outside the repository (or in `secrets/`, which is
     gitignored) and set `GOOGLE_APPLICATION_CREDENTIALS` to its path. Never commit it.
8. **Move the existing accounts** from SQLite into the project:
   ```bash
   npm run migrate-users -- --dry-run
   npm run migrate-users
   ```
   Everyone keeps their user id (so their appointments and records stay theirs) and their
   password, because Firebase accepts the existing bcrypt hashes. The script lists any
   account it imports without a password. Those people use *Forgot password*.
9. **Make the first administrator:**
   `npm run set-role -- --email you@example.com --role ADMIN`.

## Before launch

These come from the zip's README, plus what this app adds:

- **Firebase App Check:** enable it, and set phone-auth abuse limits (SMS region policy:
  India only) and billing alerts.
- **CORS:** allow exact HTTPS origins only, if the API is served separately.
- **Account lifecycle:** add account deletion, data export, retention, consent withdrawal
  and verified support workflows. The consent records already store which versions of the
  terms and privacy notice were accepted; bump `TERMS_VERSION` / `PRIVACY_VERSION` in
  `src/firebase.ts` when they change.
- **Caregivers:** define authorization and patient revocation before enabling family access.
- **Legal review:** have qualified counsel review the privacy notice, terms and consent
  wording against India's DPDP Act and health-data obligations.
- **Identity:** a successful OTP proves control of a phone number, not clinical identity or
  consent to share health records.
