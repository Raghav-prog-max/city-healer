import { test } from "node:test";
import assert from "node:assert/strict";
import { notAHospitalReason, specialitiesFromName, isGeneralCareHospital, STANDARD_DEPARTMENTS } from "../shared/hospitalData";
import { matchDepartmentWithSource } from "../shared/specialties";

test("map entries that are not hospitals for people are caught", () => {
  assert.equal(notAHospitalReason("Indian Bagheera Veterinary Hospital"), "animal hospital");
  assert.equal(notAHospitalReason("Jayprakash Infotech"), "office");
  assert.equal(notAHospitalReason("Goyal MRI & Diagnostic Centre"), "diagnostic centre");
  assert.equal(notAHospitalReason("Safdarjung Hospital back gate"), "part of a campus, not a facility");
  assert.equal(notAHospitalReason("Apollo Pharmacy"), "pharmacy");
});

test("real hospitals are kept, even with words like diagnostic or Pvt Ltd in the name", () => {
  for (const name of ["Sir Ganga Ram Hospital", "Sharma Diagnostic & Hospital", "Max Super Speciality Hospital Pvt Ltd", "Sanjivini Nursing Home", "Lok Nayak Hospital"]) {
    assert.equal(notAHospitalReason(name), null, name);
  }
});

test("specialist hospitals' names give their department", () => {
  assert.deepEqual(specialitiesFromName("Guru Nanak Eye Hospital"), ["Ophthalmology"]);
  assert.deepEqual(specialitiesFromName("Rajiv Gandhi Cancer Institute"), ["Oncology"]);
  assert.deepEqual(specialitiesFromName("City Hospital"), []);
});

test("large and multi-speciality hospitals are recognised as general care", () => {
  assert.ok(isGeneralCareHospital("Kailash Multispeciality Hospital"));
  assert.ok(isGeneralCareHospital("Some Hospital", "100-500 Bedded Hospital"));
  assert.ok(!isGeneralCareHospital("Small Nursing Home", "<100 Bedded Hospital"));
});

test("district hospitals carry the IPHS 2022 essential specialties", () => {
  const dh = STANDARD_DEPARTMENTS["District Hospital"].departments;
  for (const d of ["General Medicine", "Paediatrics", "Obstetrics & Gynaecology", "Orthopaedics", "Psychiatry"]) assert.ok(dh.includes(d), d);
});

test("a listed department beats one that is only expected under a standard", () => {
  const listed = matchDepartmentWithSource("Pediatrician", ["Paediatrics"], { Paediatrics: "listed" });
  assert.deepEqual(listed, { department: "Paediatrics", source: "listed" });
  const standard = matchDepartmentWithSource("Pediatrician", ["Paediatrics"], { Paediatrics: "standard" });
  assert.equal(standard?.source, "standard");
  assert.equal(matchDepartmentWithSource("Cardiologist", ["Paediatrics"], null), null);
});

test("gastroenterology is not mistaken for ENT", () => {
  const m = matchDepartmentWithSource("Gastroenterologist / Hepatologist", ["ENT", "Gastroenterology"], null);
  assert.equal(m?.department, "Gastroenterology");
});
