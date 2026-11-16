/**
 * Review the hospital directory: problems people reported, and hidden listings.
 *
 *   npm run review-hospitals                              open reports, most-reported first
 *   npm run review-hospitals -- --hidden                  listings currently hidden, with why
 *   npm run review-hospitals -- --hide <id> --reason "not a hospital"
 *   npm run review-hospitals -- --restore <id>            show it again (a later enrich will not re-hide it)
 *   npm run review-hospitals -- --unconfirmed             listings nothing confirms and the facility
 *                                                         classifier doubts are hospitals, least likely first
 *   npm run review-hospitals -- --unconfirmed --csv out.csv   the same as a spreadsheet with an
 *                                                         openstreetmap.org link for each, to correct the map
 *
 * Hiding never deletes: the row keeps its data and the reason. For a mistake in the map data
 * itself, the fix belongs in OpenStreetMap (openstreetmap.org, "Edit"), which the next import
 * will pick up.
 */
import { dbAll, dbGet, dbRun, sqliteDb, initializeDatabase } from "../database";
import { parseArgs } from "./firebase-cli";
import { writeFileSync } from "node:fs";
import { isUnconfirmedListing } from "../shared/hospitalData";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await initializeDatabase();

  if (args.hide || args.restore) {
    const id = String(args.hide || args.restore);
    const h = await dbGet("SELECT id, name FROM hospitals WHERE id = ?", [id]);
    if (!h) { console.error(`No hospital with id ${id}.`); process.exit(1); }
    if (args.hide) {
      await dbRun("UPDATE hospitals SET listingStatus = 'hidden', hiddenReason = ? WHERE id = ?", [String(args.reason || "reviewed by an administrator").slice(0, 200), id]);
      console.log(`Hidden: ${h.name}`);
    } else {
      await dbRun("UPDATE hospitals SET listingStatus = 'active-reviewed', hiddenReason = NULL, confirmation = COALESCE(confirmation, 'reviewed') WHERE id = ?", [id]);
      console.log(`Restored: ${h.name}`);
    }
    await dbRun("UPDATE hospital_reports SET status = 'resolved' WHERE hospitalId = ?", [id]);
    return;
  }

  if (args.unconfirmed) {
    const all = await dbAll("SELECT id, name, address, city, osmId, hospitalScore, likelyKind, confirmation, listingStatus FROM hospitals");
    const rows = all.filter(isUnconfirmedListing).sort((a, b) => a.hospitalScore - b.hospitalScore);
    if (args.csv) {
      // For correcting OpenStreetMap at the source: each link opens the feature; "Edit" there
      // (with an OSM account) changes the tag, e.g. amenity=hospital -> amenity=clinic.
      const lines = [["id", "name", "address", "city", "hospital_score", "looks_like", "osm_link", "osm_edit_link"].join(",")];
      for (const r of rows) {
        const osm = r.osmId ? `https://www.openstreetmap.org/${r.osmId}` : "";
        const edit = r.osmId ? `https://www.openstreetmap.org/edit?${String(r.osmId).replace("/", "=")}` : "";
        lines.push([r.id, r.name, r.address, r.city, r.hospitalScore, r.likelyKind, osm, edit].map(csvCell).join(","));
      }
      writeFileSync(String(args.csv), lines.join("\n") + "\n", "utf8");
      console.log(`Wrote ${rows.length} unconfirmed listing(s) to ${args.csv}`);
      return;
    }
    console.log(`${rows.length} unconfirmed listing(s), least likely to be a hospital first:`);
    for (const r of rows) console.log(`  ${String(r.id).padEnd(28)} ${Number(r.hospitalScore).toFixed(2)}  ${String(r.likelyKind).padEnd(10)} ${r.name}`);
    console.log("\nHide one with --hide <id>, or confirm it is a hospital with --restore <id>.");
    return;
  }

  if (args.hidden) {
    const rows = await dbAll("SELECT id, name, hiddenReason FROM hospitals WHERE listingStatus = 'hidden' ORDER BY name");
    console.log(`${rows.length} hidden listing(s):`);
    for (const r of rows) console.log(`  ${String(r.id).padEnd(28)} ${r.name}  -  ${r.hiddenReason}`);
    return;
  }

  const rows = await dbAll(`
    SELECT r.hospitalId, h.name, h.listingStatus, r.reason, COUNT(*) AS n, MAX(r.createdAt) AS lastAt
    FROM hospital_reports r JOIN hospitals h ON h.id = r.hospitalId
    WHERE r.status = 'open' GROUP BY r.hospitalId, r.reason ORDER BY n DESC, lastAt DESC`);
  if (!rows.length) { console.log("No open reports."); return; }
  for (const r of rows) console.log(`  ${String(r.n).padStart(3)}x ${r.reason.padEnd(16)} ${String(r.hospitalId).padEnd(28)} ${r.name}${r.listingStatus === "hidden" ? " (hidden)" : ""}`);
  console.log("\nHide one with: npm run review-hospitals -- --hide <id> --reason \"...\"");
}

main()
  .catch((err) => { console.error(err?.message || err); process.exitCode = 1; })
  .finally(() => sqliteDb.close());
