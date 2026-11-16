/**
 * What a doctor does with a booking, on the Firestore appointment system (P1 item 6, doctor
 * side). These replace the SQLite routes PUT /api/appointments/:id/status and
 * POST /api/appointments/:id/prescription for bookings made in server/firebase/booking.ts.
 *
 *   Doctor   POST /api/v1/appointments/:id/complete        mark a started appointment completed
 *            POST /api/v1/appointments/:id/doctor-cancel   cancel, with a reason the patient sees
 *            POST /api/v1/appointments/:id/prescription    write the prescription (once)
 *            GET  /api/v1/appointments/:id/records         that patient's health-wallet records
 *   Either   GET  /api/v1/appointments/:id/prescription    the patient or the doctor on it
 *   Patient  GET  /api/v1/prescriptions/mine               every prescription written for them
 *
 * A doctor acts only on appointments booked with the profile their account owns
 * (doctors/{uid}); anyone else's appointment answers 404, exactly like one that does not exist.
 * Access to a patient's records comes only from a confirmed or completed appointment with that
 * doctor, never from a cancelled one, and each read is audited.
 *
 * Prescriptions are stored in Firestore (collection `prescriptions`, one per appointment, id =
 * appointment id). Like every collection here they are reachable only through this server:
 * firebase/firestore.rules denies all client access. Audit events never hold their contents.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "./admin";
import type { AuthUser, Role } from "./identity";
import { writeAuditEvent } from "./patients";

const appointmentsCol = () => firestore.collection("appointments");
const slotsCol = () => firestore.collection("doctorSlots");
const prescriptionsCol = () => firestore.collection("prescriptions");
const outboxCol = () => firestore.collection("notificationOutbox");

const user = (req: Request): AuthUser | null => (req as any).user || null;

const allow = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Authentication required." });
  if (u.isDemo || !roles.includes(u.role)) return res.status(403).json({ error: "Insufficient permissions for this operation." });
  next();
};

const KNOWN: Record<string, [number, string]> = {
  APPOINTMENT_NOT_FOUND: [404, "Appointment not found."],
  APPOINTMENT_NOT_OPEN: [409, "This appointment is not confirmed, so it cannot be changed."],
  APPOINTMENT_NOT_STARTED: [409, "This appointment has not started yet."],
  APPOINTMENT_CANCELLED: [409, "This appointment was cancelled."],
  PRESCRIPTION_EXISTS: [409, "A prescription has already been written for this appointment."],
  PRESCRIPTION_NOT_FOUND: [404, "No prescription has been written for this appointment."],
};

const fail = (res: Response, err: unknown) => {
  const code = err instanceof Error ? err.message : "";
  if (KNOWN[code]) return res.status(KNOWN[code][0]).json({ error: KNOWN[code][1], code });
  console.error("[consultations]", err instanceof Error ? err.message : "unknown_error");
  return res.status(500).json({ error: "Unexpected server error." });
};

const nowIso = () => new Date().toISOString();

export const prescriptionSchema = z.object({
  diagnosis: z.string().trim().min(2).max(200),
  medicines: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    dosage: z.string().trim().min(1).max(120),
    frequency: z.string().trim().max(120).optional(),
    duration: z.string().trim().max(60).optional(),
  }).strict()).max(20),
  instructions: z.string().trim().max(1000).optional(),
}).strict();

const publicPrescription = (id: string, d: FirebaseFirestore.DocumentData) => ({
  id, appointmentId: d.appointmentId, doctorName: d.doctorName, specialty: d.specialty,
  diagnosis: d.diagnosis, medicines: d.medicines || [], instructions: d.instructions || "", issuedAt: d.issuedAt,
});

/** The doctor's own appointment inside a transaction, or APPOINTMENT_NOT_FOUND. */
async function ownAppointment(tx: FirebaseFirestore.Transaction, doctorUid: string, id: string) {
  const ref = appointmentsCol().doc(id);
  const snap = await tx.get(ref);
  if (!snap.exists || snap.get("doctorId") !== doctorUid) throw Error("APPOINTMENT_NOT_FOUND");
  return { ref, snap };
}

export async function completeAppointment(doctorUid: string, id: string) {
  await firestore.runTransaction(async (tx) => {
    const { ref, snap } = await ownAppointment(tx, doctorUid, id);
    if (snap.get("status") !== "confirmed") throw Error("APPOINTMENT_NOT_OPEN");
    if (snap.get("startsAt") > nowIso()) throw Error("APPOINTMENT_NOT_STARTED");
    tx.update(ref, { status: "completed", completedAt: nowIso(), updatedAt: FieldValue.serverTimestamp() });
  });
  await writeAuditEvent({ actorUid: doctorUid, action: "appointment.completed", resourceType: "appointment", resourceId: id });
}

