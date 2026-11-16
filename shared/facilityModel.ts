/**
 * Facility-name classifier (ml/train_facility.py): from a name alone, is the place a hospital,
 * a clinic / doctor's practice, a pharmacy, a dentist or a laboratory?
 *
 * TF-IDF + logistic regression trained on OpenStreetMap India names outside Delhi NCR (the
 * mappers' own tags) plus the official NIN registry and CGHS / DGEHS lists. Used offline by
 * scripts/enrich-hospitals.ts to score directory listings; not loaded by the browser.
 */
import model from "./facility-model.json";
import { createTextClassifier, type TextModelJson, type TextPrediction } from "./textClassifier";

export type FacilityKind = "hospital" | "clinic" | "pharmacy" | "dentist" | "laboratory";

const classify = createTextClassifier(model as TextModelJson);

export { HOSPITAL_SCORE_THRESHOLD, nameClaimsHospital } from "./hospitalData";

export function predictFacility(name: string): TextPrediction & { label: FacilityKind; hospitalScore: number } {
  const p = classify(name);
  const hospitalScore = p.top.find((t) => t.label === "hospital")?.confidence ?? 0;
  return { ...p, label: p.label as FacilityKind, hospitalScore };
}

/**
 * What confirms that a listing is a hospital, strongest first; null if nothing does.
 *   registry    the government health facility registry (NIN) lists a hospital-type facility there
 *   empanelled  a CGHS / DGEHS empanelled list names it
 *   reviewed    an administrator restored it after review
 *   seed        one of the hand-checked starter hospitals
 */
export function confirmationOf(h: { registryId?: string | null; empanelled?: boolean; listingStatus?: string | null; source?: string | null }): string | null {
  if (h.registryId) return "registry";
  if (h.empanelled) return "empanelled";
  if (h.listingStatus === "active-reviewed") return "reviewed";
  if (h.source === "seed") return "seed";
  return null;
}
