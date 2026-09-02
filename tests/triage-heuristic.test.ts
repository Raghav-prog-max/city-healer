/**
 * Offline triage heuristic — unit tests.
 *
 * This runs against the pure function, so it needs no server and finishes instantly.
 *
 * Classification tests pass "en" explicitly so they assert *which verdict* was
 * reached, independently of the language it is worded in. The localisation tests
 * at the bottom are the ones that assert the wording.
 *
 * The Hindi cases exist because of a specific near-miss. The net matched English
 * substrings only, so a Hindi speaker describing heavy bleeding got "not enough
 * detail to assess" — MEDIUM, no SOS. It failed safe rather than inventing a
 * diagnosis, but it failed silently: the speech transcription looked perfect and
 * only the verdict was wrong, which is the worst kind of failure to demo.
 *
 *   npx tsx --test tests/triage-heuristic.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { triageWithoutAI } from "../shared/triage";

/** Every escalating case must reach CRITICAL and raise the ambulance flag. */
function assertCritical(input: string, label: string) {
  const r = triageWithoutAI(input);
  assert.equal(r.urgencyLevel, "CRITICAL", `${label}: expected CRITICAL, got ${r.urgencyLevel} (${r.suspectedCondition})`);
  assert.equal(r.flagUrgentSOS, true, `${label}: expected flagUrgentSOS`);
  assert.notEqual(r.notAssessed, true, `${label}: must not fall through to "not assessed"`);
}

describe("red flags escalate in English", () => {
  const cases: Array<[string, string]> = [
    ["he is unconscious and not breathing", "unconscious"],
    ["my leg is broken and bleeding heavily", "trauma"],
    ["sudden slurred speech and face drooping", "stroke"],
    ["crushing chest pain radiating to my left arm", "cardiac"]
  ];
  for (const [input, label] of cases) {
    test(label, () => assertCritical(input, label));
  }
});

describe("red flags escalate in Devanagari Hindi", () => {
  const cases: Array<[string, string]> = [
    ["वह बेहोश है और साँस नहीं ले रहा", "unconscious"],
    ["बहुत खून बह रहा है", "heavy bleeding"],
    ["मेरी हड्डी टूट गई है", "fracture"],
    ["सीने में तेज़ दर्द हो रहा है", "chest pain"],
    ["साँस लेने में तकलीफ हो रही है", "breathlessness"],
    ["अचानक बोलने में दिक्कत और मुँह टेढ़ा", "stroke"],
    ["मिर्गी का दौरा पड़ा है", "seizure"]
  ];
  for (const [input, label] of cases) {
    test(label, () => assertCritical(input, label));
  }
});

describe("red flags escalate in romanised Hindi", () => {
  const cases: Array<[string, string]> = [
    ["seene mein dard ho raha hai", "chest pain"],
    ["bahut khoon beh raha hai", "bleeding"],
    ["saans lene mein takleef", "breathlessness"],
    ["wo behosh hai", "unconscious"]
  ];
  for (const [input, label] of cases) {
    test(label, () => assertCritical(input, label));
  }
});

describe("ordinary Hindi symptoms are graded, not escalated", () => {
  test("fever -> MEDIUM, no SOS", () => {
    const r = triageWithoutAI("मुझे तेज़ बुखार है");
    assert.equal(r.urgencyLevel, "MEDIUM");
    assert.equal(r.flagUrgentSOS, false);
    assert.notEqual(r.notAssessed, true);
  });

  test("headache -> LOW, and is not mistaken for chest pain", () => {
    const r = triageWithoutAI("सिर में दर्द है", "en");
    assert.equal(r.urgencyLevel, "LOW");
    assert.match(r.suspectedCondition, /headache|migraine/i);
  });

  test("cough and cold -> LOW", () => {
    const r = triageWithoutAI("खांसी और जुकाम है");
    assert.equal(r.urgencyLevel, "LOW");
    assert.equal(r.flagUrgentSOS, false);
  });

  test("stomach upset -> MEDIUM", () => {
    const r = triageWithoutAI("पेट में दर्द और उल्टी");
    assert.equal(r.urgencyLevel, "MEDIUM");
  });
});

