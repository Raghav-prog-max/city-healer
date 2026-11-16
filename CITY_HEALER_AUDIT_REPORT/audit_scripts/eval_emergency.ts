/**
 * AUDIT SCRIPT: emergency-detection recall and false positives on
 * tests/fixtures/emergency_safety_set.json, through the copilot orchestrator (hospital and doctor
 * lookups stubbed) and through the triage endpoint's function.
 *   npx tsx CITY_HEALER_AUDIT_REPORT/audit_scripts/eval_emergency.ts [label]
 * Appends to CITY_HEALER_AUDIT_REPORT/results/emergency_eval.json under [label].
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { orchestrate } from "../../server/ai/orchestrator";
import { triage } from "../../shared/triageModel";

const label = process.argv[2] || "run";
const set = JSON.parse(readFileSync("tests/fixtures/emergency_safety_set.json", "utf8"));
const ctx = { findHospitals: async () => [], findDoctors: async () => [] } as any;
const isEmergency = (r: any) => r.intent === "emergency_rule" || r.card?.type === "emergency";

async function run(items: any[]) {
  const rows: any[] = []; const ms: number[] = [];
  for (const it of items) {
    const a = performance.now();
    const r = await orchestrate(it.text, ctx);
    ms.push(performance.now() - a);
    const tr = triage(it.text);
    rows.push({ text: it.text, category: it.category, lang: it.lang, copilot: isEmergency(r), triage: tr.urgencyLevel === "CRITICAL" && tr.flagUrgentSOS === true, intent: r.intent });
  }
  return { rows, ms };
}
const pct = (n: number, d: number) => Math.round((n / d) * 1000) / 10;
const dev = await run(set.critical.development), hold = await run(set.critical.holdout), neg = await run(set.non_emergency);
const all = [...dev.ms, ...hold.ms, ...neg.ms].sort((a, b) => a - b);
const result = {
  at: new Date().toISOString(),
  development: { n: dev.rows.length, copilot_recall: pct(dev.rows.filter((r) => r.copilot).length, dev.rows.length), triage_recall: pct(dev.rows.filter((r) => r.triage).length, dev.rows.length), missed: dev.rows.filter((r) => !r.copilot || !r.triage).map((r) => r.text) },
  holdout: { n: hold.rows.length, copilot_recall: pct(hold.rows.filter((r) => r.copilot).length, hold.rows.length), triage_recall: pct(hold.rows.filter((r) => r.triage).length, hold.rows.length), missed: hold.rows.filter((r) => !r.copilot || !r.triage).map((r) => r.text) },
  non_emergency: { n: neg.rows.length, copilot_false_positive_rate: pct(neg.rows.filter((r) => r.copilot).length, neg.rows.length), triage_false_positive_rate: pct(neg.rows.filter((r) => r.triage).length, neg.rows.length), false_positives: neg.rows.filter((r) => r.copilot || r.triage).map((r) => r.text) },
  copilot_ms: { p50: Math.round(all[Math.floor(all.length / 2)] * 1000) / 1000, p95: Math.round(all[Math.floor(all.length * 0.95)] * 1000) / 1000 },
};
const file = "CITY_HEALER_AUDIT_REPORT/results/emergency_eval.json";
const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
prev[label] = result;
writeFileSync(file, JSON.stringify(prev, null, 2));
console.log(JSON.stringify(result, null, 1));
