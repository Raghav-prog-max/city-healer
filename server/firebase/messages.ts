/**
 * Messages about one Firestore appointment, between its patient and its doctor (step 2, "chat").
 * Asynchronous: nobody is told a message arrived, there is no presence, and nothing is ever
 * written in the doctor's voice. No AI reply: the assistant is never called from here.
 *
 *   Patient, Doctor  GET  /api/v1/appointments/:id/messages?after=<seq>   the thread (never writes)
 *   Patient, Doctor  POST /api/v1/appointments/:id/messages               { text } -> 201
 *   Patient, Doctor  POST /api/v1/appointments/:id/messages/read          mark the thread read
 *
 * Storage (server-only, firebase/firestore.rules denies clients):
 *   appointments/{id}/messages/{autoId}  { seq, sender, authorUid, kind, text, createdAt }
 *   appointments/{id}.chat               { count, lastSeq, lastSender, lastAt, patientReadSeq,
 *                                          doctorReadSeq, doctorReadAt, urgentAt, urgentAckAt }
 * Messages are immutable: no route edits or deletes one. A thread holds at most THREAD_CAP.
 *
 * Who may do what:
 *   - Only the two parties; anyone else, and an unknown id, gets the same 404.
 *   - A patient reads their own thread in any status, any time (the global consent gate applies).
 *   - A doctor reads, posts and marks read only: on their own booking -> while verified now ->
 *     not cancelled -> inside the window -> while the patient's consent, read fresh, is valid.
 *   - Posting, both sides: confirmed or completed, inside the window.
 *   - The window is the records window of consultations.ts: from RECORDS_OPEN_BEFORE_MS before
 *     startsAt until RECORDS_OPEN_AFTER_MS after endsAt.
 *
 * Safety: every patient message (never a doctor's) is run through the deterministic red-flag
 * rules (triageWithoutAI, shared/triage.ts). When they fire, the same transaction stores a fixed
 * notice from "system" telling the patient to call 112, that the doctor was not alerted and has
 * not seen it. Nothing else happens: no SOS, no notification.
 *
 * Audit events hold ids only, never message text, names or the emergency category.
 */
import { Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "./admin";
import type { AuthUser, Role } from "./identity";
import { writeAuditEvent } from "./patients";
import { readConsentStatus } from "./consent";
import { RECORDS_OPEN_BEFORE_MS, RECORDS_OPEN_AFTER_MS } from "./consultations";
import { triageWithoutAI, type Lang } from "../../shared/triage";

export const THREAD_CAP = 200;

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
  APPOINTMENT_CANCELLED: [409, "This appointment was cancelled, so no messages can be sent about it."],
  DOCTOR_NOT_VERIFIED: [403, "Your profile is not verified at the moment, so this is unavailable."],
  PATIENT_CONSENT_REQUIRED: [409, "The patient has not consented to their information being used, so their messages cannot be shown."],
  CHAT_NOT_OPEN_YET: [409, "You can message about this appointment from one day before it."],
  CHAT_CLOSED: [409, "Messaging for this appointment has closed. Book a follow-up, or call 112 in an emergency."],
  THREAD_FULL: [409, "This conversation has reached its limit of 200 messages. Book a follow-up to continue."],
};

const fail = (res: Response, err: unknown) => {
  const code = err instanceof Error ? err.message : "";
  if (KNOWN[code]) return res.status(KNOWN[code][0]).json({ error: KNOWN[code][1], code });
  console.error("[messages]", err instanceof Error ? err.message : "unknown_error");
  return res.status(500).json({ error: "Unexpected server error." });
};

const nowIso = () => new Date().toISOString();

type Sender = "patient" | "doctor" | "system";
type Kind = "message" | "emergency_notice" | "self_harm_notice";

interface ChatSummary {
  count?: number; lastSeq?: number; lastSender?: Sender; lastAt?: string;
  patientReadSeq?: number; doctorReadSeq?: number; doctorReadAt?: string; urgentAt?: string; urgentAckAt?: string;
}

const chatOf = (snap: FirebaseFirestore.DocumentSnapshot): ChatSummary => (snap.get("chat") as ChatSummary) || {};