export async function cancelByDoctor(doctorUid: string, id: string, reason: string) {
  await firestore.runTransaction(async (tx) => {
    const { ref, snap } = await ownAppointment(tx, doctorUid, id);
    if (snap.get("status") !== "confirmed") throw Error("APPOINTMENT_NOT_OPEN");
    const slotRef = slotsCol().doc(snap.get("slotId"));
    const slot = await tx.get(slotRef);
    tx.update(ref, { status: "cancelled", cancelledBy: "doctor", cancelReason: reason, updatedAt: FieldValue.serverTimestamp() });
    // The doctor is not available then, so the time is withdrawn rather than reopened.
    if (slot.exists && slot.get("appointmentId") === id) tx.update(slotRef, { status: "withdrawn", appointmentId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    tx.create(outboxCol().doc(), { type: "appointment_cancelled_by_doctor", recipientUid: snap.get("patientUid"), appointmentId: id, status: "pending", createdAt: FieldValue.serverTimestamp() });
  });
  await writeAuditEvent({ actorUid: doctorUid, action: "appointment.cancelled_by_doctor", resourceType: "appointment", resourceId: id });
}

export async function writePrescription(doctorUid: string, id: string, input: z.infer<typeof prescriptionSchema>) {
  const rx = prescriptionsCol().doc(id);
  await firestore.runTransaction(async (tx) => {
    const { ref, snap } = await ownAppointment(tx, doctorUid, id);
    const status = snap.get("status");
    if (status === "cancelled") throw Error("APPOINTMENT_CANCELLED");
    if (status !== "confirmed" && status !== "completed") throw Error("APPOINTMENT_NOT_OPEN");
    if (snap.get("startsAt") > nowIso()) throw Error("APPOINTMENT_NOT_STARTED");
    if ((await tx.get(rx)).exists) throw Error("PRESCRIPTION_EXISTS");
    tx.create(rx, {
      appointmentId: id, patientUid: snap.get("patientUid"), doctorId: doctorUid,
      // Signed with the name the patient booked, not anything in the request.
      doctorName: snap.get("doctorName"), specialty: snap.get("specialty"),
      diagnosis: input.diagnosis, medicines: input.medicines, instructions: input.instructions ?? "",
      issuedAt: nowIso(), createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, { status: "completed", hasPrescription: true, ...(status === "confirmed" ? { completedAt: nowIso() } : {}), updatedAt: FieldValue.serverTimestamp() });
    tx.create(outboxCol().doc(), { type: "prescription_issued", recipientUid: snap.get("patientUid"), appointmentId: id, status: "pending", createdAt: FieldValue.serverTimestamp() });
  });
  await writeAuditEvent({ actorUid: doctorUid, action: "prescription.issued", resourceType: "prescription", resourceId: id });
}

/**
 * Mounted on /api/v1/appointments before the patient booking router. `recordsOfPatient` reads
 * the patient's health-wallet records (SQLite), supplied by the server so this module does not
 * depend on the database layer.
 */
export function consultationsRouter(deps: { recordsOfPatient: (patientUid: string) => Promise<any[]> }) {
  const r = Router();

  r.post("/:appointmentId/complete", allow("DOCTOR"), async (req, res) => {
    try {
      await completeAppointment(user(req)!.uid, req.params.appointmentId);
      res.json({ appointmentId: req.params.appointmentId, status: "completed" });
    } catch (e) { fail(res, e); }
  });

  r.post("/:appointmentId/doctor-cancel", allow("DOCTOR"), async (req, res) => {
    const p = z.object({ reason: z.string().trim().min(3).max(300) }).strict().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Give the patient a reason (3 to 300 characters)." });
    try {
      await cancelByDoctor(user(req)!.uid, req.params.appointmentId, p.data.reason);
      res.json({ appointmentId: req.params.appointmentId, status: "cancelled" });
    } catch (e) { fail(res, e); }
  });

  r.post("/:appointmentId/prescription", allow("DOCTOR"), async (req, res) => {
    const p = prescriptionSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "A diagnosis and a list of medicines (name and dosage each) are required.", details: p.error.flatten() });
    try {
      await writePrescription(user(req)!.uid, req.params.appointmentId, p.data);
      res.status(201).json({ appointmentId: req.params.appointmentId, status: "completed" });
    } catch (e) { fail(res, e); }
  });

  r.get("/:appointmentId/prescription", allow("PATIENT", "DOCTOR"), async (req, res) => {
    try {
      const u = user(req)!;
      const snap = await prescriptionsCol().doc(req.params.appointmentId).get();
      const party = snap.exists && (u.role === "PATIENT" ? snap.get("patientUid") === u.uid : snap.get("doctorId") === u.uid);
      if (!party) throw Error("PRESCRIPTION_NOT_FOUND");
      res.json({ prescription: publicPrescription(snap.id, snap.data()!) });
    } catch (e) { fail(res, e); }
  });

  r.get("/:appointmentId/records", allow("DOCTOR"), async (req, res) => {
    try {
      const uid = user(req)!.uid;
      const snap = await appointmentsCol().doc(req.params.appointmentId).get();
      if (!snap.exists || snap.get("doctorId") !== uid) throw Error("APPOINTMENT_NOT_FOUND");
      // A cancelled booking is not a clinical relationship.
      if (!["confirmed", "completed"].includes(snap.get("status"))) throw Error("APPOINTMENT_CANCELLED");
      const patientUid = String(snap.get("patientUid"));
      const records = (await deps.recordsOfPatient(patientUid)).map((x) => ({
        id: x.id, date: x.date, title: x.title, doctorName: x.doctorName, diagnoseSummary: x.diagnoseSummary,
      }));
      await writeAuditEvent({ actorUid: uid, action: "patient.records.viewed", resourceType: "patient", resourceId: patientUid });
      res.json({ records });
    } catch (e) { fail(res, e); }
  });

  return r;
}

export function prescriptionsRouter() {
  const r = Router();
  r.get("/mine", allow("PATIENT"), async (req, res) => {
    try {
      const s = await prescriptionsCol().where("patientUid", "==", user(req)!.uid).limit(200).get();
      const prescriptions = s.docs.map((d) => publicPrescription(d.id, d.data())).sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
      res.json({ prescriptions });
    } catch (e) { fail(res, e); }
  });
  return r;
}
