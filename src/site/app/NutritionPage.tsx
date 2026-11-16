import React, { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { request } from "../lib/api";
import { Button, Card, ErrorNote } from "../components/ui";
import { DietPlanView, SafetyNote } from "../components/health";

/** embedded: shown inside the patient dashboard, which supplies its own page title. */
export default function NutritionPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState("diabetes");
  const [pref, setPref] = useState<"veg" | "non-veg">("veg");
  const [seed, setSeed] = useState(1);
  const [plan, setPlan] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { request<any>("/api/diet/conditions").then((r) => setConditions(r.conditions)).catch((e) => setError(e.message)); }, []);

  const make = async (nextSeed = seed) => {
    setBusy(true); setError("");
    try { setPlan(await request("/api/diet/recommend", { body: { condition, preference: pref, seed: nextSeed } })); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <div>
        {!embedded && <h1 className="font-display text-[32px]">{t.nutrition.title}</h1>}
        <p className="mt-1 max-w-[720px] text-subtle">{t.nutrition.body}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit space-y-5 p-5">
          <fieldset>
            <legend className="text-sm font-semibold">{t.nutrition.condition}</legend>
            <div className="mt-2 grid gap-1.5">
              {Object.entries(conditions).map(([k, label]) => (
                <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[15px] ${condition === k ? "border-care bg-sky-50" : "border-line"}`}>
                  <input type="radio" name="condition" className="accent-care" checked={condition === k} onChange={() => setCondition(k)} />{label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold">{t.nutrition.preference}</legend>
            <div className="mt-2 flex gap-2">
              {([["veg", t.nutrition.veg], ["non-veg", t.nutrition.nonveg]] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setPref(v)} aria-pressed={pref === v}
                  className={`h-10 flex-1 rounded-lg border text-sm font-medium ${pref === v ? "border-ink bg-ink text-paper" : "border-line"}`}>{label}</button>
              ))}
            </div>
          </fieldset>
          <Button className="w-full" loading={busy} onClick={() => { setSeed(1); make(1); }}>{t.nutrition.make}</Button>
          {plan && <Button variant="secondary" className="w-full" onClick={() => { const s = seed + 1; setSeed(s); make(s); }}>{t.nutrition.another}</Button>}
        </Card>
        <div className="space-y-4">
          {error && <ErrorNote message={error} />}
          {plan ? <Card className="p-5"><DietPlanView plan={plan} /></Card> : <Card className="grid min-h-[240px] place-items-center p-8 text-center text-subtle">{t.nutrition.body}</Card>}
          <SafetyNote>{t.ai.safety}</SafetyNote>
        </div>
      </div>
    </div>
  );
}
