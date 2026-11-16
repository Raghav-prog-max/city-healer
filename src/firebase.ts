/// <reference types="vite/client" />
/**
 * Firebase in the browser: Authentication (phone OTP and email/password).
 *
 * This file used to be a hand-written imitation of Firebase that signed in against the
 * server's own /api/auth routes. It is now the real Firebase Web SDK, used by the site in src/site.
 *
 * Phone sign-in follows the zip "City_Healer_Backend_Auth_Foundation" (client/firebase.ts):
 * requestPhoneOtp() then confirmPhoneOtp(). With VITE_FIREBASE_EMULATORS=true everything talks
 * to the local Firebase emulators started by `npm run dev`: no project, no SMS (the code is
 * shown in the emulator UI at http://127.0.0.1:4000/auth), no reCAPTCHA challenge.
 * Only Firebase web config lives here; it is not a secret. Service-account keys never do.
 */
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, connectAuthEmulator, onAuthStateChanged as fbOnAuthStateChanged,
  signInWithEmailAndPassword as fbSignIn, createUserWithEmailAndPassword as fbCreateUser,
  signOut as fbSignOut, sendPasswordResetEmail as fbSendPasswordReset, sendEmailVerification as fbSendEmailVerification,
  updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  RecaptchaVerifier, signInWithPhoneNumber,
  type ConfirmationResult, type User, type Auth,
} from "firebase/auth";

const env = import.meta.env;
export const usingFirebaseEmulators = env.VITE_FIREBASE_EMULATORS === "true";

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || (usingFirebaseEmulators ? "demo-api-key" : undefined),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (usingFirebaseEmulators ? "demo-city-healer.firebaseapp.com" : undefined),
  projectId: env.VITE_FIREBASE_PROJECT_ID || (usingFirebaseEmulators ? "demo-city-healer" : undefined),
  appId: env.VITE_FIREBASE_APP_ID || (usingFirebaseEmulators ? "demo-app-id" : undefined),
};
if (!config.apiKey) {
  console.error("[Firebase] VITE_FIREBASE_API_KEY is not set, so nobody can sign in. See FIREBASE_SETUP.md.");
}

const app = getApps()[0] ?? initializeApp(config);
export const auth: Auth = getAuth(app);
if (usingFirebaseEmulators) {
  connectAuthEmulator(auth, env.VITE_FIREBASE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099", { disableWarnings: true });
  // The emulator accepts any reCAPTCHA; skip the widget entirely.
  auth.settings.appVerificationDisabledForTesting = true;
}

// Left over from the imitation: a token and user copy in localStorage. Firebase keeps its
// own session; remove the stale copies so nothing reads them by mistake.
try { localStorage.removeItem("city_healer_jwt"); localStorage.removeItem("city_healer_user"); localStorage.removeItem("city_healer_mock_users"); } catch {}

export type MockUser = User;

/** Firebase error codes in words a patient can act on. */
const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/invalid-login-credentials": "Invalid email or password.",
  "auth/wrong-password": "Invalid email or password.",
  "auth/user-not-found": "Invalid email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Choose a stronger password (at least 8 characters).",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Cannot reach the sign-in service. Check your connection and try again.",
  "auth/invalid-phone-number": "Enter a valid Indian mobile number.",
  "auth/invalid-verification-code": "That code is not right. Check the SMS and try again.",
  "auth/code-expired": "That code has expired. Request a new one.",
  "auth/missing-verification-code": "Enter the 6-digit code.",
  "auth/quota-exceeded": "SMS sign-in is busy right now. Try again later or use email.",
  "auth/requires-recent-login": "Please sign in again, then retry.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/operation-not-allowed": "This sign-in method is not enabled.",
};
function friendly(err: any): { code: string; message: string } {
  const code = err?.code || "auth/unknown";
  return { code, message: MESSAGES[code] || err?.message || "Sign-in failed. Please try again." };
}
async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (err) { throw friendly(err); }
}

export const onAuthStateChanged = (a: Auth, cb: (user: User | null) => void) => fbOnAuthStateChanged(a, cb);

export async function signInWithEmailAndPassword(a: Auth, email: string, password: string) {
  return wrap(() => fbSignIn(a, email.trim(), password));
}

