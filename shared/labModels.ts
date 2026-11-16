/**
 * Lab Report Analyzer: the values from a report go through two things.
 *
 *   1. Reference ranges. Every value is marked LOW / NORMAL / HIGH against adult ranges.
 *      These are rules, not a model, and are labelled as such.
 *   2. A trained risk model (ml/train_lab.py), where the panel has one:
 *        diabetes  logistic regression on the Pima Indians Diabetes Database
 *        heart     logistic regression on the UCI Heart Disease (Cleveland) data
 *        liver     logistic regression on the UCI Indian Liver Patient Dataset
 *      The result is a probability plus the values that pushed it up the most
 *      (coefficient x standardised value), so the patient sees why.
 *
 * It replaces the Gemini call that "interpreted" a fixed sample report.
 */
import labModels from "./lab-models.json";

export type Panel = "diabetes" | "heart" | "liver" | "cbc" | "thyroid";
export type Status = "LOW" | "NORMAL" | "HIGH" | "BORDERLINE";

interface ModelFeature {
  key: string; label: string; unit: string; log: boolean;
  median: number; mean: number; scale: number; coef: number;
}
interface RiskModel {
  features: ModelFeature[];
  intercept: number;
  samples: number;
  positiveRate: number;
  source: string;
  metrics: { cv_accuracy: number; cv_auc: number; test_accuracy: number; test_auc: number; test_sensitivity: number; test_precision: number };
}

const MODELS = (labModels as any).models as Record<"diabetes" | "heart" | "liver", RiskModel>;

export interface RiskResult {
  probability: number;
  level: "LOW" | "MODERATE" | "HIGH";
  drivers: { label: string; value: number | null; effect: number }[];
  imputed: string[];
  model: { name: string; source: string; samples: number; testAccuracy: number; testAuc: number };
}

/** Probability from a trained model; missing inputs take the training median and are reported. */
export function predictRisk(panel: "diabetes" | "heart" | "liver", values: Record<string, unknown>): RiskResult {
  const m = MODELS[panel];
  let z = m.intercept;
  const drivers: RiskResult["drivers"] = [];
  const imputed: string[] = [];
  for (const f of m.features) {
    const raw = values[f.key];
    let v = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(v)) {
      v = f.median;
      imputed.push(f.label);
    }
    const x = f.log ? Math.log1p(Math.max(0, v)) : v;
    const effect = f.coef * ((x - f.mean) / f.scale);
    z += effect;
    drivers.push({ label: f.label, value: Number.isFinite(Number(raw)) && raw !== "" && raw !== null ? Number(raw) : null, effect });
  }
  const probability = 1 / (1 + Math.exp(-z));
  return {
    probability,
    level: probability >= 0.6 ? "HIGH" : probability >= 0.3 ? "MODERATE" : "LOW",
    drivers: drivers.filter((d) => d.value !== null).sort((a, b) => b.effect - a.effect),
    imputed,
    model: {
      name: `Logistic regression (${panel})`,
      source: m.source,
      samples: m.samples,
      testAccuracy: m.metrics.test_accuracy,
      testAuc: m.metrics.test_auc,
    },
  };
}

export const RISK_MODEL_FEATURES = Object.fromEntries(
  Object.entries(MODELS).map(([k, m]) => [k, m.features.map(({ key, label, unit }) => ({ key, label, unit }))]),
) as Record<"diabetes" | "heart" | "liver", { key: string; label: string; unit: string }[]>;

// ---------------------------------------------------------------- reference ranges

interface Range {
  key: string; label: string; unit: string;
  low?: number; high?: number;
  /** Above this (but not above `high`) is borderline rather than normal. */
  borderline?: number;
  /** Range depends on sex: [female, male]. */
  bySex?: { low: [number, number]; high: [number, number] };
}

