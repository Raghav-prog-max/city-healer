/**
 * Emergency-language detector (patient-safety net). Rule-based pattern matching, NOT a clinically
 * validated triage model: it decides only "escalate to emergency guidance now", and it is tuned
 * to over-escalate rather than miss. Measured on tests/fixtures/emergency_safety_set.json (a draft
 * set, not yet clinician-reviewed); see P0_REMEDIATION_REPORT.md.
 *
 * Why it exists: the term lists in triage.ts match exact substrings, so a word inserted into a
 * phrase ("साँस लेने में बहुत तकलीफ"), a misspelling ("can't breath"), a paraphrase ("I want to
 * die") or a category with no list at all (self-harm had only "suicid") fell through to
 * non-emergency answers. These patterns allow a few words in between, common misspellings and
 * romanised Hindi, and add self-harm and overdose.
 *
 * Categories: self_harm, overdose (incl. poisoning), breathing, chest_pain, bleeding, unconscious.
 */

export type EmergencyCategory = "self_harm" | "overdose" | "breathing" | "chest_pain" | "bleeding" | "unconscious";

export interface EmergencyMatch {
  category: EmergencyCategory;
  /** The pattern that fired, for audit traces (never shown to the patient). */
  rule: string;
}

/** Lower-case, unify apostrophes, drop punctuation except apostrophes, collapse whitespace. */
export function normaliseForSafety(text: string): string {
  return ` ${String(text || "")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{L}\p{M}\p{N}'\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** Up to `n` words between `a` and `b` (works for Latin and Devanagari, which \b does not). */
const near = (a: string, b: string, n = 4) => new RegExp(`(?:${a})(?:\\s+\\S+){0,${n}}?\\s*(?:${b})`, "u");
/** A whole Latin word or phrase (word boundaries by spaces, since the text is normalised). */
const w = (alts: string) => new RegExp(`\\s(?:${alts})(?=\\s)`, "u");

// Words used by several rules
const BREATH_EN = "breath|breathe|breathing|breth|brethe|breating|breahting";
const SAANS = "saans|saas|sans|swas|saans?e|सांस|साँस|श्वास";
const PILL_EN = "pills?|tablets?|tabs|capsules?|medicines?|medicine|meds|medication|paracetamol|crocin|dolo|sleeping|insulin";
const INGEST_EN = "took|taken|swallowed|ate|eaten|had|drank|drunk|consumed|overdosed|popped|gulped";
// A count of 5 or more (not a dose strength like "650 mg"), or words that mean "a lot".
const COUNT = "(?:[5-9]|[1-9]\\d+)(?!\\s*(?:mg|ml|mcg|gm|g|iu|units?)\\s)";
const QTY_EN = `${COUNT}|too many|too much|a lot of|lots of|whole|entire|all the|all my|full|packet|pack|strip|bottle|handful`;
const QTY_HI = `${COUNT}|bahut|bahot|saari|sari|saare|puri|poori|pura|poora|sab|patta|पूरी|पूरा|सारी|सारे|बहुत|पत्ता|सब`;
const PILL_HI = "goli|goliyan|goliyaan|dawai|dawa|dawaai|dawayi|tablet|tablets|गोली|गोलियां|गोलियाँ|दवा|दवाई|दवाइयां|शीशी|टैबलेट";
const POISON_HI = "zeher|zehar|jahar|zahar|phenyl|keetnashak|keetnaashak|tezab|tezaab|ज़हर|जहर|कीटनाशक|फिनाइल|तेज़ाब|तेजाब";
const INGEST_HI = "kha li|kha liya|kha gaya|kha gayi|kha gai|pi li|pi liya|pee li|pee liya|nigal|खा ली|खा लिया|खा गया|खा गई|पी ली|पी लिया|निगल";
const POISON_EN = "poison|pesticide|insecticide|rat kill\\w*|rat poison|phenyl|phenol|bleach|acid|kerosene|harpic|toilet cleaner|detergent|weed killer|mosquito repellent|all out|good knight";

const RULES: Array<[EmergencyCategory, string, RegExp]> = [
  // ---------------- self-harm (English)
  ["self_harm", "suicide", /suicid|sucide|suiside|आत्महत्या|aatm ?hatya|atm ?hatya|khudkushi|ख़ुदकुशी|खुदकुशी/u],
  ["self_harm", "kill/hurt myself", w("(?:kill|hurt|harm|cut|end|finish) (?:my ?self|myself)")],
  ["self_harm", "end my life / it all", w("end(?:ing)? (?:my life|it all|everything|my own life)|take my (?:own )?life|taking my (?:own )?life")],
  ["self_harm", "want to die", w("(?:want|wanna|going|plan(?:ning)?|thinking(?: of| about)?|thought(?: of| about)?|ready|wish) (?:to )?(?:die|be dead|end it)")],
  ["self_harm", "don't want to live", w("(?:don'?t|do not|dont|no longer) (?:want to|wanna|wish to) (?:live|be alive|wake up|exist)")],
  ["self_harm", "better off dead", w("better off dead|no reason to live|no point (?:in )?living|if i (?:died|was dead|were dead|am gone)")],
  // ---------------- self-harm (Hinglish, Hindi)
  ["self_harm", "khud ko maar/khatam", near("khud ko|apne aap ko|apne ko|खुद को|ख़ुद को|अपने आप को", "maar|mar|khatam|khatm|nuksan|nuksaan|hurt|मार|खत्म|ख़त्म|नुकसान|चोट", 2)],
  ["self_harm", "jeena nahi", near("jeena|jina|jeene|जीना|जीने", "nahi|nahin|nhi|na |नहीं|नही", 3)],
  ["self_harm", "jaan dena", near("jaan|jan|zindagi|jindagi|जान|ज़िंदगी|जिंदगी", "de dun|de du|dena|de doon|dedu|khatam|khatm|दे दूँ|दे दूं|देना|देनी|खत्म|ख़त्म", 2)],
  ["self_harm", "marna chahta", near("marna|mar jana|mar jaana|mar jaun|मरना|मर जाना|मर जाऊं|मर जाऊँ", "chahta|chahti|chahte|hai|चाहता|चाहती|चाहते|है", 2)],

  // ---------------- overdose / poisoning
  ["overdose", "ingested quantity of pills", new RegExp(`\\s(?:${INGEST_EN})\\s(?:\\S+\\s){0,6}?(?:${QTY_EN})\\s(?:\\S+\\s){0,4}?(?:${PILL_EN})(?=\\s)`, "u")],
  ["overdose", "pills by mistake", new RegExp(`(?:${INGEST_EN}|took)\\s(?:\\S+\\s){0,4}?(?:${PILL_EN})\\s(?:\\S+\\s){0,3}?(?:by mistake|accidentally|overdose)`, "u")],
  ["overdose", "ingested poison", new RegExp(`(?:${INGEST_EN}|accidentally|accidently)\\s(?:\\S+\\s){0,4}?(?:${POISON_EN})(?=\\s)`, "u")],
  ["overdose", "overdose word", /overdose|over dose|poisoning|poisoned/u],
  // Medicines: a large quantity AND swallowing, in either order ("20 goli kha li", "दवा की पूरी शीशी पी ली");
  // "maine dawai kha li" (I took my medicine) alone is not an emergency.
  ["overdose", "qty + goli + kha li", new RegExp(`(?:${QTY_HI})(?:\\s+\\S+){0,3}?\\s*(?:${PILL_HI})(?:\\s+\\S+){0,4}?\\s*(?:${INGEST_HI})`, "u")],
  ["overdose", "goli + qty + kha li", new RegExp(`(?:${PILL_HI})(?:\\s+\\S+){0,2}?\\s*(?:${QTY_HI})(?:\\s+\\S+){0,3}?\\s*(?:${INGEST_HI})`, "u")],
  // Poisons: swallowing any amount.
  ["overdose", "zeher kha/pi li", near(POISON_HI, INGEST_HI, 4)],

  // ---------------- breathing
  ["breathing", "can't breathe", new RegExp(`(?:can'?t|cannot|can not|cant|unable to|not able to|barely|hardly|struggl\\w* to|struggl\\w*|difficult\\w*|difficulty|trouble|hard to)\\s(?:\\S+\\s){0,2}?(?:${BREATH_EN})(?=\\s)`, "u")],
  ["breathing", "gasping / choking", w("gasping|gasp for air|choking|suffocat\\w*|no air|out of breath and")],
  ["breathing", "blue lips", near("lips?|face|fingers?|nails?|होंठ|होठ|honth|hoth", "blue|bluish|turning blue|purple|grey|gray|नीले|नीला|neele|neela", 4)],
  ["breathing", "saans nahi / dikkat", near(SAANS, "nahi|nahin|nhi|na aa|ruk|takleef|taklif|takliif|dikkat|dikkt|pareshani|problem|mushkil|तकलीफ|दिक्कत|परेशानी|नहीं|नही|मुश्किल|रुक", 4)],
  ["breathing", "dam ghut", /dam ghut|दम घुट|ghutan|घुटन/u],

  // ---------------- chest pain
  ["chest_pain", "chest + pain", new RegExp(`\\schest\\s(?:\\S+\\s){0,3}?(?<!no |not |without )(?:pain|pian|pains|ache|pressure|tight\\w*|heav\\w*|crush\\w*|squeez\\w*|burning)(?=\\s)`, "u")],
  ["chest_pain", "pain + chest", w("(?:pain|pressure|crushing|squeezing|tightness|heaviness) (?:\\S+ ){0,2}chest")],
  ["chest_pain", "seene/chhati + dard", near("seene|seena|sine|sina|chhati|chati|chaati|chhaati|सीने|सीना|छाती", "dard|dardd|dabav|dabaav|jakdan|bhari|bharipan|दर्द|दबाव|जकड़न|भारीपन", 4)],

  // ---------------- severe bleeding
  ["bleeding", "bleeding won't stop", new RegExp(`\\s(?:bleed\\w*|blood)\\s(?:\\S+\\s){0,3}?(?:won'?t|wont|not|isn'?t|doesn'?t|can'?t|cannot)\\s(?:\\S+\\s){0,1}?stop`, "u")],
  ["bleeding", "heavy bleeding", w("(?:heavy|heavily|severe|severely|profuse|profusely|massive|lots of|a lot of|so much) (?:\\S+ ){0,1}(?:bleed\\w*|blood)|(?:bleed\\w*|blood) (?:\\S+ ){0,1}(?:everywhere|heavily|a lot|gushing|spurting|pouring)")],
  ["bleeding", "vomiting/coughing blood", w("(?:vomit\\w*|cough\\w*|throw\\w* up|spit\\w*) (?:up )?blood|blood in (?:vomit|stool)|bloody vomit")],
  ["bleeding", "khoon band nahi", near("khoon|khun|blood|खून|रक्त", "band nahi|band nhi|ruk nahi|ruk nhi|rukta nahi|nahi ruk|nhi ruk|nikal raha|nikal rha|beh raha|beh rha|bah raha|बंद नहीं|रुक नहीं|नहीं रुक|बह रहा|बह रही|निकल रहा", 3)],
  ["bleeding", "bahut khoon", near("bahut|bahot|zyada|jyada|बहुत|ज़्यादा|ज्यादा", "khoon|khun|खून", 2)],

  // ---------------- unconsciousness
  ["unconscious", "unconscious", w("unconscious|unconcious|unconsious|unconsciuos|uncouncious|unresponsive|not responding|won'?t respond|isn'?t responding|not waking|isn'?t waking|won'?t wake|can'?t wake|passed out|blacked out|fainted|collapsed|not breathing")],
  ["unconscious", "behosh / hosh nahi", /behosh|be hosh|बेहोश|hosh (?:mein |me |main )?(?:nahi|nahin|nhi)|होश (?:में )?नहीं/u],
];

/** First emergency category the message matches, or null. */
export function detectEmergency(text: string): EmergencyMatch | null {
  const t = normaliseForSafety(text);
  for (const [category, rule, re] of RULES) if (re.test(t)) return { category, rule };
  return null;
}

/** Tele-MANAS: Government of India's 24x7 mental-health helpline. */
export const CRISIS_HELPLINES = { teleManas: "14416", teleManasTollFree: "1-800-891-4416", emergency: "112" };
