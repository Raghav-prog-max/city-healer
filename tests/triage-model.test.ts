/**
 * The trained model's TypeScript inference must agree with scikit-learn, and the
 * hybrid triage must keep the safety rules in charge of emergencies.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { predictCondition, triage, CONDITIONS, CONFIDENCE_THRESHOLD } from "../shared/triageModel";
import model from "../shared/triage-model.json";

const parity: { text: string; label: string; confidence: number }[] = JSON.parse(
  readFileSync(new URL("../ml/parity.json", import.meta.url), "utf8")
);

describe("trained model: parity with scikit-learn", () => {
  test("predicts the same label and confidence as the Python model", () => {
    for (const sample of parity) {
      const p = predictCondition(sample.text);
      assert.equal(p.label, sample.label, sample.text);
      // Weights are rounded on export, so allow a small difference.
      assert.ok(Math.abs(p.confidence - sample.confidence) < 0.01, `${p.confidence} vs ${sample.confidence}`);
    }
  });

  test("every class the model can predict has patient-facing copy", () => {
    for (const label of model.classes) assert.ok(CONDITIONS[label], label);
  });
});

describe("hybrid triage", () => {
  test("a clear non-emergency description is answered by the model", () => {
    const r = triage("I have a burning sensation when I pass urine and I need to go to the toilet very often. My lower abdomen hurts.");
    assert.equal(r.source, "ml-model");
    assert.match(r.suspectedCondition, /urinary/i);
    assert.ok(r.confidence! >= CONFIDENCE_THRESHOLD);
    assert.equal(r.flagUrgentSOS, false);
  });

  test("red-flag wording goes to the rules, whatever the model thinks", () => {
    for (const input of ["crushing chest pain and sweating", "सीने में तेज़ दर्द हो रहा है", "he is unconscious and not breathing", "bleeding heavily from a deep cut"]) {
      const r = triage(input);
      assert.equal(r.source, "safety-rules", input);
      assert.equal(r.urgencyLevel, "CRITICAL", input);
      assert.equal(r.flagUrgentSOS, true, input);
    }
  });

  test("a red flag inside an otherwise ordinary description still escalates", () => {
    const r = triage("I have had a cough and runny nose for three days and now I have chest pain and cannot breathe");
    assert.equal(r.urgencyLevel, "CRITICAL");
    assert.equal(r.flagUrgentSOS, true);
  });

  test("nonsense is not given a diagnosis", () => {
    const r = triage("asdfghjkl qwerty zxcvbn");
    assert.notEqual(r.source, "ml-model");
    assert.equal(r.notAssessed, true);
  });

  test("a facility search is not treated as symptoms", () => {
    const r = triage("icu bed near me");
    assert.equal(r.source, "safety-rules");
    assert.equal(r.notAssessed, true);
  });

  test("a vague Hindi complaint is left to the rules, not guessed by the model", () => {
    const r = triage("मुझे तेज़ बुखार है");
    assert.equal(r.source, "offline-heuristic");
    assert.equal(r.lang, "hi");
  });

  test("a detailed Hindi description is answered by the model, in Hindi", () => {
    const r = triage("पेशाब करते समय बहुत जलन होती है और बार-बार पेशाब जाना पड़ता है, पेट के निचले हिस्से में दर्द है");
    assert.equal(r.source, "ml-model");
    assert.equal(r.lang, "hi");
    assert.match(r.suspectedCondition, /मूत्र/);
  });

  test("romanised Hindi is answered by the model", () => {
    const r = triage("kohni aur ghutno par safed papdi wale mote laal chakatte hain jo theek nahi hote");
    assert.equal(r.source, "ml-model");
    assert.match(r.suspectedCondition, /psoriasis/i);
  });

  test("model answers can be given in Hindi", () => {
    const r = triage("My skin has red patches covered with silvery scales on my elbows and knees and they itch", "hi");
    assert.equal(r.source, "ml-model");
    assert.match(r.suspectedCondition, /सोरायसिस/);
  });
});
