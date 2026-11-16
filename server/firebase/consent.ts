/**
 * Server-side consent enforcement (P0.2). Patients must hold a valid, current consent before any
 * API call that processes their personal or health data. The app's onboarding gate is only a
 * convenience; this is the control.
 *
 * Default-deny: every /api route needs consent for a patient unless it is listed in
 * CONSENT_EXEMPT below. Fails closed: if consent cannot be checked, the request is refused (503).
 * Staff accounts (doctor, hospital, admin) work under their organisation's terms and are not
 * gated here; the DEMO_MODE sandbox identity holds no real data and is not gated either
 * (DEMO_MODE is refused in production, see server/config/validateEnv.ts).
 *
 * Consent records (patientConsents) are append-only events: an acceptance or a withdrawal, each
 * with versions, a server timestamp and an audit-log entry. Nothing here ever creates one on a
 * patient's behalf.
 */
import type { Request, Response, NextFunction } from "express";
import { firestore } from "./admin";
import type { AuthUser } from "./identity";
import { consentStatusOf, type ConsentEvent, type ConsentStatus } from "../../shared/consent";

/** Patient routes that work without consent, and why. Everything else under /api needs it. */
export const CONSENT_EXEMPT: Array<{ method: string; pattern: RegExp; why: string }> = [
  { method: "*", pattern: /^\/api\/v1\/me(\/.*)?$/, why: "account, profile and consent itself (onboarding)" },
  { method: "POST", pattern: /^\/api\/emergency\/sos$/, why: "medical emergency: never blocked" },
  { method: "GET", pattern: /^\/api\/health$/, why: "service status, no personal data" },
  { method: "GET", pattern: /^\/api\/(ai|v1)\/models$/, why: "model cards, no personal data" },
  { method: "GET", pattern: /^\/api\/v1\/platform\/modules$/, why: "module inventory, no personal data" },
  { method: "GET", pattern: /^\/api\/(hospitals|doctors|medicines)$/, why: "public directory browsing" },
  { method: "GET", pattern: /^\/api\/v1\/doctors(\/[A-Za-z0-9_-]{1,128}(\/slots)?)?$/, why: "public directory browsing" },
];

const isExempt = (method: string, path: string) =>
  CONSENT_EXEMPT.some((e) => (e.method === "*" || e.method === method) && e.pattern.test(path));

const maxAgeDays = Number(process.env.CONSENT_MAX_AGE_DAYS) || null;

/** Read a patient's consent events and decide. Throws if Firestore cannot be read. */
export async function readConsentStatus(uid: string): Promise<ConsentStatus> {
  const snap = await firestore.collection("patientConsents").where("uid", "==", uid).get();
  const events: ConsentEvent[] = snap.docs.map((d) => {
    const x = d.data();
    return { action: x.action, termsAccepted: x.termsAccepted, termsVersion: x.termsVersion, privacyVersion: x.privacyVersion, recordedAtMs: x.recordedAt?.toMillis?.() ?? null };
  });
  return consentStatusOf(events, { maxAgeDays });
}

// A short per-process cache, so most requests do not read Firestore. Recording or withdrawing
// consent clears the entry at once in this process. With several server processes, another
// process may honour a withdrawal up to CACHE_MS later.
const CACHE_MS = 30_000;
const cache = new Map<string, { status: ConsentStatus; at: number }>();
export const forgetConsent = (uid: string) => cache.delete(uid);

export function requireConsent(check: (uid: string) => Promise<ConsentStatus> = readConsentStatus) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthUser | undefined;
    if (!req.path.startsWith("/api/") || !user || user.role !== "PATIENT" || user.isDemo || isExempt(req.method, req.path)) return next();
    try {
      const hit = cache.get(user.uid);
      let status = hit && Date.now() - hit.at < CACHE_MS ? hit.status : null;
      if (!status) {
        status = await check(user.uid);
        cache.set(user.uid, { status, at: Date.now() });
      }
      if (status === "valid") return next();
      return res.status(403).json({ error: "CONSENT_REQUIRED", consentStatus: status, message: "Please review and accept the current terms and privacy notice to continue." });
    } catch (err) {
      // Fail closed: never let a request through because the check itself failed.
      console.error("[consent] check failed:", err instanceof Error ? err.message : "unknown_error");
      return res.status(503).json({ error: "CONSENT_CHECK_UNAVAILABLE", message: "We could not confirm your consent right now. Please try again." });
    }
  };
}
