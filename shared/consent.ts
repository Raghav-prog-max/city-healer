/**
 * Consent versions and rules, shared by the server (which enforces them) and the app (which
 * records them during onboarding). Bump a version when the terms or privacy notice change: every
 * patient is then asked again, because an older acceptance no longer counts.
 */
export const TERMS_VERSION = "2026-11-15";
export const PRIVACY_VERSION = "2026-11-15";

/**
 * valid       latest event is an acceptance of the current terms and privacy versions
 * missing     no consent recorded
 * withdrawn   latest event is a withdrawal
 * outdated    latest acceptance is for an older terms or privacy version
 * expired     latest acceptance is older than CONSENT_MAX_AGE_DAYS (only when that is set)
 * invalid     latest record is malformed (e.g. termsAccepted not true)
 */
export type ConsentStatus = "valid" | "missing" | "withdrawn" | "outdated" | "expired" | "invalid";

export interface ConsentEvent {
  action?: "grant" | "withdraw";
  termsAccepted?: unknown;
  termsVersion?: unknown;
  privacyVersion?: unknown;
  /** Milliseconds since the epoch. */
  recordedAtMs: number | null;
}

/**
 * Decide the status from a patient's consent events. Pure: the server reads the events, this
 * decides. Only mandatory service consent (terms + privacy) counts; marketing opt-in never does.
 */
export function consentStatusOf(events: ConsentEvent[], opts: { now?: number; maxAgeDays?: number | null } = {}): ConsentStatus {
  if (!events.length) return "missing";
  // Latest first; an event without a server timestamp yet (just written) counts as newest.
  const latest = [...events].sort((a, b) => (b.recordedAtMs ?? Infinity) - (a.recordedAtMs ?? Infinity))[0];
  if (latest.action === "withdraw") return "withdrawn";
  if (latest.action !== undefined && latest.action !== "grant") return "invalid";
  if (latest.termsAccepted !== true || typeof latest.termsVersion !== "string" || typeof latest.privacyVersion !== "string") return "invalid";
  if (latest.termsVersion !== TERMS_VERSION || latest.privacyVersion !== PRIVACY_VERSION) return "outdated";
  if (opts.maxAgeDays && latest.recordedAtMs != null && (opts.now ?? Date.now()) - latest.recordedAtMs > opts.maxAgeDays * 86_400_000) return "expired";
  return "valid";
}
