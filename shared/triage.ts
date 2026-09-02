/**
 * Offline triage heuristic, shared by the server and the browser fallback.
 *
 * Both used to carry their own copy of this logic, and both carried the same
 * dangerous default. One definition means a safety rule can only be fixed once.
 *
 * Two layers, deliberately separate:
 *   1. Matching decides *what* the message is about, from bilingual term sets.
 *   2. COPY decides *how* that verdict reads, in the caller's language.
 * A safety rule can then be corrected without touching ten strings, and a
 * translation can be corrected without risking a clinical rule.
 */

export type Lang = "en" | "hi";

export type OfflineTriage = {
  suspectedCondition: string;
  explanation: string;
  specialistType: string;
  urgencyLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  recommendations: string[];
  flagUrgentSOS: boolean;
  source: "offline-heuristic";
  lang: Lang;
  notAssessed?: boolean;
};

export const hasAny = (text: string, terms: string[]) => terms.some((t) => text.includes(t));

/** Every term must be present. Used for body-part + symptom pairs. */
export const hasAll = (text: string, terms: string[]) => terms.every((t) => text.includes(t));

/** Devanagari anywhere in the message means answer in Hindi. */
export function detectLang(text: string): Lang {
  return /[ऀ-ॿ]/.test(String(text)) ? "hi" : "en";
}

/**
 * Red-flag vocabulary, in English, Devanagari Hindi and romanised Hindi.
 *
 * This net was English-only, which meant a Hindi speaker describing heavy bleeding
 * or chest pain fell through to "not enough detail to assess" — safe, but useless,
 * and silently so: the transcription looked perfect and only the answer was wrong.
 * Speech recognition set to hi-IN returns Devanagari; people typing the same thing
 * usually romanise it, so both are matched.
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
    "साँस लेने में तकलीफ", "सांस लेने में तकलीफ", "साँस फूल", "सांस फूल",
    "दम फूल", "साँस नहीं आ", "सांस नहीं आ", "बाएं हाथ में दर्द",
    "seene mein dard", "chhati mein dard", "saans lene mein", "saans phool", "dam phool"
  ],
  gastro: [
    "vomit", "diarrhoea", "diarrhea", "loose motion", "stomach", "abdomen", "abdominal", "nausea",
    "उल्टी", "दस्त", "पेट खराब", "जी मिचला", "मतली",
    "ulti", "dast"
  ],
  febrile: [
    "fever", "temperature", "chills", "shivering",
    "बुखार", "ज्वर", "ठंड लग", "कंपकंपी",
    "bukhar", "thand lag", "tez bukhar"
  ],
  headache: [
    "headache", "migraine", "head ache",
    "सिरदर्द", "माइग्रेन", "आधासीसी",
    "sir dard", "sar dard", "sirdard"
  ],
  uri: [
    "cough", "cold", "sore throat", "runny nose", "sneez", "congestion",
    "खांसी", "खाँसी", "जुकाम", "ज़ुकाम", "सर्दी", "गले में खराश", "गले में दर्द", "नाक बह", "छींक",
    "khansi", "jukam", "zukam", "sardi", "gale mein"
  ]
};

/**
 * Hindi puts modifiers inside the phrase — "सीने में दर्द" becomes "सीने में तेज़ दर्द"
 * once you add "severe" — so an exact-phrase match misses the very cases that matter
 * most. Body part and symptom are therefore matched independently and required
 * together, which survives any adjective a speaker drops in between.
 */
const PART = {
  chest: ["सीने", "छाती", "सीना", "seene", "seena", "chhati", "chaati"],
  head: ["सिर", "सर ", "माथे", "sir ", "sar "],
  belly: ["पेट", "pet "],
  pain: ["दर्द", "पीड़ा", "जकड़न", "भारीपन", "dard", "peeda"]
};

type VerdictKey =
  | "notSymptom" | "lifeThreatening" | "trauma" | "neuro" | "cardioResp"
  | "gastro" | "febrile" | "headache" | "uri" | "unknown";

