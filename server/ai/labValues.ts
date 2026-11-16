/**
 * Lab values in free text: a line of a lab report, or a chat message ("my sugar is 180").
 *
 * The values found here pre-fill the Health wallet form and feed the lab models, so a wrong
 * number is worse than a missing one (P0.3, BUG-006). The rules, in order:
 *
 *   1. The label must be this test and not a look-alike (HDL cholesterol is not total
 *      cholesterol, post-prandial sugar is not fasting glucose, a ratio is not a result).
 *   2. The number must be the result: bracketed text and reference ranges ("13.0 - 17.0") are
 *      skipped, and a number several words away from the label is not taken.
 *   3. Numbers are read as Indian reports print them: 1,50,000 and 150,000 grouping, "1.5 lakh",
 *      and counts in thousands ("245 x10^3/uL"), converted to the unit the form uses (per µL).
 *   4. A value outside what a living person could have is dropped, not pre-filled. So is a count
 *      whose scale cannot be told ("Platelets 1.5" with no unit).
 *
 * Every value comes with the text it was read from, so the form can show it for checking.
 * Nothing here interprets a result.
 */
import type { Panel } from "../../shared/labModels";

interface Analyte {
  key: string;
  panel: Panel;
  /** The test's name. Look-alikes that share the word are excluded with look-arounds or `not`. */
  label: RegExp;
  /** Words next to the label (before it, in a bracket after it, or between it and the number) that make it a different test. */
  not?: RegExp;
  /** Plausible limits in the form's unit: outside them the value is not pre-filled. */
  min: number;
  max: number;
  /** A cell count per µL, which reports print in units, thousands or lakh. */
  count?: boolean;
}

const ANALYTES: Analyte[] = [
  { key: "glucose", panel: "diabetes", label: /glucose|sugar|\bfbs\b|शुगर/i,
    not: /post[\s-]*prandial|\bpp\b|\bppbs\b|after\s+(?:food|meals?|lunch|dinner|breakfast)|random|\brbs\b|average|\bmean\b|urine|tolerance|\bogtt\b/i, min: 20, max: 1000 },
  { key: "hba1c", panel: "diabetes", label: /hba1c|ha?emoglobin\s*a1c|glyc(?:osyl)?ated\s+ha?emoglobin|\ba1c\b/i, min: 3, max: 20 },
  { key: "bmi", panel: "diabetes", label: /\bbmi\b/i, min: 10, max: 80 },
  { key: "cholesterol", panel: "heart", label: /(?<!\b(?:hdl|ldl|vldl)[\s-]*)cholesterol/i, min: 50, max: 1000 },
  { key: "ldl", panel: "heart", label: /\bldl\b/i, min: 5, max: 600 },
  { key: "hdl", panel: "heart", label: /(?<!non[\s-]*)\bhdl\b/i, min: 5, max: 200 },
  { key: "triglycerides", panel: "heart", label: /triglycerides?/i, min: 10, max: 6000 },
  { key: "alt", panel: "liver", label: /\b(?:alt|sgpt)\b/i, min: 1, max: 10000 },
  { key: "ast", panel: "liver", label: /\b(?:ast|sgot)\b/i, min: 1, max: 10000 },
  { key: "totalBilirubin", panel: "liver", label: /bilirubin/i, not: /\b(?:in)?direct\b|\b(?:un)?conjugated\b|urine/i, min: 0.05, max: 60 },
  { key: "albumin", panel: "liver", label: /\balbumin\b/i, not: /urine|creatinine/i, min: 0.5, max: 7 },
  // "HbA1c", "haemoglobin A1c" and "glycated haemoglobin" are the diabetes test; "mean corpuscular
  // haemoglobin" (MCH, MCHC) is a red-cell index. \b does not work before Devanagari.
  { key: "haemoglobin", panel: "cbc",
    label: /(?<!glyc(?:osyl)?ated\s+)(?<!corpuscular\s+)\bha?emoglobin\b(?!\s*a1c)|\bhb(?![a-z0-9])|हीमोग्लोबिन/i, min: 2, max: 25 },
  { key: "wbc", panel: "cbc", label: /\bwbc\b|\btlc\b|white\s+(?:blood\s+)?cells?|total\s+leu[ck]ocytes?/i, not: /urine|\bhpf\b/i, min: 500, max: 500_000, count: true },
  { key: "platelets", panel: "cbc", label: /platelets?(?!\s*(?:volume|distribution|crit|large))/i, min: 5000, max: 2_000_000, count: true },
  { key: "mcv", panel: "cbc", label: /\bmcv\b/i, min: 40, max: 150 },
  { key: "tsh", panel: "thyroid", label: /\btsh\b/i, min: 0.001, max: 500 },
];

const ANY_LABEL = new RegExp(ANALYTES.map((a) => `(?:${a.label.source})`).join("|"), "gi");

// 1,50,000 (Indian) or 150,000 (Western) grouping, or plain digits; optional decimals. Not part
// of a word or of another number ("x10^3", "B12", "17.0" in "13.0-17.0" is handled as a range).
const NUMBER = /(?<![A-Za-z^\d.,])(\d{1,2}(?:,\d{2})+,\d{3}|\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\d])/g;
const RANGE_TAIL = /^\s*(?:-|–|—|to\b)\s*\d/i;
const DATE_OR_TIME_TAIL = /^[/:]\d/;
const RATIO = /\bratio\b/i;

