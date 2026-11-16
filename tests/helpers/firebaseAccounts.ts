/**
 * Test accounts on the Firebase emulators.
 *
 * The server suites run under `npm run test:server`, which starts the Firebase Auth and
 * Firestore emulators and sets FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST /
 * GCLOUD_PROJECT. Accounts are created with the Admin SDK, given their role as custom claims
 * (exactly what scripts/set-role.ts does), and signed in through the Auth emulator's REST API
 * for a real Firebase ID token. Nothing here can reach a real Firebase project.
 */
import assert from "node:assert/strict";
import { TERMS_VERSION, PRIVACY_VERSION } from "../../shared/consent";

export interface Actor { uid: string; email: string; password: string; token: string; headers: Record<string, string> }

export function requireEmulators() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host || !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("The server tests need the Firebase emulators. Run them with `npm run test:server`.");
  }
  return host;
}

async function admin() {
  requireEmulators();
  return import("../../server/firebase/admin");
}

/** Sign in with email and password against the Auth emulator; returns a Firebase ID token. */
export async function signIn(email: string, password: string): Promise<string> {
  const host = requireEmulators();
  const res = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body: any = await res.json();
  assert.ok(res.ok && body.idToken, `emulator sign-in failed for ${email}: ${JSON.stringify(body)}`);
  return body.idToken;
}

/**
 * Write a consent event straight into Firestore for a test patient, in the shape
 * POST /api/v1/me/consents (grant) and /consents/withdraw store. Versions default to the
 * current ones; pass older ones to model a patient who accepted earlier terms.
 *
 * The server caches a patient's consent status for a short time, so write events before the
 * patient's first API call (or go through the API, which clears the cache).
 */
export async function writeConsentEvent(
  uid: string,
  event: { action?: "grant" | "withdraw"; termsVersion?: string; privacyVersion?: string; termsAccepted?: unknown; recordedAt?: Date } = {},
): Promise<void> {
  const { firestore } = await admin();
  const { FieldValue, Timestamp } = await import("firebase-admin/firestore");
  const action = event.action ?? "grant";
  await firestore.collection("patientConsents").doc().create({
    uid,
    action,
    ...(action === "grant" ? {
      termsAccepted: "termsAccepted" in event ? event.termsAccepted : true,
      termsVersion: event.termsVersion ?? TERMS_VERSION,
      privacyVersion: event.privacyVersion ?? PRIVACY_VERSION,
      marketingOptIn: false,
    } : {}),
    recordedAt: event.recordedAt ? Timestamp.fromDate(event.recordedAt) : FieldValue.serverTimestamp(),
    source: "test_helper",
  });
}

/**
 * A signed-in test account. role: PATIENT | DOCTOR | HOSPITAL | ADMIN. extraClaims carry the
 * doctorId / hospitalId links. Patients get a Firestore profile and a current consent, as
 * onboarding would create; `consent: false` leaves the consent out (the consent suite).
 */
export async function createActor(
  email: string, name: string, role: string, extraClaims: Record<string, string> = {}, opts: { consent?: boolean } = {},
): Promise<Actor> {
  const { adminAuth, firestore } = await admin();
  const password = "TestPassw0rd!x";
  try { await adminAuth.deleteUser((await adminAuth.getUserByEmail(email)).uid); } catch { /* not there */ }
  const user = await adminAuth.createUser({ email, password, displayName: name });
  await adminAuth.setCustomUserClaims(user.uid, { role: role.toLowerCase(), ...extraClaims });
  if (role === "PATIENT") {
    await firestore.collection("patientProfiles").doc(user.uid).set({ uid: user.uid, fullName: name, city: "Delhi", preferredLanguage: "en" });
    if (opts.consent !== false) await writeConsentEvent(user.uid);
  }
  const token = await signIn(email, password);
  return { uid: user.uid, email, password, token, headers: { Authorization: `Bearer ${token}` } };
}

/** An emulator-style (unsigned) ID token with arbitrary contents, for forgery tests. */
export function craftEmulatorToken(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const project = process.env.GCLOUD_PROJECT || "demo-city-healer";
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    iss: `https://securetoken.google.com/${project}`, aud: project, auth_time: now, iat: now, exp: now + 3600,
    firebase: { sign_in_provider: "password", identities: {} }, ...payload,
  })}.`;
}

export { admin as firebaseAdmin };

/**
 * Mark doctors verified (bookable) in a suite's throwaway SQLite database, as
 * `npm run verify-doctor` would. Seeded doctors start unverified and look-only.
 */
export async function verifyDoctorsInTestDb(dbPath: string, ids: string[]): Promise<void> {
  const sqlite3 = (await import("sqlite3")).default;
  const db = new sqlite3.Database(dbPath);
  for (const id of ids) {
    await new Promise<void>((resolve, reject) => db.run("UPDATE doctors SET verified = 1 WHERE id = ?", [id], (err) => (err ? reject(err) : resolve())));
  }
  await new Promise<void>((resolve) => db.close(() => resolve()));
}
