/**
 * The seven-module Intelligence Platform (City_Healer_Intelligence_Platform_Seven_Modules.zip),
 * mapped onto what this app runs. The zip is a separate Python/FastAPI baseline; its modules
 * are ported into this server rather than run as a second service, so they share the Firebase
 * identity, rate limits and the models trained in ml/. Where the app already had a stronger
 * implementation (a trained model instead of keyword lists) that one is kept, and the zip's
 * response shape and safety additions are layered on top.
 */
import { predictIntent } from "../../shared/intentModel";
import { detectLang } from "../../shared/triage";
import { extractLabValues } from "./orchestrator";

export const PLATFORM_MODULES = [
  { id: 1, name: "AI Health Copilot", status: "deployed",
    implementation: "server/ai/orchestrator.ts: trained intent model routes each message to the triage, lab, medicine, diet or care models; emergency rules run first",
    endpoints: ["POST /api/ai/copilot", "POST /api/v1/copilot/chat"] },
  { id: 2, name: "Multilingual NLP and Voice", status: "text deployed; voice uses the browser's speech recognition",
    implementation: "shared/intentModel.ts (trained, English / Hindi / Hinglish), language detection, symptom and lab-term entities",
    endpoints: ["POST /api/v1/nlp/analyze"] },
  { id: 3, name: "Medical Document Intelligence", status: "text and text-layer PDF; no OCR",
    implementation: "server/ai/documents.ts: label/value extraction mapped to the lab models' inputs; nothing stored",
    endpoints: ["POST /api/v1/documents/extract"] },
  { id: 4, name: "Predictive ML Engine", status: "deployed",
    implementation: "shared/forecast.ts: mean / linear trend / weekly seasonal, chosen by held-out error; lab risk models (ml/train_lab.py)",
    endpoints: ["POST /api/v1/ml/demand-forecast", "GET /api/v1/ml/demand-forecast?series=appointments|emergencies"] },
  { id: 5, name: "Intelligent Care Discovery", status: "deployed",
    implementation: "hospital ranking (server.ts), facility-name model (ml/train_facility.py), verified-provider ranking with reasons",
    endpoints: ["POST /api/v1/discovery/rank", "GET /api/hospitals", "GET /api/v1/doctors"] },
  { id: 6, name: "Proprietary Model Research", status: "models trained in this repo on open data",
    implementation: "ml/*.py training scripts, reports and parity tests; model cards at /api/ai/models; no proprietary clinical model",
    endpoints: ["GET /api/v1/models"] },
  { id: 7, name: "AI Deployment and Operations", status: "deployed",
    implementation: "server/ai/monitor.ts: per-model calls, abstentions, confidence and latency, with no message text kept",
    endpoints: ["GET /api/ai/monitoring", "GET /api/v1/platform/modules"] },
];

export const DISCLAIMER = "I can share general health information and help you find care, but I cannot diagnose, prescribe, or replace a qualified clinician.";

/** Copilot route names from the zip, for each orchestrator model. */
export function copilotRoute(reply: { intent: string; card?: { type: string } }): string {
  if (reply.intent === "emergency_rule" || reply.intent === "emergency" || reply.card?.type === "emergency") return "urgent_human_care";
  const routes: Record<string, string> = {
    symptoms: "symptom_guidance", lab_report: "document_intelligence", medicine: "medicine_information", diet: "nutrition",
    appointment: "care_discovery", hospital_beds: "care_discovery", insurance: "general_information",
  };
  return routes[reply.intent] || "general_information";
}

// Small, transparent lexicon (the zip's, plus Hindi script). Not a medical NER model.
const ENTITY_TERMS: Array<[string, string]> = [
  ["fever", "fever"], ["bukhar", "fever"], ["बुखार", "fever"],
  ["cough", "cough"], ["khansi", "cough"], ["खांसी", "cough"], ["खाँसी", "cough"],
  ["headache", "headache"], ["sir dard", "headache"], ["सिर दर्द", "headache"], ["सिरदर्द", "headache"],
  ["diabetes", "diabetes"], ["sugar", "diabetes"], ["शुगर", "diabetes"], ["मधुमेह", "diabetes"],
  ["blood pressure", "hypertension"], ["hypertension", "hypertension"], ["bp", "hypertension"], ["बीपी", "hypertension"],
  ["vomiting", "vomiting"], ["ulti", "vomiting"], ["उल्टी", "vomiting"],
  ["diarrhoea", "diarrhoea"], ["diarrhea", "diarrhoea"], ["dast", "diarrhoea"], ["दस्त", "diarrhoea"],
  ["chest pain", "chest pain"], ["seene mein dard", "chest pain"], ["सीने में दर्द", "chest pain"],
  ["breathless", "breathlessness"], ["saans phool", "breathlessness"], ["सांस फूल", "breathlessness"],
  ["rash", "rash"], ["itching", "itching"], ["khujli", "itching"], ["खुजली", "itching"],
];

export function extractEntities(text: string) {
  const low = ` ${String(text).toLowerCase()} `;
  const out: { text: string; normalised: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const [term, norm] of ENTITY_TERMS) {
    const re = /^[a-z ]+$/.test(term) ? new RegExp(`\\b${term}\\b`) : null;
    if ((re ? re.test(low) : low.includes(term)) && !seen.has(norm)) {
      seen.add(norm);
      out.push({ text: term, normalised: norm, label: "symptom_or_condition_candidate" });
    }
  }
  const { values } = extractLabValues(text);
  for (const [k, v] of Object.entries(values)) {
    if (k === "male" || k === "age") continue;
    out.push({ text: `${k} ${v}`, normalised: k, label: "lab_value" });
  }
  return out;
}

export function analyseText(text: string) {
  const intent = predictIntent(text);
  const script = /[ऀ-ॿ]/.test(text) ? "hi" : /\b(hai|hain|mujhe|chahiye|kaise|mera|meri|karna|nahi|kya)\b/i.test(text) ? "hinglish" : detectLang(text);
  return {
    classification: { intent: intent.label, confidence: Math.round(intent.confidence * 1000) / 1000, language: script, method: "trained TF-IDF + logistic regression (ml/train_intent.py)" },
    entities: extractEntities(text),
    warning: "Entity extraction is a small word list, not a validated clinical NLP model.",
  };
}

/**
 * Explainable ranking of verified providers (zip: app/services/discovery.py), with its hard
 * gate: anything not verified and active is never returned, whatever the caller sends.
 */
export function rankProviders(providers: any[], q: { specialty: string; city: string; consultationType?: string | null; preferredLanguage?: string | null }) {
  const lang = q.preferredLanguage ? ({ en: "english", hi: "hindi", hinglish: "hindi" } as Record<string, string>)[q.preferredLanguage] || q.preferredLanguage : null;
  return providers
    .filter((p) => p.verificationStatus === "verified" && p.listingStatus === "active")
    .map((p) => {
      let score = 0;
      const reasons: string[] = [];
      if (String(p.specialty || "").toLowerCase() === q.specialty.toLowerCase()) { score += 50; reasons.push("specialty_match"); }
      if (String(p.city || "").toLowerCase() === q.city.toLowerCase()) { score += 30; reasons.push("city_match"); }
      if (q.consultationType && (p.consultationTypes || []).includes(q.consultationType)) { score += 10; reasons.push("consultation_type_match"); }
      if (lang && (p.languages || []).some((l: string) => String(l).toLowerCase().startsWith(lang))) { score += 5; reasons.push("language_match"); }
      return { provider: p, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}
