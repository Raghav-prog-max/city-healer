/**
 * Create the synthetic demo accounts on the LOCAL Firebase emulators, for the demonstration.
 *
 *   npm run dev                      (in one terminal: emulators + app on http://localhost:3000)
 *   npm run seed-demo                (in another)
 *
 * Accounts (password for all: DEMO_PASSWORD below; local emulators only, never a real project):
 *   patient.demo@cityhealer.test   patient, Delhi, profile and current consent
 *   doctor.demo@cityhealer.test    doctor, verified provider "Dr Kavya Menon" with open times
 *   hospital.demo@cityhealer.test  hospital desk for hosp-1
 *   admin.demo@cityhealer.test     administrator
 *
 * Everything is synthetic: the registration number is made up and no real person is named.
 * Running it again resets the passwords and roles and adds fresh open times; it does not delete
 * anything. It refuses to run against anything but the emulators.
 */
import { FieldValue } from "firebase-admin/firestore";
import { loadFirebase } from "./firebase-cli";
import { TERMS_VERSION, PRIVACY_VERSION } from "../shared/consent";

export const DEMO_PASSWORD = "Demo-Pass-2026x";

const ACCOUNTS = [
  { email: "patient.demo@cityhealer.test", name: "Asha Verma", claims: { role: "patient" }, patient: true },
  { email: "doctor.demo@cityhealer.test", name: "Dr Kavya Menon", claims: { role: "doctor" } },
  { email: "hospital.demo@cityhealer.test", name: "Apollo Desk (demo)", claims: { role: "hospital", hospitalId: "hosp-1" } },
  { email: "admin.demo@cityhealer.test", name: "City Healer Admin (demo)", claims: { role: "admin" } },
] as const;

async function main() {
  const { adminAuth, firestore, usingEmulators } = await loadFirebase({ emulators: true });
  if (!usingEmulators) { console.error("seed-demo only runs against the local emulators."); process.exit(1); }

  const uids: Record<string, string> = {};
  for (const a of ACCOUNTS) {
    let uid: string;
    try {
      uid = (await adminAuth.getUserByEmail(a.email)).uid;
      await adminAuth.updateUser(uid, { password: DEMO_PASSWORD, displayName: a.name, disabled: false });
    } catch {
      uid = (await adminAuth.createUser({ email: a.email, password: DEMO_PASSWORD, displayName: a.name, emailVerified: true })).uid;
    }
    await adminAuth.setCustomUserClaims(uid, { ...a.claims });
    await adminAuth.revokeRefreshTokens(uid);
    uids[a.email] = uid;
    if ("patient" in a) {
      await firestore.collection("patientProfiles").doc(uid).set({ uid, fullName: a.name, city: "Delhi", locality: "Saket", preferredLanguage: "en" }, { merge: true });
      await firestore.collection("patientConsents").doc().create({
        uid, action: "grant", termsAccepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION,
        marketingOptIn: false, recordedAt: FieldValue.serverTimestamp(), source: "seed_demo",
      });
    }
    console.log(`  ${a.email.padEnd(32)} ${a.claims.role}`);
  }

  // The doctor's verified provider profile, as an admin's review would leave it.
  const doctorUid = uids["doctor.demo@cityhealer.test"];
  await firestore.collection("doctors").doc(doctorUid).set({
    fullName: "Dr Kavya Menon", specialty: "General Physician", qualifications: ["MBBS", "MD (Medicine)"],
    registrationNumber: "DMC-DEMO-2026-001", city: "Delhi", locality: "Saket", consultationTypes: ["online", "in_person"],
    ownerUid: doctorUid, verificationStatus: "verified", listingStatus: "active",
    reviewedBy: "seed-demo", reviewedAt: new Date().toISOString(), reviewNote: "Synthetic demo account (no real registration)",
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // Open times: one in-person today (in 30 minutes, for check-in) and three over the next days.
  const slots = firestore.collection("doctorSlots");
  const at = (ms: number) => { const d = new Date(Date.now() + ms); d.setSeconds(0, 0); return d; };
  const plan: Array<[number, "online" | "in_person"]> = [[30 * 60_000, "in_person"], [26 * 3600_000, "online"], [27 * 3600_000, "online"], [50 * 3600_000, "in_person"]];
  for (const [ms, type] of plan) {
    const start = at(ms);
    await slots.add({ doctorId: doctorUid, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 20 * 60_000).toISOString(), consultationType: type, status: "open", createdAt: new Date().toISOString() });
  }
  console.log(`  ${plan.length} open times added for Dr Kavya Menon.`);
  console.log(`Password for all demo accounts: ${DEMO_PASSWORD} (local emulators only). Sign in at http://localhost:3000/en/sign-in`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err?.message || err); process.exit(1); });
