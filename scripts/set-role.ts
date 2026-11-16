/**
 * Set an account's role (Firebase custom claims). The only way to create staff accounts:
 * nobody can give themselves a role, and the first administrator has to be made here.
 *
 *   npm run set-role -- --email <address> --role ADMIN
 *   npm run set-role -- --phone +919876543210 --role DOCTOR --doctorId doc-3
 *   npm run set-role -- --uid <uid> --role HOSPITAL --hospitalId hosp-1
 *   npm run set-role -- --uid <uid> --role CAREGIVER
 *   npm run set-role -- --list
 *   npm run set-role -- --list-doctors | --list-hospitals
 *   add --emulators to work on the local emulators (npm run dev must be running)
 *
 * Claims written: role (patient | caregiver | doctor | hospital | admin), and doctorId /
 * hospitalId linking a doctor to their row in `doctors` (which scopes the patients they can
 * see) or hospital staff to the facility they administer (which scopes bed updates).
 * The account's sessions are revoked so the new role applies immediately.
 * This replaces the old set-role and link-doctor scripts, which wrote to SQLite.
 */
import { parseArgs, loadFirebase } from "./firebase-cli";
import { dbAll, dbGet, sqliteDb } from "../database";

const ROLES = ["PATIENT", "CAREGIVER", "DOCTOR", "HOSPITAL", "ADMIN"] as const;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args["list-hospitals"] || args["list-doctors"]) {
    const rows = args["list-doctors"]
      ? await dbAll("SELECT id, name, specialty AS extra FROM doctors ORDER BY name LIMIT 100")
      : await dbAll("SELECT id, name, address AS extra FROM hospitals ORDER BY name LIMIT 100");
    for (const r of rows) console.log(`  ${String(r.id).padEnd(26)} ${r.name}  (${r.extra})`);
    return;
  }

  const { adminAuth } = await loadFirebase(args);

  if (args.list) {
    let pageToken: string | undefined;
    do {
      const page = await adminAuth.listUsers(1000, pageToken);
      for (const u of page.users) {
        const c = u.customClaims || {};
        console.log(`  ${String(c.role || "patient").padEnd(9)} ${(u.email || u.phoneNumber || "").padEnd(34)} uid=${u.uid}${c.doctorId ? ` doctorId=${c.doctorId}` : ""}${c.hospitalId ? ` hospitalId=${c.hospitalId}` : ""}`);
      }
      pageToken = page.pageToken;
    } while (pageToken);
    return;
  }

  const role = String(args.role || "").toUpperCase();
  if (!(ROLES as readonly string[]).includes(role)) {
    console.error(`--role must be one of ${ROLES.join(", ")}`);
    process.exit(1);
  }
  const user = args.uid ? await adminAuth.getUser(String(args.uid))
    : args.email ? await adminAuth.getUserByEmail(String(args.email))
    : args.phone ? await adminAuth.getUserByPhoneNumber(String(args.phone))
    : null;
  if (!user) {
    console.error("Say which account: --uid, --email or --phone.");
    process.exit(1);
  }

  const claims: Record<string, string> = { role: role.toLowerCase() };
  if (role === "DOCTOR") {
    const doctorId = String(args.doctorId || "");
    if (!doctorId || !(await dbGet("SELECT id FROM doctors WHERE id = ?", [doctorId]))) {
      console.error("A doctor account needs --doctorId <id of an existing doctor>. See --list-doctors.");
      process.exit(1);
    }
    claims.doctorId = doctorId;
  }
  if (role === "HOSPITAL") {
    const hospitalId = String(args.hospitalId || "");
    if (!hospitalId || !(await dbGet("SELECT id FROM hospitals WHERE id = ?", [hospitalId]))) {
      console.error("A hospital account needs --hospitalId <id of an existing hospital>. See --list-hospitals.");
      process.exit(1);
    }
    claims.hospitalId = hospitalId;
  }

  await adminAuth.setCustomUserClaims(user.uid, claims);
  await adminAuth.revokeRefreshTokens(user.uid);
  console.log(`${user.email || user.phoneNumber || user.uid}: ${JSON.stringify(claims)}. Their sessions were revoked; they sign in again to use the new role.`);
}

main()
  .catch((err) => { console.error(err?.message || err); process.exitCode = 1; })
  .finally(() => sqliteDb.close());
