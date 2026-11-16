import { test } from "node:test";
import assert from "node:assert/strict";
import { matchingDepartment, doctorCategoryFor } from "../shared/specialties";
import { CONDITIONS } from "../shared/triageModel";

const DOCTOR_CATEGORIES = new Set([
  "General Physician", "Cardiologist", "Pulmonologist", "Gastroenterologist",
  "Neurologist", "Pediatrician", "Oncologist", "Emergency Care Physician",
]);

test("finds the hospital department for a specialist", () => {
  assert.equal(matchingDepartment("Gastroenterologist / Hepatologist", ["Cardiology", "Hepatology"]), "Hepatology");
  assert.equal(matchingDepartment("Pulmonologist", ["Pulmonology & Asthma Care"]), "Pulmonology & Asthma Care");
  assert.equal(matchingDepartment("Neurologist / Emergency Medicine", ["Emergency & Trauma"]), "Emergency & Trauma");
});

test("returns null when the hospital has no suitable department", () => {
  assert.equal(matchingDepartment("Cardiologist", ["Orthopedics", "Dermatology"]), null);
  assert.equal(matchingDepartment("", ["Cardiology"]), null);
});

test("maps specialists to bookable doctor categories", () => {
  assert.equal(doctorCategoryFor("Cardiologist"), "Cardiologist");
  assert.equal(doctorCategoryFor("Allergist / Immunologist"), "Pulmonologist");
  assert.equal(doctorCategoryFor("Something unknown"), "General Physician");
});

test("every model condition routes to a real doctor category", () => {
  for (const [name, info] of Object.entries(CONDITIONS)) {
    const category = doctorCategoryFor(info.en.specialist);
    assert.ok(DOCTOR_CATEGORIES.has(category), `${name} -> ${category}`);
    // "General Physician" is only right when the specialist actually is one.
    if (category === "General Physician" && !/general|orthop|rheumat|urolog|vascular|dermat|endocrin|diabet/i.test(info.en.specialist)) {
      assert.fail(`${name}: "${info.en.specialist}" fell through to General Physician`);
    }
  }
});
