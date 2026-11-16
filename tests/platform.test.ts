/**
 * Intelligence Platform modules (City_Healer_Intelligence_Platform_Seven_Modules.zip), ported
 * from its tests/test_baselines.py plus the parts this app added: forecast model selection,
 * report reading, entity candidates and provider ranking.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { forecastCounts, dailySeries, MIN_DAYS } from "../shared/forecast";
import { extractDocument, candidateValues } from "../server/ai/documents";
import { analyseText, rankProviders, copilotRoute, extractEntities } from "../server/ai/platform";
import { triage } from "../shared/triageModel";

describe("zip baselines, against this app's models", () => {
  test("a request for a doctor is an appointment intent", () => {
    assert.equal(analyseText("I need to find a doctor in Noida").classification.intent, "appointment");
  });

  test("Hindi script is detected", () => {
    assert.equal(analyseText("मुझे डॉक्टर चाहिए").classification.language, "hi");
    assert.equal(analyseText("mujhe doctor chahiye").classification.language, "hinglish");
  });

  test("the zip's urgent phrases are emergencies here too", () => {
    for (const s of ["I have difficulty breathing", "I have chest pain", "severe bleeding from a cut", "saans nahi aa rahi", "chest mein dard hai", "wo behosh ho gaya", "I feel suicidal"]) {
      assert.equal(triage(s).urgencyLevel, "CRITICAL", s);
    }
  });

  test("copilot routes", () => {
    assert.equal(copilotRoute({ intent: "emergency_rule" }), "urgent_human_care");
    assert.equal(copilotRoute({ intent: "lab_report" }), "document_intelligence");
    assert.equal(copilotRoute({ intent: "greeting" }), "general_information");
  });

  test("discovery never ranks unverified or hidden providers", () => {
    const providers = [
      { id: "a", verificationStatus: "verified", listingStatus: "active", specialty: "GP", city: "Noida", consultationTypes: ["online"], languages: ["Hindi"] },
      { id: "b", verificationStatus: "pending", listingStatus: "hidden", specialty: "GP", city: "Noida" },
      { id: "c", verificationStatus: "verified", listingStatus: "active", specialty: "GP", city: "Delhi" },
      { id: "d", verificationStatus: "verified", listingStatus: "hidden", specialty: "GP", city: "Noida" },
    ];
    const ranked = rankProviders(providers, { specialty: "GP", city: "Noida", consultationType: "online", preferredLanguage: "hi" });
    assert.deepEqual(ranked.map((r) => r.provider.id), ["a", "c"]);
    assert.deepEqual(ranked[0].reasons, ["specialty_match", "city_match", "consultation_type_match", "language_match"]);
  });
});

describe("demand forecast", () => {
  test("refuses short, negative or malformed series", () => {
    assert.throws(() => forecastCounts([1, 2, 3, 4, 5, 6, 7], 3), /At least/);
    assert.throws(() => forecastCounts([...Array(13).fill(1), -1], 3), /non-negative/);
    assert.throws(() => forecastCounts(Array(MIN_DAYS).fill(1), 31), /horizon/);
  });

  test("forecasts are non-negative and come with a range", () => {
    const r = forecastCounts([30, 28, 25, 22, 20, 18, 15, 13, 10, 8, 6, 4, 2, 1], 7);
    assert.equal(r.forecast.length, 7);
    assert.ok(r.forecast.every((x) => x >= 0));
    assert.ok(r.low.every((x, i) => x <= r.forecast[i] && r.forecast[i] <= r.high[i]));
  });

  test("a weekday pattern is picked up by the weekly model", () => {
    const week = [40, 25, 22, 20, 21, 12, 5];
    const r = forecastCounts([...week, ...week, ...week, ...week], 7);
    assert.equal(r.method, "weekly");
    assert.deepEqual(r.forecast, week);
    assert.ok(r.backtest.mae.weekly! < r.backtest.naiveMae!);
  });

  test("a steady rise is picked up by the trend model", () => {
    const r = forecastCounts(Array.from({ length: 28 }, (_, i) => 10 + 2 * i), 3);
    assert.equal(r.method, "trend");
    assert.deepEqual(r.forecast, [66, 68, 70]);
  });

  test("daily series count per day and ignore dates outside the window", () => {
    const today = new Date("2026-11-16T12:00:00Z");
    const s = dailySeries(["2026-11-16", "2026-11-16T09:00:00Z", "2026-11-14", "2025-01-01", "junk"], 3, today);
    assert.equal(s.start, "2026-11-14");
    assert.deepEqual(s.counts, [1, 0, 2]);
  });
});

describe("lab report reading", () => {
  const report = [
    "City Diagnostics — Complete Blood Count",
    "Patient: Test  Age: 34 years  Sex: Male",
    "Haemoglobin        11.2     g/dL      13.0 - 17.0",
    "WBC: 7.8 x10^3/uL",
    "Platelets          150      x10^3/uL  150 - 410",
    "MCV - 72 fL",
  ].join("\n");
  const bytes = (s: string) => new TextEncoder().encode(s);

  test("a text report fills the CBC panel", async () => {
    const r = await extractDocument("report.txt", bytes(report));
    assert.equal(r.status, "extracted");
    assert.equal(r.engine, "plain_text");
    assert.equal(r.lab.panel, "cbc");
    assert.equal(r.lab.values.haemoglobin, 11.2);
    assert.equal(r.lab.values.platelets, 150000);
    assert.equal(r.lab.values.mcv, 72);
    assert.equal(r.clinicalInterpretation, "not_performed");
  });

  test("label/value pairs are found in both 'Label: value' and column layouts", () => {
    const labels = candidateValues(report).map((c) => c.label.toLowerCase());
    assert.ok(labels.includes("wbc"));
    assert.ok(labels.includes("haemoglobin"));
  });

  test("other file types and empty files are refused with a reason", async () => {
    assert.equal((await extractDocument("scan.jpg", bytes("x"))).status, "unsupported_type");
    assert.equal((await extractDocument("empty.txt", bytes("   "))).status, "no_text_found");
  });

  test("a PDF is read when pdf.js is installed, and says so when it is not", async () => {
    const r = await extractDocument("report.pdf", bytes("%PDF-1.4\n%%EOF"));
    assert.ok(["dependency_missing", "unreadable", "no_text_found", "extracted"].includes(r.status), r.status);
  });
});

describe("entities", () => {
  test("symptoms in three languages and lab values", () => {
    const e = extractEntities("mujhe bukhar aur सिर दर्द hai, sugar 180");
    const norm = e.map((x) => x.normalised);
    assert.ok(norm.includes("fever"));
    assert.ok(norm.includes("headache"));
    assert.ok(norm.includes("glucose"));
  });

  test("short words only match whole words", () => {
    assert.ok(!extractEntities("the bpm reading").some((x) => x.normalised === "hypertension"));
  });
});

describe("lab terms that look alike", () => {
  test("HbA1c is the diabetes test, not haemoglobin", async () => {
    const { extractLabValues } = await import("../server/ai/orchestrator");
    assert.deepEqual(extractLabValues("HbA1c: 7.1 %").values, { hba1c: 7.1 });
    assert.deepEqual(extractLabValues("hemoglobin A1c 6.5").values, { hba1c: 6.5 });
    assert.deepEqual(extractLabValues("Hb 11.2 g/dL").values, { haemoglobin: 11.2 });
    assert.deepEqual(extractLabValues("हीमोग्लोबिन 12").values, { haemoglobin: 12 });
  });
});
