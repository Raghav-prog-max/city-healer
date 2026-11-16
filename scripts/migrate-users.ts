/**
 * Move the accounts in the old SQLite `users` table into Firebase.
 *
 *   npm run migrate-users -- --dry-run          show what would happen
 *   npm run migrate-users                         migrate into the real project
 *   add --emulators to rehearse against the local emulators (npm run dev must be running)
 *
 * For each account:
 *  - Firebase Authentication user with the SAME uid, so appointments, records and queue tokens
 *    in SQLite (keyed by uid) still belong to the right person;
 *  - the existing bcrypt password hash is imported as-is (Firebase supports bcrypt), so
 *    people keep their passwords. Accounts whose password was derived from the email by the
 *    retired sign-in are imported WITHOUT a password and listed: they reset it.
 *  - custom claims: role, and doctorId / hospitalId links;
 *  - a Firestore patient profile with the name, and city / locality where valid.
 *    Age and gender are NOT copied: older accounts were created with invented defaults
 *    (age 34, "Male"), which cannot be told apart from real answers. Patients without a
 *    valid city are asked to finish their profile the next time they sign in.
 * Accounts that already exist in Firebase (same uid) are skipped, so it can be re-run.
 */
import { parseArgs, loadFirebase } from "./firebase-cli";
import { dbAll, sqliteDb } from "../database";
import { hasLegacyDerivedPassword } from "./legacy-passwords";

const CITIES = ["Delhi", "Gurugram", "Noida", "Greater Noida", "Ghaziabad", "Faridabad"];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = !!args["dry-run"];
  const { adminAuth, firestore } = await loadFirebase(args);
  const { FieldValue } = await import("firebase-admin/firestore");

  const cols = (await dbAll<{ name: string }>("PRAGMA table_info(users)")).map((c) => c.name);
  const pick = (c: string) => (cols.includes(c) ? c : `NULL AS ${c}`);
  const rows = await dbAll(`SELECT uid, name, email, passwordHash, phone, role, ${pick("city")}, ${pick("locality")}, ${pick("doctorId")}, ${pick("hospitalId")} FROM users`);
  console.log(`${rows.length} account(s) in SQLite.${dryRun ? " DRY RUN: nothing is written." : ""}`);

  let created = 0, skipped = 0;
  const needReset: string[] = [];
  for (const r of rows) {
    try {
      await adminAuth.getUser(r.uid);
      skipped++;
      continue;
    } catch { /* not in Firebase yet */ }

    let hash: string | null = r.passwordHash || null;
    if (hash && await hasLegacyDerivedPassword(r.email || "", hash)) { hash = null; needReset.push(r.email); }
    const role = String(r.role || "PATIENT").toLowerCase();
    const claims: Record<string, string> = { role };
    if (r.doctorId) claims.doctorId = r.doctorId;
    if (r.hospitalId) claims.hospitalId = r.hospitalId;
    const phone = /^\+91[6-9]\d{9}$/.test(String(r.phone || "")) ? r.phone : undefined;

    console.log(`  ${dryRun ? "would import" : "import"} ${r.email} (${role}${hash ? "" : ", no password"})`);
    if (dryRun) { created++; continue; }

    const result = await adminAuth.importUsers([{
      uid: r.uid,
      email: r.email,
      emailVerified: false,
      displayName: r.name || undefined,
      phoneNumber: phone,
      customClaims: claims,
      ...(hash ? { passwordHash: Buffer.from(hash) } : {}),
    }], { hash: { algorithm: "BCRYPT" } });
    if (result.failureCount) {
      console.error(`    failed: ${result.errors[0].error.message}`);
      continue;
    }
    if (role === "patient" && r.name) {
      await firestore.collection("patientProfiles").doc(r.uid).set({
        uid: r.uid,
        fullName: String(r.name).slice(0, 100),
        ...(CITIES.includes(r.city) ? { city: r.city } : {}),
        ...(r.locality ? { locality: String(r.locality).slice(0, 120) } : {}),
        preferredLanguage: "en",
        migratedFrom: "sqlite",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    created++;
  }
  console.log(`\n${dryRun ? "Would import" : "Imported"} ${created}, already in Firebase ${skipped}.`);
  if (needReset.length) {
    console.log(`These accounts had a password derived from their email (retired sign-in) and were imported without one;`);
    console.log(`they must use "forgot password" or be given one with npm run set-password:\n  ${needReset.join("\n  ")}`);
  }
}

main()
  .catch((err) => { console.error(err?.message || err); process.exitCode = 1; })
  .finally(() => sqliteDb.close());
