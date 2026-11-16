/**
 * Optional LLM provider layer (Milestone 4: A1, A8, A9, A11).
 *
 * City Healer answers every request with its own offline models and rules. This module adds
 * an OPTIONAL large-language-model path that is used only when GEMINI_API_KEY is set. With no
 * key nothing here makes a network call, and every caller gets exactly the offline answer.
 *
 *   A1  llmTriage            asks the model for triage in a fixed JSON schema
 *   A11 extractJson          pulls a JSON value out of model text (fences, prose, trailing commas)
 *       parseTriageJson      ... and validates it with zod
 *   A8  withBackoff          exponential backoff with jitter; permanent errors are not retried
 *       generateWithFailover tries each configured model in turn
 *   A9  llmTriage            falls back to the offline trained model + rules on no key, HTTP
 *                            errors, timeouts or invalid JSON, and says why
 *
 * Safety: the emergency rules (shared/emergencySafety.ts via shared/triage.ts, A2) run first.
 * If they fire, the model is never consulted, so no model output can downgrade an emergency.
 *
 * The network is reached only through an injected `fetch`, so the tests never call a real API.
 */
import { z } from "zod";
import { triage, type TriageResult } from "../../shared/triageModel";
import { detectLang, type Lang } from "../../shared/triage";

// ---------------------------------------------------------------- A11 robust JSON extraction

/**
 * Parse a JSON object or array out of model text.
 *  1. the whole text as JSON;
 *  2. the body of a ```json ... ``` (or bare ```) fence;
 *  3. the span from the first `{` or `[` to the last matching `}` or `]`;
 * each attempt is retried once with trailing commas removed (`{"a":1,}`).
 * Throws when nothing parses. O(n) in the text length.
 */
export function extractJson(text: string): unknown {
  const raw = String(text ?? "").trim();
  const candidates: string[] = [raw];
  const fence = raw.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());
  const firstObj = raw.indexOf("{"), firstArr = raw.indexOf("[");
  const starts = [firstObj, firstArr].filter((i) => i >= 0);
  if (starts.length) {
    const start = Math.min(...starts);
    const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    if (end > start) candidates.push(raw.slice(start, end + 1));
  }
  for (const c of candidates) {
    for (const attempt of [c, stripTrailingCommas(c)]) {
      try { return JSON.parse(attempt); } catch { /* next */ }
    }
  }
  throw new Error("no_json_found");
}

/** Remove a comma that directly precedes `}` or `]`, outside string literals. */
export function stripTrailingCommas(s: string): string {
  let out = "", inString = false, escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") { inString = true; out += ch; continue; }
    if (ch === ",") {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] === "}" || s[j] === "]") continue;
    }
    out += ch;
  }
  return out;
}

/** The structured triage reply the model must produce (A1). */
export const LlmTriageSchema = z.object({
  suspectedCondition: z.string().min(1).max(200),
  explanation: z.string().min(1).max(1500),
  specialistType: z.string().min(1).max(100),
  /** English specialist name, used for routing when the reply is in Hindi. */
  specialistEn: z.string().min(1).max(100).optional(),
  urgencyLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  recommendations: z.array(z.string().min(1).max(400)).min(1).max(8),
  flagUrgentSOS: z.boolean(),
});
export type LlmTriage = z.infer<typeof LlmTriageSchema>;

/** `value` is set when ok, `error` when not. (Not a discriminated union: the project compiles without strictNullChecks.) */
export interface ParseResult<T> { ok: boolean; value?: T; error?: string }

/** A11: extract, then validate against a zod schema. Never throws. */
export function parseJsonWith<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  let data: unknown;
  try { data = extractJson(text); } catch { return { ok: false, error: "no_json_found" }; }
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    return { ok: false, error: `schema_invalid: ${first?.path.join(".") || "(root)"} ${first?.message || ""}`.trim() };
  }
  return { ok: true, value: r.data };
}

export const parseTriageJson = (text: string) => parseJsonWith(text, LlmTriageSchema);

// ---------------------------------------------------------------- A8 backoff and failover

