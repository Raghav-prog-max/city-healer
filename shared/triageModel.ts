/**
 * Trained symptom-triage model, and the hybrid triage that combines it with the
 * safety rules in ./triage.
 *
 * The weights in ./triage-model.json come from ml/train.py: TF-IDF over word 1-2
 * grams, then multinomial logistic regression, trained on symptom descriptions in
 * English, Hindi and romanised Hindi across 22 conditions. Inference is re-implemented here so the server
 * needs no Python at runtime; tests/triage-model.test.ts checks it against
 * scikit-learn's own predictions.
 *
 * The model is deliberately not the last word:
 *   1. Red-flag wording is decided by the rules first. The training data holds no
 *      emergencies, so the model cannot be trusted to recognise one.
 *   2. The model answers only above a confidence threshold.
 *   3. Below it, the rules answer, and they say "not assessed" rather than guess.
 */
import model from "./triage-model.json";
import { createTextClassifier, type TextModelJson } from "./textClassifier";
import { triageWithoutAI, detectLang, type Lang, type OfflineTriage } from "./triage";

type Urgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ModelPrediction {
  label: string;
  confidence: number;
  /** Tokens of the input the model has seen in training. */
  knownTerms: number;
  top: { label: string; confidence: number }[];
}

export type TriageResult = Omit<OfflineTriage, "source"> & {
  source: "ml-model" | "safety-rules" | "offline-heuristic";
  confidence?: number;
  alternatives?: { condition: string; confidence: number }[];
};

/** Below this the model's top guess is right too rarely to show (see ml/report.json). */
export const CONFIDENCE_THRESHOLD = 0.4;
const MIN_KNOWN_TERMS = 3;

/** Shown in the UI and on /api/health. */
export const TRIAGE_MODEL_LABEL = `City Healer triage model v${model.version} (TF-IDF + logistic regression)`;

const classify = createTextClassifier(model as TextModelJson);

export function predictCondition(text: string): ModelPrediction {
  return classify(text);
}

interface ConditionCopy {
  condition: string;
  explanation: string;
  specialist: string;
  recommendations: string[];
}
interface ConditionInfo {
  urgency: Urgency;
  en: ConditionCopy;
  hi: ConditionCopy;
}

