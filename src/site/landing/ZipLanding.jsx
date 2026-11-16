// City Healer landing page, from City_Healer_Landing_Page_Extracted.zip (src/main.jsx), used as supplied.
// Changes: exported instead of mounting itself; "motion/react" (the same library as framer-motion,
// already in this project); the language follows the /en and /hi address; styles scoped to .chl.
// Connected to the app: "Get started" opens patient onboarding and a Sign in link is added; the
// provider buttons still open the supplied interest form.
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useI18n } from "../i18n";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, Activity, Heart, ShieldCheck, Stethoscope,
  FileHeart, BrainCircuit, Users, MapPin, Menu, X, Plus, Sparkles,
  Microscope, House, Hospital, Check, ChevronDown, Globe2, HeartPulse
} from "lucide-react";
import "./landing.css";

const photos = {
  hero: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1500&q=85",
  doctor: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1000&q=85",
  family: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1100&q=85",
  lab: "https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=1000&q=85",
  nurse: "https://images.unsplash.com/photo-1576765608866-5b51046452b6?auto=format&fit=crop&w=1000&q=85",
  team: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1100&q=85",
  care: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1100&q=85"
};

const copy = {
  en: {
    nav:["Platform","How it works","For providers","Our vision"],
    access:"Get started",signin:"Sign in", eyebrow:"A more connected way to care",
    hero1:"Healthcare,", hero2:"connected around you.",
    heroText:"One calmer place to find care, understand your health, and stay connected with the people who support it.",
    explore:"Explore City Healer", how:"See how it works", preview:"A glimpse of what’s possible",
    previewTag:"PRODUCT PREVIEW", wallet:"Your health, together", walletSub:"A clearer view of the details that matter.",
    appointment:"Care, closer to home", appointmentSub:"Explore services around your neighbourhood.",
    ai:"A little help, when you need it", aiSub:"Ask in English, हिन्दी or Hinglish.",
    regionEyebrow:"ROOTED IN THE REGION", regionTitle:"Designed around the way our cities live.", regionText:"We’re building City Healer with Delhi NCR in mind — its neighbourhoods, families and the many people who make care happen.", cities:["Delhi","Gurugram","Noida","Greater Noida","Ghaziabad","Faridabad"],
    featureEyebrow:"ONE CONNECTED EXPERIENCE", featureTitle:"Care feels simpler when everything connects.", featureText:"The pieces of your health journey, brought closer together — with people at the centre.",
    find:"Find care", findText:"Explore doctors, hospitals, diagnostics, pharmacies and home-care services in one place.", health:"Your health wallet", healthText:"Keep reports, prescriptions and important health information organised and close at hand.", companion:"A thoughtful AI companion", companionText:"Understand health information and prepare for better conversations with clinicians.", family:"Care for your circle", familyText:"Support the people you love with family-centred tools and shared care journeys.", network:"A connected care network", networkText:"A more joined-up experience for the people and services that support your health.",
    aiEyebrow:"MEET YOUR HEALTH COMPANION", aiTitle:"A thoughtful companion for your health questions.", aiText:"Get help making sense of health information, organising questions and considering useful next steps — in the language that feels natural to you.", prompt1:"Can you explain this report in simple words?", prompt2:"मुझे डॉक्टर से क्या पूछना चाहिए?", prompt3:"What kind of care should I look for?",
    safety:"Helpful context, not a diagnosis.", safetyText:"City Healer’s AI is designed to support understanding. It does not diagnose, prescribe or replace a qualified healthcare professional.",
    stepsEyebrow:"A CLEARER WAY FORWARD", stepsTitle:"A few simple steps. A more connected journey.", steps:[["01","Tell us what you need","Start with a question, a care need or the health information you want to organise."],["02","Explore relevant care","Find services and care options that match your needs and chosen location."],["03","Keep the important things close","Bring health information together so it’s easier to return to when you need it."]],
    providerEyebrow:"BUILT WITH CARE TEAMS", providerTitle:"Better connected, together.", providerText:"We’re shaping a platform that helps care teams and services become easier to discover and coordinate. Provider participation will be subject to onboarding and verification.", providerCards:["Doctors & clinics","Hospitals","Labs & pharmacies","Home-care partners"], partner:"Partner with City Healer",
    privacyEyebrow:"TRUST IS PART OF THE DESIGN", privacyTitle:"Your health deserves thoughtful care.", privacy:["You stay in control","Clear choices around the information you share.","Responsible AI","Helpful explanations with clear limits.","Transparent information","Provider and service status should be clear.","Built with privacy in mind","Security and privacy considered throughout the experience."],
    ctaTitle:"Let’s make care more connected.", ctaText:"A more thoughtful healthcare experience starts with people. Be part of what we’re building.", ctaButton:"Get started", partner2:"Partner with us",
    footerLine:"Healing Cities Through Connected Care", footerNote:"City Healer is being developed for Delhi NCR. Features and service availability will depend on verified provider participation. AI guidance is informational and is not a medical diagnosis.",
    modalTitle:"Be part of a more connected future.", modalText:"Share a few details and tell us how you’d like to be involved.", name:"Your name", contact:"Email or phone", city:"Your city", interest:"I’m interested as a…", patient:"Patient", caregiver:"Caregiver", provider:"Healthcare provider", submit:"Submit interest", demo:"Demo only — this form does not send or store your information.", close:"Close", success:"Thank you for your interest.", successText:"This is a front-end demonstration. No information has been sent or stored.", done:"Done", choose:"Choose your city"
  },
  hi: {
    nav:["प्लेटफ़ॉर्म","कैसे काम करता है","स्वास्थ्य सेवाओं के लिए","हमारा उद्देश्य"],
    access:"शुरू करें",signin:"लॉग इन", eyebrow:"देखभाल का एक बेहतर जुड़ा हुआ तरीका",
    hero1:"स्वास्थ्य सेवाएँ,", hero2:"अब आपके और करीब।",
    heroText:"देखभाल खोजने, अपनी सेहत समझने और आपकी मदद करने वाले लोगों से जुड़े रहने की एक आसान जगह।",
    explore:"City Healer देखें", how:"जानें कैसे काम करता है", preview:"एक बेहतर अनुभव की झलक",
    previewTag:"प्रोडक्ट प्रीव्यू", wallet:"आपकी सेहत, एक जगह", walletSub:"ज़रूरी जानकारी को आसानी से समझें।",
    appointment:"देखभाल, आपके पास", appointmentSub:"अपने आसपास की सेवाएँ खोजें।",
    ai:"ज़रूरत पड़ने पर मदद", aiSub:"हिन्दी, English या Hinglish में पूछें।",
    regionEyebrow:"हमारे क्षेत्र से जुड़ा", regionTitle:"हमारे शहरों की ज़रूरतों को ध्यान में रखकर।", regionText:"हम City Healer को दिल्ली NCR के मोहल्लों, परिवारों और स्वास्थ्य सेवाओं से जुड़े लोगों को ध्यान में रखकर बना रहे हैं।", cities:["दिल्ली","गुरुग्राम","नोएडा","ग्रेटर नोएडा","गाज़ियाबाद","फरीदाबाद"],
    featureEyebrow:"एक जुड़ा हुआ अनुभव", featureTitle:"जब सब कुछ जुड़े, तो देखभाल आसान लगे।", featureText:"आपकी स्वास्थ्य यात्रा के अलग-अलग हिस्से — एक-दूसरे के करीब, लोगों को केंद्र में रखकर।",
    find:"देखभाल खोजें", findText:"डॉक्टर, अस्पताल, जाँच, फ़ार्मेसी और घर पर देखभाल की सेवाएँ एक जगह खोजें।", health:"आपका हेल्थ वॉलेट", healthText:"रिपोर्ट, प्रिस्क्रिप्शन और ज़रूरी स्वास्थ्य जानकारी व्यवस्थित रखें।", companion:"आपका AI साथी", companionText:"स्वास्थ्य जानकारी समझें और डॉक्टर से बेहतर बातचीत की तैयारी करें।", family:"अपने परिवार की देखभाल", familyText:"परिवार-केंद्रित सुविधाओं से अपनों की देखभाल में साथ दें।", network:"जुड़ा हुआ स्वास्थ्य नेटवर्क", networkText:"आपकी सेहत का साथ देने वाले लोगों और सेवाओं के लिए बेहतर जुड़ाव।",
    aiEyebrow:"आपके स्वास्थ्य का साथी", aiTitle:"आपके स्वास्थ्य से जुड़े सवालों के लिए एक समझदार साथी।", aiText:"स्वास्थ्य जानकारी समझने, सवाल व्यवस्थित करने और अगले कदमों पर विचार करने में मदद पाएँ — अपनी सहज भाषा में।", prompt1:"क्या आप इस रिपोर्ट को आसान भाषा में समझा सकते हैं?", prompt2:"मुझे डॉक्टर से क्या पूछना चाहिए?", prompt3:"मुझे किस तरह की देखभाल खोजनी चाहिए?",
    safety:"जानकारी में मदद, निदान नहीं।", safetyText:"City Healer का AI जानकारी समझने में मदद के लिए है। यह निदान या दवा नहीं देता और योग्य डॉक्टर का विकल्प नहीं है।",
    stepsEyebrow:"आगे बढ़ने का आसान तरीका", stepsTitle:"कुछ आसान कदम। देखभाल का बेहतर सफ़र।", steps:[["01","बताएँ आपको क्या चाहिए","अपने सवाल, देखभाल की ज़रूरत या स्वास्थ्य जानकारी से शुरुआत करें।"],["02","उपयुक्त सेवाएँ खोजें","अपनी ज़रूरत और चुनी हुई जगह के अनुसार सेवाएँ देखें।"],["03","ज़रूरी जानकारी साथ रखें","स्वास्थ्य से जुड़ी जानकारी एक जगह रखें ताकि ज़रूरत पर आसानी से मिले।"]],
    providerEyebrow:"स्वास्थ्य सेवाओं के साथ", providerTitle:"मिलकर, बेहतर जुड़ाव।", providerText:"हम ऐसा प्लेटफ़ॉर्म बना रहे हैं जिससे स्वास्थ्य सेवाएँ खोजना और समन्वय करना आसान हो। सभी प्रदाताओं की भागीदारी ऑनबोर्डिंग और सत्यापन पर निर्भर होगी।", providerCards:["डॉक्टर और क्लीनिक","अस्पताल","लैब और फ़ार्मेसी","होम-केयर पार्टनर"], partner:"City Healer के साथ जुड़ें",
    privacyEyebrow:"भरोसा भी डिज़ाइन का हिस्सा है", privacyTitle:"आपकी सेहत संवेदनशील देखभाल की हक़दार है।", privacy:["नियंत्रण आपके हाथ में","आपकी साझा की गई जानकारी पर स्पष्ट विकल्प।","ज़िम्मेदार AI","स्पष्ट सीमाओं के साथ उपयोगी जानकारी।","पारदर्शी जानकारी","सेवा और प्रदाता की स्थिति साफ़ होनी चाहिए।","प्राइवेसी को ध्यान में रखकर","हर अनुभव में सुरक्षा और निजता का ध्यान।"],
    ctaTitle:"आइए, देखभाल को और बेहतर जोड़ें।", ctaText:"स्वास्थ्य सेवाओं का बेहतर अनुभव लोगों से शुरू होता है। इस पहल का हिस्सा बनें।", ctaButton:"शुरू करें", partner2:"हमारे साथ जुड़ें",
    footerLine:"जुड़ी हुई देखभाल से स्वस्थ शहर", footerNote:"City Healer को दिल्ली NCR के लिए विकसित किया जा रहा है। सेवाएँ सत्यापित प्रदाताओं की भागीदारी पर निर्भर होंगी। AI जानकारी देता है, चिकित्सा निदान नहीं।",
    modalTitle:"एक बेहतर जुड़े भविष्य का हिस्सा बनें।", modalText:"कुछ जानकारी साझा करें और बताएँ कि आप कैसे जुड़ना चाहेंगे।", name:"आपका नाम", contact:"ईमेल या फ़ोन", city:"आपका शहर", interest:"आप किस रूप में जुड़ना चाहते हैं?", patient:"मरीज़", caregiver:"देखभाल करने वाले", provider:"स्वास्थ्य सेवा प्रदाता", submit:"रुचि भेजें", demo:"केवल डेमो — यह फ़ॉर्म आपकी जानकारी भेजता या सेव नहीं करता।", close:"बंद करें", success:"रुचि दिखाने के लिए धन्यवाद।", successText:"यह केवल फ्रंट-एंड डेमो है। कोई जानकारी भेजी या सेव नहीं हुई।", done:"ठीक है", choose:"शहर चुनें"
  }
};