interface Verdict {
  urgencyLevel: OfflineTriage["urgencyLevel"];
  flagUrgentSOS: boolean;
  notAssessed?: boolean;
  en: { condition: string; explanation: string; specialist: string; recommendations: string[] };
  hi: { condition: string; explanation: string; specialist: string; recommendations: string[] };
}

const COPY: Record<VerdictKey, Verdict> = {
  notSymptom: {
    urgencyLevel: "LOW", flagUrgentSOS: false, notAssessed: true,
    en: {
      condition: "Not a symptom description",
      explanation: "This looks like a search for a facility or a service rather than a description of how you feel. Live bed and ICU availability is on the Hospitals screen, and the SOS button dispatches an ambulance with your location.",
      specialist: "General Physician",
      recommendations: [
        "Open the Hospitals tab for live bed and ICU vacancy near you",
        "Use SOS if someone needs an ambulance right now",
        "Describe physical symptoms here to get triage guidance"
      ]
    },
    hi: {
      condition: "यह लक्षणों का विवरण नहीं है",
      explanation: "यह किसी सुविधा या सेवा की खोज लगती है, न कि आप कैसा महसूस कर रहे हैं इसका विवरण। बेड और आईसीयू की मौजूदा उपलब्धता अस्पताल स्क्रीन पर है, और SOS बटन आपकी लोकेशन के साथ एम्बुलेंस भेजता है।",
      specialist: "सामान्य चिकित्सक",
      recommendations: [
        "अपने आसपास बेड और आईसीयू की उपलब्धता देखने के लिए अस्पताल टैब खोलें",
        "यदि किसी को अभी एम्बुलेंस चाहिए तो SOS का उपयोग करें",
        "मार्गदर्शन के लिए यहाँ अपने शारीरिक लक्षण लिखें"
      ]
    }
  },
  lifeThreatening: {
    urgencyLevel: "CRITICAL", flagUrgentSOS: true,
    en: {
      condition: "Possible life-threatening emergency",
      explanation: "The words used describe a situation that can deteriorate within minutes. This needs emergency services now, not an app.",
      specialist: "Emergency Medicine",
      recommendations: [
        "Call emergency services immediately — 112 in India",
        "Trigger SOS so the nearest hospital receives your location",
        "Do not wait for an online assessment"
      ]
    },
    hi: {
      condition: "संभावित जानलेवा आपात स्थिति",
      explanation: "बताए गए शब्द ऐसी स्थिति का वर्णन करते हैं जो मिनटों में बिगड़ सकती है। इसके लिए अभी आपातकालीन सेवा चाहिए, कोई ऐप नहीं।",
      specialist: "आपातकालीन चिकित्सा",
      recommendations: [
        "तुरंत आपातकालीन सेवा को कॉल करें — भारत में 112",
        "SOS दबाएँ ताकि निकटतम अस्पताल तक आपकी लोकेशन पहुँचे",
        "ऑनलाइन आकलन का इंतज़ार न करें"
      ]
    }
  },
  trauma: {
    urgencyLevel: "CRITICAL", flagUrgentSOS: true,
    en: {
      condition: "Possible major trauma",
      explanation: "Serious bleeding or a suspected fracture needs to be seen in person, and can worsen quickly while waiting.",
      specialist: "Emergency Medicine / Orthopaedics",
      recommendations: [
        "Apply firm direct pressure to any bleeding wound",
        "Do not move a suspected fracture or spinal injury",
        "Trigger SOS or get to the nearest trauma centre now"
      ]
    },
    hi: {
      condition: "संभावित गंभीर चोट",
      explanation: "गंभीर रक्तस्राव या हड्डी टूटने की आशंका में मरीज़ को सामने से देखना ज़रूरी है, और इंतज़ार में स्थिति तेज़ी से बिगड़ सकती है।",
      specialist: "आपातकालीन चिकित्सा / हड्डी रोग",
      recommendations: [
        "खून बहने वाले घाव पर मज़बूती से सीधा दबाव डालें",
        "हड्डी टूटने या रीढ़ की चोट की आशंका हो तो मरीज़ को हिलाएँ नहीं",
        "SOS दबाएँ या तुरंत निकटतम ट्रॉमा सेंटर पहुँचें"
      ]
    }
  },
  neuro: {
    urgencyLevel: "CRITICAL", flagUrgentSOS: true,
    en: {
      condition: "Possible stroke or seizure",
      explanation: "Sudden one-sided weakness, speech difficulty or a seizure is time-critical — treatment outcomes depend on how quickly it is reached.",
      specialist: "Neurologist / Emergency Medicine",
      recommendations: [
        "Note the time symptoms started and tell the hospital",
        "Do not give food, drink or medication by mouth",
        "Trigger SOS immediately"
      ]
    },
    hi: {
      condition: "संभावित स्ट्रोक या दौरा",
      explanation: "अचानक शरीर के एक तरफ कमजोरी, बोलने में दिक्कत या दौरा समय-संवेदनशील है — इलाज का नतीजा इस पर निर्भर करता है कि कितनी जल्दी पहुँचा जाए।",
      specialist: "न्यूरोलॉजिस्ट / आपातकालीन चिकित्सा",
      recommendations: [
        "लक्षण कब शुरू हुए, वह समय नोट करें और अस्पताल को बताएँ",
        "मुँह से कुछ भी खाने-पीने या कोई दवा न दें",
        "तुरंत SOS दबाएँ"
      ]
    }
  },
  cardioResp: {
    urgencyLevel: "CRITICAL", flagUrgentSOS: true,
    en: {
      condition: "Possible cardiac or respiratory distress",
      explanation: "Chest pain or serious breathing difficulty can indicate a cardiac event or a severe asthma exacerbation, both of which need urgent assessment.",
      specialist: "Cardiologist / Pulmonologist",
      recommendations: [
        "Stop all physical activity and sit upright",
        "Use a prescribed inhaler or GTN spray if you have one",
        "Trigger SOS or get to an emergency department now"
      ]
    },
    hi: {
      condition: "संभावित हृदय या श्वसन संकट",
      explanation: "सीने में दर्द या साँस लेने में गंभीर कठिनाई हृदय संबंधी घटना या दमे के तेज़ दौरे का संकेत हो सकती है, दोनों में तुरंत जाँच ज़रूरी है।",
      specialist: "हृदय रोग विशेषज्ञ / फेफड़ा रोग विशेषज्ञ",
      recommendations: [
        "सारी शारीरिक गतिविधि रोक दें और सीधे बैठ जाएँ",
        "डॉक्टर की दी हुई इनहेलर या दवा हो तो उसका उपयोग करें",
        "SOS दबाएँ या तुरंत आपातकालीन विभाग पहुँचें"
      ]
    }
  },
  gastro: {
    urgencyLevel: "MEDIUM", flagUrgentSOS: false,
    en: {
      condition: "Possible gastrointestinal upset",
      explanation: "Stomach pain with nausea or loose stools is commonly infective or dietary, but persistent or severe abdominal pain needs to be examined.",
      specialist: "Gastroenterologist",
      recommendations: [
        "Take oral rehydration salts in small frequent sips",
        "Avoid heavy or oily food until symptoms settle",
        "Seek care if pain is severe, or there is blood, or it lasts beyond two days"
      ]
    },
    hi: {
      condition: "संभावित पेट की गड़बड़ी",
      explanation: "मतली या पतले दस्त के साथ पेट दर्द अक्सर संक्रमण या खान-पान से होता है, लेकिन लगातार बना रहने वाला या तेज़ पेट दर्द जाँच माँगता है।",
      specialist: "गैस्ट्रोएंटेरोलॉजिस्ट",
      recommendations: [
        "ओआरएस का घोल थोड़ा-थोड़ा करके बार-बार लें",
        "लक्षण शांत होने तक भारी या तला हुआ भोजन न लें",
        "दर्द तेज़ हो, खून दिखे, या दो दिन से ज़्यादा चले तो डॉक्टर को दिखाएँ"
      ]
    }
  },
  febrile: {
    urgencyLevel: "MEDIUM", flagUrgentSOS: false,
    en: {
      condition: "Possible febrile illness",
      explanation: "Fever is a common response to infection. In Delhi NCR, dengue and seasonal flu both present this way and are distinguished by blood tests, not by symptoms alone.",
      specialist: "General Physician",
      recommendations: [
        "Maintain fluid intake and rest",
        "Ask a clinician about a blood test if fever persists beyond two days",
        "Seek care urgently for breathlessness, confusion, or a rash that does not fade under pressure"
      ]
    },
    hi: {
      condition: "संभावित बुखार जनित बीमारी",
      explanation: "बुखार संक्रमण के प्रति शरीर की सामान्य प्रतिक्रिया है। दिल्ली एनसीआर में डेंगू और मौसमी फ्लू दोनों ऐसे ही दिखते हैं और सिर्फ़ लक्षणों से नहीं, खून की जाँच से अलग पहचाने जाते हैं।",
      specialist: "सामान्य चिकित्सक",
      recommendations: [
        "तरल पदार्थ लेते रहें और आराम करें",
        "बुखार दो दिन से ज़्यादा रहे तो डॉक्टर से खून की जाँच के बारे में पूछें",
        "साँस फूलने, भ्रम, या दबाने पर न मिटने वाले चकत्ते पर तुरंत डॉक्टर के पास जाएँ"
      ]
    }
  },
  headache: {
    urgencyLevel: "LOW", flagUrgentSOS: false,
    en: {
      condition: "Possible tension headache or migraine",
      explanation: "Recurrent headache is most often tension-type or migraine, though a sudden severe headache unlike any before needs urgent assessment.",
      specialist: "Neurologist",
      recommendations: [
        "Rest in a quiet, darkened room",
        "Hydrate, and note triggers such as screen time or missed meals",
        "Seek urgent care if it began abruptly and is the worst you have had"
      ]
    },
    hi: {
      condition: "संभावित तनाव सिरदर्द या माइग्रेन",
      explanation: "बार-बार होने वाला सिरदर्द अक्सर तनाव या माइग्रेन का होता है, हालाँकि अचानक शुरू हुआ ऐसा तेज़ सिरदर्द जो पहले कभी न हुआ हो, तुरंत जाँच माँगता है।",
      specialist: "न्यूरोलॉजिस्ट",
      recommendations: [
        "शांत और अँधेरे कमरे में आराम करें",
        "पानी पिएँ, और स्क्रीन टाइम या भोजन छूटने जैसे कारणों पर ध्यान दें",
        "यदि यह अचानक शुरू हुआ है और अब तक का सबसे तेज़ है तो तुरंत डॉक्टर के पास जाएँ"
      ]
    }
  },
  uri: {
    urgencyLevel: "LOW", flagUrgentSOS: false,
    en: {
      condition: "Possible upper respiratory infection",
      explanation: "Cough, sore throat and congestion are usually viral and self-limiting. Delhi's air quality can prolong them or trigger asthma.",
      specialist: "General Physician",
      recommendations: [
        "Rest, fluids, and steam inhalation",
        "Monitor for breathlessness or wheeze, especially on high-AQI days",
        "See a clinician if it lasts beyond a week or the fever climbs"
      ]
    },
    hi: {
      condition: "संभावित ऊपरी श्वसन संक्रमण",
      explanation: "खांसी, गले में खराश और नाक बंद होना आमतौर पर वायरल होता है और अपने आप ठीक हो जाता है। दिल्ली की हवा इसे लंबा खींच सकती है या दमा भड़का सकती है।",
      specialist: "सामान्य चिकित्सक",
      recommendations: [
        "आराम करें, तरल पदार्थ लें और भाप लें",
        "साँस फूलने या घरघराहट पर ध्यान दें, खासकर ज़्यादा AQI वाले दिनों में",
        "एक हफ़्ते से ज़्यादा चले या बुखार बढ़े तो डॉक्टर को दिखाएँ"
      ]
    }
  },
  unknown: {
    urgencyLevel: "MEDIUM", flagUrgentSOS: false, notAssessed: true,
    en: {
      condition: "Not enough detail to assess",
      explanation: "The AI assessment service is unavailable, and the offline fallback could not recognise these symptoms. It has not made a guess, because a wrong guess here is worse than none.",
      specialist: "General Physician",
      recommendations: [
        "Describe where it hurts, how long it has lasted, and how severe it is",
        "Book a consultation to have this assessed properly",
        "If this is an emergency, use SOS or call 112 rather than waiting"
      ]
    },
    hi: {
      condition: "आकलन के लिए पर्याप्त जानकारी नहीं",
      explanation: "एआई आकलन सेवा उपलब्ध नहीं है, और ऑफ़लाइन फ़ॉलबैक इन लक्षणों को पहचान नहीं सका। इसने अनुमान नहीं लगाया है, क्योंकि यहाँ गलत अनुमान, कोई अनुमान न लगाने से भी बुरा है।",
      specialist: "सामान्य चिकित्सक",
      recommendations: [
        "बताएँ कि तकलीफ कहाँ है, कब से है, और कितनी तेज़ है",
        "इसकी ठीक से जाँच के लिए परामर्श बुक करें",
        "यदि यह आपात स्थिति है तो इंतज़ार न करें — SOS दबाएँ या 112 पर कॉल करें"
      ]
    }
  }
};