/** What to tell the patient for each condition the model can predict. */
export const CONDITIONS: Record<string, ConditionInfo> = {
  allergy: {
    urgency: "LOW",
    en: { condition: "Possible allergy", explanation: "Sneezing, itching, watery eyes or a rash after exposure to a trigger usually points to an allergic reaction.", specialist: "Allergist / General Physician", recommendations: ["Avoid the suspected trigger such as dust, pollen or a particular food", "Ask a pharmacist or doctor about an antihistamine", "Seek urgent care for swelling of the lips or throat, or difficulty breathing"] },
    hi: { condition: "संभावित एलर्जी", explanation: "किसी चीज़ के संपर्क के बाद छींक, खुजली, आँखों से पानी या चकत्ते आमतौर पर एलर्जी का संकेत होते हैं।", specialist: "एलर्जी विशेषज्ञ / सामान्य चिकित्सक", recommendations: ["धूल, पराग या किसी खास भोजन जैसे संभावित कारण से बचें", "एंटीहिस्टामिन के बारे में डॉक्टर या फार्मासिस्ट से पूछें", "होंठ या गले में सूजन या साँस लेने में तकलीफ हो तो तुरंत डॉक्टर के पास जाएँ"] },
  },
  arthritis: {
    urgency: "LOW",
    en: { condition: "Possible arthritis", explanation: "Joint pain, stiffness and swelling, often worse in the morning or after rest, are typical of arthritis.", specialist: "Rheumatologist / Orthopaedician", recommendations: ["Keep the joints moving with gentle exercise", "Use warm compresses for stiffness", "See a doctor for an examination and blood tests"] },
    hi: { condition: "संभावित गठिया", explanation: "जोड़ों में दर्द, जकड़न और सूजन, जो अक्सर सुबह या आराम के बाद बढ़ती है, गठिया के सामान्य लक्षण हैं।", specialist: "रुमेटोलॉजिस्ट / हड्डी रोग विशेषज्ञ", recommendations: ["हल्के व्यायाम से जोड़ों को चलाते रहें", "जकड़न के लिए गर्म सिकाई करें", "जाँच और खून की जाँच के लिए डॉक्टर को दिखाएँ"] },
  },
  "bronchial asthma": {
    urgency: "HIGH",
    en: { condition: "Possible bronchial asthma", explanation: "Wheezing, chest tightness, cough and breathlessness suggest narrowed airways, which Delhi's air quality can make worse.", specialist: "Pulmonologist", recommendations: ["Use your prescribed reliever inhaler if you have one", "Move away from smoke, dust and polluted air", "Use SOS or go to emergency if you cannot speak in full sentences or the inhaler does not help"] },
    hi: { condition: "संभावित दमा (अस्थमा)", explanation: "घरघराहट, सीने में जकड़न, खांसी और साँस फूलना साँस की नलियों के सिकुड़ने का संकेत है, जिसे दिल्ली की हवा और बिगाड़ सकती है।", specialist: "फेफड़ा रोग विशेषज्ञ", recommendations: ["यदि डॉक्टर की दी हुई इनहेलर है तो उसका उपयोग करें", "धुएँ, धूल और प्रदूषित हवा से दूर रहें", "यदि पूरा वाक्य न बोल पाएँ या इनहेलर से आराम न मिले तो SOS दबाएँ या आपातकालीन विभाग जाएँ"] },
  },
  "cervical spondylosis": {
    urgency: "LOW",
    en: { condition: "Possible cervical spondylosis", explanation: "Neck pain and stiffness that may spread to the shoulders or arms is commonly caused by wear of the neck bones and discs.", specialist: "Orthopaedician / Neurologist", recommendations: ["Avoid long hours with the neck bent over a phone or laptop", "Do gentle neck stretches and use a supportive pillow", "See a doctor if there is numbness, weakness or loss of balance"] },
    hi: { condition: "संभावित सर्वाइकल स्पॉन्डिलोसिस", explanation: "गर्दन में दर्द और जकड़न, जो कंधों या बाँहों तक फैल सकती है, अक्सर गर्दन की हड्डियों और डिस्क के घिसने से होती है।", specialist: "हड्डी रोग विशेषज्ञ / न्यूरोलॉजिस्ट", recommendations: ["फोन या लैपटॉप पर लंबे समय तक गर्दन झुकाकर न बैठें", "गर्दन के हल्के व्यायाम करें और सहारा देने वाला तकिया लें", "सुन्नपन, कमजोरी या संतुलन बिगड़ने पर डॉक्टर को दिखाएँ"] },
  },
  "chicken pox": {
    urgency: "MEDIUM",
    en: { condition: "Possible chicken pox", explanation: "An itchy rash of small fluid-filled blisters with fever and tiredness is typical of chicken pox, which spreads easily.", specialist: "General Physician / Dermatologist", recommendations: ["Stay home and away from pregnant women, infants and the elderly", "Do not scratch the blisters; keep nails short", "See a doctor, especially for adults or if fever is high"] },
    hi: { condition: "संभावित चिकन पॉक्स (छोटी माता)", explanation: "बुखार और थकान के साथ पानी भरे छोटे दानों वाले खुजलीदार चकत्ते चिकन पॉक्स के लक्षण हैं, जो आसानी से फैलता है।", specialist: "सामान्य चिकित्सक / त्वचा रोग विशेषज्ञ", recommendations: ["घर पर रहें और गर्भवती महिलाओं, शिशुओं व बुज़ुर्गों से दूर रहें", "दानों को न खुजलाएँ; नाखून छोटे रखें", "डॉक्टर को दिखाएँ, खासकर वयस्कों में या तेज़ बुखार होने पर"] },
  },
  "common cold": {
    urgency: "LOW",
    en: { condition: "Possible common cold", explanation: "A runny or blocked nose, sneezing, sore throat and mild cough are usually a viral cold that settles on its own.", specialist: "General Physician", recommendations: ["Rest, drink warm fluids and inhale steam", "Watch for breathlessness or wheeze, especially on high-AQI days", "See a doctor if it lasts beyond a week or the fever climbs"] },
    hi: { condition: "संभावित सामान्य सर्दी-जुकाम", explanation: "नाक बहना या बंद होना, छींक, गले में खराश और हल्की खांसी आमतौर पर वायरल जुकाम है जो अपने आप ठीक हो जाता है।", specialist: "सामान्य चिकित्सक", recommendations: ["आराम करें, गर्म तरल पिएँ और भाप लें", "साँस फूलने या घरघराहट पर ध्यान दें, खासकर ज़्यादा AQI वाले दिनों में", "एक हफ़्ते से ज़्यादा चले या बुखार बढ़े तो डॉक्टर को दिखाएँ"] },
  },
  dengue: {
    urgency: "HIGH",
    en: { condition: "Possible dengue", explanation: "High fever with severe body and joint pain, pain behind the eyes and a rash suggests dengue, which is confirmed only by a blood test.", specialist: "General Physician", recommendations: ["Get a blood test (NS1 and platelet count) today", "Drink plenty of fluids; take only paracetamol, not aspirin or ibuprofen", "Go to hospital urgently for bleeding, severe stomach pain or repeated vomiting"] },
    hi: { condition: "संभावित डेंगू", explanation: "तेज़ बुखार के साथ बदन और जोड़ों में तेज़ दर्द, आँखों के पीछे दर्द और चकत्ते डेंगू का संकेत हैं, जिसकी पुष्टि सिर्फ़ खून की जाँच से होती है।", specialist: "सामान्य चिकित्सक", recommendations: ["आज ही खून की जाँच (NS1 और प्लेटलेट काउंट) करवाएँ", "खूब तरल पिएँ; सिर्फ़ पैरासिटामोल लें, एस्पिरिन या आइबुप्रोफेन नहीं", "खून बहने, पेट में तेज़ दर्द या बार-बार उल्टी होने पर तुरंत अस्पताल जाएँ"] },
  },
  diabetes: {
    urgency: "MEDIUM",
    en: { condition: "Possible diabetes", explanation: "Excessive thirst, frequent urination, tiredness and slow-healing wounds can mean raised blood sugar.", specialist: "Endocrinologist / Diabetologist", recommendations: ["Get fasting blood sugar and HbA1c tested", "Cut down on sugary drinks and refined carbohydrates", "See a doctor soon; go urgently if there is vomiting, confusion or fast breathing"] },
    hi: { condition: "संभावित मधुमेह (डायबिटीज़)", explanation: "बहुत प्यास लगना, बार-बार पेशाब आना, थकान और घाव देर से भरना खून में शुगर बढ़ने का संकेत हो सकता है।", specialist: "एंडोक्राइनोलॉजिस्ट / मधुमेह विशेषज्ञ", recommendations: ["खाली पेट शुगर और HbA1c की जाँच करवाएँ", "मीठे पेय और मैदे वाली चीज़ें कम करें", "जल्द डॉक्टर को दिखाएँ; उल्टी, भ्रम या तेज़ साँस होने पर तुरंत जाएँ"] },
  },
  "drug reaction": {
    urgency: "HIGH",
    en: { condition: "Possible drug reaction", explanation: "A rash, itching or swelling that starts after a new medicine may be a reaction to that medicine.", specialist: "General Physician / Dermatologist", recommendations: ["Contact the prescribing doctor before taking the next dose", "Note the name of every medicine started recently", "Use SOS for swelling of the face or throat, breathing difficulty or skin peeling"] },
    hi: { condition: "संभावित दवा की प्रतिक्रिया", explanation: "नई दवा शुरू करने के बाद चकत्ते, खुजली या सूजन उस दवा की प्रतिक्रिया हो सकती है।", specialist: "सामान्य चिकित्सक / त्वचा रोग विशेषज्ञ", recommendations: ["अगली खुराक लेने से पहले दवा लिखने वाले डॉक्टर से संपर्क करें", "हाल में शुरू की गई हर दवा का नाम नोट करें", "चेहरे या गले में सूजन, साँस में तकलीफ या त्वचा उतरने पर SOS दबाएँ"] },
  },
  "fungal infection": {
    urgency: "LOW",
    en: { condition: "Possible fungal skin infection", explanation: "Itchy, red, ring-shaped or scaly patches, often in skin folds, are commonly caused by a fungal infection.", specialist: "Dermatologist", recommendations: ["Keep the area clean and dry; wear loose cotton clothing", "Do not use steroid creams without a prescription", "See a dermatologist for the right antifungal treatment"] },
    hi: { condition: "संभावित फंगल त्वचा संक्रमण", explanation: "खुजलीदार, लाल, गोल या पपड़ीदार चकत्ते, जो अक्सर त्वचा की सिलवटों में होते हैं, आमतौर पर फंगल संक्रमण से होते हैं।", specialist: "त्वचा रोग विशेषज्ञ", recommendations: ["जगह को साफ और सूखा रखें; ढीले सूती कपड़े पहनें", "बिना पर्चे के स्टेरॉयड क्रीम न लगाएँ", "सही एंटीफंगल इलाज के लिए त्वचा रोग विशेषज्ञ को दिखाएँ"] },
  },
  "gastroesophageal reflux disease": {
    urgency: "LOW",
    en: { condition: "Possible acid reflux (GERD)", explanation: "A burning feeling in the chest or throat after meals or when lying down is usually stomach acid flowing back up.", specialist: "Gastroenterologist", recommendations: ["Eat smaller meals and avoid lying down for two hours after eating", "Cut down on spicy, oily food, tea and coffee", "Chest pain with sweating, breathlessness or pain in the arm is an emergency: use SOS"] },
    hi: { condition: "संभावित एसिड रिफ्लक्स (GERD)", explanation: "खाने के बाद या लेटने पर सीने या गले में जलन आमतौर पर पेट के एसिड के ऊपर आने से होती है।", specialist: "गैस्ट्रोएंटेरोलॉजिस्ट", recommendations: ["थोड़ा-थोड़ा खाएँ और खाने के दो घंटे बाद तक न लेटें", "मसालेदार, तला हुआ भोजन, चाय और कॉफी कम करें", "पसीने, साँस फूलने या बाँह में दर्द के साथ सीने में दर्द आपात स्थिति है: SOS दबाएँ"] },
  },
  hypertension: {
    urgency: "MEDIUM",
    en: { condition: "Possible high blood pressure", explanation: "Headache, dizziness and a pounding feeling can accompany raised blood pressure, which needs to be measured to confirm.", specialist: "General Physician / Cardiologist", recommendations: ["Have your blood pressure measured today", "Reduce salt and take prescribed medicines regularly", "Use SOS for chest pain, sudden weakness, trouble speaking or severe headache"] },
    hi: { condition: "संभावित उच्च रक्तचाप", explanation: "सिरदर्द, चक्कर और धड़कन महसूस होना बढ़े हुए ब्लड प्रेशर के साथ हो सकता है, जिसकी पुष्टि नापने से ही होती है।", specialist: "सामान्य चिकित्सक / हृदय रोग विशेषज्ञ", recommendations: ["आज ही अपना ब्लड प्रेशर नपवाएँ", "नमक कम करें और डॉक्टर की दी हुई दवा नियमित लें", "सीने में दर्द, अचानक कमजोरी, बोलने में दिक्कत या तेज़ सिरदर्द पर SOS दबाएँ"] },
  },
  impetigo: {
    urgency: "LOW",
    en: { condition: "Possible impetigo", explanation: "Red sores that burst and form honey-coloured crusts, often around the nose and mouth, are typical of this contagious skin infection.", specialist: "Dermatologist", recommendations: ["Wash the sores gently and keep them covered", "Do not share towels or bedding", "See a doctor for antibiotic cream or tablets"] },
    hi: { condition: "संभावित इम्पेटिगो (त्वचा संक्रमण)", explanation: "लाल घाव जो फूटकर शहद जैसे रंग की पपड़ी बनाते हैं, अक्सर नाक और मुँह के आसपास, इस संक्रामक त्वचा रोग के लक्षण हैं।", specialist: "त्वचा रोग विशेषज्ञ", recommendations: ["घावों को हल्के से धोएँ और ढककर रखें", "तौलिया या बिस्तर साझा न करें", "एंटीबायोटिक क्रीम या दवा के लिए डॉक्टर को दिखाएँ"] },
  },
  jaundice: {
    urgency: "MEDIUM",
    en: { condition: "Possible jaundice", explanation: "Yellowing of the skin and eyes with dark urine and tiredness points to a liver or bile problem that needs tests.", specialist: "Gastroenterologist / Hepatologist", recommendations: ["Get liver function tests done within a day or two", "Avoid alcohol and oily food; drink clean, boiled water", "Go to hospital for confusion, severe stomach pain or vomiting blood"] },
    hi: { condition: "संभावित पीलिया", explanation: "गहरे पेशाब और थकान के साथ त्वचा और आँखों का पीला पड़ना लिवर या पित्त की समस्या का संकेत है, जिसकी जाँच ज़रूरी है।", specialist: "गैस्ट्रोएंटेरोलॉजिस्ट / लिवर विशेषज्ञ", recommendations: ["एक-दो दिन में लिवर की जाँच (LFT) करवाएँ", "शराब और तले हुए भोजन से बचें; साफ, उबला हुआ पानी पिएँ", "भ्रम, पेट में तेज़ दर्द या खून की उल्टी होने पर अस्पताल जाएँ"] },
  },
  malaria: {
    urgency: "HIGH",
    en: { condition: "Possible malaria", explanation: "Fever that comes with chills and shivering, followed by sweating, suggests malaria, which is confirmed by a blood test.", specialist: "General Physician", recommendations: ["Get a malaria blood test today", "Drink fluids and take paracetamol for fever", "Go to hospital urgently for confusion, fits, breathlessness or very dark urine"] },
    hi: { condition: "संभावित मलेरिया", explanation: "ठंड और कंपकंपी के साथ आने वाला बुखार, जिसके बाद पसीना आता है, मलेरिया का संकेत है; इसकी पुष्टि खून की जाँच से होती है।", specialist: "सामान्य चिकित्सक", recommendations: ["आज ही मलेरिया की खून की जाँच करवाएँ", "तरल पदार्थ पिएँ और बुखार के लिए पैरासिटामोल लें", "भ्रम, दौरे, साँस फूलने या बहुत गहरे पेशाब पर तुरंत अस्पताल जाएँ"] },
  },
  migraine: {
    urgency: "LOW",
    en: { condition: "Possible migraine", explanation: "A throbbing headache, often on one side, with nausea and sensitivity to light or sound is typical of migraine.", specialist: "Neurologist", recommendations: ["Rest in a quiet, darkened room", "Note triggers such as missed meals, poor sleep or screen time", "Seek urgent care if it began abruptly and is the worst headache you have had"] },
    hi: { condition: "संभावित माइग्रेन", explanation: "धड़कता हुआ सिरदर्द, अक्सर एक तरफ, मतली और रोशनी या आवाज़ से परेशानी के साथ, माइग्रेन का लक्षण है।", specialist: "न्यूरोलॉजिस्ट", recommendations: ["शांत और अँधेरे कमरे में आराम करें", "भोजन छूटने, नींद की कमी या स्क्रीन टाइम जैसे कारणों पर ध्यान दें", "यदि यह अचानक शुरू हुआ है और अब तक का सबसे तेज़ है तो तुरंत डॉक्टर के पास जाएँ"] },
  },
  "peptic ulcer disease": {
    urgency: "MEDIUM",
    en: { condition: "Possible peptic ulcer", explanation: "A burning or gnawing pain in the upper stomach, related to meals, can be caused by an ulcer in the stomach lining.", specialist: "Gastroenterologist", recommendations: ["Avoid painkillers such as ibuprofen, and alcohol and smoking", "Eat regular, small meals", "Go to hospital for black stools, vomiting blood or sudden severe pain"] },
    hi: { condition: "संभावित पेप्टिक अल्सर", explanation: "पेट के ऊपरी हिस्से में जलन या चुभने वाला दर्द, जो खाने से जुड़ा हो, पेट की परत में अल्सर से हो सकता है।", specialist: "गैस्ट्रोएंटेरोलॉजिस्ट", recommendations: ["आइबुप्रोफेन जैसी दर्द की दवा, शराब और धूम्रपान से बचें", "नियमित रूप से थोड़ा-थोड़ा खाएँ", "काले मल, खून की उल्टी या अचानक तेज़ दर्द पर अस्पताल जाएँ"] },
  },
  pneumonia: {
    urgency: "HIGH",
    en: { condition: "Possible pneumonia", explanation: "Cough with phlegm, fever, chills and breathlessness or chest pain on breathing suggests a lung infection.", specialist: "Pulmonologist", recommendations: ["See a doctor today; a chest X-ray may be needed", "Rest and drink fluids", "Use SOS for severe breathlessness, bluish lips or confusion"] },
    hi: { condition: "संभावित निमोनिया", explanation: "बलगम वाली खांसी, बुखार, ठंड लगना और साँस फूलना या साँस लेने पर सीने में दर्द फेफड़ों के संक्रमण का संकेत है।", specialist: "फेफड़ा रोग विशेषज्ञ", recommendations: ["आज ही डॉक्टर को दिखाएँ; छाती का एक्स-रे ज़रूरी हो सकता है", "आराम करें और तरल पदार्थ पिएँ", "साँस में बहुत तकलीफ, नीले होंठ या भ्रम होने पर SOS दबाएँ"] },
  },
  psoriasis: {
    urgency: "LOW",
    en: { condition: "Possible psoriasis", explanation: "Thick, red patches with silvery scales, often on the elbows, knees or scalp, are typical of this long-term skin condition.", specialist: "Dermatologist", recommendations: ["Moisturise the skin regularly", "Avoid scratching and harsh soaps", "See a dermatologist for a treatment plan"] },
    hi: { condition: "संभावित सोरायसिस", explanation: "चाँदी जैसी पपड़ी वाले मोटे, लाल चकत्ते, अक्सर कोहनी, घुटनों या सिर पर, इस लंबे समय तक चलने वाले त्वचा रोग के लक्षण हैं।", specialist: "त्वचा रोग विशेषज्ञ", recommendations: ["त्वचा पर नियमित रूप से मॉइस्चराइज़र लगाएँ", "खुजलाने और तेज़ साबुन से बचें", "इलाज की योजना के लिए त्वचा रोग विशेषज्ञ को दिखाएँ"] },
  },
  typhoid: {
    urgency: "HIGH",
    en: { condition: "Possible typhoid", explanation: "A fever that rises over several days with stomach pain, weakness and constipation or diarrhoea suggests typhoid, confirmed by a blood test.", specialist: "General Physician", recommendations: ["Get a blood test and see a doctor today", "Drink only boiled or bottled water and eat freshly cooked food", "Go to hospital for severe stomach pain, persistent vomiting or drowsiness"] },
    hi: { condition: "संभावित टाइफाइड", explanation: "कई दिनों में बढ़ता बुखार, पेट दर्द, कमजोरी और कब्ज़ या दस्त टाइफाइड का संकेत है, जिसकी पुष्टि खून की जाँच से होती है।", specialist: "सामान्य चिकित्सक", recommendations: ["आज ही खून की जाँच करवाएँ और डॉक्टर को दिखाएँ", "सिर्फ़ उबला या बोतल का पानी पिएँ और ताज़ा पका भोजन खाएँ", "पेट में तेज़ दर्द, लगातार उल्टी या सुस्ती होने पर अस्पताल जाएँ"] },
  },
  "urinary tract infection": {
    urgency: "MEDIUM",
    en: { condition: "Possible urinary tract infection", explanation: "Burning while passing urine, a frequent urge to go and lower abdominal pain are typical of a urine infection.", specialist: "General Physician / Urologist", recommendations: ["Drink plenty of water", "Get a urine test; antibiotics may be needed", "See a doctor urgently for fever with back pain or blood in the urine"] },
    hi: { condition: "संभावित मूत्र मार्ग संक्रमण (UTI)", explanation: "पेशाब में जलन, बार-बार पेशाब आना और पेट के निचले हिस्से में दर्द पेशाब के संक्रमण के लक्षण हैं।", specialist: "सामान्य चिकित्सक / यूरोलॉजिस्ट", recommendations: ["खूब पानी पिएँ", "पेशाब की जाँच करवाएँ; एंटीबायोटिक की ज़रूरत हो सकती है", "कमर दर्द के साथ बुखार या पेशाब में खून आने पर तुरंत डॉक्टर को दिखाएँ"] },
  },
  "varicose veins": {
    urgency: "LOW",
    en: { condition: "Possible varicose veins", explanation: "Swollen, twisted veins in the legs with aching or heaviness, worse after standing, are typical of varicose veins.", specialist: "Vascular Surgeon", recommendations: ["Raise your legs when resting and avoid standing for long periods", "Ask a doctor about compression stockings", "See a doctor urgently for a hot, painful, swollen leg or a bleeding vein"] },
    hi: { condition: "संभावित वैरिकोज़ वेन्स", explanation: "पैरों में सूजी, मुड़ी हुई नसें और दर्द या भारीपन, जो खड़े रहने पर बढ़ता है, वैरिकोज़ वेन्स के लक्षण हैं।", specialist: "वैस्कुलर सर्जन", recommendations: ["आराम करते समय पैर ऊँचे रखें और देर तक खड़े न रहें", "कम्प्रेशन स्टॉकिंग्स के बारे में डॉक्टर से पूछें", "गर्म, दर्दनाक, सूजे पैर या नस से खून आने पर तुरंत डॉक्टर को दिखाएँ"] },
  },
};

