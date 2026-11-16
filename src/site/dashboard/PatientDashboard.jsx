// City Healer patient dashboard, from City_Healer_Patient_Dashboard_Source.zip (src/main.jsx).
// The supplied layout, class names (dashboard.css) and copy are kept. What changed:
//  - it is the signed-in patient workspace, so names, dates, appointments and records are real;
//  - each view is backed by the app: Find care lists doctors and hospitals, Health wallet runs the
//    lab-report models, AI companion is the City Healer assistant (with voice and hands-free);
//  - Nutrition, Medicines and Emergency views were added, using the same view frame;
//  - "motion/react" (the same library as framer-motion, already in this project); the language
//    follows /en and /hi; the missing Info import (a crash) and a misplaced </div> (the supplied
//    file did not compile) are fixed.
import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";
import { HeartPulse, LayoutDashboard, Search, CalendarDays, FolderHeart, Users, MessageCircle, Settings, Bell, ChevronDown, Plus, ArrowUpRight, ArrowRight, MapPin, Clock, Stethoscope, FlaskConical, Pill, Ambulance, Activity, ShieldCheck, FileText, Heart, Footprints, Droplets, Menu, X, Sparkles, AlertCircle, ChevronRight, LogOut, Globe2, Info, Salad, Cpu } from "lucide-react";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { request } from "../lib/api";
import { useLocationConsent } from "../lib/location";
import { downloadPrescriptionPdf } from "../lib/prescriptionPdf";
import "./dashboard.css";

const FindCarePage = lazy(() => import("../app/FindCarePage"));
const DoctorDirectory = lazy(() => import("./DoctorDirectory"));
const BookingPage = lazy(() => import("./BookingPage"));
const WalletPage = lazy(() => import("../app/WalletPage"));
const NutritionPage = lazy(() => import("../app/NutritionPage"));
const MedicinesPage = lazy(() => import("../app/MedicinesPage"));
const EmergencyPage = lazy(() => import("../app/EmergencyPage"));
const SettingsPage = lazy(() => import("../app/SettingsPage"));
const ModelsPage = lazy(() => import("../app/ModelsPage"));
const AssistantPage = lazy(() => import("../app/AssistantPage"));