/** An error from a model call. `permanent` errors (bad request, bad key, unknown model) are not retried. */
export class LlmError extends Error {
  constructor(message: string, readonly status?: number, readonly permanent = false) { super(message); }
}

export const isPermanent = (err: unknown) => err instanceof LlmError && err.permanent;

export interface BackoffOptions {
  /** Attempts per model, including the first. Default 3. */
  attempts?: number;
  /** First wait in ms. Default 600. */
  baseDelayMs?: number;
  /** Multiplier per retry. Default 3 (600 ms, then 1.8 s). */
  factor?: number;
  /** Cap on a single wait. Default 5000. */
  maxDelayMs?: number;
  /** Injected for tests. Defaults to setTimeout / Math.random / Date.now. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  /** Give up (no further attempts) once this much time has passed. Default 15000. */
  budgetMs?: number;
}

/**
 * Delay before retry number `retry` (0-based): base * factor^retry, capped, with "equal
 * jitter" - a uniformly random value in [d/2, d] - so many clients retrying after the same
 * outage do not hit the service in lockstep.
 */
export function backoffDelay(retry: number, o: BackoffOptions = {}): number {
  const base = o.baseDelayMs ?? 600, factor = o.factor ?? 3, cap = o.maxDelayMs ?? 5000;
  const d = Math.min(cap, base * Math.pow(factor, retry));
  const r = (o.random ?? Math.random)();
  return Math.round(d / 2 + r * (d / 2));
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Run `fn` up to `attempts` times with exponential backoff. Permanent errors rethrow at once. */
export async function withBackoff<T>(fn: (attempt: number) => Promise<T>, o: BackoffOptions = {}, deadline?: number): Promise<T> {
  const attempts = o.attempts ?? 3;
  const sleep = o.sleep ?? realSleep, now = o.now ?? Date.now;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    if (deadline !== undefined && now() >= deadline) break;
    try {
      return await fn(i);
    } catch (err) {
      last = err;
      if (isPermanent(err) || i === attempts - 1) break;
      const wait = backoffDelay(i, o);
      if (deadline !== undefined && now() + wait >= deadline) break;
      await sleep(wait);
    }
  }
  throw last ?? new LlmError("deadline_exceeded");
}

export type CallModel = (model: string, prompt: LlmPrompt) => Promise<string>;
export interface LlmPrompt { system: string; user: string }

/**
 * Try each model in order, each with backoff. A permanent error (400/401/403/404) stops
 * everything: a bad key or bad request fails the same way on every model. Worst case
 * models.length * attempts calls, bounded by budgetMs.
 */
export async function generateWithFailover(models: string[], prompt: LlmPrompt, callModel: CallModel, o: BackoffOptions = {}): Promise<{ model: string; text: string; attempts: string[] }> {
  if (!models.length) throw new LlmError("no_models_configured", undefined, true);
  const now = o.now ?? Date.now;
  const deadline = now() + (o.budgetMs ?? 15000);
  const attempts: string[] = [];
  let last: unknown;
  for (const model of models) {
    try {
      const text = await withBackoff(async (i) => {
        attempts.push(`${model}#${i + 1}`);
        return callModel(model, prompt);
      }, o, deadline);
      return { model, text, attempts };
    } catch (err) {
      last = err;
      if (isPermanent(err)) break;
    }
  }
  throw last instanceof Error ? last : new LlmError("all_models_failed");
}

// ---------------------------------------------------------------- Gemini REST caller

export interface LlmConfig {
  apiKey: string;
  models: string[];
  timeoutMs: number;
}

/** From the environment. Null when no key is set: the LLM path is then off entirely. */
export function llmConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const apiKey = (env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  const models = (env.GEMINI_MODELS || "gemini-2.5-flash,gemini-2.0-flash").split(",").map((s) => s.trim()).filter(Boolean);
  const timeoutMs = Math.max(1000, Number(env.LLM_TIMEOUT_MS) || 8000);
  return { apiKey, models, timeoutMs };
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<any>; text?: () => Promise<string> }>;

