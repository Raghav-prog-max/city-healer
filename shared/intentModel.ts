/**
 * Intent classifier (ml/train_intent.py): what is this message asking for?
 * TF-IDF + logistic regression over English, Hindi and romanised Hindi, ten intents.
 * The AI orchestrator uses it to send each message to the right specialised model.
 */
import model from "./intent-model.json";
import { createTextClassifier, type TextModelJson, type TextPrediction } from "./textClassifier";

export type Intent =
  | "symptoms" | "lab_report" | "medicine" | "diet" | "appointment"
  | "emergency" | "hospital_beds" | "insurance" | "greeting" | "thanks";

export const INTENTS = (model as TextModelJson).classes as Intent[];

/** Below this the orchestrator says it is unsure and offers choices, instead of guessing. */
export const INTENT_THRESHOLD = 0.35;

const classify = createTextClassifier(model as TextModelJson);

export function predictIntent(text: string): TextPrediction & { label: Intent } {
  return classify(text) as TextPrediction & { label: Intent };
}
