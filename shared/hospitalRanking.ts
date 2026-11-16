/**
 * Weighted multi-criteria hospital scoring and top-k selection (Milestone 4: A5), used by
 * recommendHospitals() in server.ts. Moved here unchanged so it can be unit-tested.
 *
 *   S = department match (50 listed / named / empanelled, 30 expected under IPHS, 15 large
 *       general hospital with no department list)
 *     - 40 for an unconfirmed listing
 *     + 10 if a general bed is reported free
 *     + 20 if an ICU bed is reported free and urgency is HIGH or CRITICAL
 *     + max(0, 40 - distance km)
 * Maximum 120 (MAX_HOSPITAL_SCORE). Hospital ratings are not scored: they are unverified in
 * this data. Distance is the Haversine great-circle distance, not road distance.
 *
 * topK: O(n log n) sort of n hospitals, then the first k.
 */
import { matchDepartmentWithSource } from "./specialties";
import { haversineKm, type LatLng } from "./geo";

export const MAX_HOSPITAL_SCORE = 120;

export interface ScorableHospital {
  lat: number;
  lng: number;
  specialties: string[];
  departmentSources?: Record<string, any> | null;
  generalCare?: number | boolean | null;
  unconfirmed?: boolean;
  availableBeds?: number;
  icuAvailable?: number;
  facilityType?: string | null;
  empanelment?: { scheme: string }[];
}

export interface HospitalScore {
  score: number;
  distanceKM: number;
  travelTimeMin: number;
  department: string | null;
  matchReason: string;
}

export function scoreHospital(h: ScorableHospital, specialistType: string, urgencyLevel: string, origin: LatLng): HospitalScore {
  let score = 0;
  const match = matchDepartmentWithSource(specialistType, h.specialties, h.departmentSources as any);
  const department = match?.department ?? null;
  if (match) score += match.source === "standard" ? 30 : 50;
  else if (h.generalCare) score += 15;
  if (h.unconfirmed) score -= 40;

  if ((h.availableBeds ?? 0) > 0) score += 10;
  if ((urgencyLevel === "CRITICAL" || urgencyLevel === "HIGH") && (h.icuAvailable ?? 0) > 0) score += 20;

  const distKM = haversineKm(origin, h);
  score += Math.max(0, 40 - distKM);

  // An estimate, not live traffic: straight-line distance at about 22 km/h plus 5 minutes.
  const travelTimeMin = Math.round(5 + (distKM / 22) * 60);

  const schemes = (h.empanelment || []).map((e) => e.scheme).filter((s, i, a) => a.indexOf(s) === i).join(" / ");
  const matchReason = match
    ? match.source === "standard"
      ? `Usually has ${department} (${h.facilityType || "public hospital"} standard) - call to confirm`
      : match.source === "empanelled"
        ? `${department} - empanelled under ${schemes || "CGHS / DGEHS"}`
        : `${department} department`
    : h.generalCare
      ? "Large general hospital - departments not listed, call to confirm"
      : "Nearby hospital - departments not listed";

  return { score, distanceKM: Number(distKM.toFixed(1)), travelTimeMin, department, matchReason };
}

/** The k highest-scoring items, best first. Stable for equal scores. */
export function topK<T>(items: T[], k: number, score: (t: T) => number): T[] {
  return items
    .map((item, i) => ({ item, i, s: score(item) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, Math.max(0, k))
    .map((x) => x.item);
}

/** Score as a percentage of the best possible, for "Match: 87%". */
export const scorePercent = (score: number) => Math.max(0, Math.round((score / MAX_HOSPITAL_SCORE) * 100));
