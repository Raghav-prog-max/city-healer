/**
 * Retrieval-augmented answers over the local medicine dataset (Milestone 4: A10).
 *
 *   retrieve  top-k passages from the TF-IDF medicine index (server/medicineIndex.ts), each
 *             with an id ([M1], [M2] ...) and the dataset it came from
 *   generate  offline: a templated answer that quotes the retrieved passages and cites them;
 *             with GEMINI_API_KEY: the LLM sees ONLY those passages and must cite them by id.
 *             An LLM answer that cites nothing, or cites an id that was not retrieved, is
 *             discarded and the offline answer is returned instead (A9).
 *
 * No passage above the similarity floor means no answer: the function abstains rather than
 * letting anything answer from memory.
 */
import { z } from "zod";
import { searchMedicines, MEDICINE_SOURCE, type MedicineCard } from "../medicineIndex";
import { generateWithFailover, geminiCaller, llmConfigFromEnv, parseJsonWith, type CallModel, type LlmConfig, type BackoffOptions } from "./llm";

export interface Passage {
  id: string;
  title: string;
  text: string;
  source: string;
  score: number;
}

export type Retriever = (query: string, k: number) => Passage[];

/** Minimum retrieval score for a passage to be used. */
export const MIN_PASSAGE_SCORE = 0.08;

export function medicinePassage(m: MedicineCard, i: number): Passage {
  const uses = m.uses.slice(0, 4).join(", ") || "not listed";
  const side = m.sideEffects.slice(0, 4).join(", ") || "not listed";
  return {
    id: `M${i + 1}`,
    title: m.name,
    text: `${m.name} contains ${m.composition}. Uses: ${uses}. Common side effects: ${side}. Manufacturer: ${m.manufacturer}.`,
    source: MEDICINE_SOURCE,
    score: m.score ?? 0,
  };
}

/** Top-k medicine passages by TF-IDF cosine similarity (name space and use space). O(N) over the catalogue. */
export const retrieveMedicinePassages: Retriever = (query, k) =>
  searchMedicines(query, k).map(medicinePassage).filter((p) => p.score >= MIN_PASSAGE_SCORE);

export interface RagAnswer {
  query: string;
  answer: string;
  /** Ids of the passages the answer cites; always a subset of `passages`. */
  citations: string[];
  passages: Passage[];
  engine: "offline" | `llm:${string}`;
  abstained: boolean;
  engineFallbackReason?: string;
  disclaimer: string;
}

const DISCLAIMER = "Information from a public medicine dataset, not medical advice. Ask a doctor or pharmacist before taking any medicine.";

/** Offline generation: quote each retrieved passage and cite it. Deterministic. */
export function templatedAnswer(query: string, passages: Passage[]): { answer: string; citations: string[] } {
  if (!passages.length) return { answer: `No passage in the medicine dataset matches "${query}", so this is not answered.`, citations: [] };
  const lines = passages.map((p) => `[${p.id}] ${p.text}`);
  return { answer: `From the medicine dataset:\n${lines.join("\n")}`, citations: passages.map((p) => p.id) };
}

const LlmRagSchema = z.object({ answer: z.string().min(1).max(3000), citations: z.array(z.string()).min(1).max(10) });

export interface RagOptions {
  k?: number;
  retriever?: Retriever;
  config?: LlmConfig | null;
  callModel?: CallModel;
  backoff?: BackoffOptions;
}

export async function answerWithRetrieval(query: string, opts: RagOptions = {}): Promise<RagAnswer> {
  const k = Math.min(10, Math.max(1, opts.k ?? 3));
  const passages = (opts.retriever ?? retrieveMedicinePassages)(query, k).slice(0, k);
  const offline = templatedAnswer(query, passages);
  const base = { query, passages, disclaimer: DISCLAIMER };
  if (!passages.length) return { ...base, ...offline, engine: "offline", abstained: true };

  const config = opts.config === undefined ? llmConfigFromEnv() : opts.config;
  if (!config) return { ...base, ...offline, engine: "offline", abstained: false };

  const ids = new Set(passages.map((p) => p.id));
  try {
    const { model, text } = await generateWithFailover(config.models, {
      system: "Answer ONLY from the numbered passages given. Do not use any other knowledge. Cite every claim with the passage id in square brackets, e.g. [M1]. If the passages do not answer the question, say so. Reply as JSON: {\"answer\": string, \"citations\": string[]}.",
      user: `Question: ${query.slice(0, 500)}\n\nPassages:\n${passages.map((p) => `[${p.id}] ${p.text}`).join("\n")}`,
    }, opts.callModel ?? geminiCaller(config), opts.backoff);
    const parsed = parseJsonWith(text, LlmRagSchema);
    if (!parsed.ok) return { ...base, ...offline, engine: "offline", abstained: false, engineFallbackReason: `invalid_model_output (${parsed.error})` };
    const cited = [...new Set(parsed.value.citations.map((c) => c.replace(/[[\]\s]/g, "")))];
    if (!cited.length || cited.some((c) => !ids.has(c))) {
      return { ...base, ...offline, engine: "offline", abstained: false, engineFallbackReason: "citations_not_in_retrieved_passages" };
    }
    return { ...base, answer: parsed.value.answer, citations: cited, engine: `llm:${model}`, abstained: false };
  } catch (err) {
    return { ...base, ...offline, engine: "offline", abstained: false, engineFallbackReason: err instanceof Error ? err.message : "llm_error" };
  }
}
