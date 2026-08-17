/**
 * Link a DOCTOR user account to its row in the `doctors` table.
 *
 *   npm run link-doctor -- --uid <user-uid> --doctorId <doc-id>
 *   npm run link-doctor -- --list
 *
 * Deliberately a CLI and not an API route: which clinician a login belongs to is a
 * provisioning decision, not something any authenticated caller should be able to set.
 * Record access for doctors is scoped through this link, so an unlinked DOCTOR account
 * is linked to no patients and sees none.
 */
import { dbGet, dbAll, dbRun, sqliteDb } from "../database";

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

async function listUnlinked() {
  const doctors = await dbAll(
    "SELECT uid, name, email, doctorId FROM users WHERE role = 'DOCTOR' ORDER BY name"
  );
  if (doctors.length === 0) {
    console.log("No DOCTOR accounts exist yet.");
    return;
  }
  console.log(`DOCTOR accounts (${doctors.length}):`);
  for (const d of doctors) {
    const state = d.doctorId ? `linked -> ${d.doctorId}` : "UNLINKED (sees no patients)";
    console.log(`  ${d.uid}  ${d.name} <${d.email}>  ${state}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    await listUnlinked();
    return;
  }

  const uid = typeof args.uid === "string" ? args.uid : null;
  const doctorId = typeof args.doctorId === "string" ? args.doctorId : null;

  if (!uid || !doctorId) {
    console.error("Usage: npm run link-doctor -- --uid <user-uid> --doctorId <doc-id>");
    console.error("       npm run link-doctor -- --list");
    process.exitCode = 1;
    return;
  }

  // Validate both sides exist before writing anything.
  const user = await dbGet("SELECT uid, name, role, doctorId FROM users WHERE uid = ?", [uid]);
  if (!user) {
    console.error(`[error] No user with uid "${uid}".`);
    process.exitCode = 1;
    return;
  }
  if (user.role !== "DOCTOR") {
    console.error(`[error] User "${user.name}" has role ${user.role}, not DOCTOR. Refusing to link.`);
    process.exitCode = 1;
    return;
  }

  const doctor = await dbGet("SELECT id, name, specialty FROM doctors WHERE id = ?", [doctorId]);
  if (!doctor) {
    console.error(`[error] No doctor record with id "${doctorId}".`);
    process.exitCode = 1;
    return;
  }

  const clash = await dbGet("SELECT uid, name FROM users WHERE doctorId = ? AND uid != ?", [doctorId, uid]);
  if (clash) {
    console.error(`[error] Doctor record "${doctorId}" is already linked to ${clash.name} (${clash.uid}).`);
    process.exitCode = 1;
    return;
  }

  await dbRun("UPDATE users SET doctorId = ? WHERE uid = ?", [doctorId, uid]);
  console.log(`Linked ${user.name} (${uid}) -> ${doctor.name} [${doctor.id}, ${doctor.specialty}]`);

  const patients = await dbAll(
    "SELECT DISTINCT patientId FROM appointments WHERE doctorId = ?",
    [doctorId]
  );
  console.log(`This account can now see records for ${patients.length} linked patient(s).`);
}

main()
  .catch((err) => {
    console.error("[link-doctor] failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => sqliteDb.close());
