/**
 * Verified-provider directory, availability and appointment booking in Cloud Firestore.
 * Adapted from City_Healer_Integrated_Doctor_Booking_Source.zip (backend/src/routes/doctors.ts,
 * routes/appointments.ts, services/appointments.ts): the same routes, collections, schemas,
 * status rules and Firestore transactions. What changed:
 *  - identity and role come from this server's verified Firebase token and custom claims
 *    (shared with every other route), not a users/{uid} role document;
 *  - audit events go to the existing auditLogs collection (writeAuditEvent);
 *  - the DEMO_MODE sandbox identity can browse but never book;
 *  - city / specialty filters run on the verified-active list in memory, so no composite
 *    Firestore indexes are needed;
 *  - a doctor cannot publish two slots that overlap; listed slots are future ones only;
 *  - an appointment stores the doctor's name and specialty, so "My appointments" can say who
 *    it is with; a reschedule must also keep the slot in the future.
 *
 *   GET   /api/v1/doctors                       public; verified + active only
 *   GET   /api/v1/doctors/:doctorId             public; verified + active only
 *   GET   /api/v1/doctors/:doctorId/slots       public; open future slots
 *   POST  /api/v1/doctors/applications          doctor: submit credentials (pending + hidden)
 *   POST  /api/v1/doctors/:doctorId/slots       doctor who owns the verified profile
 *   PATCH /api/v1/doctors/:doctorId/verification  admin only
 *   GET   /api/v1/appointments/doctor           doctor: bookings made with their own profile
 *   POST  /api/v1/appointments                  patient
 *   GET   /api/v1/appointments/mine             patient
 *   POST  /api/v1/appointments/:id/cancel       owning patient
 *   POST  /api/v1/appointments/:id/reschedule   owning patient
 *
 * Collections: doctors/{uid}, doctorSlots, appointments, notificationOutbox (pending events
 * only; nothing is sent yet). These providers are separate from the SQLite sample directory,
 * which stays look-only.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "./admin";
import type { AuthUser, Role } from "./identity";
import { ncrCities, writeAuditEvent } from "./patients";

const doctorsCol = () => firestore.collection("doctors");
const slotsCol = () => firestore.collection("doctorSlots");
const appointmentsCol = () => firestore.collection("appointments");
const outboxCol = () => firestore.collection("notificationOutbox");

const user = (req: Request): AuthUser | null => (req as any).user || null;

const allowRoles = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Authentication required." });
  if (!roles.includes(u.role)) return res.status(403).json({ error: "Insufficient permissions for this operation." });
  next();
};

const notDemo = (req: Request, res: Response, next: NextFunction) =>
  user(req)?.isDemo ? res.status(403).json({ error: "The demo account cannot book appointments." }) : next();

/** Only the fields a patient should see; never registrationNumber, ownerUid or review data. */
const publicDoctor = (id: string, d: FirebaseFirestore.DocumentData) => ({
  id,
  fullName: d.fullName,
  specialty: d.specialty,
  qualifications: d.qualifications,
  city: d.city,
  locality: d.locality,
  consultationTypes: d.consultationTypes,
  experienceYears: d.experienceYears,
  languages: d.languages,
  consultationFee: d.consultationFee,
  about: d.about,
  profilePhotoUrl: d.profilePhotoUrl,
});

const isBookable = (d: FirebaseFirestore.DocumentSnapshot) =>
  d.exists && d.get("verificationStatus") === "verified" && d.get("listingStatus") === "active";

export type PublicDoctor = ReturnType<typeof publicDoctor>;

// The copilot and symptom triage recommend from this list on every call, so it is kept for a
// short time rather than read from Firestore each time. Cleared when an application or a
// verification decision changes who is listed (in this process; another process catches up
// within PROVIDERS_CACHE_MS).
const PROVIDERS_CACHE_MS = 60_000;
let providersCache: { at: number; doctors: PublicDoctor[] } | null = null;
const forgetProviders = () => { providersCache = null; };

