/**
 * Set a user account's role.
 *
 *   npm run set-role -- --email <address> --role ADMIN
 *   npm run set-role -- --email <address> --role HOSPITAL --hospitalId hosp-1
 *   npm run set-role -- --list
 *   npm run set-role -- --list-hospitals
 *
 * This exists because production deliberately refuses to let anyone self-register
 * as ADMIN or HOSPITAL, and only an ADMIN may promote another account. On a fresh
 * deployment that leaves no way in: there is no seeded administrator, so the
 * hospital and admin consoles would be permanently unreachable. Someone with
 * filesystem access to the database has to make the first one.
 *
 * Deliberately a CLI and not an API route, for the same reason as link-doctor:
 * granting privilege is a provisioning decision, never something a request may do.
 * Run it on the host that owns the database — on Railway, `railway run` with
 * DB_PATH pointing at the mounted volume.
 */
import { dbGet, dbAll, dbRun, sqliteDb } from "../database";

const ROLES = ["PATIENT", "DOCTOR", "HOSPITAL", "ADMIN"] as const;
type RoleName = (typeof ROLES)[number];

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

async function listHospitals() {
  const rows = await dbAll("SELECT id, name FROM hospitals ORDER BY name LIMIT 60");
  console.log(`Facilities (${rows.length} shown):`);
  for (const h of rows) console.log(`  ${h.id.padEnd(24)} ${h.name}`);
}

async function listAccounts() {
  const users = await dbAll("SELECT uid, name, email, role, hospitalId FROM users ORDER BY role, name");
  if (users.length === 0) {
    console.log("No accounts exist yet. Register one through the app first, then promote it here.");
    return;
  }
  const admins = users.filter((u) => u.role === "ADMIN").length;
  console.log(`Accounts (${users.length}):`);
  for (const u of users) {
    const bind = u.role === "HOSPITAL" ? (u.hospitalId ? `  -> ${u.hospitalId}` : "  UNBOUND (administers no facility)") : "";
    console.log(`  ${u.role.padEnd(8)} ${u.uid}  ${u.name} <${u.email}>${bind}`);
  }
  if (admins === 0) {
    console.log("\n[warning] No ADMIN account exists. Nobody can provision roles through the API.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    await listAccounts();
    return;
  }

  if (args["list-hospitals"]) {
    await listHospitals();
    return;
  }

  const uid = typeof args.uid === "string" ? args.uid : null;
  const email = typeof args.email === "string" ? args.email.toLowerCase().trim() : null;
  const role = typeof args.role === "string" ? (args.role.toUpperCase() as RoleName) : null;
  const hospitalId = typeof args.hospitalId === "string" ? args.hospitalId : null;

  if ((!uid && !email) || !role) {
    console.error("Usage: npm run set-role -- --email <address> --role ADMIN");
    console.error("       npm run set-role -- --uid <user-uid> --role HOSPITAL");
    console.error("       npm run set-role -- --email <address> --role HOSPITAL --hospitalId hosp-1");
    console.error("       npm run set-role -- --list   |   --list-hospitals");
    console.error(`Roles: ${ROLES.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (!ROLES.includes(role)) {
    console.error(`[error] "${role}" is not a role. Choose one of: ${ROLES.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const user = uid
    ? await dbGet("SELECT uid, name, email, role FROM users WHERE uid = ?", [uid])
    : await dbGet("SELECT uid, name, email, role FROM users WHERE email = ?", [email]);

  if (!user) {
    console.error(`[error] No account matching ${uid ? `uid "${uid}"` : `email "${email}"`}.`);
    console.error("Register it through the app first, then run this again.");
    process.exitCode = 1;
    return;
  }

  if (user.role === role) {
    console.log(`${user.name} <${user.email}> is already ${role}. Nothing to do.`);
    return;
  }

  // Refuse to remove the last administrator: doing so would lock privilege
  // provisioning out of the API with no way back in except this script.
  if (user.role === "ADMIN" && role !== "ADMIN") {
    const admins = await dbAll("SELECT uid FROM users WHERE role = 'ADMIN'");
    if (admins.length <= 1) {
      console.error(`[error] ${user.name} is the only ADMIN. Promote another account before demoting this one.`);
      process.exitCode = 1;
      return;
    }
  }

  // A HOSPITAL account must name the facility it administers: writes are scoped to
  // that id, so an unbound account can modify nothing at all.
  if (hospitalId) {
    const hosp = await dbGet("SELECT id, name FROM hospitals WHERE id = ?", [hospitalId]);
    if (!hosp) {
      console.error(`[error] No facility with id "${hospitalId}". Run --list-hospitals to see them.`);
      process.exitCode = 1;
      return;
    }
  }
  if (role === "HOSPITAL" && !hospitalId) {
    const existing = await dbGet("SELECT hospitalId FROM users WHERE uid = ?", [user.uid]);
    if (!existing?.hospitalId) {
      console.error("[error] A HOSPITAL account needs --hospitalId, or it administers no facility and every write is refused.");
      console.error("        Run: npm run set-role -- --list-hospitals");
      process.exitCode = 1;
      return;
    }
  }

  const previous = user.role;
  await dbRun("UPDATE users SET role = ?, updatedAt = ? WHERE uid = ?", [
    role,
    new Date().toISOString(),
    user.uid
  ]);
  if (hospitalId) {
    await dbRun("UPDATE users SET hospitalId = ? WHERE uid = ?", [hospitalId, user.uid]);
    console.log(`Bound to facility ${hospitalId}`);
  }

  console.log(`${user.name} <${user.email}>  ${previous} -> ${role}`);
  if (role === "DOCTOR") {
    console.log("A DOCTOR account also needs a clinician link: npm run link-doctor -- --list");
  }
  console.log("The change takes effect on the account's next request; existing tokens are re-checked against this row.");
}

main()
  .catch((err) => {
    console.error("[set-role] failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => sqliteDb.close());
