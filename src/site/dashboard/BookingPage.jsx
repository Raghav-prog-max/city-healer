// Verified-doctor booking, from City_Healer_Integrated_Doctor_Booking_Source.zip (frontend/src/main.jsx).
// The supplied banner, search panel, filters, doctor cards, profile modal, booking modal and "My
// appointments" panel (markup, class names and booking.css) are kept. What changed:
//  - shown inside the patient dashboard, so the page chrome (sidebar, top bar, footer, intro) and
//    the separate email/password sign-in are left out: the dashboard session's Firebase token is
//    sent with every request (lib/api request), and "My appointments" sits above the results;
//  - talks to this app's server (server/firebase/booking.ts), which only lists verified, active
//    providers and books inside a Firestore transaction;
//  - the supplied file called setters that did not exist (setDate, setBusy, setAppointmentsBusy),
//    which broke opening a booking, rescheduling and loading appointments; fixed;
//  - rescheduling fetches the doctor's profile when the current filters hide them;
//  - appointment rows say who the appointment is with; English and Hindi text;
//  - "motion/react" (the same library as framer-motion, already in this project).
import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Search, MapPin, SlidersHorizontal, Video, Building2, ArrowRight, Check, ShieldCheck, X, Info,
  Languages, GraduationCap, BriefcaseMedical, CalendarCheck, RefreshCw, AlertCircle, LoaderCircle,
} from "lucide-react";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { request } from "../lib/api";
import "./booking.css";

const SPECIALTIES = ["General Physician", "Cardiology", "Dermatology", "Paediatrics", "Gynaecology", "Orthopaedics", "Neurology", "Psychiatry"];
const CITIES = ["Delhi", "Gurugram", "Noida", "Greater Noida", "Ghaziabad", "Faridabad"];
const palette = ["mint", "blue", "rose", "sand", "lilac"];
const initials = (name) => (name || "CH").replace(/^Dr\.?\s*/i, "").split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