const copy = {
  en: { prescription: "Prescription", rxInstructions: "Instructions", cancelledByDoctor: "Cancelled by the doctor", cancelledByCityHealer: "Cancelled by City Healer: this doctor is no longer available here. Please book another doctor.", apptLoadError: "Your appointments could not be loaded. Please try again.", overview: "Overview", find: "Find care", appointments: "Appointments", records: "Health wallet", family: "Family care", assistant: "AI companion", settings: "Settings", nutrition: "Nutrition", medicines: "Medicines", emergency: "Emergency", models: "AI models",
    morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", headline: "Your health, connected.", sub: "A clearer view of your care, all in one place.", location: "Delhi NCR", nearYou: "Near you",
    search: "Search doctors, specialities, hospitals or services", book: "Find a doctor", lab: "Understand a lab report", meds: "Medicines", emergencyHelp: "Emergency help",
    bookSub: "Doctors & specialists", labSub: "Check values from your report", medsSub: "Uses, side effects, substitutes", emergencyQuickSub: "Call 112 · nearest hospitals",
    upcoming: "Upcoming care", viewAll: "View all", noUpcoming: "No upcoming appointments", noUpcomingSub: "Book a consultation and it will appear here.",
    health: "Health snapshot", fromLab: "From the values you last entered in Health wallet", noLab: "Enter values from a lab report in Health wallet to see them here",
    bp: "Blood pressure", sugar: "Blood glucose", hba1c: "HbA1c", haemoglobin: "Haemoglobin", cholesterol: "Total cholesterol", notAdded: "Not added",
    companion: "Your health companion", companionSub: "Ask about symptoms, lab values, medicines or diet in English, हिन्दी or Hinglish, by text or voice.", ask: "Ask City Healer AI",
    disclaimer: "Informational support only. Not a diagnosis, prescription or emergency service.",
    wallet: "Your health wallet", walletSub: "Keep your health information organised.", noRecords: "No saved records yet", noRecordsSub: "Analyse a lab report and save it, and it will appear here.", savedRecords: "saved records", seeRecords: "Open health wallet",
    familyTitle: "Care for your family", familySub: "Manage care for people who have shared access with you.", addMember: "Add family member", primary: "Primary account",
    privacy: "Your privacy matters", privacySub: "You control what you share and with whom.", manage: "Privacy settings",
    sampleNote: "Doctor, hospital and bed information in this build is sample data.", demoNote: "Demo session — create an account to save your details.", demoLabel: "SAMPLE DATA",
    ncr: "Available service areas", ncrText: "Delhi · Gurugram · Noida · Greater Noida · Ghaziabad · Faridabad",
    notifications: "Notifications", noNotifications: "You have no notifications.", profileMenu: "Profile & account", signout: "Sign out", today: "Today", close: "Close", downloadPdf: "Download PDF", pdfFailed: "The PDF could not be created. Please try again.",
    findSub: "Doctors and hospitals across Delhi NCR, nearest first.", apptSub: "Keep track of your upcoming and past care.", nutritionSub: "Indian meal plans for your condition.", medicinesSub: "Look up a medicine, its uses and substitutes.", emergencySub: "What to do now, and the nearest hospitals with emergency care.", settingsSub: "Manage account preferences and privacy.", modelsSub: "The models behind City Healer AI and how they were tested.",
    status: { PENDING: "Requested", CONFIRMED: "Confirmed", ACCEPTED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled", REJECTED: "Declined" },
    familySoon: "Linking family members is not available yet. It will need the person's permission or appropriate legal authority.", noFamily: "No linked family members",
    email: "Email", phone: "Mobile", city: "City", doctorsTab: "Doctors", bookTab: "Book appointment", hospitalsTab: "Hospitals", name: "Name", language: "Language", workspace: "Workspace", patientAccount: "Patient account", demoAccount: "Demo session", video: "Video consultation", inPerson: "In-person visit", view: "View", menu: "Menu" },
  hi: { prescription: "प्रिस्क्रिप्शन", rxInstructions: "निर्देश", cancelledByDoctor: "डॉक्टर ने रद्द किया", cancelledByCityHealer: "City Healer ने रद्द किया: यह डॉक्टर अब यहाँ उपलब्ध नहीं हैं। कृपया दूसरे डॉक्टर के साथ बुक करें।", apptLoadError: "आपके अपॉइंटमेंट लोड नहीं हो सके। कृपया फिर कोशिश करें।", overview: "होम", find: "देखभाल खोजें", appointments: "अपॉइंटमेंट", records: "हेल्थ वॉलेट", family: "परिवार की देखभाल", assistant: "AI सहायक", settings: "सेटिंग्स", nutrition: "पोषण", medicines: "दवाइयाँ", emergency: "आपातकाल", models: "AI मॉडल",
    morning: "सुप्रभात", afternoon: "नमस्कार", evening: "शुभ संध्या", headline: "आपकी सेहत, एक साथ।", sub: "आपकी देखभाल की जानकारी, एक ही जगह।", location: "दिल्ली NCR", nearYou: "आपके पास",
    search: "डॉक्टर, विशेषज्ञता, अस्पताल या सेवा खोजें", book: "डॉक्टर खोजें", lab: "लैब रिपोर्ट समझें", meds: "दवाइयाँ", emergencyHelp: "आपातकालीन सहायता",
    bookSub: "डॉक्टर और विशेषज्ञ", labSub: "रिपोर्ट के आंकड़े जाँचें", medsSub: "उपयोग, दुष्प्रभाव, विकल्प", emergencyQuickSub: "112 पर कॉल · नज़दीकी अस्पताल",
    upcoming: "आगामी देखभाल", viewAll: "सभी देखें", noUpcoming: "कोई आगामी अपॉइंटमेंट नहीं", noUpcomingSub: "परामर्श बुक करें, वह यहाँ दिखेगा।",
    health: "स्वास्थ्य सारांश", fromLab: "हेल्थ वॉलेट में आपके पिछली बार भरे आंकड़ों से", noLab: "यहाँ देखने के लिए हेल्थ वॉलेट में लैब रिपोर्ट के आंकड़े भरें",
    bp: "ब्लड प्रेशर", sugar: "ब्लड ग्लूकोज़", hba1c: "HbA1c", haemoglobin: "हीमोग्लोबिन", cholesterol: "कुल कोलेस्ट्रॉल", notAdded: "नहीं जोड़ा",
    companion: "आपका हेल्थ सहायक", companionSub: "लक्षण, लैब आंकड़े, दवा या डाइट के बारे में English, हिन्दी या Hinglish में, लिखकर या बोलकर पूछें।", ask: "City Healer AI से पूछें",
    disclaimer: "केवल जानकारी के लिए। निदान, दवा का पर्चा या आपातकालीन सेवा नहीं।",
    wallet: "आपका हेल्थ वॉलेट", walletSub: "स्वास्थ्य जानकारी व्यवस्थित रखें।", noRecords: "अभी कोई सहेजा रिकॉर्ड नहीं", noRecordsSub: "लैब रिपोर्ट का विश्लेषण करके सहेजें, वह यहाँ दिखेगी।", savedRecords: "सहेजे रिकॉर्ड", seeRecords: "हेल्थ वॉलेट खोलें",
    familyTitle: "परिवार की देखभाल", familySub: "उन लोगों की देखभाल व्यवस्थित करें जिन्होंने आपके साथ एक्सेस साझा किया है।", addMember: "परिवार का सदस्य जोड़ें", primary: "मुख्य अकाउंट",
    privacy: "आपकी प्राइवेसी महत्वपूर्ण है", privacySub: "आप तय करते हैं कि क्या और किसके साथ साझा करना है।", manage: "प्राइवेसी सेटिंग्स",
    sampleNote: "इस संस्करण में डॉक्टर, अस्पताल और बेड की जानकारी नमूना डेटा है।", demoNote: "डेमो सत्र — अपनी जानकारी सहेजने के लिए अकाउंट बनाएँ।", demoLabel: "नमूना डेटा",
    ncr: "सेवा क्षेत्र", ncrText: "दिल्ली · गुरुग्राम · नोएडा · ग्रेटर नोएडा · गाज़ियाबाद · फ़रीदाबाद",
    notifications: "सूचनाएँ", noNotifications: "आपके लिए कोई सूचना नहीं है।", profileMenu: "प्रोफ़ाइल और अकाउंट", signout: "साइन आउट", today: "आज", close: "बंद करें", /* Hindi below: needs fluent review */ downloadPdf: "PDF डाउनलोड करें", pdfFailed: "PDF नहीं बन सका। कृपया फिर कोशिश करें।",
    findSub: "दिल्ली NCR में डॉक्टर और अस्पताल, सबसे नज़दीकी पहले।", apptSub: "अपनी आगामी और पिछली देखभाल देखें।", nutritionSub: "आपकी स्थिति के लिए भारतीय भोजन योजना।", medicinesSub: "दवा, उसके उपयोग और विकल्प खोजें।", emergencySub: "अभी क्या करें, और आपातकालीन सेवा वाले नज़दीकी अस्पताल।", settingsSub: "अकाउंट और प्राइवेसी सेटिंग्स।", modelsSub: "City Healer AI के मॉडल और उनकी जाँच।",
    status: { PENDING: "अनुरोध भेजा", CONFIRMED: "पुष्टि हुई", ACCEPTED: "पुष्टि हुई", COMPLETED: "पूरा हुआ", CANCELLED: "रद्द", REJECTED: "अस्वीकार" },
    familySoon: "परिवार के सदस्यों को जोड़ने की सुविधा अभी उपलब्ध नहीं है। इसके लिए उस व्यक्ति की अनुमति या उचित कानूनी अधिकार चाहिए होगा।", noFamily: "कोई जुड़ा सदस्य नहीं",
    email: "ईमेल", phone: "मोबाइल", city: "शहर", doctorsTab: "डॉक्टर", bookTab: "अपॉइंटमेंट बुक करें", hospitalsTab: "अस्पताल", name: "नाम", language: "भाषा", workspace: "कार्यक्षेत्र", patientAccount: "मरीज़ अकाउंट", demoAccount: "डेमो सत्र", video: "वीडियो परामर्श", inPerson: "अस्पताल में", view: "देखें", menu: "मेन्यू" },
};

const NAV = [["overview", LayoutDashboard], ["find", Search], ["appointments", CalendarDays], ["records", FolderHeart], ["nutrition", Salad], ["medicines", Pill], ["family", Users], ["assistant", MessageCircle], ["emergency", Ambulance]];
const VIEWS = new Set([...NAV.map(([id]) => id), "settings", "models"]);

const initials = (name) => (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "CH";

export default function PatientDashboard() {
  const { locale, switchLocale, href } = useI18n();
  const lang = locale, L = (l) => switchLocale(l);
  const t = copy[lang];
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const { coords, status: locStatus, locate } = useLocationConsent();

  // The view lives in the address (/en/dashboard/find), so Back and links work.
  const seg = location.pathname.split("/")[3] || "overview";
  const active = VIEWS.has(seg) ? seg : "overview";
  const [mobile, M] = useState(false), [query, Q] = useState(""), [modal, Modal] = useState(""), [profileOpen, PO] = useState(false);
  const [appointments, setAppointments] = useState(null);
  const [apptError, setApptError] = useState("");
  const [apptTick, setApptTick] = useState(0);
  const [records, setRecords] = useState(null);
  const [recordsTick, setRecordsTick] = useState(0);

  const go = (id, search = "") => { navigate(href(id === "overview" ? "/dashboard" : `/dashboard/${id}`) + search); M(false); PO(false); window.scrollTo(0, 0); };

  useEffect(() => {
    if (!session.user) { setAppointments([]); setApptError(""); return; }
    // One appointment system: bookings with verified providers (Firestore, /api/v1/appointments).
    request("/api/v1/appointments/mine")
      .then((current) => { setAppointments((current.appointments || []).map(fromBooking)); setApptError(""); })
      .catch((e) => { setAppointments([]); setApptError(e.message || "error"); });
  }, [session.user, active, apptTick]);
  useEffect(() => {
    if (!session.user) { setRecords([]); return; }
    // Saved records and the prescriptions doctors have written, oldest first (the list shows
    // the last entry first). Each is loaded on its own, so one failing does not hide the other.
    Promise.all([request("/api/records").catch(() => []), request("/api/v1/prescriptions/mine").catch(() => ({ prescriptions: [] }))])
      .then(([saved, rx]) => setRecords(
        [...saved, ...(rx.prescriptions || []).map((p) => fromPrescription(p, t))]
          .sort((a, b) => String(a.at || a.date).localeCompare(String(b.at || b.date)))));
  }, [session.user, recordsTick, lang]);

  const name = session.name || (session.demo ? t.demoAccount : "");
  const firstName = (name.split(" ")[0] || "").toUpperCase();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? t.morning : hour < 17 ? t.afternoon : t.evening;
  const dateLabel = now.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
  const cityLabel = coords ? t.nearYou : session.profile?.city || t.location;

  const todayISO = now.toISOString().slice(0, 10);
  const when = (a) => a.at || `${a.date} ${a.time}`;
  const sortedAppts = useMemo(() => (appointments || []).slice().sort((a, b) => when(a).localeCompare(when(b))), [appointments]);
  const nextAppt = sortedAppts.find((a) => (a.at ? a.at > now.toISOString() : a.date >= todayISO) && !["CANCELLED", "REJECTED", "COMPLETED"].includes(a.status));

  // The latest lab values the patient entered in Health wallet (kept on this device).
  const labs = useMemo(() => { try { return JSON.parse(localStorage.getItem("ch_last_labs") || "null"); } catch { return null; } }, [active, recordsTick]);
  const v = (k) => (labs && labs[k] !== undefined && labs[k] !== null ? labs[k] : null);

  const service = [
    { name: t.book, sub: t.bookSub, icon: Stethoscope, tint: "blue", id: "find" },
    { name: t.lab, sub: t.labSub, icon: FlaskConical, tint: "purple", id: "records" },
    { name: t.meds, sub: t.medsSub, icon: Pill, tint: "green", id: "medicines" },
    { name: t.emergencyHelp, sub: t.emergencyQuickSub, icon: Ambulance, tint: "orange", id: "emergency" },
  ];

  const signOut = async () => { await session.signOut(); navigate(href("/"), { replace: true }); };
  const titles = { find: [t.find, t.findSub], appointments: [t.appointments, t.apptSub], records: [t.wallet, t.walletSub], nutrition: [t.nutrition, t.nutritionSub], medicines: [t.medicines, t.medicinesSub], family: [t.familyTitle, t.familySub], assistant: [t.companion, t.companionSub], emergency: [t.emergency, t.emergencySub], settings: [t.settings, t.settingsSub], models: [t.models, t.modelsSub] };

  return <div className="chd"><div className="app">
    <aside className={"sidebar " + (mobile ? "show" : "")}>
      <a className="brand" href={href("/")}><span className="brandmark"><HeartPulse /></span><span>city<span>healer</span></span></a>
      <div className="workspace-label">PATIENT WORKSPACE</div>
      <nav>{NAV.map(([id, Icon]) => <button key={id} className={active === id ? "navitem active" : "navitem"} onClick={() => go(id)} style={id === "emergency" ? { color: "#c2410c" } : undefined}><Icon size={18} /><span>{t[id]}</span>{id === "appointments" && nextAppt && <i className="navdot" />}</button>)}</nav>
      <div className="side-bottom">
        <div className="side-help"><ShieldCheck /><b>{t.privacy}</b><small>{t.privacySub}</small><button onClick={() => go("settings")}>{t.manage}<ArrowUpRight size={13} /></button></div>
        <button className="settings-link" onClick={() => go("settings")}><Settings size={17} />{t.settings}</button>
        <div className="side-user"><div className="avatar">{initials(name)}</div><div><b>{name}</b><small>{session.demo ? t.demoAccount : t.patientAccount}</small></div><button onClick={() => PO(!profileOpen)} aria-label={t.profileMenu}><ChevronDown size={16} /></button>
          {profileOpen && <div className="profile-pop"><button onClick={() => { PO(false); Modal("profile"); }}>{t.profileMenu}</button><button onClick={signOut}>{t.signout}</button></div>}
        </div>
      </div>
    </aside>
    {mobile && <button className="scrim" onClick={() => M(false)} aria-label="Close menu" />}
    <div className="main">
      <header className="topbar">
        <div className="top-left"><button className="mobile-menu" onClick={() => M(true)} aria-label={t.menu}><Menu /></button><div className="crumb">{t.workspace} <ChevronRight size={13} /><b>{t[active] || t.overview}</b></div></div>
        <div className="top-right">
          <button className="location-pill" style={{ border: 0, cursor: "pointer" }} onClick={() => (coords ? go("settings") : locate())} title={coords ? t.nearYou : t.location}><MapPin size={14} />{locStatus === "locating" ? "…" : cityLabel}<ChevronDown size={13} /></button>
          <button className="language" onClick={() => L(lang === "en" ? "hi" : "en")}><Globe2 size={15} />{lang === "en" ? "हिन्दी" : "English"}</button>
          <button className="bell" onClick={() => Modal("notifications")} aria-label={t.notifications}><Bell size={18} /></button>
          <button className="top-avatar" onClick={() => Modal("profile")} aria-label={t.profileMenu}>{initials(name)}</button>
        </div>
      </header>
      <div className="content">
        <div className="demo-banner"><AlertCircle size={15} /><span>{session.demo ? t.demoNote : t.sampleNote}</span><span className="demo-pill">{t.demoLabel}</span></div>

        {active === "overview" && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="view">
          <div className="welcome-row"><div><div className="eyebrow">{greeting}{firstName ? ` · ${firstName}` : ""}</div><h1>{t.headline}</h1><p>{t.sub}</p></div><button className="date-chip"><CalendarDays size={15} />{t.today}, {dateLabel}</button></div>
          <form className="searchbar" onSubmit={(e) => { e.preventDefault(); if (query.trim()) navigate(`${href("/dashboard/assistant")}?q=${encodeURIComponent(query.trim())}`); }}>
            <Search size={18} /><input value={query} onChange={(e) => Q(e.target.value)} placeholder={t.search} aria-label={t.search} /><kbd>↵</kbd>
          </form>
          <section className="quick-grid">{service.map((s, i) => <button className="quick-card" key={i} onClick={() => go(s.id)}><span className={"quick-icon " + s.tint}><s.icon size={20} /></span><span className="quick-copy"><b>{s.name}</b><small>{s.sub}</small></span><ArrowUpRight size={15} className="quick-arrow" /></button>)}</section>

          <div className="section-heading"><div><h2>{t.upcoming}</h2><p role={apptError ? "alert" : undefined}>{nextAppt ? (t.status[nextAppt.status] || nextAppt.status) : apptError ? t.apptLoadError : t.noUpcomingSub}</p></div><button className="text-btn" onClick={() => go("appointments")}>{t.viewAll}<ArrowRight size={14} /></button></div>
          {nextAppt ? <AppointmentCard a={nextAppt} t={t} lang={lang} onView={() => go("appointments")} /> : (
            <div className="appointment-card"><div className="appt-date"><b>—</b><span></span></div><div className="appt-info"><h3>{t.noUpcoming}</h3><p>{t.noUpcomingSub}</p></div><div className="appt-action"><button onClick={() => go("find", "?tab=doctors")}>{t.book}<ArrowRight size={14} /></button></div></div>
          )}

          <div className="section-heading"><div><h2>{t.health}</h2><p>{labs ? `${t.fromLab} · ${new Date(labs.at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN")}` : t.noLab}</p></div><button className="text-btn" onClick={() => go("records")}>{t.seeRecords}<ArrowRight size={14} /></button></div>
          <div className="metric-grid">
            <Metric icon={Activity} label={t.bp} value={v("restingBp") ?? (v("diastolicBp") !== null ? `— / ${v("diastolicBp")}` : "— / —")} unit="mmHg" note={v("restingBp") !== null || v("diastolicBp") !== null ? "" : t.notAdded} tint="blue" />
            <Metric icon={Droplets} label={t.sugar} value={v("glucose") ?? "—"} unit="mg/dL" note={v("glucose") !== null ? (v("hba1c") !== null ? `${t.hba1c} ${v("hba1c")}%` : "") : t.notAdded} tint="purple" />
            <Metric icon={Heart} label={t.cholesterol} value={v("cholesterol") ?? "—"} unit="mg/dL" note={v("cholesterol") !== null ? "" : t.notAdded} tint="green" />
            <Metric icon={Footprints} label={t.haemoglobin} value={v("haemoglobin") ?? "—"} unit="g/dL" note={v("haemoglobin") !== null ? "" : t.notAdded} tint="orange" />
          </div>

          <div className="bottom-grid">
            <div className="feature-card ai-card"><div className="feature-head"><span className="ai-icon"><Sparkles size={18} /></span><span className="mini-label">CITY HEALER AI</span></div><h3>{t.companion}</h3><p>{t.companionSub}</p><button className="dark-btn" onClick={() => go("assistant")}>{t.ask}<ArrowRight size={15} /></button><small>{t.disclaimer}</small></div>
            <div className="feature-card wallet-card"><div className="feature-head"><span className="wallet-icon"><FolderHeart size={18} /></span><span className="mini-label">HEALTH RECORDS</span></div><h3>{t.wallet}</h3><p>{t.walletSub}</p>
              <div className="wallet-empty"><FileText size={19} /><span>{records && records.length ? `${records.length} ${t.savedRecords} · ${records[records.length - 1].title}` : t.noRecords}</span></div>
              <button className="outline-btn" onClick={() => go("records")}>{t.seeRecords}<ArrowRight size={14} /></button></div>
          </div>

          <div className="section-heading"><div><h2>{t.familyTitle}</h2><p>{t.familySub}</p></div><button className="text-btn" onClick={() => go("family")}>{t.viewAll}<ArrowRight size={14} /></button></div>
          <div className="family-strip"><div className="family-person"><div className="family-avatar">{initials(name)}</div><div><b>{name}</b><small>{t.primary}</small></div><span className="you-badge">YOU</span></div><button className="add-family" onClick={() => Modal("family")}><Plus size={16} />{t.addMember}</button></div>
          <div className="ncr-note"><MapPin size={16} /><div><b>{t.ncr}</b><span>{t.ncrText}</span></div></div>
        </motion.div>}

        {active !== "overview" && <SectionView title={titles[active][0]} sub={titles[active][1]}>
          <Suspense fallback={<div className="empty-note"><Info size={17} />…</div>}>
            {active === "find" && <FindCareView t={t} />}
            {active === "appointments" && <AppointmentsView list={sortedAppts} loading={appointments === null} error={apptError} onRetry={() => setApptTick((n) => n + 1)} t={t} lang={lang} onFind={() => go("find", "?tab=book")} />}
            {active === "records" && <>
              <Embed><WalletPage embedded onSaved={() => setRecordsTick((n) => n + 1)} /></Embed>
              <div className="section-heading" style={{ marginTop: 28 }}><div><h2>{t.wallet}</h2><p>{records?.length ? `${records.length} ${t.savedRecords}` : t.noRecordsSub}</p></div></div>
              {records?.length ? <div className="settings-list">{records.slice().reverse().map((r) => <button key={r.id} onClick={() => Modal({ record: r })}><FileText /><span><b>{r.title}</b><small>{r.date} · {r.doctorName}</small></span><ChevronRight /></button>)}</div>
                : <div className="record-empty"><span><FolderHeart size={27} /></span><h3>{t.noRecords}</h3><p>{t.noRecordsSub}</p></div>}
            </>}
            {active === "nutrition" && <Embed><NutritionPage embedded /></Embed>}
            {active === "medicines" && <Embed><MedicinesPage embedded /></Embed>}
            {active === "family" && <>
              <div className="family-strip"><div className="family-person"><div className="family-avatar">{initials(name)}</div><div><b>{name}</b><small>{t.primary}</small></div><span className="you-badge">YOU</span></div></div>
              <div className="record-empty compact"><span><Users size={25} /></span><h3>{t.noFamily}</h3><p>{t.familySoon}</p></div>
            </>}
            {active === "assistant" && <Embed><AssistantPage embedded /></Embed>}
            {active === "emergency" && <Embed><EmergencyPage embedded /></Embed>}
            {active === "settings" && <>
              <div className="settings-list" style={{ marginBottom: 20 }}>
                <button onClick={() => Modal("profile")}><Users /><span><b>{t.profileMenu}</b><small>{session.profile?.email || session.profile?.phone || name}</small></span><ChevronRight /></button>
                <button onClick={() => L(lang === "en" ? "hi" : "en")}><Globe2 /><span><b>{t.language}</b><small>English / हिन्दी</small></span><ChevronRight /></button>
                <button onClick={() => go("models")}><Cpu /><span><b>{t.models}</b><small>{t.modelsSub}</small></span><ChevronRight /></button>
                <button onClick={signOut}><LogOut /><span><b>{t.signout}</b><small>{session.profile?.email || session.profile?.phone || ""}</small></span><ChevronRight /></button>
              </div>
              <Embed><SettingsPage embedded /></Embed>
            </>}
            {active === "models" && <Embed><ModelsPage embedded /></Embed>}
          </Suspense>
        </SectionView>}
      </div>
      <footer className="main-footer"><span>© {now.getFullYear()} City Healer</span><span>Delhi NCR · India</span><span>Designed for connected care</span></footer>
    </div>
    {modal && <div className="modal-backdrop" onClick={() => Modal("")}><div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"><button className="modal-x" onClick={() => Modal("")} aria-label={t.close}><X /></button><span className="modal-icon">{modal.record ? <FileText /> : <ShieldCheck />}</span>
      {modal === "profile" ? <><h3>{t.profileMenu}</h3><p><b>{t.name}:</b> {name}<br />{session.profile?.phone ? <><b>{t.phone}:</b> {session.profile.phone}<br /></> : null}<b>{t.email}:</b> {session.profile?.email || "—"}<br /><b>{t.city}:</b> {session.profile?.city || "—"}{session.profile?.locality ? `, ${session.profile.locality}` : ""}</p></>
        : modal === "notifications" ? <><h3>{t.notifications}</h3><p>{t.noNotifications}</p></>
        : modal === "family" ? <><h3>{t.addMember}</h3><p>{t.familySoon}</p></>
        : modal.record ? <><h3>{modal.record.title}</h3><p>{modal.record.date} · {modal.record.doctorName}<br /><br />{modal.record.diagnoseSummary}</p>{modal.record.rx && <RxPdfButton rx={modal.record.rx} t={t} />}</>
        : null}
      <button className="primary-btn" onClick={() => Modal("")}>{t.close}</button></div></div>}
  </div></div>;
}

/** Find care: verified doctors to book, the look-only doctor directory, and hospitals. */
function FindCareView({ t }) {
  const location = useLocation();
  const navigate = useNavigate();
  const requested = new URLSearchParams(location.search).get("tab");
  const tab = ["book", "hospitals"].includes(requested) ? requested : "doctors";
  const set = (v) => navigate(`${location.pathname}?tab=${v}`, { replace: true });
  return <>
    <div className="tabs-row" role="tablist" style={{ display: "inline-flex", gap: 6, background: "#fff", border: "1px solid #e8eff0", borderRadius: 10, padding: 4, marginBottom: 18 }}>
      {[["book", t.bookTab], ["doctors", t.doctorsTab], ["hospitals", t.hospitalsTab]].map(([v, label]) => (
        <button key={v} role="tab" aria-selected={tab === v} onClick={() => set(v)}
          style={{ border: 0, borderRadius: 7, padding: "8px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: tab === v ? "#173d4b" : "transparent", color: tab === v ? "#fff" : "#7d8c92" }}>{label}</button>
      ))}
    </div>
    {tab === "book" ? <BookingPage /> : tab === "doctors" ? <DoctorDirectory /> : <Embed><FindCarePage embedded only="hospitals" /></Embed>}
  </>;
}

/** Dashboard-styled frame around the app's own pages; dashboard.css maps their colours to this design. */
function Embed({ children }) { return <div className="ch ch-embed">{children}</div>; }

/** A Firestore booking (server/firebase/booking.ts) in the shape the appointment card shows. */
function fromBooking(b) {
  const start = new Date(b.startsAt);
  return {
    id: b.id, at: b.startsAt, doctorName: b.doctorName, specialty: b.specialty,
    date: start.toLocaleDateString("en-CA"), // YYYY-MM-DD in the patient's own time zone
    time: start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    type: b.consultationType === "online" ? "VIRTUAL" : "IN_PERSON",
    status: String(b.status || "").toUpperCase(),
    cancelledBy: b.cancelledBy || null, cancelReason: b.cancelReason || "",
  };
}

/** A prescription (server/firebase/consultations.ts) in the shape the health-wallet list shows. */
function fromPrescription(p, t) {
  const medicines = (p.medicines || []).map((m) => [m.name, m.dosage, m.frequency, m.duration].filter(Boolean).join(", ")).join("; ");
  return {
    id: `rx-${p.id}`, title: `${t.prescription}: ${p.diagnosis}`, date: String(p.issuedAt || "").slice(0, 10), at: p.issuedAt, doctorName: p.doctorName,
    diagnoseSummary: [medicines, p.instructions ? `${t.rxInstructions}: ${p.instructions}` : ""].filter(Boolean).join(". "),
    rx: p, // the prescription itself, for "Download PDF"
  };
}

/** "Download PDF" for a prescription in the health wallet (jspdf loads on click). */
function RxPdfButton({ rx, t }) {
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const go = async () => {
    setBusy(true); setFailed(false);
    try { await downloadPrescriptionPdf(rx); } catch { setFailed(true); } finally { setBusy(false); }
  };
  return <div style={{ marginTop: 12 }}><button className="primary-btn" onClick={go} disabled={busy}><FileText size={15} />{busy ? "…" : t.downloadPdf}</button>{failed && <p role="alert" style={{ marginTop: 6 }}>{t.pdfFailed}</p>}</div>;
}

function AppointmentCard({ a, t, lang, onView }) {
  const d = new Date(`${a.date}T00:00:00`);
  return <div className="appointment-card"><div className="appt-date"><b>{d.getDate()}</b><span>{d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</span></div>
    <div className="appt-info"><div className="appt-tag"><span />{a.type === "VIRTUAL" ? t.video : t.inPerson}</div><h3>{a.doctorName}</h3><p>{a.specialty}</p>
      <div className="appt-meta"><span><CalendarDays size={14} />{d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" })}</span><span><Clock size={14} />{a.time}</span></div>{a.cancelledBy === "doctor" && <p style={{ marginTop: 6 }}>{t.cancelledByDoctor}{a.cancelReason ? `: ${a.cancelReason}` : ""}</p>}{a.cancelledBy === "city_healer" && <p style={{ marginTop: 6 }}>{t.cancelledByCityHealer}</p>}</div>
    <div className="appt-action"><span className="demo-chip">{t.status[a.status] || a.status}</span>{onView && <button onClick={onView}>{t.view}<ArrowRight size={14} /></button>}</div></div>;
}

function AppointmentsView({ list, loading, error, onRetry, t, lang, onFind }) {
  if (loading) return <div className="empty-note"><Info size={17} />…</div>;
  // A failed load is said so: an empty list would read as "you have no appointments".
  if (error) return <div className="empty-note" role="alert"><Info size={17} />{t.apptLoadError} <button className="text-btn" onClick={onRetry}>↻</button></div>;
  if (!list.length) return <div className="record-empty"><span><CalendarDays size={27} /></span><h3>{t.noUpcoming}</h3><p>{t.noUpcomingSub}</p><button className="primary-btn" onClick={onFind}><Stethoscope size={15} />{t.book}</button></div>;
  return <>{list.map((a) => <AppointmentCard key={a.id} a={a} t={t} lang={lang} />)}</>;
}

function Metric({ icon: Icon, label, value, unit, note, tint }) { return <div className="metric"><div className={"metric-icon " + tint}><Icon size={17} /></div><span className="metric-label">{label}</span><div className="metric-value">{value}<small>{unit}</small></div><span className="metric-note">{note}</span></div>; }
function SectionView({ title, sub, children }) { return <motion.div className="view inner-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><div className="inner-heading"><div><div className="eyebrow">CITY HEALER · PATIENT</div><h1>{title}</h1><p>{sub}</p></div></div>{children}</motion.div>; }
