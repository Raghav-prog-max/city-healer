/**
 * Same-day check-in on an existing in-person Firestore booking (step 2, "queue"). There is no
 * token, no token number, no counter document and no stored wait: the line is the doctor's
 * in-person bookings for that day in booked-time order, and only those who have checked in and
 * not yet been called count as waiting.
 *
 *   Patient  POST   /api/v1/appointments/:id/check-in     "I have arrived"          -> { state, arrivedAt, ahead }
 *   Patient  DELETE /api/v1/appointments/:id/check-in     leave the line            -> { state: "not_arrived" }
 *   Patient  GET    /api/v1/appointments/:id/queue        own place in the line     -> { state, arrivedAt, ahead }
 *   Doctor   POST   /api/v1/appointments/:id/visit-state  { state: "called" | "not_here" }
 *
 * Fields on appointments/{id}: arrivedAt (ISO, set by the patient), calledAt (ISO, set by the
 * doctor), checkInCount (integer). Nothing else is stored; derived when read:
 *   - state: not_arrived | waiting | called | done (done = status completed);
 *   - ahead: that doctor's bookings on the same Asia/Kolkata day that are in person, confirmed,
 *     checked in and not called, with an earlier startsAt (ties by document id). Booked time
 *     decides the order, so checking in early, or from home, cannot jump the line.
 * The day is computed with a fixed +05:30 offset (istDay.ts), never the host time zone. The day
 * query (doctorId ==, startsAt range) needs the composite index in firebase/firestore.indexes.json.
 *
 * Rules:
 *   - Check in: the patient's own confirmed in-person booking, on its IST day, from
 *     CHECKIN_OPENS_BEFORE_MS before startsAt until endsAt, at most CHECKIN_CAP times, while its
 *     doctor is verified. A second call while waiting returns the same arrivedAt and writes nothing.
 *   - Leave: clears the patient's own arrival while waiting; they may check in again (within the cap).
 *   - Called / not here: the booking's own doctor, verified now, booking confirmed and checked in.
 *     "not_here" clears arrivedAt and calledAt, so a false check-in stops counting against others.
 *   - Finishing is the existing POST /:id/complete (consultations.ts); there is no queue "done".
 *   - Cancel paths need no hook: every view here filters on status confirmed.
 *   - Admin, hospital and the demo account: 403. Anyone else's booking, or an unknown id: 404.
 *
 * Responses hold a count and the caller's own state only, never another patient's name, uid,
 * time or id. Audit events hold ids only.
 */
import { Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "./admin";
import type { AuthUser, Role } from "./identity";
import { writeAuditEvent } from "./patients";
import { istDayBounds, istDayKey } from "./istDay";

/** Check-in opens this long before the booked start and closes at the booked end. */
export const CHECKIN_OPENS_BEFORE_MS = 60 * 60_000;
/** Check-ins per booking: bounds the check in / "not here" loop. */
export const CHECKIN_CAP = 3;

const doctorsCol = () => firestore.collection("doctors");
const appointmentsCol = () => firestore.collection("appointments");

const user = (req: Request): AuthUser | null => (req as any).user || null;

const allow = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Authentication required." });
  if (u.isDemo || !roles.includes(u.role)) return res.status(403).json({ error: "Insufficient permissions for this operation." });
  next();
};

const KNOWN: Record<string, [number, string]> = {
  APPOINTMENT_NOT_FOUND: [404, "Appointment not found."],
  APPOINTMENT_NOT_OPEN: [409, "This appointment is not confirmed, so there is no line to join for it."],
  DOCTOR_NOT_VERIFIED: [403, "Your profile is not verified at the moment, so this is unavailable."],
  DOCTOR_NOT_AVAILABLE: [409, "This doctor is not available on City Healer at the moment, so you cannot check in here. Please contact the clinic."],
  CHECKIN_NOT_IN_PERSON: [409, "This is an online appointment, so there is no check-in."],
  CHECKIN_NOT_OPEN: [409, "You can check in on the day of your appointment, from one hour before it starts until it ends."],
  CHECKIN_LIMIT: [409, "You have checked in for this appointment too many times. Please speak to the clinic."],
  NOT_CHECKED_IN: [409, "This patient has not checked in."],
  NOT_WAITING: [409, "The doctor has already called you in."],
};

