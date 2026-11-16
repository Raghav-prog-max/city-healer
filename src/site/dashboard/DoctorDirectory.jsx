// City Healer doctor directory, from City_Healer_Doctor_Discovery_Booking_Source_Refreshed.zip (src/main.jsx).
// The supplied search panel, filters, cards, profile and booking modal (markup, class names and
// doctor-directory.css) are kept; the page chrome (sidebar, top bar, footer) is left to the dashboard.
// What changed:
//  - real directory data from /api/doctors (80 doctors at Delhi NCR hospitals; city and locality
//    come from the hospital's address), near-first when a location is known;
//  - LOOK-ONLY: the directory names real practitioners whose registration, qualifications and
//    availability City Healer has not verified, so every unverified doctor shows
//    "Not verified · booking unavailable" and the server refuses to book them. Details the data
//    does not have (degree, languages, fee) are said to be missing rather than invented;
//  - a verified doctor (npm run verify-doctor) can be booked: the date cannot be in the past and
//    taken times are greyed out, both checked again by the server;
//  - the supplied intro heading and location badge are omitted (the dashboard has both);
//  - "motion/react" (the same library as framer-motion, already in this project).
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, MapPin, ChevronDown, SlidersHorizontal, Video, Building2, ArrowRight, Check, ShieldCheck, ShieldAlert, Info, X, BriefcaseMedical, Stethoscope, Clock, Navigation } from "lucide-react";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { request } from "../lib/api";
import { useLocationConsent, CITY_CENTRES } from "../lib/location";
import "./doctor-directory.css";