export default function LandingPage() {
  const { locale, switchLocale, href } = useI18n();
  const navigate = useNavigate();
  const getStarted = () => navigate(href("/get-started"));
  const lang = locale;
  const setLang = (l) => switchLocale(l);
  // The original sets these on <html>; apply them only while this page is shown.
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.scrollBehavior, html.style.scrollPaddingTop, document.title];
    html.style.scrollBehavior = "smooth";
    html.style.scrollPaddingTop = window.innerWidth <= 680 ? "72px" : "90px";
    document.title = "City Healer — Healing Cities Through Connected Care";
    return () => { html.style.scrollBehavior = prev[0]; html.style.scrollPaddingTop = prev[1]; document.title = prev[2]; };
  }, []);
  const [menu,setMenu] = useState(false);
  const [modal,setModal] = useState(false);
  const [role,setRole] = useState("Patient");
  const [success,setSuccess] = useState(false);
  const [form,setForm] = useState({name:"",contact:"",city:"",interest:"Patient"});
  const t = copy[lang];
  const reduced = useReducedMotion();
  const cities = ["Delhi","Gurugram","Noida","Greater Noida","Ghaziabad","Faridabad"];
  const reveal = reduced ? {} : { initial:{opacity:0,y:24}, whileInView:{opacity:1,y:0}, viewport:{once:true,amount:.16}, transition:{duration:.7,ease:[.2,.8,.2,1]} };
  const openModal = (r="Patient") => { setRole(r); setForm(f=>({...f,interest:r})); setSuccess(false); setModal(true); };
  const closeModal = () => setModal(false);
  const scrollTo = id => { document.getElementById(id)?.scrollIntoView({behavior:reduced?"auto":"smooth"}); setMenu(false); };
  const submit = e => { e.preventDefault(); if(form.name.trim() && form.contact.trim() && form.city && form.interest) setSuccess(true); };

  return <div className="chl"><div className={lang==="hi"?"app hindi":"app"}>
    <header className="nav">
      <a className="brand" href="#top" aria-label="City Healer home"><span className="brand-mark"><HeartPulse size={19}/></span><span>city<span className="brand-light">healer</span></span></a>
      <nav className={menu?"nav-links open":"nav-links"}>
        {["platform","steps","providers","vision"].map((id,i)=><a key={id} href={"#"+id} onClick={()=>setMenu(false)}>{t.nav[i]}</a>)}
        <button className="lang-switch mobile-cta" onClick={()=>setLang(lang==="en"?"hi":"en")}><Globe2 size={15}/>{lang==="en"?"हिन्दी":"English"}</button>
        <Link className="lang-switch mobile-cta" to={href("/sign-in")}>{t.signin}</Link>
        <button className="nav-cta mobile-cta" onClick={getStarted}>{t.access}<ArrowUpRight size={15}/></button>
      </nav>
      <div className="nav-right"><button className="lang-switch desktop-lang" onClick={()=>setLang(lang==="en"?"hi":"en")}><Globe2 size={15}/>{lang==="en"?"हिन्दी":"English"}</button><Link className="lang-switch desktop-lang" to={href("/sign-in")}>{t.signin}</Link><button className="nav-cta" onClick={getStarted}>{t.access}<ArrowUpRight size={15}/></button></div>
      <button className="menu-btn" onClick={()=>setMenu(!menu)} aria-label="Toggle navigation">{menu?<X/>:<Menu/>}</button>
    </header>

    <main id="top">
      <section className="hero section-wrap">
        <motion.div className="hero-copy" {...reveal}>
          <div className="eyebrow"><span className="eyebrow-dot"/>{t.eyebrow}</div>
          <h1>{t.hero1}<br/><span>{t.hero2}</span></h1>
          <p className="hero-desc">{t.heroText}</p>
          <div className="hero-actions"><button className="button-primary" onClick={()=>scrollTo("platform")}>{t.explore}<ArrowRight size={17}/></button><button className="button-text" onClick={()=>scrollTo("steps")}>{t.how}<span>↗</span></button></div>
          <div className="hero-caption"><span className="caption-line"/>{t.preview}</div>
        </motion.div>
        <motion.div className="hero-visual" initial={reduced?false:{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} transition={{duration:1,ease:[.2,.8,.2,1]}}>
          <div className="hero-photo"><img src={photos.hero} alt="Healthcare professional speaking with a patient in a bright clinical setting" fetchPriority="high"/><div className="photo-wash"/></div>
          <motion.div className="floating-card wallet-float" animate={reduced?{}:{y:[0,-8,0]}} transition={{duration:6,repeat:Infinity,ease:"easeInOut"}}><div className="float-icon blue"><FileHeart size={17}/></div><div><b>{t.wallet}</b><small>{t.walletSub}</small></div><ArrowUpRight size={16} className="float-arrow"/></motion.div>
          <motion.div className="floating-card care-float" animate={reduced?{}:{y:[0,7,0]}} transition={{duration:5,repeat:Infinity,ease:"easeInOut",delay:.4}}><div className="float-icon green"><Heart size={17}/></div><div><b>{t.appointment}</b><small>{t.appointmentSub}</small></div></motion.div>
          <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/>
          <div className="preview-label">{t.previewTag}</div>
        </motion.div>
      </section>

      <section className="region-band" id="vision"><div className="section-wrap region-inner"><motion.div {...reveal}><div className="eyebrow">{t.regionEyebrow}</div><h2>{t.regionTitle}</h2><p>{t.regionText}</p></motion.div><div className="city-list">{t.cities.map((c,i)=><span key={c}><MapPin size={13}/>{c}</span>)}</div></div></section>

      <section className="features section-wrap" id="platform">
        <motion.div className="section-heading" {...reveal}><div className="eyebrow">{t.featureEyebrow}</div><h2>{t.featureTitle}</h2><p>{t.featureText}</p></motion.div>
        <div className="feature-grid">
          <motion.article className="feature-card feature-large" {...reveal}><div className="feature-top"><div><div className="feature-icon"><Stethoscope/></div><h3>{t.find}</h3><p>{t.findText}</p></div><ArrowUpRight className="card-arrow"/></div><div className="feature-image doctor-image"><img src={photos.doctor} alt="Doctor in a modern clinical setting" loading="lazy"/><div className="image-chip"><Activity size={14}/> Care, made easier to explore</div></div></motion.article>
          <motion.article className="feature-card health-card" {...reveal}><div className="feature-icon"><FileHeart/></div><h3>{t.health}</h3><p>{t.healthText}</p><div className="wallet-visual"><div className="wallet-top"><span>HEALTH WALLET</span><HeartPulse size={17}/></div><div className="wallet-lines"><i/><i/><i/></div><div className="wallet-bottom"><span>Reports</span><span>Prescriptions</span><span>Records</span></div></div></motion.article>
          <motion.article className="feature-card family-card" {...reveal}><div className="feature-image family-image"><img src={photos.family} alt="Family spending time together" loading="lazy"/></div><div className="feature-icon"><Users/></div><h3>{t.family}</h3><p>{t.familyText}</p></motion.article>
          <motion.article className="feature-card ai-card" {...reveal}><div className="feature-icon"><BrainCircuit/></div><h3>{t.companion}</h3><p>{t.companionText}</p><div className="ai-mini"><Sparkles size={15}/><span>{t.aiSub}</span><ArrowUpRight size={15}/></div></motion.article>
          <motion.article className="feature-card network-card" {...reveal}><div className="feature-image network-image"><img src={photos.team} alt="Healthcare professionals collaborating" loading="lazy"/></div><div className="network-caption"><div><div className="feature-icon"><HeartPulse/></div><h3>{t.network}</h3><p>{t.networkText}</p></div><ArrowUpRight className="card-arrow"/></div></motion.article>
        </div>
      </section>

      <section className="ai-section" id="ai"><div className="section-wrap ai-layout"><motion.div className="ai-copy" {...reveal}><div className="eyebrow">{t.aiEyebrow}</div><h2>{t.aiTitle}</h2><p>{t.aiText}</p><div className="ai-prompt-list"><div><Sparkles size={15}/>{t.prompt1}</div><div><Sparkles size={15}/>{t.prompt2}</div><div><Sparkles size={15}/>{t.prompt3}</div></div><div className="safety-note"><ShieldCheck size={19}/><div><b>{t.safety}</b><span>{t.safetyText}</span></div></div></motion.div>
          <motion.div className="assistant-preview" {...reveal}><div className="assistant-top"><div className="assistant-brand"><span className="assistant-orb"><Sparkles size={16}/></span><div><b>City Healer AI</b><small>Health companion preview</small></div></div><span className="preview-pill">ILLUSTRATIVE</span></div><div className="chat-thread"><div className="chat-date">A CONVERSATION STARTS HERE</div><div className="chat-bubble user-bubble">{t.prompt2}</div><div className="chat-bubble assistant-bubble"><span className="assistant-dot"><Sparkles size={13}/></span><div>मैं आपकी मदद कर सकता हूँ। अपने लक्षणों या रिपोर्ट के बारे में बताइए। मैं जानकारी समझने और डॉक्टर से पूछने वाले सवाल तैयार करने में मदद करूँगा।</div></div><div className="chat-suggestions"><span>Explain a report</span><span>Prepare questions</span></div></div><div className="chat-input"><span>Ask in English, हिन्दी or Hinglish…</span><span className="send-icon"><ArrowUpRight size={17}/></span></div></motion.div>
        </div></section>

      <section className="steps-section section-wrap" id="steps"><motion.div className="section-heading" {...reveal}><div className="eyebrow">{t.stepsEyebrow}</div><h2>{t.stepsTitle}</h2></motion.div><div className="steps-grid">{t.steps.map((s,i)=><motion.div className="step-card" key={s[0]} {...reveal}><span className="step-number">{s[0]}</span><div className="step-line"/><h3>{s[1]}</h3><p>{s[2]}</p></motion.div>)}</div></section>

      <section className="provider-section" id="providers"><div className="section-wrap provider-layout"><motion.div className="provider-copy" {...reveal}><div className="eyebrow">{t.providerEyebrow}</div><h2>{t.providerTitle}</h2><p>{t.providerText}</p><button className="button-primary" onClick={()=>openModal("Healthcare provider")}>{t.partner}<ArrowRight size={17}/></button></motion.div><div className="provider-visual"><div className="provider-photo"><img src={photos.lab} alt="Modern diagnostic laboratory" loading="lazy"/></div><div className="provider-list">{[Hospital,Stethoscope,Microscope,House].map((Icon,i)=><div key={i}><span><Icon size={17}/></span>{t.providerCards[i]}<ArrowUpRight size={15}/></div>)}</div></div></div></section>

      <section className="privacy-section section-wrap"><motion.div className="section-heading" {...reveal}><div className="eyebrow">{t.privacyEyebrow}</div><h2>{t.privacyTitle}</h2></motion.div><div className="privacy-grid">{[0,1,2,3].map((i)=><motion.div className="privacy-item" key={i} {...reveal}><span className="privacy-check"><Check size={16}/></span><div><h3>{t.privacy[i*2]}</h3><p>{t.privacy[i*2+1]}</p></div></motion.div>)}</div></section>

      <section className="closing-section"><div className="closing-photo"><img src={photos.care} alt="A healthcare professional offering compassionate care" loading="lazy"/></div><div className="closing-overlay"/><motion.div className="closing-content" {...reveal}><div className="eyebrow light-eyebrow">CITY HEALER</div><h2>{t.ctaTitle}</h2><p>{t.ctaText}</p><div className="closing-actions"><button className="button-light" onClick={getStarted}>{t.ctaButton}<ArrowRight size={17}/></button><button className="button-ghost" onClick={()=>openModal("Healthcare provider")}>{t.partner2}<ArrowUpRight size={16}/></button></div></motion.div></section>
    </main>

    <footer className="footer"><div className="section-wrap"><div className="footer-main"><div><a className="brand footer-brand" href="#top"><span className="brand-mark"><HeartPulse size={19}/></span><span>city<span className="brand-light">healer</span></span></a><p>{t.footerLine}</p></div><div className="footer-links"><a href="#platform">{t.nav[0]}</a><a href="#steps">{t.nav[1]}</a><a href="#providers">{t.nav[2]}</a><button onClick={()=>setLang(lang==="en"?"hi":"en")}>{lang==="en"?"हिन्दी":"English"}</button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} City Healer</span><p>{t.footerNote}</p></div></div></footer>

    <AnimatePresence>{modal&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget)closeModal()}}><motion.div className="modal" initial={{opacity:0,y:24,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:16}} transition={{duration:.25}} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={closeModal} aria-label={t.close}><X size={19}/></button>{success?<div className="success-state"><span className="success-icon"><Check size={25}/></span><h2>{t.success}</h2><p>{t.successText}</p><button className="button-primary" onClick={closeModal}>{t.done}<ArrowRight size={16}/></button></div>:<><div className="eyebrow">CITY HEALER · EARLY ACCESS</div><h2 id="modal-title">{t.modalTitle}</h2><p className="modal-intro">{t.modalText}</p><form onSubmit={submit}><label>{t.name}<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder={t.name}/></label><label>{t.contact}<input required value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} placeholder="name@example.com / +91…" /></label><label>{t.city}<select required value={form.city} onChange={e=>setForm({...form,city:e.target.value})}><option value="">{t.choose}</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label><label>{t.interest}<select value={form.interest} onChange={e=>setForm({...form,interest:e.target.value})}><option value="Patient">{t.patient}</option><option value="Caregiver">{t.caregiver}</option><option value="Healthcare provider">{t.provider}</option></select></label><button className="button-primary form-submit" type="submit">{t.submit}<ArrowRight size={17}/></button><small className="demo-note">{t.demo}</small></form></>}</motion.div></motion.div>}</AnimatePresence>
  </div></div>;
}

