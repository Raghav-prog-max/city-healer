/**
 * Data-quality rules for the hospital directory: which map entries are not hospitals, and
 * where a hospital's departments come from.
 *
 * Every department carries its source, because routing trusts them differently and the UI
 * says which is which:
 *   listed    the hospital's own listing (directory, OpenStreetMap tag, government registry
 *             type, or hospital staff)                                      -> full match
 *   empanelled  the specialities a government health scheme empanelled the hospital for
 *             (CGHS / DGEHS official lists)                                 -> full match
 *   name      a specialist hospital's name ("... Eye Hospital")              -> full match
 *   standard  a department a public hospital of that type must run under the Indian Public
 *             Health Standards 2022 (MoHFW), e.g. a District Hospital        -> partial match,
 *             shown as "usually has ... - call to confirm"
 */

export type DepartmentSource = "listed" | "empanelled" | "name" | "standard";

/**
 * Names that are not hospitals for people. OpenStreetMap is volunteer-mapped and a few
 * offices, shops, labs and gates are tagged as hospitals; animal hospitals are tagged
 * correctly but must never be suggested to a patient.
 */
const NOT_A_HOSPITAL: Array<[RegExp, string]> = [
  [/veterinar|\bvet\b|\banimal\b|\bpet(s)?\b|\bcattle\b|\bgau\s?shala|pashu|\bbird\b/i, "animal hospital"],
  [/infotech|\bsoftware\b|technolog|\bsolutions\b|\bconsultan(cy|ts)\b|\bpvt\.? ltd\.?$|\bcorporate office\b|\bhead office\b|\boffice\b/i, "office"],
  [/pharmacy|chemist|medical store|medicos?\b|druggist/i, "pharmacy"],
  [/diagnostic|patholog|\blab(s|oratory)?\b|imaging|\bscan(s|ning)?\b|x-?ray|\bmri\b|\bct\b/i, "diagnostic centre"],
  [/\bgate\b|parking|\bentrance\b|\bexit\b|\bblock [a-z]\b/i, "part of a campus, not a facility"],
  [/\bschool\b|\bbank\b|\batm\b|\bhotel\b|\btemple\b|\bmandir\b|\bgurudwara\b|\bmasjid\b|\bchurch\b/i, "not a health facility"],
];

/** Why a listing should be hidden, or null if the name looks like a hospital. */
export function notAHospitalReason(name: string): string | null {
  const n = String(name || "");
  // A name that also says hospital / nursing home / medical college is kept, e.g.
  // "Sharma Diagnostic & Hospital" or "Max Super Speciality Hospital (Pvt Ltd)".
  const saysHospital = /hospital|nursing home|medical college|medical institute|aiims|maternity|clinic|health\s?care|medical cent(er|re)/i.test(n);
  for (const [re, reason] of NOT_A_HOSPITAL) {
    if (!re.test(n)) continue;
    if (reason === "animal hospital" || reason === "part of a campus, not a facility") return reason;
    if (!saysHospital) return reason;
  }
  return null;
}

/** Specialities a hospital's name makes clear (specialist hospitals). */
export const NAME_SPECIALITIES: Array<[RegExp, string]> = [
  [/\beye\b|netra|vision|ophthalm/i, "Ophthalmology"],
  [/\bheart\b|cardiac|cardio/i, "Cardiology"],
  [/cancer|onco/i, "Oncology"],
  [/\bchild(ren)?\b|\bkids?\b|paediatric|pediatric|\bshishu\b/i, "Paediatrics"],
  [/maternity|\bwomen\b|mother|gyna?ec|\bivf\b|fertility/i, "Obstetrics & Gynaecology"],
  [/dental|\bteeth\b/i, "Dentistry"],
  [/ortho|\bbone\b|\bjoint\b|\bspine\b/i, "Orthopaedics"],
  [/kidney|nephro|\buro/i, "Nephrology & Urology"],
  [/neuro|\bbrain\b/i, "Neurology"],
  [/trauma/i, "Trauma & Emergency"],
  [/psychiatr|mental|de-?addiction/i, "Psychiatry"],
  [/\bent\b/i, "ENT"],
  [/\btb\b|tuberculosis|\bchest\b/i, "Pulmonology"],
];

