/**
 * Milestone 4 algorithms A1-A14: one or more unit tests per algorithm, no server, no network.
 * See docs/ALGORITHMS.md for what each algorithm is and where the app uses it.
 *
 * Every LLM test injects a fake model caller or a fake fetch; nothing here reaches a real API.
 *
 *   npx tsx --test tests/algorithms.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { triageWithoutAI, detectLang } from "../shared/triage";
import { triage } from "../shared/triageModel";
import {
  extractJson, stripTrailingCommas, parseTriageJson, backoffDelay, withBackoff, generateWithFailover,
  geminiCaller, llmTriage, llmConfigFromEnv, LlmError, type CallModel, type LlmConfig,
} from "../server/ai/llm";
import { answerWithRetrieval, templatedAnswer, retrieveMedicinePassages, type Passage } from "../server/ai/rag";
import { estimateOpdWait } from "../shared/waitTime";
import { scoreHospital, topK, scorePercent, MAX_HOSPITAL_SCORE } from "../shared/hospitalRanking";
import { nearest, haversineKm } from "../shared/geo";
import { createFixedWindowLimiter } from "../server/rateLimit";
import { hasLegacyDerivedPassword } from "../scripts/legacy-passwords";

const noSleep = { sleep: async () => {}, random: () => 0.5 };
const cfg = (models = ["model-a", "model-b"]): LlmConfig => ({ apiKey: "test-key-not-real", models, timeoutMs: 50 });
const GOOD_TRIAGE = JSON.stringify({
  suspectedCondition: "Possible migraine", explanation: "One-sided throbbing headache with light sensitivity.",
  specialistType: "Neurologist", specialistEn: "Neurologist", urgencyLevel: "LOW",
  recommendations: ["Rest in a dark room"], flagUrgentSOS: false,
});
const NON_EMERGENCY = "throbbing headache on one side with sensitivity to light for two days";

// ------------------------------------------------------------------------------------------ A1
describe("A1 LLM structured JSON triage", () => {
  test("A1: a valid model reply becomes the triage result, tagged with the model", async () => {
    let seenPrompt = "";
    const callModel: CallModel = async (_m, p) => { seenPrompt = p.system; return GOOD_TRIAGE; };
    const r = await llmTriage(NON_EMERGENCY, "en", { config: cfg(), callModel, backoff: noSleep });
    assert.equal(r.engine, "llm:model-a");
    assert.equal(r.source, "llm");
    assert.equal(r.suspectedCondition, "Possible migraine");
    assert.equal(r.urgencyLevel, "LOW");
    assert.match(seenPrompt, /urgencyLevel/);
    assert.match(seenPrompt, /flagUrgentSOS/);
  });

  test("A1: CRITICAL from the model always raises the SOS flag", async () => {
    const reply = JSON.stringify({ ...JSON.parse(GOOD_TRIAGE), urgencyLevel: "CRITICAL", flagUrgentSOS: false });
    const r = await llmTriage(NON_EMERGENCY, "en", { config: cfg(), callModel: async () => reply, backoff: noSleep });
    assert.equal(r.flagUrgentSOS, true);
  });

  test("A1: the model cannot lower the urgency the offline engine assessed", async () => {
    const text = "high fever with stiff neck and severe headache";
    const offline = triage(text, "en");
    assert.equal(offline.urgencyLevel, "HIGH"); // precondition: the trained model assesses it HIGH
    assert.ok(!offline.notAssessed);
    const reply = JSON.stringify({ ...JSON.parse(GOOD_TRIAGE), urgencyLevel: "LOW" });
    const r = await llmTriage(text, "en", { config: cfg(), callModel: async () => reply, backoff: noSleep });
    assert.equal(r.engine, "llm:model-a"); // the model's answer is still used...
    assert.equal(r.suspectedCondition, "Possible migraine");
    assert.equal(r.urgencyLevel, "HIGH"); // ...but not its lower urgency
    assert.equal(r.modelUrgencyOverruled, "LOW");
  });

  test("A1: the model may still raise the urgency above the offline assessment", async () => {
    const reply = JSON.stringify({ ...JSON.parse(GOOD_TRIAGE), urgencyLevel: "HIGH" });
    const r = await llmTriage(NON_EMERGENCY, "en", { config: cfg(), callModel: async () => reply, backoff: noSleep });
    assert.equal(triage(NON_EMERGENCY, "en").urgencyLevel, "LOW"); // precondition
    assert.equal(r.urgencyLevel, "HIGH");
    assert.equal(r.modelUrgencyOverruled, undefined);
  });

  test("A1: input the offline engine could not assess is left to the model", async () => {
    const text = "asdf qwerty";
    const offline = triage(text, "en");
    assert.ok(offline.notAssessed); // precondition: offline only placed a cautious default
    const reply = JSON.stringify({ ...JSON.parse(GOOD_TRIAGE), urgencyLevel: "LOW" });
    const r = await llmTriage(text, "en", { config: cfg(), callModel: async () => reply, backoff: noSleep });
    assert.equal(r.urgencyLevel, "LOW");
    assert.equal(r.modelUrgencyOverruled, undefined);
  });

  test("A1: the Gemini caller asks for JSON and sends the key in a header, not the URL", async () => {
    let url = "", init: any = null;
    const fakeFetch = async (u: string, i: any) => { url = u; init = i; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: GOOD_TRIAGE }] } }] }) }; };
    const text = await geminiCaller(cfg(), fakeFetch)("gemini-x", { system: "s", user: "u" });
    assert.equal(text, GOOD_TRIAGE);
    assert.match(url, /models\/gemini-x:generateContent$/);
    assert.ok(!url.includes("test-key-not-real"));
    assert.equal(init.headers["x-goog-api-key"], "test-key-not-real");
    assert.equal(JSON.parse(init.body).generationConfig.responseMimeType, "application/json");
  });
});

// ------------------------------------------------------------------------------------------ A2
describe("A2 severity-ordered emergency rules", () => {
  test("A2: cough plus chest pain is treated as cardio-respiratory, never as a cold", () => {
    const r = triageWithoutAI("I have a cough and chest pain", "en");
    assert.equal(r.urgencyLevel, "CRITICAL");
    assert.equal(r.flagUrgentSOS, true);
  });

  test("A2: unrecognised input is not guessed", () => {
    const r = triageWithoutAI("blah qwerty", "en");
    assert.equal(r.notAssessed, true);
    assert.equal(r.flagUrgentSOS, false);
  });

  test("A2: emergency rules override the LLM - the model is never called", async () => {
    let calls = 0;
    const callModel: CallModel = async () => { calls++; return JSON.stringify({ ...JSON.parse(GOOD_TRIAGE), urgencyLevel: "LOW" }); };
    const r = await llmTriage("he is unconscious and not breathing", "en", { config: cfg(), callModel, backoff: noSleep });
    assert.equal(calls, 0);
    assert.equal(r.engine, "offline");
    assert.equal(r.urgencyLevel, "CRITICAL");
    assert.equal(r.flagUrgentSOS, true);
  });
});

// ------------------------------------------------------------------------------------------ A3
describe("A3 bilingual keyword and co-occurrence matching", () => {
  test("A3: Devanagari chest + pain with an adjective in between still escalates", () => {
    const r = triageWithoutAI("सीने में तेज़ दर्द");
    assert.equal(r.urgencyLevel, "CRITICAL");
    assert.equal(r.lang, "hi");
  });

  test("A3: romanised Hindi is matched too", () => {
    const r = triageWithoutAI("seene mein dard ho raha hai", "en");
    assert.equal(r.urgencyLevel, "CRITICAL");
  });
});

// ------------------------------------------------------------------------------------------ A4
describe("A4 Unicode-range language detection", () => {
  test("A4: any Devanagari character means Hindi; Latin only means English", () => {
    assert.equal(detectLang("mujhe bukhar hai"), "en");
    assert.equal(detectLang("fever बुखार"), "hi");
    assert.equal(detectLang(""), "en");
  });
});

// ------------------------------------------------------------------------------------------ A5
describe("A5 weighted hospital scoring and top-k", () => {
  const origin = { lat: 28.6139, lng: 77.209 };
  const base = { lat: 28.6139, lng: 77.209, availableBeds: 1, icuAvailable: 1, departmentSources: null };

  test("A5: a hospital with the needed department outranks a nearer one without it", () => {
    const cardiac = { ...base, lat: 28.66, specialties: ["Cardiology"] };   // about 5 km away
    const general = { ...base, specialties: ["Dermatology"] };              // 0 km away
    const sc = scoreHospital(cardiac, "Cardiologist", "CRITICAL", origin);
    const sg = scoreHospital(general, "Cardiologist", "CRITICAL", origin);
    assert.ok(sc.score > sg.score, `${sc.score} <= ${sg.score}`);
    assert.equal(sc.department !== null, true);
    assert.equal(sg.score, 10 + 20 + 40);
  });

  test("A5: ICU counts only for HIGH or CRITICAL; the maximum is 120", () => {
    const h = { ...base, specialties: ["Cardiology"] };
    const crit = scoreHospital(h, "Cardiologist", "CRITICAL", origin).score;
    const low = scoreHospital(h, "Cardiologist", "LOW", origin).score;
    assert.equal(crit - low, 20);
    assert.equal(crit, MAX_HOSPITAL_SCORE);
    assert.equal(scorePercent(crit), 100);
  });

  test("A5: topK returns the k best, best first, stable on ties", () => {
    const xs = [{ n: "a", s: 1 }, { n: "b", s: 5 }, { n: "c", s: 5 }, { n: "d", s: 3 }];
    assert.deepEqual(topK(xs, 3, (x) => x.s).map((x) => x.n), ["b", "c", "d"]);
    assert.deepEqual(topK(xs, 0, (x) => x.s), []);
  });
});

// ------------------------------------------------------------------------------------------ A6
describe("A6 nearest-neighbour linear scan", () => {
  test("A6: picks the closest point and reports its distance", () => {
    const pts = [{ id: 1, lat: 28.70, lng: 77.10 }, { id: 2, lat: 28.54, lng: 77.28 }, { id: 3, lat: 28.62, lng: 77.21 }];
    const o = { lat: 28.6139, lng: 77.209 };
    const r = nearest(o, pts)!;
    assert.equal(r.item.id, 3);
    assert.ok(Math.abs(r.distanceKm - haversineKm(o, pts[2])) < 1e-9);
    assert.equal(nearest(o, []), null);
  });
});

// ------------------------------------------------------------------------------------------ A7
describe("A7 OPD waiting-time estimation", () => {
  test("A7: with no timing data it equals the original 12q + 10", () => {
    for (const q of [0, 1, 4, 10]) assert.equal(estimateOpdWait({ patientsAhead: q }).minutes, 12 * q + 10);
    assert.equal(estimateOpdWait({ patientsAhead: 2 }).confidence, "low");
  });

  test("A7: uses the median of recent consultations and the doctor's delay, with a range", () => {
    const e = estimateOpdWait({ patientsAhead: 3, recentConsultMinutes: [8, 10, 9, 40, 11], doctorDelayMin: 15 });
    assert.equal(e.basis, "recent-consultations");
    assert.equal(e.perPatientMin, 10);              // median, not pulled up by the 40-minute case
    assert.equal(e.minutes, 3 * 10 + 10 + 15);
    assert.ok(e.low <= e.minutes && e.minutes <= e.high);
    assert.equal(e.confidence, "high");
    assert.match(e.note, /running late/);
  });

  test("A7: slot length is the fallback, and bad input is cleaned", () => {
    assert.equal(estimateOpdWait({ patientsAhead: 2, slotMinutes: 15 }).minutes, 40);
    assert.equal(estimateOpdWait({ patientsAhead: -3, recentConsultMinutes: [NaN, -1, 1000] }).minutes, 10);
  });
});

// ------------------------------------------------------------------------------------------ A8
describe("A8 exponential backoff and model failover", () => {
  test("A8: delays grow by the factor, with jitter in [d/2, d]", () => {
    assert.equal(backoffDelay(0, { random: () => 1 }), 600);
    assert.equal(backoffDelay(1, { random: () => 1 }), 1800);
    assert.equal(backoffDelay(1, { random: () => 0 }), 900);
    assert.equal(backoffDelay(10, { random: () => 1 }), 5000); // capped
  });

  test("A8: a transient failure is retried, waiting between attempts", async () => {
    const waits: number[] = [];
    let n = 0;
    const r = await withBackoff(async () => { if (++n < 3) throw new LlmError("http_503", 503); return "ok"; }, { sleep: async (ms) => { waits.push(ms); }, random: () => 1 });
    assert.equal(r, "ok");
    assert.deepEqual(waits, [600, 1800]);
  });

  test("A8: after the first model's retries fail, the second model answers", async () => {
    const callModel: CallModel = async (m) => { if (m === "model-a") throw new LlmError("http_503", 503); return "fine"; };
    const r = await generateWithFailover(["model-a", "model-b"], { system: "", user: "" }, callModel, noSleep);
    assert.equal(r.model, "model-b");
    assert.deepEqual(r.attempts, ["model-a#1", "model-a#2", "model-a#3", "model-b#1"]);
  });

  test("A8: a permanent error (bad key) stops retries and failover", async () => {
    let calls = 0;
    const callModel: CallModel = async () => { calls++; throw new LlmError("http_401", 401, true); };
    await assert.rejects(generateWithFailover(["a", "b"], { system: "", user: "" }, callModel, noSleep), /http_401/);
    assert.equal(calls, 1);
  });

  test("A8: the Gemini caller marks 5xx as transient and 4xx as permanent", async () => {
    const status = (s: number) => async () => ({ ok: false, status: s, json: async () => ({}) });
    await assert.rejects(geminiCaller(cfg(), status(503))("m", { system: "", user: "" }), (e: any) => e.status === 503 && !e.permanent);
    await assert.rejects(geminiCaller(cfg(), status(403))("m", { system: "", user: "" }), (e: any) => e.status === 403 && e.permanent);
  });
});

// ------------------------------------------------------------------------------------------ A9
describe("A9 graceful degradation", () => {
  test("A9: no key configured means exactly the offline result plus engine: offline", async () => {
    assert.equal(llmConfigFromEnv({}), null);
    const r = await llmTriage(NON_EMERGENCY, "en", { config: null });
    const { engine, ...rest } = r;
    assert.equal(engine, "offline");
    assert.deepEqual(rest, triage(NON_EMERGENCY, "en"));
    assert.equal(r.engineFallbackReason, undefined);
  });

  test("A9: invalid JSON from the model falls back to offline and says why", async () => {
    const r = await llmTriage(NON_EMERGENCY, "en", { config: cfg(), callModel: async () => "Sorry, I cannot help with that.", backoff: noSleep });
    assert.equal(r.engine, "offline");
    assert.match(r.engineFallbackReason!, /invalid_model_output/);
    assert.equal(r.suspectedCondition, triage(NON_EMERGENCY, "en").suspectedCondition);
  });

  test("A9: a timeout on every model falls back to offline", async () => {
    // A fetch that never answers until aborted.
    const hang = (_u: string, i: any) => new Promise<any>((_res, rej) => i.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    const config = { ...cfg(["only"]), timeoutMs: 20 };
    const r = await llmTriage(NON_EMERGENCY, "en", { config, callModel: geminiCaller(config, hang), backoff: { ...noSleep, attempts: 2 } });
    assert.equal(r.engine, "offline");
    assert.equal(r.engineFallbackReason, "timeout");
  });
});

// ------------------------------------------------------------------------------------------ A10
describe("A10 retrieval-augmented generation", () => {
  const passages: Passage[] = [
    { id: "M1", title: "Pan 40", text: "Pan 40 contains Pantoprazole (40mg). Uses: acidity.", source: "test", score: 0.9 },
    { id: "M2", title: "Rantac", text: "Rantac contains Ranitidine. Uses: heartburn.", source: "test", score: 0.5 },
  ];
  const retriever = () => passages;

  test("A10: the real retriever returns top-k cited passages from the medicine dataset", () => {
    const ps = retrieveMedicinePassages("medicine for acidity", 3);
    assert.ok(ps.length > 0 && ps.length <= 3);
    assert.deepEqual(ps.map((p) => p.id), ps.map((_, i) => `M${i + 1}`));
    assert.ok(ps.every((p) => p.source && p.text.includes(p.title)));
    for (let i = 1; i < ps.length; i++) assert.ok(ps[i - 1].score >= ps[i].score);
  });

  test("A10: offline generation quotes and cites every retrieved passage", async () => {
    const r = await answerWithRetrieval("acidity", { retriever, config: null });
    assert.equal(r.engine, "offline");
    assert.deepEqual(r.citations, ["M1", "M2"]);
    assert.ok(r.answer.includes("[M1] Pan 40 contains Pantoprazole"));
  });

  test("A10: nothing retrieved means abstain, not an answer from memory", async () => {
    const r = await answerWithRetrieval("zzz", { retriever: () => [], config: cfg(), callModel: async () => { throw new Error("must not be called"); } });
    assert.equal(r.abstained, true);
    assert.deepEqual(r.citations, []);
    assert.deepEqual(templatedAnswer("q", []).citations, []);
  });

  test("A10: the LLM sees only the passages and its citations must be among them", async () => {
    let user = "";
    const ok = await answerWithRetrieval("acidity", { retriever, config: cfg(), backoff: noSleep, callModel: async (_m, p) => { user = p.user; return JSON.stringify({ answer: "Pantoprazole is used for acidity [M1].", citations: ["M1"] }); } });
    assert.equal(ok.engine, "llm:model-a");
    assert.deepEqual(ok.citations, ["M1"]);
    assert.ok(user.includes("[M1] Pan 40") && user.includes("[M2] Rantac"));

    const bad = await answerWithRetrieval("acidity", { retriever, config: cfg(), backoff: noSleep, callModel: async () => JSON.stringify({ answer: "Take omeprazole [M7].", citations: ["M7"] }) });
    assert.equal(bad.engine, "offline");
    assert.equal(bad.engineFallbackReason, "citations_not_in_retrieved_passages");
  });
});

// ------------------------------------------------------------------------------------------ A11
describe("A11 robust JSON extraction and schema validation", () => {
  test("A11: plain, fenced, prose-wrapped and trailing-comma JSON all parse", () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(extractJson('Here is the result: {"a":[1,2]} Hope this helps.'), { a: [1, 2] });
    assert.deepEqual(extractJson('{"a":[1,2,],}'), { a: [1, 2] });
    assert.throws(() => extractJson("no json here"), /no_json_found/);
  });

  test("A11: commas inside strings are left alone", () => {
    assert.equal(stripTrailingCommas('{"t":"a, }"}'), '{"t":"a, }"}');
  });

  test("A11: schema validation rejects wrong types and unknown urgency levels", () => {
    assert.equal(parseTriageJson(GOOD_TRIAGE).ok, true);
    const bad = parseTriageJson(JSON.stringify({ ...JSON.parse(GOOD_TRIAGE), urgencyLevel: "SEVERE" }));
    assert.equal(bad.ok, false);
    assert.match(bad.error!, /urgencyLevel/);
    assert.equal(parseTriageJson(JSON.stringify({ ...JSON.parse(GOOD_TRIAGE), recommendations: [] })).ok, false);
  });
});

// ------------------------------------------------------------------------------------------ A12
// RBAC and ownership are enforced in server.ts middleware against real Firebase tokens, so they
// are tested end to end in tests/access-matrix.test.ts and tests/resource-ownership.test.ts.

// ------------------------------------------------------------------------------------------ A13
describe("A13 bcrypt (legacy account migration)", () => {
  test("A13: a hash of the email-derived legacy password is detected", async () => {
    const hash = await bcrypt.hash("google-sso-asha@example.com", 4);
    assert.match(hash, /^\$2[aby]\$04\$/);
    assert.equal(await hasLegacyDerivedPassword(" Asha@Example.com ", hash), true);
  });

  test("A13: a real password is not flagged, and no hash is not flagged", async () => {
    const hash = await bcrypt.hash("a genuinely chosen passphrase", 4);
    assert.equal(await hasLegacyDerivedPassword("asha@example.com", hash), false);
    assert.equal(await hasLegacyDerivedPassword("asha@example.com", null), false);
  });
});

// ------------------------------------------------------------------------------------------ A14
describe("A14 fixed-window rate limiting", () => {
  test("A14: allows `limit` requests per window, then refuses with Retry-After", () => {
    let t = 0;
    const lim = createFixedWindowLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    assert.deepEqual([1, 2, 3].map(() => lim.hit("u").allowed), [true, true, true]);
    t = 15_000;
    const refused = lim.hit("u");
    assert.equal(refused.allowed, false);
    assert.equal(refused.retryAfterSeconds, 45);
    assert.equal(lim.hit("other").allowed, true); // keys are independent
  });

  test("A14: a new window opens once the old one has passed", () => {
    let t = 0;
    const lim = createFixedWindowLimiter({ limit: 1, windowMs: 1000, now: () => t });
    assert.equal(lim.hit("u").allowed, true);
    assert.equal(lim.hit("u").allowed, false);
    t = 1001;
    assert.equal(lim.hit("u").allowed, true);
  });

  test("A14: expired windows are pruned once the map is over its cap", () => {
    let t = 0;
    const lim = createFixedWindowLimiter({ limit: 1, windowMs: 10, maxKeys: 2, now: () => t });
    ["a", "b", "c"].forEach((k) => lim.hit(k));
    t = 100;
    lim.hit("d");
    assert.equal(lim.size(), 1);
  });
});
