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
type Booking = { id: string; patientName: string; reason: string; startsAt: string; endsAt: string; consultationType: string; status: string };

const tomorrow = () => new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");

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
                    {bookings.map((b) => (
                      <li key={b.id} className="py-2.5 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{b.patientName || "—"}</span>
                          <Badge tone={b.status === "confirmed" ? "health" : "neutral"} className="ml-auto">{b.status === "confirmed" ? p.confirmed : b.status === "cancelled" ? p.cancelled : b.status}</Badge>
                        </div>
                        <p className="text-subtle">{formatSlot(b.startsAt, b.endsAt, locale)} · {typeLabel(b.consultationType)}</p>
                        {b.reason && <p className="mt-0.5">{b.reason}</p>}
                      </li>
                    ))}
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