/** A red flag the doctor has not opened the thread since. */
export const isUrgent = (c: ChatSummary) => !!c.urgentAt && (!c.urgentAckAt || c.urgentAckAt < c.urgentAt);
/** The doctor's list: the patient wrote last and the doctor has not read it. */
export const doctorUnread = (c: ChatSummary) => c.lastSender === "patient" && (c.lastSeq || 0) > (c.doctorReadSeq || 0);
/** The patient's list: the doctor wrote last and the patient has not read it. */
export const patientUnread = (c: ChatSummary) => c.lastSender === "doctor" && (c.lastSeq || 0) > (c.patientReadSeq || 0);

// ---------------------------------------------------------------------------------------------
// What the patient is told when a message trips the red-flag rules. Fixed text, written at the
// time of the message: it states what is true then (the doctor has not seen it, nobody was
// alerted). The self-harm notice reuses the existing helpline wording from shared/triage.ts;
// no crisis wording is invented here.
//
// HINDI (hi) WORDING BELOW NEEDS REVIEW BY A FLUENT SPEAKER BEFORE RELEASE. It was written by
// the developer, not by a reviewed translator.
// ---------------------------------------------------------------------------------------------
const NOTICE: Record<Lang, { prefix: string; emergency: string; suffix: string; stop: string }> = {
  en: {
    prefix: "City Healer automatic message, not from your doctor.",
    emergency: "What you wrote may be an emergency. Call 112 now or use Emergency SOS. Do not wait for a reply here.",
    suffix: "Your doctor has not been alerted and has not seen your message.",
    stop: ".",
  },
  hi: {
    // needs fluent review
    prefix: "City Healer का स्वचालित संदेश, आपके डॉक्टर की ओर से नहीं।",
    // needs fluent review
    emergency: "आपने जो लिखा वह आपातकाल हो सकता है। अभी 112 पर कॉल करें या आपातकालीन SOS का उपयोग करें। यहाँ जवाब का इंतज़ार न करें।",
    // needs fluent review
    suffix: "आपके डॉक्टर को सूचित नहीं किया गया है और उन्होंने आपका संदेश नहीं देखा है।",
    stop: "।",
  },
};

const endSentence = (s: string, stop: string) => (/[.!?।]$/.test(s.trim()) ? s.trim() : `${s.trim()}${stop}`);

/** The system notice for a patient's message, or null when the rules do not flag it. */
export function safetyNoticeFor(text: string): { kind: Exclude<Kind, "message">; text: string } | null {
  const rules = triageWithoutAI(text);
  if (!rules.flagUrgentSOS) return null;
  const n = NOTICE[rules.lang] || NOTICE.en;
  if (rules.emergencyCategory === "self_harm") {
    const helpline = [rules.explanation, rules.recommendations[0] || ""].filter(Boolean).map((s) => endSentence(s, n.stop)).join(" ");
    return { kind: "self_harm_notice", text: `${n.prefix} ${helpline} ${n.suffix}` };
  }
  return { kind: "emergency_notice", text: `${n.prefix} ${n.emergency} ${n.suffix}` };
}

// ---------------------------------------------------------------------------------------------

const windowOf = (snap: FirebaseFirestore.DocumentSnapshot) => {
  const opens = Date.parse(snap.get("startsAt")) - RECORDS_OPEN_BEFORE_MS;
  const closes = Date.parse(snap.get("endsAt")) + RECORDS_OPEN_AFTER_MS;
  return { opens, closes, opensAt: new Date(opens).toISOString(), closesAt: new Date(closes).toISOString() };
};

/** Why nobody can post now, as an error code, or null when posting is open. */
function postBlock(snap: FirebaseFirestore.DocumentSnapshot, now = Date.now()): string | null {
  const status = snap.get("status");
  if (status === "cancelled") return "APPOINTMENT_CANCELLED";
  if (status !== "confirmed" && status !== "completed") return "APPOINTMENT_CANCELLED";
  const { opens, closes } = windowOf(snap);
  if (!(now >= opens)) return "CHAT_NOT_OPEN_YET";
  if (!(now <= closes)) return "CHAT_CLOSED";
  return null;
}

const isParty = (snap: FirebaseFirestore.DocumentSnapshot, u: AuthUser) =>
  snap.exists && (u.role === "PATIENT" ? snap.get("patientUid") === u.uid : u.role === "DOCTOR" ? snap.get("doctorId") === u.uid : false);

