/**
 * Reading lab values out of report text and chat messages (server/ai/labValues.ts; P0.3,
 * BUG-006 and BUG-009). A value that is pre-filled wrong is worse than one left empty, so the
 * reader must either get the number right, in the unit the Health wallet form uses, or leave
 * the field for the patient to type.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extractLabValues } from "../server/ai/labValues";
import { extractDocument } from "../server/ai/documents";

const lab = (text: string) => {
  const { values } = extractLabValues(text);
  const { male, age, ...rest } = values;
  return rest;
};

describe("the audit's ten synthetic reports", () => {
  // CITY_HEALER_AUDIT_REPORT/audit_scripts/eval_ai.ts (document_extraction_synthetic). One
  // expected value differs from the audit's: "WBC: 6.1 x10^3/uL" is 6,100 per µL, the unit the
  // wallet form and its reference range (4,000 to 11,000) use, not a bare 6.1.
  const docs: { name: string; text: string; truth: Record<string, number> }[] = [
    { name: "cbc-columns", text: "Complete Blood Count\nHaemoglobin        11.2     g/dL      13.0 - 17.0\nTotal WBC Count    7800     /cumm\nPlatelet Count     1.5      lakh/cumm\nMCV                72       fL", truth: { haemoglobin: 11.2, wbc: 7800, platelets: 150000, mcv: 72 } },
    { name: "cbc-colon", text: "Hb: 13.4 g/dL\nWBC: 6.1 x10^3/uL\nPlatelets: 245 x10^3/uL\nMCV: 88 fL", truth: { haemoglobin: 13.4, wbc: 6100, platelets: 245000, mcv: 88 } },
    { name: "diabetes", text: "Fasting Blood Sugar (FBS) : 126 mg/dL\nHbA1c - 6.9 %\nBMI 27.5", truth: { glucose: 126, hba1c: 6.9, bmi: 27.5 } },
    { name: "lipid", text: "LIPID PROFILE\nTotal Cholesterol   232  mg/dL\nTriglycerides       180  mg/dL\nHDL Cholesterol     38   mg/dL\nLDL Cholesterol     150  mg/dL", truth: { cholesterol: 232, triglycerides: 180, hdl: 38, ldl: 150 } },
    { name: "liver", text: "SGPT (ALT): 64 U/L\nSGOT (AST): 52 U/L\nTotal Bilirubin: 1.4 mg/dL\nAlbumin: 3.9 g/dL", truth: { alt: 64, ast: 52, totalBilirubin: 1.4, albumin: 3.9 } },
    { name: "thyroid", text: "TSH (Ultrasensitive)      5.8     µIU/mL     0.4 - 4.2", truth: { tsh: 5.8 } },
    { name: "no-units", text: "Haemoglobin 12\nPlatelets 210\nTSH 2.1", truth: { haemoglobin: 12, platelets: 210000, tsh: 2.1 } },
    { name: "range-before-value", text: "Haemoglobin (13.0-17.0)  14.1 g/dL", truth: { haemoglobin: 14.1 } },
    { name: "hindi-labels", text: "हीमोग्लोबिन 10.8\nशुगर 150", truth: { haemoglobin: 10.8, glucose: 150 } },
    { name: "indian-number-format", text: "Platelet Count: 1,50,000 /cumm\nWBC: 11,200 /cumm", truth: { platelets: 150000, wbc: 11200 } },
  ];
  for (const d of docs) {
    test(d.name, async () => {
      const r = await extractDocument(`${d.name}.txt`, new TextEncoder().encode(d.text));
      const { male, age, ...got } = r.lab.values;
      assert.deepEqual(got, d.truth);
    });
  }
});

describe("numbers as Indian reports print them", () => {
  test("Indian and Western digit grouping", () => {
    assert.deepEqual(lab("Platelet Count: 1,50,000 /cumm"), { platelets: 150000 });
    assert.deepEqual(lab("Platelet Count: 150,000 /cumm"), { platelets: 150000 });
    assert.deepEqual(lab("Platelets 2,45,000"), { platelets: 245000 });
    assert.deepEqual(lab("WBC: 11,200 /cumm"), { wbc: 11200 });
    assert.deepEqual(lab("Total Leucocyte Count  9,400  cells/cumm"), { wbc: 9400 });
  });

  test("lakh", () => {
    assert.deepEqual(lab("Platelet Count 1.5 lakh/cumm"), { platelets: 150000 });
    assert.deepEqual(lab("Platelets: 2.45 lakhs"), { platelets: 245000 });
    assert.deepEqual(lab("platelets 0.9 lac"), { platelets: 90000 });
  });

  test("counts printed in thousands", () => {
    assert.deepEqual(lab("Platelets: 245 x10^3/uL"), { platelets: 245000 });
    assert.deepEqual(lab("Platelets 150 x 10^3/µL"), { platelets: 150000 });
    assert.deepEqual(lab("Platelets 150 10^9/L"), { platelets: 150000 });
    assert.deepEqual(lab("Platelets 180 thousand"), { platelets: 180000 });
    assert.deepEqual(lab("WBC: 7.8 x10^3/uL"), { wbc: 7800 });
    assert.deepEqual(lab("WBC 6.1 ×10³/µL"), { wbc: 6100 });
    assert.deepEqual(lab("WBC 7.8"), { wbc: 7800 });
  });

  test("a count with no unit is read in thousands only when nothing else fits", () => {
    assert.deepEqual(lab("platelets 120"), { platelets: 120000 });
    assert.deepEqual(lab("Platelets 210000"), { platelets: 210000 });
    // 1.5 could be lakh or thousands: left for the patient to type.
    assert.deepEqual(lab("Platelets 1.5"), {});
  });

  test("a comma between two readings is not digit grouping", () => {
    assert.deepEqual(lab("sugar 126, 140 after food"), { glucose: 126 });
  });
});

describe("the result, not the reference range", () => {
  test("a bracketed range before the result is skipped", () => {
    assert.deepEqual(lab("Haemoglobin (13.0-17.0)  14.1 g/dL"), { haemoglobin: 14.1 });
    assert.deepEqual(lab("TSH [0.4 - 4.2] 5.8 µIU/mL"), { tsh: 5.8 });
  });

  test("an unbracketed range before the result is skipped", () => {
    assert.deepEqual(lab("Haemoglobin 13.0 - 17.0 g/dL   14.1"), { haemoglobin: 14.1 });
    assert.deepEqual(lab("Haemoglobin 13.0 to 17.0   14.1"), { haemoglobin: 14.1 });
  });

  test("a line with only a range fills nothing", () => {
    assert.deepEqual(lab("Haemoglobin reference 13.0 - 17.0 g/dL"), {});
    assert.deepEqual(lab("Platelets 150 - 410"), {});
  });

  test("a range after the result is ignored", () => {
    assert.deepEqual(lab("Haemoglobin 11.2 g/dL 13.0 - 17.0"), { haemoglobin: 11.2 });
    assert.deepEqual(lab("Platelets 150 x10^3/uL 150 - 410"), { platelets: 150000 });
  });
});

describe("labels with extra words (BUG-009)", () => {
  test("a word or bracket between the name and the value", () => {
    assert.deepEqual(lab("HDL Cholesterol 38 mg/dL"), { hdl: 38 });
    assert.deepEqual(lab("LDL Cholesterol (Direct) 150 mg/dL"), { ldl: 150 });
    assert.deepEqual(lab("TSH (Ultrasensitive) 5.8"), { tsh: 5.8 });
    assert.deepEqual(lab("Fasting Blood Sugar (FBS) : 126 mg/dL"), { glucose: 126 });
    assert.deepEqual(lab("SGPT (ALT): 64 U/L"), { alt: 64 });
  });

  test("a far-away number is not taken as the value", () => {
    assert.deepEqual(lab("what should my platelets be at my age of 45"), {});
    assert.deepEqual(lab("is haemoglobin checked in the 20 minute test"), {});
  });
});

describe("one test is not mistaken for another", () => {
  test("HDL or LDL cholesterol is not total cholesterol", () => {
    assert.deepEqual(lab("HDL Cholesterol 38\nLDL Cholesterol 150"), { hdl: 38, ldl: 150 });
    assert.deepEqual(lab("Non-HDL Cholesterol 190"), {});
    assert.deepEqual(lab("VLDL Cholesterol 30"), {});
  });

  test("ratios are not results", () => {
    assert.deepEqual(lab("LDL/HDL Ratio 3.9"), {});
    assert.deepEqual(lab("Total Cholesterol / HDL Ratio 6.1"), {});
    assert.deepEqual(lab("Albumin/Globulin Ratio 1.4"), {});
  });

  test("red-cell indices are not haemoglobin", () => {
    assert.deepEqual(lab("Mean Corpuscular Haemoglobin 29 pg\nMean Corpuscular Haemoglobin Concentration 33 g/dL"), {});
    assert.deepEqual(lab("Mean Corpuscular Hemoglobin 14.9 pg\nHaemoglobin 11.2 g/dL"), { haemoglobin: 11.2 });
    assert.deepEqual(lab("Glycosylated Haemoglobin 7.1 %"), { hba1c: 7.1 });
  });

  test("platelet indices are not the platelet count", () => {
    assert.deepEqual(lab("Mean Platelet Volume 9.8 fL\nPlatelet Distribution Width 16\nPlateletcrit 0.21"), {});
  });

  test("only a fasting or unqualified sugar fills fasting glucose", () => {
    assert.deepEqual(lab("Post Prandial Blood Sugar 182 mg/dL"), {});
    assert.deepEqual(lab("Random Blood Sugar: 210"), {});
    assert.deepEqual(lab("Estimated Average Glucose 154 mg/dL"), {});
    assert.deepEqual(lab("Urine Sugar 2"), {});
    assert.deepEqual(lab("Blood Sugar (PP) 182\nBlood Sugar (Fasting) 112"), { glucose: 112 });
    assert.deepEqual(lab("my sugar is 180"), { glucose: 180 });
  });

  test("direct and indirect bilirubin are not total bilirubin", () => {
    assert.deepEqual(lab("Direct Bilirubin 0.3\nIndirect Bilirubin 0.9"), {});
    assert.deepEqual(lab("Bilirubin Direct 0.3\nBilirubin Total 1.4"), { totalBilirubin: 1.4 });
  });
});

describe("implausible values are left out, never pre-filled", () => {
  test("values no person could have are dropped and reported as skipped", () => {
    const r = extractLabValues("Haemoglobin 112\nTSH 2.1");
    assert.deepEqual(r.values, { tsh: 2.1 });
    assert.equal(r.skipped.length, 1);
    assert.equal(r.skipped[0].key, "haemoglobin");
  });

  test("a platelet count of 1,500 is never produced from '1.5 lakh'", () => {
    for (const text of ["Platelet Count 1.5 lakh/cumm", "Platelet Count     1.5      lakh/cumm", "Platelets: 1.5 Lakh / cumm"]) {
      assert.equal(extractLabValues(text).values.platelets, 150000, text);
    }
  });

  test("every pre-filled value comes with the text it was read from", () => {
    const r = extractLabValues("Platelet Count: 1,50,000 /cumm\nHaemoglobin (13.0-17.0) 14.1 g/dL");
    assert.deepEqual(r.values, { platelets: 150000, haemoglobin: 14.1 });
    assert.match(r.sources.platelets, /1,50,000/);
    assert.match(r.sources.haemoglobin, /14\.1/);
    assert.ok(!/13\.0/.test(r.sources.haemoglobin), "the source is the result, not the range");
  });
});

describe("what already worked still works", () => {
  test("chat messages", () => {
    assert.deepEqual(lab("my haemoglobin is 9.8 and platelets 120"), { haemoglobin: 9.8, platelets: 120000 });
    assert.deepEqual(lab("my fasting sugar is 160 and hba1c 7.4, what does it mean"), { glucose: 160, hba1c: 7.4 });
    assert.deepEqual(lab("haemoglobin 10.2 platelets 90"), { haemoglobin: 10.2, platelets: 90000 });
  });

  test("panel, sex and age", () => {
    const r = extractLabValues("Patient: Test  Age: 34 years  Sex: Male\nHaemoglobin 11.2 g/dL\nMCV - 72 fL");
    assert.equal(r.panel, "cbc");
    assert.equal(r.values.male, 1);
    assert.equal(r.values.age, 34);
    assert.equal(r.values.mcv, 72);
  });
});
