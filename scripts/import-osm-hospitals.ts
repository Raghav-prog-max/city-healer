/**
 * Import Delhi NCR hospitals from the OpenStreetMap health-facilities export (HDX, ODbL).
 *
 *   python scripts/fetch-osm-hospitals.py          download data/raw/osm/health_facilities.geojson
 *   npm run import-hospitals -- --dry-run          what would change
 *   npm run import-hospitals                       write to the database (DB_PATH)
 *
 * Keeps: facilities tagged amenity=hospital or healthcare=hospital, with a name, in Delhi's
 * districts, Gurgaon, Faridabad, Ghaziabad and Gautam Buddha Nagar (Noida, Greater Noida).
 *
 * Each hospital gets what OSM actually has: name, coordinates (a polygon's centroid), address,
 * district-derived city, government / private, and specialities from the OSM
 * `healthcare:speciality` tag or unambiguous words in the name ("Eye Hospital" ->
 * Ophthalmology). Nothing is invented: no bed or ICU counts (they stay "not reported" until
 * hospital staff report them), no phone numbers, no ratings.
 *
 * Hospitals already in the database (the 52 seeded ones, which doctors are attached to) are
 * matched by name within 400 m and keep their id; they gain the OSM id and city. Re-running
 * updates rows by OSM id instead of duplicating them.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dbAll, dbGet, dbRun, sqliteDb, initializeDatabase } from "../database";
import { haversineKm } from "../shared/geo";

const FILE = path.resolve("data/raw/osm/health_facilities.geojson");
const NCR_DISTRICTS: Record<string, string> = { Gurgaon: "Gurugram", Gurugram: "Gurugram", Faridabad: "Faridabad", Ghaziabad: "Ghaziabad", "Gautam Buddha Nagar": "Noida" };

const SPECIALITY_WORDS: Array<[RegExp, string]> = [
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
  [/psychiatr|mental|de-?addiction|rehab/i, "Psychiatry"],
  [/\bent\b/i, "ENT"],
  [/\btb\b|tuberculosis|chest/i, "Pulmonology"],
];

const titleCase = (s: string) => s.replace(/_/g, " ").trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["hospital", "the", "and", "best", "delhi", "new", "super", "speciality", "specialty", "multispeciality", "multi", "centre", "center", "institute", "research", "medical"].includes(w)));
const similar = (a: string, b: string) => {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
};

function centroid(geom: any): { lat: number; lng: number } | null {
  if (geom.type === "Point") return { lng: geom.coordinates[0], lat: geom.coordinates[1] };
  const pts: number[][] = [];
  const walk = (x: any) => (typeof x[0] === "number" ? pts.push(x) : x.forEach(walk));
  walk(geom.coordinates);
  if (!pts.length) return null;
  return { lng: pts.reduce((a, p) => a + p[0], 0) / pts.length, lat: pts.reduce((a, p) => a + p[1], 0) / pts.length };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!existsSync(FILE)) {
    console.error(`${FILE} not found. Run: python scripts/fetch-osm-hospitals.py`);
    process.exit(1);
  }
  await initializeDatabase(); // schema and migrations (idempotent), as the server runs them
  const features = JSON.parse(readFileSync(FILE, "utf8")).features as any[];

  // 1. Delhi NCR hospitals with a name.
  const picked: any[] = [];
  for (const f of features) {
    const p = f.properties || {};
    if (p.amenity !== "hospital" && p.healthcare !== "hospital") continue;
    const name = String(p.name || p.name_en || "").trim();
    if (!name) continue;
    let city = p.adm1_name === "Delhi" ? "Delhi" : NCR_DISTRICTS[p.adm2_name];
    if (!city) continue;
    const addr = String(p.addr_full || "").replace(/\s+/g, " ").replace(/[,\s]+$/, "").trim();
    if (city === "Noida" && /greater\s*noida/i.test(`${name} ${addr} ${p.addr_city || ""}`)) city = "Greater Noida";
    const pos = centroid(f.geometry);
    if (!pos) continue;
    const specialties = new Set<string>();
    for (const s of String(p.healthcare_speciality || "").split(";")) if (s.trim() && !/^\d+$/.test(s.trim())) specialties.add(titleCase(s));
    for (const [re, spec] of SPECIALITY_WORDS) if (re.test(name)) specialties.add(spec);
    const op = String(p.operator_type || "").toLowerCase();
    const government = op === "government" || op === "public";
    picked.push({
      osmId: String(p.id || f.id),
      name,
      city,
      address: addr ? (new RegExp(city.replace(" ", "\\s*"), "i").test(addr) ? addr : `${addr}, ${city}`) : [p.adm3_name, city].filter(Boolean).join(", "),
      lat: Number(pos.lat.toFixed(6)),
      lng: Number(pos.lng.toFixed(6)),
      specialties: [...specialties],
      categories: government ? ["Government"] : op.startsWith("private") ? ["Private"] : [],
      isGovernment: government ? 1 : 0,
    });
  }

  // 2. The same hospital mapped twice (a point and a building outline): keep one.
  const unique: any[] = [];
  for (const h of picked) {
    const dupe = unique.find((u) => haversineKm(u, h) < 0.2 && similar(u.name, h.name) >= 0.6);
    if (dupe) { for (const s of h.specialties) if (!dupe.specialties.includes(s)) dupe.specialties.push(s); continue; }
    unique.push(h);
  }

  // 3. Match the hospitals already in the database.
  const existing = await dbAll("SELECT id, name, lat, lng, osmId, specialties FROM hospitals");
  let matched = 0, updated = 0, inserted = 0;
  const matchedOsm = new Set<string>();
  for (const e of existing) {
    if (e.osmId) continue;
    const m = unique.find((u) => !matchedOsm.has(u.osmId) && haversineKm(u, e) < 0.4 && similar(u.name, e.name) >= 0.5);
    if (!m) continue;
    matchedOsm.add(m.osmId);
    matched++;
    console.log(`  match  ${e.name}  <->  ${m.name}`);
    if (!dryRun) await dbRun("UPDATE hospitals SET osmId = ?, city = ? WHERE id = ?", [m.osmId, m.city, e.id]);
  }

  // 4. Insert or update the rest by OSM id.
  for (const h of unique) {
    if (matchedOsm.has(h.osmId)) continue;
    const row = await dbGet("SELECT id FROM hospitals WHERE osmId = ?", [h.osmId]);
    if (row) {
      updated++;
      if (!dryRun) await dbRun(
        "UPDATE hospitals SET name = ?, address = ?, lat = ?, lng = ?, city = ?, specialties = ?, categories = ?, isGovernment = ? WHERE id = ?",
        [h.name, h.address, h.lat, h.lng, h.city, JSON.stringify(h.specialties), JSON.stringify(h.categories), h.isGovernment, row.id]);
      continue;
    }
    inserted++;
    if (!dryRun) await dbRun(`
      INSERT INTO hospitals (id, name, address, totalBeds, availableBeds, icuBeds, icuAvailable, emergencyOccupancy,
        lat, lng, phone, rating, specialties, categories, hasAmbulanceSupport, ambulanceSupportCount, isGovernment,
        hasTelemedicine, hasOpdBooking, email, doctorsAvailableCount, osmId, source, city)
      VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL, NULL, ?, ?, 0, 0, ?, 0, 0, NULL, 0, ?, 'osm', ?)`,
      [`osm-${h.osmId.replace("/", "-")}`, h.name, h.address, h.lat, h.lng, JSON.stringify(h.specialties), JSON.stringify(h.categories), h.isGovernment, h.osmId, h.city]);
  }

  // 5. Every hospital gets a city (the seeded ones from their address).
  if (!dryRun) {
    const rows = await dbAll("SELECT id, address FROM hospitals WHERE city IS NULL");
    for (const r of rows) {
      const a = String(r.address || "");
      const city = /greater noida/i.test(a) ? "Greater Noida" : /noida/i.test(a) ? "Noida" : /gurugram|gurgaon/i.test(a) ? "Gurugram"
        : /ghaziabad/i.test(a) ? "Ghaziabad" : /faridabad/i.test(a) ? "Faridabad" : /delhi/i.test(a) ? "Delhi" : null;
      if (city) await dbRun("UPDATE hospitals SET city = ? WHERE id = ?", [city, r.id]);
    }
  }

  const byCity: Record<string, number> = {};
  for (const h of unique) byCity[h.city] = (byCity[h.city] || 0) + 1;
  console.log(`\nOSM hospitals in Delhi NCR: ${picked.length} (${unique.length} after merging duplicates) ${JSON.stringify(byCity)}`);
  console.log(`with a speciality: ${unique.filter((h) => h.specialties.length).length}, government: ${unique.filter((h) => h.isGovernment).length}`);
  console.log(`${dryRun ? "Would" : "Did"}: match ${matched} existing, update ${updated}, insert ${inserted}.`);
  if (!dryRun) {
    const total = await dbGet("SELECT COUNT(*) AS n FROM hospitals");
    console.log(`Hospitals in the database now: ${total.n}. Data © OpenStreetMap contributors (ODbL).`);
  }
}

main()
  .catch((err) => { console.error(err?.message || err); process.exitCode = 1; })
  .finally(() => sqliteDb.close());
