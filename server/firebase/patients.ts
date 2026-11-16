/**
 * Patient account routes, profile and consent storage in Cloud Firestore, and audit events.
 * Adapted from City_Healer_Backend_Auth_Foundation.zip: src/routes/me.ts, src/schemas/patient.ts
 * and src/services/audit.ts, with the same schemas, collections and audit rules.
 *
 *   GET  /api/v1/me            identity from the verified token + own profile
 *   PUT  /api/v1/me/profile    create / update own profile (strict schema)
 *   POST /api/v1/me/consents   append-only consent event (terms + privacy versions)
 *   POST /api/v1/me/consents/withdraw   append-only withdrawal event; patient routes then refuse
 *                              (server/firebase/consent.ts) until consent is given again
 *
 * Collections: patientProfiles/{uid}, patientConsents/{id}, auditLogs/{id}. No diagnosis,
 * prescriptions, lab values, clinical notes or files are stored in these collections.
 * (Prescriptions for Firestore bookings have their own collection: consultations.ts.)
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "./admin";
import type { AuthUser } from "./identity";
import { readConsentStatus, forgetConsent } from "./consent";
import { TERMS_VERSION, PRIVACY_VERSION } from "../../shared/consent";

export const ncrCities = ["Delhi", "Gurugram", "Noida", "Greater Noida", "Ghaziabad", "Faridabad"] as const;

export const patientProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  city: z.enum(ncrCities),
  locality: z.string().trim().max(120).optional(),
  preferredLanguage: z.enum(["en", "hi"]).default("en"),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["female", "male", "other", "prefer_not_to_say"]).optional(),
}).strict();

/** For partial updates from settings screens: same rules, every field optional. */
export const patientProfileUpdateSchema = patientProfileSchema.partial().strict();

export const consentSchema = z.object({
  termsAccepted: z.literal(true),
  termsVersion: z.string().min(1).max(30),
  privacyVersion: z.string().min(1).max(30),
  marketingOptIn: z.boolean().default(false),
}).strict();

export type PatientProfile = z.infer<typeof patientProfileSchema> & { uid: string };

export async function writeAuditEvent(input: { actorUid: string; action: string; resourceType: string; resourceId: string }) {
  await firestore.collection("auditLogs").add({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
    // Never store access tokens, OTPs, health payloads or raw request bodies here.
  });
}

export async function getPatientProfile(uid: string): Promise<PatientProfile | null> {
  const snap = await firestore.collection("patientProfiles").doc(uid).get();
  return snap.exists ? (snap.data() as PatientProfile) : null;
}

/** Create or merge a profile; `data` must already be validated. */
export async function savePatientProfile(uid: string, data: Record<string, unknown>, actorUid = uid) {
  const ref = firestore.collection("patientProfiles").doc(uid);
  const existing = await ref.get();
  await ref.set({
    ...data,
    uid,
    updatedAt: FieldValue.serverTimestamp(),
    ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  }, { merge: true });
  await writeAuditEvent({ actorUid, action: "patient.profile.upsert", resourceType: "patientProfile", resourceId: uid });
}

/** Firestore timestamps become ISO strings for JSON clients. */
function plain(profile: any) {
  if (!profile) return null;
  const out: any = { ...profile };
  for (const k of ["createdAt", "updatedAt"]) if (out[k]?.toDate) out[k] = out[k].toDate().toISOString();
  return out;
}

const caller = (req: Request) => (req as any).user as AuthUser | undefined;

/** Patient and caregiver accounts only (the zip's requireRoles("patient", "caregiver")). */
function patientsOnly(req: Request, res: Response, next: NextFunction) {
  const user = caller(req);
  if (!user) return res.status(401).json({ error: "UNAUTHENTICATED", message: "Sign in is required." });
  if (user.role !== "PATIENT") return res.status(403).json({ error: "FORBIDDEN", message: "You do not have permission to perform this action." });
  next();
}

