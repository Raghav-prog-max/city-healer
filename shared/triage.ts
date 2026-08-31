/**
 * Offline triage heuristic, shared by the server and the browser fallback.
 *
 * Both used to carry their own copy of this logic, and both carried the same
 * dangerous default. One definition means a safety rule can only be fixed once.
 */
export type OfflineTriage = {
  suspectedCondition: string;
  explanation: string;
  specialistType: string;
  urgencyLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  recommendations: string[];
  flagUrgentSOS: boolean;
  source: "offline-heuristic";
  notAssessed?: boolean;
};

export const hasAny = (text: string, terms: string[]) => terms.some((t) => text.includes(t));

export function triageWithoutAI(symptomsText: string): OfflineTriage {
  const text = String(symptomsText).toLowerCase();
  const base = { source: "offline-heuristic" as const };

  // 1. Not a symptom description at all. Answer the question actually asked
  //    rather than diagnosing a bed search or a price query.
  const looksLikeFacilitySearch =
    hasAny(text, ["bed", "icu ", "icu bed", "hospital near", "near me", "ambulance", "vacancy", "availability"]) &&
    !hasAny(text, ["pain", "hurt", "fever", "breath", "bleed", "injur", "vomit", "cough"]);
  if (looksLikeFacilitySearch) {
    return {
      ...base,
      suspectedCondition: "Not a symptom description",
      explanation:
        "This looks like a search for a facility or a service rather than a description of how you feel. Live bed and ICU availability is on the Hospitals screen, and the SOS button dispatches an ambulance with your location.",
      specialistType: "General Physician",
      urgencyLevel: "LOW",
      recommendations: [
        "Open the Hospitals tab for live bed and ICU vacancy near you",
        "Use SOS if someone needs an ambulance right now",
        "Describe physical symptoms here to get triage guidance"
      ],
      flagUrgentSOS: false,
      notAssessed: true
    };
  }

  // 2. Red flags first. Any of these outrank everything below.
  if (hasAny(text, ["unconscious", "not breathing", "no pulse", "collapsed", "unresponsive", "choking", "overdose", "poison", "suicid", "anaphyla"])) {
    return {
      ...base,
      suspectedCondition: "Possible life-threatening emergency",
      explanation:
        "The words used describe a situation that can deteriorate within minutes. This needs emergency services now, not an app.",
      specialistType: "Emergency Medicine",
      urgencyLevel: "CRITICAL",
      recommendations: [
        "Call emergency services immediately — 112 in India",
        "Trigger SOS so the nearest hospital receives your location",
        "Do not wait for an online assessment"
      ],
      flagUrgentSOS: true
    };
  }

  if (hasAny(text, ["heavy bleeding", "bleeding heavily", "won't stop bleeding", "blood loss", "haemorrhage", "hemorrhage", "broken bone", "fracture", "broken leg", "broken arm", "deep cut", "stab", "gunshot", "severe burn", "head injury", "spinal"])) {
    return {
      ...base,
      suspectedCondition: "Possible major trauma",
      explanation:
        "Serious bleeding or a suspected fracture needs to be seen in person, and can worsen quickly while waiting.",
      specialistType: "Emergency Medicine / Orthopaedics",
      urgencyLevel: "CRITICAL",
      recommendations: [
        "Apply firm direct pressure to any bleeding wound",
        "Do not move a suspected fracture or spinal injury",
        "Trigger SOS or get to the nearest trauma centre now"
      ],
      flagUrgentSOS: true
    };
  }

  if (hasAny(text, ["stroke", "face drooping", "slurred", "numb on one side", "weakness on one side", "seizure", "convulsion", "fitting"])) {
    return {
      ...base,
      suspectedCondition: "Possible stroke or seizure",
      explanation:
        "Sudden one-sided weakness, speech difficulty or a seizure is time-critical — treatment outcomes depend on how quickly it is reached.",
      specialistType: "Neurologist / Emergency Medicine",
      urgencyLevel: "CRITICAL",
      recommendations: [
        "Note the time symptoms started and tell the hospital",
        "Do not give food, drink or medication by mouth",
        "Trigger SOS immediately"
      ],
      flagUrgentSOS: true
    };
  }

  if (hasAny(text, ["chest pain", "chest pressure", "chest tight", "crushing chest", "left arm", "cannot breathe", "can't breathe", "gasping", "shortness of breath", "breathless", "suffocat"])) {
    return {
      ...base,
      suspectedCondition: "Possible cardiac or respiratory distress",
      explanation:
        "Chest pain or serious breathing difficulty can indicate a cardiac event or a severe asthma exacerbation, both of which need urgent assessment.",
      specialistType: "Cardiologist / Pulmonologist",
      urgencyLevel: "CRITICAL",
      recommendations: [
        "Stop all physical activity and sit upright",
        "Use a prescribed inhaler or GTN spray if you have one",
        "Trigger SOS or get to an emergency department now"
      ],
      flagUrgentSOS: true
    };
  }

  // 3. Common non-emergency patterns. Still framed as possibilities, not verdicts.
  if (hasAny(text, ["vomit", "diarrhoea", "diarrhea", "loose motion", "stomach", "abdomen", "abdominal", "nausea"])) {
    return {
      ...base,
      suspectedCondition: "Possible gastrointestinal upset",
      explanation:
        "Stomach pain with nausea or loose stools is commonly infective or dietary, but persistent or severe abdominal pain needs to be examined.",
      specialistType: "Gastroenterologist",
      urgencyLevel: "MEDIUM",
      recommendations: [
        "Take oral rehydration salts in small frequent sips",
        "Avoid heavy or oily food until symptoms settle",
        "Seek care if pain is severe, or there is blood, or it lasts beyond two days"
      ],
      flagUrgentSOS: false
    };
  }

  if (hasAny(text, ["fever", "temperature", "chills", "shivering"])) {
    return {
      ...base,
      suspectedCondition: "Possible febrile illness",
      explanation:
        "Fever is a common response to infection. In Delhi NCR, dengue and seasonal flu both present this way and are distinguished by blood tests, not by symptoms alone.",
      specialistType: "General Physician",
      urgencyLevel: "MEDIUM",
      recommendations: [
        "Maintain fluid intake and rest",
        "Ask a clinician about a blood test if fever persists beyond two days",
        "Seek care urgently for breathlessness, confusion, or a rash that does not fade under pressure"
      ],
      flagUrgentSOS: false
    };
  }

  if (hasAny(text, ["headache", "migraine", "head ache"])) {
    return {
      ...base,
      suspectedCondition: "Possible tension headache or migraine",
      explanation:
        "Recurrent headache is most often tension-type or migraine, though a sudden severe headache unlike any before needs urgent assessment.",
      specialistType: "Neurologist",
      urgencyLevel: "LOW",
      recommendations: [
        "Rest in a quiet, darkened room",
        "Hydrate, and note triggers such as screen time or missed meals",
        "Seek urgent care if it began abruptly and is the worst you have had"
      ],
      flagUrgentSOS: false
    };
  }

  if (hasAny(text, ["cough", "cold", "sore throat", "runny nose", "sneez", "congestion"])) {
    return {
      ...base,
      suspectedCondition: "Possible upper respiratory infection",
      explanation:
        "Cough, sore throat and congestion are usually viral and self-limiting. Delhi's air quality can prolong them or trigger asthma.",
      specialistType: "General Physician",
      urgencyLevel: "LOW",
      recommendations: [
        "Rest, fluids, and steam inhalation",
        "Monitor for breathlessness or wheeze, especially on high-AQI days",
        "See a clinician if it lasts beyond a week or the fever climbs"
      ],
      flagUrgentSOS: false
    };
  }

  // 4. Unrecognised. Say so — never invent a condition to fill the field.
  return {
    ...base,
    suspectedCondition: "Not enough detail to assess",
    explanation:
      "The AI assessment service is unavailable, and the offline fallback could not recognise these symptoms. It has not made a guess, because a wrong guess here is worse than none.",
    specialistType: "General Physician",
    urgencyLevel: "MEDIUM",
    recommendations: [
      "Describe where it hurts, how long it has lasted, and how severe it is",
      "Book a consultation to have this assessed properly",
      "If this is an emergency, use SOS or call 112 rather than waiting"
    ],
    flagUrgentSOS: false,
    notAssessed: true
  };
}

