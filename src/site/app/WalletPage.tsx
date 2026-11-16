import React, { useEffect, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { auth } from "../../firebase";
import { useI18n } from "../i18n";
import { request } from "../lib/api";
import { Button, Card, ErrorNote, Spinner } from "../components/ui";
import { LabResult, SafetyNote } from "../components/health";

type Panel = "cbc" | "diabetes" | "heart" | "liver" | "thyroid";
const PANELS: Panel[] = ["cbc", "diabetes", "heart", "liver", "thyroid"];
const SAMPLE_FOR: Record<Panel, string> = { cbc: "blood_cbc", diabetes: "diabetes_panel", heart: "lipid_profile", liver: "liver_panel", thyroid: "thyroid_panel" };
// Yes / no inputs of the heart model, shown as switches rather than numbers.
const BOOLEAN_KEYS = new Set(["fastingSugarHigh", "exerciseAngina"]);

/** embedded: shown inside the patient dashboard, which supplies its own page title. */
/** Remembered on this device so the dashboard's health snapshot can show the latest values. */
export const LAST_LABS_KEY = "ch_last_labs";

export default function WalletPage({ embedded = false, onSaved }: { embedded?: boolean; onSaved?: () => void } = {}) {
  const { t } = useI18n();
  const [meta, setMeta] = useState<{ panels: Record<Panel, { key: string; label: string; unit: string }[]>; samples: Record<string, { panel: Panel; values: Record<string, number> }> } | null>(null);
  const [panel, setPanel] = useState<Panel>("cbc");
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState("");
  // Values pre-filled from a report that the patient has not yet confirmed or edited, with the
  // text each was read from. Analyse stays off until every one has been checked.
  const [unconfirmed, setUnconfirmed] = useState<Record<string, string>>({});
  const [skippedNote, setSkippedNote] = useState("");
  const settle = (key: string) => setUnconfirmed((u) => { const { [key]: _, ...rest } = u; return rest; });

  // Report upload (Intelligence Platform module 3): the server reads the file in memory and
  // returns recognised lab values; they fill the form for the patient to check, never analysed
  // without them pressing Analyse.
  const readReport = async (file: File | undefined) => {
    if (!file) return;
    setReading(true); setReadNote(""); setSkippedNote(""); setError("");
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const res = await fetch(`/api/v1/documents/extract?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { "Content-Type": file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: file,
      });
      const doc = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(doc.error || `HTTP ${res.status}`);
      // Only the detected panel's own inputs (plus sex), so a value from another test on the
      // same report is not sent with this one.
      const keys = new Set([...(meta?.panels[doc.lab?.panel as Panel] || []).map((f) => f.key), "male"]);
      const found = (Object.entries(doc.lab?.values || {}) as [string, number][]).filter(([k]) => keys.has(k));
      if (doc.status !== "extracted") { setReadNote(doc.message || t.wallet.nothingFound); return; }
      // Tests the report names but whose number could not be read safely are listed, not guessed.
      const fieldsOf = (p: Panel | undefined) => (p && meta?.panels[p]) || [];
      const skippedPanel = (doc.lab?.panel as Panel) || PANELS.find((p) => fieldsOf(p).some((f) => (doc.lab?.skipped || []).some((s: any) => s.key === f.key)));
      const skipped = fieldsOf(skippedPanel).filter((f) => (doc.lab?.skipped || []).some((s: any) => s.key === f.key)).map((f) => f.label.replace(/\s*\(.*\)$/, ""));
      if (skipped.length) setSkippedNote(t.wallet.skipped(skipped.join(", ")));
      if (!doc.lab?.panel || !found.length) { setReadNote(t.wallet.nothingFound); return; }
      setPanel(doc.lab.panel as Panel);
      setResult(null);
      setValues(Object.fromEntries(found.map(([k, v]) => [k, String(v)])));
      setUnconfirmed(Object.fromEntries(found.filter(([k]) => k !== "male").map(([k]) => [k, String(doc.lab?.sources?.[k] ?? "")])));
      setReadNote(t.wallet.filled(found.filter(([k]) => k !== "male").length, file.name));
    } catch (err: any) { setError(err.message); } finally { setReading(false); }
  };

  useEffect(() => { request<any>("/api/records/analyze/panels").then(setMeta).catch((e) => setError(e.message)); }, []);

  const fields = (meta?.panels[panel] || []).filter((f) => f.key !== "male");
  const needsSex = (meta?.panels[panel] || []).some((f) => f.key === "male") || panel === "cbc" || panel === "heart";

  const choosePanel = (p: Panel) => { setPanel(p); setValues({}); setUnconfirmed({}); setResult(null); setReadNote(""); setSkippedNote(""); };
  const toCheck = Object.keys(unconfirmed).length;
  const fillSample = () => {
    const s = meta?.samples[SAMPLE_FOR[panel]];
    if (s) { setValues(Object.fromEntries(Object.entries(s.values).map(([k, v]) => [k, String(v)]))); setUnconfirmed({}); }
  };
  const analyse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const numeric = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
      setResult(await request("/api/records/analyze", { body: { panel, values: numeric } }));
      setSaved(false);
      try {
        const prev = JSON.parse(localStorage.getItem(LAST_LABS_KEY) || "{}");
        localStorage.setItem(LAST_LABS_KEY, JSON.stringify({ ...prev, ...numeric, at: new Date().toISOString() }));
      } catch {}
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const input = "h-11 w-full rounded-lg border border-line bg-white px-3 text-[16px] tabular-nums outline-none focus:border-care focus:ring-4 focus:ring-care/15";

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      {!embedded && <h1 className="font-display text-[32px]">{t.wallet.title}</h1>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-care" aria-hidden="true" />{t.wallet.labTitle}</h2>
          <p className="mt-1.5 text-sm text-subtle">{t.wallet.labBody}</p>
          {!meta && !error && <div className="mt-4"><Spinner label={t.app.loading} /></div>}
          {meta && (
            <div className="mt-4 rounded-lg border border-dashed border-line p-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-care-deep">
                <Upload className="h-4 w-4" aria-hidden="true" />{reading ? t.wallet.reading : t.wallet.upload}
                <input type="file" accept=".txt,.pdf,text/plain,application/pdf" className="sr-only" disabled={reading}
                  onChange={(e) => { readReport(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <p className="mt-1 text-xs text-subtle">{t.wallet.uploadHint}</p>
              {readNote && <p className="mt-2 text-sm" role="status">{readNote}</p>}
              {skippedNote && <p className="mt-2 text-sm text-amber-800" role="status">{skippedNote}</p>}
            </div>
          )}
          {meta && (
            <form onSubmit={analyse} className="mt-5 space-y-4">
              <fieldset>
                <legend className="text-sm font-semibold">{t.wallet.panel}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PANELS.map((p) => (
                    <button type="button" key={p} onClick={() => choosePanel(p)} aria-pressed={panel === p}
                      className={`h-9 rounded-full border px-3.5 text-sm font-medium ${panel === p ? "border-care bg-care text-white" : "border-line hover:border-care"}`}>
                      {(t.wallet as any)[p]}
                    </button>
                  ))}
                </div>
              </fieldset>
              {needsSex && (
                <fieldset>
                  <legend className="text-sm font-semibold">{t.wallet.sex}</legend>
                  <div className="mt-2 flex gap-2">
                    {[["1", t.wallet.male], ["0", t.wallet.female]].map(([v, label]) => (
                      <button type="button" key={v} onClick={() => setValues((s) => ({ ...s, male: v }))} aria-pressed={values.male === v}
                        className={`h-9 rounded-lg border px-3.5 text-sm ${values.male === v ? "border-ink bg-ink text-paper" : "border-line"}`}>{label}</button>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="grid grid-cols-2 gap-3">
                {fields.map((f) => BOOLEAN_KEYS.has(f.key) ? (
                  <label key={f.key} className="col-span-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-care" checked={values[f.key] === "1"} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.checked ? "1" : "0" }))} />
                    {f.label.replace(/\s*\(1 yes \/ 0 no\)/, "")}
                  </label>
                ) : (
                  <label key={f.key} className="text-[13px] font-medium leading-tight">
                    {f.label.replace(/\s*\(.*\)$/, "")}{f.unit && <span className="font-normal text-subtle"> ({f.unit})</span>}
                    <input type="number" step="any" inputMode="decimal" value={values[f.key] ?? ""}
                      className={`${input} mt-1 ${f.key in unconfirmed ? "!border-amber-500 !bg-amber-50" : ""}`}
                      aria-describedby={f.key in unconfirmed ? `from-report-${f.key}` : undefined}
                      onChange={(e) => { setValues((s) => ({ ...s, [f.key]: e.target.value })); settle(f.key); }} />
                    {f.key in unconfirmed && (
                      <span id={`from-report-${f.key}`} className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal text-amber-800">
                        <span>{unconfirmed[f.key] ? t.wallet.fromReport(unconfirmed[f.key]) : t.wallet.fromReportPlain}</span>
                        <button type="button" onClick={() => settle(f.key)} className="rounded-md border border-amber-500 bg-white px-2 py-0.5 font-semibold text-amber-900">{t.wallet.confirmValue}</button>
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {toCheck > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">{t.wallet.confirmFirst(toCheck)}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={busy} disabled={toCheck > 0 || !Object.values(values).some((v) => v !== "")}>{t.wallet.analyse}</Button>
                <Button type="button" variant="secondary" onClick={fillSample}>{t.wallet.sample}</Button>
                <Button type="button" variant="ghost" onClick={() => { setValues({}); setUnconfirmed({}); setResult(null); }}>{t.wallet.clearValues}</Button>
              </div>
            </form>
          )}
        </Card>
        <div className="space-y-4">
          {error && <ErrorNote message={error} />}
          {result ? (
            <Card className="space-y-4 p-5">
              <LabResult a={result} />
              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <Button variant="secondary" loading={saving} disabled={saved} onClick={async () => {
                  setSaving(true);
                  try {
                    await request("/api/records", { body: { title: result.reportType, diagnoseSummary: result.interpretation, doctorName: "City Healer lab analyzer", attachmentName: "" } });
                    setSaved(true); onSaved?.();
                  } catch (e: any) { setError(e.message); } finally { setSaving(false); }
                }}>{saved ? t.wallet.savedOk : t.wallet.save}</Button>
              </div>
            </Card>
          ) : (
            <Card className="grid min-h-[240px] place-items-center p-8 text-center text-subtle">{t.wallet.labBody}</Card>
          )}
          <SafetyNote>{t.ai.safety}</SafetyNote>
        </div>
      </div>
    </div>
  );
}