/**
 * The doctor's chain after the party check: verified now -> not cancelled -> window -> the
 * patient's consent, read fresh (a failed read throws: 500, never a pass). `getDoctor` reads the
 * doctor profile, inside a transaction when there is one.
 */
async function doctorMayAccess(snap: FirebaseFirestore.DocumentSnapshot, uid: string, getDoctor: () => Promise<FirebaseFirestore.DocumentSnapshot>) {
  const d = await getDoctor();
  if (!(d.exists && d.get("verificationStatus") === "verified")) throw Error("DOCTOR_NOT_VERIFIED");
  if (!["confirmed", "completed"].includes(snap.get("status"))) throw Error("APPOINTMENT_CANCELLED");
  const now = Date.now(), { opens, closes } = windowOf(snap);
  if (!(now >= opens)) throw Error("CHAT_NOT_OPEN_YET");
  if (!(now <= closes)) throw Error("CHAT_CLOSED");
  if ((await readConsentStatus(String(snap.get("patientUid")))) !== "valid") throw Error("PATIENT_CONSENT_REQUIRED");
}

/** Read the booking and apply the access chain for reading (GET and /read). */
async function readableBooking(tx: FirebaseFirestore.Transaction | null, u: AuthUser, id: string) {
  const ref = appointmentsCol().doc(id);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!isParty(snap, u)) throw Error("APPOINTMENT_NOT_FOUND");
  if (u.role === "DOCTOR") {
    const dref = doctorsCol().doc(u.uid);
    await doctorMayAccess(snap, u.uid, () => (tx ? tx.get(dref) : dref.get()));
  }
  return { ref, snap };
}

/** The sentence that replaces the composer when nobody can post. */
function closedSentence(code: string, u: AuthUser, snap: FirebaseFirestore.DocumentSnapshot) {
  const doctorName = String(snap.get("doctorName") || "").trim();
  if (code === "CHAT_NOT_OPEN_YET" && u.role === "PATIENT" && doctorName) return `You can message ${doctorName} from one day before your appointment.`;
  return KNOWN[code][1];
}

const publicMessage = (id: string, d: FirebaseFirestore.DocumentData) => ({
  id, seq: d.seq, sender: d.sender, kind: d.kind, text: d.text, createdAt: d.createdAt,
});

export const messageBodySchema = z.object({ text: z.string().trim().min(1).max(2000) }).strict();

export async function postMessage(u: AuthUser, id: string, text: string) {
  const sender: Sender = u.role === "DOCTOR" ? "doctor" : "patient";
  // Only patients' messages are checked, and before the transaction: the rules are pure.
  const notice = sender === "patient" ? safetyNoticeFor(text) : null;
  const ref = appointmentsCol().doc(id);
  const msgs = ref.collection("messages");
  const out = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!isParty(snap, u)) throw Error("APPOINTMENT_NOT_FOUND");
    if (sender === "doctor") {
      await doctorMayAccess(snap, u.uid, () => tx.get(doctorsCol().doc(u.uid)));
    }
    const blocked = postBlock(snap);
    if (blocked) throw Error(blocked);
    const chat = chatOf(snap);
    const count = chat.count || 0, lastSeq = chat.lastSeq || 0;
    if (count >= THREAD_CAP) throw Error("THREAD_FULL");
    const at = nowIso();
    const own = { seq: lastSeq + 1, sender, authorUid: u.uid, kind: "message" as Kind, text, createdAt: at };
    const ownRef = msgs.doc();
    tx.create(ownRef, own);
    const written = [publicMessage(ownRef.id, own)];
    if (notice) {
      const sys = { seq: lastSeq + 2, sender: "system" as Sender, authorUid: null, kind: notice.kind as Kind, text: notice.text, createdAt: at };
      const sysRef = msgs.doc();
      tx.create(sysRef, sys);
      written.push(publicMessage(sysRef.id, sys));
    }
    const n = written.length;
    tx.update(ref, {
      "chat.count": count + n,
      "chat.lastSeq": lastSeq + n,
      // The author of the post, even when a notice was added after it: the doctor's "unread"
      // is about what the patient wrote.
      "chat.lastSender": sender,
      "chat.lastAt": at,
      ...(notice ? { "chat.urgentAt": at } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return written;
  }, { maxAttempts: 15 });
  await writeAuditEvent({ actorUid: u.uid, action: "appointment.message.sent", resourceType: "appointment", resourceId: id });
  if (notice) await writeAuditEvent({ actorUid: u.uid, action: "appointment.message.red_flag", resourceType: "appointment", resourceId: id });
  return { messages: out, ...(notice ? { safety: { level: "emergency" as const, kind: notice.kind } } : {}) };
}