/**
 * Hybrid triage: safety rules first, then the trained model, then the rules again.
 * Always returns an answer; never throws on odd input.
 */
export function triage(symptomsText: string, lang?: Lang): TriageResult {
  const language: Lang = lang || detectLang(symptomsText);
  const rules = triageWithoutAI(symptomsText, language);

  // Emergencies and facility searches are the rules' job: the model has seen neither.
  const isFacilitySearch = !!rules.notAssessed && rules.urgencyLevel === "LOW";
  if (rules.flagUrgentSOS || isFacilitySearch) return { ...rules, source: "safety-rules" };

  const p = predictCondition(symptomsText);
  const info = CONDITIONS[p.label];
  if (info && p.confidence >= CONFIDENCE_THRESHOLD && p.knownTerms >= MIN_KNOWN_TERMS) {
    const c = info[language];
    return {
      suspectedCondition: c.condition,
      explanation: c.explanation,
      specialistType: c.specialist,
      specialistEn: info.en.specialist,
      urgencyLevel: info.urgency,
      recommendations: c.recommendations,
      flagUrgentSOS: false,
      source: "ml-model",
      lang: language,
      confidence: Number(p.confidence.toFixed(3)),
      alternatives: p.top.slice(1).map((t) => ({
        condition: CONDITIONS[t.label]?.[language].condition || t.label,
        confidence: Number(t.confidence.toFixed(3)),
      })),
    };
  }

  return rules;
}