const COPY = {
  en: {
    banner: "This directory lists doctors at Delhi NCR hospitals for information only. City Healer has not verified their registration, qualifications or availability, so booking is switched off until a doctor is verified.",
    bannerTag: "NOT VERIFIED", eyebrow: "CITY HEALER · DOCTOR NETWORK", title: "Find the right care.",
    intro: "Explore doctors across Delhi NCR. Search by specialty, location or availability.",
    search: "Search doctor, specialty, hospital or locality...", specialty: "Specialty", city: "City", availability: "Availability",
    allSpecialties: "All specialties", allCities: "All NCR cities", any: "Any time", onlineNow: "Online now", reset: "Reset",
    results: "Doctors to explore", profiles: "doctors", sortBy: "Sort by", recommended: "Recommended", experience: "Experience", nearest: "Nearest",
    notVerified: "NOT VERIFIED", verified: "VERIFIED", yearsUnverified: "years (not verified)", feeNotListed: "Fee not listed", fee: "Consultation fee",
    viewProfile: "View profile", book: "Continue to booking", bookingOff: "Not verified · booking unavailable",
    noResults: "No matching doctors", noResultsSub: "Try a different specialty, city or search phrase.", clear: "Clear filters",
    noteTitle: "Credential transparency matters.",
    note: "Before a doctor can be booked, City Healer must verify their registration with the State Medical Council or NMC, their qualifications, practice details and consent to be listed. Until then profiles are look-only.",
    aboutUnverified: "City Healer has not verified this doctor's registration, qualifications or availability. The details shown come from a sample directory and may be out of date. Booking opens once the doctor is verified.",
    hospital: "Hospital", status: "Status now", online: "Online", offline: "Offline", directions: "Directions to hospital", km: "km",
    loading: "Loading doctors…", error: "Could not load the directory.",
    chooseConsultation: "Choose your consultation.", requestTag: "APPOINTMENT REQUEST", requestSub: "Times already booked are greyed out. The doctor confirms your request.",
    consultationType: "Consultation type", inPerson: "In-person", chooseDate: "Choose a date", times: "Available times",
    patientName: "Patient name", contact: "Contact number (optional)", send: "Send booking request", sending: "Sending…",
    needSlot: "Choose a time.", sent: "Booking request sent", sentSub: "The doctor will confirm or decline it. You can follow it under Appointments.",
    doctor: "Doctor", consultation: "Consultation", dateTime: "Date & time", patient: "Patient", done: "Done", disclaimer: "Not an emergency service. For an emergency call 112.",
  },
  hi: {
    banner: "यह निर्देशिका दिल्ली NCR के अस्पतालों के डॉक्टरों की केवल जानकारी देती है। City Healer ने उनके पंजीकरण, योग्यता या उपलब्धता का सत्यापन नहीं किया है, इसलिए सत्यापन तक बुकिंग बंद है।",
    bannerTag: "सत्यापित नहीं", eyebrow: "CITY HEALER · डॉक्टर नेटवर्क", title: "सही देखभाल खोजें।",
    intro: "दिल्ली NCR में डॉक्टर खोजें। विशेषज्ञता, स्थान या उपलब्धता से खोजें।",
    search: "डॉक्टर, विशेषज्ञता, अस्पताल या इलाका खोजें...", specialty: "विशेषज्ञता", city: "शहर", availability: "उपलब्धता",
    allSpecialties: "सभी विशेषज्ञताएँ", allCities: "सभी NCR शहर", any: "कभी भी", onlineNow: "अभी ऑनलाइन", reset: "रीसेट",
    results: "डॉक्टर", profiles: "डॉक्टर", sortBy: "क्रम", recommended: "सुझाए गए", experience: "अनुभव", nearest: "सबसे नज़दीक",
    notVerified: "सत्यापित नहीं", verified: "सत्यापित", yearsUnverified: "वर्ष (सत्यापित नहीं)", feeNotListed: "फ़ीस उपलब्ध नहीं", fee: "परामर्श फ़ीस",
    viewProfile: "प्रोफ़ाइल देखें", book: "बुकिंग करें", bookingOff: "सत्यापित नहीं · बुकिंग उपलब्ध नहीं",
    noResults: "कोई डॉक्टर नहीं मिला", noResultsSub: "कोई और विशेषज्ञता, शहर या शब्द आज़माएँ।", clear: "फ़िल्टर हटाएँ",
    noteTitle: "प्रमाणपत्रों में पारदर्शिता ज़रूरी है।",
    note: "किसी डॉक्टर की बुकिंग से पहले City Healer को राज्य मेडिकल काउंसिल या NMC में उनका पंजीकरण, योग्यता, प्रैक्टिस की जानकारी और सूची में शामिल होने की सहमति जाँचनी होगी। तब तक प्रोफ़ाइल केवल देखने के लिए हैं।",
    aboutUnverified: "City Healer ने इस डॉक्टर के पंजीकरण, योग्यता या उपलब्धता का सत्यापन नहीं किया है। दिखाई गई जानकारी एक नमूना निर्देशिका से है और पुरानी हो सकती है। सत्यापन के बाद बुकिंग खुलेगी।",
    hospital: "अस्पताल", status: "अभी", online: "ऑनलाइन", offline: "ऑफ़लाइन", directions: "अस्पताल का रास्ता", km: "कि.मी.",
    loading: "डॉक्टर लोड हो रहे हैं…", error: "निर्देशिका लोड नहीं हो सकी।",
    chooseConsultation: "अपना परामर्श चुनें।", requestTag: "अपॉइंटमेंट अनुरोध", requestSub: "पहले से बुक समय धूसर दिखते हैं। डॉक्टर आपके अनुरोध की पुष्टि करेंगे।",
    consultationType: "परामर्श का प्रकार", inPerson: "अस्पताल में", chooseDate: "तारीख चुनें", times: "उपलब्ध समय",
    patientName: "मरीज़ का नाम", contact: "संपर्क नंबर (वैकल्पिक)", send: "बुकिंग अनुरोध भेजें", sending: "भेज रहे हैं…",
    needSlot: "समय चुनें।", sent: "बुकिंग अनुरोध भेजा गया", sentSub: "डॉक्टर पुष्टि या अस्वीकार करेंगे। अपॉइंटमेंट में देख सकते हैं।",
    doctor: "डॉक्टर", consultation: "परामर्श", dateTime: "तारीख और समय", patient: "मरीज़", done: "ठीक है", disclaimer: "यह आपातकालीन सेवा नहीं है। आपात स्थिति में 112 पर कॉल करें।",
  },
};