export function patientRouter() {
  const router = Router();
  router.use(patientsOnly);

  router.get("/", async (req, res, next) => {
    try {
      const user = caller(req)!;
      if (user.isDemo) {
        return res.json({ uid: user.uid, phoneNumber: null, email: null, role: "patient", profile: null, demo: true });
      }
      res.json({
        uid: user.uid,
        phoneNumber: user.phone ?? null,
        email: user.email || null,
        role: user.claimRole || "patient",
        profile: plain(await getPatientProfile(user.uid)),
        // Mandatory service consent only; marketing opt-in is separate and never required.
        consent: { status: await readConsentStatus(user.uid), termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION },
      });
    } catch (err) { next(err); }
  });

  router.put("/profile", async (req, res, next) => {
    try {
      const user = caller(req)!;
      if (user.isDemo) return res.status(403).json({ error: "DEMO", message: "The demo sandbox has no profile to save." });
      const existing = await getPatientProfile(user.uid);
      // A first save needs the required fields; later saves may change just one.
      const parsed = (existing ? patientProfileUpdateSchema : patientProfileSchema).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Some profile details are not valid.", details: parsed.error.flatten() });
      }
      await savePatientProfile(user.uid, parsed.data);
      res.json({ ok: true, profile: plain(await getPatientProfile(user.uid)) });
    } catch (err) { next(err); }
  });

  router.post("/consents", async (req, res, next) => {
    try {
      const user = caller(req)!;
      if (user.isDemo) return res.status(403).json({ error: "DEMO", message: "The demo sandbox cannot record consent." });
      const parsed = consentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "The required terms must be accepted.", details: parsed.error.flatten() });
      }
      // Only the current versions can be accepted: an old screen cannot record stale terms.
      if (parsed.data.termsVersion !== TERMS_VERSION || parsed.data.privacyVersion !== PRIVACY_VERSION) {
        return res.status(409).json({ error: "CONSENT_VERSION_MISMATCH", message: "The terms have been updated. Please reload and review them.", termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
      }
      const consentRef = firestore.collection("patientConsents").doc();
      await consentRef.create({ uid: user.uid, action: "grant", ...parsed.data, recordedAt: FieldValue.serverTimestamp(), source: "patient_web" });
      await writeAuditEvent({ actorUid: user.uid, action: "patient.consent.record", resourceType: "patientConsent", resourceId: consentRef.id });
      forgetConsent(user.uid);
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  });

  router.post("/consents/withdraw", async (req, res, next) => {
    try {
      const user = caller(req)!;
      if (user.isDemo) return res.status(403).json({ error: "DEMO", message: "The demo sandbox cannot record consent." });
      const consentRef = firestore.collection("patientConsents").doc();
      await consentRef.create({ uid: user.uid, action: "withdraw", recordedAt: FieldValue.serverTimestamp(), source: "patient_web" });
      await writeAuditEvent({ actorUid: user.uid, action: "patient.consent.withdraw", resourceType: "patientConsent", resourceId: consentRef.id });
      forgetConsent(user.uid);
      res.status(201).json({ ok: true, consentStatus: "withdrawn" });
    } catch (err) { next(err); }
  });

  // The zip's error handler: no stack traces, Firebase internals, tokens or personal data.
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("api_error", err instanceof Error ? err.message : "unknown_error");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Something went wrong. Please try again." });
  });
  return router;
}

/** Profile in the shape the older screens expect from /api/users/:uid. */
export function legacyUserShape(user: AuthUser | { uid: string; email?: string; phone?: string; role: string }, profile: PatientProfile | null) {
  const dob = profile?.dateOfBirth ? new Date(profile.dateOfBirth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / 31557600000) : null;
  return {
    uid: user.uid,
    name: profile?.fullName || "",
    email: user.email || "",
    phone: (user as any).phone || "",
    role: user.role,
    age,
    gender: profile?.gender || null,
    city: profile?.city || null,
    locality: profile?.locality || null,
    preferredLanguage: profile?.preferredLanguage || null,
    dateOfBirth: profile?.dateOfBirth || null,
    hasProfile: !!profile,
  };
}
