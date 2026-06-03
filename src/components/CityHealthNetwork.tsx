import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";
import { 
  Building, 
  MapPin, 
  Activity, 
  TrendingUp, 
  Ambulance, 
  Heart, 
  AlertTriangle, 
  Users, 
  Sparkles, 
  Search, 
  ChevronRight, 
  ShieldAlert, 
  Compass, 
  Phone,
  Droplet,
  Wind,
  Info,
  Layers,
  ArrowRight,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ChefHat,
  ShoppingBag,
  Plus,
  Trash2,
  Camera,
  Apple,
  ShoppingCart,
  Zap,
  Award,
  User,
  Dumbbell
} from "lucide-react";

// Definitions of cities and local networks
export interface CitySubNetwork {
  name: string;
  subregions: string[];
  baseScore: number;
  aqi: number;
  bedsMax: number;
  bedsAvail: number;
  ambulances: number;
  doctorsOnline: number;
  outbreakZones: { name: string; level: "Critical" | "Warning" | "Stable" }[];
  contacts: { label: string; phone: string }[];
}

export const CITIES_DATA: Record<string, CitySubNetwork> = {
  Delhi: {
    name: "Delhi Capital",
    subregions: [
      "Central Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi", 
      "New Delhi", "North East Delhi", "North West Delhi", "South East Delhi", "South West Delhi", "Shahdara"
    ],
    baseScore: 84,
    aqi: 285,
    bedsMax: 1450,
    bedsAvail: 342,
    ambulances: 48,
    doctorsOnline: 125,
    outbreakZones: [
      { name: "COVID Spikes", level: "Stable" },
      { name: "Dengue Zone (Central)", level: "Warning" },
      { name: "Air Pollution (West & Shahdara)", level: "Critical" }
    ],
    contacts: [
      { label: "Delhi Central Helpline", phone: "102" },
      { label: "AIIMS Trauma", phone: "011-26593162" },
      { label: "Women Safety Cell", phone: "1091" }
    ]
  },
  Gurugram: {
    name: "Gurugram",
    subregions: ["DLF Phase 1-5", "Sohna Road", "Golf Course Road", "Sector 14", "Sector 56", "Sector 62", "Manesar", "New Gurugram"],
    baseScore: 92,
    aqi: 145,
    bedsMax: 980,
    bedsAvail: 295,
    ambulances: 34,
    doctorsOnline: 94,
    outbreakZones: [
      { name: "Water-borne (Sohna)", level: "Warning" },
      { name: "Flu Outbreaks", level: "Stable" }
    ],
    contacts: [
      { label: "Medanta Emergency", phone: "0124-4141414" },
      { label: "Fortis Core Desk", phone: "0124-4962200" },
      { label: "Gurugram Police helpline", phone: "100" }
    ]
  },
  Noida: {
    name: "Noida",
    subregions: ["Sector 18", "Sector 62", "Sector 75", "Sector 137", "Greater Noida Zone", "Knowledge Park", "Pari Chowk"],
    baseScore: 90,
    aqi: 198,
    bedsMax: 850,
    bedsAvail: 182,
    ambulances: 26,
    doctorsOnline: 68,
    outbreakZones: [
      { name: "Dengue Zone (Sec 62)", level: "Warning" },
      { name: "Particulate Exposure", level: "Warning" }
    ],
    contacts: [
      { label: "Max Vaishali Desk", phone: "0120-4173000" },
      { label: "Noida Authority Helpline", phone: "1800-180-5145" }
    ]
  },
  "Greater Noida": {
    name: "Greater Noida",
    subregions: ["Alpha sectors", "Beta sectors", "Gamma sectors", "Delta sectors", "Knowledge Park I-III", "Pari Chowk Hub"],
    baseScore: 88,
    aqi: 162,
    bedsMax: 620,
    bedsAvail: 144,
    ambulances: 18,
    doctorsOnline: 49,
    outbreakZones: [
      { name: "Flu clusters (Alpha)", level: "Stable" }
    ],
    contacts: [
      { label: "GIMS Noida Hub", phone: "0120-2341738" },
      { label: "Sharda ICU Control", phone: "0120-2329700" }
    ]
  },
  Ghaziabad: {
    name: "Ghaziabad",
    subregions: ["Indirapuram", "Vaishali", "Kaushambi", "Raj Nagar", "Crossing Republik", "Vasundhara"],
    baseScore: 81,
    aqi: 310,
    bedsMax: 780,
    bedsAvail: 98,
    ambulances: 15,
    doctorsOnline: 39,
    outbreakZones: [
      { name: "Severe AQI Warning", level: "Critical" },
      { name: "Dengue Hotspots (Raj Nagar)", level: "Warning" }
    ],
    contacts: [
      { label: "Yashoda Emergency", phone: "0120-2750000" },
      { label: "Max Vaishali Core", phone: "0120-4182500" }
    ]
  },
  Faridabad: {
    name: "Faridabad",
    subregions: ["Old Faridabad", "NIT Sector 1-5", "Ballabgarh", "Sector 15 Bypass", "Sector 21 Complex", "Sector 37 Ind. Area"],
    baseScore: 79,
    aqi: 260,
    bedsMax: 650,
    bedsAvail: 112,
    ambulances: 12,
    doctorsOnline: 31,
    outbreakZones: [
      { name: "Water Contamination Risk", level: "Warning" },
      { name: "Industrial Asthma Hotspots", level: "Warning" }
    ],
    contacts: [
      { label: "Amrita Hospital Desk", phone: "0129-2851234" },
      { label: "Faridabad Med Command", phone: "108" }
    ]
  }
};

// Deterministic helper to generate subregion health parameters and indices
export const getSubregionRiskData = (subName: string, baseAqi: number): { aqi: number; dengue: number; flu: number } => {
  let hash = 0;
  for (let i = 0; i < subName.length; i++) {
    hash += subName.charCodeAt(i);
  }
  
  // AQI varies around the base AQI
  const localAqi = Math.round(baseAqi - 25 + (hash % 51));
  
  // Dengue risk scale 0.0 - 10.0
  const localDengueIndex = Number(((hash % 6) + (subName.length % 4) * 1.5).toFixed(1));
  
  // Flu rate peak percentage 20% - 95%
  const localFluRate = (hash % 56) + 30;
  
  return {
    aqi: localAqi,
    dengue: localDengueIndex,
    flu: localFluRate
  };
};

