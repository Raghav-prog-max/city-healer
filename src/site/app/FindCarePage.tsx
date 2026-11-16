import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, MapPin, Sparkles } from "lucide-react";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { request } from "../lib/api";
import { useLocationConsent, CITY_CENTRES } from "../lib/location";
import { Button, ErrorNote, Spinner } from "../components/ui";
import { DoctorCard, HospitalCard, SafetyNote } from "../components/health";

/** embedded: shown inside the patient dashboard, which supplies its own page title. */
export default function FindCarePage({ embedded = false, only }: { embedded?: boolean; only?: "doctors" | "hospitals" } = {}) {
  const { t, href } = useI18n();
  const { user, name, profile } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = only || (params.get("tab") === "hospitals" ? "hospitals" : "doctors");
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState(params.get("specialty") || "");
  const { coords, status, locate } = useLocationConsent();
  // Exact location if shared; otherwise the centre of the city chosen at onboarding.
  const cityCentre = !coords && profile?.city ? CITY_CENTRES[profile.city] : undefined;
  // Without either, central Delhi, which is what the page says it sorts from.
  const origin = coords || cityCentre || CITY_CENTRES.Delhi;
  const [doctors, setDoctors] = useState<any[] | null>(null);
  const [hospitals, setHospitals] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<string | null>(null);
  const [booked, setBooked] = useState("");
  // 1,000+ hospitals: show the nearest first, a page at a time.
  const [shown, setShown] = useState(24);

  const load = () => {
    setError("");
    const qs = origin ? `?lat=${origin.lat}&lng=${origin.lng}` : "";
    Promise.all([request<any[]>(`/api/doctors${qs}`), request<any[]>(`/api/hospitals${qs}`)])
      .then(([d, h]) => { setDoctors(d); setHospitals(h); })
      .catch((e) => setError(e.message));
  };
  useEffect(load, [coords, cityCentre]); // eslint-disable-line react-hooks/exhaustive-deps

  const specialties = useMemo(() => [...new Set((doctors || []).map((d) => d.specialty))].sort(), [doctors]);
  const q = query.trim().toLowerCase();
  const shownDoctors = (doctors || []).filter((d) =>
    (!specialty || d.specialty === specialty) &&
    (!q || `${d.name} ${d.specialty} ${d.hospitalName}`.toLowerCase().includes(q)));
  const shownHospitals = (hospitals || []).filter((h) =>
    !q || `${h.name} ${h.address} ${(h.specialties || []).join(" ")}`.toLowerCase().includes(q));

  const book = async (d: any) => {
    setBooking(d.id);
    setBooked("");
    try {
      const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      await request("/api/appointments", { body: { doctorId: d.id, patientId: user?.uid, patientName: name, date, time: "10:00", symptoms: "", type: "VIRTUAL" } });
      setBooked(d.name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBooking(null);
    }
  };

  const setTab = (v: string) => { const p = new URLSearchParams(params); p.set("tab", v); setParams(p, { replace: true }); };

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      {!embedded && <h1 className="font-display text-[32px]">{t.care2.title}</h1>}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {!only && <div className="inline-flex rounded-xl border border-line bg-white p-1" role="tablist">
          {(["doctors", "hospitals"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
              className={`h-10 rounded-lg px-5 text-[15px] font-semibold ${tab === v ? "bg-ink text-paper" : "text-subtle hover:text-text"}`}>
              {v === "doctors" ? t.care2.doctors : t.care2.hospitals}
            </button>
          ))}
        </div>}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <label htmlFor="care-search" className="sr-only">{t.care2.search}</label>
          <input id="care-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.care2.search}
            className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-[16px] outline-none focus:border-care focus:ring-4 focus:ring-care/15" />
        </div>
        {tab === "doctors" && (
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">{t.care2.specialty}</span>
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="h-12 rounded-xl border border-line bg-white px-3 text-[15px]">
              <option value="">{t.care2.specialty}: {t.care2.all}</option>
              {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-subtle">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        {coords ? t.home.sharedLocation : cityCentre ? `${t.home.fromCity} ${profile.city}` : t.home.noLocation}
        {!coords && status !== "denied" && <Button variant="secondary" size="sm" onClick={locate} loading={status === "locating"}>{t.home.shareLocation}</Button>}
      </div>

      {booked && <SafetyNote>{t.care2.booked} ({booked})</SafetyNote>}
      {error && <ErrorNote message={error} onRetry={load} />}

      {!doctors && !error ? <Spinner label={t.app.loading} /> : tab === "doctors" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shownDoctors.map((d) => <DoctorCard key={d.id} d={d} onBook={user ? book : undefined} booking={booking === d.id} />)}
          {shownDoctors.length === 0 && <p className="text-subtle">{t.care2.none}</p>}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shownHospitals.slice(0, shown).map((h) => <HospitalCard key={h.id} h={h} />)}
          {shownHospitals.length === 0 && <p className="text-subtle">{t.care2.none}</p>}
          {shownHospitals.length > shown && (
            <div className="md:col-span-2 flex items-center justify-between gap-3 text-sm text-subtle">
              <span>{shown} / {shownHospitals.length}</span>
              <Button variant="secondary" onClick={() => setShown((n) => n + 24)}>{t.care2.more}</Button>
            </div>
          )}
          <p className="md:col-span-2 text-xs text-subtle">{t.care2.osmCredit}</p>
        </div>
      )}

      <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center">
        <Sparkles className="h-6 w-6 shrink-0 text-care" aria-hidden="true" />
        <div className="flex-1"><p className="font-semibold">{t.care2.symptomTitle}</p><p className="text-sm text-subtle">{t.care2.symptomBody}</p></div>
        <Link to={href("/app/assistant")} className="inline-flex h-10 items-center rounded-xl bg-care px-4 text-sm font-semibold text-white hover:bg-care-deep">{t.care2.check}</Link>
      </div>
    </div>
  );
}