const LAKH = /^(?:lakhs?|lacs?)\b/i;
// "x10^3/uL", "×10³/µL", "10^9/L" (SI: the same number as thousands per µL), "thousand", "K/µL".
const THOUSANDS = /^(?:(?:x|×|\*)\s*)?10\s*(?:\^|\*\*)?\s*[39]\b|^(?:(?:x|×|\*)\s*)?10\s*[³⁹]|^thousands?\b|^k\s*\/\s*[uµμ]l\b/i;
const PER_MICROLITRE = /^(?:cells?\s*)?\/?\s*(?:cu\.?\s*mm|cumm|c\.?mm|mm\s*\^?3|mm³|[uµμ]l\b|microlit)/i;

/** Scale a cell count to per µL from the unit printed after it. null: the scale cannot be told. */
function countPerMicrolitre(key: string, printed: number, after: string): number | null {
  const unit = after.trimStart();
  if (LAKH.test(unit)) return Math.round(printed * 100_000);
  if (THOUSANDS.test(unit)) return Math.round(printed * 1000);
  if (PER_MICROLITRE.test(unit)) return printed;
  // No unit. Whole counts are unmistakable; small numbers are thousands when nothing else fits.
  if (key === "platelets") {
    if (printed >= 2000) return printed;
    if (printed >= 10) return Math.round(printed * 1000); // "platelets 150" is 150,000
    return null; // "1.5": lakh or thousands? Not guessed.
  }
  if (printed >= 500) return printed;
  if (printed < 100) return Math.round(printed * 1000); // "WBC 7.8" is 7,800
  return null;
}

/** Bracketed text blanked out, keeping every character's position. */
const withoutBrackets = (line: string) => line.replace(/\([^)]*\)|\[[^\]]*\]/g, (m) => " ".repeat(m.length));

type Rejection = "implausible" | "unit_unclear";
type Reading = { ok: true; value: number; raw: string } | { ok: false; reason: Rejection; raw: string } | null;

/** The result printed for a label that ends at `from` on this line, if one can be read safely. */
function readResult(a: Analyte, line: string, clean: string, labelStart: number, from: number): Reading {
  // The result lies between this label and the next test's label on the line.
  ANY_LABEL.lastIndex = from;
  const next = ANY_LABEL.exec(clean);
  const end = next ? next.index : clean.length;

  NUMBER.lastIndex = from;
  let afterRange = false;
  for (let m = NUMBER.exec(clean); m && m.index < end; m = NUMBER.exec(clean)) {
    const numEnd = m.index + m[0].length;
    const tail = clean.slice(numEnd, end);
    // "13.0 - 17.0" is a reference range: skip both ends and look for the result after it.
    if (RANGE_TAIL.test(tail)) {
      NUMBER.lastIndex = numEnd;
      const upper = NUMBER.exec(clean);
      if (!upper || upper.index >= end) return null;
      afterRange = true;
      continue;
    }
    if (DATE_OR_TIME_TAIL.test(tail)) return null;

    // What stands between the label and the number, brackets included: "(PP)", "Direct", "Ratio".
    const between = line.slice(from, m.index);
    const before = line.slice(Math.max(0, labelStart - 30), labelStart);
    if (RATIO.test(between) || (a.not && (a.not.test(between) || a.not.test(before)))) return null;
    // The number must sit next to the label: at most two words away (a range in between aside).
    if (!afterRange) {
      const gap = clean.slice(from, m.index);
      const words = gap.match(/\p{L}+/gu) || [];
      if (words.length > 2 || gap.replace(/\s+/g, " ").length > 30) return null;
    }

    const printed = Number((m[1] + (m[2] || "")).replace(/,/g, ""));
    const raw = (m[0] + tail.match(/^\s*(?:[^\s\d(\[][^\s(\[]{0,13})?/)![0]).replace(/\s+/g, " ").trim();
    const value = a.count ? countPerMicrolitre(a.key, printed, tail) : printed;
    if (value === null) return { ok: false, reason: "unit_unclear", raw };
    if (!(value >= a.min && value <= a.max)) return { ok: false, reason: "implausible", raw };
    return { ok: true, value, raw };
  }
  return null;
}

export interface LabExtraction {
  panel: Panel | null;
  /** Values in the units the Health wallet form uses, plus `male` (1) and `age` when stated. */
  values: Record<string, number>;
  /** For each value, the text it was read from ("1.5 lakh/cumm"), for the patient to check against. */
  sources: Record<string, string>;
  /** Tests that were named but not pre-filled, and why. */
  skipped: { key: string; raw: string; reason: Rejection }[];
}

export function extractLabValues(text: string): LabExtraction {
  const values: Record<string, number> = {};
  const sources: Record<string, string> = {};
  const skipped: LabExtraction["skipped"] = [];
  const votes = new Map<Panel, number>();
  const lines = String(text).split(/\r?\n/).map((line) => ({ line, clean: withoutBrackets(line) }));

  for (const a of ANALYTES) {
    const label = new RegExp(a.label.source, "gi");
    let rejected: { raw: string; reason: Rejection } | null = null;
    search: for (const { line, clean } of lines) {
      label.lastIndex = 0;
      for (let m = label.exec(clean); m; m = label.exec(clean)) {
        const r = readResult(a, line, clean, m.index, m.index + m[0].length);
        if (r?.ok) {
          values[a.key] = r.value;
          sources[a.key] = r.raw;
          votes.set(a.panel, (votes.get(a.panel) || 0) + 1);
          rejected = null;
          break search;
        }
        if (r && r.ok === false && !rejected) rejected = { raw: r.raw, reason: r.reason };
      }
    }
    if (rejected) skipped.push({ key: a.key, ...rejected });
  }

  const panel = [...votes.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || null;
  if (/\b(male|man|पुरुष)\b/i.test(text)) values.male = 1;
  const age = text.match(/\b(\d{1,2})\s*(?:years?|yrs?|yo|साल)\b/i);
  if (age) values.age = Number(age[1]);
  return { panel, values, sources, skipped };
}