export function specialitiesFromName(name: string): string[] {
  return NAME_SPECIALITIES.filter(([re]) => re.test(name)).map(([, s]) => s);
}

/**
 * Government-registry facility types (NIN health facility directory) that are hospitals or
 * in-patient facilities, as opposed to sub-centres, dispensaries or PHCs.
 */
export const REGISTRY_HOSPITAL_TYPES = new Set([
  "<100 Bedded Hospital", "100-500 Bedded Hospital", ">500 Bedded Hospital", "District Hospital",
  "Sub-District Hospital", "Civil Hospital/General Hospital", "Community Health Center", "Maternity Home",
]);

/**
 * Essential specialist services by facility type, from the Indian Public Health Standards
 * 2022 (MoHFW), Volume I (Sub-District and District Hospitals). "Civil Hospital/General
 * Hospital" is the registry's name for sub-district-level public hospitals in several states.
 * Community Health Centres are not included beyond general medicine: only First Referral
 * Unit CHCs must have specialists, and the registry does not say which CHCs are FRUs.
 */
const IPHS_DH_SDH = [
  "General Medicine", "Obstetrics & Gynaecology", "Paediatrics", "Orthopaedics", "Anaesthesiology",
  "Ophthalmology", "Dentistry", "Radiology", "ENT", "Psychiatry",
];
export const STANDARD_DEPARTMENTS: Record<string, { departments: string[]; basis: string }> = {
  "District Hospital": { departments: [...IPHS_DH_SDH, "Critical Care (ICU/HDU)"], basis: "IPHS 2022 district hospital" },
  "Sub-District Hospital": { departments: IPHS_DH_SDH, basis: "IPHS 2022 sub-district hospital" },
  "Civil Hospital/General Hospital": { departments: IPHS_DH_SDH, basis: "IPHS 2022 sub-district hospital" },
  "Community Health Center": { departments: ["General Medicine"], basis: "IPHS 2022 community health centre" },
};

/** Departments a registry facility type itself states. */
export const REGISTRY_TYPE_DEPARTMENTS: Record<string, string[]> = {
  "Maternity Home": ["Obstetrics & Gynaecology"],
};

/**
 * A large or multi-speciality general hospital whose departments are not listed: worth
 * suggesting, with "call to confirm", when no listed department is near.
 */
export function isGeneralCareHospital(name: string, facilityType?: string | null): boolean {
  if (facilityType && ["100-500 Bedded Hospital", ">500 Bedded Hospital", "District Hospital", "Sub-District Hospital", "Civil Hospital/General Hospital"].includes(facilityType)) return true;
  return /multi\s?-?speciality|multi\s?-?specialty|super\s?-?speciality|super\s?-?specialty|medical college|institute of medical sciences|\baiims\b|general hospital|district hospital/i.test(name);
}

/** Below this probability of "hospital" (facility classifier), an unconfirmed listing is marked "Unconfirmed". */
export const HOSPITAL_SCORE_THRESHOLD = 0.4;

/**
 * The name itself says hospital / nursing home / medical college (English or Hindi). Such a
 * listing is taken at its word; the classifier is for names that do not say what they are.
 */
export function nameClaimsHospital(name: string): boolean {
  return /hospital|nursing home|medical college|institute of medical sciences|\baiims\b|हॉस्पिटल|अस्पताल|चिकित्सालय|नर्सिंग होम/i.test(String(name || ""));
}

/** Nothing confirms the listing, its name does not say hospital, and the classifier doubts it. */
export function isUnconfirmedListing(h: { name: string; confirmation?: string | null; hospitalScore?: number | null; listingStatus?: string | null }): boolean {
  return h.listingStatus !== "hidden" && !h.confirmation && typeof h.hospitalScore === "number"
    && h.hospitalScore < HOSPITAL_SCORE_THRESHOLD && !nameClaimsHospital(h.name);
}
