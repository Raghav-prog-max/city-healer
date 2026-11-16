/**
 * Patient-safety regression tests for emergency language (P0.1).
 *
 * Dataset: tests/fixtures/emergency_safety_set.json — a DRAFT, not yet clinician-reviewed. Every
 * "critical" message (development and holdout) must escalate to emergency guidance, both in the
 * triage function and in the copilot. False positives on "non_emergency" are measured and bounded,
 * not required to be zero: this net is tuned to over-escalate rather than miss.
 *
 * These rules are pattern matching, not a clinically validated triage model.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { triageWithoutAI } from "../shared/triage";
import { triage } from "../shared/triageModel";
import { detectEmergency } from "../shared/emergencySafety";
import { orchestrate } from "../server/ai/orchestrator";

const set = JSON.parse(readFileSync(new URL("./fixtures/emergency_safety_set.json", import.meta.url), "utf8"));
const critical = [...set.critical.development, ...set.critical.holdout] as { text: string; category: string; lang: string }[];
const ctx = { findHospitals: async () => [], findDoctors: async () => [] } as any;
const isEmergency = (r: any) => r.intent === "emergency_rule" || r.card?.type === "emergency";

// Words that would reassure someone that an emergency is fine. Never allowed in a reply to one.
const REASSURANCE = /not serious|nothing to worry|no need to worry|don'?t worry|you (?:are|will be) (?:safe|fine|okay|ok)|it'?s (?:normal|nothing)|self-limiting|usually harmless|घबराने की (?:कोई )?बात नहीं|चिंता की (?:कोई )?बात नहीं/i;

describe("the four emergencies the audit found missed", () => {
  for (const [text, category] of [
    ["I want to kill myself", "self_harm"],
    ["I took 30 sleeping pills", "overdose"],
    ["my lips are turning blue and I can barely breathe", "breathing"],
    ["मुझे साँस लेने में बहुत तकलीफ हो रही है", "breathing"],
  ] as const) {
    test(`escalates: ${text}`, async () => {
      assert.equal(detectEmergency(text)?.category, category);
      const t = triageWithoutAI(text);
      assert.equal(t.urgencyLevel, "CRITICAL");
      assert.equal(t.flagUrgentSOS, true);
      assert.ok(isEmergency(await orchestrate(text, ctx)));
    });
  }
});

describe("critical safety set: 100% recall required", () => {
  test(`every critical message escalates in triage (${critical.length} messages)`, () => {
    const missed = critical.filter((c) => { const r = triage(c.text); return !(r.urgencyLevel === "CRITICAL" && r.flagUrgentSOS); });
    assert.deepEqual(missed.map((m) => m.text), []);
  });

  test("every critical message escalates in the copilot, with no reassurance", async () => {
    const missed: string[] = [], reassuring: string[] = [];
    for (const c of critical) {
      const r = await orchestrate(c.text, ctx);
      if (!isEmergency(r)) missed.push(c.text);
      if (REASSURANCE.test(r.reply)) reassuring.push(c.text);
    }
    assert.deepEqual(missed, []);
    assert.deepEqual(reassuring, []);
  });

  test("each category is covered in English, Hindi and Hinglish", () => {
    for (const cat of ["self_harm", "overdose", "breathing", "chest_pain", "bleeding", "unconscious"]) {
      const langs = new Set(critical.filter((c) => c.category === cat).map((c) => c.lang));
      for (const l of ["en", "hi", "hinglish"]) assert.ok(langs.has(l), `${cat} has no ${l} example`);
    }
  });
});

describe("crisis wording", () => {
  test("self-harm replies point to Tele-MANAS and 112, in the language used", async () => {
    const en = await orchestrate("I want to kill myself", ctx);
    assert.match(en.reply, /14416/);
    assert.match(en.reply, /112/);
    const hi = await orchestrate("मैं आत्महत्या करना चाहता हूँ", ctx);
    assert.match(hi.reply, /14416/);
    assert.match(hi.reply, /टेली-मानस/);
  });

  test("other emergencies tell the person to call 112 now", async () => {
    const r = await orchestrate("my father fainted and is not waking up", ctx);
    assert.match(r.reply, /Call 112 now/);
  });

  test("the rules are not presented as a validated model", () => {
    const r = triageWithoutAI("I want to kill myself");
    assert.equal(r.source, "offline-heuristic");
    assert.doesNotMatch(`${r.explanation} ${r.recommendations.join(" ")}`, /diagnos|validated|accurate/i);
  });
});

describe("false positives (measured, bounded)", () => {
  test("non-emergency messages rarely escalate", async () => {
    const fp: string[] = [];
    for (const n of set.non_emergency) if (isEmergency(await orchestrate(n.text, ctx))) fp.push(n.text);
    const rate = fp.length / set.non_emergency.length;
    console.log(`  false positives: ${fp.length}/${set.non_emergency.length} (${(rate * 100).toFixed(1)}%)`, fp);
    assert.ok(rate <= 0.1, `false-positive rate ${(rate * 100).toFixed(1)}% exceeds 10%: ${fp.join(" | ")}`);
  });

  test("ordinary medicine-taking and figures of speech do not escalate", () => {
    for (const s of ["maine dawai kha li", "took dolo 650 mg at night", "I had 2 tablets of paracetamol for fever", "this traffic is killing me", "I am dying to know my sugar report result", "breathing exercises for anxiety"]) {
      assert.equal(detectEmergency(s), null, s);
    }
  });
});