export async function signOut(a: Auth) {
  return fbSignOut(a);
}

export async function sendPasswordResetEmail(a: Auth, email: string) {
  return wrap(() => fbSendPasswordReset(a, email.trim()));
}

export async function sendEmailVerification(user: User) {
  return wrap(() => fbSendEmailVerification(user));
}

/** Server request with the current user's Firebase ID token. */
async function apiWithToken(path: string, init: RequestInit = {}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || `Request failed (${res.status})`);
  return body;
}

export interface PatientProfileInput {
  fullName: string;
  city: "Delhi" | "Gurugram" | "Noida" | "Greater Noida" | "Ghaziabad" | "Faridabad";
  locality?: string;
  preferredLanguage: "en" | "hi";
  dateOfBirth?: string;
  gender?: "female" | "male" | "other" | "prefer_not_to_say";
}
/** The zip's savePatientProfile / recordConsent (client/api.ts), against this server. */
export const savePatientProfile = (profile: Partial<PatientProfileInput>) =>
  apiWithToken("/api/v1/me/profile", { method: "PUT", body: JSON.stringify(profile) });
export const recordConsent = (consent: { termsAccepted: true; termsVersion: string; privacyVersion: string; marketingOptIn: boolean }) =>
  apiWithToken("/api/v1/me/consents", { method: "POST", body: JSON.stringify(consent) });
export const getMyAccount = () => apiWithToken("/api/v1/me");

/** Current versions of the documents a patient accepts at sign-up. Bump when they change. */
// One definition, shared with the server that enforces them.
export { TERMS_VERSION, PRIVACY_VERSION } from "../shared/consent";
import { TERMS_VERSION, PRIVACY_VERSION } from "../shared/consent";

/**
 * Create an email account. With a profile (onboarding) it is saved, with the consent, to
 * Firestore straight away; without one the person completes onboarding later.
 */
export async function registerAccount(
  a: Auth,
  details: { name: string; email: string; password: string; role?: string; profile?: Omit<PatientProfileInput, "fullName">; consent?: { marketingOptIn: boolean } }
) {
  const cred = await wrap(() => fbCreateUser(a, details.email.trim(), details.password));
  if (details.name) await updateProfile(cred.user, { displayName: details.name.trim() });
  if (details.profile) await savePatientProfile({ fullName: details.name.trim(), ...details.profile });
  if (details.consent) await recordConsent({ termsAccepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, marketingOptIn: details.consent.marketingOptIn });
  return cred;
}

/** Change the password of an email account; Firebase requires the current one first. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user?.email) throw { code: "auth/operation-not-allowed", message: "This account signs in with a phone code and has no password." };
  await wrap(() => reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, currentPassword)));
  await wrap(() => updatePassword(user, newPassword));
}

// ---------------------------------------------------------------- phone OTP (from the zip)

let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;

/** Normalise "98765 43210" / "+91-98765-43210" to +919876543210, or null if not a valid Indian mobile. */
export function toIndianE164(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+?91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export async function requestPhoneOtp(phoneNumber: string, recaptchaContainerId: string) {
  const e164 = toIndianE164(phoneNumber);
  if (!e164) throw { code: "auth/invalid-phone-number", message: "Enter a valid Indian mobile number (10 digits, starting 6 to 9)." };
  // A fresh verifier every time: one made on another page is bound to an element that no
  // longer exists (onboarding -> sign-in), and Firebase would wait on it for ever.
  if (verifier) { try { verifier.clear(); } catch {} verifier = null; }
  verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
  try {
    confirmation = await signInWithPhoneNumber(auth, e164, verifier);
  } catch (err) {
    try { verifier.clear(); } catch {}
    verifier = null;
    throw friendly(err);
  }
  return e164;
}

export async function confirmPhoneOtp(code: string) {
  if (!confirmation) throw { code: "auth/missing-verification-code", message: "Request a code first." };
  if (!/^\d{6}$/.test(code)) throw { code: "auth/invalid-verification-code", message: "Enter the 6-digit verification code." };
  const credential = await wrap(() => confirmation!.confirm(code));
  confirmation = null;
  return credential.user;
}
