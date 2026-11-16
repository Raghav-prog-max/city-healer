/**
 * Check and enrich the hospital directory after `npm run import-hospitals`.
 *
 *   python scripts/fetch-nin-facilities.py         government facility registry (Delhi NCR)
 *   npm run enrich-hospitals -- --dry-run          what would change
 *   npm run enrich-hospitals
 *
 * For every hospital:
 *  1. Screening: OpenStreetMap entries whose names show they are not hospitals for people
 *     (offices, pharmacies, labs, campus gates, animal hospitals) are hidden, with the reason.
 *     Seeded hospitals (which doctors are attached to) are never hidden automatically.
 *  2. Registry match: the nearest facility of a hospital type in the NIN health-facility
 *     registry, by distance and name similarity. A match marks the listing "in government
 *     registry", records the facility type, and fills a missing phone number.
 *  3. Departments, each with where it is known from (shared/hospitalData.ts):
 *       listed    directory / OpenStreetMap tag / registry type (e.g. Maternity Home)
 *       name      a specialist hospital's name
 *       standard  essential services for the registry facility type under IPHS 2022
 *  3b. Empanelment: hospitals in the official CGHS / DGEHS empanelled lists
 *      (python scripts/parse-empanelment.py) get the specialities they are empanelled for
 *      (source "empanelled"), the scheme, and NABH status as listed. Branches of a chain must
 *      also match on PIN code or locality, so one branch's specialities never land on another.
 *  4. General care: large or multi-speciality hospitals without listed departments.
 *  5. Facility classifier (ml/train_facility.py): the probability that the name is a
 *     hospital's and what it most looks like. A listing nothing confirms (not in the registry,
 *     not empanelled, not reviewed) that scores below HOSPITAL_SCORE_THRESHOLD is shown as
 *     "Unconfirmed", ranked lower, and listed by `npm run review-hospitals -- --unconfirmed`
 *     (with --csv: openstreetmap.org links to correct the map itself).
 *
 * Hidden listings stay in the database (with hiddenReason) so they can be reviewed and
 * restored: npm run review-hospitals.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dbAll, dbRun, sqliteDb, initializeDatabase } from "../database";
import { haversineKm } from "../shared/geo";
import {
  notAHospitalReason, specialitiesFromName, REGISTRY_HOSPITAL_TYPES, STANDARD_DEPARTMENTS,
  REGISTRY_TYPE_DEPARTMENTS, isGeneralCareHospital, type DepartmentSource,
} from "../shared/hospitalData";
import { predictFacility, confirmationOf, nameClaimsHospital, HOSPITAL_SCORE_THRESHOLD } from "../shared/facilityModel";

const REGISTRY = path.resolve("data/raw/nin/nin_ncr_facilities.json");
const EMPANELMENT = path.resolve("data/processed/empanelment.json");

// Street words and city names say nothing about which locality an address is in.
const ADDRESS_STOP = new Set(["road", "marg", "new", "delhi", "near", "opp", "opposite", "plot", "sector", "block", "main", "nagar", "colony", "phase", "pocket", "floor", "ground", "india", "haryana", "uttar", "pradesh", "the", "and", "no",
  "bagh", "vihar", "park", "enclave", "extension", "extn", "market", "metro", "station", "institutional", "area", "empanelled",
  "noida", "greater", "ghaziabad", "faridabad", "gurugram", "gurgaon", "old",
  // Sub-cities large enough to hold several same-name hospitals: their sector numbers decide.
  "rohini", "dwarka", "janakpuri", "vasundhara", "indirapuram", "vaishali", "pitampura", "shalimar"]);
const addressTokens = (s: string) => {
  const text = String(s || "").toLowerCase();
  const words = text.replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !ADDRESS_STOP.has(w));
  // "Sector-12", "Sec 12", "Sect. 12A" -> "sector12": the most specific part of an NCR address.
  const sectors = [...text.matchAll(/\bsec(?:tor|t)?\.?\s*-?\s*(\d{1,3}[a-z]?)\b/g)].map((m) => `sector${m[1]}`);
  return new Set([...words, ...sectors]);
};
const pincode = (s: string) => (String(s || "").match(/\b1[12]\d{4}\b|\b20\d{4}\b/) || [])[0] || null;
/** Words that say nothing about which hospital it is. */
const GENERIC = new Set(["hospital", "hospitals", "the", "and", "pvt", "ltd", "limited", "private", "nursing", "home", "centre", "center",
  "medical", "health", "care", "healthcare", "delhi", "new", "super", "speciality", "specialty", "superspeciality", "superspecialty",
  "multi", "multispeciality", "multispecialty", "institute", "research", "unit", "general", "clinic", "memorial", "trust", "charitable",
  "society", "foundation", "india", "best", "maternity", "eye", "heart", "cancer", "children", "womens", "women"]);
