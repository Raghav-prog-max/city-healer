/**
 * The hospital desk: a HOSPITAL account's own facility (its hospitalId claim, read by the server
 * in GET /api/v1/hospital/facility), its bed and ICU numbers (PUT /api/hospitals/:id/beds, which
 * refuses any other facility) and the emergency alerts (GET /api/emergency/alerts,
 * PUT /api/emergency/alerts/:id/status). Replaces the hospital tools of the retired workspace.
 */
import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "../i18n";
import { ApiError, request } from "../lib/api";
import { Badge, Button, Card, ErrorNote, Spinner } from "../components/ui";
import StaffShell, { fieldClass } from "./StaffShell";

type Facility = {
  id: string; name: string; address: string; phone: string | null;
  totalBeds: number | null; availableBeds: number | null; icuBeds: number | null; icuAvailable: number | null;
  bedsReportedAt: string | null; listingStatus: string;
};
type AlertStatus = "REPORTED" | "DISPATCHED" | "RESOLVED";
type SosAlert = {
  id: string; patientName: string; patientPhone: string; address: string; lat: number; lng: number;
  type: string; status: AlertStatus; timestamp: string; assignedAmbulanceRef: string; hospitalName: string;
};
const BED_FIELDS = ["totalBeds", "availableBeds", "icuBeds", "icuAvailable"] as const;

