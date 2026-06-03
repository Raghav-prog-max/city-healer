import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
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
  Star
} from "lucide-react";

import { useSplitText } from "../hooks/useSplitText";
import { CardTilt } from "./animations/CardTilt";
import { CountUp } from "./animations/CountUp";
import { Marquee } from "./animations/Marquee";
import { SmoothScroll } from "./animations/SmoothScroll";

// Register necessary plugins
gsap.registerPlugin(ScrollTrigger);

interface LandingProps {
  onNavigate: (section: string) => void;
  hospitals: any[];
}

// 8 core features of City Healer congruent with global dashboard architecture
const FEATURES = [
  {
    id: "ai-check",
    title: "AI Symptom Analyzer",
    desc: "Instant clinical triage backed by Gemini. Analyze symptoms, locate hidden indications, and match certified medical specialists automatically.",
    icon: Brain,
    color: "from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30",
    gradient: "from-cyan-500 to-blue-600",
    target: "symptoms"
  },
  {
    id: "bed-tracker",
    title: "Bed & ICU Census Grid",
    desc: "A live regional census of general, ICU, and surgical bed occupancies. Drastically reduce administrative delay barriers inside state emergencies.",
    icon: Hospital,
    color: "from-emerald-500/20 to-green-500/20 text-emerald-400 border-emerald-500/30",
    gradient: "from-emerald-500 to-green-600",
    target: "beds"
  },
  {
    id: "consultation",
    title: "e-Consultation Suite",
    desc: "Initiate secure, high-definition video and data consults with specialist practitioners. Instantly dispense authorized prescriptions.",
    icon: Activity,
    color: "from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30",
    gradient: "from-blue-500 to-indigo-600",
    target: "consultation"
  },
  {
    id: "queue-mgr",
    title: "OPD Queue Matrix",
    desc: "Acquire smart digital access tokens, check physical hospital wait-lines, and self-check-in remotely to completely escape hospital lobby queues.",
    icon: CalendarDays,
    color: "from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30",
    gradient: "from-purple-500 to-pink-600",
    target: "consultation"
  },
  {
    id: "pharmacy",
    title: "e-Pharmacy Depot",
    desc: "Upload medical prescriber logs, trigger automatic AI formula analysis, and schedule supercharged doorstep drone and courier deliveries.",
    icon: ShoppingBag,
    color: "from-amber-400/20 to-orange-500/20 text-amber-400 border-amber-400/30",
    gradient: "from-amber-500 to-orange-600",
    target: "pharmacy"
  },
  {
    id: "records",
    title: "Unified Health Records",
    desc: "Highly encrypted, verified EHR profiles storing immunization logs, histories, and diagnostics. Secure provider keys prevent unauthorized access.",
    icon: FileText,
    color: "from-teal-500/20 to-emerald-500/20 text-teal-400 border-teal-500/30",
    gradient: "from-teal-500 to-emerald-600",
    target: "records"
  },
  {
    id: "emergency-sos",
    title: "One-Tap SOS Panic Mode",
    desc: "Instantly transmit precision GPS positioning. Autonomously mobilize local ambulance telemetry and secure immediate critical-care pathways.",
    icon: ShieldAlert,
    color: "from-red-500/25 to-rose-600/20 text-rose-400 border-rose-500/30",
    gradient: "from-red-500 to-rose-600",
    target: "sos"
  },
  {
    id: "insurance",
    title: "Direct Insurance Claims",
    desc: "Verify active health policy coverage thresholds, parse insurance codings automatically, and claim direct, zero-manual invoice settlements.",
    icon: Compass,
    color: "from-indigo-500/20 to-cyan-500/20 text-indigo-400 border-indigo-500/30",
    gradient: "from-indigo-500 to-cyan-600",
    target: "insurance"
  }
];

// 6 Featured elite hospital nodes for Delhi/Noida/Gurugram showcase
const FEATURED_HOSPITALS = [
  {
    name: "Apollo Delhi Grid",
    rating: "4.8 Base Index",
    city: "Sarita Vihar, Delhi",
    stats: "710 Beds | 15 Ambulances",
    image: "https://images.unsplash.com/photo-1587351021355-a479a299d2f9?auto=format&fit=crop&q=80&w=800",
  },
  {
    name: "Max Saket Grid",
    rating: "4.7 Base Index",
    city: "Saket Area, Delhi",
    stats: "530 Beds | 12 Ambulances",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800",
  },
  {
    name: "Medanta Gurugram Grid",
    rating: "4.8 Base Index",
    city: "Sector 38, Gurugram",
    stats: "1250 Beds | 25 Ambulances",
    image: "https://images.unsplash.com/photo-1586773860418-d3b339f166f0?auto=format&fit=crop&q=80&w=800",
  },
  {
    name: "Manipal Dwarka Grid",
    rating: "4.6 Base Index",
    city: "Sector 6, Dwarka",
    stats: "380 Beds | 10 Ambulances",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800",
  },
  {
    name: "BLK-Max Rajendra Grid",
    rating: "4.6 Base Index",
    city: "Pusa Road, Delhi",
    stats: "650 Beds | 10 Ambulances",
    image: "https://images.unsplash.com/photo-1512678080530-7760d81faba6?auto=format&fit=crop&q=80&w=800",
  },
  {
    name: "Fortis Vasant Kunj Grid",
    rating: "4.6 Base Index",
    city: "Vasant Kunj, Delhi",
    stats: "200 Beds | 8 Ambulances",
    image: "https://images.unsplash.com/photo-1538108149393-fdfd812903b8?auto=format&fit=crop&q=80&w=800",
  }
];