const RANGES: Record<Panel, Range[]> = {
  diabetes: [
    { key: "glucose", label: "Fasting glucose", unit: "mg/dL", low: 70, borderline: 100, high: 126 },
    { key: "hba1c", label: "HbA1c", unit: "%", borderline: 5.7, high: 6.5 },
    { key: "diastolicBp", label: "Diastolic blood pressure", unit: "mmHg", low: 60, borderline: 80, high: 90 },
    // Asian BMI cut-offs (WHO expert consultation, 2004).
    { key: "bmi", label: "Body-mass index", unit: "kg/m²", low: 18.5, borderline: 23, high: 25 },
  ],
  heart: [
    { key: "cholesterol", label: "Total cholesterol", unit: "mg/dL", borderline: 200, high: 240 },
    { key: "ldl", label: "LDL cholesterol", unit: "mg/dL", borderline: 100, high: 160 },
    { key: "hdl", label: "HDL cholesterol", unit: "mg/dL", bySex: { low: [50, 40], high: [999, 999] } },
    { key: "triglycerides", label: "Triglycerides", unit: "mg/dL", borderline: 150, high: 200 },
    { key: "restingBp", label: "Systolic blood pressure", unit: "mmHg", low: 90, borderline: 120, high: 140 },
  ],
  liver: [
    { key: "totalBilirubin", label: "Total bilirubin", unit: "mg/dL", low: 0.1, high: 1.2 },
    { key: "directBilirubin", label: "Direct bilirubin", unit: "mg/dL", high: 0.3 },
    { key: "alkalinePhosphatase", label: "Alkaline phosphatase (ALP)", unit: "U/L", low: 44, high: 147 },
    { key: "alt", label: "ALT (SGPT)", unit: "U/L", low: 7, high: 56 },
    { key: "ast", label: "AST (SGOT)", unit: "U/L", low: 10, high: 40 },
    { key: "totalProtein", label: "Total protein", unit: "g/dL", low: 6.0, high: 8.3 },
    { key: "albumin", label: "Albumin", unit: "g/dL", low: 3.5, high: 5.0 },
    { key: "agRatio", label: "Albumin / globulin ratio", unit: "", low: 1.1, high: 2.5 },
  ],
  cbc: [
    { key: "haemoglobin", label: "Haemoglobin", unit: "g/dL", bySex: { low: [12, 13], high: [15.5, 17] } },
    { key: "wbc", label: "White blood cells", unit: "/µL", low: 4000, high: 11000 },
    { key: "platelets", label: "Platelets", unit: "/µL", low: 150000, high: 450000 },
    { key: "rbc", label: "Red blood cells", unit: "million/µL", bySex: { low: [4.0, 4.5], high: [5.0, 5.5] } },
    { key: "mcv", label: "Mean corpuscular volume (MCV)", unit: "fL", low: 80, high: 100 },
  ],
  thyroid: [
    { key: "tsh", label: "TSH", unit: "µIU/mL", low: 0.45, high: 4.5 },
    { key: "ft4", label: "Free T4", unit: "ng/dL", low: 0.9, high: 1.7 },
    { key: "ft3", label: "Free T3", unit: "pg/mL", low: 2.0, high: 4.4 },
  ],
};

export interface Flag { key: string; label: string; value: number; unit: string; status: Status; range: string }

export function checkRanges(panel: Panel, values: Record<string, unknown>, male: boolean): Flag[] {
  const flags: Flag[] = [];
  for (const r of RANGES[panel]) {
    const raw = values[r.key];
    if (raw === null || raw === undefined || raw === "") continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    const low = r.bySex ? r.bySex.low[male ? 1 : 0] : r.low;
    const high = r.bySex ? r.bySex.high[male ? 1 : 0] : r.high;
    let status: Status = "NORMAL";
    if (low !== undefined && v < low) status = "LOW";
    else if (high !== undefined && v >= high && high < 999) status = "HIGH";
    else if (r.borderline !== undefined && v >= r.borderline) status = "BORDERLINE";
    const range =
      low !== undefined && high !== undefined && high < 999 ? `${low} – ${high}` :
      high !== undefined && high < 999 ? `below ${r.borderline ?? high}` :
      low !== undefined ? `${low} or more` : "";
    flags.push({ key: r.key, label: r.label, value: v, unit: r.unit, status, range });
  }
  return flags;
}

export const PANEL_FIELDS: Record<Panel, { key: string; label: string; unit: string }[]> = Object.fromEntries(
  (Object.keys(RANGES) as Panel[]).map((p) => {
    const fields = new Map<string, { key: string; label: string; unit: string }>();
    for (const r of RANGES[p]) fields.set(r.key, { key: r.key, label: r.label, unit: r.unit });
    if (p in MODELS) for (const f of RISK_MODEL_FEATURES[p as "diabetes"]) if (!fields.has(f.key)) fields.set(f.key, f);
    return [p, [...fields.values()]];
  }),
) as any;

// ---------------------------------------------------------------- the report

export interface LabAnalysis {
  panel: Panel;
  reportType: string;
  flags: Flag[];
  risk: RiskResult | null;
  interpretation: string;
  urgencyRating: "LOW" | "MEDIUM" | "HIGH";
  recommendedSpecialist: string;
  actions: string[];
  method: string;
}

const PANEL_INFO: Record<Panel, { title: string; specialist: string; condition: string }> = {
  diabetes: { title: "Blood sugar and metabolic panel", specialist: "Endocrinologist / Diabetologist", condition: "diabetes" },
  heart: { title: "Lipid profile and cardiac risk", specialist: "Cardiologist", condition: "heart disease" },
  liver: { title: "Liver function test (LFT)", specialist: "Gastroenterologist / Hepatologist", condition: "liver disease" },
  cbc: { title: "Complete blood count (CBC)", specialist: "General Physician / Haematologist", condition: "" },
  thyroid: { title: "Thyroid function test", specialist: "Endocrinologist", condition: "" },
};