export default function CityHealthNetwork() {
  const [selectedCity, setSelectedCity] = useState<string>("Gurugram");
  const [activeTab, setActiveTab2] = useState<"dashboard" | "heatmap" | "routing" | "feed" | "women-senior" | "nutrition">("dashboard");
  
  // Custom toast notification system
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "warning">("success");
  const toastTimeoutRef = useRef<any>(null);

  const triggerToast = (msg: string, type: "success" | "info" | "warning" = "success") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Custom interactive simulation states
  const [routingSource, setRoutingSource] = useState<string>("Noida");
  const [routingSeverity, setRoutingSeverity] = useState<"Critical" | "Standard">("Critical");
  const [simulatedRoute, setSimulatedRoute] = useState<any | null>(null);
  
  // Custom safety module triggers and alerts
  const [bloodAlertFound, setBloodAlertFound] = useState<boolean>(false);
  const [sosStatusTriggered, setSosStatusTriggered] = useState<boolean>(false);
  
  // Rankings scores manipulation state
  const [scoreWeight, setScoreWeight] = useState<number>(50); // 50 means balanced weight on AQI vs clinical capacity

  // AI Nutrition & Recovery Hub States
  const [nutritionSubTab, setNutritionSubTab] = useState<"ayurdiet" | "builder" | "logger" | "recovery" | "grocery" | "weekly">("ayurdiet");
  const [ayurDietCondition, setAyurDietCondition] = useState<string>("Diabetes");
  const [ayurDietPreference, setAyurDietPreference] = useState<string>("Veg");
  const [isAyurDietLoading, setIsAyurDietLoading] = useState<boolean>(false);
  const [ayurDietPlanResult, setAyurDietPlanResult] = useState<any | null>(null);

  const handleAyurDietCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAyurDietLoading(true);
    setAyurDietPlanResult(null);
    try {
      const plan = await api.getDietPlan(ayurDietCondition, ayurDietPreference);
      setAyurDietPlanResult(plan);
    } catch (err: any) {
      console.error("Failed to fetch AyurDiet plan in CHN:", err);
    } finally {
      setIsAyurDietLoading(false);
    }
  };

  const [nutritionAge, setNutritionAge] = useState<string>("29");
  const [nutritionGender, setNutritionGender] = useState<string>("Female");
  const [nutritionHeight, setNutritionHeight] = useState<string>("164");
  const [nutritionWeight, setNutritionWeight] = useState<string>("60");
  const [nutritionActivity, setNutritionActivity] = useState<string>("Active Exercise Routine");
  const [nutritionPreference, setNutritionPreference] = useState<string>("Indian Vegetarian");
  const [nutritionSelectedDiseases, setNutritionSelectedDiseases] = useState<string[]>(["Diabetes Support", "Low-Sodium BP Support"]);
  const [nutritionWaterLogged, setNutritionWaterLogged] = useState<number>(1.5); // Liters
  const [nutritionLoggedMeals, setNutritionLoggedMeals] = useState<Array<{ id: number; hour: string; label: string; cal: number; protein: number; source: string }>>([
    { id: 1, hour: "08:30 AM", label: "Oatmeal & Almonds", cal: 320, protein: 12, source: "Builder preset" },
    { id: 2, hour: "01:15 PM", label: "Moong Dal & Paneer Bhurji with 2 Rotis", cal: 480, protein: 26, source: "Builder preset" }
  ]);
  
  // Smart Meal Photo Logger Simulation Simulation states
  const [selectedPresetPhoto, setSelectedPresetPhoto] = useState<string | null>(null);
  const [customUploadedPhoto, setCustomUploadedPhoto] = useState<string | null>(null);
  const [photoAnalysisResult, setPhotoAnalysisResult] = useState<any | null>(null);
  const [isPhotoAnalysing, setIsPhotoAnalysing] = useState<boolean>(false);
  
  // Grocery Checklist Tracker State
  const [groceryCheckedItems, setGroceryCheckedItems] = useState<string[]>([]);

  // Recovery Engine Active Core
  const [activeRecoveryProtocol, setActiveRecoveryProtocol] = useState<string | null>("Dengue Recovery");
  const [recoveryTipsAcknowledged, setRecoveryTipsAcknowledged] = useState<string[]>([]);

  // Cognitive Meal Photo Vision analysis dynamic simulation state handler
  const handleAnalyzeMealPhoto = (photoName: string) => {
    setIsPhotoAnalysing(true);
    setPhotoAnalysisResult(null);
    setTimeout(() => {
      setIsPhotoAnalysing(false);
      let detectedDish = "Samosa & Sweet Tea";
      let cal = 480;
      let prot = 4;
      let feedback = "High fat and refined carb content detected. Might trigger GERD/Acidity warnings. Keep portion size small.";
      
      const lower = photoName.toLowerCase();
      if (lower.includes("paneer") || lower.includes("salad")) {
        detectedDish = "Organic Cucumber, Paneer & Pomegranate Salad Combo";
        cal = 285;
        prot = 19;
        feedback = "Excellent high-protein recovery dish! Abundant trace minerals and low glycemic carbs, supports metabolic insulin balance.";
      } else if (lower.includes("chicken") || lower.includes("rice")) {
        detectedDish = "Pan-cooked Chicken Breast with Brown Basmati Rice";
        cal = 490;
        prot = 34;
        feedback = "Stellar lean muscle booster. Contains essential amino acids. Keep dietary sodium level monitored close to plan.";
      } else if (lower.includes("fruit") || lower.includes("seed")) {
        detectedDish = "Tropical Mixed Fruit Bowl with Chia seed sprinkle";
        cal = 195;
        prot = 5;
        feedback = "High fiber and rich antioxidants. Perfect lightweight breakfast supporting gut digestion tracking benchmarks.";
      } else {
        // Fallback for custom uploaded files
        detectedDish = `Custom Uploaded Dish: ${photoName}`;
        cal = 310;
        prot = 12;
        feedback = "Visual analysis mapped moderate protein-carb ratio. Verified safe for core wellness recovery supports.";
      }
      setPhotoAnalysisResult({ detectedDish, cal, prot, feedback });
    }, 1205);
  };

  // Heatmap overlays state
  const [showAqiOverlay, setShowAqiOverlay] = useState<boolean>(true);
  const [showDengueOverlay, setShowDengueOverlay] = useState<boolean>(true);
  const [showFluOverlay, setShowFluOverlay] = useState<boolean>(false);
  const [heatmapScanActive, setHeatmapScanActive] = useState<boolean>(false);
  const [selectedSubregion, setSelectedSubregion] = useState<string | null>(null);

  // Dynamic factors for City Health Score simulation
  const [customAqi, setCustomAqi] = useState<number>(150);
  const [customBedsAvail, setCustomBedsAvail] = useState<number>(300);
  const [customAmbulances, setCustomAmbulances] = useState<number>(35);

  const currentCity = CITIES_DATA[selectedCity] || CITIES_DATA.Delhi;

  // Sync custom inputs to the chosen city defaults when the city updates
  useEffect(() => {
    const city = CITIES_DATA[selectedCity] || CITIES_DATA.Delhi;
    setCustomAqi(city.aqi);
    setCustomBedsAvail(city.bedsAvail);
    setCustomAmbulances(city.ambulances);
  }, [selectedCity]);

  // Dynamic factors breakdown metrics:
  // 1. Bed Availability Weight (Max 35 pts)
  const bedPct = customBedsAvail / (currentCity.bedsMax || 1000);
  const bedScore = Math.min(35, Math.max(0, Math.round(bedPct * 35)));

  // 2. Ambulance Response Time (Max 30 pts)
  // Low ambulances = high response time. e.g. 1 ambulance = 25 minutes, 80 ambulances = 3 minutes.
  const responseTimeMins = Math.max(3, Math.round(25 - (customAmbulances * 0.3)));
  const ambulanceScore = Math.min(30, Math.max(0, Math.round(((25 - responseTimeMins) / 22) * 30)));

  // 3. Air Quality Index Impact (Max 35 pts)
  // Optimal standard AQI is 50. High AQI decreases score.
  const aqiScore = Math.min(35, Math.max(0, Math.round(((400 - customAqi) / 350) * 35)));

  // Sum of contributions
  const dynamicCityScore = Math.min(100, Math.max(10, bedScore + ambulanceScore + aqiScore));

  // Compute live responsive scoring algorithm
  const computeHealthScore = (base: number, aqi: number, availBeds: number, totalBeds: number) => {
    // High AQI reduces health score
    const cleanAirDeduction = Math.max(0, (aqi - 100) * 0.08);
    // Lower beds availability reduces health score
    const bedFactor = (availBeds / totalBeds) * 15;
    const finalScore = Math.min(100, Math.max(40, base - cleanAirDeduction + bedFactor + (scoreWeight - 50) * 0.1));
    return Math.round(finalScore);
  };

  const cScore = computeHealthScore(currentCity.baseScore, currentCity.aqi, currentCity.bedsAvail, currentCity.bedsMax);

  // Trigger simulated routing calculation
  const handleCalculateRoute = () => {
    const fromCity = routingSource;
    let fallbackDest = "";
    let routingDetails = "";
    let eta = "";
    
    if (fromCity === "Noida" || fromCity === "Greater Noida") {
      fallbackDest = "Max Vaishali / Fortis Sector 62";
      routingDetails = "AI Routing suggests NH-24 Bypass to avoid ongoing construction traffic in Sector 71. ICU Bed allocation booked automatically at Max Vaishali Center.";
      eta = "14 Minutes (Siren Escorted Active)";
    } else if (fromCity === "Gurugram") {
      fallbackDest = "Medanta The Medicity (Emergency Ward)";
      routingDetails = "Direct routing via Golf Course Extension Road. Real-time sensor indicators show green corridor active across Netaji Subhash Marg.";
      eta = "11 Minutes (Ambulance Allocated)";
    } else if (fromCity === "Delhi") {
      fallbackDest = "AIIMS Trauma Center, New Delhi";
      routingDetails = "Ring Road corridor prioritized. Automated traffic signal preemption triggered along Safdarjung Enclave nexus.";
      eta = "18 Minutes";
    } else {
      fallbackDest = "Amrita Trauma Desk, Faridabad";
      routingDetails = "Mathura Road expressway cleared. Medical dispatch coordinated via Sector 21 Command.";
      eta = "15 Minutes";
    }

    setSimulatedRoute({
      source: fromCity,
      destination: fallbackDest,
      eta,
      guidance: routingDetails,
      hospitalsChecked: ["Apollo Apollo", "Fortis Hospital Node", "Yashoda Command"],
      icuAvailable: true
    });
  };

  const getAqiDescription = (aqi: number) => {
    if (aqi <= 150) return { label: "Moderate / Satisfactory", color: "text-emerald-600 bg-emerald-50 border-emerald-100", progress: "bg-emerald-500", advice: "Generally favorable air quality for respiratory workouts." };
    if (aqi <= 250) return { label: "Poor / Aggravated", color: "text-amber-600 bg-amber-50 border-amber-100", progress: "bg-amber-500", advice: "Sensitive groups should limit intensive physical activities outdoors." };
    return { label: "Severe / Warning Zone", color: "text-rose-600 bg-rose-50 border-rose-100", progress: "bg-rose-500", advice: "Wear N95 masks. Severe respiratory hazard detected across outer city ring." };
  };

  const aqiInfo = getAqiDescription(currentCity.aqi);

  // Health Index rankings calculated dynamically
  const sortedRankings = Object.entries(CITIES_DATA).map(([key, value]) => {
    const score = computeHealthScore(value.baseScore, value.aqi, value.bedsAvail, value.bedsMax);
    return { name: key, score, data: value };
  }).sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6">
      
      {/* City operating system header banner */}
      <div className="bg-slate-900 border border-slate-950 text-white rounded-3xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-radial-at-t from-slate-800 to-slate-950 opacity-90 pointer-events-none" />
        {/* Abstract vector dots representing connected medical nodes */}
        <div className="absolute right-10 top-0 bottom-0 w-1/3 opacity-15 flex flex-wrap gap-3 p-4 pointer-events-none content-center">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>

        <div className="relative space-y-4 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-400/20 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> Delhi NCR Regional Health Twin (CHN)
          </span>
          <h2 className="text-xl sm:text-2xl font-[900] tracking-tight leading-none uppercase">
            Metropolitan Healthcare Operating System
          </h2>
          <p className="text-xs text-slate-350 leading-relaxed font-semibold">
            Real-time visual dashboard mapping primary and secondary clinical metrics, dynamic queue loadings, pollution health hazards, and AI emergency routing across Delhi, Gurugram, Noida, Greater Noida, Ghaziabad, and Faridabad.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {Object.keys(CITIES_DATA).map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  selectedCity === city 
                    ? "bg-white text-slate-950 shadow-md font-extrabold scale-105" 
                    : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub tabs navigation console */}
      <div className="flex overflow-x-auto gap-2 bg-slate-100/70 p-1.5 rounded-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab2("dashboard")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "dashboard" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Building className="h-4 w-4" /> City Dashboard
        </button>
        <button
          onClick={() => setActiveTab2("heatmap")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "heatmap" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Layers className="h-4 w-4" /> AI Disease Heat Map
        </button>
        <button
          onClick={() => {
            setActiveTab2("routing");
            handleCalculateRoute();
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "routing" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Compass className="h-4 w-4" /> AI Emergency Router
        </button>
        <button
          onClick={() => setActiveTab2("feed")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "feed" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Activity className="h-4 w-4" /> City Health Feed
        </button>
        <button
          onClick={() => setActiveTab2("women-senior")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "women-senior" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Heart className="h-4 w-4" /> Women & Senior Support
        </button>
        <button
          onClick={() => setActiveTab2("nutrition")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "nutrition" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <ChefHat className="h-4 w-4 text-emerald-600 animate-pulse" /> Diet Advisor
        </button>
      </div>

      {/* Main panel displays */}
      <AnimatePresence mode="wait">
        {activeTab === "dashboard" && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Left side: Intelligence Card (City Health Score & Quick Stats) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* City Health Score Widget */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex justify-between items-center bg-transparent border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 bg-transparent">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Dynamic Indexing Widget</span>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                  <Heart className="h-4 w-4 text-emerald-500" />
                </div>

                <div className="text-center space-y-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">City Health Score</h4>
                  
                  <div className="relative py-2 flex justify-center items-center">
                    {/* Dynamic circular ring */}
                    <div className="w-32 h-32 rounded-full border-4 border-slate-100 flex flex-col justify-center items-center shadow-inner select-none relative bg-slate-50/40">
                      <span className="text-4xl font-[950] text-slate-900 font-sans tracking-tight">{dynamicCityScore}</span>
                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none mt-1">Health Index</span>
                      
                      {/* Dynamic border highlight based on score severity */}
                      <div className={`absolute inset-0 rounded-full border-t-4 border-r-4 animate-spin pointer-events-none ${
                        dynamicCityScore >= 85 ? "border-emerald-500/80" : dynamicCityScore >= 65 ? "border-amber-500/80" : "border-rose-500/80"
                      }`} style={{ animationDuration: "10s" }} />
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-transparent">
                    <span className={`w-2 h-2 rounded-full ${
                      dynamicCityScore >= 85 ? "bg-emerald-500" : dynamicCityScore >= 65 ? "bg-amber-500" : "bg-rose-500"
                    }`} />
                    <span className={
                      dynamicCityScore >= 85 ? "text-emerald-700 font-extrabold" : dynamicCityScore >= 65 ? "text-amber-700 font-extrabold" : "text-rose-700 font-extrabold"
                    }>
                      {dynamicCityScore >= 85 ? "Healthy / Stable" : dynamicCityScore >= 65 ? "Moderate Watch" : "Critical Emergency"}
                    </span>
                  </div>
                </div>

                {/* Score Breakdown Analysis */}
                <div className="space-y-3 pt-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block pl-1">Score Contribution Breakdown</span>
                  
                  {/* Bed Availability Bar */}
                  <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-2xl space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-700 font-extrabold">
                      <span>Bed Availability Factor</span>
                      <span className="font-mono">{bedScore} / 35 pts</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300 bg-emerald-500" style={{ width: `${(bedScore / 35) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-400 font-medium pb-0.5">
                      <span>{customBedsAvail} of {currentCity.bedsMax} beds vacant</span>
                      <span>Max contribution: 35</span>
                    </div>
                  </div>

                  {/* Ambulance Response Time Bar */}
                  <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-2xl space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-700 font-extrabold">
                      <span>Ambulance Response Factor</span>
                      <span className="font-mono">{ambulanceScore} / 30 pts</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300 bg-sky-500" style={{ width: `${(ambulanceScore / 30) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-400 font-medium pb-0.5">
                      <span>Est. Response: {responseTimeMins} mins ({customAmbulances} units active)</span>
                      <span>Max contribution: 30</span>
                    </div>
                  </div>

                  {/* AQI Air Purity Bar */}
                  <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-2xl space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-700 font-extrabold">
                      <span>Air Purity (AQI) Factor</span>
                      <span className="font-mono">{aqiScore} / 35 pts</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300 bg-amber-500" style={{ width: `${(aqiScore / 35) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-400 font-medium pb-0.5">
                      <span>Simulated AQI: {customAqi} ({customAqi <= 150 ? "Clear Air" : customAqi <= 250 ? "Moderate" : "Hazardous Zone"})</span>
                      <span>Max contribution: 35</span>
                    </div>
                  </div>
                </div>

                {/* Simulation Control Drawer */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1 pb-1 border-b border-slate-150">
                    <Sparkles className="h-3 w-3 text-slate-700 shrink-0" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Interactive Health twin Sandbox</span>
                  </div>

                  {/* Bed Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                      <span>Simulated Free Beds</span>
                      <span className="font-mono">{customBedsAvail} Beds</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={currentCity.bedsMax || 1500}
                      value={customBedsAvail}
                      onChange={(e) => setCustomBedsAvail(Number(e.target.value))}
                      className="w-full accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Ambulance Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                      <span>Standby Ambulances</span>
                      <span className="font-mono">{customAmbulances} Units</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={customAmbulances}
                      onChange={(e) => setCustomAmbulances(Number(e.target.value))}
                      className="w-full accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* AQI Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                      <span>Ambient AQI Level</span>
                      <span className="font-mono">{customAqi} AQI</span>
                    </div>
                    <input
                      type="range"
                      min="40"
                      max="400"
                      value={customAqi}
                      onChange={(e) => setCustomAqi(Number(e.target.value))}
                      className="w-full accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>

                  <p className="text-[8px] text-slate-400 font-bold leading-normal text-center">
                    Simulate real-time operating conditions of {currentCity.name} using controls.
                  </p>
                </div>
              </div>

              {/* Connected Localities List */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-1.5 pl-1">
                  <MapPin className="h-4 w-4 text-slate-700 shrink-0" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Active Sub-Networks</h4>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {currentCity.subregions.map((sub, i) => (
                    <span 
                      key={i} 
                      className="px-2.5 py-1 bg-slate-50 border border-slate-150 text-[10px] font-bold text-slate-700 rounded-lg whitespace-nowrap"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            {/* Right side: Operating Hub Metrics Bento Box */}
            <div className="lg:col-span-8 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Metric Card 1: Emergency & ICU Beds */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 inline-block tracking-wider">
                      ICU Availability
                    </span>
                    <h4 className="text-xs font-black text-slate-850 uppercase tracking-wide mt-3.5">Hospital Network Capacity</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">Consolidated ICU & triage bed inventories across all state hospitals.</p>
                  </div>

                  <div className="flex items-baseline gap-2.5 pt-2">
                    <span className="text-3xl font-[900] text-slate-900 font-mono">{currentCity.bedsAvail}</span>
                    <span className="text-xs font-extrabold text-slate-400">/ {currentCity.bedsMax} Beds Available</span>
                  </div>

                  {/* Progress visual bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${(currentCity.bedsAvail / currentCity.bedsMax) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Metric Card 2: Environment Air Hazard */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
                  <div>
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border inline-block tracking-wider ${aqiInfo.color}`}>
                      AQI Air Quality Index
                    </span>
                    <h4 className="text-xs font-black text-slate-850 uppercase tracking-wide mt-3.5">Respiratory Environment Tracker</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">Real-time localized pollutant mapping index across Delhi NCR.</p>
                  </div>

                  <div className="flex items-baseline gap-2.5 pt-2">
                    <span className="text-3xl font-[900] text-slate-900 font-mono">{currentCity.aqi}</span>
                    <span className="text-xs font-extrabold text-slate-400">{aqiInfo.label}</span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        currentCity.aqi > 250 ? "bg-rose-500" : currentCity.aqi > 150 ? "bg-amber-500" : "bg-emerald-500"
                      }`} 
                      style={{ width: `${Math.min(100, (currentCity.aqi / 400) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Metric Card 3: Live Responders */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3.5 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
                      <Ambulance className="h-4.5 w-4.5" />
                    </div>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-extrabold uppercase">Live dispatch</span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Emergency Ambulance Dispatch</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">Active siren GPS emergency vehicles mapped inside City sector boundaries.</p>
                  </div>

                  <p className="text-xl font-[900] text-slate-850 font-mono">
                    {currentCity.ambulances} <span className="text-xs font-bold text-slate-400">Responder Units Standby</span>
                  </p>
                </div>

                {/* Metric Card 4: Registered Staff */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3.5 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-sky-50 border border-sky-100 rounded-xl text-sky-600">
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-extrabold uppercase">Active now</span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Clinicians On-Call Grid</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">Validated medical specialists cataloged and accepting immediate referrals.</p>
                  </div>

                  <p className="text-xl font-[900] text-slate-850 font-mono">
                    {currentCity.doctorsOnline} <span className="text-xs font-bold text-slate-400">Available Doctors</span>
                  </p>
                </div>

              </div>

              {/* City Health Alerts Panel */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-1.5 pl-1">
                  <ShieldAlert className="h-4.5 w-4.5 text-slate-700 shrink-0" />
                  <h4 className="text-xs font-black text-slate-850 uppercase tracking-widest">Ongoing Epidemiological Warnings</h4>
                </div>

                <div className="grid gap-2.5">
                  {currentCity.outbreakZones.map((zone, i) => (
                    <div 
                      key={i} 
                      className={`p-3.5 rounded-2xl border flex justify-between items-center ${
                        zone.level === "Critical" 
                          ? "bg-rose-50/50 border-rose-150 text-rose-955" 
                          : zone.level === "Warning"
                          ? "bg-amber-50/40 border-amber-100 text-amber-900" 
                          : "bg-slate-50/50 border-slate-150 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${
                          zone.level === "Critical" ? "bg-rose-500 animate-ping" : zone.level === "Warning" ? "bg-amber-500" : "bg-emerald-500"
                        }`} />
                        <span className="text-xs font-extrabold">{zone.name}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider">{zone.level} Level</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* AI DISEASE HEAT MAP VIEW */}
        {activeTab === "heatmap" && (
          <motion.div
            key="heatmap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Header controls pane */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="p-1 px-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1">
                    <Layers className="h-3 w-3" /> AI Spatial overlays
                  </span>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">Integrated Epidemic Heat Mapping Console</h4>
                  <p className="text-xs text-slate-450 leading-relaxed font-semibold">
                    Dynamic visual simulation layer plotting regional air particulate concentrations, vector tracking parameters, and seasonal flu densities for <span className="text-emerald-600 font-extrabold">{currentCity.name}</span>.
                  </p>
                </div>

                {/* City select mirrored here for convenience */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Viewing Grid:</span>
                  <select
                    value={selectedCity}
                    onChange={(e) => {
                      setSelectedCity(e.target.value);
                      setSelectedSubregion(null);
                    }}
                    className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer shadow-xs"
                  >
                    {Object.keys(CITIES_DATA).map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Toggle switch controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-150 rounded-2xl select-none">
                {/* AQI Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAqiOverlay(!showAqiOverlay)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                    showAqiOverlay 
                      ? "bg-rose-50 border-rose-200 text-rose-950 shadow-xs ring-1 ring-rose-300" 
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wind className={`h-4 w-4 ${showAqiOverlay ? "text-rose-600" : "text-slate-400"}`} />
                    <div>
                      <p className="text-[10px] font-black uppercase leading-none">Air Pollution (AQI)</p>
                      <p className="text-[8px] text-slate-450 font-semibold leading-normal mt-0.5">PM2.5 particulate hotspots</p>
                    </div>
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-extrabold ${
                    showAqiOverlay ? "bg-rose-600 border-rose-600 text-white" : "border-slate-300"
                  }`}>
                    {showAqiOverlay && "✓"}
                  </span>
                </button>

                {/* Dengue Toggle */}
                <button
                  type="button"
                  onClick={() => setShowDengueOverlay(!showDengueOverlay)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                    showDengueOverlay 
                      ? "bg-amber-50 border-amber-200 text-amber-955 shadow-xs ring-1 ring-amber-300" 
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Droplet className={`h-4 w-4 ${showDengueOverlay ? "text-amber-600" : "text-slate-400"}`} />
                    <div>
                      <p className="text-[10px] font-black uppercase leading-none">Dengue Vector</p>
                      <p className="text-[8px] text-slate-450 font-semibold leading-normal mt-0.5">Risk & stagnant breeding pools</p>
                    </div>
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-extrabold ${
                    showDengueOverlay ? "bg-amber-600 border-amber-600 text-white" : "border-slate-300"
                  }`}>
                    {showDengueOverlay && "✓"}
                  </span>
                </button>

                {/* Flu Toggle */}
                <button
                  type="button"
                  onClick={() => setShowFluOverlay(!showFluOverlay)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                    showFluOverlay 
                      ? "bg-sky-50 border-sky-00 text-sky-950 shadow-xs ring-1 ring-sky-300" 
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Activity className={`h-4 w-4 ${showFluOverlay ? "text-sky-600" : "text-slate-400"}`} />
                    <div>
                      <p className="text-[10px] font-black uppercase leading-none">Seasonal Flu Surge</p>
                      <p className="text-[8px] text-slate-450 font-semibold leading-normal mt-0.5">Viral diagnostic cluster indexes</p>
                    </div>
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-extrabold ${
                    showFluOverlay ? "bg-sky-600 border-sky-600 text-white" : "border-slate-300"
                  }`}>
                    {showFluOverlay && "✓"}
                  </span>
                </button>
              </div>
            </div>

            {/* Layout Block: Interactive spatial dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: The Interactive spatial map */}
              <div className="lg:col-span-8 bg-slate-950 border border-slate-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[440px]">
                {/* Radar Grid Graphic lines in background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

                {heatmapScanActive && (
                  <motion.div 
                    initial={{ y: "-100%" }}
                    animate={{ y: "150%" }}
                    transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.7)] z-20 pointer-events-none"
                  />
                )}

                {/* Spatial Map Header */}
                <div className="flex items-center justify-between z-10 bg-transparent mb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 tracking-widest font-black uppercase">
                      CHN Spatial twin map — {currentCity.name} Sector
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setHeatmapScanActive(true);
                        setTimeout(() => setHeatmapScanActive(false), 3000);
                      }}
                      disabled={heatmapScanActive}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 font-mono text-[9px] font-black rounded uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3 text-cyan-400 animate-pulse" />
                      {heatmapScanActive ? "Scanning..." : "Recalibrate"}
                    </button>
                  </div>
                </div>

                {/* Active subregions map layout */}
                <div className="my-auto py-4">
                  {heatmapScanActive ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3 z-10 relative">
                      <div className="w-10 h-10 rounded-full border-2 border-cyan-400/20 border-t-cyan-450 animate-spin" />
                      <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest animate-pulse font-bold">
                        Plotting threat telemetry matrices...
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
                      {currentCity.subregions.map((sub, idx) => {
                        const localRisk = getSubregionRiskData(sub, currentCity.aqi);
                        const isSelected = selectedSubregion === sub;
                        
                        // Decide color profiles based on active toggles
                        const showPollutionWarning = showAqiOverlay && localRisk.aqi > 150;
                        const showDengueWarning = showDengueOverlay && localRisk.dengue > 5.5;
                        const showFluWarning = showFluOverlay && localRisk.flu > 60;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedSubregion(isSelected ? null : sub)}
                            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group select-none min-h-[105px] flex flex-col justify-between ${
                              isSelected
                                ? "bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/50"
                                : "bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            {/* Blur pollution halo */}
                            {showPollutionWarning && (
                              <div className="absolute -right-4 -bottom-4 w-12 h-12 rounded-full bg-rose-500/20 filter blur-xl group-hover:bg-rose-500/30 transition-all pointer-events-none" />
                            )}

                            {/* Blur flu halo */}
                            {showFluWarning && (
                              <div className="absolute -left-4 -top-4 w-12 h-12 rounded-full bg-sky-500/20 filter blur-xl group-hover:bg-sky-500/30 transition-all pointer-events-none" />
                            )}

                            {/* Top row indicators */}
                            <div className="flex justify-between items-start">
                              <span className="text-[9px] font-mono text-slate-500 leading-none">
                                SEC - {idx + 10}
                              </span>

                              {/* Action layer icons indicators */}
                              <div className="flex items-center gap-1.5 min-h-[12px] bg-transparent">
                                {showPollutionWarning && (
                                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" title="AQI Hotspot" />
                                )}
                                {showDengueWarning && (
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" title="Dengue Spot" />
                                )}
                                {showFluWarning && (
                                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" title="Flu outbreak zone" />
                                )}
                              </div>
                            </div>

                            {/* Main Title */}
                            <div className="my-2 bg-transparent">
                              <p className="text-xs font-black text-slate-200 leading-snug group-hover:text-white transition-all line-clamp-1">
                                {sub}
                              </p>
                            </div>

                            {/* Bottom micro numerical readings */}
                            <div className="flex items-center justify-between text-[8px] font-mono font-bold pt-1.5 border-t border-slate-850/60 text-slate-400">
                              {showAqiOverlay ? (
                                <span className={localRisk.aqi > 250 ? "text-rose-400" : "text-slate-400"}>
                                  AQI: {localRisk.aqi}
                                </span>
                              ) : showDengueOverlay ? (
                                <span className={localRisk.dengue > 6 ? "text-amber-400 animate-pulse" : "text-slate-400"}>
                                  DEN: {localRisk.dengue}
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  FLU: {localRisk.flu}%
                                </span>
                              )}

                              <span className="text-slate-600 group-hover:text-cyan-400 transition-all text-[7px] font-bold">
                                {isSelected ? "ACTIVE" : "DETAILS"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Map footer coordinates mock */}
                <div className="border-t border-slate-900 pt-3 flex items-center justify-between text-[8px] font-mono text-slate-500">
                  <span>LAT BOUNDARY: 28.6139° N, 77.2090° E</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Pollution Outlier
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Dengue Vector
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Seasonal Flu
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Risk Diagnostic & Diagnostic Actions */}
              <div className="lg:col-span-4 space-y-4">
                
                {/* Specific subregion tooltip display */}
                {selectedSubregion ? (() => {
                  const localRisk = getSubregionRiskData(selectedSubregion, currentCity.aqi);
                  
                  return (
                    <div className="bg-slate-900 border border-slate-850 rounded-3xl p-5 text-slate-200 space-y-4 min-h-[350px] flex flex-col justify-between">
                      <div className="space-y-4">
                        {/* Subregion Header */}
                        <div className="flex justify-between items-start border-b border-slate-850 pb-3 bg-transparent">
                          <div>
                            <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider font-extrabold">Active Spatial Node</span>
                            <h4 className="text-sm font-black text-white leading-normal mt-0.5">{selectedSubregion}</h4>
                          </div>
                          <button
                            onClick={() => setSelectedSubregion(null)}
                            className="text-[9px] font-mono text-slate-500 hover:text-slate-350 uppercase"
                          >
                            Clear
                          </button>
                        </div>

                        {/* Interactive Risk Bar Charts */}
                        <div className="space-y-3 pt-1">
                          {/* Localized AQI Indicator */}
                          <div className="space-y-1 bg-transparent">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="flex items-center gap-1">
                                <Wind className="h-3 w-3 text-rose-400" />
                                Particle Pollution Index
                              </span>
                              <span className="font-mono text-white">{localRisk.aqi} AQI</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1">
                              <div 
                                className={`h-full rounded-full ${
                                  localRisk.aqi > 250 ? "bg-rose-500" : localRisk.aqi > 150 ? "bg-amber-500" : "bg-emerald-500"
                                }`} 
                                style={{ width: `${Math.min(100, (localRisk.aqi / 400) * 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Localized Dengue Index Indicator */}
                          <div className="space-y-1 bg-transparent">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="flex items-center gap-1">
                                <Droplet className="h-3 w-3 text-amber-400" />
                                Vector Dengue Factor
                              </span>
                              <span className="font-mono text-white">{localRisk.dengue} / 10</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1">
                              <div 
                                className="h-full rounded-full bg-amber-500" 
                                style={{ width: `${localRisk.dengue * 10}%` }}
                              />
                            </div>
                          </div>

                          {/* Localized Flu Index Indicator */}
                          <div className="space-y-1 bg-transparent">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3 text-sky-450" />
                                Flu Transmission Risk
                              </span>
                              <span className="font-mono text-white">{localRisk.flu}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1">
                              <div 
                                className="h-full rounded-full bg-sky-500" 
                                style={{ width: `${localRisk.flu}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* AI Preventive Diagnostic Insights */}
                        <div className="p-3 bg-slate-950 border border-slate-850 rounded-2xl space-y-1.5">
                          <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-black block">
                            AI Spatial Diagnostic Advisor
                          </span>
                          <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                            {localRisk.aqi > 250 && "Severe particulate density registers. Triggering automated clinic alerts to expand nebulizer reserves by 25%. Propose N95 mask recommendation for senior localities."}
                            {localRisk.aqi <= 250 && localRisk.dengue > 6 && "Vector breeding index peaks within stagnation risk pools. Triggering automated civic body coordinated pesticide fogging operations."}
                            {localRisk.aqi <= 250 && localRisk.dengue <= 6 && "Stable clinical indicators register. Maintain general prophylactic safety protocols and water stagnation mitigation campaigns."}
                          </p>
                        </div>
                      </div>

                      {/* Diagnostic Action Button */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerToast(`AI Proactive Dispatch Activated for ${selectedSubregion}! Fogging coordinate dispatch or respiratory buffer deployment initiated.`, "info");
                        }}
                        className="w-full py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-black text-[10px] uppercase rounded-xl tracking-wider cursor-pointer"
                      >
                        Dispatch AI Proactive Target
                      </button>
                    </div>
                  );
                })() : (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 min-h-[350px] flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Info className="h-4 w-4 text-emerald-500" />
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">State Spatial Summary</h4>
                      </div>

                      <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
                        This view integrates digital spatial twins mapping environmental, atmospheric, and clinical telemetry nodes. Click any subregion on the interactive grid map layout to access deep medical diagnostic telemetry controls.
                      </p>

                      <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl space-y-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Active Alarm Matrix</span>
                        
                        <div className="text-[9px] font-bold text-slate-700 space-y-1.5">
                          <div className="flex justify-between items-center bg-transparent">
                            <span>Severe AQI Hotspots</span>
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded-sm font-mono text-[8px] font-black">
                              {currentCity.subregions.filter(sub => getSubregionRiskData(sub, currentCity.aqi).aqi > 240).length} Nodes
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center bg-transparent">
                            <span>Elevated Dengue Pools</span>
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-sm font-mono text-[8px] font-black">
                              {currentCity.subregions.filter(sub => getSubregionRiskData(sub, currentCity.aqi).dengue > 5.8).length} Areas
                            </span>
                          </div>

                          <div className="flex justify-between items-center bg-transparent">
                            <span>High Flu Transmission</span>
                            <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded-sm font-mono text-[8px] font-black">
                              {currentCity.subregions.filter(sub => getSubregionRiskData(sub, currentCity.aqi).flu > 60).length} Clusters
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-center space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Algorithmic Confidence</p>
                      <p className="text-xs font-black text-slate-800 font-mono">94.8% SLA Assurance</p>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* Regional Comparative Threat Matrix Panel */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Activity className="h-4.5 w-4.5 text-slate-700" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">Regional Comparative Threat Matrix</h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] font-medium text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 uppercase text-[9px] font-black text-slate-400 tracking-wider">
                      <th className="py-2.5">NCR Region Name</th>
                      <th className="py-2.5">Consolidated AQI</th>
                      <th className="py-2.5">Med Peak Dengue</th>
                      <th className="py-2.5">Avg Flu Transmission</th>
                      <th className="py-2.5">Urgent Risk Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {Object.entries(CITIES_DATA).map(([key, city]) => {
                      const criticalOutbreak = city.outbreakZones.find(z => z.level === "Critical");
                      return (
                        <tr key={key} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 font-extrabold text-slate-800">{city.name}</td>
                          <td className="py-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${
                              city.aqi > 250 ? "bg-rose-50 text-rose-700" : city.aqi > 150 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                            }`}>
                              {city.aqi} ppm
                            </span>
                          </td>
                          <td className="py-3 font-mono">
                            {city.name === "Delhi Capital" ? "7.8" : city.name === "Gurugram" ? "6.2" : "5.1"} / 10
                          </td>
                          <td className="py-3 font-mono">
                            {city.name === "Delhi Capital" ? "68%" : city.name === "Gurugram" ? "42%" : "55%"}
                          </td>
                          <td className="py-3">
                            <span className={`text-[9px] font-black uppercase tracking-wider ${
                              criticalOutbreak ? "text-rose-600" : "text-emerald-600"
                            }`}>
                              {criticalOutbreak ? `Emergency: ${criticalOutbreak.name}` : "Code Stable — Monitor"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </motion.div>
        )}

        {/* AI EMERGENCY ROUTER VIEW */}
        {activeTab === "routing" && (
          <motion.div
            key="routing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
              <div className="space-y-1 pl-1">
                <span className="p-1 px-2.5 bg-sky-50 text-sky-700 border border-sky-150 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-0.5">
                  <Compass className="h-2.5 w-2.5" /> GPS Preemption Console
                </span>
                <h4 className="text-sm font-black text-slate-905 uppercase tracking-wide">AI-Powered Strategic Emergency Routing</h4>
                <p className="text-xs text-slate-450 leading-relaxed font-semibold">
                  Calculate real-time green-light transport routes across state checkposts mapping live traffic accidents, ICU beds, and ambulance velocities.
                </p>
              </div>

              {/* Selector form */}
              <div className="p-4.5 bg-slate-50 border border-slate-150 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 pb-5 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Patient Starting Sector</label>
                  <select
                    value={routingSource}
                    onChange={(e) => setRoutingSource(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl p-3 focus:outline-none shadow-sm cursor-pointer"
                  >
                    {Object.keys(CITIES_DATA).map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Clinical Severity Index</label>
                  <select
                    value={routingSeverity}
                    onChange={(e) => setRoutingSeverity(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl p-3 focus:outline-none shadow-sm cursor-pointer"
                  >
                    <option value="Critical">Critical (Cardiac, Stroke, Multi-Trauma)</option>
                    <option value="Standard">Standard (Pediatric, Dialysis, General)</option>
                  </select>
                </div>

                <button
                  onClick={handleCalculateRoute}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-cyan-300" /> Optimize Clinical Route
                </button>
              </div>

              {/* Routing display block */}
              {simulatedRoute && (
                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-xs bg-slate-50/20 grid grid-cols-1 lg:grid-cols-12">
                  {/* Map simulation schematic */}
                  <div className="lg:col-span-5 bg-slate-900 p-6 flex flex-col justify-between items-center text-center relative max-h-[300px]">
                    <div className="absolute inset-0 bg-radial-at-t from-slate-800 to-slate-950 pointer-events-none" />
                    
                    <span className="z-10 text-[9px] font-mono font-black tracking-widest text-cyan-300 uppercase">
                      Green Signal Corridor Activated
                    </span>

                    {/* Routing step tracker nodes */}
                    <div className="z-10 flex items-center justify-center gap-4 py-8">
                      <div className="p-3 bg-slate-850 border border-slate-200/20 rounded-full text-white text-[10px] font-extrabold max-w-[80px] truncate" title={simulatedRoute.source}>
                        {simulatedRoute.source}
                      </div>
                      <ArrowRight className="h-5 w-5 text-cyan-400 animate-pulse shrink-0" />
                      <div className="p-3 bg-slate-850 border border-cyan-450 rounded-full text-cyan-300 text-[10px] font-extrabold max-w-[95px] truncate" title={simulatedRoute.destination}>
                        {simulatedRoute.destination.split(" ")[0]}
                      </div>
                    </div>

                    <p className="z-10 text-[10px] font-mono text-slate-400 font-medium">Auto-preemption signals: 4 major junctions synced</p>
                  </div>

                  {/* Route descriptions */}
                  <div className="lg:col-span-7 p-5 space-y-4">
                    <div className="flex justify-between items-start flex-col sm:flex-row gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Routing Result Target</span>
                        <h5 className="font-extrabold text-sm text-slate-900 mt-0.5">{simulatedRoute.destination}</h5>
                      </div>
                      <div className="bg-blue-50 border border-blue-150 px-2.5 py-1 text-blue-700 text-[10px] font-black uppercase rounded-lg">
                        ETA: {simulatedRoute.eta}
                      </div>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-150 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Info className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider">AI Road Intelligence Notice</span>
                      </div>
                      <p className="text-xs text-slate-750 leading-relaxed font-bold font-sans">
                        {simulatedRoute.guidance}
                      </p>
                    </div>

                    <div className="flex gap-2.5 flex-wrap font-mono text-[9px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-600 font-semibold select-none">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Active ICU Validated
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Expressway Escort Requested
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}

        {/* CITY NEWS FEED & BLOOD REGISTER */}
        {activeTab === "feed" && (
          <motion.div
            key="feed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Health Feed Timeline */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
              <div className="space-y-1 pl-1">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Public Health Alert System & Feed</h4>
                <p className="text-xs text-slate-450 leading-relaxed font-semibold">City council verified vaccine camps, health events, and regional medical schedules.</p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: "Mega Free Vaccination & Booster Camp",
                    desc: "Free Pediatric and Adult influenza vaccine drive initiated by Delhi Govt in Central City Community Center.",
                    date: "Today, June 01, 2026",
                    type: "Camp Notice"
                  },
                  {
                    title: "Extreme Respiratory Advisory: Avoid Outdoor Workouts",
                    desc: "Ghaziabad & Delhi Shahdara reporting AQI exceeding 310. Highly suggested to shift respiratory fitness routines indoors.",
                    date: "Yesterday, May 31, 2026",
                    type: "Environmental Warning"
                  },
                  {
                    title: "Voluntary Mobile Blood Contribution Schedule",
                    desc: "Active blood drive vehicles scheduled to station at Sector 18 Noida metro hub accepting O- and Rare plasma groups.",
                    date: "Scheduled, June 03, 2026",
                    type: "Blood Program"
                  }
                ].map((item, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-150 rounded-2xl transition-all space-y-1.5 text-xs font-semibold select-none">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 bg-transparent pb-1 border-b border-slate-200/60 pb-1.5">
                      <span className="font-mono text-[9px] uppercase font-black text-slate-500 bg-slate-150 px-2 py-0.5 rounded-md tracking-wider">
                        {item.type}
                      </span>
                      <span className="font-mono text-[9px]">{item.date}</span>
                    </div>
                    <p className="font-black text-[12px] text-slate-850 pt-1 leading-tight">{item.title}</p>
                    <p className="text-[10px] text-slate-500 leading-normal font-semibold font-sans">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Blood & Organ Locator Network */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
              <div className="space-y-1 pl-1 flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Emergency Blood Locator</h4>
                  <p className="text-[10px] text-slate-400 leading-normal font-semibold mt-0.5">High priority matching module finding nearest city donors.</p>
                </div>
                <Droplet className="h-5 w-5 text-rose-500 shrink-0" />
              </div>

              <div className="p-4 bg-rose-50/45 border border-rose-150 rounded-2xl text-xs space-y-3.5">
                <div className="flex items-start gap-2 text-rose-950 font-black">
                  <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>CRITICAL ALERT: O- Blood requested in {selectedCity}</span>
                </div>
                <p className="text-[10px] text-rose-800 font-semibold leading-relaxed font-sans">
                  Critical medical referral trauma patient admitted at intensive unit require immediate transfusion course support.
                </p>

                <button
                  type="button"
                  onClick={() => setBloodAlertFound(true)}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl uppercase tracking-wider text-[10px] shadow-sm select-none cursor-pointer active:scale-95 transition-all text-center"
                >
                  Locate Mapped City Donors
                </button>
              </div>

              {/* Simulated donor list */}
              {bloodAlertFound && (
                <div className="space-y-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Nearest Validated Donors Mapped</span>
                  <div className="space-y-1.5">
                    {[
                      { name: "Rahul Sharma (O-)", dist: "2.4 km away", phone: "+91 98105-XXXXX", verified: "Medanta verified" },
                      { name: "Ananya Deshmukh (O-)", dist: "4.1 km away", phone: "+91 88260-XXXXX", verified: "Apollo verified" }
                    ].map((donor, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <p className="font-extrabold text-[11px] text-slate-800">{donor.name}</p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5 font-sans">{donor.dist} • {donor.verified}</p>
                        </div>
                        <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded font-mono uppercase tracking-widest">
                          Contact
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* WOMEN SAFETY & SENIOR CITIZEN NETWORK */}
        {activeTab === "women-senior" && (
          <motion.div
            key="women-senior"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Women Priority Care Module */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
              <div className="space-y-1 pl-1">
                <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-wider inline-block">
                  Women First Access
                </span>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Dedicated Women Healthcare & Safety</h4>
                <p className="text-xs text-slate-450 leading-relaxed font-semibold">Priority access helpline coordinates, female clinical specialists catalog, and immediate safety dispatches.</p>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <button
                  onClick={() => {
                    setSosStatusTriggered(true);
                  }}
                  className="p-4 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl flex flex-col items-center justify-center text-center space-y-2 transition-all cursor-pointer select-none active:scale-95"
                >
                  <Phone className="h-6 w-6 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Emergency SOS Responder</span>
                </button>

                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl space-y-1 font-semibold text-xs text-slate-700">
                  <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider block">Local Center Desk</span>
                  <p className="font-extrabold text-[12px] text-slate-905">{selectedCity} Women Trauma Hub</p>
                  <p className="text-[9px] text-slate-400 font-bold">24x7 active duty female specialists standing by</p>
                </div>
              </div>

              {/* Clinicians focus list */}
              <div className="space-y-2.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Active Women Specialists Mapped</span>
                <div className="grid gap-2">
                  {[
                    { name: "Dr. Rohini Goel", specialty: "Gynecology & Obstetric Care", status: "Online", loc: `${selectedCity} Main Center` },
                    { name: "Dr. Sneha Pillai", specialty: "Trauma Intensive Response", status: "On Call", loc: `${selectedCity} Sector Hosp` }
                  ].map((doc, i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <p className="font-black text-slate-800 text-[11px]">{doc.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">{doc.specialty} • {doc.loc}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px] tracking-wide uppercase">
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {sosStatusTriggered && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-900 rounded-2xl text-[10px] flex items-center gap-2.5 font-semibold leading-relaxed">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
                  <div>
                    <span className="font-black block">GPS Siren Dispatch Coordinated</span>
                    City Healer network notified. Local Sector Trauma desk & nearest female dispatcher vehicle alerted.
                  </div>
                </div>
              )}
            </div>

            {/* Senior citizen companion support network */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
              <div className="space-y-1 pl-1">
                <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-wider inline-block">
                  Senior Citizen Care
                </span>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Elder Care & Physical Therapy Network</h4>
                <p className="text-xs text-slate-450 leading-relaxed font-semibold">Priority home nursing checkups, geriatric therapists booking, and emergency alarm monitoring services.</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-4 text-xs font-semibold">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Active Geriatric Companions Mapped</span>
                
                <div className="space-y-2">
                  {[
                    { agency: "Metro Home Nurse Companions", service: "Critical Elderly Nursing & Vitals Tracking", contact: "011-234299" },
                    { agency: "Sohra Physiotherapy Group", service: "Post-trauma Rehab & Mobility Coaching", contact: "0124-78500" }
                  ].map((service, i) => (
                    <div key={i} className="p-3 bg-white border border-slate-155 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="font-black text-slate-805 text-[11px]">{service.agency}</p>
                        <p className="text-[9px] text-slate-400 leading-normal font-semibold font-sans mt-0.5">{service.service}</p>
                      </div>
                      <span className="text-[8px] font-mono font-black text-slate-500 bg-slate-100 hover:bg-slate-200 py-1 px-2 rounded-lg" title="Call Coordinator Bureau">
                        {service.contact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick dispatch home vitals test */}
              <div className="p-4.5 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 border border-indigo-150 rounded-2xl text-xs space-y-3 font-semibold">
                <h5 className="font-black text-indigo-900 leading-tight flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-indigo-600" /> Need Senior Home Nursing Assistance?
                </h5>
                <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                  Instantly book a certified city paramedic helper for physical companion tests, therapeutic routines, or emergency vitals screening at the home address.
                </p>
                <button
                  type="button"
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer"
                  onClick={() => triggerToast("Elder companion dispatch coordinated seamlessly. Our certified assistant will connect with you shortly.", "success")}
                >
                  Schedule Companion Visit
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* AI NUTRITION & RECOVERY HUB */}
        {activeTab === "nutrition" && (
          <motion.div
            key="nutrition"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Tagline & Wellness Mission Banner */}
            <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(circle_at_right_top,#10b981_0%,transparent_70%)] opacity-40 pointer-events-none" />
              <div className="relative z-10 max-w-2xl space-y-2">
                <span className="p-1 px-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1">
                  <ChefHat className="h-3 w-3 text-emerald-300 animate-pulse" /> Preventive Clinical Care
                </span>
                <h3 className="text-xl font-black uppercase tracking-wide">Diet Advisor & Lifestyle Care Engine</h3>
                <p className="text-xs text-emerald-100/80 leading-relaxed font-semibold">
                  Personalized dietary preventive support protocols, holistic recovery plans, and live meal trackers designed to align clinical therapy with clean living.
                </p>
                <p className="text-[10px] text-emerald-300/90 font-bold bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20 max-w-xl">
                  🌿 <span className="font-extrabold uppercase">Mission Directive:</span> "Food as Prevention. Recovery Through Better Living." Supporting safe home convalescence and therapeutic compliance.
                </p>
              </div>
            </div>

            {/* Dashboard Sub-navigation control center */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 hover:bg-slate-150 rounded-2xl w-fit">
              {[
                { id: "ayurdiet", label: "AyurDiet AI Advisor", icon: Sparkles },
                { id: "builder", label: "Care Engine & Plan Builder", icon: Zap },
                { id: "logger", label: "Smart Meal Photo Logger", icon: Camera },
                { id: "recovery", label: "Recovery & Fitness Tracks", icon: Heart },
                { id: "grocery", label: "AI Weekly Grocery Planner", icon: ShoppingBag },
                { id: "weekly", label: "Adherence Compliance Audit", icon: Award }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setNutritionSubTab(sub.id as any)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    nutritionSubTab === sub.id 
                      ? "bg-slate-900 text-white shadow-sm" 
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <sub.icon className="h-3.5 w-3.5 shrink-0" />
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Main Interactive Workspaces */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Frame: Selected Subsystem Workspace */}
              <div className="lg:col-span-8 space-y-6">
                
                 {/* 0. AYURDIET AI ADVISOR VIEW */}
                {nutritionSubTab === "ayurdiet" && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-6">
                    <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">🌿 AyurDiet AI Preventive Nutrition</h4>
                        <p className="text-[10px] text-slate-455 font-semibold font-sans mt-0.5">
                          Get customized Ayurvedic preventive diet charts using traditional Indian home remedies mapped for chronic conditions.
                        </p>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0">
                        <Sparkles className="h-3 w-3 animate-pulse" /> Gemini AI Powered
                      </span>
                    </div>

                    <form onSubmit={handleAyurDietCheck} className="grid sm:grid-cols-3 gap-4 bg-slate-50/50 p-4 border border-slate-150 rounded-2xl">
                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] font-black uppercase text-slate-400">Target Chronic Condition</label>
                        <select
                          value={ayurDietCondition}
                          onChange={(e) => setAyurDietCondition(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold text-xs"
                        >
                          <option value="Diabetes">Type-2 Diabetes</option>
                          <option value="Hypertension">Primary Hypertension (High BP)</option>
                          <option value="Asthma / Smog Sensitivity">Asthma & Smog Sensitivity</option>
                        </select>
                      </div>

                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] font-black uppercase text-slate-400">Dietary Choice</label>
                        <select
                          value={ayurDietPreference}
                          onChange={(e) => setAyurDietPreference(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold text-xs"
                        >
                          <option value="Veg">Pure Vegetarian</option>
                          <option value="Non-Veg">Non-Vegetarian / Eggetarian</option>
                        </select>
                      </div>

                      <div className="flex items-end bg-transparent">
                        <button
                          type="submit"
                          disabled={isAyurDietLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-3 rounded-xl shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isAyurDietLoading ? "Composing Plan..." : "Compose AyurDiet Chart"}
                        </button>
                      </div>
                    </form>

                    {ayurDietPlanResult && (
                      <div className="space-y-6 mt-4 border-t border-slate-100 pt-4 animate-fade-in text-xs">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <span className="bg-teal-200 text-teal-800 px-2.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider">Active Preventive Cover</span>
                            <h5 className="text-sm font-black text-slate-900 mt-1.5">{ayurDietPlanResult.condition} ({ayurDietPlanResult.dietOption})</h5>
                            <p className="text-slate-600 text-[11px] mt-0.5">Therapeutic Element: <strong className="text-teal-800 font-extrabold">{ayurDietPlanResult.ayurvedicElement}</strong></p>
                          </div>
                          <span className="bg-slate-900 text-white px-4 py-2 rounded-xl text-center font-bold font-mono text-xs">
                            {ayurDietPlanResult.energyProfile}
                          </span>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Daily Meal Checklist Schedule</h4>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {ayurDietPlanResult.schedule?.map((item: any, idx: number) => (
                              <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-2">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-slate-450 uppercase">{item.meal}</span>
                                  <p className="font-extrabold text-slate-950">{item.items}</p>
                                </div>
                                <p className="text-[10px] text-teal-800 bg-teal-50/50 p-2 rounded-lg font-bold">
                                  💡 {item.benefit}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                          <span className="text-[9px] font-black uppercase text-amber-700 tracking-wider">Traditional Ayurvedic Remedy Guidance</span>
                          <p className="text-slate-800 font-semibold mt-1 text-[11px] leading-relaxed">
                            📋 {ayurDietPlanResult.medicinalTip}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 1. PLAN BUILDER VIEW */}
                {nutritionSubTab === "builder" && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-6">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Therapeutic Care Diet Planner</h4>
                        <p className="text-[10px] text-slate-455 font-semibold font-sans">
                          Formulate supportive dietary frameworks using clinical recommendations for metabolic & vector recovery.
                        </p>
                      </div>
                      <Sparkles className="h-4 w-4 text-emerald-500 animate-spin" style={{ animationDuration: "8s" }} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Left: Input sliders and selectors */}
                      <div className="space-y-3.5 bg-slate-50/50 p-4 border border-slate-150 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Patient Demographics</span>
                        
                         {/* Demographic fields */}
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1 bg-transparent">
                            <label className="text-[9px] font-black text-slate-455 uppercase pl-1">Age group (Years)</label>
                            <input 
                              type="number" 
                              value={nutritionAge} 
                              onChange={(e) => setNutritionAge(e.target.value)}
                              onBlur={() => {
                                const parsed = parseInt(nutritionAge, 10);
                                if (isNaN(parsed) || parsed < 1) {
                                  setNutritionAge("1");
                                } else if (parsed > 120) {
                                  setNutritionAge("120");
                                } else {
                                  setNutritionAge(String(parsed));
                                }
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl p-2 font-bold text-xs focus:ring-1 focus:ring-emerald-400"
                            />
                          </div>

                          <div className="space-y-1 bg-transparent">
                            <label className="text-[9px] font-black text-slate-450 uppercase pl-1">Birth Gender</label>
                            <select 
                              value={nutritionGender} 
                              onChange={(e) => setNutritionGender(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl p-2 font-bold text-xs"
                            >
                              <option>Female</option>
                              <option>Male</option>
                              <option>Non-binary</option>
                            </select>
                          </div>
                        </div>

                        {/* Physical attributes */}
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1 bg-transparent">
                            <label className="text-[9px] font-black text-slate-450 uppercase pl-1">Height (cm)</label>
                            <input 
                              type="number" 
                              value={nutritionHeight} 
                              onChange={(e) => setNutritionHeight(e.target.value)}
                              onBlur={() => {
                                const parsed = parseFloat(nutritionHeight);
                                if (isNaN(parsed) || parsed < 30) {
                                  setNutritionHeight("30");
                                } else if (parsed > 250) {
                                  setNutritionHeight("250");
                                } else {
                                  setNutritionHeight(String(parsed));
                                }
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl p-2 font-bold text-xs"
                            />
                          </div>

                          <div className="space-y-1 bg-transparent">
                            <label className="text-[9px] font-black text-slate-450 uppercase pl-1">Weight (kg)</label>
                            <input 
                              type="number" 
                              value={nutritionWeight} 
                              onChange={(e) => setNutritionWeight(e.target.value)}
                              onBlur={() => {
                                const parsed = parseFloat(nutritionWeight);
                                if (isNaN(parsed) || parsed < 5) {
                                  setNutritionWeight("5");
                                } else if (parsed > 300) {
                                  setNutritionWeight("300");
                                } else {
                                  setNutritionWeight(String(parsed));
                                }
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl p-2 font-bold text-xs"
                            />
                          </div>
                        </div>

                        {/* Select food preference */}
                        <div className="space-y-1 bg-transparent">
                          <label className="text-[9px] font-black text-slate-450 uppercase pl-1">Dietary Category Profile</label>
                          <select 
                            value={nutritionPreference} 
                            onChange={(e) => setNutritionPreference(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold text-xs"
                          >
                            <option value="Indian Vegetarian">Indian Vegetarian (No Meat, includes dairy)</option>
                            <option value="Jain Vegetarian">Jain Vegetarian (Strict, no root veggies)</option>
                            <option value="Lacto-Vegetarian">Lacto-Vegetarian (Dairy, no egg)</option>
                            <option value="Plant-Based">Plant-Based / Clean Vegan</option>
                            <option value="High Protein Vegan">High Protein Vegan</option>
                            <option value="Diabetic Vegan">Diabetic-Safe Vegan</option>
                            <option value="Chicken-based">Chicken-based Non-Vegetarian</option>
                            <option value="Fish-based">Fish-based (Pescatarian)</option>
                            <option value="Egg-based">Egg-based (Eggitarian)</option>
                            <option value="Mixed diet">Mixed Balanced Diet</option>
                          </select>
                        </div>

                        {/* Activity Level */}
                        <div className="space-y-1 bg-transparent">
                          <label className="text-[9px] font-black text-slate-450 uppercase pl-1">Routine Physical Activity</label>
                          <select 
                            value={nutritionActivity} 
                            onChange={(e) => setNutritionActivity(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold text-xs"
                          >
                            <option>Sedentary / Desk Work</option>
                            <option>Light Cardio Walk (30m daily)</option>
                            <option>Active Exercise Routine</option>
                            <option>Intensive Heavy Physical Labor</option>
                          </select>
                        </div>
                      </div>

                      {/* Right: Disease specific targets checkbox list */}
                      <div className="space-y-3 p-4 bg-slate-50/50 border border-slate-150 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Supportive Disease-Specific Targets</span>
                        
                        <div className="space-y-1.5 max-h-[225px] overflow-y-auto pr-1">
                          {[
                            "Diabetes Support",
                            "Low-Sodium BP Support",
                            "Obesity Calorie Deficit",
                            "Fatty Liver Support",
                            "PCOS Hormone Support",
                            "Thyroid Metabolic Guard",
                            "Heart High Cholesterol Control",
                            "Anemia Iron Booster",
                            "Vitamin Deficiency Guard",
                            "Kidney Disease Mild Oversight",
                            "GERD Acidity Control",
                            "Constipation Fiber Boost",
                            "IBS Digestive Support"
                          ].map(cond => {
                            const isChecked = nutritionSelectedDiseases.includes(cond);
                            return (
                              <label key={cond} className="flex items-center gap-2 p-2 bg-white hover:bg-slate-100 border border-slate-150 rounded-xl cursor-pointer select-none text-[11px] font-bold text-slate-800 transition-all">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setNutritionSelectedDiseases(nutritionSelectedDiseases.filter(d => d !== cond));
                                    } else {
                                      setNutritionSelectedDiseases([...nutritionSelectedDiseases, cond]);
                                    }
                                  }}
                                  className="accent-slate-900"
                                />
                                <span className={isChecked ? "text-emerald-700 font-extrabold" : "text-slate-600"}>{cond}</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="bg-amber-50/70 border border-amber-150 rounded-xl p-2 text-[8px] text-amber-900 font-bold leading-normal">
                          ⚠️ Selecting targets automatically adjusts macronutrient constraints, sodium indicators, and triggers triggered ingredients.
                        </div>
                      </div>
                    </div>

                    {/* Auto generated daily meal prescription */}
                    {(() => {
                      // Generate dynamic values mapping user options
                      const isVegInput = nutritionPreference.toLowerCase().includes("veg") || nutritionPreference.toLowerCase().includes("plant");
                      const isHighProt = nutritionPreference.toLowerCase().includes("protein") || nutritionPreference.toLowerCase().includes("chicken") || nutritionPreference.toLowerCase().includes("fish") || nutritionPreference.toLowerCase().includes("egg");
                      
                      const hasDiabetes = nutritionSelectedDiseases.includes("Diabetes Support");
                      const hasHypertension = nutritionSelectedDiseases.includes("Low-Sodium BP Support");
                      const hasObesity = nutritionSelectedDiseases.includes("Obesity Calorie Deficit");
                      const hasGERD = nutritionSelectedDiseases.includes("GERD Acidity Control");

                      // Compute calories & carbs
                      let calReq = 1850;
                      if (nutritionActivity.includes("Heavy")) calReq += 300;
                      if (nutritionActivity.includes("Sedentary")) calReq -= 150;
                      if (hasObesity) calReq = 1380; // deficit

                      const weightNum = parseFloat(nutritionWeight) || 60;
                      const protReq = isHighProt ? Math.round(weightNum * 1.5) : Math.round(weightNum * 1.0);
                      const carbReq = hasDiabetes ? 140 : Math.round((calReq * 0.5) / 4);
                      const fatReq = Math.round((calReq * 0.25) / 9);

                      // Plan contents builder
                      let breakfast = "Sprouted Moong Salad topped with chopped cucumber, coriander, and fresh pomegranate kernels.";
                      let lunch = "2 Rotis cooked with Bran fiber, 1 bowl Thick Tur Dal, and a serving of dry steamed Cauliflower Bhaji cooked in cold-pressed oil.";
                      let dinner = "Bowl of slow-stewed Paneer Tikka Cubes with green capsicum, alongside a clean bowl of yellow Moong soup.";
                      let snacks = "Roasted Makhana kernels (1 cup) with warm organic Green Tea.";

                      if (isVegInput) {
                        if (nutritionPreference.includes("Jain")) {
                          breakfast = "Fresh Banana and apple bowl with soaked organic almonds (No root vegetables).";
                          lunch = "2 whole wheat pure Rotis, 1 bowl Yellow Moong Dal, boiled green peas & capsicum sauté.";
                          dinner = "Warm bowl of dry Moong soup with sautéed raw green tomatoes and fresh cheese cubes.";
                          snacks = "Roasted pumpkin kernels (handful) with herbal Tulsi brew.";
                        } else if (nutritionPreference.includes("Vegan") || nutritionPreference.includes("Plant-Based")) {
                          breakfast = "Warm Steel cut oats cooked in almond milk, topped with shredded organic walnuts and real berries.";
                          lunch = "Organic Quinoa bowl cooked with chopped tomatoes, organic French beans, and pan-fried Tofu blocks.";
                          dinner = "Stain-stewed soya bean chunks cooked in light spinach curry without heavy gravy oil, alongside brown rice bowl.";
                          snacks = "Soaked flaxseeds + walnuts with unsweetened black coffee.";
                        }
                      } else {
                        // Non-veg choices
                        if (nutritionPreference.includes("Egg")) {
                          breakfast = "2 scrambled whole organic eggs on grain bread, with sliced cherry tomatoes.";
                          lunch = "Jeera Brown Rice with 1 bowl aromatic egg curry cooked in light onion gravy.";
                          dinner = "Thick Egg white omelet cooked with finely chopped mushrooms and spinach.";
                          snacks = "Salted cucumber sticks with pumpkin oil sprinkle.";
                        } else if (nutritionPreference.includes("Fish")) {
                          breakfast = "Ragi Poha cooked with direct peanut oil, topped with fresh peanuts and lemon squeeze.";
                          lunch = "Boiled Basmati rice served with pan-seared fresh Rohu fish curry cooked in turmeric sauce.";
                          dinner = "Grilled Salmon slice with seasoned broccoli spears + warm black pepper clear lentil soup.";
                          snacks = "Handful of dry roasted walnuts and almonds.";
                        } else {
                          breakfast = "2 boiled organic egg whites served with light oats cereal in soy extract.";
                          lunch = "2 Bajra Rotis paired with 1 bowl pan-cooked country style Chicken breast curry (Low oil).";
                          dinner = "Steamed Chicken Breast soup with fresh green carrots, beans, and fresh bell peppers.";
                          snacks = "Chana Sprouts with mint sauce.";
                        }
                      }

                      // Adjust for clinical diseases
                      if (hasDiabetes) {
                        breakfast = "Methi (Fenugreek) seed water + " + breakfast;
                        lunch += " [Diabetes Alert: Strictly no white rice. Keep carb limits low. Option substituted with Bajra/Oats Roti].";
                        dinner += " [Diabetes Alert: Fiber rich salad before dinner highly advised to curb overnight glycemic spikes].";
                      }
                      if (hasHypertension) {
                        lunch += " [Hypertension Alert: Avoid pickles or processed iodized table salts. Substitute with hint of pink salt].";
                        dinner += " [Hypertension Alert: Packed with potassium-rich ingredients supporting healthy flow pressures].";
                      }
                      if (hasGERD) {
                        snacks += " [GERD Alert: Strictly no fried seed mixers, mint, or black tea to mitigate acid flow].";
                      }

                      return (
                        <div className="space-y-4">
                          <div className="p-4.5 bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-150 rounded-2.5xl space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-emerald-100 pb-3">
                              <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">AI Prescribed Plan Output</span>
                                <h5 className="font-extrabold text-[13px] text-slate-850">
                                  {nutritionPreference} Care Diet Chart
                                </h5>
                              </div>
                              <div className="flex flex-wrap gap-2 text-center text-xs font-mono font-black">
                                <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg">
                                  {calReq} kcal
                                </span>
                                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-lg">
                                  Protein: {protReq}g
                                </span>
                                <span className="bg-sky-100 text-sky-800 px-2 py-1 rounded-lg">
                                  Carbs: {carbReq}g
                                </span>
                                <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-lg">
                                  Fat: {fatReq}g
                                </span>
                              </div>
                            </div>

                            {/* Plan Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1 text-xs">
                              <div className="bg-white border border-emerald-50 rounded-xl p-3 space-y-1">
                                <p className="font-black text-slate-800 flex items-center gap-1.5 uppercase text-[9px] tracking-wider text-emerald-600">
                                  🍳 Sunrise Breakfast (08:30 AM)
                                </p>
                                <p className="text-[10px] text-slate-600 leading-normal font-semibold font-sans">{breakfast}</p>
                              </div>

                              <div className="bg-white border border-emerald-50 rounded-xl p-3 space-y-1">
                                <p className="font-black text-slate-800 flex items-center gap-1.5 uppercase text-[9px] tracking-wider text-indigo-600">
                                  🍛 Midday Lunch (01:30 PM)
                                </p>
                                <p className="text-[10px] text-slate-600 leading-normal font-semibold font-sans">{lunch}</p>
                              </div>

                              <div className="bg-white border border-emerald-50 rounded-xl p-3 space-y-1">
                                <p className="font-black text-slate-800 flex items-center gap-1.5 uppercase text-[9px] tracking-wider text-sky-600">
                                  🍏 Afternoon Refresh (05:00 PM)
                                </p>
                                <p className="text-[10px] text-slate-600 leading-normal font-semibold font-sans">{snacks}</p>
                              </div>

                              <div className="bg-white border border-emerald-50 rounded-xl p-3 space-y-1">
                                <p className="font-black text-slate-800 flex items-center gap-1.5 uppercase text-[9px] tracking-wider text-slate-800">
                                  🌙 Sunset Dinner (08:00 PM)
                                </p>
                                <p className="text-[10px] text-slate-600 leading-normal font-semibold font-sans">{dinner}</p>
                              </div>
                            </div>

                            {/* Water details */}
                            <div className="p-3 bg-white border border-emerald-100 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                              <p className="font-bold text-slate-700">
                                💧 Recommended Water Intake : <span className="font-black text-slate-900 font-mono">3.0 Liters Daily</span> (Adjusted for NCR Smog congestion factors)
                              </p>
                              <div className="flex gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextWater = Math.round((nutritionWaterLogged + 0.25) * 100) / 100;
                                    setNutritionWaterLogged(Math.min(6, nextWater));
                                  }}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-wider rounded-lg cursor-pointer"
                                >
                                  + Log 250ml cup
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNutritionWaterLogged(1.5);
                                  }}
                                  className="px-2 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 font-black text-[9px] uppercase tracking-wider rounded-lg"
                                >
                                  Reset
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Indian Food Nutrition Database Directory */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pl-1">
                              <div>
                                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Regional Indian Food Nutritional Guide</h5>
                                <p className="text-[9px] text-slate-400 font-bold">Standard Indian servings database. Click on any item to log immediately.</p>
                              </div>
                              <span className="p-1 px-2 text-[8px] font-extrabold uppercase font-mono tracking-widest bg-emerald-50 text-emerald-800 rounded">Interactive Directory</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                              {[
                                { group: "Vegetarian", label: "Dal Tadka (1 bowl)", cal: 150, prot: 8, icon: "🍲" },
                                { group: "Vegetarian", label: "Paneer Bhurji (150g)", cal: 260, prot: 18, icon: "🧀" },
                                { group: "Vegetarian", label: "Roti (1 Whole wheat)", cal: 85, prot: 3, icon: "🫓" },
                                { group: "Vegetarian", label: "Idli with Sambar", cal: 180, prot: 6, icon: "🍚" },
                                { group: "Vegan", label: "Tofu blocks (100g)", cal: 120, prot: 14, icon: "🍥" },
                                { group: "Vegan", label: "Soy chunks stir fry", cal: 170, prot: 22, icon: "🌱" },
                                { group: "Vegan", label: "Oats Porridge bowl", cal: 210, prot: 9, icon: "🥣" },
                                { group: "Non-Veg", label: "Boiled Eggs (2 organic)", cal: 140, prot: 12, icon: "🥚" },
                                { group: "Non-Veg", label: "Grilled Chicken Breast (150g)", cal: 240, prot: 31, icon: "🍗" },
                                { group: "Non-Veg", label: "Fish Tandoori Curry", cal: 210, prot: 24, icon: "🐟" }
                              ].map((food, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    const newMeal = {
                                      id: Date.now() + idx,
                                      hour: "Logged (Direct)",
                                      label: food.label,
                                      cal: food.cal,
                                      protein: food.prot,
                                      source: "Database Directory"
                                    };
                                    setNutritionLoggedMeals([newMeal, ...nutritionLoggedMeals]);
                                    triggerToast(`Successfully logged ${food.label} (${food.cal} kcal, ${food.prot}g protein) to your daily journal!`, "success");
                                  }}
                                  className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 hover:border-slate-350 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer group min-h-[75px]"
                                >
                                  <div className="flex justify-between items-start w-full">
                                    <span className="text-sm">{food.icon}</span>
                                    <span className="text-[7px] font-extrabold uppercase font-mono px-1 rounded bg-slate-200 text-slate-600 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-800">
                                      + Log item
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-extrabold text-[10px] text-slate-850 truncate leading-none mt-1">{food.label}</p>
                                    <p className="text-[8px] text-slate-400 font-mono font-bold mt-0.5">{food.cal} kcal • {food.prot}g protein</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 2. SMART PHOTO LOGGER VIEW */}
                {nutritionSubTab === "logger" && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-6">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Smart Meal Log & Photo Analysis</h4>
                        <p className="text-[10px] text-slate-455 font-semibold font-sans">
                          Instantly snapshot plates or coordinate meal entries with simulated computer-vision macros breakdown.
                        </p>
                      </div>
                      <Camera className="h-4 w-4 text-emerald-500" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      {/* Upload / Snapshot module (Span 7) */}
                      <div className="md:col-span-7 bg-slate-50 border border-slate-150 p-4.5 rounded-2.5xl space-y-4">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Simulate Food Camera Analysis</span>
                        
                        <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-3 bg-white relative overflow-hidden flex flex-col items-center justify-center min-h-[160px]">
                          {selectedPresetPhoto || customUploadedPhoto ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                              {/* Display mock scanning frame overlay */}
                              {isPhotoAnalysing && (
                                <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center z-10 text-white space-y-1 select-none">
                                  <div className="w-8 h-8 rounded-full border-2 border-t-emerald-405 border-slate-400 animate-spin" />
                                  <p className="text-[9px] font-mono tracking-widest uppercase font-extrabold animate-pulse">Running Vision Scan...</p>
                                </div>
                              )}
                              
                              <div className="text-center p-3 text-xs font-black text-slate-805 bg-slate-50 border border-slate-150 rounded-xl relative">
                                <p className="text-base">🍛</p>
                                <p className="text-[11px] leading-tight mt-1">{selectedPresetPhoto || customUploadedPhoto}</p>
                                <span className="text-[8px] font-mono font-bold text-slate-400 mt-0.5 block">Mock Photo Registered</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center space-y-1 bg-transparent">
                              <Camera className="h-7 w-7 text-slate-400 shrink-0" />
                              <p className="text-xs font-black text-slate-700 leading-snug">Drag and drop recipe photo here</p>
                              <p className="text-[9px] text-slate-400 leading-none">or tap local browse directory</p>
                            </div>
                          )}
                          
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setCustomUploadedPhoto(e.target.files[0].name);
                                setSelectedPresetPhoto(null);
                                handleAnalyzeMealPhoto(e.target.files[0].name);
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                          />
                        </div>

                        {/* Interactive Clickable Meal Presets */}
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1 block">Click standard local dishes sample to test:</span>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                              { label: "Samosa & Sweet Tea (High Carb, High Sodium)", name: "Samosa & Sweet Tea", linkPreset: "Samosa Preset" },
                              { label: "Organic Paneer Salad, Cucumber, Pomegranate (Protein)", name: "Paneer Salad Plate", linkPreset: "Paneer Salad Preset" },
                              { label: "Country Chicken Curry & Brown Rice", name: "Chicken & Brown Rice Meal", linkPreset: "Chicken Rice Preset" },
                              { label: "Tropical Fruit Bowl with chia seeds", name: "Fruit & Seed Mix", linkPreset: "Fruit Seed Preset" }
                            ].map(p => (
                              <button
                                key={p.name}
                                type="button"
                                onClick={() => {
                                  setSelectedPresetPhoto(p.name);
                                  setCustomUploadedPhoto(null);
                                  handleAnalyzeMealPhoto(p.name);
                                }}
                                className="p-2 bg-white hover:bg-slate-100 border border-slate-150 text-left rounded-xl font-bold text-[10px] text-slate-750 transition-all cursor-pointer"
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Analysis readout result (Span 5) */}
                      <div className="md:col-span-5 space-y-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Analyzer Readout Summary</span>

                        {photoAnalysisResult ? (
                          <div className="p-4 bg-slate-900 text-slate-100 border border-slate-850 rounded-2.5xl space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2 bg-transparent">
                              <span className="text-[8px] font-mono text-cyan-400 font-black uppercase tracking-widest">COGNITIVE ANALYSIS</span>
                              <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-400 font-mono text-[8px] font-black border border-emerald-900 rounded">
                                CONFIDENCE: 98%
                              </span>
                            </div>

                            <p className="font-black text-[12px] text-white leading-tight">{photoAnalysisResult.detectedDish}</p>
                            
                            <div className="grid grid-cols-2 gap-2 font-mono text-[10px] font-bold">
                              <div className="p-2 bg-slate-950 rounded-lg">
                                <span className="text-slate-400 block text-[8px] uppercase">Calories</span>
                                <span className="text-cyan-400 font-black text-xs">{photoAnalysisResult.cal} kcal</span>
                              </div>
                              <div className="p-2 bg-slate-950 rounded-lg">
                                <span className="text-slate-400 block text-[8px] uppercase">Protein</span>
                                <span className="text-emerald-400 font-black text-xs">{photoAnalysisResult.prot}g</span>
                              </div>
                            </div>

                            <div className="p-2.5 bg-slate-950 border border-slate-850 rounded-xl text-[9px] text-slate-350 leading-relaxed font-semibold">
                              <span className="font-extrabold text-white uppercase block mb-0.5">Clinical Feedback:</span>
                              {photoAnalysisResult.feedback}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const newLog = {
                                  id: Date.now(),
                                  hour: "Logged (Photo)",
                                  label: photoAnalysisResult.detectedDish,
                                  cal: photoAnalysisResult.cal,
                                  protein: photoAnalysisResult.prot,
                                  source: "Photo Analyzer"
                                };
                                setNutritionLoggedMeals([newLog, ...nutritionLoggedMeals]);
                                triggerToast(`Added "${photoAnalysisResult.detectedDish}" stats to daily dashboard log.`, "success");
                              }}
                              className="w-full py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-black text-[9px] uppercase tracking-wider rounded-lg cursor-pointer"
                            >
                              + Log calories in daily audit
                            </button>
                          </div>
                        ) : (
                          <div className="border border-slate-150 p-6 text-center rounded-2.5xl flex flex-col items-center justify-center min-h-[190px] bg-slate-50/50">
                            <Info className="h-6 w-6 text-slate-400" />
                            <p className="text-[10px] text-slate-450 leading-relaxed font-bold mt-2">
                              No active image analysis run. Click standard local dish presets or simulate custom uploaded snapshot scan.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meal Logger Table layout */}
                    <div className="space-y-2.5 pt-2">
                      <div className="flex justify-between items-center pl-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logged Meal Journal</span>
                        <button
                          type="button"
                          onClick={() => setNutritionLoggedMeals([])}
                          className="text-[9px] text-rose-600 hover:text-rose-700 font-black uppercase"
                        >
                          Clear Daily Logs
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {nutritionLoggedMeals.length > 0 ? (
                          nutritionLoggedMeals.map((m) => (
                            <div key={m.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex justify-between items-center text-xs">
                              <div className="space-y-0.5">
                                <p className="font-extrabold text-slate-800">{m.label}</p>
                                <div className="flex gap-1.5 items-center font-mono text-[9px] text-slate-400">
                                  <span>{m.hour}</span>
                                  <span>•</span>
                                  <span className="bg-slate-200/60 text-slate-500 font-extrabold px-1 rounded uppercase text-[7px] tracking-wide">{m.source}</span>
                                </div>
                              </div>
                              <div className="text-right font-mono font-black text-slate-800 space-y-0.5">
                                <p>{m.cal} kcal</p>
                                <p className="text-[9px] text-emerald-600">{m.protein}g protein</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 bg-slate-50 text-center text-slate-400 rounded-xl text-[10px] font-bold">
                            No nutritional metrics logged today. Add items from builder or camera scanner.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. RECOVERY & FITNESS PROTOCOLS VIEW */}
                {nutritionSubTab === "recovery" && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-6">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Medical Illness Recovery Tracks & programs</h4>
                        <p className="text-[10px] text-slate-455 font-semibold font-sans">
                          Aids recovery with specialized dietary benchmarks, diagnostic cautions, and hourly hydration triggers.
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-emerald-500" />
                    </div>

                    {/* Selector Tabs for recovery states */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "Dengue Recovery", label: "🦟 Dengue Fever" },
                        { id: "Typhoid Recovery", label: "🤒 Typhoid Care" },
                        { id: "Viral Fever Recovery", label: "🌡️ Viral Fever" },
                        { id: "Post-Hospital Recovery", label: "🏥 Post-Hospital" }
                      ].map(track => (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => {
                            setActiveRecoveryProtocol(track.id);
                            setRecoveryTipsAcknowledged([]);
                          }}
                          className={`p-2.5 rounded-xl border text-center font-black uppercase text-[10px] tracking-wider transition-all select-none cursor-pointer ${
                            activeRecoveryProtocol === track.id 
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                              : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-650"
                          }`}
                        >
                          {track.label}
                        </button>
                      ))}
                    </div>

                    {/* Subsystem active protocols readout card */}
                    {activeRecoveryProtocol && (() => {
                      let titleStr = "Dengue Convalescence Companion";
                      let introStr = "Promotes steady platelet regeneration and supports crucial clinical capillary hydration safeguards.";
                      
                      let parameters = [
                        { tag: "Hydration Status Indicator", val: "Critical (Target: 3.5 Liters)", desc: "Maintain water/coconut-water frequency" },
                        { tag: "Primary Dietary Goal", val: "Platelet support & soft digests", desc: "Papaya-leaf brew & high Vit-C" },
                        { tag: "Restrictive warning", val: "Avoid raw foods / Aspirin", desc: "No red pepper or spicy items" }
                      ];

                      let checklistTips = [
                        "Include 1 bowl cooked papaya leaf porridge or citrus kiwi extracts daily.",
                        "Track hematocrit blood volume levels continuously via Healer lab modules.",
                        "Consume 250ml coconut water every 3 hours for steady mineral balancing.",
                        "Avoid rough solids that irritate internal digestive lining pathways."
                      ];

                      if (activeRecoveryProtocol.includes("Typhoid")) {
                        titleStr = "Typhoid Care Diet Companion";
                        introStr = "Focuses on digestive rest, calorie-rich liquid nutrients, and gut flora rehydration protocols.";
                        parameters = [
                          { tag: "Digestion Parameter", val: "Ultra-Light Low residue", desc: "Clear thin lentil soup & soft starch" },
                          { tag: "Probiotic Booster status", val: "Required (2 cups Cow Curd)", desc: "Rebuild digestive friendly flora" },
                          { tag: "Restrictive warning", val: "Strictly omit fiber husks", desc: "No oats, raw fruit skin, or spice" }
                        ];
                        checklistTips = [
                          "Cook thick soft rice gruel (Khichdi) with double water ratios.",
                          "Avoid dry fibers, nuts, high seed seeds, and heavy raw leaf salads.",
                          "Take warm mineral broth every 4 hours to prevent metabolic core weariness.",
                          "Ensure clean source double-boiled water to prevent diagnostic relapses."
                        ];
                      } else if (activeRecoveryProtocol.includes("Viral")) {
                        titleStr = "Viral Fever Convalescence Helper";
                        introStr = "Prevents systemic core exhaustion and coordinates immune defense stabilization blocks.";
                        parameters = [
                          { tag: "Primary Objective", val: "Prevent catabolic lean wear", desc: "Thick double protein broths" },
                          { tag: "Hydration target", val: "3.2 L containing minerals", desc: "Fluids with electrolytes" },
                          { tag: "Restrictive warning", val: "Zero refined sugars", desc: "Prevents glucose spike sluggishness" }
                        ];
                        checklistTips = [
                          "Focus on hot garlic-scented chicken/lentil clear soup infusions.",
                          "Ensure at least 9 hours of uninterrupted circadian sleep cycles.",
                          "Include warm ginger extracts to reduce bronchial micro discomfort.",
                          "Check peak body temperatures every 4 hours via automated IoT charts."
                        ];
                      } else if (activeRecoveryProtocol.includes("Post-Hospital")) {
                        titleStr = "Post-Hospital Intensive Recovery";
                        introStr = "Supports cellular muscle rebuilding and targets systemic energy recovery goals.";
                        parameters = [
                          { tag: "Core Objective", val: "High anabolic energy buffer", desc: "Aim for 1.6g protein per body kg" },
                          { tag: "Muscle safeguard status", val: "Critical (Ensure Glutamine)", desc: "Lean fish, tofu, paneer clusters" },
                          { tag: "SLA physical warning", val: "Minimal load exertion", desc: "Active recovery walking only" }
                        ];
                        checklistTips = [
                          "Prescribe calculated high-protein meal plans (Builder module recommended).",
                          "Coordinate home companion assistants to monitor routine vitals check.",
                          "Log sleep metrics on City Healer biometric logs strictly.",
                          "Consult medical doctors before introducing heavy vitamin supplements."
                        ];
                      }

                      return (
                        <div className="p-4.5 bg-slate-50 border border-slate-150 rounded-2.5xl space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-205 pb-3">
                            <div>
                              <span className="text-[9px] font-mono text-emerald-600 font-black uppercase tracking-widest">Convalescent Support Protocol</span>
                              <h5 className="font-extrabold text-[13px] text-slate-850 mt-1">{titleStr}</h5>
                              <p className="text-[10px] text-slate-450 font-semibold font-sans mt-0.5">{introStr}</p>
                            </div>
                            <span className="p-1 px-2.5 bg-emerald-100 text-emerald-805 text-[8px] font-black rounded font-mono uppercase tracking-widest animate-pulse">
                              Active Protocol running
                            </span>
                          </div>

                          {/* Quick params stats */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {parameters.map((param, idx) => (
                              <div key={idx} className="bg-white border border-slate-200 p-3 rounded-2xl space-y-1">
                                <p className="text-[8px] font-black text-slate-450 uppercase tracking-wider">{param.tag}</p>
                                <p className="text-[11px] font-black text-slate-805 leading-tight">{param.val}</p>
                                <p className="text-[8px] text-slate-400 font-bold">{param.desc}</p>
                              </div>
                            ))}
                          </div>

                          {/* Action checklist */}
                          <div className="space-y-3 pt-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1 block">Hourly Proactive Recovery checklist:</span>
                            
                            <div className="space-y-2">
                              {checklistTips.map((tip, idx) => {
                                const isDone = recoveryTipsAcknowledged.includes(tip);
                                return (
                                  <label key={idx} className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer select-none text-[11px] font-bold text-slate-705 transition-all hover:bg-slate-100">
                                    <input 
                                      type="checkbox" 
                                      checked={isDone}
                                      onChange={() => {
                                        if (isDone) {
                                          setRecoveryTipsAcknowledged(recoveryTipsAcknowledged.filter(t => t !== tip));
                                        } else {
                                          setRecoveryTipsAcknowledged([...recoveryTipsAcknowledged, tip]);
                                        }
                                      }}
                                      className="accent-slate-900 mt-0.5" 
                                    />
                                    <span className={isDone ? "line-through text-slate-400" : "text-slate-700"}>{tip}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Integrated custom lifestyle wellness tracks fitness targets */}
                    <div className="space-y-3">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Target Lifestyle Enrichment Tracks</span>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {[
                          { title: "Senior Citizen Special Nutrition", limit: "Geriatric targeted, easy digestible bone-density minerals support", duration: "Continuous Track", linkC: "Senior Nutrition Details" },
                          { title: "Muscle Gain Dynamic Program", limit: "Rich protein synthesis, high calorie macro tracking targets", duration: "12-Week Routine", linkC: "Body Anabolic Builder" },
                          { title: "Pregnancy Preventive Maternity", limit: "Folate-rich micro enrichment, dynamic iron & calcium monitors", duration: "9-Month Support", linkC: "Maternal Health Support" },
                          { title: "Child Growth Peak Tracker", limit: "Protein density & pediatric growth factor supplements mapping", duration: "Ongoing Monitoring", linkC: "Pediatric Development" }
                        ].map((track, i) => (
                          <div key={i} className="p-3.5 bg-slate-50 border border-slate-150 rounded-2.5xl space-y-1">
                            <p className="font-extrabold text-[12px] text-slate-800 flex items-center gap-1">
                              <span className="text-[8px] bg-slate-205 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">TRACK</span>
                              {track.title}
                            </p>
                            <p className="text-[10px] text-slate-500 font-sans leading-relaxed">{track.limit}</p>
                            <div className="flex justify-between items-center text-[8px] font-mono font-black pt-1.5 text-slate-400 border-t border-slate-200">
                              <span>DURATION: {track.duration}</span>
                              <button
                                type="button"
                                onClick={() => triggerToast(`Enrolled into ${track.title} track dynamically! Weekly report logs updated.`, "success")}
                                className="text-emerald-600 hover:text-emerald-700 uppercase"
                              >
                                Activate Track +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. AI WEEKLY GROCERY PLANNER VIEW */}
                {nutritionSubTab === "grocery" && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-6">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">AI Prescribed Grocery Shopping List</h4>
                        <p className="text-[10px] text-slate-455 font-semibold font-sans">
                          Auto-derived from active care preferences. Mark off items as you complete transactions.
                        </p>
                      </div>
                      <ShoppingCart className="h-4 w-4 text-emerald-500 animate-pulse" />
                    </div>

                    {/* Shopping Category sections */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { 
                          category: "🥬 Therapeutic Vegetables & Greens", 
                          items: ["Fresh organic Papaya Leaves (Dengue platelet assist)", "Spinach Greens (Folate boost)", "Broccoli spears", "Lemons & Celery", "Cucumber & Bottle Gourd (Hydro ballast)"] 
                        },
                        { 
                          category: "🍎 Raw Fruits & Anti-Oxidant Berries", 
                          items: ["Fresh Kiwis (2 daily post-recovery)", "Apples & Citrus Oranges", "Pomegranate kernels", "Unsweetened dates"] 
                        },
                        { 
                          category: "💪 High Bio-Availability Proteins", 
                          items: ["Thick Cow Milk Paneer", "Organic Eggs cage-free", "Lentils combo (Masoor, Tur & Moong)", "Premium Tofu blocks", "Boneless skinless chicken breast close-cut"] 
                        },
                        { 
                          category: "💊 Clinical Supplements & Health Minerals", 
                          items: ["Vitamin D3 booster drops", "Vitamin B12 dietary tabs", "Iron Folic tablets", "Coconut Water bulk packs"] 
                        }
                      ].map((shop, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 border border-slate-150 rounded-2.5xl space-y-3">
                          <p className="font-extrabold text-[12px] text-slate-800">{shop.category}</p>
                          
                          <div className="space-y-2">
                            {shop.items.map((item) => {
                              const isChecked = groceryCheckedItems.includes(item);
                              return (
                                <label key={item} className="flex items-center gap-2 text-xs font-bold font-sans text-slate-750 p-1.5 bg-white hover:bg-slate-100 border border-slate-155 rounded-xl cursor-pointer select-none transition-all">
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setGroceryCheckedItems(groceryCheckedItems.filter(i => i !== item));
                                      } else {
                                        setGroceryCheckedItems([...groceryCheckedItems, item]);
                                      }
                                    }}
                                    className="accent-slate-900" 
                                  />
                                  <span className={isChecked ? "line-through text-slate-400 font-medium" : "text-slate-700"}>{item}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Integrated copy dispatch checkout instructions */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 bg-emerald-50 border border-emerald-150 rounded-2xl text-xs font-semibold">
                      <p className="text-emerald-900 leading-normal">
                        🛒 <span className="font-black uppercase">Instant Export:</span> Dispatched grocery indices are synced to partners. Link with nearby pharmacies & stores?
                      </p>
                      <button
                        type="button"
                        onClick={() => triggerToast(`Shopping list synced! Local store delivery partner assigned to address context in ${selectedCity}.`, "success")}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-[9px] uppercase tracking-wider rounded-lg shrink-0 cursor-pointer"
                      >
                        Order via local store
                      </button>
                    </div>
                  </div>
                )}

                {/* 5. AUDIT & WEEKLY ADHERENCE VIEW */}
                {nutritionSubTab === "weekly" && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-6">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Premium Weekly Adherence Compliance Report</h4>
                        <p className="text-[10px] text-slate-455 font-semibold font-sans">
                          Integrates dietary consistency parameters, recorded weight steps, and biochemical safe zones.
                        </p>
                      </div>
                      <Award className="h-4 w-4 text-emerald-500 animate-bounce" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
                      {/* Metric 1 */}
                      <div className="p-4 bg-slate-50 border border-slate-150 rounded-2.5xl space-y-2 text-center">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Adherence Score</span>
                        <p className="text-2xl font-[900] text-emerald-600 font-sans">94.2%</p>
                        <p className="text-[9px] text-slate-400 font-semibold leading-normal font-sans">Stably compliant tracking against target glycemic indexes.</p>
                      </div>

                      {/* Metric 2 */}
                      <div className="p-4 bg-slate-50 border border-slate-150 rounded-2.5xl space-y-2 text-center">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Weight Trend</span>
                        <p className="text-2xl font-[900] text-slate-905 font-sans">-1.1 kg</p>
                        <p className="text-[9px] text-slate-400 font-semibold leading-normal font-sans">Controlled steady contraction in body fat water metrics.</p>
                      </div>

                      {/* Metric 3 */}
                      <div className="p-4 bg-slate-50 border border-slate-150 rounded-2.5xl space-y-2 text-center">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Hydration Record</span>
                        <p className="text-2xl font-[900] text-sky-600 font-sans">Stable</p>
                        <p className="text-[9px] text-slate-400 font-semibold leading-normal font-sans">Optimal daily mineral hydration of {nutritionWaterLogged} L logged.</p>
                      </div>
                    </div>

                    {/* Progress bars visual charts */}
                    <div className="space-y-3 bg-slate-50 border border-slate-150 p-4 rounded-3xl">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block font-sans">Consolidated Weekly Metrics Chart</span>
                      
                      <div className="space-y-3 text-xs font-semibold">
                        {/* Day 1 */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-bold text-slate-650 font-sans text-[11px]">
                            <span>Monday (Calorie limit mapped)</span>
                            <span>95% adherence</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: "95%" }} />
                          </div>
                        </div>

                        {/* Day 2 */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-bold text-slate-650 font-sans text-[11px]">
                            <span>Tuesday (Active vector recovery)</span>
                            <span>88% adherence</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: "88%" }} />
                          </div>
                        </div>

                        {/* Day 3 */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-bold text-slate-650 font-sans text-[11px]">
                            <span>Wednesday (Protein intake targets)</span>
                            <span>92% adherence</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: "92%" }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Diagnostics Advice */}
                    <div className="p-4 bg-slate-900 border border-slate-850 rounded-2.5xl space-y-2 text-slate-200">
                      <div className="flex items-center gap-1 bg-transparent">
                        <Sparkles className="h-4 w-4 text-emerald-450 shrink-0" />
                        <span className="text-[9px] font-mono text-emerald-400 font-extrabold uppercase tracking-widest">Weekly Algorithmic Recommendation</span>
                      </div>
                      <p className="text-[10px] text-slate-350 leading-relaxed font-semibold">
                        Your consistent water metrics coupled with correct lean proteins logs support faster recovery parameters during active virus seasons. Increase vitamin C intake via fruit sources next week to boost immune defense metrics.
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Frame: Quick Stats & AI Scoring Panel */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Dynamic AI Nutrition Index Score CARD */}
                {(() => {
                  // Compute dynamic AI Nutrition index based on logs
                  // Base 55
                  // Logged meals influence
                  let logsBonus = Math.min(25, nutritionLoggedMeals.length * 6);
                  // Water influence: optimal 3.0 L
                  let waterBonus = Math.min(15, Math.round((nutritionWaterLogged / 3.0) * 15));
                  
                  // Selected Diseases complexity offsets
                  let penalty = Math.min(15, nutritionSelectedDiseases.length * 3);

                  let finalScore = Math.min(100, Math.max(12, 55 + logsBonus + waterBonus - penalty));

                  return (
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
                      <div className="flex justify-between items-center bg-transparent border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5 bg-transparent">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Live Health Indices</span>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        </div>
                        <Apple className="h-4 w-4 text-emerald-650" />
                      </div>

                      <div className="text-center space-y-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">AI Clinical Nutrition score</h4>
                        
                        <div className="relative py-1 flex justify-center items-center">
                          {/* Circular progress meter */}
                          <div className="w-32 h-32 rounded-full border-4 border-slate-100 flex flex-col justify-center items-center shadow-inner relative bg-slate-50/40 select-none">
                            <span className="text-4xl font-[950] text-slate-900 font-sans tracking-tight leading-none">{finalScore}</span>
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none mt-1">Nutrition Index</span>
                            
                            {/* Dynamic colored accent ring */}
                            <div className={`absolute inset-0 rounded-full border-t-4 border-r-4 animate-spin pointer-events-none ${
                              finalScore >= 85 ? "border-emerald-500/80" : finalScore >= 65 ? "border-amber-500/80" : "border-rose-500/80"
                            }`} style={{ animationDuration: "12s" }} />
                          </div>
                        </div>

                        {/* Verbal indicator label */}
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-transparent text-[9px] font-black uppercase tracking-wider">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            finalScore >= 85 ? "bg-emerald-500" : finalScore >= 65 ? "bg-amber-500" : "bg-rose-500"
                          }`} />
                          <span className={
                            finalScore >= 85 ? "text-emerald-700" : finalScore >= 65 ? "text-amber-700" : "text-rose-700"
                          }>
                            {finalScore >= 85 ? "Excellent Compliance" : finalScore >= 65 ? "Satisfactory Compliance" : "Defecit State Warning"}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Water Meter Control */}
                      <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl text-xs space-y-2 font-semibold">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                          <span>💧 Daily Water Intakes</span>
                          <span className="font-mono text-slate-900">{nutritionWaterLogged} / 3.0 Liters</span>
                        </div>

                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div className="bg-sky-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (nutritionWaterLogged / 3.0) * 100)}%` }} />
                        </div>

                        <div className="flex gap-2 justify-center pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              const nextWater = Math.round((nutritionWaterLogged + 0.25) * 100) / 100;
                              setNutritionWaterLogged(Math.min(6, nextWater));
                            }}
                            className="flex-1 py-1 px-2 text-center bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wide cursor-pointer"
                          >
                            + 250ml cup
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextWater = Math.round((nutritionWaterLogged + 0.75) * 100) / 100;
                              setNutritionWaterLogged(Math.min(6, nextWater));
                            }}
                            className="flex-1 py-1 px-2 text-center bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wide cursor-pointer"
                          >
                            + 750ml bottle
                          </button>
                        </div>
                      </div>

                      {/* Profile Overview Indicators */}
                      <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl text-[10px] space-y-1.5 font-semibold text-slate-700">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block pl-0.5">Target Patient Profile</span>
                        
                        <div className="flex justify-between items-center bg-transparent">
                          <span>Diet Category:</span>
                          <span className="font-extrabold text-slate-900 font-sans">{nutritionPreference}</span>
                        </div>

                        <div className="flex justify-between items-center bg-transparent">
                          <span>Clinical Targets:</span>
                          <span className="font-extrabold text-slate-905">{nutritionSelectedDiseases.length} condition targets</span>
                        </div>

                        <div className="flex justify-between items-center bg-transparent">
                          <span>Pending Checklist:</span>
                          <span className="font-extrabold text-indigo-700">{groceryCheckedItems.length} of 17 groceries bought</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Important Medical Safeguard Card (Strictly Required) */}
                <div className="bg-amber-50/75 border border-amber-205 rounded-3xl p-5 shadow-xs space-y-2.5">
                  <div className="flex items-center gap-1.5 text-amber-950 font-black">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Medical Disclaimer</span>
                  </div>
                  <p className="text-[10px] text-amber-808 font-bold leading-normal font-sans text-center">
                    "Nutrition plans are for wellness and supportive care only. They do not replace diagnosis, medications, or professional medical treatment. Users should consult qualified healthcare professionals for medical conditions."
                  </p>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delhi NCR Health Rankings index card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-1.5 pl-1">
          <TrendingUp className="h-4.5 w-4.5 text-slate-700 shrink-0" />
          <h4 className="text-xs font-black text-slate-850 uppercase tracking-widest">Delhi NCR Metropolitan Health Index (Rankings)</h4>
        </div>

        <p className="text-xs text-slate-450 pl-1 font-semibold leading-normal">
          Comparing metropolitan city indexes based on active physician load density, immediate intensive bed availability, and AQI respiratory status.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {sortedRankings.map((rank, i) => (
            <div 
              key={i} 
              className={`p-3.5 border rounded-2xl flex justify-between items-center ${
                rank.name === selectedCity 
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                  : "bg-slate-5 my-0.5 border-slate-150"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`text-[10px] font-black font-mono w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                  rank.name === selectedCity ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  #{i + 1}
                </span>
                <span className="text-xs font-black truncate max-w-[120px]">{rank.name}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black">{rank.score}</span>
                <span className={`text-[8px] font-extrabold uppercase px-1.5 rounded ${
                  rank.score >= 90 ? "bg-emerald-500/25 text-emerald-400" : rank.score >= 80 ? "bg-sky-500/25 text-sky-450" : "bg-amber-500/25 text-amber-400"
                }`}>
                  Index
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Dynamic Toast System */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-800 flex items-start gap-3"
          >
            <div className="flex-1 space-y-1.5 bg-transparent">
              <div className="flex items-center gap-1.5 bg-transparent">
                <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-emerald-450">SYSTEM NOTIFICATION</span>
              </div>
              <p className="text-[11px] text-slate-200 font-bold leading-normal font-sans">{toastMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white transition-colors font-extrabold text-[11px] p-1 uppercase tracking-wider block bg-transparent cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
