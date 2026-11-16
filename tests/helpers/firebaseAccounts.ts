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
 * A signed-in test account. role: PATIENT | DOCTOR | HOSPITAL | ADMIN. extraClaims carry the
 * doctorId / hospitalId links. Patients get a Firestore profile, as onboarding would create.
 */
export async function createActor(email: string, name: string, role: string, extraClaims: Record<string, string> = {}): Promise<Actor> {
  const { adminAuth, firestore } = await admin();
  const password = "TestPassw0rd!x";
  try { await adminAuth.deleteUser((await adminAuth.getUserByEmail(email)).uid); } catch { /* not there */ }
  const user = await adminAuth.createUser({ email, password, displayName: name });
  await adminAuth.setCustomUserClaims(user.uid, { role: role.toLowerCase(), ...extraClaims });
  if (role === "PATIENT") {
    await firestore.collection("patientProfiles").doc(user.uid).set({ uid: user.uid, fullName: name, city: "Delhi", preferredLanguage: "en" });
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