/** Every verified, active provider: the only doctors that can be booked. */
export async function verifiedProviders(): Promise<PublicDoctor[]> {
  if (providersCache && Date.now() - providersCache.at < PROVIDERS_CACHE_MS) return providersCache.doctors;
  const s = await doctorsCol().where("verificationStatus", "==", "verified").where("listingStatus", "==", "active").limit(500).get();
  const doctors = s.docs.map((d) => publicDoctor(d.id, d.data()));
  providersCache = { at: Date.now(), doctors };
  return doctors;
}

export const applicationSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  specialty: z.string().trim().min(2).max(80),
  qualifications: z.array(z.string().trim().min(2).max(100)).min(1).max(10),
  registrationNumber: z.string().trim().min(3).max(80),
  city: z.enum(ncrCities),
  locality: z.string().trim().min(2).max(100),
  consultationTypes: z.array(z.enum(["online", "in_person"])).min(1),
}).strict();

const slotSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  consultationType: z.enum(["online", "in_person"]),
}).strict();

const bookingSchema = z.object({
  doctorId: z.string().min(1).max(128),
  slotId: z.string().min(1).max(128),
  consultationType: z.enum(["online", "in_person"]),
  reason: z.string().max(500).optional(),
}).strict();

/** Booking errors thrown inside transactions, and how they are answered. */
const KNOWN: Record<string, [number, string]> = {
  DOCTOR_NOT_BOOKABLE: [409, "Doctor is not currently bookable."],
  SLOT_UNAVAILABLE: [409, "This slot is no longer available."],
  SLOT_IN_PAST: [409, "Cannot book a past slot."],
  CONSULTATION_TYPE_MISMATCH: [409, "Consultation type does not match the slot."],
  APPOINTMENT_NOT_FOUND: [404, "Appointment not found."],
  APPOINTMENT_NOT_CANCELLABLE: [409, "Appointment cannot be cancelled."],
  APPOINTMENT_NOT_RESCHEDULABLE: [409, "Appointment cannot be rescheduled."],
  APPOINTMENT_STARTED: [409, "This appointment has already started, so it can no longer be cancelled or moved here."],
  DOCTOR_MISMATCH: [409, "Choose another slot with the same doctor."],
};

const fail = (res: Response, err: unknown) => {
  const code = err instanceof Error ? err.message : "";
  if (KNOWN[code]) return res.status(KNOWN[code][0]).json({ error: KNOWN[code][1], code });
  console.error("[booking]", err);
  return res.status(500).json({ error: "Unexpected server error." });
};

const nowIso = () => new Date().toISOString();

