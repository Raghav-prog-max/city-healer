/**
 * i18n Dictionary for City Healer Application
 * Supports English (en) and Hindi (hi)
 */

export type LanguageCode = "en" | "hi";

export interface TranslationDictionary {
  // Brand Header
  brandName: string;
  regionalNetwork: string;
  metropolitanGrid: string;
  rolePatient: string;
  roleDoctor: string;
  roleHospital: string;
  roleAdmin: string;
  profilePrimary: string;
  addPatient: string;
  profileSettings: string;

  // Sidebar Tabs
  tabOverview: string;
  tabSuperApp: string;
  tabSmartNetwork: string;
  tabSymptoms: string;
  tabTrends: string;
  tabBeds: string;
  tabConsultation: string;
  tabPharmacy: string;
  tabRecords: string;
  tabInsurance: string;
  tabSos: string;
  tabAdmin: string;
  tabChn: string;

  // Dashboard Overview
  diagnosticsChecks: string;
  pharmacyOrders: string;
  adherenceQuotient: string;
  liveTracking: string;
  reductionVsTarget: string;
  activeStatusChecks: string;
  activeAlarmsSet: string;
  copilotTelemetry: string;

  // Settings Panel
  settingsPanelTitle: string;
  settingsTabProfiles: string;
  settingsTabActivity: string;
  settingsTabFeatures: string;
  settingsTabSystem: string;
  uiPreferencesHeader: string;
  displayAestheticsTitle: string;
  displayAestheticsDesc: string;
  biometricGateTitle: string;
  biometricGateDesc: string;
  preferredBiometricTitle: string;
  lastChanged: string;
  closeBtn: string;
  
  // Language Selector
  languageSettingsLabel: string;
  languageSelectDesc: string;
  enLabel: string;
  hiLabel: string;
  toastLangSuccess: string;
}

