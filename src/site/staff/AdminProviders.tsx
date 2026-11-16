/**
 * The administrator's side of provider onboarding (P1 item 11): give a doctor's account the
 * doctor role so it can apply, and review applications: verify (listing the doctor and letting
 * them publish times) or refuse, with a note. Server: server/firebase/providers.ts and the
 * verification route in server/firebase/booking.ts.
 */
import React, { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { request } from "../lib/api";
import { Badge, Button, Card, ErrorNote, Spinner } from "../components/ui";
import StaffShell, { fieldClass } from "./StaffShell";

type Status = "pending" | "verified" | "rejected";
type Provider = {
  id: string; contact: string; fullName: string; specialty: string; qualifications: string[]; registrationNumber: string;
  city: string; locality: string; consultationTypes: string[]; verificationStatus: Status; reviewNote: string;
};
const FILTERS = ["pending", "verified", "rejected", "all"] as const;

export default function AdminProviders() {
  const { t } = useI18n();
  const a = t.staff.admin;

  const [contact, setContact] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = async (f = filter) => {
    setError("");
    try { setProviders((await request<{ providers: Provider[] }>(`/api/v1/admin/providers?status=${f}`)).providers); }
    catch (e: any) { setProviders([]); setError(e.message); }
  };
  useEffect(() => { setProviders(null); load(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGranting(true); setGrantMsg(null);
    const value = contact.trim();
    try {
      const r = await request<{ contact: string; changed: boolean }>("/api/v1/admin/providers/accounts", { body: value.includes("@") ? { email: value } : { phone: value } });
      setGrantMsg({ ok: true, text: r.changed ? a.granted(r.contact) : a.alreadyDoctor(r.contact) });
      setContact("");
    } catch (err: any) { setGrantMsg({ ok: false, text: err.message === "network" ? t.app.serverDown : err.message }); } finally { setGranting(false); }
  };

  const decide = async (p: Provider, verificationStatus: "verified" | "rejected") => {
    const note = (notes[p.id] || "").trim();
    if (note.length < 3) { setRowError((r) => ({ ...r, [p.id]: a.noteNeeded })); return; }
    setBusy(p.id); setRowError((r) => ({ ...r, [p.id]: "" }));
    try {
      await request(`/api/v1/doctors/${encodeURIComponent(p.id)}/verification`, {
        method: "PATCH",
        body: { verificationStatus, listingStatus: verificationStatus === "verified" ? "active" : "hidden", reviewNote: note },
      });
      setNotes((n) => ({ ...n, [p.id]: "" }));
      await load();
    } catch (err: any) { setRowError((r) => ({ ...r, [p.id]: err.message })); } finally { setBusy(""); }
  };

  const tone = { pending: "warn", verified: "health", rejected: "danger" } as const;

  return (
    <StaffShell title={a.title} sub={a.sub}>
      <Card className="p-5">
        <h2 className="text-lg font-semibold">{a.grantTitle}</h2>
        <p className="mt-1 max-w-[720px] text-sm text-subtle">{a.grantBody}</p>
        <form onSubmit={grant} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block min-w-[260px] flex-1 text-sm font-medium">{a.contact}
            <input className={fieldClass} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="doctor@example.com · +91 98765 43210" autoComplete="off" />
          </label>
          <Button type="submit" loading={granting} disabled={contact.trim().length < 5}>{a.grant}</Button>
        </form>
        {grantMsg && <p role="status" className={`mt-3 text-sm ${grantMsg.ok ? "text-health-deep" : "text-danger"}`}>{grantMsg.text}</p>}
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{a.listTitle}</h2>
          <div className="inline-flex rounded-xl border border-line bg-white p-1" role="tablist">
            {FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                className={`h-9 rounded-lg px-3.5 text-sm font-semibold ${filter === f ? "bg-ink text-paper" : "text-subtle hover:text-text"}`}>{a[f]}</button>
            ))}
          </div>
        </div>
        <p className="max-w-[720px] text-sm text-subtle">{a.checkFirst}</p>
        {error && <ErrorNote message={error} onRetry={() => load()} />}
        {providers === null ? <Spinner label={t.app.loading} /> : providers.length === 0 && !error ? <p className="text-subtle">{a.none}</p> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {providers.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-snug">{p.fullName}</h3>
                    <p className="text-sm text-subtle">{p.specialty}</p>
                  </div>
                  <Badge tone={tone[p.verificationStatus] || "neutral"}>{a[p.verificationStatus] || p.verificationStatus}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-subtle">{a.registration}</dt><dd className="font-mono font-semibold">{p.registrationNumber}</dd>
                  <dt className="text-subtle">{a.qualifications}</dt><dd>{p.qualifications.join(", ")}</dd>
                  <dt className="text-subtle">{a.practises}</dt><dd>{[p.locality, p.city].filter(Boolean).join(", ")}</dd>
                  <dt className="text-subtle">{a.account}</dt><dd className="break-all">{p.contact || p.id}</dd>
                  {p.reviewNote && <><dt className="text-subtle">{a.reviewNote}</dt><dd>{p.reviewNote}</dd></>}
                </dl>
                <label className="mt-4 block text-sm font-medium">{p.verificationStatus === "verified" ? a.noteReject : `${a.noteVerify} / ${a.noteReject}`}
                  <input className={fieldClass} value={notes[p.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} maxLength={300} placeholder={p.verificationStatus === "verified" ? "" : a.noteVerifyHint} />
                </label>
                {rowError[p.id] && <p role="alert" className="mt-2 text-sm text-danger">{rowError[p.id]}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.verificationStatus !== "verified" && <Button size="sm" loading={busy === p.id} onClick={() => decide(p, "verified")}>{a.verify}</Button>}
                  {p.verificationStatus !== "rejected" && <Button size="sm" variant="secondary" disabled={busy === p.id} onClick={() => decide(p, "rejected")}>{p.verificationStatus === "verified" ? a.unlist : a.reject}</Button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </StaffShell>
  );
}
