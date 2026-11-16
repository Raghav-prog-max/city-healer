/** The prescription PDF (src/site/lib/prescriptionPdf.ts) renders every part of the prescription. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPrescriptionPdf, prescriptionFileName, PDF_DISCLAIMER } from "../src/site/lib/prescriptionPdf";

const rx = {
  id: "abc123", doctorName: "Dr. Dev Consultant", specialty: "General Physician", issuedAt: "2026-11-17T10:00:00.000Z",
  diagnosis: "Viral fever",
  medicines: [{ name: "Paracetamol 500 mg", dosage: "1 tablet", frequency: "Three times a day", duration: "3 days" }],
  instructions: "Rest and fluids.",
};

test("an A4 PDF with the header, disclaimer, doctor, diagnosis, medicines and instructions", () => {
  const doc = buildPrescriptionPdf(jsPDF, rx);
  const size = doc.internal.pageSize;
  assert.equal(Math.round(size.getWidth()), 210);
  assert.equal(Math.round(size.getHeight()), 297);
  const out = doc.output();
  assert.ok(out.startsWith("%PDF-"));
  for (const s of ["City Healer", "Dr. Dev Consultant", "General Physician", "Viral fever", "Paracetamol 500 mg", "Dosage: 1 tablet", "Frequency: Three times a day", "Duration: 3 days", "Rest and fluids.", "not valid for dispensing"]) {
    assert.ok(out.includes(s), `PDF should contain "${s}"`);
  }
  assert.match(PDF_DISCLAIMER, /demo prototype/);
});

test("a long prescription flows onto more pages; the file name is safe", () => {
  const many = { ...rx, medicines: Array.from({ length: 40 }, (_, i) => ({ name: `Medicine ${i}`, dosage: "1", frequency: "daily", duration: "5 days" })) };
  assert.ok(buildPrescriptionPdf(jsPDF, many).getNumberOfPages() > 1);
  assert.equal(prescriptionFileName({ ...rx, id: "../x y" }), "city-healer-prescription-2026-11-17-xy.pdf");
});