const fail = (res: Response, err: unknown) => {
  const code = err instanceof Error ? err.message : "";
  if (KNOWN[code]) return res.status(KNOWN[code][0]).json({ error: KNOWN[code][1], code });
  console.error("[checkin]", err instanceof Error ? err.message : "unknown_error");
  return res.status(500).json({ error: "Unexpected server error." });
};

const nowIso = () => new Date().toISOString();

export type QueueState = "not_arrived" | "waiting" | "called" | "done";

type Snap = FirebaseFirestore.DocumentSnapshot;

export function stateOf(snap: Snap): QueueState {
  if (snap.get("status") === "completed") return "done";
  if (snap.get("calledAt")) return "called";
  if (snap.get("arrivedAt")) return "waiting";
  return "not_arrived";
}

/** Is this booking waiting in its doctor's line? */
const isWaiting = (d: Snap) =>
  d.get("status") === "confirmed" && d.get("consultationType") === "in_person" && !!d.get("arrivedAt") && !d.get("calledAt");

/** Whether `now` is inside the check-in window of a booking: its IST day, 60 min before start .. end. */
export function checkInOpen(startsAt: string, endsAt: string, now = Date.now()): boolean {
  const start = Date.parse(startsAt), end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return istDayKey(now) === istDayKey(start) && start - CHECKIN_OPENS_BEFORE_MS <= now && now <= end;
}

/**
 * How many of the same doctor's patients are waiting before this booking on its IST day.
 * One query on (doctorId ==, startsAt in [day start, own startsAt]); everything else in memory.
 */
async function aheadOf(snap: Snap): Promise<number> {
  const startsAt = String(snap.get("startsAt"));
  const { startIso } = istDayBounds(startsAt);
  const s = await appointmentsCol()
    .where("doctorId", "==", snap.get("doctorId"))
    .where("startsAt", ">=", startIso)
    .where("startsAt", "<=", startsAt)
    .orderBy("startsAt")
    .limit(500)
    .get();
  return s.docs.filter((d) => d.id !== snap.id && isWaiting(d) && (d.get("startsAt") < startsAt || (d.get("startsAt") === startsAt && d.id < snap.id))).length;
}

/** The caller's own view of their place: never anyone else's data. */
async function ownView(snap: Snap) {
  const state = stateOf(snap);
  return { state, arrivedAt: state === "not_arrived" ? null : (snap.get("arrivedAt") ?? null), ahead: state === "waiting" ? await aheadOf(snap) : 0 };
}

const ownBooking = (snap: Snap, u: AuthUser) => snap.exists && snap.get("patientUid") === u.uid;

/** A booking whose line the patient can see: their own, in person, confirmed or completed. */
function checkLine(snap: Snap, u: AuthUser) {
  if (!ownBooking(snap, u)) throw Error("APPOINTMENT_NOT_FOUND");
  const status = snap.get("status");
  if (status !== "confirmed" && status !== "completed") throw Error("APPOINTMENT_NOT_OPEN");
  if (snap.get("consultationType") !== "in_person") throw Error("CHECKIN_NOT_IN_PERSON");
}