const COPY = {
  en: {
    byDoctor: "Cancelled by the doctor", byCityHealer: "Cancelled by City Healer: this doctor is no longer available here. Please book another doctor.",
    banner: "Only doctors whose registration City Healer has checked, and who have published open times, appear here. Booking is confirmed by the server.",
    bannerTag: "VERIFIED ONLY", search: "Search verified doctor, specialty or locality...",
    specialty: "Specialty", city: "City", consultation: "Consultation", allSpecialties: "All specialties", allCities: "All NCR cities",
    anyConsult: "Any consultation", online: "Online", inPerson: "In-person", reset: "Reset",
    myAppointments: "My appointments", myAppointmentsSub: "Bookings made with this account.", refresh: "Refresh",
    loadingAppts: "Loading appointments…", noAppts: "No appointments yet.", reference: "Reference", with: "with",
    reschedule: "Reschedule", cancel: "Cancel", cancelConfirm: "Cancel this appointment?",
    results: "Verified doctors", providers: (n) => `${n} verified doctor${n === 1 ? "" : "s"}`, loadingDocs: "Loading verified doctors…",
    sortBy: "Sort by", recommended: "Recommended", experience: "Experience", verified: "VERIFIED",
    expNotListed: "Experience not listed", years: "years", qualNotListed: "Qualifications not listed", langNotListed: "Languages not listed",
    fee: "Consultation fee", feeNotListed: "Fee not listed", viewProfile: "View profile", checkAvail: "Check live availability",
    about: "Verified City Healer doctor. More profile details appear here when the doctor adds them.",
    noneTitle: "No verified doctors yet", noneSub: "Doctors appear here once City Healer has checked their registration and they publish open times. Meanwhile, the Doctors tab lists doctors at NCR hospitals for information.",
    unavailable: "Verified doctors could not be loaded", retry: "Retry",
    noteTitle: "Credential transparency matters.",
    note: "A doctor is listed only after an administrator has checked their registration with the State Medical Council or NMC and their qualifications. Their registration number is never shown or shared.",
    bookTag: "BOOK AN APPOINTMENT", rescheduleTag: "RESCHEDULE APPOINTMENT", bookTitle: "Choose your consultation.", rescheduleTitle: "Choose a new time.",
    modalSub: "Open times come from the doctor. Your booking is confirmed only when the server accepts it.",
    consultType: "Consultation type", fetching: "Fetching open times…", noSlots: "This doctor has no open times right now.",
    chooseDate: "Choose a date", slotsTitle: "Open times", noSlotsDate: (type) => `No ${type} times on this date. Pick another date or consultation type.`,
    disclaimer: "The booking is tied to your signed-in account. No phone number or other contact details are sent with it.",
    wait: "Please wait…", confirmBook: "Confirm appointment", confirmReschedule: "Confirm new time", checkAvailability: "Check availability",
    booked: (ref) => `Appointment confirmed. Reference: ${ref}`, cancelled: "Appointment cancelled.", rescheduled: "Appointment moved to the new time.",
    pickSlot: "Choose an open time.", pickNew: (name) => `Choose a new time with ${name}, then confirm.`, gone: "This doctor is no longer taking bookings.",
    notPatient: "Booking is for patient accounts. This account is signed in with a staff role.",
    status: { confirmed: "CONFIRMED", cancelled: "CANCELLED" },
  },
  hi: {
    byDoctor: "डॉक्टर ने रद्द किया", byCityHealer: "City Healer ने रद्द किया: यह डॉक्टर अब यहाँ उपलब्ध नहीं हैं। कृपया दूसरे डॉक्टर के साथ बुक करें।",
    banner: "यहाँ केवल वे डॉक्टर दिखते हैं जिनका पंजीकरण City Healer ने जाँचा है और जिन्होंने खाली समय जोड़ा है। बुकिंग की पुष्टि सर्वर करता है।",
    bannerTag: "केवल सत्यापित", search: "सत्यापित डॉक्टर, विशेषज्ञता या इलाका खोजें...",
    specialty: "विशेषज्ञता", city: "शहर", consultation: "परामर्श", allSpecialties: "सभी विशेषज्ञताएँ", allCities: "सभी NCR शहर",
    anyConsult: "कोई भी परामर्श", online: "ऑनलाइन", inPerson: "मिलकर", reset: "रीसेट",
    myAppointments: "मेरी अपॉइंटमेंट", myAppointmentsSub: "इस खाते से की गई बुकिंग।", refresh: "रीफ़्रेश",
    loadingAppts: "अपॉइंटमेंट लोड हो रही हैं…", noAppts: "अभी कोई अपॉइंटमेंट नहीं।", reference: "संदर्भ", with: "के साथ",
    reschedule: "समय बदलें", cancel: "रद्द करें", cancelConfirm: "यह अपॉइंटमेंट रद्द करें?",
    results: "सत्यापित डॉक्टर", providers: (n) => `${n} सत्यापित डॉक्टर`, loadingDocs: "सत्यापित डॉक्टर लोड हो रहे हैं…",
    sortBy: "क्रम", recommended: "सुझाए गए", experience: "अनुभव", verified: "सत्यापित",
    expNotListed: "अनुभव नहीं बताया", years: "वर्ष", qualNotListed: "योग्यता नहीं बताई", langNotListed: "भाषाएँ नहीं बताईं",
    fee: "परामर्श शुल्क", feeNotListed: "शुल्क नहीं बताया", viewProfile: "प्रोफ़ाइल देखें", checkAvail: "खाली समय देखें",
    about: "City Healer द्वारा सत्यापित डॉक्टर। डॉक्टर के जोड़ने पर यहाँ और जानकारी दिखेगी।",
    noneTitle: "अभी कोई सत्यापित डॉक्टर नहीं", noneSub: "पंजीकरण जाँचे जाने और खाली समय जोड़ने के बाद डॉक्टर यहाँ दिखेंगे। तब तक 'डॉक्टर' टैब में NCR अस्पतालों के डॉक्टर जानकारी के लिए दिखते हैं।",
    unavailable: "सत्यापित डॉक्टर लोड नहीं हो सके", retry: "फिर कोशिश करें",
    noteTitle: "योग्यता की पारदर्शिता ज़रूरी है।",
    note: "कोई डॉक्टर तभी दिखता है जब एडमिन ने राज्य मेडिकल काउंसिल या NMC में उनका पंजीकरण और योग्यता जाँच ली हो। पंजीकरण संख्या कभी दिखाई या साझा नहीं की जाती।",
    bookTag: "अपॉइंटमेंट बुक करें", rescheduleTag: "समय बदलें", bookTitle: "अपना परामर्श चुनें।", rescheduleTitle: "नया समय चुनें।",
    modalSub: "खाली समय डॉक्टर तय करते हैं। सर्वर के स्वीकार करने पर ही बुकिंग पक्की होती है।",
    consultType: "परामर्श का प्रकार", fetching: "खाली समय लाए जा रहे हैं…", noSlots: "इस डॉक्टर के पास अभी कोई खाली समय नहीं है।",
    chooseDate: "तारीख चुनें", slotsTitle: "खाली समय", noSlotsDate: () => "इस तारीख को इस प्रकार का कोई समय नहीं। दूसरी तारीख या प्रकार चुनें।",
    disclaimer: "बुकिंग आपके साइन-इन खाते से जुड़ी है। इसके साथ फ़ोन नंबर या कोई संपर्क जानकारी नहीं भेजी जाती।",
    wait: "कृपया रुकें…", confirmBook: "अपॉइंटमेंट पक्की करें", confirmReschedule: "नया समय पक्का करें", checkAvailability: "खाली समय देखें",
    booked: (ref) => `अपॉइंटमेंट पक्की हुई। संदर्भ: ${ref}`, cancelled: "अपॉइंटमेंट रद्द हुई।", rescheduled: "अपॉइंटमेंट नए समय पर हो गई।",
    pickSlot: "कोई खाली समय चुनें।", pickNew: (name) => `${name} के साथ नया समय चुनें, फिर पक्का करें।`, gone: "यह डॉक्टर अभी बुकिंग नहीं ले रहे।",
    notPatient: "बुकिंग मरीज़ खातों के लिए है। यह खाता स्टाफ़ भूमिका से साइन-इन है।",
    status: { confirmed: "पक्की", cancelled: "रद्द" },
  },
};

