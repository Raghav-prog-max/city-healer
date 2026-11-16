import { test, describe } from "node:test";
import assert from "node:assert/strict";
import facilityModel from "../shared/facility-model.json";
import { predictFacility, confirmationOf } from "../shared/facilityModel";
import { isUnconfirmedListing, nameClaimsHospital, HOSPITAL_SCORE_THRESHOLD } from "../shared/hospitalData";

describe("facility-name classifier", () => {
  test("matches scikit-learn predictions", () => {
    for (const c of (facilityModel as any).parity) {
      const p = predictFacility(c.text);
      assert.equal(p.label, c.label, c.text);
      assert.ok(Math.abs(p.confidence - c.confidence) < 2e-3, `${c.text}: ${p.confidence} vs ${c.confidence}`);
    }
  });

  test("tells hospitals from pharmacies, labs, dentists and clinics by name", () => {
    assert.equal(predictFacility("Kailash Hospital").label, "hospital");
    assert.equal(predictFacility("Apollo Pharmacy").label, "pharmacy");
    assert.equal(predictFacility("Dr Lal PathLabs").label, "laboratory");
    assert.equal(predictFacility("Smile Dental Care").label, "dentist");
    assert.equal(predictFacility("Dr. Mehta's Clinic").label, "clinic");
  });

  test("names with no telltale word are not taken for hospitals", () => {
    for (const name of ["Gupta and Sons", "Sharma Ji", "Jayprakash Infotech"]) {
      assert.ok(predictFacility(name).hospitalScore < HOSPITAL_SCORE_THRESHOLD, name);
    }
  });
});

describe("unconfirmed listings", () => {
  test("a registry, scheme list, review or seed confirms a listing, in that order", () => {
    assert.equal(confirmationOf({ registryId: "12", empanelled: true }), "registry");
    assert.equal(confirmationOf({ empanelled: true }), "empanelled");
    assert.equal(confirmationOf({ listingStatus: "active-reviewed" }), "reviewed");
    assert.equal(confirmationOf({ source: "seed" }), "seed");
    assert.equal(confirmationOf({ source: "osm" }), null);
  });

  test("only unconfirmed, doubtful names that do not say hospital are flagged", () => {
    assert.ok(isUnconfirmedListing({ name: "Pulse Medicare", confirmation: null, hospitalScore: 0.02 }));
    assert.ok(!isUnconfirmedListing({ name: "Pulse Medicare", confirmation: "empanelled", hospitalScore: 0.02 }));
    assert.ok(!isUnconfirmedListing({ name: "Silver Line Nursing Home", confirmation: null, hospitalScore: 0.1 }));
    assert.ok(!isUnconfirmedListing({ name: "Pulse Medicare", confirmation: null, hospitalScore: 0.02, listingStatus: "hidden" }));
    assert.ok(!isUnconfirmedListing({ name: "Somewhere", confirmation: null, hospitalScore: null }));
  });

  test("Hindi names that say hospital are taken at their word", () => {
    assert.ok(nameClaimsHospital("फोर्टिस हॉस्पिटल"));
    assert.ok(nameClaimsHospital("सरकारी अस्पताल"));
    assert.ok(!nameClaimsHospital("Apollo Clinic"));
  });
});
