/**
 * Spoken commands, in English, Hindi (Devanagari) and romanised Hindi.
 *
 * The same microphone is used for dictating symptoms, so a command must be
 * unmistakable: either a short fixed phrase said on its own ("help", "clear"), or a
 * short utterance that pairs a verb with a destination ("open pharmacy",
 * "अस्पताल खोलो"). A longer sentence that merely mentions a destination — "I went to
 * the hospital yesterday" — is dictation, never a command.
 */

export type VoiceCommand =
  | { kind: "navigate"; tab: string; label: string }
  | { kind: "clear" }
  | { kind: "submit" }
  | { kind: "stop" }
  | { kind: "help" }
  | { kind: "logout" };

/** A command utterance is short. Anything longer is treated as dictation. */
const MAX_COMMAND_WORDS = 6;

const DESTINATIONS: { tab: string; label: string; words: string[] }[] = [
  { tab: "sos", label: "Emergency SOS", words: ["sos", "emergency", "ambulance", "एम्बुलेंस", "एंबुलेंस", "इमरजेंसी", "आपातकाल"] },
  { tab: "symptoms", label: "Symptom Checker", words: ["symptom", "symptoms", "triage", "diagnosis", "लक्षण", "lakshan"] },
  { tab: "beds", label: "Hospitals and Beds", words: ["hospital", "hospitals", "bed", "beds", "icu", "अस्पताल", "बेड", "aspatal", "aspataal"] },
  { tab: "consultation", label: "Doctors and Consultations", words: ["doctor", "doctors", "consultation", "appointment", "appointments", "डॉक्टर", "डाक्टर"] },
  { tab: "pharmacy", label: "Pharmacy", words: ["pharmacy", "medicine", "medicines", "chemist", "दवा", "दवाई", "दवाइयां", "dawa", "dawai"] },
  { tab: "records", label: "Health Records", words: ["record", "records", "report", "reports", "रिपोर्ट", "रिकॉर्ड"] },
  { tab: "insurance", label: "Insurance", words: ["insurance", "बीमा", "bima"] },
  { tab: "trends", label: "Health Trends", words: ["trends", "trend"] },
  { tab: "overview", label: "Dashboard", words: ["dashboard", "home", "overview", "डैशबोर्ड", "होम"] },
];

const NAV_VERBS = [
  "open", "show", "go to", "goto", "take me to", "navigate to", "launch",
  "खोलो", "खोलें", "दिखाओ", "दिखाएं", "पर जाओ", "kholo", "dikhao", "par jao",
];

const FIXED: { phrases: string[]; command: VoiceCommand }[] = [
  { phrases: ["help", "voice help", "what can i say", "commands", "मदद", "सहायता", "कमांड"], command: { kind: "help" } },
  { phrases: ["stop listening", "stop", "mic off", "microphone off", "बंद करो", "रुको", "band karo", "ruko"], command: { kind: "stop" } },
  { phrases: ["clear", "clear symptoms", "reset", "reset symptoms", "symptoms clear", "मिटाओ", "क्लियर", "साफ करो", "mitao", "saaf karo"], command: { kind: "clear" } },
  { phrases: ["submit", "diagnose", "run diagnosis", "run triage", "check symptoms", "जांच करो", "जाँच करो", "एनालाइज", "प्रेडिक्ट", "jaanch karo", "janch karo"], command: { kind: "submit" } },
  { phrases: ["log out", "logout", "sign out", "लॉग आउट", "लॉगआउट"], command: { kind: "logout" } },
  // Emergency words on their own open the SOS screen. They never dispatch by themselves.
  { phrases: ["sos", "emergency", "call ambulance", "call an ambulance", "ambulance", "एम्बुलेंस बुलाओ", "एंबुलेंस बुलाओ", "इमरजेंसी", "ambulance bulao"], command: { kind: "navigate", tab: "sos", label: "Emergency SOS" } },
];

function normalise(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[.,!?।"'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the command an utterance asks for, or null when it is ordinary speech. */
export function parseVoiceCommand(utterance: string): VoiceCommand | null {
  const text = normalise(utterance);
  if (!text) return null;
  const words = text.split(" ");
  if (words.length > MAX_COMMAND_WORDS) return null;

  for (const entry of FIXED) {
    if (entry.phrases.includes(text)) return entry.command;
  }

  const verb = NAV_VERBS.find((v) => text.startsWith(v + " ") || text.endsWith(" " + v));
  if (!verb) return null;
  const rest = (text.startsWith(verb + " ") ? text.slice(verb.length) : text.slice(0, -verb.length))
    .replace(/\b(the|my|page|screen|tab|section|please)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!rest) return null;
  const restWords = rest.split(" ");
  for (const dest of DESTINATIONS) {
    if (restWords.some((w) => dest.words.includes(w))) {
      return { kind: "navigate", tab: dest.tab, label: dest.label };
    }
  }
  return null;
}

/** Shown when the user asks for help. */
export const VOICE_HELP: Record<"en" | "hi", string> = {
  en: 'Say "open hospitals", "open pharmacy", "open doctors", "open records", "emergency", "clear", "submit", "log out" or "stop listening".',
  hi: 'बोलें: "अस्पताल खोलो", "दवा खोलो", "डॉक्टर खोलो", "रिपोर्ट खोलो", "इमरजेंसी", "मिटाओ", "जांच करो" या "बंद करो"।',
};
