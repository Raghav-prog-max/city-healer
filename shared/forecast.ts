/**
 * Aggregate demand forecasting (Intelligence Platform zip, module 4: app/services/prediction.py).
 *
 * The zip fits one linear trend and reports its in-sample R². Here three simple models compete
 * and the one with the lowest error on the most recent, held-out days is used:
 *   mean      the average of the last 7 days
 *   trend     ordinary least squares on the day index (the zip's model)
 *   weekly    same weekday last week (seasonal naive), for weekday patterns like OPD Mondays
 * The chosen model is refitted on all days. The reported error is the held-out mean absolute
 * error, and the range is the forecast ± 1.5 × that error, not a statistical interval.
 *
 * For aggregate counts (appointments or emergency alerts per day), never for a patient.
 */
export type ForecastMethod = "mean" | "trend" | "weekly";

export interface Forecast {
  forecast: number[];
  low: number[];
  high: number[];
  method: ForecastMethod;
  backtest: { heldOutDays: number; mae: Record<ForecastMethod, number | null>; naiveMae: number | null };
  trainingDays: number;
  warning: string;
}

export const MIN_DAYS = 14;
const WARNING = "Aggregate planning aid only. Not validated for staffing, clinical capacity or decisions about any patient.";

function fitPredict(method: ForecastMethod, history: number[], horizon: number): number[] {
  const n = history.length;
  if (method === "mean") {
    const last = history.slice(-7);
    const m = last.reduce((a, b) => a + b, 0) / last.length;
    return Array(horizon).fill(m);
  }
  if (method === "weekly") {
    return Array.from({ length: horizon }, (_, h) => history[n - 7 + (h % 7)]);
  }
  // Least squares y = a + b·x over x = 0..n-1.
  const xm = (n - 1) / 2;
  const ym = history.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  history.forEach((y, x) => { sxy += (x - xm) * (y - ym); sxx += (x - xm) ** 2; });
  const b = sxx ? sxy / sxx : 0;
  const a = ym - b * xm;
  return Array.from({ length: horizon }, (_, h) => a + b * (n + h));
}

const mae = (pred: number[], actual: number[]) => pred.reduce((s, p, i) => s + Math.abs(p - actual[i]), 0) / actual.length;

export function forecastCounts(dailyCounts: number[], horizonDays = 7): Forecast {
  if (!Array.isArray(dailyCounts) || dailyCounts.some((x) => !Number.isFinite(x) || x < 0)) throw new Error("Counts must be non-negative numbers.");
  if (dailyCounts.length < MIN_DAYS) throw new Error(`At least ${MIN_DAYS} days of counts are needed (got ${dailyCounts.length}).`);
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 30) throw new Error("horizonDays must be 1 to 30.");

  // Hold out the last week (or a quarter of a short series), fit on what came before.
  const held = Math.min(7, Math.floor(dailyCounts.length / 4));
  const train = dailyCounts.slice(0, -held), test = dailyCounts.slice(-held);
  const methods: ForecastMethod[] = ["mean", "trend", "weekly"];
  const scores = {} as Record<ForecastMethod, number | null>;
  for (const m of methods) scores[m] = m === "weekly" && train.length < 7 ? null : Math.round(mae(fitPredict(m, train, held), test) * 100) / 100;
  const best = methods.filter((m) => scores[m] !== null).sort((x, y) => (scores[x]! - scores[y]!))[0];
  // Yesterday's count repeated: what any model has to beat.
  const naiveMae = Math.round(mae(Array(held).fill(train[train.length - 1]), test) * 100) / 100;

  const raw = fitPredict(best, dailyCounts, horizonDays).map((v) => Math.max(0, v));
  const spread = 1.5 * (scores[best] || 0);
  return {
    forecast: raw.map((v) => Math.round(v)),
    low: raw.map((v) => Math.max(0, Math.round(v - spread))),
    high: raw.map((v) => Math.round(v + spread)),
    method: best,
    backtest: { heldOutDays: held, mae: scores, naiveMae },
    trainingDays: dailyCounts.length,
    warning: WARNING,
  };
}

/** Per-day counts for the last `days` days ending today (UTC), from a list of ISO dates. */
export function dailySeries(dates: string[], days: number, today = new Date()): { start: string; counts: number[] } {
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const start = end - (days - 1) * 86400000;
  const counts = Array(days).fill(0);
  for (const d of dates) {
    const t = Date.parse(String(d).slice(0, 10));
    if (Number.isFinite(t) && t >= start && t <= end) counts[Math.round((t - start) / 86400000)]++;
  }
  return { start: new Date(start).toISOString().slice(0, 10), counts };
}