/** Distinctive name words; "(A unit of ...)" and similar asides removed first. */
const nameWords = (s: string) => new Set(String(s || "").replace(/\([^)]*(\)|$)/g, " ").replace(/\/\d+\b/g, " ").toLowerCase()
  .replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !GENERIC.has(w)));
function nameJaccard(a: string, b: string) {
  const A = nameWords(a), B = nameWords(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / (A.size + B.size - n);
}
/** City of an address in the lists, from its PIN code or its wording. */
function cityOf(address: string): string | null {
  const a = String(address || "");
  if (/greater\s*noida/i.test(a)) return "Greater Noida";
  const pin = pincode(a);
  if (pin) {
    if (pin.startsWith("110")) return "Delhi";
    if (pin.startsWith("1220")) return "Gurugram";
    if (pin.startsWith("1210")) return "Faridabad";
    if (pin.startsWith("2010")) return "Ghaziabad";
    if (/^2013(0[6-9]|1\d)$/.test(pin)) return "Greater Noida";
    if (pin.startsWith("2013")) return "Noida";
    return "outside NCR";
  }
  if (/greater\s*noida/i.test(a)) return "Greater Noida";
  if (/noida/i.test(a)) return "Noida";
  if (/gurgaon|gurugram/i.test(a)) return "Gurugram";
  if (/ghaziabad|vaishali|kaushambi|indirapuram/i.test(a)) return "Ghaziabad";
  if (/faridabad/i.test(a)) return "Faridabad";
  if (/delhi/i.test(a)) return "Delhi";
  return null;
}
/** An OpenStreetMap row without a street address ("Kotwali, Delhi") says little about place. */
/** A house or plot number ("RZ-13", "A-364") makes an address specific even with few words. */
const sparseAddress = (address: string) => addressTokens(address).size <= 1 && !/\d/.test(String(address || "").replace(/\b\d{6}\b/g, ""));
/** Both addresses name a sector and none agree: different places ("Sector 128" vs "Sector 19"). */
function sectorsConflict(a: string, b: string) {
  const A = [...addressTokens(a)].filter((t) => /^sector\d/.test(t)), B = [...addressTokens(b)].filter((t) => /^sector\d/.test(t));
  return A.length > 0 && B.length > 0 && !A.some((t) => B.includes(t));
}

function addressOverlap(a: string, b: string) {
  const A = addressTokens(a), B = addressTokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

const tokens = (s: string) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
  .filter((w) => w.length > 2 && !["hospital", "the", "and", "pvt", "ltd", "nursing", "home", "centre", "center", "medical", "health", "care", "delhi", "new"].includes(w)));
function similarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await initializeDatabase();
  if (!existsSync(REGISTRY)) {
    console.error(`${REGISTRY} not found. Run: python scripts/fetch-nin-facilities.py`);
    process.exit(1);
  }
  const registry = (JSON.parse(readFileSync(REGISTRY, "utf8")) as any[])
    .filter((r) => REGISTRY_HOSPITAL_TYPES.has(r.facility_type) && Number(r.lat) && Number(r.lon))
    .map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lon) }));

  const hospitals = await dbAll("SELECT * FROM hospitals");

  // Empanelled hospitals (and eye centres) matched to directory rows, before the per-row pass.
  const empanelledFor = new Map<string, any[]>();
  let empanelSkipped = 0;
  if (existsSync(EMPANELMENT)) {
    const listed = (JSON.parse(readFileSync(EMPANELMENT, "utf8")).facilities as any[]).filter((e) => (e.kind === "hospital" || e.kind === "eye centre") && !e.inactive);
    const EYE = /eye|netra|vision|sight|retina|lasik|ophthalm/i;
    for (const e of listed) {
      // Same city, distinctive name words in common, and the address agreeing, unless our
      // address is too sparse to compare (then only an unambiguous, strong name match counts).
      const city = cityOf(e.address);
      if (city === "outside NCR") { empanelSkipped++; continue; }
      const candidates = hospitals
        .filter((h) => !city || !h.city || h.city === city)
        // An eye centre is only ever the same place as an eye hospital.
        .filter((h) => e.kind !== "eye centre" || EYE.test(h.name))
        .map((h) => {
          const pin = pincode(e.address) && pincode(e.address) === pincode(h.address);
          return { h, sim: nameJaccard(h.name, e.name), evidence: pin ? 1 : addressOverlap(e.address, h.address), sparse: sparseAddress(h.address) };
        })
        .filter((c) => c.sim >= 0.34 && !sectorsConflict(e.address, c.h.address));
      const supported = candidates.filter((c) => c.evidence >= 0.25 && (c.sim >= 0.5 || c.evidence >= 0.5))
        .sort((a, b) => b.evidence + b.sim - (a.evidence + a.sim));
      let pick = supported[0];
      if (!pick) {
        // Name alone, only when it is unambiguous on both sides: one such hospital here, and one
        // such entry in the lists for this city (several would be branches of a chain).
        const strong = candidates.filter((c) => c.sim >= 0.8 && c.sparse);
        const branchesListed = listed.filter((o) => o.scheme === e.scheme && cityOf(o.address) === city && nameJaccard(o.name, e.name) >= 0.5).length;
        if (strong.length === 1 && candidates.filter((c) => c.sim >= 0.5).length === 1 && branchesListed === 1) pick = strong[0];
      }
      if (!pick) { empanelSkipped++; continue; }
      if (process.argv.includes("--show-matches")) console.log(`  ${e.scheme.padEnd(5)} ${e.name}  [${String(e.address).slice(0, 40)}]  ->  ${pick.h.name}  [${String(pick.h.address).slice(0, 40)}]  sim=${pick.sim.toFixed(2)} ev=${pick.evidence.toFixed(2)}${pick.sparse ? " sparse" : ""}`);
      const list = empanelledFor.get(pick.h.id) || [];
      list.push(e);
      empanelledFor.set(pick.h.id, list);
    }
  }
  const used = new Set<number>();
  const stats = { hidden: 0, registry: 0, phones: 0, standard: 0, general: 0, withDepartments: 0, empanelled: 0, nabh: 0, unconfirmed: 0 };
  const unconfirmedSamples: string[] = [];
  const hiddenSamples: string[] = [];

  for (const h of hospitals) {
    const specialties: string[] = h.specialties ? JSON.parse(h.specialties) : [];
    const sources: Record<string, DepartmentSource> = {};

    // 1. Screening (OpenStreetMap rows only; never re-hide what an administrator restored).
    let listingStatus = h.listingStatus || "active";
    let hiddenReason = h.hiddenReason || null;
    const reason = h.source === "osm" ? notAHospitalReason(h.name) : null;
    if (reason && listingStatus !== "active-reviewed") {
      listingStatus = "hidden";
      hiddenReason = `Name suggests: ${reason}`;
      stats.hidden++;
      if (hiddenSamples.length < 25) hiddenSamples.push(`${h.name}  (${reason})`);
    }

    // 2. Registry match: within 300 m and similar names, or within 80 m and somewhat similar.
    let best: any = null, bestScore = 0;
    registry.forEach((r, i) => {
      if (used.has(i)) return;
      const d = haversineKm(h, r);
      if (d > 0.3) return;
      const sim = similarity(h.name, r.health_facility_name);
      if (sim >= 0.5 || (d < 0.08 && sim >= 0.34)) {
        const score = sim - d;
        if (score > bestScore) { bestScore = score; best = { r, i }; }
      }
    });
    let facilityType: string | null = h.facilityType || null;
    let registryId: string | null = h.registryId || null;
    let phone: string | null = h.phone || null;
    if (best) {
      used.add(best.i);
      registryId = String(best.r.objectid);
      facilityType = best.r.facility_type;
      stats.registry++;
      if (!phone && best.r.landline_number) { phone = String(best.r.landline_number).trim(); stats.phones++; }
    }

    // 3. Departments with their sources.
    const fromName = new Set(specialitiesFromName(h.name));
    // Keep each department's earlier source: re-running must not turn "standard" into "listed".
    const previous: Record<string, DepartmentSource> = h.departmentSources ? JSON.parse(h.departmentSources) : {};
    for (const s of specialties) sources[s] = fromName.has(s) ? "name" : previous[s] || "listed";
    for (const s of fromName) { if (!specialties.includes(s)) specialties.push(s); sources[s] = "name"; }
    for (const s of REGISTRY_TYPE_DEPARTMENTS[facilityType || ""] || []) {
      if (!specialties.includes(s)) specialties.push(s);
      sources[s] = "listed";
    }
    const standard = STANDARD_DEPARTMENTS[facilityType || ""];
    if (standard) {
      stats.standard++;
      for (const s of standard.departments) {
        if (!specialties.includes(s)) { specialties.push(s); sources[s] = "standard"; }
      }
    }


    // 3b. Empanelled specialities (official scheme lists).
    const schemes = empanelledFor.get(h.id) || [];
    let nabh = 0, multiSpeciality = false;
    for (const e of schemes) {
      const depts = e.kind === "eye centre" ? ["Ophthalmology"] : e.departments;
      for (const d of depts) {
        if (!specialties.includes(d)) specialties.push(d);
        if (sources[d] !== "listed" && sources[d] !== "name") sources[d] = "empanelled";
      }
      if (e.nabhAccredited) nabh = 1;
      if (e.multiSpeciality) multiSpeciality = true;
    }
    if (schemes.length) stats.empanelled++;
    if (specialties.length) stats.withDepartments++;
    if (nabh) stats.nabh++;
    const empanelment = schemes.map((e) => ({ scheme: e.scheme, listDate: e.sourceDate, validity: e.validity || null, nabh: !!e.nabhAccredited }));

    // 4. General care.
    const generalCare = isGeneralCareHospital(h.name, facilityType) || multiSpeciality ? 1 : 0;
    if (generalCare && !specialties.length) stats.general++;

    // 5. Facility classifier and what confirms the listing.
    const facility = predictFacility(h.name);
    const confirmation = confirmationOf({ registryId, empanelled: schemes.length > 0, listingStatus, source: h.source });
    const unconfirmed = listingStatus !== "hidden" && !confirmation && !nameClaimsHospital(h.name) && facility.hospitalScore < HOSPITAL_SCORE_THRESHOLD;
    if (unconfirmed) {
      stats.unconfirmed++;
      if (unconfirmedSamples.length < 25) unconfirmedSamples.push(`${h.name}  (looks like: ${facility.label}, hospital ${facility.hospitalScore.toFixed(2)})`);
    }

    if (!dryRun) {
      await dbRun(
        `UPDATE hospitals SET listingStatus = ?, hiddenReason = ?, registryId = ?, facilityType = ?, phone = ?,
           specialties = ?, departmentSources = ?, generalCare = ?, empanelment = ?, nabhAccredited = ?,
           hospitalScore = ?, likelyKind = ?, confirmation = ? WHERE id = ?`,
        [listingStatus, hiddenReason, registryId, facilityType, phone, JSON.stringify(specialties), JSON.stringify(sources), generalCare,
         empanelment.length ? JSON.stringify(empanelment) : null, nabh,
         Math.round(facility.hospitalScore * 1000) / 1000, facility.label, confirmation, h.id]);
    }
  }

  console.log(`Hospitals checked: ${hospitals.length}. Registry hospital-type facilities: ${registry.length}.`);
  console.log(`${dryRun ? "Would hide" : "Hidden"}: ${stats.hidden}`);
  for (const s of hiddenSamples) console.log(`   - ${s}`);
  console.log(`In government registry: ${stats.registry} (phone numbers added: ${stats.phones}); with IPHS standard departments: ${stats.standard}`);
  console.log(`With at least one department: ${stats.withDepartments}; large general hospitals without listed departments: ${stats.general}`);
  console.log(`Empanelled (CGHS / DGEHS) matched: ${stats.empanelled} hospitals (NABH as listed: ${stats.nabh}); list entries not matched to a directory hospital: ${empanelSkipped}`);
  console.log(`Unconfirmed (nothing confirms it, classifier says probably not a hospital): ${stats.unconfirmed}`);
  for (const s of unconfirmedSamples) console.log(`   - ${s}`);
}

main()
  .catch((err) => { console.error(err?.message || err); process.exitCode = 1; })
  .finally(() => sqliteDb.close());
