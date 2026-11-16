/**
 * OPD waiting-time estimate (Milestone 4: A7).
 *
 * Pure function, no I/O, shared by the server and the browser. The per-patient time comes
 * from the best evidence available, in this order:
 *   1. recent consultation durations for this doctor (median, robust to one long case);
 *   2. the booking slot length;
 *   3. a default of 12 minutes.
 * estimate = patientsAhead * perPatient + fixedOverheadMin + doctorDelayMin
 *
 * With no history and no slot length the point estimate equals the original formula
 * 12q + 10, so POST /api/queue/take returns exactly what it did before.
 *
 * Time O(r log r) for r recent durations (the median sort); O(1) otherwise. Space O(r).
 *
 * API (for the same-day check-in feature):
 *   estimateOpdWait({ patientsAhead: 3, recentConsultMinutes: [8, 10, 14, 9], doctorDelayMin: 15 })
 *   -> { minutes, low, high, perPatientMin, basis, confidence, note }
 */

export interface WaitInput {
  /** Patients in the queue before this one. Negative or non-numbers count as 0. */
  patientsAhead: number;
  /** Recent consultation lengths in minutes for this doctor (most useful when 5 or more). */
  recentConsultMinutes?: number[];
  /** Booking slot length in minutes, used when there is no history. */
  slotMinutes?: number;
  /** How late the doctor is running now, in minutes (0 if on time or unknown). */
  doctorDelayMin?: number;
  /** Check-in, vitals and walking time before the consultation. Default 10. */
  fixedOverheadMin?: number;
}

export interface WaitEstimate {
  minutes: number;
  low: number;
  high: number;
  perPatientMin: number;
  basis: "recent-consultations" | "slot-length" | "default";
  confidence: "high" | "medium" | "low";
  note: string;
}

export const DEFAULT_MINUTES_PER_PATIENT = 12;
export const DEFAULT_OVERHEAD_MIN = 10;
const MIN_HISTORY_FOR_HIGH = 5;

const clean = (xs: number[] | undefined) => (xs || []).map(Number).filter((x) => Number.isFinite(x) && x > 0 && x <= 240);

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function estimateOpdWait(input: WaitInput): WaitEstimate {
  const q = Math.max(0, Math.floor(Number(input.patientsAhead) || 0));
  const delay = Math.max(0, Number(input.doctorDelayMin) || 0);
  const overhead = Math.max(0, input.fixedOverheadMin ?? DEFAULT_OVERHEAD_MIN);
  const history = clean(input.recentConsultMinutes).sort((a, b) => a - b);
  const slot = Number(input.slotMinutes);

  let per: number, perLow: number, perHigh: number;
  let basis: WaitEstimate["basis"], confidence: WaitEstimate["confidence"];
  if (history.length) {
    per = quantile(history, 0.5);
    perLow = quantile(history, 0.25);
    perHigh = quantile(history, 0.75);
    basis = "recent-consultations";
    confidence = history.length >= MIN_HISTORY_FOR_HIGH ? "high" : "medium";
  } else if (Number.isFinite(slot) && slot > 0) {
    per = slot; perLow = slot * 0.8; perHigh = slot * 1.3;
    basis = "slot-length"; confidence = "medium";
  } else {
    per = DEFAULT_MINUTES_PER_PATIENT; perLow = per * 0.6; perHigh = per * 1.5;
    basis = "default"; confidence = "low";
  }

  const minutes = Math.round(q * per + overhead + delay);
  const low = Math.round(q * perLow + overhead + delay);
  const high = Math.round(q * perHigh + overhead + delay);
  const note = basis === "recent-consultations"
    ? `Based on this doctor's last ${history.length} consultation${history.length === 1 ? "" : "s"}${confidence === "medium" ? " (few, so a rough guide)" : ""}.`
    : basis === "slot-length"
      ? "Based on the booking slot length; real consultations vary."
      : `No timing data for this doctor: assumes ${DEFAULT_MINUTES_PER_PATIENT} minutes per patient. A rough guide only.`;
  return { minutes, low: Math.min(low, minutes), high: Math.max(high, minutes), perPatientMin: Number(per.toFixed(1)), basis, confidence, note: delay ? `${note} Includes ${Math.round(delay)} min the doctor is running late.` : note };
}
