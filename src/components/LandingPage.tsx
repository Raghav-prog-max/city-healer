import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Hospital,
  Brain,
  Activity,
  CalendarDays,
  ShieldAlert,
  ShoppingBag,
  ArrowRight,
  Ambulance,
  CheckCircle,
  Clock,
  MapPin,
  MessageSquare,
  Sparkles,
  Phone,
  Search,
  ChevronRight,
  ChevronLeft,
  Mail,
  Send,
  User,
  Heart,
  Plus,
  Compass,
  Cpu,
  FileText,
  Star,
  Users,
  TrendingUp,
  Map,
  Layers,
  HeartPulse,
  Award,
  Zap,
  Check,
  Stethoscope,
  Info,
  BookOpen,
  Menu,
  X
} from "lucide-react";

import { CardTilt } from "./animations/CardTilt";
import { CountUp } from "./animations/CountUp";
import { Marquee } from "./animations/Marquee";
import { SmoothScroll } from "./animations/SmoothScroll";

interface LandingProps {
  onNavigate: (section: string) => void;
  hospitals: any[];
  isAppDarkMode?: boolean;
}

// 9 core features aligned to V3 guidelines
const FEATURES = [
  {
    id: "ai-check",
    title: "AI Health Copilot",
    desc: "Voice + multilingual virtual triage with real-time clinical assessment, disease understanding, and certified medical matching.",
    icon: Brain,
    badge: "Gemini Pro Powered",
    color: "bg-teal-50 text-teal-700 border-teal-100",
    gradient: "from-teal-600 to-emerald-600",
    target: "symptoms"
  },
  {
    id: "bed-tracker",
    title: "Smart Hospital Network",
    desc: "Live municipal occupancy tracking for general, ICU, and ventilator beds to eliminate delay barriers inside emergencies.",
    icon: Hospital,
    badge: "Real-time Census",
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
    gradient: "from-emerald-600 to-teal-500",
    target: "beds"
  },
  {
    id: "doctor-discovery",
    title: "Doctor Discovery",
    desc: "Filter medical specialists instantly by experience, specialization, and availability with secure high-definition booking pipelines.",
    icon: Stethoscope,
    badge: "10K+ Specialist Nodes",
    color: "bg-blue-50 text-blue-700 border-blue-100",
    gradient: "from-blue-600 to-indigo-600",
    target: "consultation"
  },
  {
    id: "emergency-sos",
    title: "Emergency Response",
    desc: "One-tap SOS triggers transmitting precision GPS telemetry to mobilize nearest ambulance units and map critical routes.",
    icon: ShieldAlert,
    badge: "Immediate Dispatch",
    color: "bg-rose-50 text-rose-700 border-rose-100",
    gradient: "from-red-600 to-rose-600",
    target: "sos"
  },
  {
    id: "pharmacy",
    title: "Medicine Availability",
    desc: "Scan formulas with AI, locate nearby pharmacy stockpiles, discover generic substitutes, and schedule instant delivery.",
    icon: ShoppingBag,
    badge: "Drone & Courier",
    color: "bg-amber-50 text-amber-700 border-amber-100",
    gradient: "from-amber-500 to-orange-600",
    target: "pharmacy"
  },
  {
    id: "records",
    title: "Health Records",
    desc: "Highly encrypted digital health repository housing medical credentials, reports, and timeline views in secure storage.",
    icon: FileText,
    badge: "HIPAA Compliant",
    color: "bg-cyan-50 text-cyan-700 border-cyan-100",
    gradient: "from-cyan-500 to-blue-600",
    target: "records"
  },
  {
    id: "analytics",
    title: "City Health Analytics",
    desc: "Advanced healthcare heatmaps monitoring disease spreads, resource utilization, and regional emergency dispatch trends.",
    icon: TrendingUp,
    badge: "Predictive Intelligence",
    color: "bg-indigo-50 text-indigo-700 border-indigo-100",
    gradient: "from-indigo-600 to-cyan-600",
    target: "overview_classic"
  },
  {
    id: "insurance",
    title: "Direct Insurance Claims",
    desc: "Instantly parse insurance codings, verify policy coverages, and trigger direct, automated claim settlements.",
    icon: Compass,
    badge: "Instant Approval",
    color: "bg-purple-50 text-purple-700 border-purple-100",
    gradient: "from-purple-600 to-pink-600",
    target: "insurance"
  },
  {
    id: "diet-planner",
    title: "AI Diet Planner",
    desc: "Custom pathology-specific dietary profiles, calorie trackers, and nutritional roadmaps matching recovery trends.",
    icon: HeartPulse,
    badge: "Clinical Nutrition",
    color: "bg-sky-50 text-sky-700 border-sky-100",
    gradient: "from-sky-500 to-teal-600",
    target: "symptoms"
  }
];

// Featured Delhi/Noida/Gurugram elite hospitals
const FEATURED_HOSPITALS = [
  {
    name: "Indraprastha Apollo Grid",
    rating: "4.9 Index Score",
    city: "Sarita Vihar, Delhi",
    beds: "710 Total Beds",
    icu: "84 Vacant ICU Units",
    image: "https://images.unsplash.com/photo-1587351021355-a479a299d2f9?auto=format&fit=crop&q=80&w=800",
  },
  {
    name: "Max Super Specialty Saket",
    rating: "4.8 Index Score",
    city: "Saket District, Delhi",
    beds: "530 Total Beds",
    icu: "62 Vacant ICU Units",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800",
  },
  {
    name: "Medanta Medicity Supercore",
    rating: "4.9 Index Score",
    city: "Sector 38, Gurugram",
    beds: "1250 Total Beds",
    icu: "112 Vacant ICU Units",
    image: "https://images.unsplash.com/photo-1586773860418-d3b339f166f0?auto=format&fit=crop&q=80&w=800",
  },
  {
    name: "Manipal Critical Core Grid",
    rating: "4.7 Index Score",
    city: "Sector 6, Dwarka",
    beds: "380 Total Beds",
    icu: "45 Vacant ICU Units",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800",
  }
];