/** A CallModel for the Gemini generateContent REST API, asking for a JSON reply. */
export function geminiCaller(cfg: LlmConfig, fetchImpl: FetchLike = fetch as unknown as FetchLike): CallModel {
  return async (model, prompt) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: "user", parts: [{ text: prompt.user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        // 400 bad request, 401/403 bad key, 404 unknown model: retrying cannot help.
        const permanent = [400, 401, 403, 404].includes(res.status);
        throw new LlmError(`http_${res.status}`, res.status, permanent);
      }
      const body = await res.json();
      const text = (body?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("");
      if (!text) throw new LlmError("empty_response");
      return text;
    } catch (err: any) {
      if (err instanceof LlmError) throw err;
      if (err?.name === "AbortError") throw new LlmError("timeout");
      throw new LlmError(`network: ${err?.message || "error"}`);
    } finally {
      clearTimeout(timer);
    }
  };
}

// ---------------------------------------------------------------- A1 + A9 triage

export const TRIAGE_SYSTEM_PROMPT = [
  "You are a cautious symptom-triage assistant for an Indian city health app. You do not diagnose.",
  "Reply with ONE JSON object and nothing else, with exactly these keys:",
  "suspectedCondition (string), explanation (string), specialistType (string, in the reply language),",
  "specialistEn (string, the same specialist in English), urgencyLevel (one of LOW, MEDIUM, HIGH, CRITICAL),",
  "recommendations (array of 1 to 6 short strings), flagUrgentSOS (boolean).",
  "Use CRITICAL and flagUrgentSOS true for severe chest pain, stroke signs, heavy bleeding, choking,",
  "unconsciousness, difficulty breathing, overdose or poisoning. If unsure, choose the more urgent level.",
].join(" ");

export type Engine = "offline" | `llm:${string}`;

export type EngineTriage = (TriageResult | (Omit<TriageResult, "source"> & { source: "llm" })) & {
  engine: Engine;
  /** Why the offline engine answered although a key is configured. */
  engineFallbackReason?: string;
};

export interface LlmTriageOptions {
  config?: LlmConfig | null;
  callModel?: CallModel;
  backoff?: BackoffOptions;
}

/**
 * A1 + A9: triage with an LLM when configured, otherwise (or on any failure) the offline
 * trained model + rules. Never throws.
 *
 *  - Emergency rules run first (inside triage()); if they decide, the model is not called.
 *  - No key: returns triage() unchanged plus engine "offline".
 *  - Key: generateWithFailover -> parseTriageJson; any error -> offline + engineFallbackReason.
 *  - A model may escalate (CRITICAL always sets flagUrgentSOS), never de-escalate a rule.
 */
export async function llmTriage(symptomsText: string, lang?: Lang, opts: LlmTriageOptions = {}): Promise<EngineTriage> {
  const language: Lang = lang || detectLang(symptomsText);
  const offline = triage(symptomsText, language);
  if (offline.source === "safety-rules") return { ...offline, engine: "offline" };

  const config = opts.config === undefined ? llmConfigFromEnv() : opts.config;
  if (!config) return { ...offline, engine: "offline" };

  const callModel = opts.callModel ?? geminiCaller(config);
  const prompt: LlmPrompt = {
    system: TRIAGE_SYSTEM_PROMPT,
    user: `Reply language: ${language === "hi" ? "Hindi" : "English"}.\nSymptoms: ${String(symptomsText).slice(0, 2000)}`,
  };
  try {
    const { model, text } = await generateWithFailover(config.models, prompt, callModel, opts.backoff);
    const parsed = parseTriageJson(text);
    if (!parsed.ok) return { ...offline, engine: "offline", engineFallbackReason: `invalid_model_output (${parsed.error})` };
    const v = parsed.value;
    return {
      suspectedCondition: v.suspectedCondition,
      explanation: v.explanation,
      specialistType: v.specialistType,
      specialistEn: v.specialistEn || v.specialistType,
      urgencyLevel: v.urgencyLevel,
      recommendations: v.recommendations,
      flagUrgentSOS: v.flagUrgentSOS || v.urgencyLevel === "CRITICAL",
      source: "llm",
      lang: language,
      engine: `llm:${model}`,
    };
  } catch (err) {
    return { ...offline, engine: "offline", engineFallbackReason: err instanceof Error ? err.message : "llm_error" };
  }
}