export async function markRead(u: AuthUser, id: string) {
  await firestore.runTransaction(async (tx) => {
    const { ref, snap } = await readableBooking(tx, u, id);
    const chat = chatOf(snap);
    const lastSeq = chat.lastSeq || 0;
    if (u.role === "PATIENT") {
      if ((chat.patientReadSeq || 0) >= lastSeq) return;
      tx.update(ref, { "chat.patientReadSeq": lastSeq });
      return;
    }
    const urgentOpen = isUrgent(chat);
    if ((chat.doctorReadSeq || 0) >= lastSeq && !urgentOpen) return;
    const at = nowIso();
    tx.update(ref, {
      "chat.doctorReadSeq": lastSeq,
      "chat.doctorReadAt": at,
      ...(chat.urgentAt ? { "chat.urgentAckAt": at } : {}),
    });
  }, { maxAttempts: 15 });
}

/**
 * Mounted on /api/v1/appointments after consultationsRouter and before appointmentsRouter
 * (whose patient-only r.use would answer a doctor 403). `postLimit` and `pollLimit` are
 * per-uid limiters from rateLimit.ts.
 */
export function messagesRouter(deps: { postLimit: RequestHandler; pollLimit: RequestHandler }) {
  const r = Router();

  r.get("/:appointmentId/messages", allow("PATIENT", "DOCTOR"), deps.pollLimit, async (req, res) => {
    const rawAfter = req.query.after;
    const after = rawAfter === undefined ? 0 : typeof rawAfter === "string" && /^\d{1,9}$/.test(rawAfter) ? Number(rawAfter) : NaN;
    if (!Number.isInteger(after)) return res.status(400).json({ error: "after must be a message number (0 or more)." });
    try {
      const u = user(req)!, id = req.params.appointmentId;
      const { ref, snap } = await readableBooking(null, u, id);
      const chat = chatOf(snap);
      const lastSeq = chat.lastSeq || 0;
      let messages: ReturnType<typeof publicMessage>[] = [];
      if (lastSeq > after) {
        const s = await ref.collection("messages").orderBy("seq").startAfter(after).limit(THREAD_CAP).get();
        messages = s.docs.map((d) => publicMessage(d.id, d.data()));
      }
      if (u.role === "DOCTOR" && messages.length) {
        await writeAuditEvent({ actorUid: u.uid, action: "appointment.messages.viewed", resourceType: "appointment", resourceId: id });
      }
      const blocked = postBlock(snap);
      const { opensAt, closesAt } = windowOf(snap);
      res.json({
        messages,
        chat: {
          lastSeq,
          doctorReadSeq: chat.doctorReadSeq || 0,
          doctorReadAt: chat.doctorReadAt || null,
          patientReadSeq: chat.patientReadSeq || 0,
          urgent: isUrgent(chat),
          urgentAcked: !!chat.urgentAt && !isUrgent(chat),
        },
        canPost: !blocked,
        ...(blocked ? { closedCode: blocked, closedReason: closedSentence(blocked, u, snap) } : {}),
        opensAt, closesAt,
      });
    } catch (e) { fail(res, e); }
  });

  r.post("/:appointmentId/messages/read", allow("PATIENT", "DOCTOR"), async (req, res) => {
    if (!z.object({}).strict().safeParse(req.body ?? {}).success) return res.status(400).json({ error: "This request takes no body." });
    try {
      await markRead(user(req)!, req.params.appointmentId);
      res.json({ appointmentId: req.params.appointmentId, read: true });
    } catch (e) { fail(res, e); }
  });

  r.post("/:appointmentId/messages", allow("PATIENT", "DOCTOR"), deps.postLimit, async (req, res) => {
    const p = messageBodySchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Write a message of 1 to 2000 characters." });
    try {
      res.status(201).json(await postMessage(user(req)!, req.params.appointmentId, p.data.text));
    } catch (e) { fail(res, e); }
  });

  return r;
}
