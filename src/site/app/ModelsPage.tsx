/**
 * Model registry and model cards (/api/ai/models), plus live monitoring for administrators
 * (/api/ai/monitoring). Every number here comes from the training scripts' own reports.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cpu, Database, ShieldCheck, AlertTriangle, BarChart3, Layers, TrendingUp } from "lucide-react";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { request } from "../lib/api";
import { Badge, Card, ErrorNote, LanguageSwitcher, Logo, Spinner } from "../components/ui";

/** embedded: shown inside the patient dashboard, which supplies its own page title. */
export default function ModelsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const { role } = useSession();
  const [models, setModels] = useState<any[] | null>(null);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [modules, setModules] = useState<any[] | null>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<any>("/api/ai/models").then((r) => setModels(r.models)).catch((e) => setError(e.message));
    request<any>("/api/v1/platform/modules").then((r) => setModules(r.modules)).catch(() => {});
    if (role === "ADMIN") {
      request<any>("/api/ai/monitoring").then(setMonitoring).catch(() => {});
      request<any>("/api/v1/ml/demand-forecast?series=appointments&days=90&horizon=7").then(setForecast).catch(() => {});
    }
  }, [role]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <div>
        {!embedded && <h1 className="font-display text-[32px]">{t.models.title}</h1>}
        <p className="mt-1 max-w-[760px] text-subtle">{t.models.body}</p>
      </div>
      {error && <ErrorNote message={error} />}
      {!models && !error && <Spinner label={t.app.loading} />}

      {modules && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Layers className="h-5 w-5 text-care" aria-hidden="true" />{t.models.modules}</h2>
          <p className="mt-1 text-sm text-subtle">{t.models.modulesBody}</p>
          <ol className="mt-3 divide-y divide-line">
            {modules.map((m) => (
              <li key={m.id} className="grid gap-1 py-2.5 sm:grid-cols-[220px_1fr]">
                <p className="font-semibold">{m.id}. {m.name}<span className="block text-xs font-normal text-subtle">{m.status}</span></p>
                <p className="text-sm text-subtle">{m.implementation}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {forecast && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><TrendingUp className="h-5 w-5 text-care" aria-hidden="true" />{t.models.forecast}</h2>
          {forecast.forecast ? <>
            <div className="mt-3 flex flex-wrap gap-2">
              {forecast.forecast.map((v: number, i: number) => (
                <div key={i} className="rounded-lg bg-mist px-3 py-2 text-center">
                  <p className="text-xs text-subtle">+{i + 1}</p>
                  <p className="font-semibold tabular-nums">{v}</p>
                  <p className="text-[11px] text-subtle tabular-nums">{forecast.low[i]}–{forecast.high[i]}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-subtle">{t.models.forecastMethod}: <b>{forecast.method}</b> · {t.models.forecastError}: {forecast.backtest.mae[forecast.method]} {t.models.perDay} · {t.models.forecastNaive} {forecast.backtest.naiveMae}</p>
            <p className="mt-1 text-xs text-subtle">{forecast.warning}</p>
          </> : <p className="mt-2 text-sm text-subtle">{forecast.message}</p>}
        </Card>
      )}

      {monitoring && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 className="h-5 w-5 text-care" aria-hidden="true" />{t.models.monitoring}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-subtle">
                <tr><th className="py-2">Model</th><th>{t.models.calls}</th><th>{t.models.abstain}</th><th>{t.models.conf}</th><th>{t.models.p95}</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {Object.entries(monitoring.models).map(([id, m]: any) => (
                  <tr key={id}><td className="py-2 font-medium">{id}</td><td className="tabular-nums">{m.calls}</td><td className="tabular-nums">{Math.round(m.abstentionRate * 100)}%</td><td className="tabular-nums">{m.meanConfidence.toFixed(2)}</td><td className="tabular-nums">{m.latencyMs.p95 ?? "–"}{m.latencyMs.p95 != null ? " ms" : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {!monitoring && role !== "ADMIN" && models && <p className="text-sm text-subtle">{t.models.adminOnly}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {models?.map((m) => (
          <Card key={m.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold"><Cpu className="h-5 w-5 text-care" aria-hidden="true" />{m.name}</p>
                <p className="mt-0.5 font-mono text-xs text-subtle">{m.id} · v{m.version}</p>
              </div>
              <Badge tone={m.status === "deployed" ? "health" : "neutral"}>{m.status === "deployed" ? t.models.deployed : t.models.rules}</Badge>
            </div>
            <p className="mt-3 text-[15px]">{m.task}</p>
            <p className="mt-1 text-sm text-subtle">{m.algorithm}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              {m.metrics.map((x: any) => (
                <div key={x.label} className="rounded-lg bg-mist px-3 py-2"><dt className="text-xs text-subtle">{x.label}</dt><dd className="font-semibold tabular-nums">{x.value}</dd></div>
              ))}
            </dl>
            <div className="mt-4 space-y-2 text-sm">
              <p className="flex gap-2"><Database className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" /><span><span className="font-semibold">{t.models.data}:</span> {m.data.map((d: any) => `${d.name} (${d.licence}; ${d.size})`).join("; ")}</span></p>
              {m.safety.length > 0 && <p className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-health" aria-hidden="true" /><span><span className="font-semibold">{t.models.safety}:</span> {m.safety.join(". ")}.</span></p>}
              <p className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" /><span><span className="font-semibold">{t.models.limits}:</span> {m.limitations.join(". ")}.</span></p>
            </div>
            <p className="mt-auto pt-4 font-mono text-xs text-subtle">{t.models.trainedBy}: {m.trainedBy}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ModelsPublic() {
  const { href } = useI18n();
  return (
    <div className="ch min-h-screen bg-mist">
      <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 sm:px-6">
        <Link to={href("/")} className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" aria-hidden="true" /><Logo /></Link>
        <LanguageSwitcher />
      </header>
      <main className="px-4 py-6 sm:px-6"><ModelsPage /></main>
    </div>
  );
}
