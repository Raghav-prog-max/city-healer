/**
 * The Asia/Kolkata calendar day of an instant, computed with a fixed +05:30 offset (India has
 * no daylight saving time). Never the host time zone and never the UTC date: a slot at 00:30 IST
 * is on the previous day in UTC, and one at 23:30 IST is 18:00 UTC on the same day.
 *
 * Pure: no Firestore, no clock. Used by server/firebase/checkin.ts and unit-tested directly.
 */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 24 * 3600_000;

const toMs = (t: string | number | Date) => (typeof t === "number" ? t : typeof t === "string" ? Date.parse(t) : t.getTime());

/** "YYYY-MM-DD" of the IST calendar day the instant falls on. */
export function istDayKey(t: string | number | Date): string {
  const ms = toMs(t);
  if (!Number.isFinite(ms)) throw Error("INVALID_TIME");
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The IST day the instant falls on, as a half-open UTC range [startIso, endIso) in the same
 * ISO format as startsAt (toISOString), so it can be compared as strings in a Firestore query.
 */
export function istDayBounds(t: string | number | Date): { day: string; startIso: string; endIso: string } {
  const day = istDayKey(t);
  const start = Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS;
  return { day, startIso: new Date(start).toISOString(), endIso: new Date(start + DAY_MS).toISOString() };
}
