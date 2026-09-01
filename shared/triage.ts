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

/** Every term must be present. Used for body-part + symptom pairs. */
export const hasAll = (text: string, terms: string[]) => terms.every((t) => text.includes(t));

/**
 * Hindi puts modifiers inside the phrase — "सीने में दर्द" becomes "सीने में तेज़ दर्द"
 * once you add "severe" — so an exact-phrase match misses the very cases that matter
 * most. Body part and symptom are therefore matched independently and required
 * together, which survives any adjective a speaker drops in between.
 */
const PART = {
  chest: ["सीने", "छाती", "सीना", "seene", "seena", "chhati", "chaati"],
  head:  ["सिर", "सर ", "माथे", "sir ", "sar ", "sirdard", "sir dard"],
  belly: ["पेट", "pet ", "pet"],
  pain:  ["दर्द", "पीड़ा", "जकड़न", "भारीपन", "dard", "peeda"]
} as const;
const A = (x: readonly string[]) => x as unknown as string[];

/**
 * Red-flag vocabulary, in English, Devanagari Hindi and romanised Hindi.
 *
 * This net was English-only, which meant a Hindi speaker describing heavy bleeding
 * or chest pain fell through to "not enough detail to assess" — safe, but useless,
 * and silently so: the transcription looked perfect and only the answer was wrong.
 * Speech recognition set to hi-IN returns Devanagari; people typing the same thing
 * usually romanise it, so both are matched.
 *
 * Single generic words are deliberately excluded from the escalating sets. "दर्द"
 * (pain) appears in headache and chest pain alike, so only the qualified phrase
 * escalates; the bare word is used just to recognise that a message is about a
 * symptom at all.
 */
const T = {
  facility: [
    "bed", "icu ", "icu bed", "hospital near", "near me", "ambulance", "vacancy", "availability",
    "बेड", "बिस्तर", "आईसीयू", "अस्पताल", "एम्बुलेंस", "एंबुलेंस", "खाली",
    "aspataal", "aspatal", "bistar"
  ],
  anySymptom: [
    "pain", "hurt", "fever", "breath", "bleed", "injur", "vomit", "cough",
    "दर्द", "बुखार", "साँस", "सांस", "खून", "रक्त", "चोट", "उल्टी", "खांसी", "तकलीफ",
    "dard", "bukhar", "saans", "khoon", "chot", "ulti", "khansi"
  ],
  lifeThreatening: [
    "unconscious", "not breathing", "no pulse", "collapsed", "unresponsive",
    "choking", "overdose", "poison", "suicid", "anaphyla",
    "बेहोश", "होश नहीं", "साँस नहीं", "सांस नहीं", "नब्ज नहीं", "दम घुट", "ज़हर", "जहर", "गिर पड़ा",
    "behosh", "hosh nahi", "dam ghut", "zeher", "zahar"
  ],
  trauma: [
    "heavy bleeding", "bleeding heavily", "won't stop bleeding", "blood loss",
    "haemorrhage", "hemorrhage", "broken bone", "fracture", "broken leg", "broken arm",
    "deep cut", "stab", "gunshot", "severe burn", "head injury", "spinal",
    "खून बह", "बहुत खून", "रक्तस्राव", "हड्डी टूट", "टूट गई", "फ्रैक्चर",
    "गहरा घाव", "सिर में चोट", "जल गया", "जल गई", "कट गया",
    "khoon beh", "bahut khoon", "haddi toot", "gehra ghaav"
  ],
  neuro: [
    "stroke", "face drooping", "slurred", "numb on one side", "weakness on one side",
    "seizure", "convulsion", "fitting",
    "लकवा", "पक्षाघात", "दौरा पड़", "मिर्गी", "बोलने में दिक्कत", "बोल नहीं", "मुँह टेढ़ा",
    "एक तरफ कमजोर", "सुन्न",
    "lakwa", "daura", "mirgi", "bol nahi"
  ],
  cardioResp: [
    "chest pain", "chest pressure", "chest tight", "crushing chest", "left arm",
    "cannot breathe", "can't breathe", "gasping", "shortness of breath", "breathless", "suffocat",
    "सीने में दर्द", "छाती में दर्द", "सीने में जकड़न", "सीने में भारीपन",
    "साँस लेने में तकलीफ", "सांस लेने में तकलीफ", "साँस फूल", "सांस फूल",
    "दम फूल", "साँस नहीं आ", "सांस नहीं आ", "बाएं हाथ में दर्द",
    "seene mein dard", "chhati mein dard", "saans lene mein", "saans phool", "dam phool"
  ],
  gastro: [
    "vomit", "diarrhoea", "diarrhea", "loose motion", "stomach", "abdomen", "abdominal", "nausea",
    "उल्टी", "दस्त", "पेट में दर्द", "पेट दर्द", "पेट खराब", "जी मिचला", "मतली",
    "ulti", "dast", "pet dard", "pet mein dard"
  ],
  febrile: [
    "fever", "temperature", "chills", "shivering",
    "बुखार", "ज्वर", "ठंड लग", "कंपकंपी", "तेज़ बुखार", "तेज बुखार",
    "bukhar", "thand lag", "tez bukhar"
  ],
  headache: [
    "headache", "migraine", "head ache",
    "सिरदर्द", "सिर दर्द", "सिर में दर्द", "माइग्रेन", "आधासीसी",
    "sir dard", "sar dard", "sirdard"
  ],
  uri: [
    "cough", "cold", "sore throat", "runny nose", "sneez", "congestion",
    "खांसी", "खाँसी", "जुकाम", "ज़ुकाम", "सर्दी", "गले में खराश", "गले में दर्द", "नाक बह", "छींक",
    "khansi", "jukam", "zukam", "sardi", "gale mein"
  ]
} as const;

export function triageWithoutAI(symptomsText: string): OfflineTriage {
  const text = String(symptomsText).toLowerCase();
  const base = { source: "offline-heuristic" as const };

  // 1. Not a symptom description at all. Answer the question actually asked
  //    rather than diagnosing a bed search or a price query.
  const looksLikeFacilitySearch =
    hasAny(text, A(T.facility)) &&
    !hasAny(text, A(T.anySymptom));
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
  if (hasAny(text, A(T.lifeThreatening))) {
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

  if (hasAny(text, A(T.trauma))) {
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

  if (hasAny(text, A(T.neuro))) {
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

  if (hasAny(text, A(T.cardioResp)) || (hasAny(text, A(PART.chest)) && hasAny(text, A(PART.pain)))) {
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
  if (hasAny(text, A(T.gastro)) || (hasAny(text, A(PART.belly)) && hasAny(text, A(PART.pain)))) {
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

  if (hasAny(text, A(T.febrile))) {
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

  if (hasAny(text, A(T.headache)) || (hasAny(text, A(PART.head)) && hasAny(text, A(PART.pain)))) {
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

  if (hasAny(text, A(T.uri))) {
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

