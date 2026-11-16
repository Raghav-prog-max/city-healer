/**
 * A4 PDF of a Firestore prescription (server/firebase/consultations.ts), for the patient's
 * health wallet and the doctor's booking view. jspdf is imported only when someone clicks
 * "Download PDF", so it stays out of the main bundle.
 *
 * The PDF uses jsPDF's built-in Helvetica, which has no Devanagari glyphs: labels are English,
 * and text the doctor typed in Hindi would not render. A Unicode font is the fix if needed.
 */
import type { jsPDF as JsPDF } from "jspdf";

export interface PrescriptionForPdf {
  id?: string;
  doctorName?: string;
  specialty?: string;
  diagnosis: string;
  medicines: Array<{ name?: string; dosage?: string; frequency?: string; duration?: string }>;
  instructions?: string;
  issuedAt?: string;
  patientName?: string;
}

export const PDF_DISCLAIMER = "Digital prescription, demo prototype, not valid for dispensing outside City Healer.";

const issuedDate = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "-";
};

/** Draws the prescription on a new A4 document. Exported for tests; the UI calls downloadPrescriptionPdf. */
export function buildPrescriptionPdf(jsPDF: typeof JsPDF, rx: PrescriptionForPdf): JsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 18, right = 192, width = right - left;
  let y = 20;
  const ensure = (h: number) => { if (y + h > 280) { doc.addPage(); y = 20; } };
  const para = (text: string, size = 11, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style); doc.setFontSize(size);
    for (const line of doc.splitTextToSize(text, width) as string[]) { ensure(6); doc.text(line, left, y); y += size * 0.5; }
  };

  // Header
  doc.setFillColor(14, 116, 144);
  doc.rect(0, 0, 210, 14, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("City Healer", left, 9.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Prescription", right, 9.5, { align: "right" });
  doc.setTextColor(20, 20, 20);
  y = 24;
  doc.setTextColor(150, 60, 0);
  para(PDF_DISCLAIMER, 9, "bold");
  doc.setTextColor(20, 20, 20);
  y += 3;

  para(rx.doctorName || "Doctor", 13, "bold");
  if (rx.specialty) para(rx.specialty, 10);
  para(`Date: ${issuedDate(rx.issuedAt)}`, 10);
  if (rx.patientName) para(`Patient: ${rx.patientName}`, 10);
  if (rx.id) para(`Reference: ${rx.id}`, 9);
  y += 2; doc.setDrawColor(200, 200, 200); doc.line(left, y, right, y); y += 7;

  para("Diagnosis", 11, "bold");
  para(rx.diagnosis || "-");
  y += 4;

  para("Medicines", 11, "bold");
  y += 1;
  if (!rx.medicines?.length) para("None prescribed.");
  rx.medicines?.forEach((m, i) => {
    ensure(14);
    para(`${i + 1}. ${m.name || "-"}`, 11, "bold");
    const detail = [m.dosage && `Dosage: ${m.dosage}`, m.frequency && `Frequency: ${m.frequency}`, m.duration && `Duration: ${m.duration}`].filter(Boolean).join("   ");
    if (detail) para(detail, 10);
    y += 2;
  });

  if (rx.instructions) {
    y += 2;
    para("Instructions", 11, "bold");
    para(rx.instructions);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110, 110, 110);
    doc.text(`${PDF_DISCLAIMER}  Page ${p} of ${pages}`, 105, 290, { align: "center" });
  }
  return doc;
}

export const prescriptionFileName = (rx: PrescriptionForPdf) =>
  `city-healer-prescription-${(rx.issuedAt || "").slice(0, 10) || "undated"}${rx.id ? `-${rx.id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24)}` : ""}.pdf`;

/** Loads jspdf on demand and saves the PDF in the browser. */
export async function downloadPrescriptionPdf(rx: PrescriptionForPdf): Promise<void> {
  const { jsPDF } = await import("jspdf");
  buildPrescriptionPdf(jsPDF, rx).save(prescriptionFileName(rx));
}