export default function HospitalWorkspace() {
  const { t, locale } = useI18n();
  const h = t.staff.hospital;
  const tag = locale === "hi" ? "hi-IN" : "en-IN";
  const fmt = (iso: string) => new Date(iso).toLocaleString(tag, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  const [facility, setFacility] = useState<Facility | null>(null);
  const [facilityState, setFacilityState] = useState<"loading" | "ready" | "notLinked" | "error">("loading");
  const [facilityError, setFacilityError] = useState("");
  const [beds, setBeds] = useState<Record<(typeof BED_FIELDS)[number], string>>({ totalBeds: "", availableBeds: "", icuBeds: "", icuAvailable: "" });
  const [saving, setSaving] = useState(false);
  const [bedsMsg, setBedsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [alerts, setAlerts] = useState<SosAlert[] | null>(null);
  const [alertsError, setAlertsError] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [busy, setBusy] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const fillBeds = (f: Facility) => setBeds({
    totalBeds: f.totalBeds == null ? "" : String(f.totalBeds), availableBeds: f.availableBeds == null ? "" : String(f.availableBeds),
    icuBeds: f.icuBeds == null ? "" : String(f.icuBeds), icuAvailable: f.icuAvailable == null ? "" : String(f.icuAvailable),
  });

  const loadFacility = async () => {
    setFacilityState("loading"); setFacilityError("");
    try {
      const f = await request<Facility>("/api/v1/hospital/facility");
      setFacility(f); fillBeds(f); setFacilityState("ready");
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 404 && e.message === "NOT_LINKED") setFacilityState("notLinked");
      else { setFacilityError(e.message); setFacilityState("error"); }
    }
  };
  const loadAlerts = async () => {
    setAlertsError("");
    try { setAlerts(await request<SosAlert[]>("/api/emergency/alerts")); }
    catch (e: any) { setAlerts([]); setAlertsError(e.message); }
  };
  useEffect(() => { loadFacility(); loadAlerts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveBeds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility) return;
    const body: Record<string, number> = {};
    for (const k of BED_FIELDS) {
      const raw = beds[k].trim();
      if (raw === "") continue;
      if (!/^\d+$/.test(raw)) { setBedsMsg({ ok: false, text: h.invalid }); return; }
      body[k] = Number(raw);
    }
    setSaving(true); setBedsMsg(null);
    try {
      const r = await request<{ hospital: Facility }>(`/api/hospitals/${encodeURIComponent(facility.id)}/beds`, { method: "PUT", body });
      // The server caps free beds at the totals; show what it saved.
      const next = { ...facility, ...r.hospital };
      setFacility(next); fillBeds(next);
      setBedsMsg({ ok: true, text: h.saved });
    } catch (err: any) { setBedsMsg({ ok: false, text: err.message === "network" ? t.app.serverDown : err.message }); } finally { setSaving(false); }
  };

  const setStatus = async (a: SosAlert, status: AlertStatus) => {
    setBusy(a.id); setRowError((r) => ({ ...r, [a.id]: "" }));
    try {
      await request(`/api/emergency/alerts/${encodeURIComponent(a.id)}/status`, { method: "PUT", body: { status } });
      setAlerts((list) => (list || []).map((x) => (x.id === a.id ? { ...x, status } : x)));
    } catch (err: any) { setRowError((r) => ({ ...r, [a.id]: err.message === "network" ? t.app.serverDown : err.message })); } finally { setBusy(""); }
  };

  const shown = useMemo(() => {
    const list = (alerts || []).filter((a) => scope === "all" || (facility && a.hospitalName === facility.name));
    // Open alerts first, newest first within each group.
    const rank = { REPORTED: 0, DISPATCHED: 1, RESOLVED: 2 } as Record<string, number>;
    return list.slice().sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || String(b.timestamp).localeCompare(String(a.timestamp)));
  }, [alerts, scope, facility]);

  const tone = { REPORTED: "danger", DISPATCHED: "warn", RESOLVED: "health" } as const;
  const label = { REPORTED: h.reported, DISPATCHED: h.dispatched, RESOLVED: h.resolved };

  return (
    <StaffShell title={h.title} sub={h.sub}>
      <Card className="p-5">
        <h2 className="text-lg font-semibold">{h.facility}</h2>
        {facilityState === "loading" && <div className="mt-3"><Spinner label={t.app.loading} /></div>}
        {facilityState === "notLinked" && <p role="status" className="mt-2 max-w-[720px] text-sm">{h.notLinked}</p>}
        {facilityState === "error" && <div className="mt-3"><ErrorNote message={facilityError} onRetry={loadFacility} /></div>}
        {facilityState === "ready" && facility && (
          <>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{facility.name}</p>
                <p className="text-sm text-subtle">{facility.address}</p>
              </div>
              {facility.listingStatus === "hidden" && <Badge tone="warn">{h.hiddenListing}</Badge>}
            </div>
            <p className="mt-2 text-sm text-subtle">{facility.bedsReportedAt ? h.lastReported(fmt(facility.bedsReportedAt)) : h.neverReported}</p>

            <h3 className="mt-5 font-semibold">{h.bedsTitle}</h3>
            <p className="mt-1 max-w-[720px] text-sm text-subtle">{h.bedsSub}</p>
            <form onSubmit={saveBeds} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {BED_FIELDS.map((k) => (
                <label key={k} className="block text-sm font-medium">{h[k]}
                  <input className={fieldClass} inputMode="numeric" value={beds[k]} onChange={(e) => setBeds((b) => ({ ...b, [k]: e.target.value }))} />
                </label>
              ))}
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" loading={saving}>{h.save}</Button>
              </div>
            </form>
            {bedsMsg && <p role="status" className={`mt-3 text-sm ${bedsMsg.ok ? "text-health-deep" : "text-danger"}`}>{bedsMsg.text}</p>}
          </>
        )}
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{h.alertsTitle}</h2>
          <div className="inline-flex rounded-xl border border-line bg-white p-1" role="tablist">
            {(["mine", "all"] as const).map((s) => (
              <button key={s} role="tab" aria-selected={scope === s} onClick={() => setScope(s)}
                className={`h-9 rounded-lg px-3.5 text-sm font-semibold ${scope === s ? "bg-ink text-paper" : "text-subtle hover:text-text"}`}>{h[s]}</button>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={loadAlerts}><RefreshCw className="h-4 w-4" aria-hidden="true" />{h.refresh}</Button>
        </div>
        <p className="max-w-[720px] text-sm text-subtle">{h.alertsSub}</p>
        {alertsError && <ErrorNote message={alertsError} onRetry={loadAlerts} />}
        {alerts === null ? <Spinner label={t.app.loading} /> : shown.length === 0 && !alertsError ? <p className="text-subtle">{h.noAlerts}</p> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {shown.map((a) => (
              <Card key={a.id} className="p-5">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-snug">{a.type}</h3>
                    <p className="text-sm text-subtle">{fmt(a.timestamp)}</p>
                  </div>
                  <Badge tone={tone[a.status] || "neutral"}>{label[a.status] || a.status}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-subtle">{h.caller}</dt><dd>{a.patientName}</dd>
                  <dt className="text-subtle">{h.phone}</dt><dd><a className="font-semibold text-care-deep underline underline-offset-2" href={`tel:${a.patientPhone}`}>{a.patientPhone}</a></dd>
                  <dt className="text-subtle">{h.place}</dt><dd>{a.address} <span className="text-subtle">({Number(a.lat).toFixed(4)}, {Number(a.lng).toFixed(4)})</span></dd>
                  <dt className="text-subtle">{h.ambulance}</dt><dd className="font-mono">{a.assignedAmbulanceRef}</dd>
                  {scope === "all" && <><dt className="text-subtle">{h.facility}</dt><dd>{a.hospitalName}</dd></>}
                </dl>
                {rowError[a.id] && <p role="alert" className="mt-2 text-sm text-danger">{rowError[a.id]}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.status === "REPORTED" && <Button size="sm" loading={busy === a.id} onClick={() => setStatus(a, "DISPATCHED")}>{h.markDispatched}</Button>}
                  {a.status !== "RESOLVED" && <Button size="sm" variant="secondary" disabled={busy === a.id} onClick={() => setStatus(a, "RESOLVED")}>{h.markResolved}</Button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </StaffShell>
  );
}
