/**
 * Medical document intelligence (Intelligence Platform zip, module 3: app/services/documents.py).
 *
 * Reads a lab report the patient uploads (plain text, or a PDF with a text layer) and returns
 * the label: value pairs found in it and, where they are recognised, the lab values the lab
 * models take, so the Health wallet form can be filled in for the patient to check. Nothing is
 * interpreted here and nothing is stored: the file is read in memory and dropped.
 *
 * PDF text uses Mozilla pdf.js (`pdfjs-dist`) when it is installed; without it a PDF gets
 * status "dependency_missing", as in the zip. Scanned images need OCR, which is not set up.
 */
import { extractLabValues, type LabExtraction } from "./labValues";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export interface ExtractedDocument {
  status: "extracted" | "no_text_found" | "unsupported_type" | "dependency_missing" | "unreadable";
  engine: "plain_text" | "pdfjs_text_layer" | "none";
  message?: string;
  text: string;
  candidateValues: { label: string; value: number; unit: string }[];
  /** Recognised lab values in the wallet form's units, each with the text it was read from. */
  lab: LabExtraction;
  clinicalInterpretation: "not_performed";
}

// Lab reports usually print in columns: "Haemoglobin    13.2   g/dL   13.0 - 17.0"; the first
// number after the name is the result, the rest of the line (unit, reference range) is not.
const COLUMN = /^([A-Za-z][A-Za-z0-9 /()._-]{0,50}?)[ \t]{2,}(-?\d+(?:\.\d+)?)(?:[ \t]+([A-Za-z/%µμ^][A-Za-z0-9/%µμ^.]*))?/;
// From the zip: "Label: 12.5 unit" or "Label - 12.5 unit". Matched within one line only.
const PAIR = /^([A-Za-z][A-Za-z0-9 /()._]{0,50}?)[ \t]*[:=\-][ \t]*(-?\d+(?:\.\d+)?)(?:[ \t]*([A-Za-z/%µμ^][A-Za-z0-9/%µμ^.]*))?/;

/** Label / value / unit candidates, one per line or ";"/","-separated item. For structuring only. */
export function candidateValues(text: string) {
  const out: { label: string; value: number; unit: string }[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    for (const item of line.split(/[ \t]*[;|][ \t]*|,[ \t]+(?=[A-Za-z])/)) {
      const m = item.trim().match(COLUMN) || item.trim().match(PAIR);
      if (!m) continue;
      const label = m[1].trim().replace(/\s+/g, " ");
      const key = `${label.toLowerCase()}|${m[2]}`;
      if (!label || seen.has(key)) continue;
      seen.add(key);
      out.push({ label, value: Number(m[2]), unit: (m[3] || "").trim() });
      if (out.length >= 100) return out;
    }
  }
  return out;
}

async function pdfText(bytes: Uint8Array): Promise<string | null> {
  let pdfjs: any;
  try {
    // Optional dependency, resolved at run time only.
    const name = "pdfjs-dist/legacy/build/pdf.mjs";
    pdfjs = await import(/* @vite-ignore */ name);
  } catch {
    return null;
  }
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    // Keep line breaks where the text moves down, so columns stay on one line.
    let line = "", lastY: number | null = null;
    const lines: string[] = [];
    for (const item of content.items as any[]) {
      const y = item.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; }
      line += (line ? "  " : "") + item.str;
      lastY = y;
    }
    lines.push(line);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

export async function extractDocument(filename: string, bytes: Uint8Array): Promise<ExtractedDocument> {
  const base = { candidateValues: [], lab: { panel: null, values: {}, sources: {}, skipped: [] } as LabExtraction, clinicalInterpretation: "not_performed" as const, text: "" };
  const name = String(filename || "").toLowerCase();
  const isPdf = name.endsWith(".pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46); // %PDF
  let text: string;
  let engine: ExtractedDocument["engine"];
  if (isPdf) {
    try {
      const t = await pdfText(bytes);
      if (t === null) return { ...base, status: "dependency_missing", engine: "none", message: "PDF reading is not installed on this server (npm install pdfjs-dist). Upload a .txt copy or type the values." };
      text = t; engine = "pdfjs_text_layer";
    } catch {
      return { ...base, status: "unreadable", engine: "none", message: "This PDF could not be read. It may be damaged or password-protected." };
    }
  } else if (name.endsWith(".txt") || name.endsWith(".csv") || !name.includes(".")) {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    engine = "plain_text";
  } else {
    return { ...base, status: "unsupported_type", engine: "none", message: "Upload a .txt file or a PDF that has selectable text. Photos and scans need OCR, which is not set up." };
  }
  text = text.slice(0, 50_000);
  if (!text.trim()) {
    return { ...base, engine, status: "no_text_found", message: "No text found. A scanned report is an image and needs OCR, which is not set up." };
  }
  return { ...base, status: "extracted", engine, text, candidateValues: candidateValues(text), lab: extractLabValues(text) };
}