export async function checkIn(u: AuthUser, id: string) {
  const ref = appointmentsCol().doc(id);
  const changed = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!ownBooking(snap, u)) throw Error("APPOINTMENT_NOT_FOUND");
    if (snap.get("status") !== "confirmed") throw Error("APPOINTMENT_NOT_OPEN");
    if (snap.get("consultationType") !== "in_person") throw Error("CHECKIN_NOT_IN_PERSON");
    const doctor = await tx.get(doctorsCol().doc(String(snap.get("doctorId"))));
    if (!(doctor.exists && doctor.get("verificationStatus") === "verified")) throw Error("DOCTOR_NOT_AVAILABLE");
    // Already in the line, or already called in: nothing to do.
    if (snap.get("arrivedAt")) return false;
    if (!checkInOpen(String(snap.get("startsAt")), String(snap.get("endsAt")))) throw Error("CHECKIN_NOT_OPEN");
    const count = Number(snap.get("checkInCount") || 0);
    if (count >= CHECKIN_CAP) throw Error("CHECKIN_LIMIT");
    tx.update(ref, { arrivedAt: nowIso(), calledAt: FieldValue.delete(), checkInCount: count + 1, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (changed) await writeAuditEvent({ actorUid: u.uid, action: "appointment.checked_in", resourceType: "appointment", resourceId: id });
  return ownView(await ref.get());
}

export async function leaveLine(u: AuthUser, id: string) {
  const ref = appointmentsCol().doc(id);
  const changed = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!ownBooking(snap, u)) throw Error("APPOINTMENT_NOT_FOUND");
    if (snap.get("status") !== "confirmed") throw Error("APPOINTMENT_NOT_OPEN");
    if (snap.get("consultationType") !== "in_person") throw Error("CHECKIN_NOT_IN_PERSON");
    if (!snap.get("arrivedAt")) return false;
    if (snap.get("calledAt")) throw Error("NOT_WAITING");
    tx.update(ref, { arrivedAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (changed) await writeAuditEvent({ actorUid: u.uid, action: "appointment.check_in_left", resourceType: "appointment", resourceId: id });
  return { state: "not_arrived" as const };
}

export const visitStateSchema = z.object({ state: z.enum(["called", "not_here"]) }).strict();

export async function setVisitState(doctorUid: string, id: string, next: "called" | "not_here") {
  const ref = appointmentsCol().doc(id);
  const changed = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("doctorId") !== doctorUid) throw Error("APPOINTMENT_NOT_FOUND");
    const doctor = await tx.get(doctorsCol().doc(doctorUid));
    if (!(doctor.exists && doctor.get("verificationStatus") === "verified")) throw Error("DOCTOR_NOT_VERIFIED");
    if (snap.get("status") !== "confirmed") throw Error("APPOINTMENT_NOT_OPEN");
    if (!snap.get("arrivedAt")) throw Error("NOT_CHECKED_IN");
    if (next === "called") {
      if (snap.get("calledAt")) return false; // repeating the current state
      tx.update(ref, { calledAt: nowIso(), updatedAt: FieldValue.serverTimestamp() });
      return true;
    }
    tx.update(ref, { arrivedAt: FieldValue.delete(), calledAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (changed) {
    await writeAuditEvent({ actorUid: doctorUid, action: next === "called" ? "appointment.called" : "appointment.arrival_cleared", resourceType: "appointment", resourceId: id });
  }
  return { appointmentId: id, state: next === "called" ? "called" as const : "not_arrived" as const };
}

const noBody = (req: Request) => z.object({}).strict().safeParse(req.body ?? {}).success;

/**
 * Mounted on /api/v1/appointments before appointmentsRouter (whose patient-only r.use would
 * answer a doctor 403). `pollLimit` limits GET /queue (server.ts: per booking, under a per-uid ceiling).
 */
export function checkinRouter(deps: { pollLimit: RequestHandler | RequestHandler[] }) {
  const r = Router();

  r.post("/:appointmentId/check-in", allow("PATIENT"), async (req, res) => {
    if (!noBody(req)) return res.status(400).json({ error: "This request takes no body." });
    try {
      res.json(await checkIn(user(req)!, req.params.appointmentId));
    } catch (e) { fail(res, e); }
  });

  r.delete("/:appointmentId/check-in", allow("PATIENT"), async (req, res) => {
    if (!noBody(req)) return res.status(400).json({ error: "This request takes no body." });
    try {
      res.json(await leaveLine(user(req)!, req.params.appointmentId));
    } catch (e) { fail(res, e); }
  });

  r.get("/:appointmentId/queue", allow("PATIENT"), deps.pollLimit, async (req, res) => {
    try {
      const snap = await appointmentsCol().doc(req.params.appointmentId).get();
      checkLine(snap, user(req)!);
      res.json(await ownView(snap));
    } catch (e) { fail(res, e); }
  });

  r.post("/:appointmentId/visit-state", allow("DOCTOR"), async (req, res) => {
    const p = visitStateSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "state must be \"called\" or \"not_here\"." });
    try {
      res.json(await setVisitState(user(req)!.uid, req.params.appointmentId, p.data.state));
    } catch (e) { fail(res, e); }
  });

  return r;
}
