/**
 * Mark a doctor in the directory as verified (bookable), or withdraw it.
 *
 *   npm run verify-doctor -- --list
 *   npm run verify-doctor -- --doctorId doc-3 --registration DMC/12345 --council "Delhi Medical Council"
 *   npm run verify-doctor -- --doctorId doc-3 --revoke
 *
 * Only after City Healer has checked the doctor's registration with their State Medical
 * Council / the NMC register, their practice details, and their consent to be listed.
 * Until then a doctor is shown as "Not verified · booking unavailable" and the server refuses
 * appointments and OPD tokens with them. This is a provisioning decision, so it is a CLI run
 * by an administrator on the host that owns the database, never something a request may do.
 */
import { dbGet, dbAll, dbRun, sqliteDb } from "../database";
import { parseArgs } from "./firebase-cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    const rows = await dbAll("SELECT id, name, specialty, hospitalName, verified FROM doctors ORDER BY verified DESC, name");
    for (const d of rows) console.log(`  ${d.verified ? "VERIFIED  " : "unverified"} ${String(d.id).padEnd(10)} ${d.name} · ${d.specialty} · ${d.hospitalName}`);
    return;
  }

  const id = String(args.doctorId || "");
  const doctor = id ? await dbGet("SELECT id, name, verified FROM doctors WHERE id = ?", [id]) : null;
  if (!doctor) {
    console.error("Usage: npm run verify-doctor -- --doctorId <id> --registration <no.> --council <name>   (or --revoke, or --list)");
    process.exit(1);
  }

  if (args.revoke) {
    await dbRun("UPDATE doctors SET verified = 0 WHERE id = ?", [id]);
    console.log(`${doctor.name} (${id}) is no longer verified. Booking with them is now refused.`);
    return;
  }
  if (!args.registration || !args.council) {
    console.error("Record what was checked: --registration <registration number> --council <State Medical Council or NMC>.");
    process.exit(1);
  }
  await dbRun("UPDATE doctors SET verified = 1 WHERE id = ?", [id]);
  console.log(`${doctor.name} (${id}) verified against ${args.council} registration ${args.registration}. Patients can now book them.`);
}

main()
  .catch((err) => { console.error(err?.message || err); process.exitCode = 1; })
  .finally(() => sqliteDb.close());
