/**
 * City Healer AI: the models trained in ml/ and the orchestrator that routes to them.
 *
 * Parity tests compare the TypeScript inference with scikit-learn's own outputs saved by
 * the training scripts, so the server cannot silently drift from what was evaluated.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import labModels from "../shared/lab-models.json";
import intentModel from "../shared/intent-model.json";
import { predictRisk, analyseLabReport } from "../shared/labModels";
import { predictIntent } from "../shared/intentModel";
import { lookupMedicine, searchMedicines, substitutesFor } from "../server/medicineIndex";
import { recommendDiet, parseCondition } from "../server/dietRecommender";
import { orchestrate, extractLabValues } from "../server/ai/orchestrator";
import { MODEL_CARDS } from "../server/ai/registry";
import { monitor } from "../server/ai/monitor";

const ctx = {
  findHospitals: async () => [{ name: "Test Hospital" }],
  findDoctors: async (category: string) => [{ name: "Dr Test", specialty: category }],
};

describe("lab risk models", () => {
  for (const panel of ["diabetes", "heart", "liver"] as const) {
    test(`${panel}: matches scikit-learn probabilities`, () => {
      for (const c of (labModels as any).models[panel].parity) {
        const got = predictRisk(panel, c.input).probability;
        assert.ok(Math.abs(got - c.probability) < 1e-4, `${panel} ${JSON.stringify(c.input)}: ${got} vs ${c.probability}`);
      }
    });
  }

  test("higher glucose raises diabetes risk", () => {
    const low = predictRisk("diabetes", { glucose: 90, bmi: 22, diastolicBp: 70, age: 30 }).probability;
    const high = predictRisk("diabetes", { glucose: 190, bmi: 34, diastolicBp: 88, age: 55 }).probability;
    assert.ok(high > low + 0.3, `${low} -> ${high}`);
  });

  test("missing values are reported, not hidden", () => {
    const r = predictRisk("liver", { alt: 200 });
    assert.ok(r.imputed.length >= 8);
  });

  test("reference ranges and patterns", () => {
    const a = analyseLabReport("cbc", { haemoglobin: 9.5, mcv: 72, male: 1 });
    assert.equal(a.flags.find((f) => f.key === "haemoglobin")?.status, "LOW");
    assert.match(a.interpretation, /iron-deficiency/);
    assert.equal(a.risk, null, "CBC has no trained model and must not pretend to");
    const d = analyseLabReport("diabetes", { glucose: 150, hba1c: 7.1, age: 50, bmi: 29 });
    assert.equal(d.flags.find((f) => f.key === "hba1c")?.status, "HIGH");
    assert.ok(d.risk && d.risk.probability > 0.5);
  });
});

describe("intent model", () => {
  test("matches scikit-learn predictions", () => {
    for (const c of (intentModel as any).parity) {
      const p = predictIntent(c.text);
      assert.equal(p.label, c.label, c.text);
      assert.ok(Math.abs(p.confidence - c.confidence) < 1e-3, `${c.text}: ${p.confidence} vs ${c.confidence}`);
    }
  });

  test("routes everyday requests in three languages", () => {
    assert.equal(predictIntent("what should I eat for diabetes").label, "diet");
    assert.equal(predictIntent("mujhe kal se bukhar hai").label, "symptoms");
    assert.equal(predictIntent("मेरी ब्लड रिपोर्ट समझा दीजिए").label, "lab_report");
    assert.equal(predictIntent("side effects of metformin").label, "medicine");
  });
});

describe("medicine retrieval", () => {
  test("finds products despite misspelling", () => {
    assert.match(lookupMedicine("telma 40").match!.name, /^Telma/i);
    const para = lookupMedicine("paracetmol");
    assert.equal(para.ingredient, "paracetamol");
    assert.match(para.match!.composition, /paracetamol/i);
  });

  test("searches by use, one result per composition", () => {
    const r = searchMedicines("medicine for acidity", 5);
    assert.ok(r.length === 5);
    assert.equal(new Set(r.map((m) => m.composition.toLowerCase())).size, 5);
  });

  test("substitutes share the exact composition", () => {
    const m = lookupMedicine("pan 40").match!;
    for (const s of substitutesFor(m.name, 5)) assert.equal(s.composition.toLowerCase(), m.composition.toLowerCase());
  });
});

describe("diet recommender", () => {
  test("parses conditions in plain words", () => {
    assert.equal(parseCondition("sugar"), "diabetes");
    assert.equal(parseCondition("high BP"), "hypertension");
    assert.equal(parseCondition("cholesterol"), "heart");
  });

  test("vegetarian plans contain no meat, fish or egg", () => {
    for (const c of ["diabetes", "heart", "weight_loss", "weight_gain", "general"]) {
      for (const seed of [1, 2, 3]) {
        const plan = recommendDiet(c, "veg", seed);
        for (const s of plan.schedule) for (const f of s.foods) assert.doesNotMatch(f.name, /chicken|mutton|fish|prawn|egg(?!plant)|keema|meat/i, `${c}: ${f.name}`);
      }
    }
  });

  test("diabetic plans avoid sweets and land near the calorie target", () => {
    const plan = recommendDiet("diabetes", "veg", 1);
    for (const s of plan.schedule) for (const f of s.foods) assert.doesNotMatch(f.name, /halwa|jalebi|laddu|kheer|juice|sweet/i);
    assert.ok(Math.abs(plan.totalKcal - plan.targetKcal) < plan.targetKcal * 0.35, `${plan.totalKcal} vs ${plan.targetKcal}`);
    assert.equal(plan.schedule.length, 5);
  });

  test("no food repeats within a day", () => {
    const names = recommendDiet("general", "non-veg", 4).schedule.flatMap((s) => s.foods.map((f) => f.name));
    assert.equal(new Set(names).size, names.length);
  });
});

describe("orchestrator", () => {
  test("emergency wording is escalated by rules, before any model", async () => {
    const r = await orchestrate("my father is unconscious and not breathing", ctx);
    assert.equal(r.intent, "emergency_rule");
    assert.equal(r.trace[0].model, "safety-rules");
    assert.equal(r.trace.length, 1, "no model may run after a red flag");
    assert.equal(r.action?.tab, "sos");
  });

  test("Hindi emergency wording too", async () => {
    const r = await orchestrate("पापा बेहोश हो गए हैं", ctx);
    assert.equal(r.intent, "emergency_rule");
  });

  test("symptoms go to the triage model and bring doctors of the right kind", async () => {
    const r = await orchestrate("I have been sneezing with a runny nose and itchy eyes for a week", ctx);
    assert.equal(r.intent, "symptoms");
    assert.equal(r.card?.type, "triage");
    assert.ok(r.trace.some((s) => s.model === "symptom-triage"));
  });

  test("lab values typed in a message are read and analysed", async () => {
    assert.deepEqual(extractLabValues("my haemoglobin is 9.8 and platelets 120").values, { haemoglobin: 9.8, platelets: 120000 });
    const r = await orchestrate("my fasting sugar is 160 and hba1c 7.4, what does it mean", ctx);
    assert.equal(r.intent, "lab_report");
    assert.equal(r.card?.type, "lab");
    assert.ok(r.card!.data.risk, "diabetes values should run the diabetes model");
  });

  test("medicine questions are answered from the catalogue", async () => {
    const r = await orchestrate("what is telma 40 used for", ctx);
    assert.equal(r.intent, "medicine");
    assert.equal(r.card?.type, "medicine");
    assert.match(r.card!.data.composition, /telmisartan/i);
  });

  test("diet requests return a plan", async () => {
    const r = await orchestrate("what should I eat for high cholesterol", ctx);
    assert.equal(r.intent, "diet");
    assert.equal(r.card?.data.conditionKey, "heart");
  });

  test("gibberish is not guessed at", async () => {
    const r = await orchestrate("qwzx plorb vnnn", ctx);
    assert.equal(r.intent, "unsure");
    assert.equal(r.card?.type, "choices");
  });

  test("replies in Hindi to Hindi", async () => {
    const r = await orchestrate("नमस्ते", ctx);
    assert.match(r.reply, /[ऀ-ॿ]/);
  });

  test("every call is monitored", async () => {
    await orchestrate("hello", ctx);
    const snap = monitor.snapshot();
    assert.ok(snap.orchestrator.calls > 0);
    assert.ok(snap["intent-classifier"].calls > 0);
  });
});

describe("model registry", () => {
  test("every deployed model has data, metrics and limitations", () => {
    assert.ok(MODEL_CARDS.length >= 8);
    for (const m of MODEL_CARDS) {
      assert.ok(m.data.length && m.metrics.length && m.limitations.length, m.id);
      assert.ok(m.trainedBy, m.id);
    }
  });
});