/** Decide which verdict the message falls under. Order is severity order. */
function classify(text: string): VerdictKey {
  const looksLikeFacilitySearch = hasAny(text, T.facility) && !hasAny(text, T.anySymptom);
  if (looksLikeFacilitySearch) return "notSymptom";

  if (hasAny(text, T.lifeThreatening)) return "lifeThreatening";
  if (hasAny(text, T.trauma)) return "trauma";
  if (hasAny(text, T.neuro)) return "neuro";
  if (hasAny(text, T.cardioResp) || (hasAny(text, PART.chest) && hasAny(text, PART.pain))) return "cardioResp";
  if (hasAny(text, T.gastro) || (hasAny(text, PART.belly) && hasAny(text, PART.pain))) return "gastro";
  if (hasAny(text, T.febrile)) return "febrile";
  if (hasAny(text, T.headache) || (hasAny(text, PART.head) && hasAny(text, PART.pain))) return "headache";
  if (hasAny(text, T.uri)) return "uri";

  return "unknown";
}

/**
 * Keyword triage used only when the model is unavailable — no key configured, or
 * the API failed. It is a safety net, not a diagnosis engine, and it is written to
 * fail in the safe direction: red-flag wording escalates, and anything unrecognised
 * says so instead of inventing a condition.
 *
 * `lang` is the caller's choice; when omitted it is inferred from the script used.
 */
export function triageWithoutAI(symptomsText: string, lang?: Lang): OfflineTriage {
  const text = String(symptomsText).toLowerCase();
  const language: Lang = lang || detectLang(symptomsText);
  const key = classify(text);
  const v = COPY[key];
  const c = v[language];

  return {
    suspectedCondition: c.condition,
    explanation: c.explanation,
    specialistType: c.specialist,
    urgencyLevel: v.urgencyLevel,
    recommendations: c.recommendations,
    flagUrgentSOS: v.flagUrgentSOS,
    source: "offline-heuristic",
    lang: language,
    ...(v.notAssessed ? { notAssessed: true } : {})
  };
}
