/** Distance maths shared by the server and the browser. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { haversineKm, parseLatLng, sortByDistance, DELHI_CENTRE } from "../shared/geo";

describe("geo", () => {
  test("haversine matches a known distance", () => {
    // Connaught Place to India Gate is roughly 2.3 km.
    const d = haversineKm(DELHI_CENTRE, { lat: 28.6129, lng: 77.2295 });
    assert.ok(d > 1.8 && d < 2.2, String(d));
    // Delhi to Mumbai is roughly 1,150 km.
    const far = haversineKm(DELHI_CENTRE, { lat: 19.076, lng: 72.8777 });
    assert.ok(far > 1100 && far < 1200, String(far));
    assert.equal(haversineKm(DELHI_CENTRE, DELHI_CENTRE), 0);
  });

  test("bad coordinates are rejected, not turned into 0,0", () => {
    assert.equal(parseLatLng(undefined, undefined), null);
    assert.equal(parseLatLng("", ""), null);
    assert.equal(parseLatLng(null, 77), null);
    assert.equal(parseLatLng("abc", "77"), null);
    assert.equal(parseLatLng(0, 0), null);
    assert.equal(parseLatLng(95, 77), null);
    assert.deepEqual(parseLatLng("28.6", "77.2"), { lat: 28.6, lng: 77.2 });
  });

  test("nearest first, unknown distances last", () => {
    const sorted = sortByDistance([{ n: "far", distanceKm: 9 }, { n: "unknown", distanceKm: null }, { n: "near", distanceKm: 1 }]);
    assert.deepEqual(sorted.map((x) => x.n), ["near", "far", "unknown"]);
  });
});
