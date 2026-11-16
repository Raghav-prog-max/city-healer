/**
 * The verified doctor's "Today" card: today's in-person bookings (Asia/Kolkata day) in
 * booked-time order, with who has checked in, and "Call in" / "Not here" for those waiting
 * (server/firebase/checkin.ts, POST /:id/visit-state). Finishing a visit stays "Mark completed"
 * on the booking. No token number and no waiting time in minutes: the order is the booked time.
 */
import React, { useState } from "react";
import { useI18n } from "../i18n";
import { request } from "../lib/api";
import { Badge, Card } from "../components/ui";
import { fill, todaysVisits, visitStateOf } from "../lib/appointmentThread";

export type TodayBooking = { id: string; patientName: string; startsAt: string; endsAt: string; consultationType: string; status: string; arrivedAt?: string | null; calledAt?: string | null };

export default function TodayCard({ bookings, onChanged }: { bookings: TodayBooking[]; onChanged: () => Promise<void> | void }) {
  const { t, locale } = useI18n();
  const p = t.staff.provider;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const visits = todaysVisits(bookings, Date.now());
  const clock = (iso: string) => new Date(iso).toLocaleTimeString(locale === "hi" ? "hi-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" });
  const small = "rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:border-care disabled:opacity-50";

  const shown = (e: any) => (e?.message === "network" ? t.app.serverDown : e?.message || "error");
  // After an action, success or refusal, the list is reloaded: a refusal usually means the
  // booking changed underneath (the patient left the line, or it was cancelled).
  const act = async (id: string, state: "called" | "not_here") => {
    setBusy(id); setError("");
    try { await request(`/api/v1/appointments/${encodeURIComponent(id)}/visit-state`, { body: { state } }); }
    catch (e: any) { setError(shown(e)); }
    try { await onChanged(); } catch { /* the list stays as it was; the next refresh tries again */ } finally { setBusy(""); }
  };
  const refresh = async () => {
    setRefreshing(true); setError("");
    try { await onChanged(); } catch (e: any) { setError(shown(e)); } finally { setRefreshing(false); }
  };

  const chip = (b: TodayBooking) => {
    const s = visitStateOf(b);
    if (s === "done") return <Badge tone="care">{p.done}</Badge>;
    if (s === "called") return <Badge tone="health">{p.withYou}</Badge>;
    if (s === "waiting") return <Badge tone="warn">{fill(p.waitingSince, { time: clock(b.arrivedAt!) })}</Badge>;
    return <Badge>{p.notArrived}</Badge>;
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{p.todayTitle}</h2>
        <button className={`${small} ml-auto`} disabled={refreshing} onClick={refresh}>{p.refresh}</button>
      </div>
      <p className="mt-1 text-sm text-subtle">{p.todaySub}</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {visits.length === 0 ? <p className="mt-3 text-sm text-subtle">{p.noVisitsToday}</p> : (
        <>
          {!visits.some((b) => b.arrivedAt) && <p className="mt-3 text-sm text-subtle">{p.noneCheckedIn}</p>}
          <ul className="mt-3 divide-y divide-line">
            {visits.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                <span className="font-medium tabular-nums">{clock(b.startsAt)}</span>
                <span>{b.patientName || "—"}</span>
                <span className="ml-auto">{chip(b)}</span>
                {visitStateOf(b) === "waiting" && (
                  <span className="flex gap-2">
                    <button className={small} disabled={!!busy} onClick={() => act(b.id, "called")}>{p.callIn}</button>
                    <button className={`${small} hover:!border-danger hover:text-danger`} disabled={!!busy} onClick={() => act(b.id, "not_here")}>{p.notHere}</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