const SLOTS = ["09:30 AM", "10:00 AM", "10:30 AM", "11:30 AM", "12:00 PM", "02:30 PM", "04:00 PM", "05:30 PM"];
const COLORS = ["mint", "blue", "rose", "sand", "lilac"];
const initials = (name) => name.replace(/^Dr\.?\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function DoctorDirectory() {
  const { locale } = useI18n();
  const t = COPY[locale] || COPY.en;
  const session = useSession();
  const { coords } = useLocationConsent();
  const centre = coords || (session.profile?.city ? CITY_CENTRES[session.profile.city] : null);

  const [doctors, setDoctors] = useState(null), [loadError, setLoadError] = useState("");
  const [q, Q] = useState(""), [city, City] = useState(""), [spec, Spec] = useState(""), [mode, Mode] = useState("any"), [sort, Sort] = useState("recommended");
  const [selected, Selected] = useState(null), [booking, B] = useState(null);
  const [date, D] = useState(todayISO()), [slot, S] = useState(""), [consult, C] = useState("VIRTUAL");
  const [patient, P] = useState(""), [contact, Contact] = useState(""), [done, Done] = useState(false), [error, E] = useState(""), [busy, Busy] = useState(false), [booked, Booked] = useState([]);

  useEffect(() => {
    const qs = centre ? `?lat=${centre.lat}&lng=${centre.lng}` : "";
    request(`/api/doctors${qs}`).then(setDoctors).catch((e) => setLoadError(e.message));
  }, [centre?.lat, centre?.lng]);

  const specialties = useMemo(() => [...new Set((doctors || []).map((d) => d.specialty))].sort(), [doctors]);
  const cities = useMemo(() => [...new Set((doctors || []).map((d) => d.city).filter(Boolean))].sort(), [doctors]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let data = (doctors || []).filter((d) =>
      (!city || d.city === city) && (!spec || d.specialty === spec) && (mode !== "online" || d.online) &&
      (!needle || `${d.name} ${d.specialty} ${d.hospitalName} ${d.city} ${d.locality}`.toLowerCase().includes(needle)));
    if (sort === "experience") data = [...data].sort((a, b) => (b.experience || 0) - (a.experience || 0));
    if (sort === "nearest") data = [...data].sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    // Recommended: verified first, then online, then nearest (the API's order).
    if (sort === "recommended") data = [...data].sort((a, b) => Number(b.verified) - Number(a.verified) || Number(b.online) - Number(a.online));
    return data;
  }, [doctors, q, city, spec, mode, sort]);

  const reset = () => { Q(""); City(""); Spec(""); Mode("any"); };
  const openProfile = (d) => { Selected(d); B({ profile: true }); };
  const openBook = (d) => {
    if (!d.verified) return openProfile(d);
    Selected(d); B({ book: true }); D(todayISO()); S(""); C("VIRTUAL"); P(session.name || ""); Contact(session.profile?.phone || ""); Done(false); E("");
  };
  const close = () => { B(null); Selected(null); Done(false); E(""); };

  // Times already taken for the chosen doctor and date (server-checked again on submit).
  useEffect(() => {
    if (!booking?.book || !selected) return;
    request(`/api/doctors/${selected.id}/booked?date=${date}`).then((r) => Booked(r.booked || [])).catch(() => Booked([]));
  }, [booking, selected, date]);

  const submit = async () => {
    E("");
    if (!slot) { E(t.needSlot); return; }
    Busy(true);
    try {
      await request("/api/appointments", { body: { doctorId: selected.id, patientName: patient.trim() || session.name, date, time: slot, type: consult, symptoms: "" } });
      Done(true);
    } catch (e) { E(e.message); } finally { Busy(false); }
  };
  const formatDate = (v) => new Date(v + "T12:00:00").toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" });
  const verifiedCount = (doctors || []).filter((d) => d.verified).length;

  return <div className="chb chb">
    <div className="demo-banner"><Info size={15} /><span>{t.banner}</span><b>{verifiedCount ? `${verifiedCount} ${t.verified}` : t.bannerTag}</b></div>
    {/* The supplied intro and location badge are left out: the dashboard already shows the
        page title and the location in its own header. */}
    <div className="search-panel">
      <div className="search-input"><Search size={19} /><input value={q} onChange={(e) => Q(e.target.value)} placeholder={t.search} aria-label={t.search} /></div>
      <div className="filter-row">
        <label><span>{t.specialty}</span><select value={spec} onChange={(e) => Spec(e.target.value)}><option value="">{t.allSpecialties}</option>{specialties.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span>{t.city}</span><select value={city} onChange={(e) => City(e.target.value)}><option value="">{t.allCities}</option>{cities.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span>{t.availability}</span><select value={mode} onChange={(e) => Mode(e.target.value)}><option value="any">{t.any}</option><option value="online">{t.onlineNow}</option></select></label>
        <button className="filter-reset" onClick={reset}><SlidersHorizontal size={15} /> {t.reset}</button>
      </div>
    </div>
    <div className="results-head"><div><h2>{t.results}</h2><p>{filtered.length} {t.profiles} · {city || t.allCities}</p></div>
      <label className="sort">{t.sortBy} <select value={sort} onChange={(e) => Sort(e.target.value)}><option value="recommended">{t.recommended}</option><option value="experience">{t.experience}</option>{centre && <option value="nearest">{t.nearest}</option>}</select></label></div>

    {loadError ? <div className="no-results"><Info size={24} /><h3>{t.error}</h3><p>{loadError === "network" ? "" : loadError}</p></div>
      : !doctors ? <div className="no-results"><p>{t.loading}</p></div>
      : filtered.length ? <div className="doctor-grid">{filtered.map((d, i) => <motion.article className="doctor-card" key={d.id} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
        <div className="doctor-top"><div className={"doctor-avatar " + COLORS[i % COLORS.length]}>{initials(d.name)}</div><span className="sample-tag" style={d.verified ? { background: "#e8f7ef", color: "#239d70" } : undefined}>{d.verified ? t.verified : t.notVerified}</span></div>
        <h3>{d.name}</h3><p className="specialty">{d.specialty}</p>
        <div className="qualification"><Building2 size={14} />{d.hospitalName}</div>
        <div className="doctor-meta"><span><BriefcaseMedical size={14} />{d.experience} {t.yearsUnverified}</span><span><MapPin size={14} />{[d.locality, d.city].filter(Boolean).join(", ")}{typeof d.distanceKm === "number" ? ` · ${d.distanceKm} ${t.km}` : ""}</span></div>
        <div className="language-row"><Clock size={14} />{d.online ? t.online : t.offline}</div>
        <div className="card-bottom"><div><small>{t.fee}</small><b style={{ fontSize: 11 }}>{t.feeNotListed}</b></div><button onClick={() => openProfile(d)}>{t.viewProfile}<ArrowRight size={14} /></button></div>
        {d.verified
          ? <button className="book-link" onClick={() => openBook(d)}>{t.book} <ArrowRight size={14} /></button>
          : <button className="book-link" disabled aria-disabled="true" style={{ color: "#9c8055", background: "#fbf7ef", borderColor: "#f2e7d5", cursor: "not-allowed" }}><ShieldAlert size={14} />{t.bookingOff}</button>}
      </motion.article>)}</div>
      : <div className="no-results"><Search size={24} /><h3>{t.noResults}</h3><p>{t.noResultsSub}</p><button onClick={reset}>{t.clear}</button></div>}

    <div className="bottom-note"><ShieldCheck /><div><b>{t.noteTitle}</b><span>{t.note}</span></div></div>

    <AnimatePresence>{booking && selected && <div className="modal-backdrop" onClick={close}><motion.div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 15, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}>
      {booking.profile ? <>
        <button className="x" onClick={close} aria-label="Close"><X /></button>
        <div className="profile-header"><div className={"doctor-avatar big " + COLORS[0]}>{initials(selected.name)}</div><span className="sample-tag" style={selected.verified ? { background: "#e8f7ef", color: "#239d70" } : undefined}>{selected.verified ? t.verified : t.notVerified}</span></div>
        <h2>{selected.name}</h2><p className="specialty">{selected.specialty}</p>
        <div className="profile-facts">
          <span><Building2 />{t.hospital}: {selected.hospitalName}</span>
          <span><MapPin />{selected.hospitalAddress}</span>
          <span><BriefcaseMedical />{selected.experience} {t.yearsUnverified}</span>
          <span><Stethoscope />{t.status}: {selected.online ? t.online : t.offline}</span>
        </div>
        {!selected.verified && <p className="profile-about">{t.aboutUnverified}</p>}
        <div className="profile-fee"><span>{t.fee}</span><b style={{ fontSize: 12 }}>{t.feeNotListed}</b></div>
        <a className="primary full" style={{ textDecoration: "none", marginTop: 12 }} target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.hospitalName + ", " + (selected.hospitalAddress || ""))}`}><Navigation />{t.directions}</a>
        {selected.verified
          ? <button className="primary full" onClick={() => openBook(selected)}>{t.book}<ArrowRight /></button>
          : <div className="modal-disclaimer" style={{ marginTop: 12 }}><ShieldAlert size={14} />{t.bookingOff}</div>}
      </> : done ? <div className="success">
        <button className="x" onClick={close} aria-label="Close"><X /></button>
        <span className="success-icon"><Check /></span><h2>{t.sent}</h2><p>{t.sentSub}</p>
        <div className="confirmation"><span>{t.doctor}<b>{selected.name}</b></span><span>{t.consultation}<b>{consult === "VIRTUAL" ? "Online" : t.inPerson}</b></span><span>{t.dateTime}<b>{formatDate(date)} · {slot}</b></span><span>{t.patient}<b>{patient || session.name}</b></span></div>
        <button className="primary full" onClick={close}>{t.done}<Check /></button>
      </div> : <>
        <button className="x" onClick={close} aria-label="Close"><X /></button>
        <div className="eyebrow">{t.requestTag}</div><h2>{t.chooseConsultation}</h2><p className="modal-sub">{t.requestSub}</p>
        <div className="selected-doctor"><div className={"doctor-avatar small " + COLORS[0]}>{initials(selected.name)}</div><div><b>{selected.name}</b><small>{selected.specialty} · {selected.city}</small></div><span>{t.feeNotListed}</span></div>
        <div className="field-title">{t.consultationType}</div>
        <div className="mode-options"><button className={consult === "VIRTUAL" ? "picked" : ""} onClick={() => C("VIRTUAL")}><Video />Online</button><button className={consult === "IN_PERSON" ? "picked" : ""} onClick={() => C("IN_PERSON")}><Building2 />{t.inPerson}</button></div>
        <label className="field">{t.chooseDate}<input type="date" min={todayISO()} value={date} onChange={(e) => { D(e.target.value); S(""); }} /></label>
        <div className="field-title">{t.times}</div>
        <div className="slot-grid">{SLOTS.map((x) => <button className={slot === x ? "picked" : ""} key={x} disabled={booked.includes(x)} style={booked.includes(x) ? { opacity: .4, cursor: "not-allowed" } : undefined} onClick={() => S(x)}>{x}</button>)}</div>
        <div className="field-row"><label className="field">{t.patientName}<input value={patient} onChange={(e) => P(e.target.value)} /></label><label className="field">{t.contact}<input value={contact} onChange={(e) => Contact(e.target.value)} placeholder="+91 98765 43210" /></label></div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-disclaimer"><Info size={14} />{t.disclaimer}</div>
        <button className="primary full" onClick={submit} disabled={busy}>{busy ? t.sending : t.send}<ArrowRight /></button>
      </>}
    </motion.div></div>}</AnimatePresence>
  </div>;
}