export function LandingPage({ onNavigate, hospitals }: LandingProps) {
  // Use scroll reveal heading splits at top-level
  useSplitText(".scroll-reveal-title");

  // Extract aggregate live stats (fallback defaults built for safety)
  const availableBedsCount = hospitals && hospitals.length > 0 
    ? hospitals.reduce((acc, h) => acc + (h.availableBeds || 0), 0)
    : 1482;
    
  const vacantIcuCount = hospitals && hospitals.length > 0 
    ? hospitals.reduce((acc, h) => acc + (h.icuAvailable || 0), 0)
    : 342;

  // Refs for tracking
  const mainRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<HTMLElement>(null);
  const heroBadgeRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroSubtitleRef = useRef<HTMLParagraphElement>(null);
  const heroSearchRef = useRef<HTMLDivElement>(null);
  const heroCtasRef = useRef<HTMLDivElement>(null);
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  // Pinned Feature State refs
  const featurePinRef = useRef<HTMLDivElement>(null);
  const [activeFeatureIdx, setActiveFeatureIdx] = useState<number>(0);

  // Horizontal Hospital Showcase refs
  const horizontalPinRef = useRef<HTMLDivElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);

  // Interactive Hospital Finder Map refs & state
  const [activeMapHospital, setActiveMapHospital] = useState<any>({
    name: "Indraprastha Apollo Hospital Grid",
    beds: 112,
    icu: 18,
    occupancy: 68,
    ambulance: 15,
    status: "Optimal",
    coords: "Sector 4, Delhi"
  });

  // Testimonials Carousel slider
  const [testIdx, setTestIdx] = useState<number>(0);
  const testimonials = [
    {
      text: "City Healer completely transformed our hospital's bed response pipelines. Our emergency triage latency was reduced by 60% inside two weeks. It is incredibly trustworthy and robust.",
      author: "Dr. Sandeep Vardhan",
      role: "Director of Emergency Services, Apollo Delhi Grid"
    },
    {
      text: "Securing immediate ICU allocation for trauma patients used to take up to an hour. With City Healer, bed registers reconcile in real-time, bypassing outdated paper grids.",
      author: "Dr. Ananya Iyer",
      role: "Lead Trauma Surgeon, Max Saket Grid"
    },
    {
      text: "The e-prescriptions dashboard combined with direct e-pharmacy matching means my chronic respiratory care patients get diagnostics and medications delivered within hours.",
      author: "Dr. Rahul Malhotra",
      role: "Chief Practitioner, Medanta Health"
    }
  ];

  // AI Chat Simulation Widget State
  const [chatMessages, setChatMessages] = useState<any[]>([
    { id: 1, sender: "user", text: "I have a tight pressure feeling behind my forehead and eyes for 2 hours now, should I seek emergency triage?" },
    { id: 2, sender: "ai", text: "Analyzing symptoms. This matches localized ocular tension/migraine index (92%). Let's check: Are you experiencing sudden blindness, nausea, or slurred speech?" }
  ]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [chatInputText, setChatInputText] = useState<string>("");

  // Typing effect inside search placeholder
  const [searchPlaceholder, setSearchPlaceholder] = useState<string>("");

  // CTA background radial mouse tracker
  const ctaSectionRef = useRef<HTMLElement>(null);

  // Transition Helper to swap screens with elite sweeper transition
  const handleTransitionNavigate = (targetSection: string) => {
    // If the transition script is globally exposed by PageTransition, execute it
    if ((window as any).cityHealerTransition) {
      (window as any).cityHealerTransition(targetSection);
    } else {
      onNavigate(targetSection);
    }
  };

  // Custom typing effect loop for Hero Search Bar
  useEffect(() => {
    const phrases = [
      "severe migraine behind left eye...",
      "live general bed vacancy near Saket...",
      "is pediatric diarrhea an emergency condition...",
      "verify Max Hospital ICU unit availability..."
    ];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingTimer: any;

    const type = () => {
      const currentPhrase = phrases[phraseIndex];
      if (!isDeleting) {
        setSearchPlaceholder(currentPhrase.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === currentPhrase.length) {
          isDeleting = true;
          typingTimer = setTimeout(type, 2200); // Wait on complete phrase
          return;
        }
      } else {
        setSearchPlaceholder(currentPhrase.substring(0, charIndex - 1));
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          typingTimer = setTimeout(type, 500); // pause between phrases
          return;
        }
      }
      typingTimer = setTimeout(type, isDeleting ? 40 : 80);
    };

    type();
    return () => clearTimeout(typingTimer);
  }, []);

  // Auto-play features section in case users have restricted scrolling (e.g. in sandboxed WebViews)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeatureIdx((current) => (current + 1) % 8);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Recalculate ScrollTrigger parameters on mount/size stability
  useEffect(() => {
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Use GSAP Context for isolated, safe page timelines and ScrollTriggers
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // 1. Navbar scroll reaction
    gsap.to(navbarRef.current, {
      backdropFilter: "blur(16px)",
      backgroundColor: "rgba(15, 23, 42, 0.85)",
      borderBottomColor: "rgba(51, 65, 85, 0.5)",
      y: 0,
      duration: 0.4,
      scrollTrigger: {
        trigger: mainRef.current,
        start: "top+=80 top",
        toggleActions: "play none none reverse",
      }
    });

    // 2. Animated gradient blobs in background (Drift animation)
    const blobs = gsap.utils.toArray(".gradient-mesh-blob");
    blobs.forEach((blob: any, index: number) => {
      gsap.to(blob, {
        x: index % 2 === 0 ? "random(-150, 150)" : "random(-100, 100)",
        y: index % 2 === 0 ? "random(-100, 100)" : "random(-150, 150)",
        scale: "random(0.85, 1.25)",
        duration: 12 + index * 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    });

    // 3. Floating healthcare particles infinite upward drift
    const particles = gsap.utils.toArray(".float-particle");
    particles.forEach((particle: any, index: number) => {
      // Randomized initial scattering
      gsap.set(particle, {
        x: () => gsap.utils.random(5, 95) + "vw",
        y: () => gsap.utils.random(15, 110) + "vh",
        opacity: () => gsap.utils.random(0.2, 0.65),
        scale: () => gsap.utils.random(0.6, 1.5)
      });

      // Continuous loop floats
      gsap.to(particle, {
        y: "-15vh",
        x: `+=${gsap.utils.random(-80, 80)}`,
        duration: () => gsap.utils.random(18, 30),
        repeat: -1,
        ease: "none",
        delay: index * 0.4,
        onRepeat: () => {
          gsap.set(particle, {
            y: "115vh",
            x: gsap.utils.random(5, 95) + "vw",
            opacity: gsap.utils.random(0.2, 0.65)
          });
        }
      });
    });

    // 4. Hero section cinematic entrance master timeline
    const entranceTl = gsap.timeline();
    
    entranceTl
      .fromTo(navbarRef.current, { y: -100, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power4.out" })
      .fromTo(heroBadgeRef.current, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.5)" }, "-=0.4")
      // SplitType Title animation simulated word reveal
      .set(".hero-title-word", { y: "115%", rotate: 5 }, "-=0.2")
      .to(".hero-title-word", {
        y: "0%",
        rotate: 0,
        stagger: 0.08,
        duration: 0.95,
        ease: "power4.out",
        force3D: true
      }, "-=0.3")
      .fromTo(heroSubtitleRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, "-=0.6")
      .fromTo(heroSearchRef.current, { y: 35, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, "-=0.5")
      .fromTo(heroCtasRef.current, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.4)" }, "-=0.4")
      .fromTo(heroVisualRef.current, { x: 100, opacity: 0 }, { x: 0, opacity: 1, duration: 0.95, ease: "power4.out" }, "-=0.6")
      .fromTo(scrollIndicatorRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 });

    // Floating hero cards micro-hover
    gsap.to(".floating-hero-card", {
      y: -12,
      stagger: 0.15,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    // 5. ScrollTrigger word reveal text headings across any section title
    // Handled by top-level useSplitText hook instantiation to obey React Hook requirements.

    // 6. Section general child element stagger batching system
    ScrollTrigger.batch(".animate-item", {
      onEnter: (batch) => {
        gsap.fromTo(batch,
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.12,
            duration: 0.9,
            ease: "power3.out",
            overwrite: "auto",
            force3D: true
          }
        );
      },
      start: "top 88%",
      once: true
    });

    // 7. Pinned Sticky Features Section (400vh scroll depth)
    const activeProgressLine = document.querySelector(".feature-active-progress") as HTMLElement;
    
    gsap.timeline({
      scrollTrigger: {
        trigger: featurePinRef.current,
        start: "top top",
        end: "+=3200", // 320vh scrolling height
        pin: window.innerWidth > 1024,
        scrub: 1,
        onUpdate: (self) => {
          if (window.innerWidth <= 1024) return; // ignore scroll updates if native carousel is driving
          // Calculate which feature index between 0 and 7 is active
          const idx = Math.min(7, Math.floor(self.progress * 8));
          setActiveFeatureIdx(idx);

          // Update linear horizontal high-precision progress bar
          if (activeProgressLine) {
            activeProgressLine.style.transform = `scaleX(${self.progress})`;
          }
        }
      }
    });

    // 8. Clip-path container wipes + Image scale reveals (Ken Burns effect)
    const clipWipes = gsap.utils.toArray(".clip-wipe-card");
    clipWipes.forEach((wipe: any) => {
      const img = wipe.querySelector(".clip-wipe-img");
      
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wipe,
          start: "top 85%",
          toggleActions: "play none none none"
        }
      });

      tl.fromTo(wipe, 
        { clipPath: "inset(100% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.25, ease: "expo.out" }
      );

      if (img) {
        tl.fromTo(img, 
          { scale: 1.35 },
          { scale: 1.0, duration: 1.3, ease: "power3.out" },
          "-=1.25"
        );
      }
    });

    // 9. Horizontal Pinned Hospital Card showcase (300vh scroll depth)
    const horizontalTrack = horizontalTrackRef.current;
    if (horizontalTrack && window.innerWidth > 1024) {
      const hospitalCards = horizontalTrack.querySelectorAll(".horiz-hosp-card");
      
      // Calculate how far to scroll horizontal content
      const getScrollAmount = () => {
        return -(horizontalTrack.scrollWidth - window.innerWidth + 96);
      };

      gsap.fromTo(horizontalTrack,
        { x: 0 },
        {
          x: getScrollAmount,
          ease: "none",
          scrollTrigger: {
            trigger: horizontalPinRef.current,
            start: "top top",
            end: () => `+=${horizontalTrack.scrollWidth - window.innerWidth + 96}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              // Highlight the center card or active card with glow
              const activeIdx = Math.min(
                hospitalCards.length - 1,
                Math.round(self.progress * (hospitalCards.length - 1))
              );
              
              hospitalCards.forEach((c: any, index: number) => {
                if (index === activeIdx) {
                  c.classList.add("scale-[1.03]", "border-cyan-500", "shadow-cyan-100/30", "shadow-xl");
                  c.classList.remove("opacity-70", "scale-[0.97]");
                } else {
                  c.classList.remove("scale-[1.03]", "border-cyan-500", "shadow-cyan-100/30", "shadow-xl");
                  c.classList.add("opacity-70", "scale-[0.97]");
                }
              });
            }
          }
        }
      );
    }

    // 10. Direct SVG map routes draw automatically on scroll trigger
    gsap.fromTo(".svg-grid-route",
      { strokeDashoffset: 1200, strokeDasharray: 1200 },
      {
        strokeDashoffset: 0,
        duration: 3,
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: ".interactive-map-frame",
          start: "top 80%"
        }
      }
    );

    // 11. Custom Mouse tracking radial gradient behind CTA background
    const ctaSection = ctaSectionRef.current;
    if (ctaSection) {
      const handleCtaMouseMove = (e: MouseEvent) => {
        const rect = ctaSection.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        ctaSection.style.setProperty("--mouseX", `${mouseX}px`);
        ctaSection.style.setProperty("--mouseY", `${mouseY}px`);
      };
      ctaSection.addEventListener("mousemove", handleCtaMouseMove);
    }
  }, { scope: mainRef });

  // Handle active map hospital switches & pin coordinates
  const MAP_HOSPITALS = [
    {
      name: "Indraprastha Apollo Hospital Grid",
      beds: 112,
      icu: 18,
      occupancy: 68,
      ambulance: 15,
      status: "Optimal Capacity",
      coords: "Sarita Vihar, Delhi",
      top: "45%",
      left: "30%"
    },
    {
      name: "Max Saket Grid Systems",
      beds: 85,
      icu: 15,
      occupancy: 71,
      ambulance: 12,
      status: "Optimal Capacity",
      coords: "Press Enclave, Saket",
      top: "62%",
      left: "48%"
    },
    {
      name: "Medanta Medicity Super Grid",
      beds: 180,
      icu: 22,
      occupancy: 62,
      ambulance: 25,
      status: "Highly Efficient",
      coords: "Sector 38, Gurugram",
      top: "78%",
      left: "70%"
    },
    {
      name: "Manipal Dwarka Critical Core",
      beds: 52,
      icu: 10,
      occupancy: 74,
      ambulance: 10,
      status: "Optimal Capacity",
      coords: "Sector 6, Dwarka",
      top: "25%",
      left: "75%"
    }
  ];

  // AI Chat handler simulator
  const handleSendChatMessage = () => {
    if (!chatInputText.trim()) return;

    // Save user message
    const updatedMessages = [
      ...chatMessages,
      { id: Date.now(), sender: "user", text: chatInputText }
    ];
    setChatMessages(updatedMessages);
    setChatInputText("");
    setIsTyping(true);

    // Simulated medical triage responses matching standard triggers
    setTimeout(() => {
      let automatedRes = "Emergency protocol triggered: System has catalogued physical symptom indices and is matching with local emergency units. Click 'TRIGGER IMMEDIATE SOS' if you feel sudden crushing severe chest pressure, radiating arm numbness, or severe difficulty breathing.";
      if (chatInputText.toLowerCase().includes("head") || chatInputText.toLowerCase().includes("migraine")) {
        automatedRes = "Reviewing clinical headache thresholds. Localized ocular pressure with sub-3 hour onset patterns rarely demand telemetry codes. Advise checking heart rate and requesting consultation with neuro specialists via the 'Online Consultations' panel.";
      } else if (chatInputText.toLowerCase().includes("book") || chatInputText.toLowerCase().includes("bed") || chatInputText.toLowerCase().includes("hospital")) {
        automatedRes = "Connecting directly to hospital census indexes. There are currently 112 vacant beds at Indraprastha Apollo Hospital and 85 at Max Saket. I can queue a virtual OPD token for you instantly!";
      }

      setChatMessages(prev => [
        ...prev,
        { id: Date.now() + 1, sender: "ai", text: automatedRes }
      ]);
      setIsTyping(false);
    }, 1800);
  };

  return (
    <SmoothScroll>
      <div
        ref={mainRef}
        className="relative min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased overflow-x-hidden"
      >
        {/* Scroll Progress Indicator bar */}
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#0EA5E9] to-[#22C55E] z-[10000] scale-x-0 origin-left feature-active-progress" />

        {/* 20 Floaters Particle Field */}
        <div ref={particlesRef} className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          {Array.from({ length: 22 }).map((_, i) => (
            <div
               key={i}
               className="float-particle absolute rounded-full bg-[#0EA5E9]/10 blur-[1px]"
               style={{
                 width: gsap.utils.random(3, 7) + "px",
                 height: gsap.utils.random(3, 7) + "px"
               }}
            />
          ))}
        </div>

        {/* 1. TOP NAV - FIXED & TRANSPARENT */}
        <nav
          ref={navbarRef}
          className="fixed left-0 right-0 top-0 z-[990] flex items-center justify-between border-b border-white/5 bg-white/70 backdrop-blur-md px-6 py-4.5 transition-all duration-300 md:px-12"
          style={{ transform: "translateY(-100px)", opacity: 0 }}
        >
          {/* Logo Brand with custom heartbeat glow */}
          <div className="group flex items-center gap-2.5 cursor-pointer select-none">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F172A] p-2 border border-slate-700/60 shadow-lg transition-transform duration-500 hover:scale-110">
              {/* Heartbeat pulse glow ring */}
              <span className="absolute inset-0 rounded-xl bg-cyan-400/30 opacity-0 blur-sm animate-ping group-hover:opacity-100" />
              <Activity className="h-6 w-6 text-[#0EA5E9] animate-pulse" />
            </div>
            <div>
              <span className="font-heading text-lg font-black tracking-wider text-[#0F172A]">
                CITY <span className="text-[#22C55E]">HEALER</span>
              </span>
              <p className="text-[9px] text-[#0EA5E9] font-semibold tracking-widest leading-none">CONNECTED GRID</p>
            </div>
          </div>

          {/* Nav list - stagger fade-in targets */}
          <div className="hidden items-center gap-8 text-sm font-semibold text-slate-300 md:flex">
            {[
              { label: "Explorer Grid", target: "overview_classic" },
              { label: "Symptom AI", target: "symptoms" },
              { label: "Bed Census", target: "beds" },
              { label: "Telehealth", target: "consultation" },
              { label: "e-Pharmacy", target: "pharmacy" },
              { label: "Records", target: "records" }
            ].map((link, i) => (
              <span
                key={i}
                onClick={() => handleTransitionNavigate(link.target)}
                className="cursor-pointer transition-colors hover:text-white"
              >
                {link.label}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTransitionNavigate("overview_classic")}
              className="group relative cursor-pointer overflow-hidden rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#22C55E] px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-500/15"
            >
              {/* Shimmer sweep */}
              <span className="absolute inset-0 w-1/2 -skew-x-12 bg-white/20 opacity-0 group-hover:opacity-100 transition-transform duration-[1200ms] -translate-x-[200%] group-hover:translate-x-[400%]" />
              <span className="relative flex items-center gap-1">
                Access Portal <ChevronRight className="h-3 w-3" />
              </span>
            </button>
          </div>
        </nav>

        {/* 2. CINEMATIC HERO SECTION */}
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F172A] pb-16 pt-32 text-white">
          {/* SVG Skyline Silhouette at bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-10 w-full translate-y-1 overflow-hidden pointer-events-none opacity-15">
            <svg viewBox="0 0 1440 200" className="w-full h-auto text-[#0EA5E9]">
              <path fill="currentColor" d="M0,192L48,165.3C96,139,192,85,288,85.3C384,85,480,139,576,144C672,149,768,107,864,106.7C960,107,1056,149,1152,149.3C1248,149,1344,107,1392,85.3L1440,64L1440,200L1392,200C1344,200,1248,200,1152,200C1056,200,960,200,864,200C768,200,672,200,576,200C480,200,384,200,288,200C192,200,96,200,48,200L0,200Z"></path>
            </svg>
          </div>

          {/* Drifting Background Radial Blobs */}
          <div className="absolute inset-0 z-0">
            <div className="gradient-mesh-blob absolute -left-12 top-24 h-[420px] w-[420px] rounded-full bg-[#0EA5E9]/12 blur-[80px]" />
            <div className="gradient-mesh-blob absolute right-24 bottom-12 h-[500px] w-[500px] rounded-full bg-[#22C55E]/10 blur-[90px]" />
            <div className="gradient-mesh-blob absolute left-1/3 top-1/2 h-[350px] w-[350px] rounded-full bg-indigo-500/8 blur-[70px]" />
          </div>

          <div className="container relative z-20 mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Hero text side - columns 7 */}
            <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
              {/* Badge pill */}
              <div ref={heroBadgeRef} className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/5 px-4 py-1.5 text-xs font-bold tracking-wide text-cyan-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                Active Regional Clinical Grid
              </div>

              {/* Title with overflow-hidden word mask clips */}
              <h1
                ref={heroTitleRef}
                className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl leading-none"
              >
                <div className="overflow-hidden inline-block mr-3">
                  <span className="hero-title-word inline-block transform-gpu">Your</span>
                </div>
                <div className="overflow-hidden inline-block mr-3 text-transparent bg-clip-text bg-gradient-to-r from-[#0EA5E9] to-[#22C55E]">
                  <span className="hero-title-word inline-block transform-gpu font-serif italic text-cyan-300">Health,</span>
                </div>
                <br />
                <div className="overflow-hidden inline-block mr-3">
                  <span className="hero-title-word inline-block transform-gpu">Connected</span>
                </div>
                <div className="overflow-hidden inline-block mr-3">
                  <span className="hero-title-word inline-block transform-gpu">and</span>
                </div>
                <div className="overflow-hidden inline-block text-[#22C55E]">
                  <span className="hero-title-word inline-block transform-gpu font-black">Accessible.</span>
                </div>
              </h1>

              {/* Subtitle */}
              <p
                ref={heroSubtitleRef}
                className="max-w-2xl text-base text-slate-300 md:text-lg mx-auto lg:mx-0 leading-relaxed font-sans"
              >
                Integrating metropolitan clinical records, real-time hospital bed occupancies, emergency ambulance dispatch telemetry, and instant AI diagnostics into a single interface.
              </p>

              {/* Interactive typing search bar */}
              <div
                ref={heroSearchRef}
                className="mx-auto block max-w-xl rounded-2xl border border-slate-700/60 bg-slate-900/60 p-2.5 shadow-xl shadow-black/30 backdrop-blur-md lg:mx-0"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-slate-400 shrink-0 ml-2" />
                  <input
                    type="text"
                    placeholder={`Ask AI symptomatology: ${searchPlaceholder}`}
                    className="w-full bg-transparent text-sm py-1.5 focus:outline-none text-slate-200 placeholder-slate-400 font-sans"
                    onFocus={() => handleTransitionNavigate("symptoms")}
                  />
                  <button
                    onClick={() => handleTransitionNavigate("symptoms")}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-blue-600 px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
                  >
                    Diagnose <Sparkles className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div ref={heroCtasRef} className="flex flex-wrap gap-4 pt-2 items-center justify-center lg:justify-start">
                <button
                  onClick={() => handleTransitionNavigate("overview_classic")}
                  className="flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-black text-slate-900 shadow-xl transition-all hover:bg-slate-50 hover:-translate-y-0.5 active:scale-95"
                >
                  Enter Dynamic Grid
                  <ArrowRight className="h-4 w-4 text-slate-950" />
                </button>
                
                {/* Emergency SOS with ring pulse expansion mechanics */}
                <button
                  onClick={() => handleTransitionNavigate("sos")}
                  className="group relative flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-600/10 px-7 py-3.5 text-sm font-extrabold text-red-400 hover:bg-red-600/20 shadow-lg shadow-red-950/20"
                >
                  {/* Expanding red pulse ring waves (3 ring system) */}
                  <span className="absolute inset-0 rounded-xl bg-red-500/25 animate-ping z-0 scale-95" />
                  <span className="absolute inset-0 rounded-xl bg-red-400/15 animate-ping scale-110 z-0 delay-300" style={{ animationDelay: "300ms", animationDuration: "1.8s" }} />
                  <span className="absolute inset-0 rounded-xl bg-red-500/10 animate-ping scale-125 z-0 delay-700" style={{ animationDelay: "700ms", animationDuration: "2s" }} />
                  
                  <Ambulance className="relative h-4 w-4 text-red-500 animate-bounce group-hover:scale-110" />
                  <span className="relative">TRIGGER SOS EMERGENCY</span>
                </button>
              </div>

            </div>

            {/* Hero Right Visual Column - columns 5 */}
            <div ref={heroVisualRef} className="lg:col-span-5 relative flex items-center justify-center w-full">
              <div className="relative w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900/40 p-5 shadow-2xl backdrop-blur-md overflow-hidden group">
                {/* Outer decorative ring */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 pointer-events-none" />
                
                {/* Simulated Grid Feed Container */}
                <span className="absolute top-4 right-4 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>

                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400">
                      <Cpu className="h-5 w-5 animate-spin" style={{ animationDuration: "8s" }} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider">Live Regional Pulse</h4>
                      <p className="text-[10px] text-slate-400">Updating 14 regional health grids</p>
                    </div>
                  </div>

                  {/* Micro dashboard cards */}
                  <div className="floating-hero-card rounded-2xl bg-slate-950/60 p-4 border border-slate-800/80 shadow">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Vacant Bed Pool</span>
                      <Hospital className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black font-mono tracking-tight text-white">{availableBedsCount}</p>
                    <p className="text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle className="h-2 w-2" /> Unified active census pool
                    </p>
                  </div>

                  <div className="floating-hero-card rounded-2xl bg-slate-950/60 p-4 border border-slate-800/80 shadow">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Active ICU Reserve</span>
                      <Activity className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <p className="text-2xl font-black font-mono tracking-tight text-white">{vacantIcuCount}</p>
                    <p className="text-[9px] text-cyan-400 font-semibold flex items-center gap-1">
                      <Clock className="h-2 w-2" /> Reconciled 2 min ago
                    </p>
                  </div>

                  <div className="floating-hero-card rounded-2xl bg-gradient-to-r from-red-600/30 to-rose-700/20 p-4 border border-red-500/40 shadow-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] uppercase font-bold text-red-300">Ambulance Telemetry</span>
                      <Ambulance className="h-3.5 w-3.5 text-red-400 animate-pulse" />
                    </div>
                    <p className="text-xl font-bold text-white leading-none">Emergency System Ready</p>
                    <p className="text-[9px] text-red-300/80 font-medium mt-1">One tap matches nearest crew</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Bouncing scroll indicator */}
          <div
            ref={scrollIndicatorRef}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-1 text-xs text-slate-500 cursor-pointer pointer-events-none select-none"
          >
            <span>Scroll to Explore</span>
            <span className="block h-5 w-3.5 rounded-full border border-slate-600 relative overflow-hidden flex items-start justify-center text-center">
              <span className="block h-1.5 w-1 bg-[#0EA5E9] rounded-full animate-bounce mt-1" />
            </span>
          </div>
        </section>

        {/* 3. INFINITE LOGO PARTNER MARQUEE */}
        <section className="bg-white border-y border-slate-100 py-10">
          <div className="container mx-auto px-6 text-center mb-5">
            <span className="font-heading text-xs font-bold uppercase tracking-widest text-slate-400">
              TRUSTED REGIONAL ECOSYSTEM PARTNERS
            </span>
          </div>
          <Marquee items={["Indraprastha Apollo", "Max Saket Grid", "Medanta Health", "Fortis Escorts Care", "Manipal Core Systems", "BLK-Max Rajendra", "Sir Ganga Ram Grid", "Columbia Asia System"]} direction="left" speed={28} />
          <Marquee items={["AIIMS Delhi Core", "Jaypee Grid Systems", "Mata Chanan Devi Clinic", "St. Stephens Hospital", "Narayana Superspeciality", "Kailash Noida Core", "RML Emergency Triage"]} direction="right" speed={32} />
        </section>

        {/* 4. STATS COUNTER SECTION WITH COMPLETE RADIAL GLOW */}
        <section className="py-24 bg-gradient-to-br from-[#F8FAFC] to-slate-50 relative">
          <div className="container mx-auto px-6 md:px-12">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-black uppercase text-[#0EA5E9] tracking-widest">
                AGGREGATE SCALABILITY INDEX
              </span>
              <h2 className="scroll-reveal-title font-heading text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl leading-tight">
                Healthcare Powered By Network Effects
              </h2>
              <p className="text-sm text-slate-500">
                Eliminating municipal waiting queues, administrative deadlocks, and dispatch latencies to protect civil life systems.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <CountUp value={50} suffix="+" label="Partner Grid Hospitals" describe="Participating premium diagnostic grids" icon={Hospital} />
              <CountUp value={10} suffix="K+" label="Registered Surgeons" describe="Fully certified specialist practitioners" icon={User} />
              <CountUp value={1} suffix="M+" label="Encrypted Active Profiles" describe="Protected HIPAA compliant health records" icon={FileText} />
              <CountUp value={24} suffix="/7" label="Telehealth Dispatch availability" describe="Automated AI triage and backup dispatch" icon={Clock} />
            </div>
          </div>
        </section>

        {/* 5. PINNED DUAL STICKY FEATURES (400vh pin sequence) */}
        <section ref={featurePinRef} className="relative min-h-screen bg-[#0F172A] text-white flex items-center overflow-hidden z-10">
          <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center h-full max-h-[85vh]">
            
            {/* Left Column - Pinned dynamic descriptor text - columns 6 */}
            <div className="lg:col-span-6 space-y-6 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 px-3 py-1 text-xs font-bold text-cyan-300">
                <Cpu className="h-3.5 w-3.5 animate-spin" /> Deep Clinical Integration
              </div>
              
              <div className="space-y-3 relative min-h-[300px] lg:min-h-[220px]">
                {FEATURES.map((feat, index) => (
                  <div
                    key={feat.id}
                    className={`lg:absolute lg:inset-0 relative flex flex-col justify-center space-y-4 transition-all duration-500 ${
                      index === activeFeatureIdx
                        ? "opacity-100 translate-y-0 filter blur-0 scale-100 z-10 block"
                        : "opacity-0 translate-y-10 filter blur-sm scale-95 pointer-events-none -z-10 hidden lg:flex"
                    }`}
                  >
                    <span className="font-heading font-mono text-[#22C55E] text-sm tracking-widest uppercase">
                      INTEGRATED MODULE 0{index + 1}
                    </span>
                    <h3 className="font-heading text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                      {feat.title}
                    </h3>
                    <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                      {feat.desc}
                    </p>
                    <div>
                      <button
                        onClick={() => handleTransitionNavigate(feat.target)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-bold hover:bg-slate-700 transition"
                      >
                        Access Dashboard <ArrowRight className="h-3 opacity-80" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress counter pill indicator */}
              <div className="flex items-center gap-3 pt-6 border-t border-slate-800/80 overflow-hidden">
                {FEATURES.map((_, index) => (
                  <span
                    key={index}
                    onClick={() => setActiveFeatureIdx(index)}
                    className={`cursor-pointer block h-2.5 rounded-full transition-all duration-300 ${
                      index === activeFeatureIdx
                        ? "w-8 bg-[#0EA5E9]"
                        : "w-2.5 bg-slate-700 hover:bg-slate-500"
                    }`}
                  />
                ))}
                <span className="text-xs font-mono font-bold text-slate-500 ml-4">
                  0{activeFeatureIdx + 1} / 08
                </span>
              </div>
            </div>

            {/* Right Column - Slide scale-in icon / illustration - columns 6 */}
            <div className="lg:col-span-6 relative flex items-center justify-center h-full min-h-[300px]">
              <div className="relative w-full max-w-md h-[340px] rounded-3xl border border-slate-700/85 bg-slate-950/60 flex items-center justify-center p-6 shadow-2xl relative overflow-hidden group">
                {/* Background active shifting hue radial glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10" />

                {/* Live screen vectors */}
                {FEATURES.map((feat, index) => {
                  const IconComponent = feat.icon;
                  return (
                    <div
                      key={feat.id}
                      className={`absolute flex flex-col items-center justify-center space-y-4 h-full w-full transition-all duration-700 ${
                        index === activeFeatureIdx
                          ? "opacity-100 scale-100 rotate-0 translate-x-0"
                          : "opacity-0 scale-75 rotate-12 translate-x-32 pointer-events-none hidden lg:flex"
                      }`}
                    >
                      <div className={`inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-900 border ${feat.color} shadow-lg shadow-black/40`}>
                        <IconComponent className="h-12 w-12 animate-pulse" />
                      </div>
                      
                      <div className="text-center px-4 max-w-sm">
                        <h4 className="font-heading text-lg font-extrabold text-white">{feat.title}</h4>
                        <p className="text-[10px] text-[#22C55E] uppercase font-mono tracking-wider font-semibold mt-1">
                          SYSTEM PROTOCOL ACTIVE
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </section>

        {/* 6. INTERACTIVE MAP FINDER GRID */}
        <section className="py-24 bg-white relative z-20 shadow-xl shadow-slate-900/5">
          <div className="container mx-auto px-6 md:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left text side - columns 5 */}
              <div className="lg:col-span-5 space-y-6">
                <span className="text-xs font-black uppercase text-[#22C55E] tracking-widest">
                  REGIONAL EMERGENCY DISPATCH MAPS
                </span>
                <h2 className="scroll-reveal-title font-heading text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl leading-tight">
                  Real-time Bed Allocation Networks
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Click on our interactive regional nodes map pins to verify bed census metrics, critical-care vacant reserves, and live transport queues instantly.
                </p>

                {/* Live selected hospital popup specifications */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-inner space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <h4 className="font-heading text-sm font-bold text-[#0F172A]">{activeMapHospital.name}</h4>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[9px] font-mono font-bold text-emerald-700 uppercase">
                      {activeMapHospital.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm">
                      <span className="block text-[8px] uppercase font-bold text-slate-400">General Vacant</span>
                      <span className="block font-heading text-lg font-black text-slate-800 tracking-tight font-mono">{activeMapHospital.beds}</span>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm">
                      <span className="block text-[8px] uppercase font-bold text-slate-400">ICU Reserve</span>
                      <span className="block font-heading text-lg font-black text-[#0EA5E9] tracking-tight font-mono">{activeMapHospital.icu}</span>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm">
                      <span className="block text-[8px] uppercase font-bold text-slate-400">Occupancy</span>
                      <span className="block font-heading text-lg font-black text-rose-500 tracking-tight font-mono">{activeMapHospital.occupancy}%</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-[#0EA5E9]" /> {activeMapHospital.coords}</span>
                    <span className="flex items-center gap-1"><Ambulance className="h-3.5 w-3.5 text-[#22C55E]" /> {activeMapHospital.ambulance} Dispatchers</span>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => handleTransitionNavigate("beds")}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 text-white font-bold px-6 py-3.5 text-xs hover:bg-slate-800 transition"
                  >
                    Launch Full Bed Planner <Compass className="h-4 w-4 text-[#22C55E]" />
                  </button>
                </div>
              </div>

              {/* Right interactive illustration side - columns 7 */}
              <div className="lg:col-span-7 interactive-map-frame rounded-3xl border border-slate-200/80 bg-slate-50/60 p-4 h-[420px] shadow-sm relative overflow-hidden">
                <style>{`
                  @keyframes pulse-ring {
                    0% { transform: scale(0.95); opacity: 0.6; }
                    50% { transform: scale(1.1); opacity: 0.2; }
                    100% { transform: scale(1.2); opacity: 0; }
                  }
                  .animate-pulse-ring {
                    animation: pulse-ring 2s infinite ease-out;
                  }
                `}</style>
                
                {/* SVG Mock Map Grid */}
                <svg className="absolute inset-0 w-full h-full text-slate-200" xmlns="http://www.w3.org/2000/svg">
                  {/* Decorative Grid Lines */}
                  <line x1="0" y1="100" x2="100%" y2="100" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
                  <line x1="0" y1="220" x2="100%" y2="220" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
                  <line x1="0" y1="340" x2="100%" y2="340" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
                  <line x1="120" y1="0" x2="120" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
                  <line x1="280" y1="0" x2="280" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
                  <line x1="440" y1="0" x2="440" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />

                  {/* Intersecting diagnostic signal pathway (The custom route line) */}
                  <path
                    d="M 120,220 C 180,100 240,340 280,220 S 440,340 440,100"
                    fill="none"
                    stroke="url(#route-grad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="svg-grid-route"
                  />

                  {/* Gradient definition */}
                  <defs>
                    <linearGradient id="route-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0EA5E9" />
                      <stop offset="100%" stopColor="#22C55E" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Shifting active map pins */}
                {MAP_HOSPITALS.map((hosp, i) => {
                  const isCurMatch = activeMapHospital.name.includes(hosp.name.split(" ")[0]);
                  return (
                    <div
                      key={i}
                      className="absolute cursor-pointer transition-transform duration-300 hover:scale-110 z-20"
                      style={{ top: hosp.top, left: hosp.left }}
                      onClick={() => setActiveMapHospital(hosp)}
                    >
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xl border border-slate-100">
                        {/* Shimmer pulse rings on selected map pin */}
                        {isCurMatch && (
                          <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-pulse-ring" />
                        )}
                        <MapPin className={`h-5 w-5 ${isCurMatch ? "text-[#0EA5E9] animate-bounce" : "text-slate-400"}`} />
                      </div>
                      
                      {/* Interactive label tag */}
                      <span className={`block absolute -bottom-5 left-1/2 -translate-x-1/2 rounded bg-slate-900/90 text-[8px] font-bold text-white px-1.5 py-0.5 whitespace-nowrap transition-opacity ${isCurMatch ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        {hosp.name.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}

                {/* Floating compass label overlay */}
                <div className="absolute bottom-4 left-4 bg-white/70 border border-slate-200 p-2.5 rounded-xl backdrop-blur-md flex items-center gap-2">
                  <div className="h-6.5 w-6.5 bg-gradient-to-tr from-[#0EA5E9] to-[#22C55E] flex items-center justify-center text-white rounded-lg p-1 animate-spin" style={{ animationDuration: "12s" }}>
                    <Compass className="h-4 w-4" />
                  </div>
                  <span className="text-[9px] font-black uppercase text-slate-700 tracking-wider">Metropolitan Map Sensor Active</span>
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* 7. PINNED HORIZONTAL HOSPITALS SHOWCASE (300vh pin sequence) */}
        <section ref={horizontalPinRef} className="relative min-h-screen bg-[#0F172A] text-white flex flex-col justify-center overflow-hidden">
          <div className="container mx-auto px-6 md:px-12 py-12">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-black uppercase text-[#0EA5E9] tracking-widest">
                REGIONAL HOSPITAL NETWORK
              </span>
              <h2 className="scroll-reveal-title font-heading text-2xl font-black text-white md:text-5xl tracking-tight leading-tight">
                Explore Partner Health Facilities
              </h2>
              <p className="text-slate-400 text-xs md:text-sm font-sans">
                Scroll down to swipe through regional certified medical facilities participating inside the City Healer grid network.
              </p>
            </div>
          </div>

          {/* Horizontal scroll track with high-fidelity swipe fallback */}
          <div className="w-full overflow-x-auto lg:overflow-x-visible pb-4 select-none scrollbar-thin scrollbar-thumb-slate-800/85 scrollbar-track-transparent">
            <div
              ref={horizontalTrackRef}
              className="flex gap-8 px-6 md:px-12 py-10 w-max"
              style={{ willChange: "transform" }}
            >
              {FEATURED_HOSPITALS.map((hosp, i) => (
                <div
                  key={i}
                  className="horiz-hosp-card w-[290px] md:w-[350px] shrink-0 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-inner flex flex-col justify-between transition-all duration-300 relative group overflow-hidden opacity-100 lg:opacity-70 scale-[0.97]"
                >
                {/* Visual Glass overlays reflection */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 pointer-events-none z-10" />

                <div className="relative overflow-hidden rounded-xl h-44 mb-4 z-0">
                  {/* Parallax Image container */}
                  <img
                    src={hosp.image}
                    alt={hosp.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800 backdrop-blur-md text-[#22C55E] flex items-center gap-1 text-[9px] font-bold z-10">
                    <Star className="h-3 w-3 fill-[#22C55E]" /> {hosp.rating}
                  </div>
                </div>

                <div className="space-y-2 relative z-20">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-cyan-400" /> {hosp.city}
                  </span>
                  <h3 className="font-heading text-lg font-extrabold text-white leading-snug tracking-tight">
                    {hosp.name}
                  </h3>
                  <p className="text-[10px] text-slate-300 font-medium">
                    {hosp.stats}
                  </p>
                </div>

                <div className="mt-5 border-t border-slate-800 pt-4 relative z-20">
                  <button
                    onClick={() => handleTransitionNavigate("beds")}
                    className="w-full text-center text-xs font-bold py-2 rounded-xl bg-slate-800 hover:bg-[#0EA5E9] hover:text-white transition-colors cursor-pointer"
                  >
                    Inspect Hospital census
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

          {/* Scrolling horizontal status hint bar */}
          <div className="container mx-auto px-6 md:px-12 text-right pb-10 text-xs text-slate-500 font-mono">
            <span>DRAG SCROLL DOWN TO PROGRESS HORIZONTALLY →</span>
          </div>
        </section>

        {/* 8. AI CO-PILOT CHAT SECTION */}
        <section className="py-24 bg-[#F8FAFC] relative z-20 shadow-xl shadow-slate-900/5">
          <div className="container mx-auto px-6 md:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column - Live Simulated Chat Frame - columns 6 */}
              <div className="lg:col-span-6 animate-item">
                <CardTilt className="rounded-3xl border border-slate-200 bg-white shadow-xl max-w-md mx-auto relative overflow-hidden">
                  <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#0EA5E9]/15 border border-[#0EA5E9]/45">
                        <span className="absolute inset-0 rounded-xl bg-cyan-400/35 animate-ping" />
                        <Brain className="h-5 w-5 text-[#0EA5E9]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">AI Co-Pilot Advisor</h4>
                        <p className="text-[9px] text-[#22C55E] font-semibold">Trained with HIPAA Guidelines</p>
                      </div>
                    </div>
                    <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-md text-slate-400 font-bold border border-white/5">
                      SENSORS 100%
                    </span>
                  </div>

                  {/* Messages Feed body */}
                  <div className="p-5 h-80 overflow-y-auto space-y-4 bg-slate-50 relative">
                    {chatMessages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-slate-250 text-slate-800 ml-auto rounded-tr-none border border-slate-250"
                            : "bg-slate-900 text-slate-100 rounded-tl-none border border-slate-800 text-left"
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))}

                    {/* Typing dots indicators */}
                    {isTyping && (
                      <div className="bg-slate-900 text-slate-100 rounded-2xl rounded-tl-none border border-slate-800 max-w-[50%] p-3 text-xs flex items-center gap-1 text-left">
                        <span className="animate-bounce inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span className="animate-bounce inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 delay-150" style={{ animationDelay: "150ms" }} />
                        <span className="animate-bounce inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 delay-300" style={{ animationDelay: "300ms" }} />
                        <span className="text-[10px] text-slate-400 ml-1.5">Checking protocols...</span>
                      </div>
                    )}
                  </div>

                  {/* Input field Footer */}
                  <div className="border-t border-slate-100 p-3 bg-white flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Type symptoms or diagnostics query..."
                      value={chatInputText}
                      onChange={(e) => setChatInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendChatMessage();
                      }}
                      className="w-full bg-slate-50 text-xs py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={handleSendChatMessage}
                      className="rounded-xl bg-slate-900 hover:bg-cyan-500 hover:text-white p-2 text-slate-400 transition cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </CardTilt>
              </div>

              {/* Right Column - Explain side - columns 6 */}
              <div className="lg:col-span-6 space-y-6">
                <span className="text-xs font-black uppercase text-[#0EA5E9] tracking-widest">
                  AI-POWERED INSTANT TRIAGE
                </span>
                <h2 className="scroll-reveal-title font-heading text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl leading-tight">
                  Simulate Triage Insights
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Type clinical syndromes inside our active AI emulator component to experience Gemini-powered diagnostic pathways dynamically. Backed by medical parameters to secure appropriate emergency responses.
                </p>

                {/* Bullets mapping */}
                <div className="space-y-4 pt-2">
                  <div className="flex gap-3 leading-snug">
                    <CheckCircle className="h-5 w-5 text-[#22C55E] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Pre-Clinical Screening Analysis</h4>
                      <p className="text-xs text-slate-500">Auto-evaluates diagnostic factors prior to emergency room arrival.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 leading-snug">
                    <CheckCircle className="h-5 w-5 text-[#22C55E] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Immediate Specialized Routing</h4>
                      <p className="text-xs text-slate-500">Identifies condition indicators and directly connects specialists in seconds.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => handleTransitionNavigate("symptoms")}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 text-white font-bold px-6 py-3.5 text-xs hover:bg-[#0EA5E9] transition"
                  >
                    Open AI Symptoms Assistant <Sparkles className="h-4 w-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 9. PREMIUM TESTIMONIALS WITH CAROUSEL CROSSFADE */}
        <section className="py-24 bg-[#0F172A] text-white relative z-20 shadow-xl">
          <div className="container mx-auto px-6 md:px-12">
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="text-center space-y-2">
                <span className="text-xs uppercase font-mono font-bold text-[#22C55E] tracking-widest">
                  CLINICAL CASE REVIEWS
                </span>
                <h2 className="scroll-reveal-title font-heading text-3xl font-black md:text-5xl tracking-tight leading-none text-white">
                  Trusted by Elite Doctors
                </h2>
              </div>

              {/* Slider wrapper inside clean frame */}
              <div className="relative rounded-3xl border border-slate-800 bg-slate-950/60 p-8 md:p-14 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-transparent pointer-events-none" />

                <div className="min-h-[160px] flex flex-col justify-between relative">
                  {testimonials.map((test, index) => (
                    <div
                      key={index}
                      className={`transition-all duration-700 space-y-6 ${
                        index === testIdx
                          ? "opacity-100 scale-100 filter blur-0 static h-auto"
                          : "opacity-0 scale-95 filter blur-xs absolute top-0 left-0 h-0 pointer-events-none overflow-hidden"
                      }`}
                    >
                      <p className="font-sans text-lg md:text-2xl text-slate-200 leading-relaxed italic">
                        "{test.text}"
                      </p>
                      
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-slate-800 text-cyan-400 rounded-full flex items-center justify-center font-bold text-sm">
                          {test.author.charAt(4)}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white leading-none">{test.author}</h4>
                          <span className="text-[10px] text-slate-400">{test.role}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Arrow navigation handles */}
                <div className="flex gap-2 items-center justify-end mt-8 border-t border-slate-800/80 pt-6">
                  <button
                    onClick={() => setTestIdx(p => (p === 0 ? testimonials.length - 1 : p - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 hover:bg-[#0EA5E9] hover:border-transparent transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setTestIdx(p => (p === testimonials.length - 1 ? 0 : p + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 hover:bg-[#0EA5E9] hover:border-transparent transition-all cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 10. HEAVY CTA CALL-TO-ACTION SECTION WITH MOUSE GRADIENT RADIUS TRACKING */}
        <section
          ref={ctaSectionRef}
          className="py-28 relative z-20 bg-[#0F172A] text-white overflow-hidden"
          style={{
            background: "radial-gradient(circle 500px at var(--mouseX, 50%) var(--mouseY, 50%), rgba(14,165,233,0.18) 0%, #0F172A 100%)"
          }}
        >
          <div className="container mx-auto px-6 md:px-12 relative z-10 text-center space-y-10 max-w-4xl">
            <span className="text-xs font-black uppercase text-[#22C55E] tracking-widest leading-none">
              SECURE REGIONAL SYSTEM ACCESS
            </span>
            
            <h2 className="scroll-reveal-title font-heading text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-none text-white max-w-3xl mx-auto">
              Ready to Connect Your Smart City?
            </h2>

            <p className="text-slate-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed font-sans">
              Join thousands of clinical managers, specialists, and patients who coordinate care directly through the City Healer digital network.
            </p>             <div className="flex flex-wrap gap-4 items-center justify-center pt-4">
              <button
                onClick={() => handleTransitionNavigate("overview_classic")}
                className="rounded-xl bg-white px-8 py-4 font-black text-slate-950 hover:bg-slate-50 transition active:scale-95 shadow-xl"
              >
                Launch Unified Platform
              </button>
              <button
                onClick={() => handleTransitionNavigate("consultation")}
                className="rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-[#0EA5E9] px-8 py-4 font-extrabold text-white transition active:scale-95"
              >
                Schedule Triage Consult demo
              </button>
            </div>
          </div>
        </section>

        {/* 11. PREMIUM CUSTOM FOOTER */}
        <footer className="relative z-30 bg-slate-950 text-slate-400 py-16 border-t border-slate-900">
          <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-slate-900 pb-12">
            
            {/* Box 1 Logo */}
            <div className="space-y-4.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 p-2 border border-white/10 shadow">
                  <Activity className="h-5 w-5 text-[#22C55E]" />
                </div>
                <span className="font-heading text-md font-black tracking-wider text-white">
                  CITY <span className="text-[#0EA5E9]">HEALER</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Healing cities through automated networks, real-time metrics trackers, and secure diagnostic portals.
              </p>
              <p className="text-[10px] font-mono uppercase text-[#0EA5E9] font-bold">
                HIPAA & SOC2 SECURED
              </p>
            </div>

            {/* Box 2 Columns Links */}
            <div className="space-y-3.5">
              <h4 className="font-heading text-xs font-bold uppercase text-white tracking-widest">Clinical Portals</h4>
              <ul className="space-y-2 text-xs">
                <li><span onClick={() => handleTransitionNavigate("overview_classic")} className="cursor-pointer hover:text-white transition">Active Grid System</span></li>
                <li><span onClick={() => handleTransitionNavigate("symptoms")} className="cursor-pointer hover:text-white transition">AI Diagnostic Scanner</span></li>
                <li><span onClick={() => handleTransitionNavigate("beds")} className="cursor-pointer hover:text-white transition">Available Bed Census</span></li>
                <li><span onClick={() => handleTransitionNavigate("consultation")} className="cursor-pointer hover:text-white transition">OPD Token Queue</span></li>
              </ul>
            </div>

            {/* Box 3 Columns Links */}
            <div className="space-y-3.5">
              <h4 className="font-heading text-xs font-bold uppercase text-white tracking-widest">Medical Services</h4>
              <ul className="space-y-2 text-xs">
                <li><span onClick={() => handleTransitionNavigate("pharmacy")} className="cursor-pointer hover:text-white transition">e-Pharmacy Depot</span></li>
                <li><span onClick={() => handleTransitionNavigate("records")} className="cursor-pointer hover:text-white transition">Verified Records</span></li>
                <li><span onClick={() => handleTransitionNavigate("insurance")} className="cursor-pointer hover:text-white transition">Insurance Settlements</span></li>
                <li><span onClick={() => handleTransitionNavigate("sos")} className="cursor-pointer hover:text-white transition">Emergency Dispatch</span></li>
              </ul>
            </div>

            {/* Box 4 newsletter */}
            <div className="space-y-3.5">
              <h4 className="font-heading text-xs font-bold uppercase text-white tracking-widest">Newsletter dispatch</h4>
              <p className="text-xs text-slate-500 leading-normal">
                Receive weekly clinical system telemetry and system maintenance protocols.
              </p>
              <div className="flex gap-2 p-1 bg-white/5 border border-white/5 rounded-xl">
                <input
                  type="email"
                  placeholder="name@clinical.gov"
                  className="bg-transparent text-xs text-slate-300 w-full focus:outline-none px-2 py-1.5 focus:glow"
                />
                <button className="bg-[#0EA5E9] hover:bg-[#22C55E] text-white p-1.5 rounded-lg cursor-pointer">
                  <Mail className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

          </div>

          <div className="container mx-auto px-6 md:px-12 pt-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-600 gap-4">
            <p>&copy; 2026 City Healer Inc. All rights reserved. Healing Cities Through Connected Care.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">HIPAA Compliance</a>
              <a href="#" className="hover:text-white transition-colors">Privacy Principles</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Triage</a>
            </div>
          </div>
        </footer>

      </div>
    </SmoothScroll>
  );
}

export default LandingPage;
