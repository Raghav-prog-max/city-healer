/**
 * Model registry and model cards for City Healer AI.
 *
 * Every model the app uses is listed with its version, what it does, the data it was
 * trained on (with licence), how it was evaluated, the numbers, and its known limits.
 * The metrics are read from the reports the training scripts write, so this page cannot
 * drift from what was actually measured. Served at /api/ai/models.
 */
import triageReport from "../../ml/report.json";
import intentReport from "../../ml/intent_report.json";
import labReport from "../../ml/lab_report.json";
import medicineReport from "../../ml/medicine_report.json";
import dietReport from "../../ml/diet_report.json";
import facilityReport from "../../ml/facility_report.json";
import triageModel from "../../shared/triage-model.json";
import intentModel from "../../shared/intent-model.json";

export interface ModelCard {
  id: string;
  name: string;
  version: string;
  task: string;
  algorithm: string;
  status: "deployed" | "rules";
  trainedBy: string;
  data: { name: string; licence: string; size: string }[];
  metrics: { label: string; value: string }[];
  safety: string[];
  limitations: string[];
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const tr: any = triageReport;
const final = tr.results.final_public_plus_supplement;
const ir: any = intentReport;
const lr: any = labReport;
const mr: any = medicineReport;
const dr: any = dietReport;
const fr: any = facilityReport;

const labCard = (id: "diabetes" | "heart" | "liver", name: string, licence: string): ModelCard => {
  const m = lr[id].models.logistic_regression;
  const others = lr[id].models;
  return {
    id: `${id}-risk-model`,
    name,
    version: "1.0.0",
    task: "Estimate the probability of the condition from values on a lab report",
    algorithm: "Standardised features → logistic regression (class-balanced); chosen over random forest and gradient boosting",
    status: "deployed",
    trainedBy: "ml/train_lab.py",
    data: [{ name: lr[id].source, licence, size: `${lr[id].samples} patients, ${pct(lr[id].positive_rate)} positive` }],
    metrics: [
      { label: "Held-out accuracy", value: pct(m.test_accuracy) },
      { label: "Held-out ROC AUC", value: m.test_auc.toFixed(3) },
      { label: "Sensitivity", value: pct(m.test_sensitivity) },
      { label: "5-fold CV AUC", value: m.cv_auc.toFixed(3) },
      { label: "Random forest AUC (compared)", value: others.random_forest.test_auc.toFixed(3) },
      { label: "Gradient boosting AUC (compared)", value: others.gradient_boosting.test_auc.toFixed(3) },
    ],
    safety: ["Every value is also checked against adult reference ranges", "Shows which values drove the score", "Missing values are filled with the training median and reported as such"],
    limitations: [`Trained on ${lr[id].samples} patients from one population; not validated on City Healer users`, "A screening aid, not a diagnosis"],
  };
};

export const MODEL_CARDS: ModelCard[] = [
  {
    id: "symptom-triage",
    name: "Symptom Intelligence Model",
    version: `${(triageModel as any).version}.0.0`,
    task: "Match a symptom description (English, Hindi, Hinglish) to one of 22 conditions, with urgency and specialist",
    algorithm: "TF-IDF (word 1–2 grams) → multinomial logistic regression; chosen over naive Bayes and linear SVM by 5-fold CV",
    status: "deployed",
    trainedBy: "ml/train.py",
    data: [
      { name: "gretelai/symptom_to_diagnosis", licence: "Apache-2.0", size: `${tr.train_samples.public} sentences` },
      { name: "Project-written English, Hindi and romanised Hindi sentences", licence: "this project", size: `${tr.train_samples.supplement} sentences` },
    ],
    metrics: [
      { label: "Public test accuracy", value: pct(final.public_test.accuracy) },
      { label: "Fresh test accuracy (en/hi/hinglish)", value: pct(final.fresh_test_all.accuracy) },
      { label: "Answers above threshold", value: pct(final.fresh_test_all.answered_share) },
      { label: "Accuracy when it answers", value: pct(final.fresh_test_all.accuracy_when_answered) },
      { label: "Confidently wrong", value: pct(final.fresh_test_all.confidently_wrong_share) },
    ],
    safety: ["Emergency red flags are decided by rules before the model runs", `Abstains below ${tr.confidence_threshold} confidence`, "Never names an emergency as a minor condition: emergencies are not in its training data"],
    limitations: ["The fresh test was written by the project team, not collected from patients", "Covers 22 conditions only"],
  },
  {
    id: "intent-classifier",
    name: "Health Copilot intent model",
    version: `${(intentModel as any).version}.0.0`,
    task: "Decide what a message asks for, so the orchestrator can route it to the right model",
    algorithm: "TF-IDF (word 1–2 grams, numbers as one token) → logistic regression",
    status: "deployed",
    trainedBy: "ml/train_intent.py",
    data: [{ name: "Project-written requests in English, Hindi and romanised Hindi, plus 160 symptom sentences", licence: "this project", size: `${ir.train_sentences} sentences, ${ir.classes.length} intents` }],
    metrics: [
      { label: "Held-out accuracy", value: pct(ir.models.logistic_regression.test_accuracy) },
      { label: "5-fold CV accuracy", value: pct(ir.models.logistic_regression.cv_accuracy) },
      { label: "Held-out English / Hindi / Hinglish", value: `${pct(ir.held_out_by_language.en)} / ${pct(ir.held_out_by_language.hi)} / ${pct(ir.held_out_by_language.hing)}` },
    ],
    safety: ["Below 35% confidence it asks the user to choose instead of guessing", "Runs after the emergency rules, never instead of them"],
    limitations: [`Held-out set is small (${ir.test_sentences} sentences)`],
  },
  labCard("diabetes", "Disease Risk Model: diabetes", "CC0 (NIDDK, via UCI / Kaggle)"),
  labCard("heart", "Disease Risk Model: heart disease", "CC BY 4.0 (UCI)"),
  labCard("liver", "Disease Risk Model: liver disease", "CC BY 4.0 (UCI)"),
  {
    id: "medicine-retrieval",
    name: "Drug Intelligence and search model",
    version: "1.0.0",
    task: "Find a medicine from a misspelt name, search medicines by use, and list same-composition substitutes",
    algorithm: "Two TF-IDF vector spaces with cosine similarity: character 3-grams of names, words of uses and ingredients",
    status: "deployed",
    trainedBy: "ml/build_medicine_index.py",
    data: [{ name: "Medicine_Details (11,000 medicines sold in India, from 1mg)", licence: "public research dataset (Kaggle / Hugging Face)", size: `${mr.records} medicines` }],
    metrics: [
      { label: "Name lookup top-1 (misspelt queries)", value: pct(mr.name_lookup_top1) },
      { label: "Search by use, precision@5", value: pct(mr.use_search_precision_at_5) },
    ],
    safety: ["Only shows facts present in the record; no dosage is invented", "Says when it cannot find a confident match"],
    limitations: ["No dosage or interaction data in the source", "Catalogue snapshot; new products are missing"],
  },
  {
    id: "diet-recommender",
    name: "Nutrition and Diet Planning model",
    version: "1.0.0",
    task: "Build a day's Indian meal plan for a health condition and food preference",
    algorithm: "Content-based recommender over nutrient vectors; gradient-boosting regressor completes missing fibre; K-means nutrient clusters keep plans varied",
    status: "deployed",
    trainedBy: "ml/train_diet.py",
    data: [{ name: "5000 Indian Foods Nutrition Dataset", licence: "MIT", size: `${dr.foods_kept} cooked Indian foods kept of ${dr.foods_raw}` }],
    metrics: [
      { label: "Fibre model error (MAE)", value: `${dr.fibre_model.test_mae_g} g vs ${dr.fibre_model.baseline_category_median_mae_g} g baseline` },
      { label: "Nutrient clusters (k by silhouette)", value: `${dr.kmeans.k}, silhouette ${dr.kmeans.silhouette_by_k[String(dr.kmeans.k)]}` },
    ],
    safety: ["Foods to avoid for each condition are excluded by name", "States calories against the condition's target"],
    limitations: ["The dataset has no sodium, iron or sugar values, so salt and sugar are handled by excluding foods by name", "Condition weights come from guidelines, not learned from outcomes"],
  },
  {
    id: "facility-classifier",
    name: "Hospital listing check (facility-name model)",
    version: "1.0.0",
    task: "Judge from its name whether a map listing is a hospital, clinic, pharmacy, dentist or lab, so mis-tagged listings are marked Unconfirmed and queued for review",
    algorithm: "TF-IDF (word 1-2 grams) → multinomial logistic regression (class-balanced)",
    status: "deployed",
    trainedBy: "ml/train_facility.py",
    data: [
      { name: "OpenStreetMap India health facilities outside Delhi NCR (HDX export), mappers' tags as labels", licence: "ODbL", size: `${fr.labels.hospital + fr.labels.clinic + fr.labels.pharmacy + fr.labels.dentist + fr.labels.laboratory} unique names` },
      { name: "NIN health facility registry (MoHFW) types and CGHS / DGEHS empanelled lists", licence: "Government Open Data / public lists", size: "Delhi NCR" },
    ],
    metrics: [
      { label: "Held-out accuracy (5 kinds)", value: pct(fr.held_out_accuracy) },
      { label: "Hospital precision / recall", value: `${pct(fr.per_class.hospital.precision)} / ${pct(fr.per_class.hospital.recall)}` },
    ],
    safety: ["Never hides a listing on its own: it only marks it Unconfirmed and ranks it lower", "Registry, scheme lists and administrator review override it", "Names that say hospital or nursing home are taken at their word"],
    limitations: ["Judges the name only; OSM labels it learns from are themselves partly wrong", "Delhi NCR listings were left out of training, so its scores on them are honest but untested by hand"],
  },
  {
    id: "demand-forecast",
    name: "Demand forecast (Predictive ML Engine)",
    version: "1.0.0",
    task: "Forecast daily appointment or emergency-alert counts for the next 1-30 days, for planning",
    algorithm: "Mean of last 7 days, linear trend (least squares) and weekly seasonal naive; the lowest held-out error wins and is refitted",
    status: "deployed",
    trainedBy: "shared/forecast.ts (fitted on request; from the Intelligence Platform zip, module 4)",
    data: [{ name: "City Healer daily totals (appointments, emergency alerts), or counts hospital staff supply", licence: "this project", size: "aggregate counts only" }],
    metrics: [{ label: "Reported with every forecast", value: "held-out MAE of each method and of repeating yesterday" }],
    safety: ["Aggregate counts only; never about a patient", "Refuses fewer than 14 days, and says when activity is too sparse"],
    limitations: ["No holidays, weather or outbreaks", "The range is ±1.5 × held-out error, not a statistical interval"],
  },
  {
    id: "document-extraction",
    name: "Lab report reader (Medical Document Intelligence)",
    version: "1.0.0",
    task: "Pull label and value pairs out of an uploaded report and map recognised ones to the lab models' inputs",
    algorithm: "Text and PDF text layer, then pattern extraction; the patient checks the values before the lab models run",
    status: "rules",
    trainedBy: "server/ai/documents.ts (from the Intelligence Platform zip, module 3)",
    data: [{ name: "The patient's own file, read in memory", licence: "not stored", size: "up to 5 MB" }],
    metrics: [{ label: "Tests", value: "tests/platform.test.ts" }],
    safety: ["Nothing is stored or logged", "No interpretation: values go to the form for the patient to confirm"],
    limitations: ["Scanned reports and photos need OCR, which is not set up", "PDF needs the pdfjs-dist package on the server"],
  },
  {
    id: "hospital-ranking",
    name: "Hospital Recommendation model",
    version: "1.0.0",
    task: "Rank hospitals for a condition by department match (listed, empanelled, or expected under IPHS), reported beds, ICU and distance; unconfirmed listings lower",
    algorithm: "Weighted scoring with Haversine distance and specialty-to-department mapping",
    status: "rules",
    trainedBy: "server.ts recommendHospitals, shared/specialties.ts",
    data: [{ name: "City Healer hospital registry", licence: "this project", size: "live database" }],
    metrics: [{ label: "Tests", value: "tests/access-matrix.test.ts (routing by condition)" }],
    safety: ["Critical cases weight ICU availability and distance more"],
    limitations: ["Not learned: there is no outcome data to learn from yet"],
  },
  {
    id: "doctor-ranking",
    name: "Doctor Recommendation model",
    version: "1.0.0",
    task: "Pick doctors of the right category, online first, then nearest, then best rated",
    algorithm: "Specialty mapping + ordered ranking",
    status: "rules",
    trainedBy: "server.ts recommendDoctors, shared/specialties.ts",
    data: [{ name: "City Healer doctor registry", licence: "this project", size: "live database" }],
    metrics: [{ label: "Tests", value: "tests/specialties.test.ts" }],
    safety: [],
    limitations: ["Not learned: no booking outcomes to learn from yet"],
  },
];