describe("the two ambiguous pairs stay separated", () => {
  test("सिर में दर्द (headache) does not read as सीने में दर्द (chest pain)", () => {
    assert.match(triageWithoutAI("सिर में दर्द है", "en").suspectedCondition, /headache|migraine/i);
    assert.match(triageWithoutAI("सीने में दर्द है", "en").suspectedCondition, /cardiac|respiratory/i);
  });

  test("सिर में चोट (head injury) escalates as trauma, not as a headache", () => {
    const r = triageWithoutAI("सिर में चोट लगी है", "en");
    assert.equal(r.urgencyLevel, "CRITICAL");
    assert.match(r.suspectedCondition, /trauma/i);
  });
});

describe("non-symptom input is still recognised, in both languages", () => {
  test("English facility search", () => {
    const r = triageWithoutAI("icu bed near me");
    assert.equal(r.notAssessed, true);
    assert.match(r.suspectedCondition, /not a symptom/i);
  });

  test("Hindi facility search", () => {
    const r = triageWithoutAI("मेरे पास आईसीयू बेड कहाँ है", "en");
    assert.equal(r.notAssessed, true);
    assert.match(r.suspectedCondition, /not a symptom/i);
  });

  test("a Hindi facility search that also mentions a symptom is triaged, not deflected", () => {
    const r = triageWithoutAI("सीने में दर्द है, अस्पताल कहाँ है");
    assert.equal(r.urgencyLevel, "CRITICAL");
    assert.equal(r.flagUrgentSOS, true);
  });
});

describe("unrecognised input still refuses to guess", () => {
  test("gibberish -> not assessed, never a fabricated diagnosis", () => {
    const r = triageWithoutAI("asdfghjkl qwerty zxcvbn");
    assert.equal(r.notAssessed, true);
    assert.equal(r.flagUrgentSOS, false);
    assert.match(r.suspectedCondition, /not enough detail/i);
  });

  test("every result is labelled as heuristic, never as a clinical assessment", () => {
    for (const input of ["सीने में दर्द", "chest pain", "asdf"]) {
      assert.equal(triageWithoutAI(input).source, "offline-heuristic");
    }
  });
});

describe("the response is written in the caller's language", () => {
  const devanagari = /[ऀ-ॿ]/;

  test("Hindi input returns Hindi prose, not English", () => {
    const r = triageWithoutAI("सीने में तेज़ दर्द हो रहा है");
    assert.equal(r.lang, "hi");
    assert.match(r.suspectedCondition, devanagari, "condition should be in Devanagari");
    assert.match(r.explanation, devanagari, "explanation should be in Devanagari");
    assert.match(r.specialistType, devanagari, "specialist should be in Devanagari");
    for (const rec of r.recommendations) {
      assert.match(rec, devanagari, `recommendation should be in Devanagari: ${rec}`);
    }
  });

  test("English input returns English prose", () => {
    const r = triageWithoutAI("crushing chest pain");
    assert.equal(r.lang, "en");
    assert.doesNotMatch(r.explanation, devanagari);
  });

  test("an explicit lang overrides the detected script", () => {
    const r = triageWithoutAI("crushing chest pain", "hi");
    assert.equal(r.lang, "hi");
    assert.match(r.explanation, devanagari, "explicit hi must win over English input");
    assert.equal(r.urgencyLevel, "CRITICAL", "the clinical verdict must not change with language");
  });

  test("the verdict is identical across languages — only the wording differs", () => {
    const en = triageWithoutAI("bleeding heavily", "en");
    const hi = triageWithoutAI("bleeding heavily", "hi");
    assert.equal(en.urgencyLevel, hi.urgencyLevel);
    assert.equal(en.flagUrgentSOS, hi.flagUrgentSOS);
    assert.notEqual(en.explanation, hi.explanation);
  });

  test("every verdict has complete Hindi copy — no English leaking through", () => {
    const inputs = [
      "आईसीयू बेड कहाँ है", "वह बेहोश है", "बहुत खून बह रहा है", "मिर्गी का दौरा",
      "सीने में तेज़ दर्द", "पेट में तेज़ दर्द", "तेज़ बुखार", "सिर में दर्द",
      "खांसी और जुकाम", "कुछ समझ नहीं आ रहा xyz"
    ];
    for (const input of inputs) {
      const r = triageWithoutAI(input, "hi");
      assert.match(r.suspectedCondition, devanagari, `condition for "${input}"`);
      assert.match(r.explanation, devanagari, `explanation for "${input}"`);
      assert.ok(r.recommendations.length >= 3, `recommendations for "${input}"`);
      for (const rec of r.recommendations) {
        assert.match(rec, devanagari, `recommendation for "${input}": ${rec}`);
      }
    }
  });
});
