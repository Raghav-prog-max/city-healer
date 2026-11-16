/**
 * Model monitoring: every prediction the orchestrator makes is recorded here, per model.
 *
 * Tracked: calls, abstentions (the model declined to answer below its threshold), mean
 * confidence, latency (p50 / p95) and the spread of predicted labels. For the text models
 * it also tracks the share of inputs with no word the model knows. That share rising over
 * time is the simplest sign of input drift: people asking things the training data never
 * covered, which means it is time to add data and retrain (see ml/README.md).
 *
 * In memory, last 1,000 events per model; reset on restart. Served at /api/ai/monitoring.
 */

interface Event { at: number; confidence: number; abstained: boolean; label: string; ms?: number; knownTerms?: number }

const WINDOW = 1000;
const events = new Map<string, Event[]>();

export const monitor = {
  record(model: string, e: Omit<Event, "at">) {
    const list = events.get(model) || [];
    list.push({ ...e, at: Date.now() });
    if (list.length > WINDOW) list.splice(0, list.length - WINDOW);
    events.set(model, list);
  },

  snapshot() {
    const out: Record<string, any> = {};
    for (const [model, list] of events) {
      const ms = list.map((e) => e.ms).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
      const pct = (p: number) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] : null);
      const labels: Record<string, number> = {};
      for (const e of list) labels[e.label] = (labels[e.label] || 0) + 1;
      const withTerms = list.filter((e) => typeof e.knownTerms === "number");
      out[model] = {
        calls: list.length,
        abstentionRate: round(list.filter((e) => e.abstained).length / list.length),
        meanConfidence: round(list.reduce((a, e) => a + e.confidence, 0) / list.length),
        latencyMs: { p50: pct(0.5), p95: pct(0.95) },
        labels,
        ...(withTerms.length
          ? { unknownInputRate: round(withTerms.filter((e) => (e.knownTerms || 0) === 0).length / withTerms.length) }
          : {}),
        lastAt: new Date(list[list.length - 1].at).toISOString(),
      };
    }
    return out;
  },
};

const round = (x: number) => Math.round(x * 1000) / 1000;
