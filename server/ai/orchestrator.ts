/**
 * City Healer AI orchestrator.
 *
 * One entry point for every free-text request (Health Copilot, consultation auto-reply,
 * developer pipeline). For each message:
 *
 *   1. Safety rules first, always. Red-flag wording (unconscious, not breathing, severe
 *      chest pain, heavy bleeding...) escalates to emergency deterministically; no model
 *      can overrule it.
 *   2. The intent model decides what is being asked. Below its confidence threshold the
 *      orchestrator abstains and offers choices instead of guessing.
 *   3. The matching specialised model answers: symptom triage, lab-report risk models,
 *      medicine retrieval, diet recommender, doctor and hospital ranking.
 *   4. Every call is recorded by the monitor (model, confidence, abstention, latency).
 *
 * Everything here runs in this process on models trained in ml/; there is no external API.
 */
import { triageWithoutAI, detectLang, type Lang } from "../../shared/triage";
import { triage } from "../../shared/triageModel";
import { predictIntent, INTENT_THRESHOLD, type Intent } from "../../shared/intentModel";
import { analyseLabReport, type Panel } from "../../shared/labModels";
import { extractLabValues } from "./labValues";
import { doctorCategoryFor } from "../../shared/specialties";
import { lookupMedicine, searchMedicines, substitutesFor } from "../medicineIndex";
import { recommendDiet, parseCondition } from "../dietRecommender";
import { monitor } from "./monitor";

export interface OrchestratorContext {
  lang?: Lang;
  lat?: number;
  lng?: number;
  findHospitals: (specialist: string, urgency: string, lat?: number, lng?: number) => Promise<any[]>;
  findDoctors: (category: string, lat?: number, lng?: number) => Promise<any[]>;
}

export interface CopilotReply {
  intent: Intent | "emergency_rule" | "unsure";
  confidence: number;
  reply: string;
  /** Structured result for the UI to render as a card. */
  card?: { type: "triage" | "lab" | "medicine" | "medicines" | "diet" | "doctors" | "hospitals" | "emergency" | "choices"; data: any };
  /** Screen the UI may offer to open. */
  action?: { label: string; tab: string };
  /** Which models produced this, in order, for transparency and the developer console. */
  trace: { step: string; model: string; detail: string; ms: number }[];
  disclaimer: string;
}

const DISCLAIMER = "Decision support from City Healer's own models, not a diagnosis. For an emergency call 112.";
const DISCLAIMER_HI = "यह City Healer के अपने मॉडल की सहायता है, निदान नहीं। आपात स्थिति में 112 पर कॉल करें।";

const t = (lang: Lang, en: string, hi: string) => (lang === "hi" ? hi : en);

// ---------------------------------------------------------------- lab values in free text

// Reading lab values (labels, Indian number formats, ranges, plausibility) lives in labValues.ts.
export { extractLabValues } from "./labValues";

// ---------------------------------------------------------------- medicine names in free text

const MEDICINE_FILLER = /\b(what|is|are|the|of|for|about|tell|me|info|information|side|effects?|uses?|used|dose|dosage|can|i|take|with|a|an|tablet|tablets|capsule|syrup|medicine|medication|drug|this|does|do|how|work|works|safe|substitute|generic|cheaper|alternative|composition|contains?|kya|hai|hain|ka|ki|ke|kis|kaam|aati|hoti|liye|batao|dawai|dawa|goli|दवा|गोली|क्या|है|के|की|का|किस|काम|आती|बताइए)\b/gi;

const HINDI_TO_ENGLISH: Record<string, string> = {
  bukhar: "fever", "बुखार": "fever", dard: "pain", "दर्द": "pain", khansi: "cough", "खांसी": "cough",
  jukam: "cold", sardi: "cold", "जुकाम": "cold", acidity: "acidity", "एसिडिटी": "acidity", gas: "acidity flatulence",
  dast: "diarrhea", "दस्त": "diarrhea", ulti: "vomiting", "उल्टी": "vomiting", allergy: "allergy", "एलर्जी": "allergy",
  sugar: "diabetes", "शुगर": "diabetes", bp: "hypertension", "बीपी": "hypertension", neend: "insomnia sleep",
  kabz: "constipation", "कब्ज": "constipation", khujli: "itching", "खुजली": "itching",
};

function englishQuery(text: string): string {
  return String(text).toLowerCase().split(/\s+/).map((w) => HINDI_TO_ENGLISH[w] || w).join(" ");
}

// ---------------------------------------------------------------- the orchestrator

