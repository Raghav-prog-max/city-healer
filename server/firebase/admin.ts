/**
 * Firebase Admin SDK: identity (Firebase Authentication) and patient profiles, consents and
 * audit events (Cloud Firestore). Adapted from City_Healer_Backend_Auth_Foundation.zip
 * (src/firebase.ts).
 *
 * Two ways to run:
 *   Emulators  `npm run dev` starts the Firebase Auth and Firestore emulators and sets
 *              FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST / GCLOUD_PROJECT.
 *              No Firebase project, credentials or billing needed.
 *   Real       FIREBASE_PROJECT_ID plus Application Default Credentials (a service account
 *              via GOOGLE_APPLICATION_CREDENTIALS locally, workload identity when deployed).
 *              See FIREBASE_SETUP.md.
 */
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const usingEmulators = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
export const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "";

/** Why Firebase cannot be used in this process, or null if it can. */
export function firebaseConfigProblem(): string | null {
  if (!firebaseProjectId) {
    return "No Firebase project. Run `npm run dev` (starts the local Firebase emulators), or set FIREBASE_PROJECT_ID and credentials for a real project (FIREBASE_SETUP.md).";
  }
  if (usingEmulators && !process.env.FIRESTORE_EMULATOR_HOST) {
    return "The Auth emulator is configured but the Firestore emulator is not (FIRESTORE_EMULATOR_HOST).";
  }
  return null;
}

const app = getApps()[0] ?? initializeApp(
  usingEmulators
    // The emulators accept any credential; a project id is all they need.
    ? { projectId: firebaseProjectId || "demo-city-healer" }
    : { credential: applicationDefault(), projectId: firebaseProjectId || undefined },
);

export const adminAuth = getAuth(app);
export const firestore = getFirestore(app);
firestore.settings({ ignoreUndefinedProperties: true });
