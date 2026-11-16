/**
 * The doctor's side of provider onboarding (P1 item 11), for an account an administrator has
 * given the doctor role: apply to be listed and follow the review, publish and withdraw the
 * times patients can book, and see who has booked. Server: server/firebase/booking.ts and
 * server/firebase/providers.ts.
 */
import React, { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { request } from "../lib/api";
import { Badge, Button, Card, ErrorNote, Spinner } from "../components/ui";
import StaffShell, { fieldClass, formatSlot } from "./StaffShell";

const CITIES = ["Delhi", "Gurugram", "Noida", "Greater Noida", "Ghaziabad", "Faridabad"];
// The categories triage and the copilot route to (shared/specialties.ts); another can be typed.
const SPECIALTIES = ["General Physician", "Cardiologist", "Pediatrician", "Pulmonologist", "Gastroenterologist", "Neurologist", "Oncologist", "Emergency Care Physician"];
const LENGTHS = [15, 20, 30, 45, 60];

type Application = {
  fullName: string; specialty: string; qualifications: string[]; registrationNumber: string; city: string; locality: string;
  consultationTypes: string[]; verificationStatus: "pending" | "verified" | "rejected"; listingStatus: string; reviewNote: string;
};
type Slot = { id: string; startsAt: string; endsAt: string; consultationType: string; status: string };
type Booking = { id: string; patientName: string; reason: string; startsAt: string; endsAt: string; consultationType: string; status: string; cancelledBy: string | null; hasPrescription: boolean };
type Medicine = { name: string; dosage: string; frequency: string; duration: string };
type Prescription = { doctorName: string; diagnosis: string; medicines: Partial<Medicine>[]; instructions: string; issuedAt: string };
const emptyMedicine = (): Medicine => ({ name: "", dosage: "", frequency: "", duration: "" });

const tomorrow = () => new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");

/**
 * One booking and what the doctor can do with it: complete it, cancel it with a reason, write
 * the prescription, and read the patient's saved records (server/firebase/consultations.ts).
 */
function BookingRow({ b, onChanged }: { b: Booking; onChanged: () => Promise<void> | void }) {
  const { t, locale } = useI18n();
  const p = t.staff.provider;
  const [mode, setMode] = useState<"" | "cancel" | "prescribe" | "rx" | "records">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([emptyMedicine()]);
  const [instructions, setInstructions] = useState("");
  const [rx, setRx] = useState<Prescription | null>(null);
  const [records, setRecords] = useState<any[] | null>(null);

  // Completing and prescribing unlock when the appointment starts; while waiting, look at the
  // clock again every few seconds so the doctor does not have to reload the page.
  const [now, setNow] = useState(() => new Date().toISOString());
  const started = b.startsAt <= now;
  const open = b.status === "confirmed";
  useEffect(() => {
    if (started || b.status === "cancelled") return;
    const timer = setInterval(() => setNow(new Date().toISOString()), 10_000);
    return () => clearInterval(timer);
  }, [started, b.status]);
  const route = `/api/v1/appointments/${encodeURIComponent(b.id)}`;
  const message = (e: any) => (e.message === "network" ? t.app.serverDown : e.message);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await fn(); setMode(""); await onChanged(); }
    catch (e: any) {
      setError(message(e));
      // A refusal usually means the booking changed underneath (the patient cancelled or moved
      // it, or it was handled in another tab): show its current state, not the stale one.
      try { await onChanged(); } catch { /* the error above is what matters */ }
    } finally { setBusy(false); }
  };
  const show = async (what: "rx" | "records") => {
    if (mode === what) { setMode(""); return; }
    setError("");
    try {
      if (what === "rx") setRx((await request<{ prescription: Prescription }>(`${route}/prescription`)).prescription);
      else setRecords((await request<{ records: any[] }>(`${route}/records`)).records);
      setMode(what);
    } catch (e: any) { setError(message(e)); }
  };
  const setMed = (i: number, patch: Partial<Medicine>) => setMedicines((list) => list.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  // A row with anything typed in it counts, so a medicine missing its name or dosage blocks
  // issuing instead of being dropped from a prescription that cannot be changed afterwards.
  const filled = medicines.filter((m) => m.name.trim() || m.dosage.trim() || m.frequency.trim() || m.duration.trim());
  const canIssue = diagnosis.trim().length >= 2 && filled.every((m) => m.name.trim() && m.dosage.trim());
  const issue = () => run(() => request(`${route}/prescription`, {
    body: {
      diagnosis: diagnosis.trim(),
      medicines: filled.map((m) => ({ name: m.name.trim(), dosage: m.dosage.trim(), ...(m.frequency.trim() ? { frequency: m.frequency.trim() } : {}), ...(m.duration.trim() ? { duration: m.duration.trim() } : {}) })),
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
    },
  }));

  const statusLabel = b.status === "confirmed" ? p.confirmed : b.status === "completed" ? p.completed : b.cancelledBy === "doctor" ? p.cancelledByYou : b.status === "cancelled" ? p.cancelled : b.status;
  const small = "rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:border-care disabled:opacity-50";
  const input = "mt-1 h-10 w-full rounded-lg border border-line bg-white px-2.5 text-[15px] outline-none focus:border-care focus:ring-4 focus:ring-care/15";

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{b.patientName || "—"}</span>
        <Badge tone={b.status === "confirmed" ? "health" : b.status === "completed" ? "care" : "neutral"} className="ml-auto">{statusLabel}</Badge>
      </div>
      <p className="text-subtle">{formatSlot(b.startsAt, b.endsAt, locale)} · {b.consultationType === "online" ? p.online : p.inPerson}</p>
      {b.reason && <p className="mt-0.5">{b.reason}</p>}

      {b.status !== "cancelled" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {open && <button className={small} disabled={busy || !started} onClick={() => run(() => request(`${route}/complete`, { method: "POST" }))}>{p.complete}</button>}
          {!b.hasPrescription && <button className={small} disabled={busy || !started} onClick={() => setMode(mode === "prescribe" ? "" : "prescribe")}>{p.prescribe}</button>}
          {b.hasPrescription && <button className={small} onClick={() => show("rx")}>{mode === "rx" ? p.close : p.viewPrescription}</button>}
          <button className={small} onClick={() => show("records")}>{mode === "records" ? p.hideRecords : p.patientRecords}</button>
          {open && <button className={`${small} hover:!border-danger hover:text-danger`} disabled={busy} onClick={() => setMode(mode === "cancel" ? "" : "cancel")}>{p.cancelBooking}</button>}
        </div>
      )}
      {open && !started && <p className="mt-1.5 text-xs text-subtle">{p.notStarted}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}

      {mode === "cancel" && (
        <div className="mt-3 rounded-lg border border-line bg-mist p-3">
          <label className="block text-sm font-medium">{p.cancelReason}
            <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </label>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => run(() => request(`${route}/doctor-cancel`, { body: { reason: reason.trim(), startsAt: b.startsAt } }))}>{p.confirmCancel}</Button>
            <Button size="sm" variant="secondary" onClick={() => setMode("")}>{p.keep}</Button>
          </div>
        </div>
      )}

      {mode === "prescribe" && (
        <div className="mt-3 space-y-3 rounded-lg border border-line bg-mist p-3">
          <label className="block text-sm font-medium">{p.diagnosis}
            <input className={input} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} maxLength={200} />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">{p.medicines}</legend>
            {medicines.map((m, i) => (
              <div key={i} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_2fr_1fr_auto]">
                <input className={input} aria-label={p.medName} placeholder={p.medName} value={m.name} onChange={(e) => setMed(i, { name: e.target.value })} maxLength={120} />
                <input className={input} aria-label={p.dosage} placeholder={p.dosage} value={m.dosage} onChange={(e) => setMed(i, { dosage: e.target.value })} maxLength={120} />
                <input className={input} aria-label={p.frequency} placeholder={p.frequency} value={m.frequency} onChange={(e) => setMed(i, { frequency: e.target.value })} maxLength={120} />
                <input className={input} aria-label={p.duration} placeholder={p.duration} value={m.duration} onChange={(e) => setMed(i, { duration: e.target.value })} maxLength={60} />
                {medicines.length > 1 && <button type="button" className={`${small} mt-1 h-10`} onClick={() => setMedicines((list) => list.filter((_, j) => j !== i))}>{p.remove}</button>}
              </div>
            ))}
            {medicines.length < 20 && <button type="button" className={`${small} mt-2`} onClick={() => setMedicines((list) => [...list, emptyMedicine()])}>{p.addMedicine}</button>}
          </fieldset>
          <label className="block text-sm font-medium">{p.instructions}
            <textarea className="mt-1 w-full rounded-lg border border-line bg-white p-2.5 text-[15px] outline-none focus:border-care focus:ring-4 focus:ring-care/15" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1000} />
          </label>
          <p className="text-xs text-subtle">{p.issueWarning}</p>
          <div className="flex gap-2">
            <Button size="sm" loading={busy} disabled={!canIssue} onClick={issue}>{p.issue}</Button>
            <Button size="sm" variant="secondary" onClick={() => setMode("")}>{p.close}</Button>
          </div>
        </div>
      )}

      {mode === "rx" && rx && b.status !== "cancelled" && (
        <div className="mt-3 rounded-lg border border-line bg-mist p-3">
          <p><strong>{p.diagnosis}:</strong> {rx.diagnosis}</p>
          {rx.medicines.length > 0 && <ul className="mt-1.5 list-disc pl-5">{rx.medicines.map((m, i) => <li key={i}>{[m.name, m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}</li>)}</ul>}
          {rx.instructions && <p className="mt-1.5">{rx.instructions}</p>}
          <p className="mt-1.5 text-xs text-subtle">{rx.doctorName} · {new Date(rx.issuedAt).toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN")}</p>
        </div>
      )}

      {/* Not for a cancelled booking: the server no longer gives access, so the screen does not keep showing them. */}
      {mode === "records" && records && b.status !== "cancelled" && (
        <div className="mt-3 rounded-lg border border-line bg-mist p-3">
          {records.length === 0 ? <p className="text-subtle">{p.noRecords}</p> : (
            <ul className="space-y-2">{records.map((r) => (
              <li key={r.id}><p className="font-semibold">{r.title}</p><p className="text-xs text-subtle">{r.date} · {r.doctorName}</p><p>{r.diagnoseSummary}</p></li>
            ))}</ul>
          )}
        </div>
      )}
    </li>
  );
}