export const translations: Record<LanguageCode, TranslationDictionary> = {
  en: {
    brandName: "City Healer",
    regionalNetwork: "Live Regional Network Connection",
    metropolitanGrid: "/ Metropolitan Medical Grid",
    rolePatient: "Patient / Self",
    roleDoctor: "Doctor Core",
    roleHospital: "Hospital staff",
    roleAdmin: "Admin hub",
    profilePrimary: "Self (Primary User",
    addPatient: "Add Patient",
    profileSettings: "Profile Settings",

    tabOverview: "Dashboard Grid Overview",
    tabSuperApp: "Tier-1 Super-App Suite",
    tabSmartNetwork: "Delhi NCR Smart Network",
    tabSymptoms: "AI Diagnostic Engine",
    tabTrends: "AI Health Trends",
    tabBeds: "Live Bed Census Locator",
    tabConsultation: "Medical Counsel Rooms",
    tabPharmacy: "Pharmacy Delivery Shop",
    tabRecords: "Health Documents Storage",
    tabInsurance: "Insurance Cover Autorouter",
    tabSos: "Ambulance Panic SOS",
    tabAdmin: "Registry Manager",
    tabChn: "City Health Network (CHN)",

    diagnosticsChecks: "CUSTOM DIAGNOSTICS CHECKS",
    pharmacyOrders: "E-PHARMACY PLACED ORDERS",
    adherenceQuotient: "AVERAGED ADHERENCE QUOTIENT",
    liveTracking: "LIVE TRACKING FEED",
    reductionVsTarget: "reduction vs. standard target",
    activeStatusChecks: "Active status checks",
    activeAlarmsSet: "Active dosage alarms set",
    copilotTelemetry: "Clinical copilot active metrics",

    settingsPanelTitle: "Settings Panel",
    settingsTabProfiles: "Identity Profiles",
    settingsTabActivity: "Activity Log",
    settingsTabFeatures: "Copilot Config",
    settingsTabSystem: "System Preferences",
    uiPreferencesHeader: "Security & UI Preferences",
    displayAestheticsTitle: "App Display Aesthetics",
    displayAestheticsDesc: "Toggle high-contrast surgical dark canvas to reduce optic fatigue during late-night clinical shifts.",
    biometricGateTitle: "Simulated Biometric Auth Gateway",
    biometricGateDesc: "Enable immediate bypass credentials using local hardware Touch ID or facial cameras when launching secure sessions.",
    preferredBiometricTitle: "Preferred Biometric Method",
    lastChanged: "Last changed",
    closeBtn: "Close panel",

    languageSettingsLabel: "Application Interface Language",
    languageSelectDesc: "Choose the default localized language for display headers, dashboard charts, and control labels.",
    enLabel: "English (US)",
    hiLabel: "हिन्दी (Hindi)",
    toastLangSuccess: "Interface language updated to English.",
  },
  hi: {
    brandName: "सिटी हीलर",
    regionalNetwork: "लाइव क्षेत्रीय नेटवर्क कनेक्शन",
    metropolitanGrid: "/ महानगरीय चिकित्सा ग्रिड",
    rolePatient: "मरीज / स्वयं",
    roleDoctor: "मुख्य डॉक्टर",
    roleHospital: "अस्पताल स्टाफ",
    roleAdmin: "प्रशासन केंद्र",
    profilePrimary: "स्वयं (मुख्य उपयोगकर्ता",
    addPatient: "नया मरीज जोड़ें",
    profileSettings: "प्रोफ़ाइल सेटिंग्स",

    tabOverview: "डैशबोर्ड ग्रिड ओवरव्यू",
    tabSuperApp: "टियर-1 सुपर-ऐप सुइट",
    tabSmartNetwork: "दिल्ली एनसीआर स्मार्ट नेटवर्क",
    tabSymptoms: "एआई डायग्नोस्टिक इंजन",
    tabTrends: "एआई स्वास्थ्य रुझान",
    tabBeds: "लाइव बेड जनगणना लोकेटर",
    tabConsultation: "चिकित्सा परामर्श कक्ष",
    tabPharmacy: "फार्मेसी डिलीवरी शॉप",
    tabRecords: "स्वास्थ्य दस्तावेज़ भंडारण",
    tabInsurance: "बीमा कवर ऑटोराउटर",
    tabSos: "एम्बुलेंस पैनिक एसओएस",
    tabAdmin: "रजिस्ट्री प्रबंधक",
    tabChn: "सिटी हेल्थ नेटवर्क (CHN)",

    diagnosticsChecks: "कस्टम डायग्नोस्टिक्स जांचें",
    pharmacyOrders: "ई-फार्मेसी ऑर्डर संख्या",
    adherenceQuotient: "औसत दवा अनुपालन गुणांक",
    liveTracking: "लाइव ट्रैकिंग फीड",
    reductionVsTarget: "मानक लक्ष्य की तुलना में कमी",
    activeStatusChecks: "सक्रिय स्थिति जांच",
    activeAlarmsSet: "सक्रिय खुराक अलार्म सेट",
    copilotTelemetry: "क्लीनिकल कोपायलट सक्रिय मीट्रिक",

    settingsPanelTitle: "सेटिंग्स पैनल",
    settingsTabProfiles: "पहचान प्रोफ़ाइल",
    settingsTabActivity: "गतिविधि लॉग",
    settingsTabFeatures: "कोपायलट कॉन्फ़िगरेशन",
    settingsTabSystem: "सिस्टम प्राथमिकताएं",
    uiPreferencesHeader: "सुरक्षा और यूआई प्राथमिकताएं",
    displayAestheticsTitle: "ऐप डिस्प्ले सौंदर्यशास्त्र",
    displayAestheticsDesc: "देर रात की क्लीनिकल शिफ्ट के दौरान आंखों की थकान को कम करने के लिए उच्च-विपरीत डार्क कैनवास चालू करें।",
    biometricGateTitle: "सिम्युलेटेड बायोमेट्रिक प्रमाणीकरण गेटवे",
    biometricGateDesc: "सुरक्षित सत्र शुरू करते समय स्थानीय हार्डवेयर टच आईडी या फेसियल कैमरे का उपयोग करके तत्काल बाईपास सक्षम करें।",
    preferredBiometricTitle: "पसंदीदा बायोमेट्रिक तरीका",
    lastChanged: "अंतिम परिवर्तन",
    closeBtn: "पैनल बंद करें",

    languageSettingsLabel: "एप्लिकेशन इंटरफ़ेस भाषा",
    languageSelectDesc: "डिस्प्ले हेडर, डैशबोर्ड चार्ट और नियंत्रण लेबल के लिए डिफ़ॉल्ट स्थानीयकृत भाषा चुनें।",
    enLabel: "English (अंग्रेज़ी)",
    hiLabel: "हिन्दी (Hindi)",
    toastLangSuccess: "इंटरफ़ेस की भाषा हिन्दी में बदल दी गई है।",
  }
};

/**
 * Returns the localized text for a given key and language code.
 * Falls back to English if key is missing in Hindi.
 */
export function getTranslation(language: LanguageCode, key: keyof TranslationDictionary): string {
  const dictionary = translations[language] || translations.en;
  return dictionary[key] || translations.en[key] || String(key);
}
