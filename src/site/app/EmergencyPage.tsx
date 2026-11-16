/**
 * Emergency. Both plans are explicit: 112 first, no account needed, and never suggest that
 * City Healer has sent help, because there is no dispatch partner. The old SOS screen showed
 * an ambulance number and an ETA that it had made up.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, MapPin, ArrowLeft } from "lucide-react";
import { useI18n } from "../i18n";
import { request } from "../lib/api";
import { useLocationConsent, CITY_CENTRES } from "../lib/location";
import { useSession } from "../lib/session";
import { Button, ErrorNote, Logo, LanguageSwitcher, Spinner } from "../components/ui";
import { HospitalCard, SafetyNote } from "../components/health";

/** embedded: shown inside the patient dashboard, which supplies its own page title. */
export default function EmergencyPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const { coords, status, locate } = useLocationConsent();
  const { profile } = useSession();
  // Exact location if shared; otherwise the centre of the city chosen at onboarding.
  const cityCentre = !coords && profile?.city ? CITY_CENTRES[profile.city] : undefined;
  // Without either, central Delhi, which is what the page says it sorts from.
  const origin = coords || cityCentre || CITY_CENTRES.Delhi;
  const [hospitals, setHospitals] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    const qs = origin ? `?lat=${origin.lat}&lng=${origin.lng}` : "";
    request<any[]>(`/api/hospitals${qs}`)
      .then((list) => setHospitals(list.filter((h) => h.icuAvailable > 0 || (h.specialties || []).some((s: string) => /emergency|trauma|critical/i.test(s))).slice(0, 4)))
      .catch((e) => setError(e.message));
  };
  useEffect(load, [coords, cityCentre]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      {!embedded && <h1 className="font-display text-[32px] text-red-900">{t.emergency.title}</h1>}
      <a href="tel:112" className="flex min-h-[88px] items-center justify-center gap-3 rounded-2xl bg-danger px-6 text-center text-2xl font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-700">
        <Phone className="h-7 w-7" aria-hidden="true" />{t.emergency.call}
      </a>
      <p className="text-center text-[15px] text-subtle">{t.emergency.callBody}</p>
      <a href="tel:102" className="flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-danger font-semibold text-danger hover:bg-red-50">
        <Phone className="h-5 w-5" aria-hidden="true" />{t.emergency.ambulance}
      </a>
      <SafetyNote tone="danger"><strong>{t.emergency.noDispatch}</strong></SafetyNote>

      <section aria-labelledby="wait-title" className="rounded-2xl border border-line bg-white p-5">
        <h2 id="wait-title" className="text-lg font-semibold">{t.emergency.whileWaiting}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[16px]">
          <li>{t.emergency.w1}</li><li>{t.emergency.w2}</li><li>{t.emergency.w3}</li><li>{t.emergency.w4}</li>
        </ol>
      </section>

      <section aria-labelledby="near-er">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="near-er" className="text-lg font-semibold">{t.emergency.nearest}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-subtle"><MapPin className="h-4 w-4" aria-hidden="true" />{coords ? t.emergency.sortedFromYou : cityCentre ? `${t.home.fromCity} ${profile.city}` : t.emergency.sortedFromCentre}</p>
          </div>
          {!coords && status !== "denied" && <Button variant="secondary" onClick={locate} loading={status === "locating"}>{status === "locating" ? t.emergency.locating : t.emergency.share}</Button>}
        </div>
        <div className="mt-3">
          {error ? <ErrorNote message={error} onRetry={load} /> : !hospitals ? <Spinner label={t.app.loading} /> : (
            <div className="grid gap-3 md:grid-cols-2">{hospitals.map((h) => <HospitalCard key={h.id} h={h} compact />)}</div>
          )}
        </div>
      </section>
    </div>
  );
}

/** The same page without an account: emergency help must not sit behind a sign-in. */
export function EmergencyPublic() {
  const { t, href } = useI18n();
  return (
    <div className="ch min-h-screen bg-mist">
      <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 sm:px-6">
        <Link to={href("/")} className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" aria-hidden="true" /><Logo /></Link>
        <LanguageSwitcher />
      </header>
      <main className="px-4 py-6 sm:px-6"><EmergencyPage /></main>
      <span className="sr-only">{t.brand.line}</span>
    </div>
  );
}
