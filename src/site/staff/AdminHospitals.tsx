/**
 * The administrator's review of hospital listings patients reported (GET /api/hospital-reports):
 * hide a wrong listing, or keep it listed (PUT /api/hospitals/:id/listing). Either answer closes
 * that listing's open reports. Replaces the listing tools of the retired workspace.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { request } from "../lib/api";
import { Badge, Button, Card, ErrorNote, Spinner } from "../components/ui";
import StaffShell, { fieldClass } from "./StaffShell";

type ReportRow = { hospitalId: string; name: string; address: string; listingStatus: string | null; reason: string; reports: number; lastAt: string };
type Listing = { hospitalId: string; name: string; address: string; listingStatus: string | null; total: number; lastAt: string; reasons: { reason: string; reports: number }[] };

export default function AdminHospitals() {
  const { t, locale } = useI18n();
  const l = t.staff.listings;
  const tag = locale === "hi" ? "hi-IN" : "en-IN";

  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = async () => {
    setError("");
    try { setRows(await request<ReportRow[]>("/api/hospital-reports")); }
    catch (e: any) { setRows([]); setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  // The server answers one row per listing and reason; show one card per listing.
  const listings = useMemo(() => {
    const by = new Map<string, Listing>();
    for (const r of rows || []) {
      const cur = by.get(r.hospitalId) || { hospitalId: r.hospitalId, name: r.name, address: r.address, listingStatus: r.listingStatus, total: 0, lastAt: r.lastAt, reasons: [] };
      cur.total += Number(r.reports) || 0;
      if (String(r.lastAt) > String(cur.lastAt)) cur.lastAt = r.lastAt;
      cur.reasons.push({ reason: r.reason, reports: Number(r.reports) || 0 });
      by.set(r.hospitalId, cur);
    }
    return [...by.values()].sort((a, b) => b.total - a.total || String(b.lastAt).localeCompare(String(a.lastAt)));
  }, [rows]);

  const decide = async (x: Listing, status: "hidden" | "active") => {
    setBusy(x.hospitalId); setRowError((r) => ({ ...r, [x.hospitalId]: "" }));
    try {
      await request(`/api/hospitals/${encodeURIComponent(x.hospitalId)}/listing`, {
        method: "PUT",
        body: status === "hidden" ? { status, reason: (reasons[x.hospitalId] || "").trim() || x.reasons.map((r) => r.reason).join(", ") } : { status },
      });
      await load();
    } catch (err: any) { setRowError((r) => ({ ...r, [x.hospitalId]: err.message === "network" ? t.app.serverDown : err.message })); } finally { setBusy(""); }
  };

  return (
    <StaffShell title={l.title} sub={l.sub}>
      {error && <ErrorNote message={error} onRetry={load} />}
      {rows === null ? <Spinner label={t.app.loading} /> : listings.length === 0 && !error ? <p className="text-subtle">{l.none}</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {listings.map((x) => (
            <Card key={x.hospitalId} className="p-5">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold leading-snug">{x.name}</h3>
                  <p className="text-sm text-subtle">{x.address}</p>
                </div>
                <Badge tone={x.listingStatus === "hidden" ? "warn" : "neutral"}>{x.listingStatus === "hidden" ? l.hidden : l.active}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-subtle">{l.reason}</dt>
                <dd>{x.reasons.map((r) => `${l.reasons[r.reason] || r.reason} (${l.reports(r.reports)})`).join(" · ")}</dd>
                <dt className="text-subtle">{l.lastAt}</dt>
                <dd>{new Date(x.lastAt).toLocaleString(tag, { day: "numeric", month: "short", year: "numeric" })}</dd>
              </dl>
              <label className="mt-4 block text-sm font-medium">{l.hideReason}
                <input className={fieldClass} value={reasons[x.hospitalId] || ""} maxLength={200} onChange={(e) => setReasons((r) => ({ ...r, [x.hospitalId]: e.target.value }))} />
              </label>
              {rowError[x.hospitalId] && <p role="alert" className="mt-2 text-sm text-danger">{rowError[x.hospitalId]}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" loading={busy === x.hospitalId} onClick={() => decide(x, "hidden")}>{l.hide}</Button>
                <Button size="sm" variant="secondary" disabled={busy === x.hospitalId} onClick={() => decide(x, "active")}>{l.keep}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
