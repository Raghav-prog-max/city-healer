/**
 * Review doctor applications for booking (Firestore `doctors`, server/firebase/booking.ts).
 *
 *   npm run review-providers                      pending applications
 *   npm run review-providers -- --all             every provider and its status
 *   npm run review-providers -- --verify <uid> --council "Delhi Medical Council"
 *   npm run review-providers -- --reject <uid> --reason "registration not found"
 *   add --emulators to run against `npm run dev`
 *
 * Verify only after checking the registration number against the State Medical Council or
 * NMC register, the qualifications, and the doctor's consent to be listed. Verifying lists the
 * doctor publicly and lets them publish times; rejecting hides them, stops new bookings and
 * cancels their upcoming appointments (patients see it in their appointments; nothing is sent).
 * The same decision is available to an admin account at PATCH /api/v1/doctors/:id/verification.
 */
import { parseArgs, loadFirebase } from "./firebase-cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { firestore } = await loadFirebase(args);
  const { writeAuditEvent } = await import("../server/firebase/patients");
  const doctors = firestore.collection("doctors");

  const decide = async (uid: string, verificationStatus: "verified" | "rejected", note: string) => {
    const ref = doctors.doc(uid);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`No application from ${uid}.`); process.exit(1); }
    await ref.update({
      verificationStatus, listingStatus: verificationStatus === "verified" ? "active" : "hidden",
      reviewedBy: "cli", reviewedAt: new Date().toISOString(), reviewNote: note.slice(0, 300),
    });
    await writeAuditEvent({ actorUid: "cli", action: `doctor.${verificationStatus}`, resourceType: "doctor", resourceId: uid });
    console.log(`${snap.get("fullName")} (${uid}): ${verificationStatus}.`);
    if (verificationStatus === "rejected") {
      // The same as a refusal from the admin screen: upcoming appointments are cancelled.
      const { cancelOpenAppointmentsOfDoctor } = await import("../server/firebase/booking");
      const r = await cancelOpenAppointmentsOfDoctor(uid, "cli");
      console.log(`${r.cancelled} upcoming appointment${r.cancelled === 1 ? "" : "s"} cancelled. Patients see this in their appointments; no message is sent to them yet, so contact them if needed.`);
      if (r.started) console.log(`${r.started} that had already started ${r.started === 1 ? "was" : "were"} left as ${r.started === 1 ? "it is" : "they are"}.`);
      if (r.failed) console.log(`${r.failed} could not be cancelled. Run the same command again to retry.`);
    }
  };

  if (args.verify) {
    if (!args.council) { console.error('Record where the registration was checked: --council "<State Medical Council or NMC>".'); process.exit(1); }
    return decide(String(args.verify), "verified", `Registration checked with ${args.council}`);
  }
  if (args.reject) return decide(String(args.reject), "rejected", String(args.reason || "rejected on review"));

  const snap = args.all ? await doctors.get() : await doctors.where("verificationStatus", "==", "pending").get();
  if (snap.empty) { console.log(args.all ? "No providers." : "No pending applications."); return; }
  for (const d of snap.docs) {
    const x = d.data();
    console.log(`  ${String(x.verificationStatus).padEnd(9)} ${d.id.padEnd(30)} ${x.fullName} · ${x.specialty} · ${x.city}, ${x.locality} · reg. ${x.registrationNumber} · ${(x.qualifications || []).join(", ")}`);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err?.message || err); process.exit(1); });