export default function ProviderWorkspace() {
  const { t, locale } = useI18n();
  const p = t.staff.provider;
  const session = useSession();
  const uid = session.user?.uid || "";

  const [application, setApplication] = useState<Application | null | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState({ fullName: "", specialty: "", qualifications: "", registrationNumber: "", city: "", locality: "", online: true, inPerson: false });
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [slot, setSlot] = useState({ date: tomorrow(), time: "10:00", length: 30, type: "online" });
  const [publishing, setPublishing] = useState(false);
  const [slotMsg, setSlotMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const verified = application?.verificationStatus === "verified";

  const load = async () => {
    setLoadError("");
    try {
      const me = await request<{ application: Application | null }>("/api/v1/provider/me");
      setApplication(me.application);
      if (me.application) {
        const a = me.application;
        setForm({
          fullName: a.fullName || "", specialty: a.specialty || "", qualifications: (a.qualifications || []).join(", "),
          registrationNumber: a.registrationNumber || "", city: a.city || "", locality: a.locality || "",
          online: a.consultationTypes.includes("online"), inPerson: a.consultationTypes.includes("in_person"),
        });
        setSlot((s) => ({ ...s, type: a.consultationTypes.includes(s.type) ? s.type : a.consultationTypes[0] || "online" }));
      }
      const [s, b] = await Promise.all([
        request<{ slots: Slot[] }>("/api/v1/provider/slots"),
        request<{ appointments: Booking[] }>("/api/v1/appointments/doctor"),
      ]);
      setSlots(s.slots); setBookings(b.appointments);
    } catch (e: any) { setLoadError(e.message); }
  };
  useEffect(() => { if (uid) load(); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormMsg(null);
    try {
      await request("/api/v1/doctors/applications", {
        body: {
          fullName: form.fullName.trim(), specialty: form.specialty.trim(),
          qualifications: form.qualifications.split(",").map((q) => q.trim()).filter(Boolean),
          registrationNumber: form.registrationNumber.trim(), city: form.city, locality: form.locality.trim(),
          consultationTypes: [form.online && "online", form.inPerson && "in_person"].filter(Boolean),
        },
      });
      setFormMsg({ ok: true, text: p.submitted });
      await load();
    } catch (err: any) { setFormMsg({ ok: false, text: err.message === "network" ? t.app.serverDown : err.message }); } finally { setSaving(false); }
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true); setSlotMsg(null);
    try {
      // The date and time are the doctor's own local time; the server stores an instant.
      const start = new Date(`${slot.date}T${slot.time}`);
      const end = new Date(start.getTime() + slot.length * 60_000);
      await request(`/api/v1/doctors/${encodeURIComponent(uid)}/slots`, { body: { startsAt: start.toISOString(), endsAt: end.toISOString(), consultationType: slot.type } });
      setSlotMsg({ ok: true, text: p.published });
      await load();
    } catch (err: any) { setSlotMsg({ ok: false, text: err.message === "network" ? t.app.serverDown : err.message }); } finally { setPublishing(false); }
  };

  const withdraw = async (id: string) => {
    setSlotMsg(null);
    try { await request(`/api/v1/provider/slots/${encodeURIComponent(id)}`, { method: "DELETE" }); }
    catch (err: any) { setSlotMsg({ ok: false, text: err.message }); }
    await load();
  };

  const status = application === null ? "none" : application?.verificationStatus;
  const banner = {
    none: { tone: "neutral" as const, title: p.statusNone, body: p.statusNoneBody },
    pending: { tone: "warn" as const, title: p.statusPending, body: p.statusPendingBody },
    verified: { tone: "health" as const, title: p.statusVerified, body: p.statusVerifiedBody },
    rejected: { tone: "danger" as const, title: p.statusRejected, body: p.statusRejectedBody },
  }[status || "none"];
  const canSubmit = form.fullName.trim().length >= 2 && form.specialty.trim().length >= 2 && form.qualifications.trim().length >= 2
    && form.registrationNumber.trim().length >= 3 && !!form.city && form.locality.trim().length >= 2 && (form.online || form.inPerson);
  const typeLabel = (v: string) => (v === "online" ? p.online : p.inPerson);

  return (
    <StaffShell title={p.title} sub={p.sub}>
      {loadError && <ErrorNote message={loadError} onRetry={load} />}
      {application === undefined && !loadError ? <Spinner label={t.app.loading} /> : application !== undefined && (
        <>
          <Card className="p-5" role="status">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={banner.tone}>{banner.title}</Badge>
              <p className="text-sm text-subtle">{banner.body}</p>
            </div>
            {status === "rejected" && application?.reviewNote && <p className="mt-3 text-sm"><strong>{p.reason}:</strong> {application.reviewNote}</p>}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-lg font-semibold">{p.formTitle}</h2>
              {verified && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{p.editWarning}</p>}
              <form onSubmit={submit} className="mt-4 space-y-3">
                <label className="block text-sm font-medium">{p.fullName}
                  <input className={fieldClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} maxLength={100} autoComplete="name" />
                </label>
                <label className="block text-sm font-medium">{p.specialty}
                  <input className={fieldClass} list="provider-specialties" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} maxLength={80} />
                  <datalist id="provider-specialties">{SPECIALTIES.map((s) => <option key={s} value={s} />)}</datalist>
                </label>
                <label className="block text-sm font-medium">{p.qualifications}
                  <input className={fieldClass} value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
                  <span className="mt-1 block text-xs font-normal text-subtle">{p.qualificationsHint}</span>
                </label>
                <label className="block text-sm font-medium">{p.registrationNumber}
                  <input className={fieldClass} value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} maxLength={80} />
                  <span className="mt-1 block text-xs font-normal text-subtle">{p.registrationHint}</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">{p.city}
                    <select className={fieldClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                      <option value="">{p.chooseCity}</option>
                      {CITIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium">{p.locality}
                    <input className={fieldClass} value={form.locality} onChange={(e) => setForm({ ...form, locality: e.target.value })} maxLength={100} />
                  </label>
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">{p.consultationTypes}</legend>
                  <div className="mt-2 flex gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-care" checked={form.online} onChange={(e) => setForm({ ...form, online: e.target.checked })} />{p.online}</label>
                    <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-care" checked={form.inPerson} onChange={(e) => setForm({ ...form, inPerson: e.target.checked })} />{p.inPerson}</label>
                  </div>
                </fieldset>
                {formMsg && <p role="status" className={`text-sm ${formMsg.ok ? "text-health-deep" : "text-danger"}`}>{formMsg.text}</p>}
                <Button type="submit" loading={saving} disabled={!canSubmit}>{p.submit}</Button>
              </form>
            </Card>

            <div className="space-y-6">
              <Card className="p-5">
                <h2 className="text-lg font-semibold">{p.timesTitle}</h2>
                <p className="mt-1 text-sm text-subtle">{verified ? p.timesSub : p.needVerified}</p>
                {verified && (
                  <form onSubmit={publish} className="mt-4 grid grid-cols-2 gap-3">
                    <label className="block text-sm font-medium">{p.date}
                      <input type="date" className={fieldClass} min={new Date().toLocaleDateString("en-CA")} value={slot.date} onChange={(e) => setSlot({ ...slot, date: e.target.value })} required />
                    </label>
                    <label className="block text-sm font-medium">{p.start}
                      <input type="time" className={fieldClass} value={slot.time} onChange={(e) => setSlot({ ...slot, time: e.target.value })} required />
                    </label>
                    <label className="block text-sm font-medium">{p.length}
                      <select className={fieldClass} value={slot.length} onChange={(e) => setSlot({ ...slot, length: Number(e.target.value) })}>
                        {LENGTHS.map((m) => <option key={m} value={m}>{m} {p.minutes}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-medium">{p.type}
                      <select className={fieldClass} value={slot.type} onChange={(e) => setSlot({ ...slot, type: e.target.value })}>
                        {(application?.consultationTypes || []).map((v) => <option key={v} value={v}>{typeLabel(v)}</option>)}
                      </select>
                    </label>
                    <div className="col-span-2"><Button type="submit" loading={publishing}>{p.publish}</Button></div>
                  </form>
                )}
                {slotMsg && <p role="status" className={`mt-3 text-sm ${slotMsg.ok ? "text-health-deep" : "text-danger"}`}>{slotMsg.text}</p>}
                {verified && (slots.length === 0 ? <p className="mt-4 text-sm text-subtle">{p.noTimes}</p> : (
                  <ul className="mt-4 divide-y divide-line">
                    {slots.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                        <span className="font-medium">{formatSlot(s.startsAt, s.endsAt, locale)}</span>
                        <span className="text-subtle">· {typeLabel(s.consultationType)}</span>
                        <Badge tone={s.status === "booked" ? "care" : "neutral"} className="ml-auto">{s.status === "booked" ? p.booked : p.open}</Badge>
                        {s.status === "open" && <button onClick={() => withdraw(s.id)} className="rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-danger hover:text-danger">{p.withdraw}</button>}
                      </li>
                    ))}
                  </ul>
                ))}
              </Card>

              <Card className="p-5">
                <h2 className="text-lg font-semibold">{p.bookingsTitle}</h2>
                {bookings.length === 0 ? <p className="mt-2 text-sm text-subtle">{p.noBookings}</p> : (
                  <ul className="mt-3 divide-y divide-line">
                    {bookings.map((b) => <BookingRow key={b.id} b={b} onChanged={load} />)}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </StaffShell>
  );
}
