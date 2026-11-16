/**
 * Cards for the results of City Healer's models. The assistant and the dedicated pages use
 * the same components, so a lab result or a diet plan looks the same wherever it appears.
 *
 * Presentation rules from the frontend plan (section 7): answer, sources, uncertainty,
 * safety and next actions are separate; outputs are labelled as decision support; the
 * confidence shown is the model's own probability, labelled as such.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Star, Clock, BedDouble, HeartPulse, Phone, Navigation, AlertTriangle, Info, Stethoscope, ArrowRight } from "lucide-react";
import { useI18n } from "../i18n";
import { Badge, Card } from "./ui";
import { request } from "../lib/api";
import { useSession } from "../lib/session";

// ---------------------------------------------------------------- hospitals & doctors

export function HospitalCard({ h, compact = false }: { h: any; compact?: boolean }) {
  const { t } = useI18n();
  const km = h.distanceKm ?? h.distanceKM;
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{h.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-subtle"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{h.address}</span></p>
        </div>
        {typeof km === "number" && <span className="shrink-0 rounded-lg bg-mist px-2 py-1 text-sm font-semibold">{km} {t.care2.km}</span>}
      </div>
      {h.matchReason && <p className="mt-2 text-sm text-care-deep">{h.matchReason}</p>}
      {/* Not in the registry or a scheme list, and the facility classifier doubts the name is a
          hospital's (it may be a clinic, pharmacy or lab mapped as a hospital). */}
      {h.unconfirmed && <p className="mt-2 rounded-lg bg-mist px-2 py-1 text-xs font-semibold text-subtle">{t.care2.unconfirmed}{h.likelyKind && h.likelyKind !== "hospital" ? ` · ${t.care2.looksLike} ${t.care2[`kind_${h.likelyKind}`] || h.likelyKind}` : ""}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {/* Beds only when the hospital's staff reported them, with when. No open dataset has
            them, so most hospitals show "not reported". Ratings are not shown: none are verified. */}
        {h.bedsReportedAt && h.availableBeds !== null ? <>
          <Badge tone={h.availableBeds > 0 ? "health" : "danger"}><BedDouble className="h-3.5 w-3.5" aria-hidden="true" />{h.availableBeds} {t.care2.beds}</Badge>
          {h.icuAvailable !== null && <Badge tone={h.icuAvailable > 0 ? "health" : "danger"}><HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />{h.icuAvailable} {t.care2.icu}</Badge>}
          <Badge><Clock className="h-3.5 w-3.5" aria-hidden="true" />{t.care2.updated} {new Date(h.bedsReportedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Badge>
        </> : <Badge><BedDouble className="h-3.5 w-3.5" aria-hidden="true" />{t.care2.bedsNotReported}</Badge>}
        {h.travelTimeMin ? <Badge><Clock className="h-3.5 w-3.5" aria-hidden="true" />~{h.travelTimeMin} min</Badge> : null}
      </div>
      {h.inRegistry && h.facilityType && <p className="mt-2 text-xs font-semibold text-health-deep">{t.care2.inRegistry} · {h.facilityType}</p>}
      {Array.isArray(h.empanelment) && h.empanelment.length > 0 && (
        <p className="mt-1 text-xs font-semibold text-health-deep">
          {t.care2.empanelled} {h.empanelment.map((e: any) => `${e.scheme} (${t.care2.listOf} ${new Date(e.listDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })})`).join(", ")}
          {h.nabhAccredited ? ` · ${t.care2.nabhListed}` : ""}
        </p>
      )}
      {!compact && <Departments h={h} />}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={maps} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:border-care"><Navigation className="h-4 w-4" aria-hidden="true" />{t.emergency.directions}</a>
        {h.phone && <a href={`tel:${h.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:border-care"><Phone className="h-4 w-4" aria-hidden="true" />{h.phone}</a>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-subtle">{t.care2.notVerified}{h.source === "osm" ? ` · ${t.care2.osmCredit}` : ""}</p>
        {!compact && <ReportProblem hospitalId={h.id} />}
      </div>
    </Card>
  );
}

/** Departments grouped by how they are known (shared/hospitalData.ts). */
function Departments({ h }: { h: any }) {
  const { t } = useI18n();
  const sources: Record<string, string> = h.departmentSources || {};
  const all: string[] = h.specialties || [];
  // Listed / name departments first, then those known only from a scheme's empanelment.
  const rank = (d: string) => (sources[d] === "empanelled" ? 1 : 0);
  const known = all.filter((d) => sources[d] !== "standard").sort((a, b) => rank(a) - rank(b));
  const usual = all.filter((d) => sources[d] === "standard");
  const onlyEmpanelled = known.length > 0 && known.every((d) => sources[d] === "empanelled");
  if (!known.length && !usual.length) {
    return h.generalCare ? <p className="mt-3 text-sm text-subtle">{t.care2.generalCare}</p> : null;
  }
  return (
    <div className="mt-3 space-y-1 text-sm text-subtle">
      {known.length > 0 && <p><span className="font-medium text-text">{t.care2.departments}:</span> {known.slice(0, 8).join(", ")}{known.length > 8 ? ` +${known.length - 8}` : ""}{onlyEmpanelled && <span className="text-xs"> ({t.care2.perScheme})</span>}</p>}
      {usual.length > 0 && <p><span className="font-medium text-text">{t.care2.usually}:</span> {usual.slice(0, 6).join(", ")}{usual.length > 6 ? "…" : ""} <span className="text-xs">({t.care2.iphs})</span></p>}
    </div>
  );
}

const REASONS = ["not_a_hospital", "closed", "wrong_location", "wrong_details", "animal_hospital"] as const;

/** "Report a problem" with a listing; an administrator reviews it (npm run review-hospitals). */
function ReportProblem({ hospitalId }: { hospitalId: string }) {
  const { t } = useI18n();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | string>("idle");
  if (!user) return null;
  if (state === "done") return <span className="text-xs font-medium text-health-deep">{t.care2.reportThanks}</span>;
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs font-medium text-subtle underline underline-offset-2 hover:text-text">{t.care2.report}</button>;
  const send = async (reason: string) => {
    setState("sending");
    try { await request(`/api/hospitals/${hospitalId}/report`, { body: { reason } }); setState("done"); }
    catch (e: any) { setState(e.message); }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REASONS.map((r) => (
        <button key={r} disabled={state === "sending"} onClick={() => send(r)} className="h-7 rounded-md border border-line px-2 text-xs hover:border-care">{(t.care2 as any)[`reason_${r}`]}</button>
      ))}
      {state !== "idle" && state !== "sending" && <span className="text-xs text-danger">{state}</span>}
    </div>
  );
}

/**
 * A doctor in a copilot, triage or directory result. Only a verified provider (`d.bookable`, from
 * the Firestore repository) can be booked, and that happens in Find care > Book appointment,
 * where the doctor's open times are. Directory doctors are look-only.
 */
export function DoctorCard({ d }: { d: any }) {
  const { t, href } = useI18n();
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-50 text-care-deep"><Stethoscope className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{d.name}</p>
          <p className="text-sm text-subtle">{d.specialty}{d.hospitalName ? ` · ${d.hospitalName}` : ""}</p>
        </div>
        {d.bookable
          ? <Badge tone="health">{t.care2.verifiedDoctor}</Badge>
          : <Badge tone={d.online ? "health" : "neutral"}>{d.online ? t.care2.online : t.care2.offline}</Badge>}
      </div>
      {!d.bookable && <p className="mt-2 text-xs font-semibold text-amber-800">{d.verified ? t.care2.directoryDoctor : t.care2.notVerifiedDoctor}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {d.rating ? <Badge><Star className="h-3.5 w-3.5" aria-hidden="true" />{Number(d.rating).toFixed(1)}</Badge> : null}
        {d.experience ? <Badge>{d.experience} yrs</Badge> : null}
        {d.waitTimeMin ? <Badge><Clock className="h-3.5 w-3.5" aria-hidden="true" />{d.waitTimeMin} min {t.care2.wait}</Badge> : null}
        {typeof d.distanceKm === "number" && <Badge><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{d.distanceKm} {t.care2.km}</Badge>}
      </div>
      {d.bookable && (
        <Link to={`${href("/dashboard/find")}?tab=book`} className="mt-4 grid h-10 place-items-center rounded-xl bg-care text-sm font-semibold text-white hover:bg-care-deep">{t.care2.book}</Link>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- lab analysis

const STATUS_TONE: Record<string, "health" | "danger" | "warn"> = { NORMAL: "health", LOW: "danger", HIGH: "danger", BORDERLINE: "warn" };

export function LabResult({ a }: { a: any }) {
  const { t } = useI18n();
  const label = (s: string) => ({ NORMAL: t.wallet.normal, LOW: t.wallet.low, HIGH: t.wallet.high, BORDERLINE: t.wallet.borderline } as any)[s] || s;
  const risk = a.risk;
  const pct = risk ? Math.round(risk.probability * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-lg font-semibold">{a.reportType}</p>
        <Badge tone={a.urgencyRating === "HIGH" ? "danger" : a.urgencyRating === "MEDIUM" ? "warn" : "health"}>{a.urgencyRating}</Badge>
        <Badge tone="care">{t.assistant.decisionSupport}</Badge>
      </div>
      <p className="leading-relaxed">{a.interpretation}</p>

      {a.flags?.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">{t.wallet.flags}</caption>
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-subtle">
              <tr><th className="px-3 py-2 font-semibold">{t.wallet.flags}</th><th className="px-3 py-2 font-semibold">{t.wallet.range}</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {a.flags.map((f: any) => (
                <tr key={f.key}>
                  <td className="px-3 py-2.5"><span className="font-medium">{f.label}</span> <span className="tabular-nums">{f.value}</span> <span className="text-subtle">{f.unit}</span></td>
                  <td className="px-3 py-2.5 tabular-nums text-subtle">{f.range}</td>
                  <td className="px-3 py-2.5 text-right"><Badge tone={STATUS_TONE[f.status]}>{label(f.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {risk && (
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">{t.wallet.risk}</p>
            <p className="tabular-nums"><span className="text-2xl font-bold">{pct}%</span> <span className="text-sm text-subtle">{risk.level}</span></p>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-mist" role="img" aria-label={`${pct}%`}>
            <div className={`h-full rounded-full ${pct >= 60 ? "bg-danger" : pct >= 30 ? "bg-warn" : "bg-health"}`} style={{ width: `${pct}%` }} />
          </div>
          {risk.drivers?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold">{t.wallet.drivers}</p>
              <ul className="mt-2 space-y-1.5">
                {risk.drivers.slice(0, 4).map((d: any) => (
                  <li key={d.label} className="flex items-center gap-2 text-sm">
                    <span className="w-44 shrink-0 truncate text-subtle">{d.label}</span>
                    <span className="relative h-2 flex-1 rounded bg-mist">
                      <span className={`absolute top-0 h-2 rounded ${d.effect >= 0 ? "left-1/2 bg-danger/70" : "right-1/2 bg-health/70"}`} style={{ width: `${Math.min(50, Math.abs(d.effect) * 25)}%` }} />
                    </span>
                    <span className="w-12 text-right tabular-nums">{d.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {risk.imputed?.length > 0 && <p className="mt-3 text-xs text-subtle">{t.wallet.imputed}: {risk.imputed.join(", ")}</p>}
          <p className="mt-3 border-t border-line pt-3 text-xs text-subtle">
            {risk.model.name} · {t.wallet.trainedOn} {risk.model.samples} {t.wallet.patients} ({risk.model.source}) · {Math.round(risk.model.testAccuracy * 100)}% {t.wallet.accuracy}, AUC {risk.model.testAuc}
          </p>
        </div>
      )}

      {a.actions?.length > 0 && (
        <div>
          <p className="font-semibold">{t.wallet.nextSteps}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">{a.actions.map((x: string) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-2 text-sm text-subtle">{t.wallet.specialist}: <span className="font-medium text-text">{a.recommendedSpecialist}</span></p>
        </div>
      )}
      <p className="text-xs text-subtle">{t.wallet.method}: {a.method}</p>
    </div>
  );
}

// ---------------------------------------------------------------- diet plan

export function DietPlanView({ plan }: { plan: any }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold">{plan.condition} · {plan.dietOption}</p>
        <p className="text-sm text-subtle tabular-nums">{plan.totalKcal} {t.nutrition.kcal} · {t.nutrition.target} ~{plan.targetKcal}</p>
      </div>
      <ol className="space-y-3">
        {plan.schedule.map((s: any) => (
          <li key={s.meal} className="rounded-xl border border-line p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{s.meal}</p>
              <p className="text-sm tabular-nums text-subtle">{s.kcal} {t.nutrition.kcal}</p>
            </div>
            <ul className="mt-2 space-y-2">
              {s.foods.map((f: any) => (
                <li key={f.name} className="text-[15px]">
                  <span className="font-medium">{f.name}</span>{f.hindi && f.hindi !== f.name ? <span className="text-subtle"> ({f.hindi})</span> : null}
                  <span className="text-subtle"> · {f.portion} · {f.kcal} {t.nutrition.kcal}</span>
                  <p className="text-sm text-health-deep">{t.nutrition.why}: {f.why}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {plan.tips?.length > 0 && (
        <div className="rounded-xl bg-green-50 p-4">
          <p className="font-semibold text-health-deep">{t.nutrition.tips}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-green-900">{plan.tips.map((x: string) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-subtle">{plan.method}. {t.medicines.source}: {plan.source}</p>
    </div>
  );
}

// ---------------------------------------------------------------- medicine

export function MedicineView({ m, substitutes }: { m: any; substitutes?: any[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xl font-semibold">{m.name}</p>
        <p className="mt-1 text-[15px]"><span className="text-subtle">{t.medicines.composition}:</span> <span className="font-medium">{m.composition}</span></p>
        {m.manufacturer && <p className="text-sm text-subtle">{t.medicines.manufacturer}: {m.manufacturer}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold">{t.medicines.uses}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px]">{m.uses.map((u: string) => <li key={u}>{u}</li>)}</ul>
        </div>
        <div>
          <p className="text-sm font-semibold">{t.medicines.sideEffects}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px]">{m.sideEffects.slice(0, 8).map((u: string) => <li key={u}>{u}</li>)}</ul>
        </div>
      </div>
      {m.reviews && (
        <div>
          <p className="text-sm font-semibold">{t.medicines.reviews}</p>
          <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full" role="img" aria-label={`${m.reviews.excellent}% ${t.medicines.excellent}, ${m.reviews.average}% ${t.medicines.average}, ${m.reviews.poor}% ${t.medicines.poor}`}>
            <span className="bg-health" style={{ width: `${m.reviews.excellent}%` }} />
            <span className="bg-amber-400" style={{ width: `${m.reviews.average}%` }} />
            <span className="bg-danger" style={{ width: `${m.reviews.poor}%` }} />
          </div>
          <p className="mt-1 text-xs text-subtle">{m.reviews.excellent}% {t.medicines.excellent} · {m.reviews.average}% {t.medicines.average} · {m.reviews.poor}% {t.medicines.poor}</p>
        </div>
      )}
      {substitutes && (
        <div>
          <p className="text-sm font-semibold">{t.medicines.substitutes}</p>
          {substitutes.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-2">{substitutes.map((s: any) => <li key={s.name}><Badge>{s.name}</Badge></li>)}</ul>
          ) : <p className="mt-1 text-sm text-subtle">{t.medicines.noSubs}</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- triage

export function TriageView({ r }: { r: any }) {
  const { t, href } = useI18n();
  const tone = r.urgencyLevel === "CRITICAL" || r.urgencyLevel === "HIGH" ? "danger" : r.urgencyLevel === "MEDIUM" ? "warn" : "health";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-lg font-semibold">{r.suspectedCondition}</p>
        <Badge tone={tone}>{r.urgencyLevel}</Badge>
        {typeof r.confidence === "number" && r.source === "ml-model" && <Badge>{Math.round(r.confidence * 100)}% {t.assistant.confidence}</Badge>}
      </div>
      <p className="leading-relaxed">{r.explanation}</p>
      {r.alternatives?.length > 0 && (
        <p className="text-sm text-subtle">{r.alternatives.map((x: any) => `${x.condition} ${Math.round(x.confidence * 100)}%`).join(" · ")}</p>
      )}
      {r.recommendations?.length > 0 && <ul className="list-disc space-y-1 pl-5 text-[15px]">{r.recommendations.map((x: string) => <li key={x}>{x}</li>)}</ul>}
      <p className="text-sm"><span className="text-subtle">{t.wallet.specialist}:</span> <span className="font-medium">{r.specialistType}</span></p>
      {r.recommendedDoctors?.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">{r.recommendedDoctors.slice(0, 2).map((d: any) => <DoctorCard key={d.id} d={d} />)}</div>
      )}
      {r.recommendedHospitals?.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">{r.recommendedHospitals.slice(0, 2).map((h: any) => <HospitalCard key={h.id} h={h} compact />)}</div>
      )}
      <Link to={href("/app/find-care?tab=doctors&specialty=" + encodeURIComponent(r.doctorSpecialty || ""))} className="inline-flex items-center gap-1 text-sm font-semibold text-care-deep">{t.care.doctor}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
    </div>
  );
}

export function SafetyNote({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "danger" }) {
  const styles = { info: "border-sky-200 bg-sky-50 text-sky-900", warn: "border-amber-200 bg-amber-50 text-amber-900", danger: "border-red-200 bg-red-50 text-red-900" };
  const Icon = tone === "info" ? Info : AlertTriangle;
  return <div className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div>{children}</div></div>;
}