export function analyseLabReport(panel: Panel, values: Record<string, unknown>): LabAnalysis {
  const male = Number(values.male) === 1;
  const flags = checkRanges(panel, values, male);
  const risk = panel === "diabetes" || panel === "heart" || panel === "liver" ? predictRisk(panel, values) : null;
  const abnormal = flags.filter((f) => f.status !== "NORMAL");
  const info = PANEL_INFO[panel];
  const parts: string[] = [];
  const actions: string[] = [];

  if (abnormal.length === 0 && flags.length > 0) parts.push("All the values you entered are within the adult reference range.");
  else if (abnormal.length) parts.push(`Outside the reference range: ${abnormal.map((f) => `${f.label} ${f.value} ${f.unit} (${f.status.toLowerCase()})`).join("; ")}.`);

  if (risk) {
    const pct = Math.round(risk.probability * 100);
    const why = risk.drivers.filter((d) => d.effect > 0.15).slice(0, 3).map((d) => d.label.toLowerCase());
    parts.push(
      `The ${info.condition} model gives a ${risk.level.toLowerCase()} risk score of ${pct}%` +
      (why.length ? `, driven mostly by ${why.join(", ")}.` : ".") +
      ` It was trained on ${risk.model.samples} patients and was right ${Math.round(risk.model.testAccuracy * 100)}% of the time on patients it had not seen.`,
    );
  }

  // Patterns worth naming, from the ranges.
  const s = (k: string) => flags.find((f) => f.key === k)?.status;
  const v = (k: string) => flags.find((f) => f.key === k)?.value;
  if (panel === "cbc" && s("haemoglobin") === "LOW") {
    const mcv = v("mcv");
    parts.push(mcv !== undefined && mcv < 80 ? "Low haemoglobin with small red cells (low MCV) is the usual pattern of iron-deficiency anaemia."
      : mcv !== undefined && mcv > 100 ? "Low haemoglobin with large red cells (high MCV) suggests vitamin B12 or folate deficiency."
      : "Haemoglobin is low (anaemia).");
    actions.push("Eat iron-rich foods such as green leafy vegetables, dals, jaggery and dates, with vitamin C to help absorption");
  }
  if (panel === "cbc" && s("wbc") === "HIGH") parts.push("A raised white-cell count is often a sign of infection or inflammation.");
  if (panel === "cbc" && s("platelets") === "LOW") { parts.push("Low platelets: watch for unusual bruising or bleeding, and rule out dengue if you have a fever."); }
  if (panel === "thyroid") {
    if (s("tsh") === "HIGH") parts.push(s("ft4") === "LOW" ? "High TSH with low free T4 is the pattern of an underactive thyroid (hypothyroidism)." : "High TSH with a normal free T4 suggests subclinical hypothyroidism.");
    if (s("tsh") === "LOW") parts.push(s("ft4") === "HIGH" ? "Low TSH with high free T4 is the pattern of an overactive thyroid (hyperthyroidism)." : "Low TSH can mean an overactive thyroid; it should be rechecked.");
  }
  if (panel === "diabetes") {
    if (s("glucose") === "HIGH" || s("hba1c") === "HIGH") parts.push("Fasting glucose of 126 mg/dL or more, or an HbA1c of 6.5% or more, is in the diabetic range and should be confirmed by a doctor.");
    else if (s("glucose") === "BORDERLINE" || s("hba1c") === "BORDERLINE") parts.push("This is in the prediabetes range, where diet and exercise can still bring it back to normal.");
    actions.push("Prefer millets, whole grains, dals and vegetables; limit sugar, sweets and white rice");
    actions.push("Walk at least 30 minutes a day");
  }
  if (panel === "heart") {
    actions.push("Limit fried food, ghee and red meat; add oats, nuts and fish or flaxseed");
    if (s("restingBp") === "HIGH") actions.push("Reduce salt and recheck blood pressure on three different days");
  }
  if (panel === "liver") {
    actions.push("Avoid alcohol completely until a doctor has reviewed these results");
    if (s("alt") === "HIGH" || s("ast") === "HIGH") actions.push("Ask about hepatitis B and C tests and a liver ultrasound");
  }

  const high = abnormal.filter((f) => f.status === "HIGH" || f.status === "LOW").length;
  const urgencyRating: LabAnalysis["urgencyRating"] =
    (risk && risk.level === "HIGH") || high >= 3 ? "HIGH" : (risk && risk.level === "MODERATE") || high >= 1 ? "MEDIUM" : "LOW";
  actions.push(urgencyRating === "LOW" ? "Repeat the test at your next routine check-up" : `Book a consultation with a ${info.specialist.split(" / ")[0].toLowerCase()} and take this report`);

  return {
    panel,
    reportType: info.title,
    flags,
    risk,
    interpretation: parts.join(" ") || "Enter at least one value from your report.",
    urgencyRating,
    recommendedSpecialist: info.specialist,
    actions,
    method: risk
      ? "Reference-range check plus a logistic-regression model trained in ml/train_lab.py"
      : "Reference-range check (no trained model for this panel)",
  };
}
