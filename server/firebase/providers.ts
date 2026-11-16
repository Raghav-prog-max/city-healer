/**
 * What the doctor and admin screens need on top of server/firebase/booking.ts (P1 item 11), so
 * provider onboarding can be run without the command line:
 *
 *   Admin    GET    /api/v1/admin/providers             applications, with what a reviewer checks
 *            POST   /api/v1/admin/providers/accounts    give an existing account the doctor role
 *   Doctor   GET    /api/v1/provider/me                 own application and its review status
 *            GET    /api/v1/provider/slots              own upcoming times, open and booked
 *            DELETE /api/v1/provider/slots/:slotId      withdraw an open time
 *
 * Applying (POST /api/v1/doctors/applications), publishing times (POST /api/v1/doctors/:id/slots),
 * the verification decision (PATCH /api/v1/doctors/:id/verification) and a doctor's bookings
 * (GET /api/v1/appointments/doctor) are in booking.ts.
 *
 * Roles stay admin-set custom claims: an account becomes a doctor only when an administrator
 * grants it here (or with scripts/set-role.ts), and only then can it apply. Nobody can give
 * themselves a role.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { z } from "zod";
import { adminAuth, firestore } from "./admin";
import type { AuthUser, Role } from "./identity";
import { writeAuditEvent } from "./patients";

const doctorsCol = () => firestore.collection("doctors");
const slotsCol = () => firestore.collection("doctorSlots");

const user = (req: Request): AuthUser | null => (req as any).user || null;

const only = (role: Role) => (req: Request, res: Response, next: NextFunction) => {
  const u = user(req);
  if (!u) return res.status(401).json({ error: "Authentication required." });
  if (u.isDemo || u.role !== role) return res.status(403).json({ error: "Insufficient permissions for this operation." });
  next();
};

const oops = (res: Response, where: string, err: unknown) => {
  console.error(`[providers] ${where}:`, err instanceof Error ? err.message : "unknown_error");
  return res.status(500).json({ error: "Unexpected server error." });
};

const STATUSES = ["pending", "verified", "rejected"] as const;

// ---------------------------------------------------------------- doctor: own profile and times

export function providerSelfRouter() {
  const r = Router();
  r.use(only("DOCTOR"));

  r.get("/me", async (req, res) => {
    try {
      const snap = await doctorsCol().doc(user(req)!.uid).get();
      if (!snap.exists) return res.json({ application: null });
      const d = snap.data()!;
      res.json({
        application: {
          fullName: d.fullName, specialty: d.specialty, qualifications: d.qualifications || [], registrationNumber: d.registrationNumber,
          city: d.city, locality: d.locality, consultationTypes: d.consultationTypes || [],
          verificationStatus: d.verificationStatus, listingStatus: d.listingStatus,
          // The reviewer's note is shown to the doctor only for a rejection, so they know what to fix.
          reviewNote: d.verificationStatus === "rejected" ? d.reviewNote || "" : "",
          reviewedAt: d.reviewedAt || null,
        },
      });
    } catch (e) { oops(res, "me", e); }
  });

  r.get("/slots", async (req, res) => {
    try {
      const s = await slotsCol().where("doctorId", "==", user(req)!.uid).limit(500).get();
      const now = new Date().toISOString();
      const slots = s.docs
        .map((x) => ({ id: x.id, startsAt: x.get("startsAt"), endsAt: x.get("endsAt"), consultationType: x.get("consultationType"), status: x.get("status") }))
        .filter((x) => x.status !== "withdrawn" && x.endsAt > now)
        .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
      res.json({ slots });
    } catch (e) { oops(res, "slots", e); }
  });

  // Withdraw a time nobody has booked. A booked time stays: the patient cancels or reschedules.
  r.delete("/slots/:slotId", async (req, res) => {
    const uid = user(req)!.uid;
    const ref = slotsCol().doc(req.params.slotId);
    try {
      const outcome = await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        // Someone else's slot answers exactly like one that does not exist.
        if (!snap.exists || snap.get("doctorId") !== uid || snap.get("status") === "withdrawn") return "missing";
        if (snap.get("status") !== "open") return "booked";
        tx.update(ref, { status: "withdrawn", updatedAt: FieldValue.serverTimestamp() });
        return "withdrawn";
      });
      if (outcome === "missing") return res.status(404).json({ error: "Time not found." });
      if (outcome === "booked") return res.status(409).json({ error: "This time is already booked, so it cannot be withdrawn.", code: "SLOT_BOOKED" });
      await writeAuditEvent({ actorUid: uid, action: "doctor.slot_withdrawn", resourceType: "doctorSlot", resourceId: ref.id });
      res.json({ slotId: ref.id, status: "withdrawn" });
    } catch (e) { oops(res, "withdraw", e); }
  });

  return r;
}

// ---------------------------------------------------------------- admin: accounts and review

const accountSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  phone: z.string().trim().max(20).optional(),
}).strict().refine((v) => !!v.email !== !!v.phone, "Give an email address or a phone number, not both.");

/** "+919876543210" from "+91 98765 43210" or a bare ten-digit Indian mobile number; null if neither. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  return null;
}

const contactOf = (u: UserRecord | undefined) => (u ? u.email || u.phoneNumber || "" : "");

export function adminProvidersRouter() {
  const r = Router();
  r.use(only("ADMIN"));

  // Applications for review. Includes the registration number and the account's sign-in
  // contact, which are never public: this route is for administrators only.
  r.get("/", async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    if (status !== "all" && !(STATUSES as readonly string[]).includes(status)) return res.status(400).json({ error: "status must be pending, verified, rejected or all." });
    try {
      const snap = status === "all" ? await doctorsCol().limit(300).get() : await doctorsCol().where("verificationStatus", "==", status).limit(300).get();
      const accounts = new Map<string, UserRecord>();
      for (let i = 0; i < snap.docs.length; i += 100) {
        const found = await adminAuth.getUsers(snap.docs.slice(i, i + 100).map((d) => ({ uid: d.id })));
        for (const u of found.users) accounts.set(u.uid, u);
      }
      const providers = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id, contact: contactOf(accounts.get(d.id)),
          fullName: x.fullName, specialty: x.specialty, qualifications: x.qualifications || [], registrationNumber: x.registrationNumber,
          city: x.city, locality: x.locality, consultationTypes: x.consultationTypes || [],
          verificationStatus: x.verificationStatus, listingStatus: x.listingStatus,
          reviewNote: x.reviewNote || "", reviewedAt: x.reviewedAt || null, updatedAt: typeof x.updatedAt === "string" ? x.updatedAt : null,
        };
      }).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      res.json({ providers });
    } catch (e) { oops(res, "list", e); }
  });

  // Give an existing account the doctor role, so it can submit an application. The account's
  // sessions are revoked: the person signs in again and the role applies at once.
  r.post("/accounts", async (req, res) => {
    const p = accountSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Give the account's email address or phone number." });
    const phone = p.data.phone ? normalisePhone(p.data.phone) : null;
    if (p.data.phone && !phone) return res.status(400).json({ error: "Enter the phone number with its country code, for example +91 98765 43210." });
    let account: UserRecord;
    try {
      account = p.data.email ? await adminAuth.getUserByEmail(p.data.email) : await adminAuth.getUserByPhoneNumber(phone!);
    } catch (e: any) {
      if (e?.code === "auth/user-not-found") return res.status(404).json({ error: "No account signs in with that email or phone number. The doctor signs up first, then you grant the role.", code: "ACCOUNT_NOT_FOUND" });
      return oops(res, "find account", e);
    }
    try {
      const claims = account.customClaims || {};
      const current = String(claims.role || "patient");
      if (current === "doctor") return res.json({ uid: account.uid, contact: contactOf(account), role: "doctor", changed: false });
      // Never turn a hospital or admin account into a doctor here: that would silently remove
      // the access it has. Those changes stay with scripts/set-role.ts.
      if (current !== "patient" && current !== "caregiver") {
        return res.status(409).json({ error: `This account already has the ${current} role, so it was not changed.`, code: "ACCOUNT_HAS_ROLE" });
      }
      if (account.disabled) return res.status(409).json({ error: "This account is disabled.", code: "ACCOUNT_DISABLED" });
      await adminAuth.setCustomUserClaims(account.uid, { ...claims, role: "doctor" });
      await adminAuth.revokeRefreshTokens(account.uid);
      await writeAuditEvent({ actorUid: user(req)!.uid, action: "user.role.set", resourceType: "user", resourceId: account.uid });
      res.status(201).json({ uid: account.uid, contact: contactOf(account), role: "doctor", changed: true });
    } catch (e) { oops(res, "grant role", e); }
  });

  return r;
}