export function LandingPage({ onNavigate, hospitals, isAppDarkMode }: LandingProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [heroSearchVal, setHeroSearchVal] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const showLocalToast = (message: string, type: "success" | "info" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes("@")) {
      showLocalToast("Please enter a valid email address.", "error");
      return;
    }
    showLocalToast("Thank you for subscribing to City Healer metrics!", "success");
    setNewsletterEmail("");
  };

  // Aggregate live counters from dynamic DB
  const availableBedsCount = hospitals && hospitals.length > 0
    ? hospitals.reduce((acc, h) => acc + (h.availableBeds || 0), 0)
    : 1542;

  const vacantIcuCount = hospitals && hospitals.length > 0
    ? hospitals.reduce((acc, h) => acc + (h.icuAvailable || 0), 0)
    : 342;

  // Navigation transparency logic on scroll
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Map interactive state
  const [activeMapHospital, setActiveMapHospital] = useState({
    name: "Indraprastha Apollo Grid",
    beds: 124,
    icu: 28,
    occupancy: 68,
    ambulance: "12 Active Telemetries",
    status: "Optimal Flow",
    coords: "Sarita Vihar, New Delhi"
  });

  const MAP_HOSPITALS = [
    {
      name: "Indraprastha Apollo Grid",
      beds: 124,
      icu: 28,
      occupancy: 68,
      ambulance: "12 Active Telemetries",
      status: "Optimal Flow",
      coords: "Sarita Vihar, New Delhi",
      top: "22%",
      left: "35%"
    },
    {
      name: "Max Super Specialty Saket",
      beds: 94,
      icu: 19,
      occupancy: 74,
      ambulance: "8 Active Telemetries",
      status: "High Efficiency",
      coords: "Saket Enclave, New Delhi",
      top: "45%",
      left: "58%"
    },
    {
      name: "Medanta Medicity Supercore",
      beds: 188,
      icu: 42,
      occupancy: 61,
      ambulance: "22 Active Telemetries",
      status: "Optimal Flow",
      coords: "Sector 38, Gurugram",
      top: "72%",
      left: "40%"
    },
    {
      name: "Manipal Critical Core Grid",
      beds: 64,
      icu: 12,
      occupancy: 79,
      ambulance: "6 Active Telemetries",
      status: "Near Capacity",
      coords: "Sector 6, Dwarka",
      top: "32%",
      left: "82%"
    }
  ];

  // Testimonials state
  const [testIdx, setTestIdx] = useState(0);
  const testimonials = [
    {
      text: "City Healer completely transformed our hospital's bed response pipelines. Emergency triage latency was reduced by 60% within days.",
      author: "Dr. Sandeep Vardhan",
      role: "Director of Emergency Medicine, Apollo Delhi Grid",
      avatarBg: "bg-teal-600"
    },
    {
      text: "Securing immediate ICU allocation used to take up to an hour of calls. Now, municipal bed registers reconcile in real-time.",
      author: "Dr. Ananya Iyer",
      role: "Chief Trauma Coordinator, Max Saket Grid",
      avatarBg: "bg-emerald-600"
    },
    {
      text: "The integration of real-time diagnostics, digital health locks, and automated drone e-prescriptions delivers unparalleled continuity of care.",
      author: "Dr. Rahul Malhotra",
      role: "Lead Medical Practitioner, Medanta Systems",
      avatarBg: "bg-indigo-600"
    }
  ];

  // AI Chat Triage Simulation Widget
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: "user", text: "I have a sudden pressure and tightening behind my eyes with a moderate headache, what should I do?" },
    { id: 2, sender: "ai", text: "Analyzing indicators. Your symptoms correlate with micro-tension / sinus headache indices (91%). Let's verify: Do you have sudden blurry vision, numbness in your extremities, or difficulty speaking?" }
  ]);
  const [chatInputText, setChatInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSendChat = () => {
    if (!chatInputText.trim()) return;
    const userMsg = { id: Date.now(), sender: "user", text: chatInputText };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInputText("");
    setIsTyping(true);

    setTimeout(() => {
      let aiResponse = "Clinical parameters registered. Connecting with your local medical network. I advise checking your temperature and scheduling an e-Consultation with our next available General Practitioner.";
      if (chatInputText.toLowerCase().includes("head") || chatInputText.toLowerCase().includes("pain")) {
        aiResponse = "Reviewing symptoms. Severe localized pain without sudden ocular loss suggests non-emergency tension cycles. I have marked local neurologists on your explorer grid. Would you like to consult one?";
      } else if (chatInputText.toLowerCase().includes("icu") || chatInputText.toLowerCase().includes("bed") || chatInputText.toLowerCase().includes("hospital")) {
        aiResponse = "Bed tracker updated. There are currently 124 vacant beds at Apollo Grid and 94 at Max Saket. I can reserve an digital OPD queue token for you right now.";
      } else if (chatInputText.toLowerCase().includes("emergency") || chatInputText.toLowerCase().includes("chest") || chatInputText.toLowerCase().includes("breath")) {
        aiResponse = "⚠️ EMERGENCY PROTOCOL: Critical respiratory or cardiac symptoms detected. Please immediately trigger the 'SOS emergency call' or go to your nearest Apollo Hospital ICU Core.";
      }

      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: "ai", text: aiResponse }]);
      setIsTyping(false);
    }, 1200);
  };

  // Typing search loop
  const [searchPlaceholder, setSearchPlaceholder] = useState("");
  useEffect(() => {
    const queries = [
      "live ICU bed near Delhi...",
      "severe throat tightness symptoms...",
      "nearest open trauma pharmacy...",
      "book pediatric specialist Dwarka..."
    ];
    let queryIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timer: any;

    const tick = () => {
      const fullWord = queries[queryIndex];
      if (!isDeleting) {
        setSearchPlaceholder(fullWord.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === fullWord.length) {
          isDeleting = true;
          timer = setTimeout(tick, 2000);
          return;
        }
      } else {
        setSearchPlaceholder(fullWord.substring(0, charIndex - 1));
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          queryIndex = (queryIndex + 1) % queries.length;
          timer = setTimeout(tick, 600);
          return;
        }
      }
      timer = setTimeout(tick, isDeleting ? 30 : 70);
    };

    tick();
    return () => clearTimeout(timer);
  }, []);

  const navigate = useNavigate();

  const handleTransitionNavigate = (section: string) => {
    const sectionToPath: Record<string, string> = {
      overview: "/",
      overview_classic: "/dashboard",
      symptoms: "/symptoms",
      beds: "/hospitals",
      consultation: "/doctors",
      pharmacy: "/pharmacy",
      records: "/records",
      insurance: "/insurance",
      sos: "/sos",
      admin: "/admin"
    };
    const targetPath = sectionToPath[section] || "/";
    if ((window as any).cityHealerTransition) {
      (window as any).cityHealerTransition(targetPath);
    } else {
      navigate(targetPath);
    }
  };

  return (
    <SmoothScroll>
      <div id="landing-page-root" className={`min-h-screen font-sans antialiased overflow-x-hidden transition-colors duration-300 ${
        isAppDarkMode 
          ? "bg-slate-950 text-slate-100 selection:bg-teal-500/20 selection:text-teal-200" 
          : "bg-white text-slate-900 selection:bg-teal-600/10 selection:text-teal-900"
      }`}>
        
        {/* Floating Premium Sticky Navigation Bar */}
        <header
          id="premium-navbar"
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4 md:px-12 ${
            isScrolled
              ? isAppDarkMode 
                ? "bg-slate-950/80 border-b border-slate-900/80 shadow-md backdrop-blur-md translate-y-0" 
                : "bg-white/80 border-b border-slate-100/80 shadow-md backdrop-blur-md translate-y-0"
              : "bg-transparent border-b border-transparent translate-y-0"
          }`}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Elegant luxury brand logo */}
            <div
              id="brand-logo"
              className="flex items-center gap-2.5 cursor-pointer select-none group"
              onClick={() => handleTransitionNavigate("overview")}
            >
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-teal-900 text-white shadow-xl transition-all duration-300 group-hover:scale-105 group-hover:bg-teal-800">
                <span className="absolute inset-0 rounded-xl bg-teal-400/25 blur-md animate-ping" />
                <Activity className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <span className={`font-heading text-lg font-extrabold tracking-tight block ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                  CITY <span className={isAppDarkMode ? "text-teal-400" : "text-teal-700"}>HEALER</span>
                </span>
                <span className={`text-[9px] font-bold tracking-widest leading-none block -mt-1 uppercase ${isAppDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>Metropolitan Care OS</span>
              </div>
            </div>

            {/* Links mimicking modern premium platform directories */}
            <nav id="nav-directories" role="navigation" className={`hidden lg:flex items-center gap-7 text-xs font-semibold ${isAppDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              <span onClick={() => handleTransitionNavigate("overview")} aria-current="page" className={`cursor-pointer transition-colors relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-0.5 after:bg-teal-700 hover:after:w-full after:transition-all ${isAppDarkMode ? "hover:text-teal-400" : "hover:text-teal-800"}`}>Home</span>
              <span onClick={() => handleTransitionNavigate("overview_classic")} className={`cursor-pointer transition-colors relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-0.5 after:bg-teal-700 hover:after:w-full after:transition-all ${isAppDarkMode ? "hover:text-teal-400" : "hover:text-teal-800"}`}>Platform</span>
              <span onClick={() => handleTransitionNavigate("symptoms")} className={`cursor-pointer transition-colors relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-0.5 after:bg-teal-700 hover:after:w-full after:transition-all ${isAppDarkMode ? "hover:text-teal-400" : "hover:text-teal-800"}`}>AI Assistant</span>
              <span onClick={() => handleTransitionNavigate("beds")} className={`cursor-pointer transition-colors relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-0.5 after:bg-teal-700 hover:after:w-full after:transition-all ${isAppDarkMode ? "hover:text-teal-400" : "hover:text-teal-800"}`}>Hospitals</span>
              <span onClick={() => handleTransitionNavigate("consultation")} className={`cursor-pointer transition-colors relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-0.5 after:bg-teal-700 hover:after:w-full after:transition-all ${isAppDarkMode ? "hover:text-teal-400" : "hover:text-teal-800"}`}>Doctors</span>
              <span onClick={() => handleTransitionNavigate("sos")} className="hover:text-rose-700 cursor-pointer transition-colors relative text-rose-600 font-bold">Emergency</span>
            </nav>

            {/* Quick launch Portal */}
            <div className="flex items-center gap-4">
              <button
                id="navbar-cta-launch"
                onClick={() => handleTransitionNavigate("overview_classic")}
                className="hidden sm:block group relative cursor-pointer overflow-hidden rounded-full bg-gradient-to-r from-teal-900 to-teal-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-xl shadow-teal-900/10 transition-all hover:shadow-teal-900/20 active:scale-95 bg-teal-800"
              >
                <span className="absolute inset-0 w-1/2 -skew-x-12 bg-white/15 opacity-0 group-hover:opacity-100 transition-transform duration-[1000ms] -translate-x-[200%] group-hover:translate-x-[400%]" />
                <span className="relative flex items-center gap-1.5">
                  Launch City Healer <ChevronRight className="h-3 w-3" />
                </span>
              </button>
              <button
                id="mobile-menu-toggle"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg transition-colors border border-transparent hover:bg-slate-150/30 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
          {isMobileMenuOpen && (
            <div className={`lg:hidden mt-4 pt-4 pb-2 border-t transition-all ${
              isAppDarkMode ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-100 bg-white text-slate-600"
            }`}>
              <nav id="mobile-nav-directories" role="navigation" className="flex flex-col gap-4 text-sm font-semibold px-2">
                <span onClick={() => { handleTransitionNavigate("overview"); setIsMobileMenuOpen(false); }} className="cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-150/30 transition-colors">Home</span>
                <span onClick={() => { handleTransitionNavigate("overview_classic"); setIsMobileMenuOpen(false); }} className="cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-150/30 transition-colors">Platform</span>
                <span onClick={() => { handleTransitionNavigate("symptoms"); setIsMobileMenuOpen(false); }} className="cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-150/30 transition-colors">AI Assistant</span>
                <span onClick={() => { handleTransitionNavigate("beds"); setIsMobileMenuOpen(false); }} className="cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-150/30 transition-colors">Hospitals</span>
                <span onClick={() => { handleTransitionNavigate("consultation"); setIsMobileMenuOpen(false); }} className="cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-150/30 transition-colors">Doctors</span>
                <span onClick={() => { handleTransitionNavigate("sos"); setIsMobileMenuOpen(false); }} className="cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-150/30 transition-colors text-rose-600 font-bold">Emergency</span>
                
                <button
                  onClick={() => { handleTransitionNavigate("overview_classic"); setIsMobileMenuOpen(false); }}
                  className="sm:hidden w-full mt-2 rounded-full bg-gradient-to-r from-teal-900 to-teal-700 py-3 text-xs font-extrabold text-white shadow-md text-center"
                >
                  Launch City Healer
                </button>
              </nav>
            </div>
          )}
        </header>

        {/* Cinematic Luxury Hero Section */}
        <section
          id="hero-redesign"
          className={`relative min-h-screen flex items-center justify-center pt-32 pb-24 px-6 md:px-12 transition-colors duration-300 overflow-hidden ${
            isAppDarkMode 
              ? "bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 text-white" 
              : "bg-gradient-to-b from-teal-50/20 via-white to-slate-50/30 text-slate-900"
          }`}
        >
          {/* Subtle grid pattern backdrops */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f766e07_1px,transparent_1px),linear-gradient(to_bottom,#0f766e07_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

          {/* Glowing premium floating gradients */}
          <div className="absolute top-1/4 left-1/10 w-[350px] h-[350px] rounded-full bg-teal-400/5 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/10 w-[450px] h-[450px] rounded-full bg-emerald-400/5 blur-[150px] pointer-events-none" />

          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            {/* Left Content Side */}
            <div id="hero-left-content" className="lg:col-span-7 text-center lg:text-left space-y-8">
              {/* Premium micro pill */}
              <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide ${
                isAppDarkMode 
                  ? "border-teal-900/60 bg-teal-950/40 text-teal-300" 
                  : "border-teal-200/50 bg-teal-50/60 text-teal-800"
              }`}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600"></span>
                </span>
                AI Health OS
              </div>

              {/* Massive luxury typographic layout */}
              <h1 className={`font-heading text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] max-w-2xl mx-auto lg:mx-0 ${
                isAppDarkMode ? "text-white" : "text-slate-900"
              }`}>
                AI Healthcare <br />
                <span className={`text-transparent bg-clip-text bg-gradient-to-r italic font-serif font-medium ${
                  isAppDarkMode ? "from-teal-400 via-teal-300 to-emerald-400" : "from-teal-800 via-teal-600 to-emerald-600"
                }`}>Infrastructure</span> <br />
                for Smarter Cities.
              </h1>

              {/* Redesigned clean description text */}
              <p className={`text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 ${
                isAppDarkMode ? "text-slate-300" : "text-slate-600"
              }`}>
                City Healer unifies municipal clinical data grids, real-time bed census trackers, smart telehealth suites, and emergency dispatch systems into one intuitive digital interface.
              </p>

              {/* Interactive clinical search block */}
              <form
                id="hero-interactive-search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (heroSearchVal.trim()) {
                    navigate(`/symptoms?q=${encodeURIComponent(heroSearchVal)}`);
                  } else {
                    handleTransitionNavigate("symptoms");
                  }
                }}
                className={`max-w-xl mx-auto lg:mx-0 rounded-2xl border p-3 shadow-xl backdrop-blur-md ${
                  isAppDarkMode 
                    ? "border-slate-800 bg-slate-900/90 shadow-slate-950/40" 
                    : "border-slate-200 bg-white shadow-slate-200/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Search className="h-5 w-5 text-slate-400 shrink-0 ml-1" />
                  <input
                    type="text"
                    aria-label="Search diagnostic codes"
                    placeholder={`Search diagnostic codes: ${searchPlaceholder}`}
                    value={heroSearchVal}
                    onChange={(e) => setHeroSearchVal(e.target.value)}
                    className={`w-full bg-transparent text-sm py-1 focus:outline-none ${
                      isAppDarkMode ? "text-slate-100 placeholder-slate-500" : "text-slate-800 placeholder-slate-500"
                    }`}
                  />
                  <button
                    type="submit"
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-teal-900 hover:bg-teal-800 px-4 py-2.5 text-xs font-bold text-white transition-all cursor-pointer bg-teal-800"
                  >
                    Diagnose <Sparkles className="h-3 w-3 text-teal-300" />
                  </button>
                </div>
              </form>

              {/* Premium action buttons */}
              <div id="hero-action-buttons" className="flex flex-wrap gap-4 items-center justify-center lg:justify-start">
                <button
                  onClick={() => handleTransitionNavigate("overview_classic")}
                  className="flex items-center gap-2 rounded-xl bg-teal-900 hover:bg-teal-800 text-white font-extrabold px-7 py-4 text-sm shadow-xl shadow-teal-900/10 hover:shadow-teal-900/20 transition-all cursor-pointer bg-teal-800"
                >
                  Explore Platform <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleTransitionNavigate("consultation")}
                  className={`flex items-center gap-2 rounded-xl border font-bold px-7 py-4 text-sm transition-all shadow-sm cursor-pointer ${
                    isAppDarkMode 
                      ? "border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-100" 
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  Watch Demo Video
                </button>
              </div>
            </div>

            {/* Right Side - Clean Hardware-Accelerated Healthcare Illustration */}
            <div id="hero-right-visual" className="lg:col-span-5 relative flex items-center justify-center">
              <div className={`relative w-full max-w-md p-6 rounded-[32px] border shadow-2xl backdrop-blur-sm overflow-hidden group transition-all duration-300 ${
                isAppDarkMode 
                  ? "border-slate-800 bg-slate-900/85 shadow-slate-950/50" 
                  : "border-slate-100 bg-white/80 shadow-slate-200/60"
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-emerald-500/5 pointer-events-none" />
                
                {/* Simulated digital node indicators */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <span className="block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className={`text-[10px] uppercase tracking-wider font-extrabold ${isAppDarkMode ? "text-slate-500" : "text-slate-400"}`}>Delhi Command Grid</span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-extrabold border ${
                    isAppDarkMode ? "bg-teal-950/80 text-teal-300 border-teal-900" : "bg-teal-50 text-teal-800 border-teal-100"
                  }`}>
                    ONLINE &bull; SECURE
                  </span>
                </div>

                {/* Micro preview dashboard items */}
                <div className="space-y-4">
                  {/* Card 1 */}
                  <div className={`p-4 rounded-2xl border shadow-sm hover:translate-x-1 transition-all ${
                    isAppDarkMode ? "border-slate-800 bg-slate-950/80" : "border-slate-100 bg-white/90"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Total Live Bed Census</span>
                      <Hospital className={`h-4 w-4 ${isAppDarkMode ? "text-teal-400" : "text-teal-600"}`} />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black tracking-tight font-mono ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>{availableBedsCount}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                        <Check className="h-3 w-3" /> Reconciled
                      </span>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className={`p-4 rounded-2xl border shadow-sm hover:translate-x-1 transition-all ${
                    isAppDarkMode ? "border-slate-800 bg-slate-950/80" : "border-slate-100 bg-white/90"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Active ICU Reserve</span>
                      <Activity className={`h-4 w-4 ${isAppDarkMode ? "text-emerald-400" : "text-emerald-600"}`} />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black tracking-tight font-mono ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>{vacantIcuCount}</span>
                      <span className="text-[10px] text-teal-600 font-semibold flex items-center gap-0.5">
                        <Check className="h-3 w-3" /> Live Telemetry
                      </span>
                    </div>
                  </div>

                  {/* Card 3 - Critical SOS telemetry indicator */}
                  <div className={`p-4 rounded-2xl border shadow-sm ${
                    isAppDarkMode 
                      ? "bg-gradient-to-br from-rose-950/20 to-red-950/10 border-rose-900/50" 
                      : "bg-gradient-to-br from-rose-50 to-red-50/50 border-red-100"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide ${isAppDarkMode ? "text-rose-400" : "text-rose-700"}`}>Emergency System Status</span>
                      <Ambulance className="h-4 w-4 text-rose-600 animate-pulse" />
                    </div>
                    <p className={`text-sm font-extrabold ${isAppDarkMode ? "text-rose-300" : "text-rose-900"}`}>Ready for Immediate SOS dispatch</p>
                    <p className={`text-[9px] font-medium ${isAppDarkMode ? "text-rose-400/80" : "text-rose-600/80"}`}>Sub-8 minute response guarantee</p>
                  </div>
                </div>

                {/* Background decorative elements */}
                <div className={`mt-6 pt-4 border-t flex justify-between items-center text-[10px] ${
                  isAppDarkMode ? "border-slate-800 text-slate-500" : "border-slate-100 text-slate-400"
                }`}>
                  <span>HIPAA Compliant Security</span>
                  <span>v3.2.0 Flagship</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Infinite Logo Marquee of Partners */}
        <section id="partner-marquee-luxury" className={`border-y py-12 overflow-hidden transition-colors duration-300 ${
          isAppDarkMode ? "bg-slate-900/30 border-slate-900" : "bg-slate-50 border-slate-100"
        }`}>
          <div className="max-w-7xl mx-auto px-6 text-center mb-6">
            <span className="font-sans text-xs font-extrabold uppercase tracking-widest text-slate-400">
              TRUSTED BY REGIONAL HEALTHCARE LEADERS
            </span>
          </div>
          <Marquee items={["Indraprastha Apollo Hospital Grid", "Max Super Specialty Saket", "Medanta Supercore", "Fortis Escorts Research Center", "Manipal Critical Care", "Sir Ganga Ram Grid Systems", "Jaypee Medical Grid"]} direction="left" speed={24} />
          <div className="h-3" />
          <Marquee items={["AIIMS Delhi Core", "RML Regional Triage Grid", "Narayana Superspecialty", "Columbia Asia System Core", "Kailash Noida Core Systems", "Mata Chanan Devi Clinic"]} direction="right" speed={28} />
        </section>

        {/* About City Healer Storytelling & Animated Timeline */}
        <section id="about-story" className={`py-24 px-6 md:px-12 relative transition-colors duration-300 ${
          isAppDarkMode ? "bg-slate-950 text-white" : "bg-white text-slate-900"
        }`}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column Editorial Story */}
              <div className="lg:col-span-6 space-y-6">
                <span className={`text-xs font-black uppercase tracking-widest ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>THE METROPOLITAN OPERATING SYSTEM</span>
                <h2 className={`font-heading text-3xl md:text-5xl font-extrabold tracking-tight leading-tight ${isAppDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                  Unifying Fragmented Urban Healthcare.
                </h2>
                <p className={`text-base leading-relaxed ${isAppDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  Healthcare today is severely fragmented. Emergency services operate in isolation, hospital bed tracking is delayed, and critical records reside in inaccessible silos.
                </p>
                <p className={`text-base leading-relaxed ${isAppDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  City Healer integrates these disjointed channels into a single connected platform. By matching patient clinical conditions with local hospital live assets, we ensure optimal health accessibility in real-time.
                </p>

                {/* Animated timeline steps */}
                <div className="space-y-5 pt-4">
                  <div className="flex gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-extrabold font-mono border text-sm ${
                      isAppDarkMode ? "bg-teal-950/40 text-teal-300 border-teal-900/60" : "bg-teal-50 text-teal-700 border-teal-100"
                    }`}>
                      01
                    </div>
                    <div>
                      <h4 className={`text-sm font-extrabold ${isAppDarkMode ? "text-slate-100" : "text-slate-900"}`}>Patient Triaging</h4>
                      <p className={`text-xs ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Instant sympomatology index matching powered by secure AI engines.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-extrabold font-mono border text-sm ${
                      isAppDarkMode ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/60" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                    }`}>
                      02
                    </div>
                    <div>
                      <h4 className={`text-sm font-extrabold ${isAppDarkMode ? "text-slate-100" : "text-slate-900"}`}>Hospital Bed Matching</h4>
                      <p className={`text-xs ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Live reconciliation with municipal ICU, general, and ventilator censuses.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-extrabold font-mono border text-sm ${
                      isAppDarkMode ? "bg-blue-950/40 text-blue-300 border-blue-900/60" : "bg-blue-50 text-blue-700 border-blue-100"
                    }`}>
                      03
                    </div>
                    <div>
                      <h4 className={`text-sm font-extrabold ${isAppDarkMode ? "text-slate-100" : "text-slate-900"}`}>Secure Dispatch</h4>
                      <p className={`text-xs ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Continuous ambulance telemetry to guarantee medical accessibility.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column Editorial Image Showcase */}
              <div className="lg:col-span-6 relative flex items-center justify-center">
                <div className={`relative w-full max-w-lg aspect-[4/3] rounded-[32px] overflow-hidden shadow-2xl border transition-all duration-300 ${
                  isAppDarkMode ? "border-slate-800" : "border-slate-100"
                }`}>
                  <img
                    src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1200"
                    alt="City Healer connected clinical care platform"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />
                  
                  <div className="absolute bottom-6 left-6 right-6 text-white space-y-1 z-10">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-400">Integrated Ecosystem</span>
                    <h4 className="font-heading text-lg font-bold">Connecting Cities, Saving Lives.</h4>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Core Platform Features - Redesigned Grid */}
        <section id="platform-features" className={`py-24 px-6 md:px-12 relative transition-colors duration-300 ${
          isAppDarkMode ? "bg-slate-900/25" : "bg-slate-50"
        }`}>
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className={`text-xs font-black uppercase tracking-widest ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>
                CONNECTED SYSTEM CAPABILITIES
              </span>
              <h2 className={`font-heading text-3xl md:text-5xl font-extrabold tracking-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                A Unified Health Operating System
              </h2>
              <p className={`text-sm md:text-base leading-relaxed ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                City Healer integrates 9 major modules into an adaptive smart framework, providing instant hospital resource tracking and AI diagnosis.
              </p>
            </div>

            {/* Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.id}
                    id={`feature-card-${feat.id}`}
                    onClick={() => {
                      if (feat.id === "diet-planner") {
                        showLocalToast("AI Diet Planner coming soon — customized clinical nutritional roadmaps are currently in clinical validation.", "info");
                      } else {
                        handleTransitionNavigate(feat.target);
                      }
                    }}
                    className={`p-8 rounded-[28px] border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer ${
                      isAppDarkMode 
                        ? "border-slate-800 bg-slate-900/70 shadow-slate-950/20" 
                        : "border-slate-100 bg-white shadow-sm"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Icon with beautiful color pairing */}
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border transition-all ${
                        isAppDarkMode ? "bg-slate-950 border-slate-800 text-teal-400" : feat.color
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="space-y-2">
                        <span className={`text-[10px] font-extrabold tracking-wider uppercase block ${isAppDarkMode ? "text-teal-400" : "text-teal-650"}`}>{feat.badge}</span>
                        <h3 className={`font-heading text-lg font-bold transition-colors ${
                          isAppDarkMode ? "text-slate-100 group-hover:text-teal-400" : "text-slate-900 group-hover:text-teal-800"
                        }`}>
                          {feat.title}
                        </h3>
                        <p className={`text-xs leading-relaxed ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                          {feat.desc}
                        </p>
                      </div>
                    </div>

                    <div className={`pt-6 mt-4 border-t flex items-center justify-between text-xs font-bold transition-colors ${
                      isAppDarkMode ? "border-slate-800 text-slate-500 group-hover:text-teal-400" : "border-slate-50 text-slate-400 group-hover:text-teal-700"
                    }`}>
                      <span>Launch Module</span>
                      <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Real-time Central Command Dashboard Widget Preview */}
        <section id="central-dashboard-preview" className={`py-24 px-6 md:px-12 relative transition-colors duration-300 ${
          isAppDarkMode ? "bg-slate-950 text-white" : "bg-white text-slate-900"
        }`}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left description columns 5 */}
              <div className="lg:col-span-5 space-y-6">
                <span className={`text-xs font-black uppercase tracking-widest ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>MUNICIPAL COMMAND PREVIEW</span>
                <h2 className={`font-heading text-3xl md:text-5xl font-extrabold tracking-tight leading-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                  The Central Control Room.
                </h2>
                <p className={`text-sm md:text-base leading-relaxed ${isAppDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  A high-contrast visual snapshot showing how regional administrators inspect live critical care occupancies, active emergency signals, and physician ratings in one unified view.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-2xl border ${isAppDarkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-100 bg-slate-50"}`}>
                    <span className={`block text-2xl font-black font-mono tracking-tight ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>{availableBedsCount}</span>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Live Beds Count</span>
                  </div>
                  <div className={`p-4 rounded-2xl border ${isAppDarkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-100 bg-slate-50"}`}>
                    <span className={`block text-2xl font-black font-mono tracking-tight ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>{vacantIcuCount}</span>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Live ICU Reserves</span>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => handleTransitionNavigate("overview_classic")}
                    className="flex items-center gap-2 rounded-xl bg-teal-900 hover:bg-teal-800 text-white font-extrabold px-6 py-3.5 text-xs transition-all cursor-pointer bg-teal-800"
                  >
                    Open Live Dashboard <Compass className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Right Dashboard Mock Widget columns 7 */}
              <div className={`lg:col-span-7 rounded-[32px] border p-6 shadow-xl relative overflow-hidden transition-colors duration-300 ${
                isAppDarkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-150 bg-slate-50/50"
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none" />
                
                {/* Visual Widget Header */}
                <div className={`flex justify-between items-center pb-4 mb-6 border-b ${isAppDarkMode ? "border-slate-800" : "border-slate-200/60"}`}>
                  <div>
                    <h4 className={`font-heading text-sm font-extrabold ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>City Command Dashboard</h4>
                    <span className="text-[9px] text-slate-400 uppercase font-mono">LIVE MULTICAST FEED</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] text-slate-500 font-bold uppercase">SECURE TUNNEL ACTIVE</span>
                  </div>
                </div>

                {/* Mock Visual Grid widgets */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Widget 1 */}
                  <div className={`p-4 rounded-2xl border shadow-sm space-y-2 transition-colors ${
                    isAppDarkMode ? "bg-slate-950 border-slate-800 text-white shadow-none" : "bg-white border-slate-100 shadow-sm"
                  }`}>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Ambulance Activity</span>
                    <div className="flex justify-between items-center">
                      <span className={`text-xl font-black font-mono ${isAppDarkMode ? "text-slate-100" : "text-slate-800"}`}>14 Dispatchers</span>
                      <Ambulance className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isAppDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div className="bg-emerald-500 h-1.5 rounded-full w-2/3" />
                    </div>
                  </div>

                  {/* Widget 2 */}
                  <div className={`p-4 rounded-2xl border shadow-sm space-y-2 transition-colors ${
                    isAppDarkMode ? "bg-slate-950 border-slate-800 text-white shadow-none" : "bg-white border-slate-100 shadow-sm"
                  }`}>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">AI Consultation Index</span>
                    <div className="flex justify-between items-center">
                      <span className={`text-xl font-black font-mono ${isAppDarkMode ? "text-slate-100" : "text-slate-800"}`}>98% Efficient</span>
                      <Brain className="h-4 w-4 text-teal-600" />
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isAppDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div className="bg-teal-600 h-1.5 rounded-full w-4/5" />
                    </div>
                  </div>

                  {/* Widget 3 */}
                  <div className={`p-4 rounded-2xl border shadow-sm space-y-2 transition-colors ${
                    isAppDarkMode ? "bg-slate-950 border-slate-800 text-white shadow-none" : "bg-white border-slate-100 shadow-sm"
                  }`}>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Active Disease Spread</span>
                    <div className="flex justify-between items-center">
                      <span className={`text-md font-bold ${isAppDarkMode ? "text-slate-100" : "text-slate-800"}`}>Optimal (Sinusoidal)</span>
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>

                  {/* Widget 4 */}
                  <div className="p-4 rounded-2xl bg-gradient-to-tr from-teal-900 to-teal-800 text-white shadow-sm space-y-2">
                    <span className="text-[9px] font-bold text-teal-300 uppercase block">Civil Safety Index</span>
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-black font-mono">98.4 / 100</span>
                      <Award className="h-4 w-4 text-emerald-400" />
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* AI Triage Experience - Live Emulator Simulation */}
        <section id="ai-interactive-simulation" className={`py-24 px-6 md:px-12 relative transition-colors duration-300 ${
          isAppDarkMode ? "bg-slate-900/20" : "bg-slate-50"
        }`}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
               
              {/* Left Column Interactive Mock Chat Frame */}
              <div className="lg:col-span-6">
                <div className={`rounded-[28px] border shadow-xl max-w-md mx-auto relative overflow-hidden transition-all duration-300 ${
                  isAppDarkMode ? "border-slate-800 bg-slate-950/90 shadow-slate-950/60" : "border-slate-150 bg-white"
                }`}>
                  <div className="bg-teal-950 text-white p-4.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20">
                        <span className="absolute inset-0 rounded-xl bg-teal-400/25 animate-ping" />
                        <Brain className="h-5 w-5 text-teal-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-100 tracking-wider">AI Co-Pilot Advisor</h4>
                        <p className="text-[9px] text-emerald-400 font-semibold">Trained with HIPAA Guidelines</p>
                      </div>
                    </div>
                    <span className="text-[9px] bg-white/10 px-2.5 py-0.5 rounded-full text-slate-300 font-extrabold border border-white/5">
                      ONLINE
                    </span>
                  </div>

                  {/* Message Feed Container */}
                  <div className={`p-5 h-80 overflow-y-auto space-y-4 transition-all ${isAppDarkMode ? "bg-slate-900/60" : "bg-slate-50/50"}`}>
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                          msg.sender === "user"
                            ? `${isAppDarkMode ? "bg-slate-800 text-slate-100" : "bg-slate-200 text-slate-800"} ml-auto rounded-tr-none text-right`
                            : "bg-teal-900 text-teal-50 rounded-tl-none text-left"
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))}

                    {/* Typing bubble */}
                    {isTyping && (
                      <div className="bg-teal-900 text-teal-50 rounded-2xl rounded-tl-none max-w-[50%] p-3 text-xs flex items-center gap-1">
                        <span className="animate-bounce inline-block w-1.5 h-1.5 rounded-full bg-teal-300" />
                        <span className="animate-bounce inline-block w-1.5 h-1.5 rounded-full bg-teal-300 delay-150" />
                        <span className="animate-bounce inline-block w-1.5 h-1.5 rounded-full bg-teal-300 delay-300" />
                      </div>
                    )}
                  </div>

                  {/* Action input footer */}
                  <div className={`p-3 flex items-center gap-2 border-t transition-colors ${
                    isAppDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-white"
                  }`}>
                    <input
                      type="text"
                      aria-label="Type clinical syndromes"
                      placeholder="Type clinical syndromes (e.g. fever, headache)..."
                      value={chatInputText}
                      onChange={(e) => setChatInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendChat();
                      }}
                      className={`w-full text-xs py-2 px-3 border rounded-xl focus:outline-none transition-all ${
                        isAppDarkMode 
                          ? "bg-slate-900 border-slate-800 text-white focus:border-teal-500" 
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:border-teal-600"
                      }`}
                    />
                    <button
                      onClick={handleSendChat}
                      aria-label="Send query"
                      className="rounded-xl bg-teal-900 hover:bg-teal-800 text-white p-2.5 transition cursor-pointer"
                    >
                      <Send className="h-4 w-4 text-teal-300" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column Description */}
              <div className="lg:col-span-6 space-y-6">
                <span className={`text-xs font-black uppercase tracking-widest ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>SECURE PRE-CLINICAL TRIAGE</span>
                <h2 className={`font-heading text-3xl md:text-5xl font-extrabold tracking-tight leading-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                  Experience Triage Pathways.
                </h2>
                <p className={`text-sm md:text-base leading-relaxed ${isAppDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  Type clinical indicators inside our simulated AI Copilot panel. Experience instant diagnostic routing backed by certified HIPAA parameters.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="flex gap-3 leading-snug">
                    <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className={`text-sm font-extrabold ${isAppDarkMode ? "text-slate-100" : "text-slate-900"}`}>Pre-Surgical Risk Assessment</h4>
                      <p className={`text-xs ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Reviews historical medical factors prior to ER check-in.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 leading-snug">
                    <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className={`text-sm font-extrabold ${isAppDarkMode ? "text-slate-100" : "text-slate-900"}`}>Immediate Clinical Referrals</h4>
                      <p className={`text-xs ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Maps patient symptoms with qualified doctors inside the regional database.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => handleTransitionNavigate("symptoms")}
                    className="flex items-center gap-2 rounded-xl bg-teal-900 hover:bg-teal-800 text-white font-extrabold px-6 py-3.5 text-xs transition-all cursor-pointer bg-teal-800"
                  >
                    Open AI Symptoms Suite <Sparkles className="h-4 w-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Smart City Interactive Map Selector */}
        <section id="interactive-map-luxury" className={`py-24 px-6 md:px-12 relative transition-colors duration-300 ${
          isAppDarkMode ? "bg-slate-950 text-white" : "bg-white text-slate-900"
        }`}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column Map details */}
              <div className="lg:col-span-5 space-y-6">
                <span className={`text-xs font-black uppercase tracking-widest ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>
                  REGIONAL TELEMETRY NETWORK
                </span>
                <h2 className={`font-heading text-3xl md:text-5xl font-extrabold tracking-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                  Interactive Bed Census Explorer
                </h2>
                <p className={`text-sm md:text-base leading-relaxed ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Click on our interactive metropolitan medical pins to inspect real-time clinical occupancy thresholds and ambulance availability.
                </p>

                {/* Selected Node card detail */}
                <div className={`rounded-[24px] border p-6 space-y-4 transition-colors ${
                  isAppDarkMode ? "border-slate-850 bg-slate-900/40" : "border-slate-100 bg-slate-50"
                }`}>
                  <div className={`flex justify-between items-center border-b pb-2 ${isAppDarkMode ? "border-slate-800" : "border-slate-200"}`}>
                    <h4 className={`font-heading text-sm font-bold ${isAppDarkMode ? "text-slate-100" : "text-slate-900"}`}>{activeMapHospital.name}</h4>
                    <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-[9px] font-mono font-bold text-emerald-800 uppercase">
                      {activeMapHospital.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className={`rounded-xl p-3 border transition-colors ${isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-150"}`}>
                      <span className="block text-[8px] uppercase font-bold text-slate-400">General Beds</span>
                      <span className={`block font-heading text-lg font-black font-mono ${isAppDarkMode ? "text-slate-200" : "text-slate-800"}`}>{activeMapHospital.beds}</span>
                    </div>
                    <div className={`rounded-xl p-3 border transition-colors ${isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-150"}`}>
                      <span className="block text-[8px] uppercase font-bold text-slate-400">ICU Vacancy</span>
                      <span className={`block font-heading text-lg font-black font-mono ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>{activeMapHospital.icu}</span>
                    </div>
                    <div className={`rounded-xl p-3 border transition-colors ${isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-150"}`}>
                      <span className="block text-[8px] uppercase font-bold text-slate-400">Occupancy</span>
                      <span className="block font-heading text-lg font-black text-rose-500 font-mono">{activeMapHospital.occupancy}%</span>
                    </div>
                  </div>

                  <div className={`flex justify-between items-center text-xs pt-2 border-t ${isAppDarkMode ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-teal-600" /> {activeMapHospital.coords}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">{activeMapHospital.ambulance}</span>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => handleTransitionNavigate("beds")}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 text-white font-bold px-6 py-3.5 text-xs hover:bg-slate-800 transition cursor-pointer"
                  >
                    Open Bed Planner Census <Compass className="h-4 w-4 text-emerald-400" />
                  </button>
                </div>
              </div>

              {/* Right Column Interactive Map Frame */}
              <div className={`lg:col-span-7 h-[420px] rounded-[32px] border p-4 relative overflow-hidden transition-all duration-300 ${
                isAppDarkMode ? "border-slate-850 bg-slate-900/20" : "border-slate-200 bg-slate-50/50"
              }`}>
                <style>{`
                  @keyframes pulse-node {
                    0% { transform: scale(0.9); opacity: 0.5; }
                    50% { transform: scale(1.15); opacity: 0.2; }
                    100% { transform: scale(1.3); opacity: 0; }
                  }
                  .animate-pulse-node {
                    animation: pulse-node 2s infinite ease-out;
                  }
                `}</style>

                {/* SVG Route trails */}
                <svg className={`absolute inset-0 w-full h-full transition-colors duration-300 ${isAppDarkMode ? "text-slate-800/45" : "text-slate-200/60"}`} xmlns="http://www.w3.org/2000/svg">
                  <line x1="0" y1="120" x2="100%" y2="120" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
                  <line x1="0" y1="240" x2="100%" y2="240" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
                  <line x1="150" y1="0" x2="150" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
                  <line x1="320" y1="0" x2="320" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
                  
                  {/* Digital connecting medical network route */}
                  <path
                    d="M 150,120 C 220,180 280,60 320,240 S 440,300 480,120"
                    fill="none"
                    stroke="url(#map-path-grad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="animate-pulse"
                    style={{ animationDuration: "3s" }}
                  />

                  <defs>
                    <linearGradient id="map-path-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0f766e" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Shifting active map nodes */}
                {MAP_HOSPITALS.map((hosp, idx) => {
                  const isCur = activeMapHospital.name === hosp.name;
                  return (
                    <div
                      key={idx}
                      className="absolute cursor-pointer transition-transform duration-300 hover:scale-110 z-20"
                      style={{ top: hosp.top, left: hosp.left }}
                      onClick={() => setActiveMapHospital(hosp)}
                    >
                      <div className={`relative flex h-10 w-10 items-center justify-center rounded-full shadow-xl border transition-all ${
                        isAppDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100"
                      }`}>
                        {isCur && (
                          <div className="absolute inset-0 rounded-full border-2 border-teal-500 animate-pulse-node" />
                        )}
                        <MapPin className={`h-5 w-5 ${
                          isCur 
                            ? (isAppDarkMode ? "text-teal-400 animate-bounce" : "text-teal-700 animate-bounce") 
                            : "text-slate-400"
                        }`} />
                      </div>
                      
                      <span className={`block absolute -bottom-5 left-1/2 -translate-x-1/2 rounded bg-slate-950/90 text-[8px] font-bold text-white px-1.5 py-0.5 whitespace-nowrap transition-opacity ${isCur ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        {hosp.name.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}

                {/* Floating telemetry HUD overlay */}
                <div className={`absolute bottom-4 left-4 border p-2.5 rounded-xl backdrop-blur-md flex items-center gap-2 transition-all ${
                  isAppDarkMode ? "bg-slate-950/80 border-slate-850" : "bg-white/80 border-slate-200/80"
                }`}>
                  <div className="h-6 w-6 bg-teal-900 text-white rounded-lg flex items-center justify-center p-1 animate-spin" style={{ animationDuration: "12s" }}>
                    <Compass className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${isAppDarkMode ? "text-slate-300" : "text-slate-700"}`}>Metropolitan Map Sensor Active</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Doctor & Hospital Showcases */}
        <section id="showcase-network" className={`py-24 px-6 md:px-12 relative transition-colors duration-300 ${
          isAppDarkMode ? "bg-slate-900/15" : "bg-slate-50"
        }`}>
          <div className="max-w-7xl mx-auto space-y-16">
            
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className={`text-xs font-black uppercase tracking-widest ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>REGIONAL DIRECTORY SPOTLIGHT</span>
              <h2 className={`font-heading text-3xl md:text-5xl font-extrabold tracking-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                Partner Facilities & Certified Surgeons
              </h2>
              <p className={`text-sm md:text-base ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Discover elite critical care centers and specialized medical practitioners participating inside the regional network.
              </p>
            </div>

            {/* Hospital showcase list */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {FEATURED_HOSPITALS.map((hosp, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group overflow-hidden ${
                    isAppDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-white"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-xl h-44">
                      <img
                        src={hosp.image}
                        alt={hosp.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 left-3 bg-slate-900/85 px-2 py-1 rounded-lg text-emerald-400 flex items-center gap-1 text-[9px] font-bold">
                        <Star className="h-3 w-3 fill-emerald-400" /> {hosp.rating}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-teal-600" /> {hosp.city}
                      </span>
                      <h4 className={`font-heading text-base font-extrabold leading-snug ${isAppDarkMode ? "text-slate-100" : "text-slate-950"}`}>{hosp.name}</h4>
                      <p className={`text-[10px] font-medium ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>{hosp.beds} &bull; {hosp.icu}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTransitionNavigate("beds")}
                    className={`w-full text-center text-xs font-bold py-2.5 rounded-xl border transition-colors mt-5 cursor-pointer ${
                      isAppDarkMode 
                        ? "bg-slate-900 hover:bg-teal-900 hover:text-white border-slate-800 text-slate-300" 
                        : "bg-slate-50 hover:bg-teal-900 hover:text-white border-slate-100 text-slate-700"
                    }`}
                  >
                    Inspect Hospital Beds
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* High-Priority Emergency SOS Alert Redesign */}
        <section id="emergency-sos-pulse" className={`py-24 px-6 md:px-12 border-y relative transition-colors duration-300 ${
          isAppDarkMode 
            ? "bg-rose-950/20 border-rose-900/40 text-white" 
            : "bg-rose-50/50 border-rose-100 text-slate-900"
        }`}>
          <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
            <div className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-rose-600 shadow-lg shadow-rose-200 animate-bounce ${
              isAppDarkMode ? "bg-rose-950 border border-rose-900" : "bg-rose-100"
            }`}>
              <ShieldAlert className="h-7 w-7" />
            </div>

            <div className="space-y-3">
              <span className={`text-xs uppercase font-extrabold tracking-widest block leading-none ${
                isAppDarkMode ? "text-rose-450 text-rose-400" : "text-rose-700"
              }`}>
                ONE-TAP EMERGENCY PROTOCOL
              </span>
              <h2 className={`font-heading text-3xl md:text-5xl font-black tracking-tight leading-tight ${
                isAppDarkMode ? "text-rose-300" : "text-rose-950"
              }`}>
                Immediate Critical Telemetry Dispatch
              </h2>
              <p className={`text-sm md:text-base max-w-2xl mx-auto ${
                isAppDarkMode ? "text-rose-400/90" : "text-rose-750"
              }`}>
                Triggering the critical SOS matches your mobile GPS data with local ambulance services and secures instant clinical pathways at the nearest ICU.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center pt-2">
              <button
                onClick={() => handleTransitionNavigate("sos")}
                className="group relative cursor-pointer overflow-hidden rounded-xl bg-red-650 hover:bg-red-700 px-8 py-4 text-xs font-black text-white shadow-xl shadow-red-950/20 active:scale-95 bg-red-650 bg-red-650 text-white bg-red-600"
              >
                <span className="absolute inset-0 rounded-xl bg-red-500/25 animate-ping" />
                TRIGGER SOS TELEMETRY
              </button>
            </div>
          </div>
        </section>

        {/* Scale statistics block */}
        <section id="aggregate-statistics" className="py-24 px-6 md:px-12 bg-slate-900 text-white relative">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
              <span className="text-xs font-bold uppercase text-emerald-400 tracking-widest block">CIVIL SCALABILITY INDEX</span>
              <h2 className="font-heading text-3xl md:text-5xl font-extrabold tracking-tight">Ecosystem Growth Metrics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <CountUp value={50} suffix="+" label="Connected Grids" describe="Participating public and private healthcare facilities" icon={Hospital} />
              <CountUp value={10} suffix="K+" label="Specialist Doctors" describe="Fully certified surgeons and general practitioners" icon={Stethoscope} />
              <CountUp value={1} suffix="M+" label="Encrypted Health Records" describe="Secured patient clinical charts and prescriptions" icon={FileText} />
              <CountUp value={99} suffix="%" label="Triage Accuracy" describe="Continuous pre-clinical assessment optimizations" icon={Brain} />
            </div>
          </div>
        </section>

        {/* Premium Testimonials Crossfade Slider */}
        <section id="luxury-testimonials" className={`py-24 px-6 md:px-12 relative transition-colors duration-300 ${
          isAppDarkMode ? "bg-slate-950 text-white" : "bg-white text-slate-900"
        }`}>
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <span className={`text-xs uppercase font-extrabold tracking-widest block leading-none ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>
                CLINICAL ADVISORY BOARD REVIEWS
              </span>
              <h2 className={`font-heading text-3xl md:text-5xl font-extrabold tracking-tight text-center ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                Trusted by Leading Advisors
              </h2>
            </div>

            {/* Slider container */}
            <div className={`relative rounded-[32px] border p-8 md:p-14 shadow-xl overflow-hidden transition-all duration-300 ${
              isAppDarkMode ? "border-slate-850 bg-slate-900/30 shadow-slate-950/60" : "border-slate-100 bg-slate-50"
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none" />

              <div className="min-h-[160px] flex flex-col justify-between relative">
                {testimonials.map((test, idx) => (
                  <div
                    key={idx}
                    className={`transition-all duration-750 space-y-6 ${
                      idx === testIdx
                        ? "opacity-100 scale-100 filter blur-0 static h-auto"
                        : "opacity-0 scale-95 filter blur-xs absolute top-0 left-0 h-0 pointer-events-none overflow-hidden"
                    }`}
                  >
                    <p className={`font-sans text-base md:text-xl leading-relaxed italic ${isAppDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                      "{test.text}"
                    </p>
                    
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm ${test.avatarBg}`}>
                        {test.author.charAt(4)}
                      </div>
                      <div>
                        <h4 className={`text-sm font-extrabold leading-none ${isAppDarkMode ? "text-slate-100" : "text-slate-950"}`}>{test.author}</h4>
                        <span className={`text-[10px] ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>{test.role}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Slider nav arrows */}
              <div className={`flex gap-2 items-center justify-end mt-8 border-t pt-6 ${isAppDarkMode ? "border-slate-800" : "border-slate-200/60"}`}>
                <button
                  onClick={() => setTestIdx(p => (p === 0 ? testimonials.length - 1 : p - 1))}
                  aria-label="Previous testimonial"
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                    isAppDarkMode 
                      ? "bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300" 
                      : "bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700"
                  }`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setTestIdx(p => (p === testimonials.length - 1 ? 0 : p + 1))}
                  aria-label="Next testimonial"
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                    isAppDarkMode 
                      ? "bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300" 
                      : "bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700"
                  }`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Editorial Blog / Magazine Section */}
        <section id="magazine-section" className={`py-24 px-6 md:px-12 relative transition-colors duration-300 ${
          isAppDarkMode ? "bg-slate-900/15" : "bg-slate-50"
        }`}>
          <div className="max-w-7xl mx-auto space-y-12">
            
            {/* Header */}
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-8 transition-colors ${
              isAppDarkMode ? "border-slate-800" : "border-slate-200/60"
            }`}>
              <div className="space-y-3">
                <span className={`text-xs font-black uppercase tracking-widest block leading-none ${isAppDarkMode ? "text-teal-400" : "text-teal-700"}`}>THE CITY HEALER MAGAZINE</span>
                <h2 className={`font-heading text-3xl md:text-5xl font-extrabold tracking-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                  Medical AI & Public Health
                </h2>
              </div>
              <p className={`text-xs md:text-sm max-w-sm ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Advanced paradigms of connected clinical telemetry, municipal epidemiology, and public health infrastructure.
              </p>
            </div>

            {/* Post cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Post 1 */}
              <div onClick={() => showLocalToast("Full article coming soon — this post is under editorial review.", "info")} className="space-y-4 group cursor-pointer">
                <div className={`aspect-[16/10] overflow-hidden rounded-2xl border transition-colors ${isAppDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                  <img
                    src="https://images.unsplash.com/photo-1526256262170-66db22fe99a5?auto=format&fit=crop&q=80&w=800"
                    alt="AI Diagnostic advancements"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-2">
                  <span className={`text-[9px] uppercase tracking-wider font-extrabold ${isAppDarkMode ? "text-teal-400" : "text-teal-800"}`}>Healthcare AI</span>
                  <h4 className={`font-heading text-lg font-bold transition-colors ${isAppDarkMode ? "text-slate-100 group-hover:text-teal-400" : "text-slate-950 group-hover:text-teal-800"}`}>
                    Automating Pre-Clinical Diagnostic Triage
                  </h4>
                  <p className={`text-xs leading-relaxed ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    How large medical models and clinical parameters are combined to safely route emergency consultations.
                  </p>
                </div>
              </div>

              {/* Post 2 */}
              <div onClick={() => showLocalToast("Full article coming soon — this post is under editorial review.", "info")} className="space-y-4 group cursor-pointer">
                <div className={`aspect-[16/10] overflow-hidden rounded-2xl border transition-colors ${isAppDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                  <img
                    src="https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=800"
                    alt="Clinical bed censuses"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-2">
                  <span className={`text-[9px] uppercase tracking-wider font-extrabold ${isAppDarkMode ? "text-teal-400" : "text-teal-800"}`}>Municipal Systems</span>
                  <h4 className={`font-heading text-lg font-bold transition-colors ${isAppDarkMode ? "text-slate-100 group-hover:text-teal-400" : "text-slate-950 group-hover:text-teal-800"}`}>
                    Real-time Hospital Resource Occupancy
                  </h4>
                  <p className={`text-xs leading-relaxed ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Analyzing how real-time municipal bed registers reduce delays and eliminate paper queues across metropolitan areas.
                  </p>
                </div>
              </div>

              {/* Post 3 */}
              <div onClick={() => showLocalToast("Full article coming soon — this post is under editorial review.", "info")} className="space-y-4 group cursor-pointer">
                <div className={`aspect-[16/10] overflow-hidden rounded-2xl border transition-colors ${isAppDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                  <img
                    src="https://images.unsplash.com/photo-1504813184591-01552ffb3c46?auto=format&fit=crop&q=80&w=800"
                    alt="Epidemiology tracking models"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-2">
                  <span className={`text-[9px] uppercase tracking-wider font-extrabold ${isAppDarkMode ? "text-teal-400" : "text-teal-800"}`}>Public Health</span>
                  <h4 className={`font-heading text-lg font-bold transition-colors ${isAppDarkMode ? "text-slate-100 group-hover:text-teal-400" : "text-slate-950 group-hover:text-teal-800"}`}>
                    Predictive Models for Disease Containment
                  </h4>
                  <p className={`text-xs leading-relaxed ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    How centralized city health analytics help regional organizations coordinate and control outbreaks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final Heavy Call-To-Action (Gradient Mesh Redesign) */}
        <section
          id="final-premium-cta"
          className="py-28 relative bg-[#0F172A] text-white overflow-hidden"
          style={{
            backgroundImage: "radial-gradient(circle 600px at 50% 50%, rgba(15,118,110,0.2) 0%, #030712 100%)"
          }}
        >
          <div className="max-w-4xl mx-auto text-center space-y-10 px-6 relative z-10">
            <span className="text-xs font-black uppercase text-emerald-400 tracking-widest block leading-none">
              SECURE REGIONAL ACCESS PORTAL
            </span>
            
            <h2 className="font-heading text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-none text-white max-w-3xl mx-auto">
              The Future of Urban Healthcare Starts Here.
            </h2>

            <p className="text-slate-350 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Join thousands of clinical managers, specialists, and patients coordinating metropolitan health assets through the City Healer connected grid.
            </p>

            <div className="flex flex-wrap gap-4 items-center justify-center pt-4">
              <button
                onClick={() => handleTransitionNavigate("overview_classic")}
                className="rounded-full bg-white px-8 py-4 font-black text-slate-950 hover:bg-slate-50 transition active:scale-95 shadow-xl cursor-pointer"
              >
                Launch Platform Access
              </button>
              <button
                onClick={() => handleTransitionNavigate("consultation")}
                className="rounded-full border border-slate-700 bg-slate-900/60 hover:bg-teal-700 px-8 py-4 font-extrabold text-white transition active:scale-95 cursor-pointer"
              >
                Request Partnership Demo
              </button>
            </div>
          </div>
        </section>

        {/* 5-Column Premium Luxury Footer */}
        <footer id="magazine-footer" className="bg-slate-950 text-slate-400 py-16 border-t border-slate-900 px-6 md:px-12 relative z-30">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 border-b border-slate-900 pb-12">
            
            {/* Column 1 Logo */}
            <div className="space-y-4 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 p-2 border border-white/10 shadow">
                  <Activity className="h-5 w-5 text-emerald-400" />
                </div>
                <span className="font-heading text-md font-black tracking-tight text-white block">
                  CITY <span className="text-teal-500">HEALER</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Healing cities through automated clinical networks, real-time bed censuses, and secure pre-clinical triage.
              </p>
              <p className="text-[9px] font-mono uppercase text-teal-400 font-extrabold">
                HIPAA & SOC2 SECURE
              </p>
            </div>

            {/* Column 2 Clinical Portals */}
            <div className="space-y-4">
              <h4 className="font-heading text-xs font-bold uppercase text-white tracking-widest">Platform</h4>
              <ul className="space-y-2.5 text-xs">
                <li><span onClick={() => handleTransitionNavigate("overview_classic")} className="cursor-pointer hover:text-white transition">Active Grid System</span></li>
                <li><span onClick={() => handleTransitionNavigate("symptoms")} className="cursor-pointer hover:text-white transition">AI Diagnostic Scanner</span></li>
                <li><span onClick={() => handleTransitionNavigate("beds")} className="cursor-pointer hover:text-white transition">Live Bed Census</span></li>
                <li><span onClick={() => handleTransitionNavigate("consultation")} className="cursor-pointer hover:text-white transition">Queue Manager</span></li>
              </ul>
            </div>

            {/* Column 3 Medical Services */}
            <div className="space-y-4">
              <h4 className="font-heading text-xs font-bold uppercase text-white tracking-widest">Services</h4>
              <ul className="space-y-2.5 text-xs">
                <li><span onClick={() => handleTransitionNavigate("pharmacy")} className="cursor-pointer hover:text-white transition">e-Pharmacy Depot</span></li>
                <li><span onClick={() => handleTransitionNavigate("records")} className="cursor-pointer hover:text-white transition">Health records</span></li>
                <li><span onClick={() => handleTransitionNavigate("insurance")} className="cursor-pointer hover:text-white transition">Insurance Settlements</span></li>
                <li><span onClick={() => handleTransitionNavigate("sos")} className="cursor-pointer hover:text-white transition">Emergency dispatch</span></li>
              </ul>
            </div>

            {/* Column 4 Resources */}
            <div className="space-y-4">
              <h4 className="font-heading text-xs font-bold uppercase text-white tracking-widest">Resources</h4>
              <ul className="space-y-2.5 text-xs">
                <li><button onClick={() => showLocalToast("Coming soon — Publications are under construction.", "info")} className="hover:text-white transition text-left cursor-pointer">Publications</button></li>
                <li><button onClick={() => showLocalToast("Coming soon — Case Studies are under construction.", "info")} className="hover:text-white transition text-left cursor-pointer">Case Studies</button></li>
                <li><button onClick={() => showLocalToast("Coming soon — HIPAA Policy is under construction.", "info")} className="hover:text-white transition text-left cursor-pointer">HIPAA Policy</button></li>
                <li><button onClick={() => showLocalToast("Coming soon — Clinical FAQ is under construction.", "info")} className="hover:text-white transition text-left cursor-pointer">Clinical FAQ</button></li>
              </ul>
            </div>

            {/* Column 5 newsletter */}
            <div className="space-y-4 lg:col-span-1">
              <h4 className="font-heading text-xs font-bold uppercase text-white tracking-widest">Newsletter</h4>
              <p className="text-xs text-slate-500 leading-normal">
                Receive weekly system health metrics and municipal outbreak containment directives.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2 p-1.5 bg-white/5 border border-white/5 rounded-xl">
                <input
                  type="email"
                  aria-label="Newsletter email address"
                  placeholder="name@clinical.gov"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="bg-transparent text-xs text-slate-300 w-full focus:outline-none px-2 py-1 focus:glow"
                />
                <button type="submit" aria-label="Subscribe to newsletter" className="bg-teal-900 hover:bg-teal-800 text-white p-1.5 rounded-lg cursor-pointer">
                  <Mail className="h-4 w-4" />
                </button>
              </form>
            </div>

          </div>

          <div className="max-w-7xl mx-auto pt-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-600 gap-4">
            <p>&copy; 2026 City Healer Inc. All rights reserved. Redesigned Flagship Luxury Edition.</p>
            <div className="flex gap-6">
              <button onClick={() => showLocalToast("Coming soon — HIPAA Certified verification portal is under construction.", "info")} className="hover:text-white transition-colors cursor-pointer text-left">HIPAA Certified</button>
              <button onClick={() => showLocalToast("Coming soon — Security Directive document is under construction.", "info")} className="hover:text-white transition-colors cursor-pointer text-left">Security Directive</button>
              <button onClick={() => showLocalToast("Coming soon — Terms of Care page is under construction.", "info")} className="hover:text-white transition-colors cursor-pointer text-left">Terms of Care</button>
            </div>
          </div>
          
          {/* Global Toast Area */}
          {toast && (
            <div
              id="local-toast"
              role="status"
              aria-live="polite"
              className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in border ${
                toast.type === "success" 
                  ? "bg-emerald-950 text-emerald-100 border-emerald-800" 
                  : toast.type === "error" 
                    ? "bg-red-950 text-red-100 border-red-800" 
                    : "bg-slate-900 text-slate-100 border-slate-800"
              }`}
            >
              <span>{toast.message}</span>
            </div>
          )}
        </footer>

      </div>
    </SmoothScroll>
  );
}

export default LandingPage;