export default function BookingPage() {
  const { lang } = useI18n();
  const c = COPY[lang] || COPY.en;
  const { role, demo } = useSession();
  // Staff accounts and the demo sandbox can browse; the server refuses their bookings too.
  const isPatient = (!role || role === "PATIENT") && !demo;
  const fmtDate = (v) => new Date(v).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const fmtTime = (v) => new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const money = (v) => (v == null ? c.feeNotListed : `₹${v}`);

  const [doctors, setDoctors] = useState([]), [loading, setLoading] = useState(true), [apiError, setApiError] = useState("");
  const [q, Q] = useState(""), [city, City] = useState(""), [spec, Spec] = useState(""), [mode, Mode] = useState(""), [sort, Sort] = useState("recommended");
  const [selected, Selected] = useState(null), [booking, B] = useState(false), [date, D] = useState(""), [slot, S] = useState(""), [consult, C] = useState("online");
  const [slots, Slots] = useState([]), [slotsBusy, SlotsBusy] = useState(false);
  const [appointments, Appointments] = useState([]), [appointmentsOpen, AppointmentsOpen] = useState(false), [appointmentsBusy, AppointmentsBusy] = useState(false);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [notice, Notice] = useState(""), [error, E] = useState(""), [busy, Busy] = useState(false);

  const shape = (d, i) => ({
    ...d,
    name: d.fullName || "Doctor",
    degree: Array.isArray(d.qualifications) && d.qualifications.length ? d.qualifications.join(", ") : c.qualNotListed,
    experience: d.experienceYears ? `${d.experienceYears} ${c.years}` : c.expNotListed,
    languages: Array.isArray(d.languages) && d.languages.length ? d.languages : [c.langNotListed],
    mode: (d.consultationTypes || []).map((x) => (x === "online" ? "online" : "in_person")),
    fee: d.consultationFee, initials: initials(d.fullName), color: palette[i % palette.length],
    about: d.about || c.about,
  });

  const loadDoctors = async () => {
    setLoading(true); setApiError("");
    try {
      const params = new URLSearchParams();
      if (city) params.set("city", city);
      if (spec) params.set("specialty", spec);
      const data = await request(`/api/v1/doctors${params.toString() ? `?${params}` : ""}`);
      setDoctors((data.doctors || []).map(shape));
    } catch (err) {
      setDoctors([]); setApiError(err.message === "network" ? "Cannot reach the City Healer server." : err.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { loadDoctors(); }, [city, spec, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let data = doctors.filter((d) => (!mode || d.mode.includes(mode)) && `${d.name} ${d.specialty} ${d.city} ${d.locality}`.toLowerCase().includes(q.toLowerCase()));
    if (sort === "experience") data = [...data].sort((a, b) => (Number(b.experienceYears) || 0) - (Number(a.experienceYears) || 0));
    return data;
  }, [doctors, q, mode, sort]);

  const loadSlots = async (doctor, preferredType = null) => {
    SlotsBusy(true); E("");
    try {
      const data = await request(`/api/v1/doctors/${encodeURIComponent(doctor.id)}/slots`);
      const available = (data.slots || []).filter((x) => x.status === "open" && Date.parse(x.startsAt) > Date.now())
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      Slots(available);
      if (available.length) {
        const first = available.find((x) => !preferredType || x.consultationType === preferredType) || available[0];
        D(first.startsAt.slice(0, 10));
        C(preferredType || first.consultationType);
      }
    } catch (err) { E(err.message); } finally { SlotsBusy(false); }
  };

  const openBook = async (doctor) => {
    Selected(doctor); B(true); S(""); E(""); Notice(""); Slots([]); D(""); setRescheduleId(null);
    await loadSlots(doctor);
  };
  const dateSlots = slots.filter((x) => x.startsAt.slice(0, 10) === date && x.consultationType === consult);

  const loadMyAppointments = async () => {
    AppointmentsBusy(true);
    try {
      const data = await request("/api/v1/appointments/mine");
      Appointments((data.appointments || []).sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || "")));
    } catch (err) { E(err.message); } finally { AppointmentsBusy(false); }
  };

  const submitBooking = async () => {
    if (!slot) { E(c.pickSlot); return; }
    Busy(true); E("");
    try {
      const result = await request("/api/v1/appointments", { body: { doctorId: selected.id, slotId: slot, consultationType: consult } });
      Notice(c.booked(result.appointmentId)); B(false); Selected(null); S("");
      AppointmentsOpen(true); await loadMyAppointments();
    } catch (err) {
      E(err.message);
      // Someone else may have taken it: show what is still open.
      if (err.status === 409) await loadSlots(selected, consult);
    } finally { Busy(false); }
  };

  const cancel = async (id) => {
    if (!window.confirm(c.cancelConfirm)) return;
    try { await request(`/api/v1/appointments/${encodeURIComponent(id)}/cancel`, { method: "POST" }); Notice(c.cancelled); await loadMyAppointments(); }
    catch (err) { E(err.message); }
  };

  const reschedule = async (appt) => {
    let doctor = doctors.find((d) => d.id === appt.doctorId);
    if (!doctor) {
      try { doctor = shape((await request(`/api/v1/doctors/${encodeURIComponent(appt.doctorId)}`)).doctor, 0); }
      catch { E(c.gone); return; }
    }
    Selected(doctor); B(true); S(""); D(""); E(""); setRescheduleId(appt.id);
    await loadSlots(doctor, appt.consultationType);
    C(appt.consultationType);
    Notice(c.pickNew(doctor.name));
  };
  const submitReschedule = async () => {
    if (!slot || !rescheduleId) { E(c.pickSlot); return; }
    Busy(true); E("");
    try {
      await request(`/api/v1/appointments/${encodeURIComponent(rescheduleId)}/reschedule`, { body: { newSlotId: slot } });
      Notice(c.rescheduled); B(false); Selected(null); setRescheduleId(null); await loadMyAppointments();
    } catch (err) {
      E(err.message);
      if (err.status === 409) await loadSlots(selected, consult);
    } finally { Busy(false); }
  };
  const closeBooking = () => { B(false); Selected(null); S(""); E(""); setRescheduleId(null); };

  return <div className="chk chk">
    <div className="demo-banner"><Info size={15} /><span>{c.banner}</span><b>{c.bannerTag}</b></div>
    {role && role !== "PATIENT" && <div className="api-error"><AlertCircle size={17} /><div><b>{c.notPatient}</b></div></div>}
    {notice && <div className="notice"><Check size={15} />{notice}<button onClick={() => Notice("")} aria-label="Close"><X size={14} /></button></div>}
    {apiError && <div className="api-error"><AlertCircle size={17} /><div><b>{c.unavailable}</b><span>{apiError}</span></div><button onClick={loadDoctors}><RefreshCw size={14} /> {c.retry}</button></div>}
    <div className="search-panel">
      <div className="search-input"><Search size={19} /><input value={q} onChange={(e) => Q(e.target.value)} placeholder={c.search} aria-label={c.search} /></div>
      <div className="filter-row">
        <label><span>{c.specialty}</span><select value={spec} onChange={(e) => Spec(e.target.value)}><option value="">{c.allSpecialties}</option>{SPECIALTIES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span>{c.city}</span><select value={city} onChange={(e) => City(e.target.value)}><option value="">{c.allCities}</option>{CITIES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span>{c.consultation}</span><select value={mode} onChange={(e) => Mode(e.target.value)}><option value="">{c.anyConsult}</option><option value="online">{c.online}</option><option value="in_person">{c.inPerson}</option></select></label>
        <button className="filter-reset" onClick={() => { Q(""); City(""); Spec(""); Mode(""); }}><SlidersHorizontal size={15} /> {c.reset}</button>
      </div>
    </div>

    {isPatient && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 13 }}>
      <button className="text-action" onClick={() => { AppointmentsOpen(!appointmentsOpen); if (!appointmentsOpen) loadMyAppointments(); }}><CalendarCheck size={14} /> {c.myAppointments}</button>
    </div>}
    {appointmentsOpen && <section className="appointments-panel">
      <div className="results-head"><div><h2>{c.myAppointments}</h2><p>{c.myAppointmentsSub}</p></div><button className="filter-reset" onClick={loadMyAppointments}><RefreshCw size={14} /> {c.refresh}</button></div>
      {appointmentsBusy ? <p className="empty-state">{c.loadingAppts}</p> : appointments.length ? <div className="appointment-list">{appointments.map((a) =>
        <div className="appointment-row" key={a.id}>
          <div>
            <b>{c.status[a.status] || String(a.status || "").toUpperCase()}</b>
            <span>{fmtDate(a.startsAt)} · {fmtTime(a.startsAt)} – {fmtTime(a.endsAt)}{a.doctorName ? ` · ${a.doctorName}` : ""}{a.consultationType ? ` · ${a.consultationType === "online" ? c.online : c.inPerson}` : ""}</span>
            {a.cancelledBy === "doctor" && <span>{c.byDoctor}{a.cancelReason ? `: ${a.cancelReason}` : ""}</span>}
            {a.cancelledBy === "city_healer" && <span>{c.byCityHealer}</span>}
            <small>{c.reference}: {a.id}</small>
          </div>
          <div className="appointment-actions">{a.status === "confirmed" && Date.parse(a.startsAt) > Date.now() && <><button onClick={() => reschedule(a)}>{c.reschedule}</button><button className="danger-action" onClick={() => cancel(a.id)}>{c.cancel}</button></>}</div>
        </div>)}</div> : <p className="empty-state">{c.noAppts}</p>}
    </section>}

    <div className="results-head">
      <div><h2>{c.results}</h2><p>{loading ? c.loadingDocs : `${c.providers(filtered.length)} · ${city || "Delhi NCR"}`}</p></div>
      <label className="sort">{c.sortBy} <select value={sort} onChange={(e) => Sort(e.target.value)}><option value="recommended">{c.recommended}</option><option value="experience">{c.experience}</option></select></label>
    </div>
    {loading ? <div className="empty-state"><LoaderCircle className="spin" /> {c.loadingDocs}</div> : filtered.length ? <div className="doctor-grid">{filtered.map((d, i) =>
      <motion.article className="doctor-card" key={d.id} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
        <div className="doctor-top"><div className={`doctor-avatar ${d.color}`}>{d.initials}</div><span className="verified-tag"><ShieldCheck size={11} /> {c.verified}</span></div>
        <h3>{d.name}</h3><p className="specialty">{d.specialty}</p>
        <div className="qualification"><GraduationCap size={14} />{d.degree}</div>
        <div className="doctor-meta"><span><BriefcaseMedical size={14} />{d.experience}</span><span><MapPin size={14} />{d.locality}, {d.city}</span></div>
        <div className="language-row"><Languages size={14} />{d.languages.join(" · ")}</div>
        <div className="card-bottom"><div><small>{c.fee}</small><b>{money(d.fee)}</b></div><button onClick={() => Selected(d)}>{c.viewProfile}<ArrowRight size={14} /></button></div>
        {isPatient && <button className="book-link" onClick={() => openBook(d)}>{c.checkAvail} <ArrowRight size={14} /></button>}
      </motion.article>)}</div>
      : <div className="no-results"><Search size={24} /><h3>{apiError ? c.unavailable : c.noneTitle}</h3><p>{apiError ? apiError : c.noneSub}</p><button onClick={loadDoctors}>{c.refresh}</button></div>}
    <div className="bottom-note"><ShieldCheck /><div><b>{c.noteTitle}</b><span>{c.note}</span></div></div>

    <AnimatePresence>{selected && !booking && <div className="modal-backdrop" onClick={() => Selected(null)}><motion.div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <button className="x" onClick={() => Selected(null)} aria-label="Close"><X /></button>
      <div className="profile-header"><div className={`doctor-avatar big ${selected.color}`}>{selected.initials}</div><span className="verified-tag"><ShieldCheck size={11} /> {c.verified}</span></div>
      <h2>{selected.name}</h2><p className="specialty">{selected.specialty}</p>
      <div className="profile-facts"><span><GraduationCap />{selected.degree}</span><span><BriefcaseMedical />{selected.experience}</span><span><MapPin />{selected.locality}, {selected.city}</span><span><Languages />{selected.languages.join(" · ")}</span></div>
      <p className="profile-about">{selected.about}</p>
      <div className="profile-fee"><span>{c.fee}</span><b>{money(selected.fee)}</b></div>
      {isPatient && <button className="primary full" onClick={() => openBook(selected)}>{c.checkAvailability}<ArrowRight /></button>}
    </motion.div></div>}</AnimatePresence>

    <AnimatePresence>{booking && selected && <div className="modal-backdrop" onClick={closeBooking}><motion.div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 15, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}>
      <button className="x" onClick={closeBooking} aria-label="Close"><X /></button>
      <div className="eyebrow">{rescheduleId ? c.rescheduleTag : c.bookTag}</div>
      <h2>{rescheduleId ? c.rescheduleTitle : c.bookTitle}</h2>
      <p className="modal-sub">{c.modalSub}</p>
      <div className="selected-doctor"><div className={`doctor-avatar small ${selected.color}`}>{selected.initials}</div><div><b>{selected.name}</b><small>{selected.specialty} · {selected.city}</small></div><span>{money(selected.fee)}</span></div>
      <div className="field-title">{c.consultType}</div>
      <div className="mode-options">
        <button className={consult === "online" ? "picked" : ""} disabled={!!rescheduleId && consult !== "online"} onClick={() => { C("online"); S(""); }}><Video />{c.online}</button>
        <button className={consult === "in_person" ? "picked" : ""} disabled={!!rescheduleId && consult !== "in_person"} onClick={() => { C("in_person"); S(""); }}><Building2 />{c.inPerson}</button>
      </div>
      {slotsBusy ? <div className="empty-state"><LoaderCircle className="spin" /> {c.fetching}</div>
        : slots.length === 0 ? <div className="api-error"><Info size={16} />{c.noSlots}</div>
        : <>
          <label className="field">{c.chooseDate}<input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => { D(e.target.value); S(""); }} /></label>
          <div className="field-title">{c.slotsTitle}</div>
          <div className="slot-grid">{dateSlots.map((x) => <button className={slot === x.id ? "picked" : ""} key={x.id} onClick={() => S(x.id)}>{fmtTime(x.startsAt)}</button>)}</div>
          {dateSlots.length === 0 && <p className="empty-state">{c.noSlotsDate(consult === "online" ? c.online.toLowerCase() : c.inPerson.toLowerCase())}</p>}
        </>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="modal-disclaimer"><Info size={14} />{c.disclaimer}</div>
      <button className="primary full" disabled={busy || slotsBusy || !slot} onClick={rescheduleId ? submitReschedule : submitBooking}>{busy ? c.wait : rescheduleId ? c.confirmReschedule : c.confirmBook}<ArrowRight /></button>
    </motion.div></div>}</AnimatePresence>
  </div>;
}