export async function orchestrate(message: string, ctx: OrchestratorContext): Promise<CopilotReply> {
  const lang: Lang = ctx.lang || detectLang(message);
  const trace: CopilotReply["trace"] = [];
  const timed = async <T>(step: string, model: string, fn: () => T | Promise<T>, detail: (r: T) => string): Promise<T> => {
    const t0 = performance.now();
    const r = await fn();
    const ms = Math.round((performance.now() - t0) * 10) / 10;
    trace.push({ step, model, detail: detail(r), ms });
    return r;
  };
  const done = (r: Omit<CopilotReply, "trace" | "disclaimer">): CopilotReply => {
    const out = { ...r, trace, disclaimer: t(lang, DISCLAIMER, DISCLAIMER_HI) };
    monitor.record("orchestrator", { confidence: r.confidence, abstained: r.intent === "unsure", label: String(r.intent), ms: trace.reduce((a, b) => a + b.ms, 0) });
    return out;
  };

  // 1. Deterministic emergency escalation.
  const rules = await timed("safety", "safety-rules", () => triageWithoutAI(message, lang), (r) => (r.flagUrgentSOS ? `RED FLAG${r.emergencyCategory ? ` (${r.emergencyCategory})` : ""}` : "no red flag"));
  if (rules.flagUrgentSOS) {
    const hospitals = await ctx.findHospitals("Emergency Medicine", "CRITICAL", ctx.lat, ctx.lng);
    return done({
      intent: "emergency_rule", confidence: 1,
      // Self-harm gets crisis-support wording (helplines first); every other emergency gets 112 / SOS.
      // Never reassurance: these replies only direct the person to immediate human help.
      reply: rules.emergencyCategory === "self_harm"
        ? `${rules.explanation} ${rules.recommendations[0]}${lang === "hi" ? "।" : "."}`
        : t(lang,
          `This sounds like an emergency. Call 112 now, or press SOS to alert the nearest hospital. ${rules.recommendations[0] || ""}`,
          `यह आपात स्थिति लगती है। अभी 112 पर कॉल करें, या नज़दीकी अस्पताल को सूचना देने के लिए SOS दबाएँ। ${rules.recommendations[0] || ""}`),
      card: { type: "emergency", data: { triage: rules, hospitals: hospitals.slice(0, 3) } },
      action: { label: t(lang, "Open Emergency SOS", "आपातकालीन SOS खोलें"), tab: "sos" },
    });
  }

  // 2. What is being asked?
  const intent = await timed("intent", "intent-classifier", () => predictIntent(message), (r) => `${r.label} (${Math.round(r.confidence * 100)}%)`);
  monitor.record("intent-classifier", { confidence: intent.confidence, abstained: intent.confidence < INTENT_THRESHOLD, label: intent.label, knownTerms: intent.knownTerms });

  if (intent.confidence < INTENT_THRESHOLD || intent.knownTerms === 0) {
    return done({
      intent: "unsure", confidence: intent.confidence,
      reply: t(lang, "I'm not sure what you need. Is it one of these?", "मुझे ठीक से समझ नहीं आया। क्या आप इनमें से कुछ पूछ रहे हैं?"),
      card: { type: "choices", data: intent.top.map((x) => x.label) },
    });
  }

  // 3. Route to the specialised model.
  switch (intent.label) {
    case "emergency": {
      const hospitals = await ctx.findHospitals("Emergency Medicine", "CRITICAL", ctx.lat, ctx.lng);
      return done({
        intent: "emergency", confidence: intent.confidence,
        reply: t(lang, "If this is an emergency, call 112 or press SOS. These hospitals have emergency care nearest to you.", "आपात स्थिति हो तो 112 पर कॉल करें या SOS दबाएँ। ये आपके सबसे नज़दीकी आपातकालीन अस्पताल हैं।"),
        card: { type: "hospitals", data: hospitals.slice(0, 3) },
        action: { label: t(lang, "Open Emergency SOS", "आपातकालीन SOS खोलें"), tab: "sos" },
      });
    }

    case "symptoms": {
      const result: any = await timed("answer", "symptom-triage", () => triage(message, lang), (r: any) => `${r.suspectedCondition} via ${r.source}${r.confidence ? ` (${Math.round(r.confidence * 100)}%)` : ""}`);
      monitor.record("symptom-triage", { confidence: result.confidence ?? 0, abstained: result.source !== "ml-model", label: result.suspectedCondition });
      const specialist = result.specialistEn || result.specialistType;
      const category = doctorCategoryFor(specialist);
      const [hospitals, doctors] = await Promise.all([
        ctx.findHospitals(specialist, result.urgencyLevel, ctx.lat, ctx.lng),
        ctx.findDoctors(category, ctx.lat, ctx.lng),
      ]);
      const pct = result.confidence ? ` (${Math.round(result.confidence * 100)}%)` : "";
      return done({
        intent: "symptoms", confidence: intent.confidence,
        reply: result.notAssessed
          ? t(lang, "I need a little more detail to assess this. Describe what you feel, where, and for how long.", "आकलन के लिए थोड़ी और जानकारी दें: क्या महसूस हो रहा है, कहाँ, और कब से।")
          : t(lang, `This most closely matches ${result.suspectedCondition}${pct}. Suggested specialist: ${result.specialistType}.`, `यह सबसे ज़्यादा ${result.suspectedCondition}${pct} से मिलता है। सुझाए गए विशेषज्ञ: ${result.specialistType}।`),
        card: { type: "triage", data: { ...result, recommendedHospitals: hospitals.slice(0, 3), recommendedDoctors: doctors.slice(0, 3), doctorSpecialty: category } },
        action: { label: t(lang, "Open Symptom Checker", "लक्षण जाँच खोलें"), tab: "symptoms" },
      });
    }

    case "lab_report": {
      const { panel, values } = extractLabValues(message);
      if (!panel) {
        return done({
          intent: "lab_report", confidence: intent.confidence,
          reply: t(lang, "Type the values from your report, for example \"haemoglobin 10.5, platelets 140000\" or \"fasting sugar 135, HbA1c 6.8\", or open the Lab Report Analyzer.", "अपनी रिपोर्ट के आंकड़े लिखें, जैसे \"हीमोग्लोबिन 10.5\" या \"शुगर 135\", या लैब रिपोर्ट एनालाइज़र खोलें।"),
          action: { label: t(lang, "Open Lab Report Analyzer", "लैब रिपोर्ट एनालाइज़र खोलें"), tab: "records" },
        });
      }
      const analysis = await timed("answer", panel === "cbc" || panel === "thyroid" ? "reference-ranges" : `${panel}-risk-model`, () => analyseLabReport(panel, values), (r) => r.risk ? `risk ${Math.round(r.risk.probability * 100)}%` : `${r.flags.length} values checked`);
      if (analysis.risk) monitor.record(`${panel}-risk-model`, { confidence: Math.abs(analysis.risk.probability - 0.5) * 2, abstained: false, label: analysis.risk.level });
      return done({
        intent: "lab_report", confidence: intent.confidence,
        reply: analysis.interpretation,
        card: { type: "lab", data: analysis },
        action: { label: t(lang, "Open Lab Report Analyzer", "लैब रिपोर्ट एनालाइज़र खोलें"), tab: "records" },
      });
    }

    case "medicine": {
      const name = message.replace(MEDICINE_FILLER, " ").replace(/[?.,!]/g, " ").replace(/\s+/g, " ").trim();
      const found = await timed("answer", "medicine-retrieval", () => lookupMedicine(name || message), (r) => r.match ? `${r.match.name} (similarity ${r.similarity.toFixed(2)})` : "no confident name match");
      monitor.record("medicine-retrieval", { confidence: found.similarity, abstained: !found.match || found.similarity < 0.5, label: found.match?.name || "none" });
      if (found.match && found.similarity >= 0.5) {
        const subs = substitutesFor(found.match.name, 3);
        return done({
          intent: "medicine", confidence: intent.confidence,
          reply: t(lang,
            `${found.match.name} contains ${found.match.composition}. Used for: ${found.match.uses.slice(0, 3).join(", ") || "see the label"}.`,
            `${found.match.name} में ${found.match.composition} है। उपयोग: ${found.match.uses.slice(0, 3).join(", ") || "लेबल देखें"}।`),
          card: { type: "medicine", data: { ...found.match, substitutes: subs, matchedIngredient: found.ingredient } },
          action: { label: t(lang, "Open Pharmacy", "फार्मेसी खोलें"), tab: "pharmacy" },
        });
      }
      const results = await timed("answer", "medicine-retrieval", () => searchMedicines(englishQuery(message), 5), (r) => `${r.length} results by use`);
      return done({
        intent: "medicine", confidence: intent.confidence,
        reply: results.length
          ? t(lang, "Medicines commonly used for this (ask a doctor or pharmacist before taking any):", "इसके लिए आमतौर पर इस्तेमाल होने वाली दवाएँ (लेने से पहले डॉक्टर या फार्मासिस्ट से पूछें):")
          : t(lang, "I couldn't find that medicine. Check the spelling or type the name on the strip.", "यह दवा नहीं मिली। स्पेलिंग जाँचें या पत्ते पर लिखा नाम लिखें।"),
        card: results.length ? { type: "medicines", data: results } : undefined,
      });
    }

    case "diet": {
      const condition = parseCondition(message);
      const veg = !/non.?veg|chicken|fish|egg|mutton|meat|नॉन/i.test(message);
      const plan = await timed("answer", "diet-recommender", () => recommendDiet(condition, veg ? "veg" : "non-veg"), (r) => `${r.conditionKey}, ${r.totalKcal} kcal`);
      monitor.record("diet-recommender", { confidence: 1, abstained: false, label: plan.conditionKey });
      return done({
        intent: "diet", confidence: intent.confidence,
        reply: t(lang, `A ${plan.dietOption.toLowerCase()} day plan for ${plan.condition.toLowerCase()}, about ${plan.totalKcal} kcal:`, `${plan.condition} के लिए ${plan.dietOption === "Vegetarian" ? "शाकाहारी" : "मांसाहारी"} दिन का प्लान, लगभग ${plan.totalKcal} kcal:`),
        card: { type: "diet", data: plan },
        action: { label: t(lang, "Open Diet Planner", "डाइट प्लानर खोलें"), tab: "chn" },
      });
    }

    case "appointment": {
      const category = doctorCategoryFor(message.replace(/heart|दिल/i, "cardiologist").replace(/child|bacch|बच्च/i, "pediatric").replace(/skin/i, "dermatologist"));
      const doctors = await timed("answer", "doctor-ranking", () => ctx.findDoctors(category, ctx.lat, ctx.lng), (r) => `${r.length} ${category}s`);
      return done({
        intent: "appointment", confidence: intent.confidence,
        reply: doctors.length
          ? t(lang, `${category}s available now, nearest and online first:`, `अभी उपलब्ध ${category}, नज़दीकी और ऑनलाइन पहले:`)
          : t(lang, "No doctor of that kind is listed yet.", "इस तरह के डॉक्टर अभी सूची में नहीं हैं।"),
        card: { type: "doctors", data: doctors },
        action: { label: t(lang, "Open Consultations", "परामर्श खोलें"), tab: "consultation" },
      });
    }

    case "hospital_beds": {
      const hospitals = await timed("answer", "hospital-ranking", () => ctx.findHospitals("General Physician", "MEDIUM", ctx.lat, ctx.lng), (r) => `${r.length} hospitals`);
      return done({
        intent: "hospital_beds", confidence: intent.confidence,
        reply: t(lang, ctx.lat ? "Hospitals nearest to you, with free beds:" : "Hospitals with free beds (share your location to sort by distance):", ctx.lat ? "आपके सबसे नज़दीकी अस्पताल, खाली बेड के साथ:" : "खाली बेड वाले अस्पताल (दूरी से क्रम के लिए अपना स्थान साझा करें):"),
        card: { type: "hospitals", data: hospitals.slice(0, 4) },
        action: { label: t(lang, "Open Bed Census", "बेड सेंसस खोलें"), tab: "beds" },
      });
    }

    case "insurance":
      return done({
        intent: "insurance", confidence: intent.confidence,
        reply: t(lang, "The Insurance screen shows your policy, which hospitals are cashless for it, and your claims.", "बीमा स्क्रीन पर आपकी पॉलिसी, कैशलेस अस्पताल और क्लेम दिखते हैं।"),
        action: { label: t(lang, "Open Insurance", "बीमा खोलें"), tab: "insurance" },
      });

    case "thanks":
      return done({ intent: "thanks", confidence: intent.confidence, reply: t(lang, "You're welcome. Take care!", "आपका स्वागत है। अपना ध्यान रखें!") });

    case "greeting":
    default:
      return done({
        intent: "greeting", confidence: intent.confidence,
        reply: t(lang,
          "Hello! I'm the City Healer Health Copilot. Describe a symptom, paste values from a lab report, ask about a medicine or a diet, or ask for a doctor or a hospital bed.",
          "नमस्ते! मैं City Healer हेल्थ कोपायलट हूँ। लक्षण बताइए, रिपोर्ट के आंकड़े लिखिए, किसी दवा या डाइट के बारे में पूछिए, या डॉक्टर या अस्पताल का बेड खोजिए।"),
        card: { type: "choices", data: ["symptoms", "lab_report", "medicine", "diet", "appointment", "hospital_beds"] },
      });
  }
}
