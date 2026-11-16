import React, { useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "../i18n";
import { request } from "../lib/api";
import { Badge, Button, Card, ErrorNote } from "../components/ui";
import { MedicineView, SafetyNote } from "../components/health";

/** embedded: shown inside the patient dashboard, which supplies its own page title. */
export default function MedicinesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [guide, setGuide] = useState<any>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (query: string) => {
    if (!query.trim()) return;
    setBusy(true); setError(""); setGuide(null); setResults(null);
    try {
      // A name first; if nothing close enough, search by what it treats.
      const g = await request<any>("/api/medicines/guide", { body: { name: query.trim() } });
      if (g.found && g.similarity >= 0.5) setGuide(g);
      else {
        const s = await request<any>("/api/medicines/search-nationwide", { body: { query: query.trim() } });
        setResults(s.reference || []);
      }
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div>
        {!embedded && <h1 className="font-display text-[32px]">{t.medicines.title}</h1>}
        <p className="mt-1 text-subtle">{t.medicines.body}</p>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <label htmlFor="med-q" className="sr-only">{t.medicines.name}</label>
          <input id="med-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.medicines.name}
            className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-[16px] outline-none focus:border-care focus:ring-4 focus:ring-care/15" />
        </div>
        <Button type="submit" size="lg" loading={busy}>{t.medicines.lookup}</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {["Dolo", "Pan 40", "paracetmol", "acidity", "allergy sneezing", "high blood pressure"].map((s) => (
          <button key={s} onClick={() => { setQ(s); run(s); }} className="h-9 rounded-full border border-line bg-white px-3.5 text-sm hover:border-care">{s}</button>
        ))}
      </div>
      {error && <ErrorNote message={error} />}
      {guide && (
        <Card className="space-y-3 p-5">
          {!guide.exactMatch && <Badge tone="warn">{t.medicines.closest} · {Math.round(guide.similarity * 100)}%</Badge>}
          <MedicineView m={guide.medicine} substitutes={guide.substitutes} />
          <p className="border-t border-line pt-3 text-xs text-subtle">{t.medicines.source}: {guide.source}</p>
        </Card>
      )}
      {results && (
        <Card className="p-5">
          <p className="font-semibold">{results.length ? t.medicines.results : t.medicines.notFound}</p>
          <ul className="mt-3 divide-y divide-line">
            {results.map((m) => (
              <li key={m.name} className="py-3">
                <button className="text-left" onClick={() => { setQ(m.name); run(m.name); }}>
                  <span className="font-medium text-care-deep">{m.name}</span>
                  <span className="block text-sm text-subtle">{m.composition} · {m.uses.slice(0, 2).join(", ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <SafetyNote tone="warn">{t.medicines.body}</SafetyNote>
    </div>
  );
}