export async function createAppointment(patientUid: string, input: z.infer<typeof bookingSchema>) {
  const a = appointmentsCol().doc(), s = slotsCol().doc(input.slotId), d = doctorsCol().doc(input.doctorId);
  await firestore.runTransaction(async (tx) => {
    const [ss, ds] = await Promise.all([tx.get(s), tx.get(d)]);
    if (!isBookable(ds)) throw Error("DOCTOR_NOT_BOOKABLE");
    if (!ss.exists || ss.get("doctorId") !== input.doctorId || ss.get("status") !== "open") throw Error("SLOT_UNAVAILABLE");
    const slot = ss.data()!;
    if (slot.startsAt <= nowIso()) throw Error("SLOT_IN_PAST");
    if (slot.consultationType !== input.consultationType) throw Error("CONSULTATION_TYPE_MISMATCH");
    tx.update(s, { status: "booked", appointmentId: a.id, updatedAt: FieldValue.serverTimestamp() });
    tx.create(a, {
      patientUid, doctorId: input.doctorId, doctorName: ds.get("fullName"), specialty: ds.get("specialty"),
      slotId: input.slotId, consultationType: input.consultationType, reason: input.reason ?? "",
      startsAt: slot.startsAt, endsAt: slot.endsAt, status: "confirmed",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(outboxCol().doc(), { type: "appointment_confirmed", recipientUid: patientUid, appointmentId: a.id, status: "pending", createdAt: FieldValue.serverTimestamp() });
  });
  await writeAuditEvent({ actorUid: patientUid, action: "appointment.created", resourceType: "appointment", resourceId: a.id });
  return a.id;
}

export async function cancelAppointment(uid: string, id: string) {
  const a = appointmentsCol().doc(id);
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(a);
    if (!snap.exists || snap.get("patientUid") !== uid) throw Error("APPOINTMENT_NOT_FOUND");
    if (snap.get("status") !== "confirmed") throw Error("APPOINTMENT_NOT_CANCELLABLE");
    // From the start time on, the appointment is the doctor's to complete, prescribe for or
    // cancel: a patient cancelling a visit that took place would block all three.
    if (snap.get("startsAt") <= nowIso()) throw Error("APPOINTMENT_STARTED");
    const s = slotsCol().doc(snap.get("slotId"));
    const ss = await tx.get(s);
    tx.update(a, { status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
    // The slot opens again for others, if it is still this appointment's.
    if (ss.exists && ss.get("appointmentId") === id) tx.update(s, { status: "open", appointmentId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    tx.create(outboxCol().doc(), { type: "appointment_cancelled", recipientUid: uid, appointmentId: id, status: "pending", createdAt: FieldValue.serverTimestamp() });
  });
  await writeAuditEvent({ actorUid: uid, action: "appointment.cancelled", resourceType: "appointment", resourceId: id });
}

/** What a patient is told when City Healer cancels because the doctor was refused. */
export const DOCTOR_REFUSED_REASON = "This doctor is no longer available on City Healer. Please book another doctor.";

export interface RefusalCancellation {
  /** Upcoming appointments cancelled. */
  cancelled: number;
  /** Confirmed appointments that had already started: left for the doctor to cancel or, once verified again, complete. */
  started: number;
  /** Upcoming appointments that could not be cancelled this time. Running it again retries them. */
  failed: number;
}

/**
 * Cancel the upcoming appointments of a doctor whose verification has been refused, so no
 * patient is left holding a booking with someone City Healer no longer vouches for.
 *
 * Only appointments that have not started are cancelled. One that has started may be a visit
 * that took place and is waiting for the doctor to close it: telling that patient to "book
 * another doctor" would be wrong, so it is left as it is and counted in `started`.
 *
 * Each appointment is cancelled in its own transaction (a patient may be cancelling or
 * rescheduling at the same moment): status "cancelled", cancelledBy "city_healer", the time
 * withdrawn, and a notification queued for the patient (nothing sends these yet). One failing
 * does not stop the rest; it is counted in `failed`, and calling this again retries it.
 * Completed and already-cancelled appointments, and prescriptions, are never touched.
 */
export async function cancelOpenAppointmentsOfDoctor(doctorUid: string, actorUid: string): Promise<RefusalCancellation> {
  const snap = await appointmentsCol().where("doctorId", "==", doctorUid).get();
  const result: RefusalCancellation = { cancelled: 0, started: 0, failed: 0 };
  for (const doc of snap.docs.filter((d) => d.get("status") === "confirmed")) {
    let outcome: "cancelled" | "started" | "unchanged";
    try {
      outcome = await firestore.runTransaction(async (tx) => {
        const a = await tx.get(doc.ref);
        if (!a.exists || a.get("status") !== "confirmed") return "unchanged" as const; // changed since the query
        if (a.get("startsAt") <= nowIso()) return "started" as const;
        const slotId = a.get("slotId");
        const slotRef = typeof slotId === "string" && slotId ? slotsCol().doc(slotId) : null;
        const slot = slotRef ? await tx.get(slotRef) : null;
        tx.update(doc.ref, { status: "cancelled", cancelledBy: "city_healer", cancelReason: DOCTOR_REFUSED_REASON, updatedAt: FieldValue.serverTimestamp() });
        if (slotRef && slot?.exists && slot.get("appointmentId") === doc.id) tx.update(slotRef, { status: "withdrawn", appointmentId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
        tx.create(outboxCol().doc(), { type: "appointment_cancelled_doctor_refused", recipientUid: a.get("patientUid"), appointmentId: doc.id, status: "pending", createdAt: FieldValue.serverTimestamp() });
        return "cancelled" as const;
      });
    } catch (err) {
      console.error("[booking] could not cancel an appointment of a refused doctor:", err instanceof Error ? err.message : "unknown_error");
      result.failed++;
      continue;
    }
    if (outcome === "started") result.started++;
    if (outcome !== "cancelled") continue;
    result.cancelled++;
    // The cancellation stands even if its audit entry cannot be written; the rest still run.
    try { await writeAuditEvent({ actorUid, action: "appointment.cancelled_doctor_refused", resourceType: "appointment", resourceId: doc.id }); }
    catch (err) { console.error("[booking] audit event not written:", err instanceof Error ? err.message : "unknown_error"); }
  }
  return result;
}

export async function rescheduleAppointment(uid: string, id: string, newSlotId: string) {
  const a = appointmentsCol().doc(id), ns = slotsCol().doc(newSlotId);
  await firestore.runTransaction(async (tx) => {
    const as = await tx.get(a);
    if (!as.exists || as.get("patientUid") !== uid) throw Error("APPOINTMENT_NOT_FOUND");
    if (as.get("status") !== "confirmed") throw Error("APPOINTMENT_NOT_RESCHEDULABLE");
    if (as.get("startsAt") <= nowIso()) throw Error("APPOINTMENT_STARTED");
    const os = slotsCol().doc(as.get("slotId"));
    const [n, o] = await Promise.all([tx.get(ns), tx.get(os)]);
    if (!n.exists || n.get("status") !== "open") throw Error("SLOT_UNAVAILABLE");
    if (n.get("doctorId") !== as.get("doctorId")) throw Error("DOCTOR_MISMATCH");
    if (n.get("consultationType") !== as.get("consultationType")) throw Error("CONSULTATION_TYPE_MISMATCH");
    if (n.get("startsAt") <= nowIso()) throw Error("SLOT_IN_PAST");
    tx.update(ns, { status: "booked", appointmentId: id, updatedAt: FieldValue.serverTimestamp() });
    if (o.exists && o.get("appointmentId") === id) tx.update(os, { status: "open", appointmentId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    tx.update(a, { slotId: newSlotId, startsAt: n.get("startsAt"), endsAt: n.get("endsAt"), updatedAt: FieldValue.serverTimestamp() });
    tx.create(outboxCol().doc(), { type: "appointment_rescheduled", recipientUid: uid, appointmentId: id, status: "pending", createdAt: FieldValue.serverTimestamp() });
  });
  await writeAuditEvent({ actorUid: uid, action: "appointment.rescheduled", resourceType: "appointment", resourceId: id });
}

export function providerDoctorsRouter() {
  const r = Router();

  r.post("/applications", allowRoles("DOCTOR"), notDemo, async (req, res) => {
    const p = applicationSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid application.", details: p.error.flatten() });
    try {
      const uid = user(req)!.uid;
      const ref = doctorsCol().doc(uid);
      // Re-submitting puts the profile back to pending and hidden: changed credentials are re-checked.
      await ref.set({ ...p.data, ownerUid: uid, verificationStatus: "pending", listingStatus: "hidden", updatedAt: nowIso() }, { merge: true });
      forgetProviders();
      await writeAuditEvent({ actorUid: uid, action: "doctor.application_submitted", resourceType: "doctor", resourceId: ref.id });
      res.status(202).json({ doctorId: ref.id, verificationStatus: "pending" });
    } catch (e) { fail(res, e); }
  });

  r.get("/", async (req, res) => {
    try {
      const s = await doctorsCol().where("verificationStatus", "==", "verified").where("listingStatus", "==", "active").limit(500).get();
      const city = typeof req.query.city === "string" ? req.query.city : "";
      const specialty = typeof req.query.specialty === "string" ? req.query.specialty : "";
      const doctors = s.docs
        .filter((d) => (!city || d.get("city") === city) && (!specialty || d.get("specialty") === specialty))
        .slice(0, 100)
        .map((d) => publicDoctor(d.id, d.data()));
      res.json({ doctors });
    } catch (e) { fail(res, e); }
  });

  r.get("/:doctorId", async (req, res) => {
    try {
      const s = await doctorsCol().doc(req.params.doctorId).get();
      if (!isBookable(s)) return res.status(404).json({ error: "Doctor not found." });
      res.json({ doctor: publicDoctor(s.id, s.data()!) });
    } catch (e) { fail(res, e); }
  });

  r.post("/:doctorId/slots", allowRoles("DOCTOR"), notDemo, async (req, res) => {
    const p = slotSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid slot." });
    try {
      const d = await doctorsCol().doc(req.params.doctorId).get();
      if (!d.exists || d.get("ownerUid") !== user(req)!.uid) return res.status(403).json({ error: "You can only publish slots for your own profile." });
      if (!isBookable(d)) return res.status(403).json({ error: "Doctor must be verified before publishing slots." });
      const start = Date.parse(p.data.startsAt), end = Date.parse(p.data.endsAt);
      if (end <= start || start <= Date.now()) return res.status(400).json({ error: "Slot must be in the future and have positive duration." });
      if (end - start > 4 * 3600_000) return res.status(400).json({ error: "A slot can be at most 4 hours long." });
      if (!d.get("consultationTypes")?.includes(p.data.consultationType)) return res.status(400).json({ error: "Consultation type not enabled." });
      const startsAt = new Date(start).toISOString(), endsAt = new Date(end).toISOString();
      // No two of the doctor's live slots may overlap.
      const existing = await slotsCol().where("doctorId", "==", req.params.doctorId).get();
      const overlaps = existing.docs.some((s) => s.get("status") !== "withdrawn" && s.get("startsAt") < endsAt && s.get("endsAt") > startsAt);
      if (overlaps) return res.status(409).json({ error: "This slot overlaps one you already published." });
      const ref = await slotsCol().add({ doctorId: req.params.doctorId, startsAt, endsAt, consultationType: p.data.consultationType, status: "open", createdAt: nowIso() });
      res.status(201).json({ slotId: ref.id });
    } catch (e) { fail(res, e); }
  });

  r.get("/:doctorId/slots", async (req, res) => {
    try {
      const d = await doctorsCol().doc(req.params.doctorId).get();
      if (!isBookable(d)) return res.status(404).json({ error: "Doctor not found." });
      const s = await slotsCol().where("doctorId", "==", req.params.doctorId).where("status", "==", "open").limit(300).get();
      const now = nowIso();
      const slots = s.docs
        .map((x) => ({ id: x.id, doctorId: x.get("doctorId"), startsAt: x.get("startsAt"), endsAt: x.get("endsAt"), consultationType: x.get("consultationType"), status: x.get("status") }))
        .filter((x) => x.startsAt > now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      res.json({ slots });
    } catch (e) { fail(res, e); }
  });

  r.patch("/:doctorId/verification", allowRoles("ADMIN"), notDemo, async (req, res) => {
    // reviewNote: where the registration was checked (verify) or why it was refused (reject).
    // The rejection note is shown to the doctor.
    const p = z.object({ verificationStatus: z.enum(["verified", "rejected"]), listingStatus: z.enum(["active", "hidden"]), reviewNote: z.string().trim().max(300).optional() }).strict()
      .refine((v) => (v.verificationStatus === "verified" && v.listingStatus === "active") || (v.verificationStatus === "rejected" && v.listingStatus === "hidden"))
      .safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid decision." });
    try {
      const ref = doctorsCol().doc(req.params.doctorId);
      if (!(await ref.get()).exists) return res.status(404).json({ error: "Doctor not found." });
      await ref.update({ ...p.data, reviewedBy: user(req)!.uid, reviewedAt: nowIso() });
      forgetProviders();
      await writeAuditEvent({ actorUid: user(req)!.uid, action: `doctor.${p.data.verificationStatus}`, resourceType: "doctor", resourceId: ref.id });
      // A refused doctor's upcoming appointments are cancelled. Done after the refusal is saved:
      // from that point the doctor cannot be booked, so none can be added. Sending the same
      // refusal again is safe and retries any that failed.
      const swept = p.data.verificationStatus === "rejected" ? await cancelOpenAppointmentsOfDoctor(ref.id, user(req)!.uid) : { cancelled: 0, started: 0, failed: 0 };
      res.json({
        doctorId: ref.id, verificationStatus: p.data.verificationStatus, listingStatus: p.data.listingStatus,
        cancelledAppointments: swept.cancelled, startedAppointmentsLeft: swept.started, failedCancellations: swept.failed,
      });
    } catch (e) { fail(res, e); }
  });

  return r;
}

export function appointmentsRouter() {
  const r = Router();

  // A doctor's own bookings: appointments made with the profile this account owns (doctors/{uid}).
  // The patient's name comes from their profile; nothing else about the patient is included.
  r.get("/doctor", allowRoles("DOCTOR"), notDemo, async (req, res) => {
    try {
      const s = await appointmentsCol().where("doctorId", "==", user(req)!.uid).limit(300).get();
      const patientUids = [...new Set(s.docs.map((d) => String(d.get("patientUid"))))];
      const profiles = patientUids.length ? await firestore.getAll(...patientUids.map((uid) => firestore.collection("patientProfiles").doc(uid))) : [];
      const nameOf = new Map(profiles.map((p) => [p.id, p.exists ? String(p.get("fullName") || "") : ""]));
      const appointments = s.docs.map((d) => ({
        id: d.id, patientName: nameOf.get(String(d.get("patientUid"))) || "", reason: d.get("reason") || "",
        startsAt: d.get("startsAt"), endsAt: d.get("endsAt"), consultationType: d.get("consultationType"), status: d.get("status"),
        cancelledBy: d.get("cancelledBy") || null, hasPrescription: !!d.get("hasPrescription"),
      })).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
      res.json({ appointments });
    } catch (e) { fail(res, e); }
  });

  r.use(allowRoles("PATIENT"), notDemo);

  r.post("/", async (req, res) => {
    const p = bookingSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Invalid booking request.", details: p.error.flatten() });
    try {
      const appointmentId = await createAppointment(user(req)!.uid, p.data);
      res.status(201).json({ appointmentId, status: "confirmed" });
    } catch (e) { fail(res, e); }
  });

  r.get("/mine", async (req, res) => {
    try {
      const s = await appointmentsCol().where("patientUid", "==", user(req)!.uid).limit(100).get();
      const appointments = s.docs.map((d) => {
        const { createdAt, updatedAt, ...rest } = d.data();
        return { id: d.id, ...rest };
      }).sort((a: any, b: any) => String(a.startsAt).localeCompare(String(b.startsAt)));
      res.json({ appointments });
    } catch (e) { fail(res, e); }
  });

  r.post("/:appointmentId/cancel", async (req, res) => {
    try {
      await cancelAppointment(user(req)!.uid, req.params.appointmentId);
      res.json({ appointmentId: req.params.appointmentId, status: "cancelled" });
    } catch (e) { fail(res, e); }
  });

  r.post("/:appointmentId/reschedule", async (req, res) => {
    const p = z.object({ newSlotId: z.string().min(1).max(128) }).strict().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "newSlotId required." });
    try {
      await rescheduleAppointment(user(req)!.uid, req.params.appointmentId, p.data.newSlotId);
      res.json({ appointmentId: req.params.appointmentId, status: "confirmed", rescheduled: true });
    } catch (e) { fail(res, e); }
  });

  return r;
}
