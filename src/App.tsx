/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Hospital as HospitalIcon,
  Cpu,
  Brain,
  Activity,
  Clock,
  ShieldAlert,
  ShoppingBag,
  CalendarDays,
  Ambulance,
  Send,
  CheckCircle,
  Mic,
  MicOff,
  ChevronRight,
  User,
  Plus,
  Trash2,
  MapPin,
  Search,
  Grid,
  FileText,
  Settings,
  Globe,
  HeartPulse,
  Sparkles,
  Filter,
  X,
  Stethoscope,
  AlertTriangle,
  Play,
  Heart,
  Droplet,
  Info,
  Phone,
  PlusCircle,
  UserCheck,
  Building,
  DollarSign,
  Shield,
  Award,
  Bell,
  LogOut,
  Key,
  Check,
  AlertCircle,
  Eye,
  Sliders,
  Tv,
  Fingerprint,
  ScanFace,
  Lock,
  ExternalLink,
  Navigation,
  Compass,
  Share2,
  Twitter,
  Linkedin,
  MessageCircle,
  Sun,
  Bot,
  IdCard,
  QrCode,
  RotateCcw,
  Upload,
  Signal,
  Radio,
  TrendingUp,
  Camera
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line, 
  ReferenceLine 
} from "recharts";
import { api } from "./utils/api";
import { getTranslation, LanguageCode, translations } from "./utils/i18n";
import {
  Hospital,
  Doctor,
  Appointment,
  QueueToken,
  MedicalRecord,
  MedicineProduct,
  MedicineOrder,
  EmergencyAlert
} from "./types";
import SmartDoctorNetwork from "./components/SmartDoctorNetwork";
import AIHealthTrends from "./components/AIHealthTrends";
import { MedicationVisualMatcher } from "./components/MedicationVisualMatcher";
import { AIMedicationGuide } from "./components/AIMedicationGuide";
import CityHealthNetwork, { CITIES_DATA } from "./components/CityHealthNetwork";
import { MedicineProductImage } from "./components/MedicineProductImage";
import LandingPage from "./components/LandingPage";
import { PageTransition } from "./components/animations/PageTransition";
import { GrainOverlay } from "./components/animations/GrainOverlay";
import { CustomCursor } from "./components/animations/CustomCursor";

export default function App() {
  // Current active viewport tab
  const [activeTab, setActiveTab] = useState<string>("overview");
  // Active Simulated Login Role: PATIENT, DOCTOR, HOSPITAL, ADMIN
  const [activeRole, setActiveRole] = useState<"PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN">("PATIENT");
  const [activeVerificationPill, setActiveVerificationPill] = useState<MedicineProduct | null>(null);
  const [userVerifColor, setUserVerifColor] = useState<string>("");
  const [userVerifShape, setUserVerifShape] = useState<string>("");
  const [userVerifMarkings, setUserVerifMarkings] = useState<string>("");
  const [verifResult, setVerifResult] = useState<{ status: "idle" | "verifying" | "pass" | "fail"; score?: number; message?: string } | null>(null);

  // --- CUSTOM ADDIITIONAL STATE FOR ALL LISTED FEATURES ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<"LOGIN" | "SIGNUP" | "FORGOT" | "OTP_VERIFY">("LOGIN");
  const [authEmail, setAuthEmail] = useState("raghavramghat@gmail.com");
  const [authPhone, setAuthPhone] = useState("+91 98101 22334");
  const [authName, setAuthName] = useState("Raghav Sharma");
  const [authOtpSent, setAuthOtpSent] = useState<string>("");
  const [authOtpInput, setAuthOtpInput] = useState("");
  const [authRoleSelection, setAuthRoleSelection] = useState<"PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN">("PATIENT");
  const [jwtToken, setJwtToken] = useState<string>("");

  // Family profile selector state (converted from static array to support adding new patients dynamically)
  const [activeFamilyMember, setActiveFamilyMember] = useState<string>("Self");
  const [familyMembers, setFamilyMembers] = useState<any[]>([
    { name: "Self", relation: "Primary User (Raghav Sharma)", gender: "Male", age: 34, bloodGroup: "O+", policyNo: "CH-POL-98101" }
  ]);

  // Addition fields for dynamic Patient onboarding
  const [isAddPatientOpen, setIsAddPatientOpen] = useState<boolean>(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientRelation, setNewPatientRelation] = useState("Spouse");
  const [newPatientGender, setNewPatientGender] = useState("Female");
  const [newPatientAge, setNewPatientAge] = useState<number>(30);
  const [newPatientBloodGroup, setNewPatientBloodGroup] = useState("O+");
  const [newPatientPolicy, setNewPatientPolicy] = useState("");
  const [dashboardSelectedCity, setDashboardSelectedCity] = useState<string>("Gurugram");

  // Feature Configuration Switcher state (enables/disables components in sidebar & portal dynamically)
  const [enabledFeatures, setEnabledFeatures] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("ggh-enabled-features");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      overview: true,
      "super-app": true,
      "smart-network": true,
      symptoms: true,
      beds: true,
      consultation: true,
      pharmacy: true,
      records: true,
      insurance: true,
      sos: true,
      admin: true,
    };
  });

  const handleToggleFeature = (featureId: string) => {
    const newVal = { ...enabledFeatures, [featureId]: !enabledFeatures[featureId] };
    setEnabledFeatures(newVal);
    localStorage.setItem("ggh-enabled-features", JSON.stringify(newVal));
    showToast(`⚙️ Tab module "${featureId}" is now ${newVal[featureId] ? "Enabled" : "Disabled"}`);
  };

  const handleAddNewPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) {
      showToast("⚠️ Type a valid name for the patient record to authenticate.");
      return;
    }
    if (familyMembers.some(fm => fm.name.toLowerCase() === newPatientName.trim().toLowerCase())) {
      showToast("⚠️ A clinical record with this name is already active.");
      return;
    }
    const policy = newPatientPolicy.trim() || `CH-POL-${Math.floor(10000 + Math.random() * 90000)}`;
    const newMember = {
      name: newPatientName.trim(),
      relation: newPatientRelation,
      gender: newPatientGender,
      age: Number(newPatientAge) || 30,
      bloodGroup: newPatientBloodGroup,
      policyNo: policy
    };

    setFamilyMembers(prev => [...prev, newMember]);
    setActiveFamilyMember(newMember.name);
    setIsAddPatientOpen(false);

    // Resetting form
    setNewPatientName("");
    setNewPatientPolicy("");
    setNewPatientRelation("Spouse");
    setNewPatientAge(30);
    setNewPatientBloodGroup("O+");
    showToast(`🎉 Clinical profile successfully generated & activated for: ${newMember.name}`);
  };

  // Dynamically update ABHA state fields with selected active family member's metadata details
  useEffect(() => {
    const currentPatient = familyMembers.find(f => f.name === activeFamilyMember);
    if (currentPatient) {
      setAbhaNameInput(currentPatient.name === "Self" ? authName : currentPatient.name);
      setAbhaGroupInput(currentPatient.bloodGroup === "O+" ? "O-Positive" : currentPatient.bloodGroup === "B+" ? "B-Positive" : currentPatient.bloodGroup === "A+" ? "A-Positive" : currentPatient.bloodGroup);
      setAbhaAgeInput(currentPatient.age);
    }
  }, [activeFamilyMember, authName, familyMembers]);

  // Pill reminders
  const [pillReminders, setPillReminders] = useState<any[]>([
    { id: 1, name: "Augmentin 625 Duo", dosage: "1 Tablet", time: "14:00", takenToday: false, frequency: "Twice daily after lunch" },
    { id: 2, name: "Allegra 120mg", dosage: "1 Pill", time: "21:00", takenToday: false, frequency: "Daily before bedtime" },
    { id: 3, name: "Limcee 500mg Chewable", dosage: "1 Tablet", time: "10:30", takenToday: true, frequency: "Once daily morning" }
  ]);
  const [newPillName, setNewPillName] = useState("");
  const [newPillDosage, setNewPillDosage] = useState("1 Tablet");
  const [newPillTime, setNewPillTime] = useState("12:00");
  const [newPillFrequency, setNewPillFrequency] = useState("Daily");

  // Map directions simulator
  const [mapSelectedHospital, setMapSelectedHospital] = useState<any>(null);
  const [mapDirectionsSteps, setMapDirectionsSteps] = useState<string[]>([]);
  const [mapDistance, setMapDistance] = useState<string>("");
  const [mapDuration, setMapDuration] = useState<string>("");
  const [ambulanceMarkerProgress, setAmbulanceMarkerProgress] = useState<number>(0);
  const [isAmbulanceTracking, setIsAmbulanceTracking] = useState<boolean>(false);

  // Insurance States
  const [insuranceSearch, setInsuranceSearch] = useState("");
  const [comparePolicyIds, setComparePolicyIds] = useState<string[]>([]);
  const [insuranceAge, setInsuranceAge] = useState<number>(35);
  const [insuranceFamilySize, setInsuranceFamilySize] = useState<string>("Self & Spouse");
  const [insurancePreExisting, setInsurancePreExisting] = useState<string>("Asthma / Smog Congestion");
  const [insurancePremiumBudget, setInsurancePremiumBudget] = useState<number>(15000);
  const [insuranceRecommendationResult, setInsuranceRecommendationResult] = useState<any | null>(null);

  // Dynamic compatibility mappings for custom widgets
  const hospitalCoords: Record<string, { x: number; y: number }> = {
    "hosp-1": { x: 130, y: 140 }, // AIIMS New Delhi
    "hosp-2": { x: 235, y: 210 }, // Medanta The Medicity
    "hosp-3": { x: 90, y: 180 },  // Fortis Escorts Heart
    "hosp-4": { x: 185, y: 155 }, // Max Super Specialty
    "hosp-5": { x: 245, y: 110 }, // Noida Fortis Hospital
    "hosp-6": { x: 220, y: 180 }, // Indraprastha Apollo Hospitals
    "hosp-7": { x: 110, y: 80 },  // Sir Ganga Ram Hospital
    "hosp-8": { x: 260, y: 70 },  // Max Super Speciality Hospital Vaishali
    "hosp-9": { x: 170, y: 260 }, // Metro Hospital & Heart Institute Faridabad
    "hosp-10": { x: 280, y: 250 } // Sharda Hospital Greater Noida
  };

  const selectedPoliciesToCompare = comparePolicyIds;
  const setSelectedPoliciesToCompare = setComparePolicyIds;

  const insuranceAgeSelect = insuranceAge === 35 ? "ADULT" : insuranceAge === 55 ? "SENIOR" : "FAMILY";
  const setInsuranceAgeSelect = (val: string) => {
    if (val === "SENIOR") setInsuranceAge(55);
    else if (val === "FAMILY") setInsuranceAge(35);
    else setInsuranceAge(28);
  };

  const insuranceDiseaseSelect = insurancePreExisting;
  const setInsuranceDiseaseSelect = setInsurancePreExisting;

  const insuranceAdviseResult = insuranceRecommendationResult ? {
    recommendedPlan: insuranceRecommendationResult.recommendedPolicy?.name || "Care Supreme Unlimited",
    matchScore: insuranceRecommendationResult.score,
    note: insuranceRecommendationResult.explanation
  } : null;

  const setInsuranceAdviseResult = (val: any) => {
    if (val === null) {
      setInsuranceRecommendationResult(null);
    }
  };

  const handleGenerateInsuranceAdvise = () => {
    handleAIInsuranceRecommendation();
  };

  // City Healer Premium Sub-tabs states
  const [recordsSubTab, setRecordsSubTab] = useState<"vault" | "abha" | "analyzer" | "vaccines">("vault");
  const [sosSubTab, setSosSubTab] = useState<"sos" | "blood">("sos");
  const [insuranceSubTab, setInsuranceSubTab] = useState<"private" | "welfare">("private");

  // ABHA Digital Health Card Generator States
  const [abhaAadhar, setAbhaAadhar] = useState("");
  const [abhaOtp, setAbhaOtp] = useState("");
  const [abhaStep, setAbhaStep] = useState<"AADHAAR" | "OTP" | "CARD">("AADHAAR");
  const [abhaLoading, setAbhaLoading] = useState(false);
  const [abhaCardData, setAbhaCardData] = useState<any>(null);

  // AI Lab Report Analyzer (OCR Interpret) States
  const [selectedReportTemplate, setSelectedReportTemplate] = useState("blood_cbc");
  const [isReportAnalyzing, setIsReportAnalyzing] = useState(false);
  const [reportAnalysisResult, setReportAnalysisResult] = useState<any>(null);
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);

  // Aarogya Blood & Organ Donor Network
  const [bloodQueryGroup, setBloodQueryGroup] = useState("O+");
  const [registeredAsDonor, setRegisteredAsDonor] = useState(false);
  const [donorRegName, setDonorRegName] = useState("");
  const [donorRegPhone, setDonorRegPhone] = useState("");
  const [donorRegBlood, setDonorRegBlood] = useState("O+");
  const [donorRegSector, setDonorRegSector] = useState("Dwarka Sector 12");
  const [donorRegAge, setDonorRegAge] = useState(25);
  const [broadcastActive, setBroadcastActive] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);

  // National Vaccination Schedule Checked state
  const [checkedVaccines, setCheckedVaccines] = useState<string[]>(["vac-1", "vac-2", "vac-3"]);

  // Government Welfare Scheme state
  const [welfareState, setWelfareState] = useState("Delhi");
  const [welfareIncome, setWelfareIncome] = useState(240000);
  const [welfareSector, setWelfareSector] = useState("Rural");
  const [welfareCategory, setWelfareCategory] = useState("EBC (Economically Backward Class)");
  const [welfareResult, setWelfareResult] = useState<any>(null);
  const [isWelfareChecking, setIsWelfareChecking] = useState(false);

  // User Real-Time Geolocation States
  const [userLocationCoords, setUserLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [userLocationName, setUserLocationName] = useState<string>("Your Device Position (Awaiting Permission)");
  const [locationStatusMessage, setLocationStatusMessage] = useState<string>("");
  const [isMapCenteredOnUser, setIsMapCenteredOnUser] = useState<boolean>(false);
  const [distanceFilter, setDistanceFilter] = useState<number>(30); // in km (max 30 matches all baseline hospitals nicely)

  const getDistanceToUser = (h: { lat: number; lng: number }) => {
    const currentCoords = userLocationCoords || { lat: 28.6139, lng: 77.2090 };
    const dx = h.lat - currentCoords.lat;
    const dy = h.lng - currentCoords.lng;
    return Math.sqrt(dx * dx + dy * dy) * 111.32;
  };

  const handleFindNearestHospital = () => {
    if (!navigator.geolocation) {
      showToast("❌ Geolocation is not supported by your browser");
      return;
    }

    setIsLocatingUser(true);
    setIsMapCenteredOnUser(true);
    showToast("📡 Connecting to medical GPS grid...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocationCoords({ lat: latitude, lng: longitude });
        setIsLocatingUser(false);
        setUserLocationName(`Live Coord (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        setLocationStatusMessage(`Coordinates acquired: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`);
        showToast("✅ Real-time location detected successfully!");
        
        // Find nearest hospital with available beds
        findAndHighlightClosest(latitude, longitude);
      },
      (error) => {
        setIsLocatingUser(false);
        // Fallback coordinates (Delhi Connaught Place) so user gets a great experience even if browser blocks permission in iframe!
        const fallbackLat = 28.6139;
        const fallbackLng = 77.2090;
        showToast("⚠️ GPS access blocked by browser sandboxing. Using baseline coordinates.");
        setUserLocationCoords({ lat: fallbackLat, lng: fallbackLng });
        
        // Find nearest hospital with available beds using fallback
        findAndHighlightClosest(fallbackLat, fallbackLng);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const findAndHighlightClosest = (userLat: number, userLng: number) => {
    if (!hospitals || hospitals.length === 0) {
      showToast("⚠️ Hospital registry is empty or loading.");
      return;
    }

    // Filter hospitals with available beds > 0
    const availableHospitals = hospitals.filter(h => h.availableBeds > 0);
    if (availableHospitals.length === 0) {
      showToast("⚠️ No hospitals currently report available emergency beds.");
      return;
    }

    // Calculate closest using Euclidean distance from coordinates
    let closestHosp = availableHospitals[0];
    let minDistance = Infinity;

    availableHospitals.forEach(h => {
      const dx = h.lat - userLat;
      const dy = h.lng - userLng;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestHosp = h;
      }
    });

    // Select this hospital on the map
    handleSelectHospitalMap(closestHosp);

    // Zoom and highlight the closest hospital
    showToast(`🏥 Found closest available: ${closestHosp.name} (${closestHosp.availableBeds} beds available)`);
  };

  const getUserRealTimeLocation = () => {
    if (!navigator.geolocation) {
      showToast("❌ Geolocation is not supported by your browser");
      setLocationStatusMessage("Geolocation unsupported");
      return;
    }
    
    setIsLocatingUser(true);
    setLocationStatusMessage("Contacting GPS satellites...");
    showToast("📡 Retrieving your real-time GPS coordinates...");
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocationCoords({ lat: latitude, lng: longitude });
        setIsLocatingUser(false);
        setLocationStatusMessage(`Coordinates acquired: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`);
        showToast("✅ Real-time location detected successfully!");
        setUserLocationName(`Live Coord (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      },
      (error) => {
        setIsLocatingUser(false);
        let errorMsg = "Unable to retrieve location";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Location permission denied or iframe blocked.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "GPS signal lost or position unavailable.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Location request timed out.";
        }
        setLocationStatusMessage(errorMsg);
        showToast(`⚠️ ${errorMsg}`);
        console.error("Location error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getGoogleMapsDirUrl = (hName: string, hAddress: string) => {
    const originParam = userLocationCoords 
      ? `&origin=${userLocationCoords.lat},${userLocationCoords.lng}` 
      : ""; // Leaving origin parameter out tells Google Maps to automatically query the user's authentic device GPS location
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${encodeURIComponent(hName)}+${encodeURIComponent(hAddress)}`;
  };

  // Biometric Auth & Settings States
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<"profiles" | "activity" | "features" | "system">("profiles");
  const [activityLog, setActivityLog] = useState<any[]>(() => {
    return [
      {
        id: "act-init-1",
        type: "symptom",
        title: "AI Symptom Diagnostic Check",
        description: "Assessed Throbbing tension headache & nausea. Suggested Suspected Migraine Tracker review.",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
        status: "Completed"
      },
      {
        id: "act-init-2",
        type: "order",
        title: "E-Pharmacy Medicine Dispatch",
        description: "Placed order: Ibuprofen 400mg (20 tablets) x 1. Total Paid: ₹156.40. Dispatch pending.",
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
        status: "Processing"
      },
      {
        id: "act-init-3",
        type: "appointment",
        title: "Specialist Appointment Scheduled",
        description: "Confirmed In-Person cardiology review booking with Dr. Ananya Sharma for 1 June, 10:30 AM",
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 24 hours ago
        status: "Scheduled"
      }
    ];
  });
  const [isBiometricEnabled, setIsBiometricEnabled] = useState<boolean>(false);
  const [isAppDarkMode, setIsAppDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("ggh-app-dark-mode") === "true";
  });

  const handleToggleDarkMode = () => {
    const nextVal = !isAppDarkMode;
    setIsAppDarkMode(nextVal);
    localStorage.setItem("ggh-app-dark-mode", String(nextVal));
    showToast(`🌙 Dark mode ${nextVal ? "enabled" : "disabled"}`);
  };
  const [showBiometricVerifyModal, setShowBiometricVerifyModal] = useState<boolean>(false);
  const [biometricVerifyType, setBiometricVerifyType] = useState<"FINGERPRINT" | "FACE">("FINGERPRINT");
  const [biometricVerifyStatus, setBiometricVerifyStatus] = useState<"IDLE" | "SCANNING" | "SUCCESS" | "FAILED">("IDLE");
  const [biometricTriggerSource, setBiometricTriggerSource] = useState<"ENROLL" | "LOGIN">("ENROLL");
  const [biometricProgress, setBiometricProgress] = useState<number>(0);
  const [biometricScanLog, setBiometricScanLog] = useState<string>("Standby - Awaiting verification gesture");

  // ==========================================
  // SUPER-APP SUITE STATES (Modules B, A, C, D)
  // ==========================================
  const [superActiveSubTab, setSuperActiveSubTab] = useState<"copilot" | "health-id" | "emergency" | "recommender">("copilot");

  // Module B: AI Health Copilot States
  const [appLanguage, setAppLanguage] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem("cityhealer_lang");
    return (saved === "hi" ? "hi" : "en") as LanguageCode;
  });
  const [copilotHistory, setCopilotHistory] = useState<Array<{ sender: "user" | "copilot"; text: string; time: string; attachment?: string }>>(() => {
    const saved = localStorage.getItem("cityhealer_lang");
    const isSavedHi = saved === "hi";
    return [
      {
        sender: "copilot",
        text: isSavedHi 
          ? "नमस्ते, राघव! मैं आपका सिटी हीलर एआई स्वास्थ्य कोपायलट हूं। मैं जटिल मेडिकल लैब रिपोर्ट की व्याख्या कर सकता हूं, विश्लेषण कर सकता हूं, और डॉक्टरों से मिला सकता हूं। आप क्या तलाशना चाहेंगे?"
          : "Namaste, Raghav! I am your City Healer AI Health Copilot. I can explain complex medical lab reports, analyze prescription dosages, track your recovery milestones, or match you with regional clinical specialists. What would you like to explore?",
        time: "10:45 AM"
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem("cityhealer_lang", appLanguage);
    setCopilotHistory(prev => {
      if (prev.length === 0) return prev;
      return prev.map((msg, idx) => {
        if (idx === 0 && msg.sender === "copilot") {
          const isEnGreeting = msg.text.startsWith("Namaste, Raghav!");
          const isHiGreeting = msg.text.startsWith("नमस्ते, राघव!");
          if (appLanguage === "hi" && isEnGreeting) {
            return {
              ...msg,
              text: "नमस्ते, राघव! मैं आपका सिटी हीलर एआई स्वास्थ्य कोपायलट हूं। मैं जटिल मेडिकल लैब रिपोर्ट की व्याख्या कर सकता हूं, विश्लेषण कर सकता हूं, और डॉक्टरों से मिला सकता हूं। आप क्या तलाशना चाहेंगे?"
            };
          } else if (appLanguage === "en" && isHiGreeting) {
            return {
              ...msg,
              text: "Namaste, Raghav! I am your City Healer AI Health Copilot. I can explain complex medical lab reports, analyze prescription dosages, track your recovery milestones, or match you with regional clinical specialists. What would you like to explore?"
            };
          }
        }
        return msg;
      });
    });
  }, [appLanguage]);
  const [copilotInputText, setCopilotInputText] = useState<string>("");
  const [copilotQuickAnalysisType, setCopilotQuickAnalysisType] = useState<string>("CBC");
  const [copilotSelectedDrug, setCopilotSelectedDrug] = useState<string>("Metformin");
  const [activeRecoveryProtocol, setActiveRecoveryProtocol] = useState<string>("delhi-smog");
  const [recoveryCheckedItems, setRecoveryCheckedItems] = useState<Record<string, boolean>>({
    "hydration": true,
    "plates": false,
    "bedrest": true,
    "aqi": false,
    "masks": true,
    "inhaler": false,
  });

  // Module A: Unified Health ID States
  const [abhaIdInput, setAbhaIdInput] = useState<string>("91-0421-8890-4412");
  const [abhaNameInput, setAbhaNameInput] = useState<string>("Raghav");
  const [abhaGroupInput, setAbhaGroupInput] = useState<string>("O-Positive");
  const [abhaAgeInput, setAbhaAgeInput] = useState<number>(31);
  const [abhaSyncing, setAbhaSyncing] = useState<boolean>(false);
  const [healthRecordsList, setHealthRecordsList] = useState<Array<{ id: string; title: string; hospital: string; date: string; type: string; status: "SYNCED" | "PENDING"; doctor: string }>>([
    { id: "rec-1", title: "Complete Blood Count (CBC) Report", hospital: "Max Gurgaon Memorial", date: "2026-05-12", type: "LAB_REPORT", status: "SYNCED", doctor: "Dr. Rajesh Sharma" },
    { id: "rec-2", title: "Chest X-Ray Contrast Screening", hospital: "Delhi Primus Hospital", date: "2026-03-24", type: "X_RAY", status: "SYNCED", doctor: "Dr. Naresh Trehan" },
    { id: "rec-3", title: "Post-op Cardiac Consultation", hospital: "Medanta Medicity Clinic", date: "2026-01-18", type: "PRESCRIPTION", status: "SYNCED", doctor: "Dr. Sushant Aggarwal" },
  ]);
  const [superNewRecordTitle, setSuperNewRecordTitle] = useState<string>("");
  const [superNewRecordHospital, setSuperNewRecordHospital] = useState<string>("Gurgaon Sector 45 General");
  const [superNewRecordType, setSuperNewRecordType] = useState<string>("prescription");

  // Module C: Emergency Network SOS States
  const [sosStateStatus, setSosStateStatus] = useState<"IDLE" | "COUNTDOWN" | "ACTIVE">("IDLE");
  const [sosCountDownVal, setSosCountDownVal] = useState<number>(3);
  const [liveAmbulanceEta, setLiveAmbulanceEta] = useState<number>(8);
  const [ambulanceProgressPercent, setAmbulanceProgressPercent] = useState<number>(10);
  const [selectedEmergencyHospital, setSelectedEmergencyHospital] = useState<string>("Gurgaon Central Trauma Care");
  const [icuVentilatorStats, setIcuVentilatorStats] = useState<Array<{ name: string; distance: string; icubeds: number; ventAvailable: number; status: "Critical" | "Stable" | "Vacant" }>>([
    { name: "Medanta Medicity Gurgaon", distance: "3.2 km", icubeds: 14, ventAvailable: 5, status: "Stable" },
    { name: "Gurgaon Sector 45 General Hospital", distance: "0.8 km", icubeds: 4, ventAvailable: 2, status: "Critical" },
    { name: "Fortis Memorial Research Institute", distance: "4.5 km", icubeds: 18, ventAvailable: 8, status: "Vacant" },
    { name: "Max Super Specialty Saket", distance: "12.0 km", icubeds: 24, ventAvailable: 11, status: "Stable" },
    { name: "Safdarjung Emergency Trauma Node", distance: "14.5 km", icubeds: 9, ventAvailable: 0, status: "Critical" },
  ]);

  // Module D: AI Doctor Recommendation Engine States
  const [matcherSymptomInput, setMatcherSymptomInput] = useState<string>("Cardiology / Chest Breathlessness");
  const [matcherBudgetTier, setMatcherBudgetTier] = useState<"ECONOMY" | "STANDARD" | "PREMIUM">("STANDARD");
  const [matcherInsuranceProvider, setMatcherInsuranceProvider] = useState<string>("Star Health Insurance");
  const [matcherDistanceRadius, setMatcherDistanceRadius] = useState<number>(10);
  const [matcherEmergencyPriority, setMatcherEmergencyPriority] = useState<"LOW" | "NORMAL" | "HIGH">("NORMAL");
  const [matcherIsLoading, setMatcherIsLoading] = useState<boolean>(false);
  const [matcherOutputDoctors, setMatcherOutputDoctors] = useState<Array<any>>([]);

  const startBiometricScanSimulation = () => {
    setBiometricVerifyStatus("SCANNING");
    setBiometricProgress(0);
    setBiometricScanLog("Establishing connection to device biometric array...");

    setTimeout(() => {
      setBiometricProgress(25);
      setBiometricScanLog(
        biometricVerifyType === "FINGERPRINT"
          ? "Sensing sub-epidermal pattern density and ridge alignment..."
          : "Analyzing multi-point facial depth arrays and contour topology..."
      );
    }, 600);

    setTimeout(() => {
      setBiometricProgress(65);
      setBiometricScanLog(
        biometricVerifyType === "FINGERPRINT"
          ? "Extracting minutiae mesh and parsing secure credential nodes..."
          : "Matching spatial core vector layers against cryptographically bound memory..."
      );
    }, 1300);

    setTimeout(() => {
      setBiometricProgress(90);
      setBiometricScanLog("Validating generated handshake packet through Secure Enclave...");
    }, 2000);

    setTimeout(() => {
      setBiometricProgress(100);
      setBiometricVerifyStatus("SUCCESS");
      setBiometricScanLog("Identity Auth Approved! Cryptographic ledger unlocked.");
      
      setTimeout(() => {
        if (biometricTriggerSource === "ENROLL") {
          setIsBiometricEnabled(true);
          showToast(`🔒 ${biometricVerifyType === "FINGERPRINT" ? "Fingerprint" : "Face ID"} Biometrics enrolled successfully!`);
        } else {
          setIsAuthenticated(true);
          setActiveRole(authRoleSelection);
          const fakeJwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + btoa(JSON.stringify({ name: authName, email: authEmail, role: authRoleSelection })) + ".signature";
          setJwtToken(fakeJwtToken);
          
          if (authRoleSelection === "ADMIN" || authRoleSelection === "HOSPITAL") {
            setActiveTab("admin");
          } else if (authRoleSelection === "DOCTOR") {
            setActiveTab("consultation");
          } else {
            setActiveTab("overview");
          }
          
          showToast(`🔒 Secure Biometric unlock approved! Welcome back, ${authName}. Role: ${authRoleSelection}`);
        }
        setShowBiometricVerifyModal(false);
      }, 1000);
    }, 2700);
  };

  const handleToggleBiometric = () => {
    if (isBiometricEnabled) {
      setIsBiometricEnabled(false);
      showToast("Biometric Authentication disabled.");
    } else {
      setBiometricTriggerSource("ENROLL");
      setBiometricVerifyStatus("IDLE");
      setBiometricProgress(0);
      setBiometricScanLog("Device sensor ready. Trigger simulated gesture to begin.");
      setShowBiometricVerifyModal(true);
    }
  };

  // ==========================================
  // SUPER-APP SUITE HANDLERS & SIMULATIONS
  // ==========================================

  const handleSendCopilotMessage = (customText?: string) => {
    const textToSend = customText || copilotInputText;
    if (!textToSend.trim()) return;

    // Append user message
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg = { sender: "user" as const, text: textToSend, time: timestamp };
    
    setCopilotHistory(prev => [...prev, userMsg]);
    if (!customText) {
      setCopilotInputText("");
    }

    // Generate smart mock reply
    setTimeout(() => {
      let aiResponseText = "";
      const lower = textToSend.toLowerCase();
      const isHindi = appLanguage === "hi";

      if (lower.includes("report") || lower.includes("blood") || lower.includes("cbc")) {
        aiResponseText = isHindi 
          ? "मैं देख रहा हूँ कि आप मेडिकल रिपोर्ट के बारे में पूछ रहे हैं। आप हमारे मुख्य 'दस्तावेज़ भंडारण' या 'रिपोर्ट विश्लेषक' साइड-पैनल में एक नमूना रिपोर्ट चुन सकते हैं जो आपके हीमोग्लोबिन, प्लेटलेट्स और रक्त गणना मेट्रिक्स को तुरंत समझाएगा।"
          : "I see you're asking about medical reports. You can select a sample report in the 'Report Analyzer (Lab Node 1)' diagnostic side-panel which compiles hemoglobin, platelets, and leukocyte metrics into understandable insights instantly!";
      } else if (lower.includes("dose") || lower.includes("med") || lower.includes("tablet") || lower.includes("metformin")) {
        aiResponseText = isHindi
          ? "समझ गया। नुस्खे और दवाओं के लिए: हमेशा खुराक कार्यक्रम की सावधानी से समीक्षा करें। आप चेतावनी और विपरीत प्रभावों को तुरंत प्राप्त करने के लिए हमारे 'ड्रग चेकअप' अनुभाग से मेटफॉर्मिन या अमोक्सिसिलिन जैसी दवाएं चुन सकते हैं।"
          : "Understood. For prescription checkers: always review dosage schedules. You can select specialized medicines (like Metformin or Amoxicillin) in our drug checkup module to instantly retrieve warning contraindications and interaction rules.";
      } else if (lower.includes("emergency") || lower.includes("sos") || lower.includes("ambulance")) {
        aiResponseText = isHindi
          ? "यदि आप किसी आपातकालीन स्थिति का सामना कर रहे हैं, तो कृपया हमारे 'रेड पैनिक एसओएस' आपातकालीन नेटवर्क पैनल पर जाएँ और लाल एसओएस दबाएं। यह तुरंत दिल्ली एनसीआर राजमार्गों पर एम्बुलेंस भेज देगा।"
          : "If you are experiencing an emergency, please switch to the 'Real-Time Emergency Network' panel and click the red SOS button. This routes a nearby Gurgaon-Expressway ambulance with critical care sensors and live telemetry!";
      } else if (lower.includes("doctor") || lower.includes("recommend") || lower.includes("best doctor")) {
        aiResponseText = isHindi
          ? "हाँ, मैं स्थान, बजट और बीमा कवर के आधार पर डॉक्टरों का मिलान कर सकता हूँ। हमारे 'स्मार्ट डॉक्टर नेटवर्क' पैनल पर जाएँ, अपने लक्षण दर्ज करें, और उपयुक्त डॉक्टर खोजें।"
          : "Yes, I can match you with representing doctors based on location, budget, and insurance. Head over to our 'Doctor Matcher' tab, input your target symptoms, and let the City Healer Matrix cross-reference wait-times!";
      } else {
        const responseBankEn = [
          "Healthy habits prevent minor seasonal fluctuations! Remember to maintain proper hydration and monitor air quality levels when heading out in the Delhi NCR region.",
          "According to Gurgaon health protocols, it is highly recommended to undergo blood metabolic scanning once every six months to detect early cardiovascular tendencies.",
          "City Healer is synchronized with 6 major regional hospitals. Your digital health record is encrypted to ensure safety. Let me know if I should detail any diagnostic file for you."
        ];
        const responseBankHi = [
          "स्वस्थ आदतें मौसमी बीमारियों से बचाव करती हैं! दिल्ली एनसीआर क्षेत्र में बाहर जाते समय उचित जलयोजन (हाइड्रेशन) और वायु गुणवत्ता स्तर की निगरानी रखें।",
          "स्वास्थ्य मानकों के अनुसार, हृदय से संबंधित जटिलताओं को टालने के लिए हर छह महीने में एक बार रक्त शर्करा और स्वास्थ्य जांच कराना उचित है।",
          "सिटी हीलर दिल्ली एनसीआर के प्रमुख क्षेत्रीय अस्पतालों और डॉक्टरों से सिंक्रनाइज़ है। आपका डिजिटल स्वास्थ्य रिकॉर्ड पूरी तरह से सुरक्षित है।"
        ];
        if (isHindi) {
          aiResponseText = responseBankHi[Math.floor(Math.random() * responseBankHi.length)];
        } else {
          aiResponseText = responseBankEn[Math.floor(Math.random() * responseBankEn.length)];
        }
      }

      setCopilotHistory(prev => [
        ...prev,
        { sender: "copilot" as const, text: aiResponseText, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
      ]);
    }, 850);
  };
  // Quick report analyzer triggers message to chat
  const handleCopilotQuickAnalyze = () => {
    let text = "";
    if (copilotQuickAnalysisType === "CBC") {
      text = "Analyze my Complete Blood Count (CBC) Lab Report.";
    } else if (copilotQuickAnalysisType === "MRI") {
      text = "Analyze my Brain MRI Contrast Scan.";
    } else {
      text = "Analyze my Urinalysis Summary Sheet.";
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setCopilotHistory(prev => [...prev, { sender: "user" as const, text, time: timestamp }]);

    setTimeout(() => {
      let analysisResult = "";
      if (copilotQuickAnalysisType === "CBC") {
        analysisResult = "📊 **AI REPORT INTERPRETATION : Complete Blood Count (CBC)**\n\n• **Hemoglobin: 12.2 g/dL** (Borderline low for males, normal for females). Might indicate mild iron fatigue.\n• **White Blood Cells (WBC): 8,500/mcL** (Optimal). Immune defenses are stably active.\n• **Platelet Count: 142,000/mcL** (Marginally Low, range 150k-450k). This is commonly observed on regional Delhi-NCR recovery protocols following dengue. Maintain hydration and check daily CBC levels.";
      } else if (copilotQuickAnalysisType === "MRI") {
        analysisResult = "🧠 **AI REPORT INTERPRETATION : Brain MRI Contrast Scan**\n\n• **Cerebral Hemispheres**: Symmetrical ventricles. No abnormal mass effect, edema, or shifts.\n• **Vascularity Pattern**: Normal flow void of major intracranial vessels detected.\n• **Clinical Impression**: Stably normal brain structure. Suggests headaches/vertigo could be related to optic strain or air smog toxins rather than structural lesions.";
      } else {
        analysisResult = "🧪 **AI REPORT INTERPRETATION : Urinalysis Summary Sheet**\n\n• **Specific Gravity: 1.028** (Slightly high, indicating mild dehydration). Hydrate with 2.5L clean water.\n• **Leukocyte Esterase**: Negative (No active urinary infection detected).\n• **Glucose & Protein**: Absent (Normoglycemic and optimal renal filtration).";
      }

      setCopilotHistory(prev => [
        ...prev,
        { sender: "copilot" as const, text: analysisResult, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
      ]);
      showToast("🔬 Lab report processed securely through City Healer Clinical Parser!");
    }, 1100);
  };

  // Medicine checker
  const handleCopilotDrugCheck = () => {
    const text = `Check dosage and interactions for ${copilotSelectedDrug}.`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setCopilotHistory(prev => [...prev, { sender: "user" as const, text, time: timestamp }]);

    setTimeout(() => {
      let drugCheckResult = "";
      if (copilotSelectedDrug === "Metformin") {
        drugCheckResult = "💊 **AI DRUG SPECIFICATIONS: Metformin Hydrochloride (500mg/850mg)**\n\n• **Primary Indication**: Type-2 Diabetes Mellitus Management (improves insulin sensitivity).\n• **Optimal Administration**: ALWAYS take immediately after meals to reduce gastrointestinal abdominal discomfort.\n• **⚠️ Critical Interaction Warning**: DO NOT consume heavy alcohol alongside Metformin due to elevated risks of Lactic Acidosis (rare but severe muscle/aerobic fatigue). Inform physician if taking contrast dyes.";
      } else if (copilotSelectedDrug === "Amoxicillin") {
        drugCheckResult = "💊 **AI DRUG SPECIFICATIONS: Amoxicillin Trihydrate (250mg/500mg)**\n\n• **Primary Indication**: Broad-spectrum penicillin antibiotic targeting respiratory & bacterial infections.\n• **Optimal Administration**: Complete the ENTIRE prescribed course even if symptoms disappear. Do not skip doses.\n• **⚠️ Critical Interaction Warning**: May reduce the efficacy of oral contraceptives. Inform doctor if you have penicillin allergies.";
      } else {
        drugCheckResult = "💊 **AI DRUG SPECIFICATIONS: Paracetamol (Acetaminophen) 650mg**\n\n• **Primary Indication**: Anti-pyretic (fever reducer) and analgesic (mild pain reliever).\n• **Optimal Administration**: Safe spacing is 4 to 6 hours. Maximum daily intake of 4,000mg to prevent hepatic overload.\n• **⚠️ Critical Interaction Warning**: Exercise strict safety if pairing with cold/cough multi-remedy syrups containing hidden acetaminophen.";
      }

      setCopilotHistory(prev => [
        ...prev,
        { sender: "copilot" as const, text: drugCheckResult, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
      ]);
      showToast("💊 Regional drug parameters verified against national clinical database.");
    }, 1100);
  };

  // Toggle recovery tracker items
  const handleToggleRecoveryItem = (key: string) => {
    setRecoveryCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Sync Unified ABHA Card across hospital grid nodes
  const handleSyncAbhaRecords = () => {
    setAbhaSyncing(true);
    showToast("🔗 Dispatching cryptographical hashes to onboarded regional clinics...");
    
    setTimeout(() => {
      setAbhaSyncing(false);
      showToast("✅ Unified Health ID records securely synced across 6 regional hospitals!");
    }, 1500);
  };

  // Add a new document to the Unified health records list
  const handleAddHealthRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!superNewRecordTitle.trim()) return;

    const newRec = {
      id: "rec-" + Date.now(),
      title: superNewRecordTitle,
      hospital: superNewRecordHospital,
      date: new Date().toISOString().split('T')[0],
      type: superNewRecordType.toUpperCase(),
      status: "SYNCED" as const,
      doctor: "Verified Practitioner"
    };

    setHealthRecordsList(prev => [newRec, ...prev]);
    setSuperNewRecordTitle("");
    showToast(`📁 Added & encrypted: "${newRec.title}" under Health ID profile.`);
  };

  // Real-time Emergency Network tracking and countdown loop
  const handleTriggerSOS = () => {
    if (sosStateStatus === "ACTIVE") {
      setSosStateStatus("IDLE");
      showToast("❌ Emergency SOS alert cancelled.");
      return;
    }

    setSosStateStatus("COUNTDOWN");
    setSosCountDownVal(3);
    showToast("🚨 Initializing immediate emergency call beacon in 3 seconds...");
  };

  // Trigger effect to count down
  useEffect(() => {
    let t: any = null;
    if (sosStateStatus === "COUNTDOWN") {
      t = setInterval(() => {
        setSosCountDownVal(prev => {
          if (prev <= 1) {
            clearInterval(t);
            setSosStateStatus("ACTIVE");
            setLiveAmbulanceEta(8);
            setAmbulanceProgressPercent(10);
            showToast("🚨 SOS TRANSMITTED! Family alerted & nearest trauma crew dispatched.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (t) clearInterval(t);
    };
  }, [sosStateStatus]);

  // Ambulance moving tracking animation timer
  useEffect(() => {
    let t: any = null;
    if (sosStateStatus === "ACTIVE") {
      t = setInterval(() => {
        setAmbulanceProgressPercent(prev => {
          if (prev >= 100) {
            setLiveAmbulanceEta(0);
            return 100;
          }
          const next = prev + 10;
          setLiveAmbulanceEta(Math.max(1, Math.round(8 * (1 - next / 100))));
          return next;
        });
      }, 4000); // speed up slightly for rich visual showcase
    }
    return () => {
      if (t) clearInterval(t);
    };
  }, [sosStateStatus]);

  // AI Doctor Matcher logic matching with local database
  const handleGenerateDoctorMatches = () => {
    setMatcherIsLoading(true);
    setMatcherOutputDoctors([]);
    showToast("🎯 Querying Delhi/NCR hospital networks, correlating specialties & live waits...");

    setTimeout(() => {
      // Find matches in local `doctors` state
      let matches = doctors.length > 0 ? [...doctors] : [
        { id: "doc-1", name: "Dr. Rajesh Sharma", specialty: "Pediatric Critical Care", rating: 4.9, experience: 14, patientsServed: 1200, online: true, waitTimeMin: 12, hospitalName: "Gurgaon Sector 45 General Hospital" },
        { id: "doc-2", name: "Dr. Naresh Trehan", specialty: "Cardio-Thoracic Surgery", rating: 4.8, experience: 28, patientsServed: 5400, online: true, waitTimeMin: 22, hospitalName: "Medanta Medicity Gurgaon" },
        { id: "doc-5", name: "Dr. Sushant Aggarwal", specialty: "General Internal Medicine", rating: 4.7, experience: 11, patientsServed: 950, online: true, waitTimeMin: 10, hospitalName: "Fortis Memorial Research Institute" }
      ];

      const sampleQuery = matcherSymptomInput.toLowerCase();
      // Perform a neat filtering based on query
      if (sampleQuery.includes("cardio") || sampleQuery.includes("chest") || sampleQuery.includes("heart")) {
        matches = matches.filter(d => d.specialty.toLowerCase().includes("card") || d.specialty.toLowerCase().includes("internal"));
      } else if (sampleQuery.includes("pediatric") || sampleQuery.includes("fever") || sampleQuery.includes("child")) {
        matches = matches.filter(d => d.specialty.toLowerCase().includes("pedi") || d.specialty.toLowerCase().includes("internal"));
      } else if (sampleQuery.includes("pulmon") || sampleQuery.includes("breath") || sampleQuery.includes("asthma") || sampleQuery.includes("cough")) {
        matches = matches.filter(d => d.specialty.toLowerCase().includes("pulm") || d.specialty.toLowerCase().includes("internal") || d.specialty.toLowerCase().includes("card"));
      }

      setMatcherOutputDoctors(matches);
      setMatcherIsLoading(false);
      showToast(`🎯 Success! Found ${matches.length} matches optimized for ${matcherInsuranceProvider}.`);
    }, 1500);
  };

  const handleShareProfile = () => {
    const isDoc = authRoleSelection === "DOCTOR";
    const displayName = isDoc ? authName : `Dr. ${authName}`;
    const nameSlug = encodeURIComponent(displayName.trim().replace(/\s+/g, "-").toLowerCase());
    const publicUrl = `${window.location.origin}/doctor/${nameSlug}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl)
        .then(() => {
          showToast(`📋 Public profile link copied to clipboard!\n${publicUrl}`);
        })
        .catch(() => {
          showToast("❌ Clipboard copy failed.");
        });
    } else {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = publicUrl;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        showToast(`📋 Public profile link copied to clipboard!\n${publicUrl}`);
      } catch (err) {
        showToast("❌ Clipboard copy failed.");
      }
      document.body.removeChild(textArea);
    }
  };

  const handleLaunchBiometricLogin = () => {
    setBiometricTriggerSource("LOGIN");
    setBiometricVerifyStatus("IDLE");
    setBiometricProgress(0);
    setBiometricScanLog(`Secure Login: Touch sensor or face scanner to pass verification.`);
    setShowBiometricVerifyModal(true);
  };

  // Telehealth Video Call Sim
  const [activeVideoCall, setActiveVideoCall] = useState<boolean>(false);
  const [videoCameraOn, setVideoCameraOn] = useState<boolean>(true);
  const [videoMicOn, setVideoMicOn] = useState<boolean>(true);
  const [videoScreenSharing, setVideoScreenSharing] = useState<boolean>(false);

  // Doctor rating
  const [ratedDoctorId, setRatedDoctorId] = useState<string>("");
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingReviewMsg, setRatingReviewMsg] = useState("");

  // Dynamic state stores
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queueTokens, setQueueTokens] = useState<QueueToken[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [medicines, setMedicines] = useState<MedicineProduct[]>([]);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState("");

  // UI state overlays
  const [loading, setLoading] = useState<boolean>(true);
  const [bookingDoc, setBookingDoc] = useState<Doctor | null>(null);
  const [consultingAppt, setConsultingAppt] = useState<Appointment | null>(null);
  const [selectedSOSHospital, setSelectedSOSHospital] = useState<string>("");

  // New Appointment Form fields
  const [apptSymptoms, setApptSymptoms] = useState("");
  const [apptDate, setApptDate] = useState("2026-05-29");
  const [apptTime, setApptTime] = useState("10:30 AM");
  const [apptType, setApptType] = useState<"VIRTUAL" | "IN_PERSON">("VIRTUAL");

  // Interactive Live Chat State
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // AI Symptom Checker Input & Results
  const [aiSymptoms, setAiSymptoms] = useState("");
  const [aiHistory, setAiHistory] = useState("");
  const [aiTesting, setAiTesting] = useState(false);
  const [aiReport, setAiReport] = useState<{
    suspectedCondition: string;
    explanation: string;
    specialistType: string;
    urgencyLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    recommendations: string[];
    flagUrgentSOS: boolean;
  } | null>(null);

  // Emergency SOS Form Details
  const [emergencyPhone, setEmergencyPhone] = useState("+91 98101 22334");
  const [emergencyAddress, setEmergencyAddress] = useState("Greater Kailash II, M-Block Market, New Delhi");
  const [emergencyType, setEmergencyType] = useState<"HEART_ATTACK" | "ACCIDENT" | "SEVERE_BREATHING" | "SEIZURE" | "OTHER">("SEVERE_BREATHING");
  const [sosDispatched, setSosDispatched] = useState<EmergencyAlert | null>(null);

  // Pharmacy Cart
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [checkoutAddress, setCheckoutAddress] = useState("Flat 402, Royal Residency, Sector 62, Noida");
  const [prescriptionAttached, setPrescriptionAttached] = useState(false);
  const [prescriptionFileName, setPrescriptionFileName] = useState("");
  const [pharmacyTab, setPharmacyTab] = useState<string>("all");
  const [pharmacySearchQuery, setPharmacySearchQuery] = useState("");
  const [isSearchingNationwide, setIsSearchingNationwide] = useState(false);
  const [nationwideSearchSource, setNationwideSearchSource] = useState("");

  // Visual Verification attachments / photo matching states for items in e-pharmacy cart
  const [cartItemPhotos, setCartItemPhotos] = useState<{ [medId: string]: string }>({});
  const [verifiedMatches, setVerifiedMatches] = useState<{
    [medId: string]: { color: boolean; shape: boolean; markings: boolean; affirmed: boolean };
  }>({});

  const handleSavePhoto = (medId: string, photoDataUrl: string | null) => {
    setCartItemPhotos((prev) => {
      const next = { ...prev };
      if (photoDataUrl === null) {
        delete next[medId];
      } else {
        next[medId] = photoDataUrl;
      }
      return next;
    });
  };

  const handleUpdateVerification = (
    medId: string,
    updates: Partial<{ color: boolean; shape: boolean; markings: boolean; affirmed: boolean }>
  ) => {
    setVerifiedMatches((prev) => {
      const current = prev[medId] || { color: false, shape: false, markings: false, affirmed: false };
      return {
        ...prev,
        [medId]: { ...current, ...updates }
      };
    });
  };

  // Medical Record Upload Form
  const [newRecordTitle, setNewRecordTitle] = useState("");
  const [newRecordSummary, setNewRecordSummary] = useState("");
  const [newRecordDoctor, setNewRecordDoctor] = useState("");
  const [newRecordAttachment, setNewRecordAttachment] = useState("lab_radiology_report.pdf");

  // Doctor Action Prescribe Panel
  const [prescriptionDiagnosis, setPrescriptionDiagnosis] = useState("");
  const [prescriptionMedicines, setPrescriptionMedicines] = useState<{ name: string; dosage: string; frequency: string; duration: string }[]>([
    { name: "", dosage: "", frequency: "", duration: "" }
  ]);
  const [prescriptionInstructions, setPrescriptionInstructions] = useState("");

  // Bed administration panel states
  const [adminHospSelect, setAdminHospSelect] = useState<string>("");
  const [adminAvailBeds, setAdminAvailBeds] = useState<number>(10);
  const [adminIcuAvail, setAdminIcuAvail] = useState<number>(2);
  const [adminOccupancy, setAdminOccupancy] = useState<number>(80);

  // Dynamic hospital onboarding form states
  const [onboardName, setOnboardName] = useState("");
  const [onboardAddress, setOnboardAddress] = useState("");
  const [onboardTotalBeds, setOnboardTotalBeds] = useState<number>(150);
  const [onboardIcuBeds, setOnboardIcuBeds] = useState<number>(20);
  const [onboardPhone, setOnboardPhone] = useState("");
  const [onboardEmail, setOnboardEmail] = useState("");
  const [onboardHasAmbulance, setOnboardHasAmbulance] = useState(true);
  const [onboardAmbulanceCount, setOnboardAmbulanceCount] = useState<number>(5);
  const [onboardHasTelemedicine, setOnboardHasTelemedicine] = useState(true);
  const [onboardHasOpdBooking, setOnboardHasOpdBooking] = useState(true);
  const [onboardIsGovernment, setOnboardIsGovernment] = useState(false);
  const [onboardSpecialties, setOnboardSpecialties] = useState("Trauma Care, Emergency Care");
  const [onboardCategories, setOnboardCategories] = useState<string[]>(["Private hospitals", "Emergency hospitals"]);

  // Add clinical specialist states
  const [addDocName, setAddDocName] = useState("");
  const [addDocSpecialty, setAddDocSpecialty] = useState("Cardiologist");
  const [addDocExperience, setAddDocExperience] = useState<number>(15);

  // Diagnostic Logs message notification toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Historical vitals state for Recharts
  const [vitalsHistory, setVitalsHistory] = useState([
    { date: "2026-05-22", bpSystolic: 122, bpDiastolic: 81, glucose: 95, pulse: 71, oxygen: 98 },
    { date: "2026-05-23", bpSystolic: 121, bpDiastolic: 80, glucose: 102, pulse: 72, oxygen: 99 },
    { date: "2026-05-24", bpSystolic: 124, bpDiastolic: 82, glucose: 110, pulse: 75, oxygen: 97 },
    { date: "2026-05-25", bpSystolic: 119, bpDiastolic: 79, glucose: 89, pulse: 73, oxygen: 98 },
    { date: "2026-05-26", bpSystolic: 118, bpDiastolic: 78, glucose: 92, pulse: 70, oxygen: 98 },
    { date: "2026-05-27", bpSystolic: 120, bpDiastolic: 80, glucose: 96, pulse: 74, oxygen: 98 },
    { date: "2026-05-28", bpSystolic: 122, bpDiastolic: 81, glucose: 98, pulse: 75, oxygen: 99 },
  ]);
  const [selectedTrendChart, setSelectedTrendChart] = useState<"all" | "bp" | "glucose" | "pulse">("all");
  const [vitalInputType, setVitalInputType] = useState<"bp" | "glucose" | "pulse">("bp");
  const [inputBPSystolic, setInputBPSystolic] = useState("120");
  const [inputBPDiastolic, setInputBPDiastolic] = useState("80");
  const [inputGlucose, setInputGlucose] = useState("95");
  const [inputPulse, setInputPulse] = useState("72");
  const [inputVitalDate, setInputVitalDate] = useState("2026-05-29");

  const handleAddVitalLog = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: any = {
      date: inputVitalDate,
      bpSystolic: vitalInputType === "bp" ? parseInt(inputBPSystolic) || 120 : undefined,
      bpDiastolic: vitalInputType === "bp" ? parseInt(inputBPDiastolic) || 80 : undefined,
      glucose: vitalInputType === "glucose" ? parseInt(inputGlucose) || 95 : undefined,
      pulse: vitalInputType === "pulse" ? parseInt(inputPulse) || 72 : undefined,
      oxygen: 98,
    };

    setVitalsHistory(prev => {
      const existingIdx = prev.findIndex(item => item.date === inputVitalDate);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          ...(vitalInputType === "bp" ? { bpSystolic: parseInt(inputBPSystolic) || 120, bpDiastolic: parseInt(inputBPDiastolic) || 80 } : {}),
          ...(vitalInputType === "glucose" ? { glucose: parseInt(inputGlucose) || 95 } : {}),
          ...(vitalInputType === "pulse" ? { pulse: parseInt(inputPulse) || 72 } : {}),
        };
        return updated.sort((a,b) => a.date.localeCompare(b.date));
      } else {
        const lastVal = prev[prev.length - 1] || { bpSystolic: 120, bpDiastolic: 80, glucose: 102, pulse: 72 };
        const fullEntry = {
          date: inputVitalDate,
          bpSystolic: vitalInputType === "bp" ? (parseInt(inputBPSystolic) || 120) : lastVal.bpSystolic,
          bpDiastolic: vitalInputType === "bp" ? (parseInt(inputBPDiastolic) || 80) : lastVal.bpDiastolic,
          glucose: vitalInputType === "glucose" ? (parseInt(inputGlucose) || 95) : lastVal.glucose,
          pulse: vitalInputType === "pulse" ? (parseInt(inputPulse) || 72) : lastVal.pulse,
          oxygen: 98
        };
        return [...prev, fullEntry].sort((a,b) => a.date.localeCompare(b.date));
      }
    });

    showToast(`Successfully logged ${vitalInputType.toUpperCase()} vitals data points!`);
  };

  // Fetch baseline state on startup and setup long-polling emulator
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const safeFetch = async <T,>(promise: Promise<T>, fallback: T, name: string): Promise<T> => {
          try {
            return await promise;
          } catch (e) {
            console.warn(`[Clinical Fetch Warning] Failed to load ${name} dynamically. Falling back to default:`, e);
            return fallback;
          }
        };

        const [hData, dData, aData, qData, rData, mData, oData, alData] = await Promise.all([
          safeFetch(api.getHospitals(), [], "hospitals"),
          safeFetch(api.getDoctors(), [], "doctors"),
          safeFetch(api.getAppointments(), [], "appointments"),
          safeFetch(api.getQueue(), [], "queueToken"),
          safeFetch(api.getRecords(), [], "records"),
          safeFetch(api.getMedicines(), [], "medicines"),
          safeFetch(api.getOrders(), [], "orders"),
          safeFetch(api.getEmergencyAlerts(), [], "alerts")
        ]);

        setHospitals(hData);
        setDoctors(dData);
        setAppointments(aData);
        setQueueTokens(qData);
        setRecords(rData);
        setMedicines(mData);
        setOrders(oData);
        setAlerts(alData);
      } catch (err) {
        console.error("Clinical system failed baseline parameters fetch:", err);
        showToast("Error loading healthcare registry.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
    getUserRealTimeLocation();

    // Minor poll loop to keep live hospital metrics synced
    const interval = setInterval(async () => {
      try {
        const [hData, alData, qData] = await Promise.all([
          api.getHospitals(),
          api.getEmergencyAlerts(),
          api.getQueue()
        ]);
        setHospitals(hData);
        setAlerts(alData);
        setQueueTokens(qData);
      } catch (e) {
        // Silent recovery
      }
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  // Voice-to-Text Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = appLanguage === "hi" ? "hi-IN" : "en-US";

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        showToast("Microphone permission denied. Please allow microphone access.");
      } else if (event.error === "network") {
        showToast("Network error occurred during speech recognition.");
      } else {
        showToast(`Speech recognition error: ${event.error}`);
      }
    };

    rec.onresult = (event: any) => {
      const latestResultIndex = event.results.length - 1;
      const transcript = event.results[latestResultIndex][0].transcript;
      if (transcript) {
        if (activeTab === "super-app" && superActiveSubTab === "copilot") {
          setCopilotInputText((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript.trim()}` : transcript.trim();
          });
        } else {
          setChatInput((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript.trim()}` : transcript.trim();
          });
        }
      }
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [activeTab, superActiveSubTab, appLanguage]);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      showToast("Speech recognition is not supported in this browser. Please try Chrome, Safari, or Edge.");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
        showToast("Could not start speech recognition. Access to microphone is required.");
      }
    }
  };

  // Chat stream refresh loop when active consultation is running
  useEffect(() => {
    let timer: any;
    if (consultingAppt) {
      const getMsgs = async () => {
        try {
          const msgs = await api.getChatMessages(consultingAppt.id);
          setChatMessages(msgs);
        } catch (e) {}
      };
      getMsgs();
      timer = setInterval(getMsgs, 3000);
    }
    return () => clearInterval(timer);
  }, [consultingAppt]);

  // Scroll chat window to base inside simulation panel
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Action methods
  const handleSOSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        type: emergencyType,
        patientName: activeFamilyMember === "Self" ? authName : activeFamilyMember,
        patientPhone: emergencyPhone,
        lat: 28.6139 + (Math.random() - 0.5) * 0.08,
        lng: 77.2090 + (Math.random() - 0.5) * 0.08,
        address: emergencyAddress
      };
      const response = await api.triggerSOS(payload);
      const allAlerts = await api.getEmergencyAlerts();
      setAlerts(allAlerts);
      setSosDispatched(response.alert);
      showToast(`EMERGENCY ALERT: Dispatch registered to ${response.alert.hospitalName}!`);
      
      // Auto-set state to highlight assigned clinical care unit
      const hps = await api.getHospitals();
      setHospitals(hps);
    } catch (err: any) {
      showToast("Trigger failure: " + err.message);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoc) return;
    try {
      const payload = {
        doctorId: bookingDoc.id,
        patientName: activeFamilyMember === "Self" ? authName : activeFamilyMember,
        time: apptTime,
        date: apptDate,
        symptoms: apptSymptoms,
        type: apptType
      };
      await api.createAppointment(payload);
      const appts = await api.getAppointments();
      const docs = await api.getDoctors();
      setAppointments(appts);
      setDoctors(docs);

      const newActivity = {
        id: "act-" + Math.random().toString(36).substring(2, 11),
        type: "appointment",
        title: "Clinical Appointment Booked",
        description: `Scheduled ${apptType === "VIRTUAL" ? "Virtual" : "In-Person"} consultation with Dr. ${bookingDoc.name} on ${apptDate} at ${apptTime} for patient ${payload.patientName}.`,
        timestamp: new Date().toISOString(),
        status: "Scheduled"
      };
      setActivityLog((prev) => [newActivity, ...prev]);

      setBookingDoc(null);
      setApptSymptoms("");
      showToast(`Appointment scheduled with ${bookingDoc.name}!`);
      setActiveTab("overview");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleOPDTokenRequest = async (docId: string) => {
    try {
      const ret = await api.takeQueueToken(docId, activeFamilyMember === "Self" ? authName : activeFamilyMember);
      const tokens = await api.getQueue();
      const docs = await api.getDoctors();
      setQueueTokens(tokens);
      setDoctors(docs);
      showToast(`OPD Queue active! Token ${ret.token.tokenNumber} issued.`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleCheckSymptoms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiSymptoms) {
      showToast("Please detail physical symptoms description.");
      return;
    }
    try {
      setAiTesting(true);
      setAiReport(null);
      const report = await api.checkSymptoms(
        aiSymptoms,
        aiHistory,
        userLocationCoords?.lat,
        userLocationCoords?.lng
      );
      setAiReport(report);

      const newActivity = {
        id: "act-" + Math.random().toString(36).substring(2, 11),
        type: "symptom",
        title: "AI Symptom Diagnostic Check",
        description: `Diagnosed Suspected ${report.suspectedCondition} (${report.urgencyLevel} urgency) for symptoms described: "${aiSymptoms.length > 60 ? aiSymptoms.substring(0, 60) + "..." : aiSymptoms}".`,
        timestamp: new Date().toISOString(),
        status: "Completed"
      };
      setActivityLog((prev) => [newActivity, ...prev]);

      showToast("Diagnosis complete. Review urgency details.");
    } catch (err: any) {
      showToast("AI model diagnostic mismatch: " + err.message);
    } finally {
      setAiTesting(false);
    }
  };

  const handleRetakeDiagnostic = () => {
    // Keep the current history context (aiHistory) pre-filled, so user retains medical context
    setAiSymptoms("");
    setAiReport(null);
    showToast("Re-fill and update symptoms. History preserved.");
    
    setTimeout(() => {
      const textarea = document.getElementById("ai-symptoms-input");
      if (textarea) {
        textarea.focus();
        textarea.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  // 1. ABHA Card Generator Handlers
  const handleTriggerABHAOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (abhaAadhar.replace(/\s/g, "").length !== 12) {
      showToast("⚠️ Standard India Aadhaar identity key must contain exactly 12 numeric digits.");
      return;
    }
    setAbhaLoading(true);
    showToast("📡 Contacting UIDAI Central Gateway to dispatch OTP...");
    setTimeout(() => {
      setAbhaLoading(false);
      setAbhaStep("OTP");
      showToast("🔑 Verification passcode generated! Check system broadcast SMS alert: 123456.");
    }, 1500);
  };

  const handleVerifyABHAOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (abhaOtp !== "123456") {
      showToast("❌ Mismatched OTP credentials. Please use bypass passcode 123456.");
      return;
    }
    setAbhaLoading(true);
    showToast("🔓 Authorizing Aadhaar token credentials and creating ABHA Registry account...");
    setTimeout(() => {
      const formattedAbhaNumber = `14-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const mockAbhaAddress = `${activeFamilyMember.toLowerCase().replace(/\s/g, "")}${Math.floor(10 + Math.random() * 90)}@abha`;
      setAbhaCardData({
        fullName: activeFamilyMember,
        birthYear: 1990 + Math.floor(Math.random() * 15),
        gender: "Male",
        abhaAddress: mockAbhaAddress,
        abhaNumber: formattedAbhaNumber,
        qrValue: `CITYHEALER-ABHA-${formattedAbhaNumber}`,
        createdDate: new Date().toLocaleDateString("en-IN"),
      });
      setAbhaLoading(false);
      setAbhaStep("CARD");
      showToast("🎉 Ayushman Bharat Digital ID (ABHA) Card generated and authorized!");
    }, 2000);
  };

  const handleResetABHAGenerator = () => {
    setAbhaAadhar("");
    setAbhaOtp("");
    setAbhaStep("AADHAAR");
    setAbhaCardData(null);
  };

  // 2. AI Lab Report Analyzer (OCR scan Interpreter)
  const handleAnalyzeLabReport = async () => {
    setIsReportAnalyzing(true);
    setReportAnalysisResult(null);
    setOcrLogs(["Initializing high-definition Optical Character Recognition (OCR) parser...", "Detecting cell coordinates inside regional laboratory layout..."]);
    
    setTimeout(() => {
      setOcrLogs(prev => [...prev, "Extracting text lines: 'Haemoglobin Assay', 'Serum TSH Level', 'Lipid Fraction'...", "Filtering background noise and matching biomarkers threshold parameters..."]);
    }, 800);

    setTimeout(() => {
      setOcrLogs(prev => [...prev, "Performing clinical semantic parsing against Indian health standards...", "Routing to City Healer AI Cloud reasoning engine..."]);
    }, 1600);

    setTimeout(async () => {
      try {
        const interpretation = await api.analyzeReport(selectedReportTemplate);
        setReportAnalysisResult(interpretation);
        showToast("📈 Scanning and analysis report complete! Diagnostics interpretation generated.");
      } catch (err: any) {
        showToast("Failed to fetch report summary: " + err.message);
      } finally {
        setIsReportAnalyzing(false);
      }
    }, 2500);
  };

  // 4. Government Welfare Scheme & Cards eligibility evaluator
  const handleWelfareCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWelfareChecking(true);
    setWelfareResult(null);
    showToast("🛡️ Sweeping India healthcare policies & income brackets criteria...");
    
    setTimeout(() => {
      let isPmJayEligible = false;
      let reasonPmJay = "";
      let genericDiscounts = "75% cheaper via Pradhan Mantri Jan Aushadhi generic network";
      let recommendedHospitals = "Apollo Delhi NCR regional government wings, Safdarjung, AIIMS Delhi";

      if (welfareIncome <= 250000) {
        isPmJayEligible = true;
        reasonPmJay = "Authorized: Annual family income is under ₹2.5 Lakhs (Below Poverty Line category). Covers standard cashless hospitalization up to ₹5 Lakhs.";
      } else {
        isPmJayEligible = false;
        reasonPmJay = "Ineligible for PM-JAY: Annual income exceeding ₹2.5 Lakhs threshold bracket. Recommended: CGHS (Central Govt Health Schemes) or Star Premium Wellness plans.";
      }

      setWelfareResult({
        primaryEligibility: isPmJayEligible ? "ELIGIBLE FOR CASHLESS SCHEME (Ayushman Bharat)" : "LIMITED CORE MUNICIPAL BENEFITS APPROVED",
        reasons: reasonPmJay,
        genericSavings: genericDiscounts,
        governmentHospitals: recommendedHospitals,
        timestamp: new Date().toLocaleDateString("en-IN")
      });
      setIsWelfareChecking(false);
      showToast("✅ Public healthcare scheme eligibility profile simulated.");
    }, 1500);
  };

  // 5. Voluntary Blood & Organ Donor Networks and Regional Broadcasts
  const handleRegisterAsDonor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorRegName || !donorRegPhone) {
      showToast("Please provide your name and phone number to sign up as a voluntary donor.");
      return;
    }
    setRegisteredAsDonor(true);
    showToast(`🩸 Welcome ${donorRegName}! You are registered as an active voluntary ${donorRegBlood} donor.`);
  };

  const handleStartBloodBroadcast = () => {
    setBroadcastActive(true);
    setBroadcastProgress(0);
    showToast("🚨 Broadcasting high-priority local emergency blood request alert...");

    const interval = setInterval(() => {
      setBroadcastProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setBroadcastActive(false);
          showToast("📡 Public broadcast complete: 16 matched donors within 6km alerted via SMS / Push notify.");
          return 100;
        }
        return prev + 25;
      });
    }, 1000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultingAppt || !chatInput.trim()) return;
    try {
      const senderRole = activeRole === "DOCTOR" ? "DOCTOR" : "PATIENT";
      await api.sendChatMessage(consultingAppt.id, senderRole, chatInput);
      setChatInput("");
      const msgs = await api.getChatMessages(consultingAppt.id);
      setChatMessages(msgs);
    } catch (err: any) {
      showToast("Failed to transmit dialog message.");
    }
  };

  const addToCart = (medId: string) => {
    setCart((prev) => ({ ...prev, [medId]: (prev[medId] || 0) + 1 }));
    showToast("Medicine item allocated to cart!");
  };

  const updateCartQty = (medId: string, q: number) => {
    if (q <= 0) {
      const next = { ...cart };
      delete next[medId];
      setCart(next);
    } else {
      setCart((prev) => ({ ...prev, [medId]: q }));
    }
  };

  const handlePlaceOrder = async () => {
    const items = Object.entries(cart).map(([medId, qty]) => {
      const med = medicines.find((p) => p.id === medId);
      return {
        medicineId: medId,
        name: med ? med.name : "Medicine Item",
        quantity: Number(qty),
        price: Number(med ? med.price : 10),
        // Securely pass visual identification photo attachments to backend orders list
        attachedPhoto: cartItemPhotos[medId] || undefined,
        verified: !!verifiedMatches[medId]?.affirmed
      };
    });

    const total = items.reduce((acc, it) => acc + it.price * it.quantity, 0);

    try {
      await api.placeOrder({
        items,
        totalAmount: total,
        prescriptionAttached,
        prescriptionName: prescriptionFileName || undefined,
        deliveryAddress: checkoutAddress,
        patientName: activeFamilyMember === "Self" ? authName : activeFamilyMember
      });

      const newActivity = {
        id: "act-" + Math.random().toString(36).substring(2, 11),
        type: "order",
        title: "E-Pharmacy Medicine Order",
        description: `Placed dispatch order for: ${items.map(i => `${i.name} (x${i.quantity})`).join(", ")}. Total Paid: ₹${total.toFixed(2)}. Deliver to: ${checkoutAddress}.`,
        timestamp: new Date().toISOString(),
        status: "Processing"
      };
      setActivityLog((prev) => [newActivity, ...prev]);

      setCart({});
      setCartItemPhotos({});
      setVerifiedMatches({});
      const ords = await api.getOrders();
      const meds = await api.getMedicines();
      setOrders(ords);
      setMedicines(meds);
      showToast("Prescription drugs dispatch order placed successfully!");
      setActiveTab("pharmacy");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleNationwideSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pharmacySearchQuery.trim()) {
      showToast("Please enter a medicine name or keyword to query nationwide.");
      return;
    }
    setIsSearchingNationwide(true);
    setNationwideSearchSource("");
    showToast(`Searching nationwide database for "${pharmacySearchQuery}"...`);
    try {
      const res = await api.searchNationwide(pharmacySearchQuery);
      if (res && res.matches) {
        setMedicines(res.matches);
        setNationwideSearchSource(res.source);
        showToast(`Nationwide catalog synchronized. Found ${res.matches.length} matching therapies.`);
      } else {
        showToast("Nationwide search completed with no additions.");
      }
    } catch (err: any) {
      console.warn("Nationwide AI lookup failed:", err);
      showToast("Dynamic nationwide registry query failed. Reverting to local cache.");
    } finally {
      setIsSearchingNationwide(false);
    }
  };

  const handleUploadRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecordTitle || !newRecordSummary) {
      showToast("Medical title and diagnostic review required.");
      return;
    }
    try {
      await api.uploadRecord({
        title: newRecordTitle,
        diagnoseSummary: newRecordSummary,
        doctorName: newRecordDoctor || "Self-Uploaded Scanner",
        attachmentName: newRecordAttachment
      });
      const recs = await api.getRecords();
      setRecords(recs);
      setNewRecordTitle("");
      setNewRecordSummary("");
      setNewRecordDoctor("");
      showToast("Digital Health Document added with index encryption!");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // Administration adjustments
  const handleUpdateClinicalBeds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminHospSelect) return;
    try {
      await api.updateHospitalBeds(adminHospSelect, {
        availableBeds: Number(adminAvailBeds),
        icuAvailable: Number(adminIcuAvail),
        emergencyOccupancy: Number(adminOccupancy)
      });
      const hps = await api.getHospitals();
      setHospitals(hps);
      showToast("Hospital allocation registers edited successfully.");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleOnboardHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardName || !onboardAddress) {
      showToast("Hospital name and verified physical address are required.");
      return;
    }
    try {
      const splitSpecs = onboardSpecialties.split(",").map((s) => s.trim()).filter(Boolean);
      await api.onboardHospital({
        name: onboardName,
        address: onboardAddress,
        totalBeds: Number(onboardTotalBeds) || 120,
        icuBeds: Number(onboardIcuBeds) || 15,
        phone: onboardPhone || "+91 (11) 5555-5555",
        email: onboardEmail || `contact@${onboardName.toLowerCase().replace(/[^a-z0-9]/g, "") || "hospital"}.com`,
        specialties: splitSpecs,
        categories: onboardCategories,
        hasAmbulanceSupport: onboardHasAmbulance,
        ambulanceSupportCount: Number(onboardAmbulanceCount) || 3,
        hasTelemedicine: onboardHasTelemedicine,
        hasOpdBooking: onboardHasOpdBooking,
        isGovernment: onboardIsGovernment
      });
      const hps = await api.getHospitals();
      setHospitals(hps);
      
      // Reset forms
      setOnboardName("");
      setOnboardAddress("");
      setOnboardPhone("");
      setOnboardEmail("");
      showToast(`Verified Network Onboarding Completed: Registered ${onboardName}!`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleAddClinicalDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminHospSelect) {
      showToast("Please select a target hospital to add clinical staff.");
      return;
    }
    if (!addDocName || !addDocSpecialty) {
      showToast("Doctor name and specialty department are required.");
      return;
    }
    try {
      await api.addHospitalDoctor(adminHospSelect, {
        name: addDocName,
        specialty: addDocSpecialty,
        experience: Number(addDocExperience) || 10,
        rating: 4.8,
        online: true
      });
      const docList = await api.getDoctors();
      setDoctors(docList);
      const hps = await api.getHospitals();
      setHospitals(hps);
      
      setAddDocName("");
      showToast(`Clinical staff onboarded: ${addDocName} has been assigned.`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleUpdateHospitalCapabilities = async (caps: any) => {
    if (!adminHospSelect) return;
    try {
      await api.updateHospital(adminHospSelect, caps);
      const hps = await api.getHospitals();
      setHospitals(hps);
      showToast("Hospital settings updated inside verified network.");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleToggleDoctorState = async (docId: string, status: boolean) => {
    try {
      await api.toggleDoctorOnline(docId, status);
      const docList = await api.getDoctors();
      setDoctors(docList);
      showToast(`Clinician status synchronized: ${status ? 'Online' : 'Offline'}`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDoctorSubmitPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultingAppt) return;
    try {
      const parsedMedicines = prescriptionMedicines.filter((m) => m.name.trim());
      await api.createPrescription(consultingAppt.id, {
        diagnosis: prescriptionDiagnosis,
        medicines: parsedMedicines,
        instructions: prescriptionInstructions
      });
      const appts = await api.getAppointments();
      setAppointments(appts);
      setConsultingAppt(null);
      setPrescriptionDiagnosis("");
      setPrescriptionInstructions("");
      setPrescriptionMedicines([{ name: "", dosage: "", frequency: "", duration: "" }]);
      showToast("Consultation closed. Clinical Prescription generated.");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleUpdateAlertStatus = async (alertId: string, status: "REPORTED" | "DISPATCHED" | "RESOLVED") => {
    try {
      await api.updateAlertStatus(alertId, status);
      const list = await api.getEmergencyAlerts();
      setAlerts(list);
      showToast(`Emergency dispatch state updated to: ${status}`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleUpdateTokenStatus = async (tokenId: string, status: "WAITING" | "IN_CONSULTATION" | "COMPLETED" | "SKIPPED") => {
    try {
      await api.updateQueueStatus(tokenId, status);
      const queueList = await api.getQueue();
      setQueueTokens(queueList);
      const docList = await api.getDoctors();
      setDoctors(docList);
      showToast(`Queue line altered. Patient is now: ${status}`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // --- ADDITIONAL CUSTOM LOGIC FOR CITY HEALER ---
  
  // 1. Simulated Authentication & OTP Flow
  const triggerSendOTP = () => {
    if (authMode === "SIGNUP") {
      if (!authName || !authName.trim()) {
        showToast("⚠️ Registration requires a valid Full Name.");
        return;
      }
      if (!authEmail || !authEmail.trim() || !authEmail.includes("@")) {
        showToast("⚠️ Registration requires a valid Email Address.");
        return;
      }
    }
    if (!authPhone || !authPhone.trim()) {
      showToast("⚠️ Please provide a valid Mobile Number (OTP Target).");
      return;
    }
    
    const simulatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setAuthOtpSent(simulatedOtp);
    setAuthMode("OTP_VERIFY");
    showToast(`🔒 City Healer OTP Key dispatched: ${simulatedOtp} (Enter to verify)`);
  };

  const handleVerifyOTP = () => {
    if (authOtpInput === authOtpSent || authOtpInput === "123456") {
      setIsAuthenticated(true);
      setActiveRole(authRoleSelection);
      const fakeJwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + btoa(JSON.stringify({ name: authName, email: authEmail, role: authRoleSelection })) + ".signature";
      setJwtToken(fakeJwtToken);
      
      // Fast route adjustments to showcase views on login based on selected role
      if (authRoleSelection === "ADMIN" || authRoleSelection === "HOSPITAL") {
        setActiveTab("admin");
      } else if (authRoleSelection === "DOCTOR") {
        setActiveTab("consultation");
      } else {
        setActiveTab("overview");
      }
      
      showToast(`🔑 Verification successful! JWT Token loaded securely. Role: ${authRoleSelection}`);
    } else {
      showToast("Invalid OTP code. Please trace SMS log alert.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthMode("LOGIN");
    setAuthOtpInput("");
    setAuthOtpSent("");
    setJwtToken("");
    showToast("Session security terminated.");
  };

  // 2. Medication Reminder System Action Handlers
  const toggleReminderTaken = (reminderId: number) => {
    setPillReminders(prev => prev.map(reminder => {
      if (reminder.id === reminderId) {
        return { ...reminder, takenToday: !reminder.takenToday };
      }
      return reminder;
    }));
    showToast("Medication adherence schedule adjusted.");
  };

  const handleAddPillReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPillName.trim()) return;
    const newRem = {
      id: Date.now(),
      name: newPillName,
      dosage: newPillDosage,
      time: newPillTime,
      takenToday: false,
      frequency: newPillFrequency
    };
    setPillReminders(prev => [...prev, newRem]);
    setNewPillName("");
    showToast(`⏰ Scheduled new medicine alert: ${newPillName}`);
  };

  // 3. Real-Time Google Maps Route Simulation
  const handleSelectHospitalMap = (hosp: any) => {
    setMapSelectedHospital(hosp);
    setIsAmbulanceTracking(false);
    setAmbulanceMarkerProgress(0);
    setIsMapCenteredOnUser(false);

    // Compute synthetic routes details for Delhi NCR based on chosen hospital
    const hostId = hosp.id;
    let dist = "6.5 km";
    let duration = "14 mins";
    let steps = [
      "Head North toward Outer Ring Rd",
      "Merge onto Mahatma Gandhi Rd / Ring Rd",
      "Keep right to stay on Ring Rd Bypass",
      "Destination will be on the left"
    ];

    if (hostId === "hosp-2") { // Medanta Gurugram
      dist = "26.5 km";
      duration = "45 mins";
      steps = [
        "Head West toward Connaught Place",
        "Merge onto NH-48 Expressway toward Gurugram",
        "Take exit 10 from NH-48",
        "Turn left toward CH Baktawar Singh Road"
      ];
    } else if (hostId === "hosp-3") { // Fortis Escorts
      dist = "12.4 km";
      duration = "22 mins";
      steps = [
        "Head East on Barakhamba Rd toward Mandi House",
        "Follow Mathura Rd to Sukhdev Vihar Okhla",
        "Take Okhla Flyover, turn left onto Okhla Road",
        "Fortis entrance will be straight ahead"
      ];
    } else if (hostId === "hosp-4") { // Max Saket
      dist = "11.8 km";
      duration = "25 mins";
      steps = [
        "Head South on Janpath toward Rajpath",
        "Continue toward Aurobindo Marg & Press Enclave Rd",
        "Turn left at Press Enclave Rd",
        "Max Saket will be on your right"
      ];
    } else if (hostId === "hosp-5") { // Noida Fortis
      dist = "19.5 km";
      duration = "32 mins";
      steps = [
        "Head East toward Pragati Maidan",
        "Merge onto Noida Toll Bridge / DND Flyway",
        "Keep right to take Sector 62 bypass expressway",
        "Fortis will be visible in Noida Sector 62 cluster"
      ];
    } else if (hostId === "hosp-6") { // Indraprastha Apollo Sarita Vihar
      dist = "15.2 km";
      duration = "28 mins";
      steps = [
        "Head South on Ring Road towards Ashram Flyover",
        "Keep left to continue on Mathura Rd / NH-19",
        "Pass Apollo Jasola Metro Station on the left",
        "Destination is on your left"
      ];
    } else if (hostId === "hosp-7") { // Sir Ganga Ram Rajinder Nagar
      dist = "4.8 km";
      duration = "12 mins";
      steps = [
        "Head West on Panchkuian Marg",
        "Turn left onto Pusa Road",
        "Turn right onto Sir Ganga Ram Hospital Marg",
        "Sir Ganga Ram Hospital is on the right"
      ];
    } else if (hostId === "hosp-8") { // Max Vaishali Ghaziabad
      dist = "14.6 km";
      duration = "24 mins";
      steps = [
        "Head Northeast on Vikas Marg",
        "Continue onto Link Road towards Vaishali",
        "Turn left after Radisson Blu Ghaziabad",
        "Max Vaishali will be on your left"
      ];
    } else if (hostId === "hosp-9") { // Metro Faridabad
      dist = "28.2 km";
      duration = "50 mins";
      steps = [
        "Head South on Mathura Rd / NH-19 towards Faridabad",
        "Take the flyover to Sector 15 Faridabad",
        "Turn left onto Sector 16A bypass road",
        "Destination will be on your left in 500m"
      ];
    } else if (hostId === "hosp-10") { // Sharda Hospital Greater Noida
      dist = "44.5 km";
      duration = "55 mins";
      steps = [
        "Merge onto Noida-Greater Noida Expressway",
        "Continue onto Pari Chowk towards Knowledge Park III",
        "Take second exit on the roundabout towards Sharda University",
        "Sharda Trauma & Medical Center is straight ahead"
      ];
    }

    setMapDistance(dist);
    setMapDuration(duration);
    setMapDirectionsSteps(steps);
    showToast(`🗺️ Routes loaded to ${hosp.name}. Total: ${dist} [ETA: ${duration}]`);
  };

  // Live tracking timer
  useEffect(() => {
    let trackingTimer: any;
    if (isAmbulanceTracking) {
      trackingTimer = setInterval(() => {
        setAmbulanceMarkerProgress(prev => {
          if (prev >= 100) {
            setIsAmbulanceTracking(false);
            showToast("🚑 Dispatch target arrived: Ambulance successfully reported at Trauma Center.");
            clearInterval(trackingTimer);
            return 100;
          }
          return prev + 5;
        });
      }, 500);
    }
    return () => clearInterval(trackingTimer);
  }, [isAmbulanceTracking]);

  const dispatchAmbulanceOnMap = () => {
    if (!mapSelectedHospital) {
      showToast("Please tap a hospital on the metropolitan list first to direct the tracker.");
      return;
    }
    setAmbulanceMarkerProgress(0);
    setIsAmbulanceTracking(true);
    showToast(`🚑 Dispatching Emergency GPS Ambulance Route under escort to ${mapSelectedHospital.name}!`);
  };

  // 4. Insurance Policy comparisons
  const availablePolicies = [
    { id: "pol-1", name: "Tata AIG Medicare Premier", provider: "Tata AIG", premiumYearly: 14500, coverageAmount: 1500000, features: ["Cashless at 6000+ centers", "Smog-Covered Pulmonology Clause", "Global Emergency Evacuation"], rating: "4.8" },
    { id: "pol-2", name: "Star Family Health Optima", provider: "Star Health", premiumYearly: 12200, coverageAmount: 1000000, features: ["Free Health Checkups annually", "Family Floater multi-cover", "Smog inhalers pre-cleared"], rating: "4.6" },
    { id: "pol-3", name: "HDFC ERGO Optima Secure", provider: "HDFC ERGO", premiumYearly: 18500, coverageAmount: 2000000, features: ["Double Cover instant bonus", "Full OPD reimbursement", "Nil copayment clause"], rating: "4.9" },
    { id: "pol-4", name: "Care Freedom Plan", provider: "Care Health", premiumYearly: 9800, coverageAmount: 500000, features: ["No pre-policy screening required", "SMOG Asthma diagnostics clause", "Pre-existing cover from Day 1"], rating: "4.4" }
  ];

  const togglePolicyComparison = (polId: string) => {
    setComparePolicyIds(prev =>
      prev.includes(polId) ? prev.filter(p => p !== polId) : [...prev, polId].slice(0, 3)
    );
  };

  const handleAIInsuranceRecommendation = () => {
    // Generate tailored recommender data
    let idealPolicy = availablePolicies[0];
    if (insurancePremiumBudget < 10000) {
      idealPolicy = availablePolicies.find(p => p.id === "pol-4") || availablePolicies[3];
    } else if (insurancePreExisting.toLowerCase().includes("asthma") || insurancePreExisting.toLowerCase().includes("smog")) {
      idealPolicy = availablePolicies.find(p => p.id === "pol-1") || availablePolicies[0];
    } else if (insuranceFamilySize.includes("Spouse") || insuranceFamilySize.includes("Family")) {
      idealPolicy = availablePolicies.find(p => p.id === "pol-2") || availablePolicies[1];
    } else {
      idealPolicy = availablePolicies.find(p => p.id === "pol-3") || availablePolicies[2];
    }

    setInsuranceRecommendationResult({
      recommendedPolicy: idealPolicy,
      explanation: `Based on an age of ${insuranceAge} and family scope of ${insuranceFamilySize}, with specific aerosol conditions: ${insurancePreExisting || "None"}, we recommend ${idealPolicy.name}. It covers pulmonological and bronchial smog treatment protocols fully, allowing you cashless reimbursement at leading trauma clinics in Delhi NCR.`,
      score: 96,
      subsidizedPremium: idealPolicy.premiumYearly - 1200
    });
    showToast("AI Copilot insurance computation finalized.");
  };

  // Helper selectors
  const totalBedsAvailable = hospitals.reduce((acc, h) => acc + h.availableBeds, 0);
  const totalIcuBedsAvailable = hospitals.reduce((acc, h) => acc + h.icuAvailable, 0);
  const myAppointments = appointments.filter((a) => a.patientId === "patient-default");
  const myQueueToken = queueTokens.find((q) => q.patientId === "patient-default" && q.status === "WAITING");

  const filteredDoctors = doctors.filter((d) => {
    if (!searchQuery) return true;
    return (
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.hospitalName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const cartTotalAmount = Object.entries(cart).reduce((total, [medId, qty]) => {
    const med = medicines.find((m) => m.id === medId);
    return total + (med ? med.price * Number(qty) : 0);
  }, 0);

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-300 ${isAppDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-900'}`}>
        {/* Dynamic floating particle backgrounds with soft medical blues */}
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl transition-opacity duration-300 ${isAppDarkMode ? 'bg-blue-900/20' : 'bg-blue-100/40'}`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl transition-opacity duration-300 ${isAppDarkMode ? 'bg-cyan-900/20' : 'bg-cyan-100/40'}`}></div>
        
        <div className={`w-full max-w-md rounded-[32px] p-8 relative z-10 shadow-2xl transition-all border ${isAppDarkMode ? 'bg-slate-900 border-slate-800 shadow-slate-950/45' : 'bg-white border-blue-100/80 shadow-blue-900/5'} space-y-6`}>
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <HeartPulse className="w-9 h-9 text-white animate-pulse" />
            </div>
            <h2 className={`text-2xl font-black tracking-tight ${isAppDarkMode ? 'text-gradient bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400' : 'text-blue-950'}`}>CITY HEALER</h2>
            <p className={`text-xs font-medium ${isAppDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Healing Cities Through Connected Care • Delhi NCR</p>
          </div>

          {authMode === "LOGIN" && (
            <div className="space-y-4">
              <div className={`p-1 rounded-2xl flex border transition-all ${isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-100/80 border-slate-200/40"}`}>
                <button 
                  onClick={() => setAuthMode("LOGIN")} 
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition-all border ${
                    isAppDarkMode 
                      ? "bg-slate-800 border-slate-700 text-white shadow-sm" 
                      : "bg-white text-blue-950 shadow-sm border-slate-200/30"
                  }`}
                >
                  Sign In
                </button>
                <button 
                  onClick={() => setAuthMode("SIGNUP")} 
                  className={`flex-1 text-center py-2 text-xs font-bold transition-all ${
                    isAppDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-blue-900"
                  }`}
                >
                  Register
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className={`text-[10px] uppercase font-bold tracking-wider ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Simulate Role Authorization</label>
                  <select 
                    value={authRoleSelection}
                    onChange={(e: any) => setAuthRoleSelection(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-blue-500 font-semibold mt-1 transition-all ${
                      isAppDarkMode 
                        ? "bg-slate-950 border-slate-800 text-slate-100 focus:bg-slate-900 cursor-pointer" 
                        : "bg-slate-55 border-slate-200 text-slate-900 focus:bg-white cursor-pointer"
                    }`}
                  >
                    <option value="PATIENT" className={isAppDarkMode ? "bg-slate-900 text-white" : ""}>PATIENT (Raghav Sharma / Family Profiles)</option>
                    <option value="DOCTOR" className={isAppDarkMode ? "bg-slate-900 text-white" : ""}>DOCTOR (Physician Care Portal)</option>
                    <option value="HOSPITAL" className={isAppDarkMode ? "bg-slate-900 text-white" : ""}>HOSPITAL ADMIN (Bed Allocation Coordinator)</option>
                    <option value="ADMIN" className={isAppDarkMode ? "bg-slate-900 text-white" : ""}>SYSTEM ADMIN (Delhi NCR Health Registry)</option>
                  </select>
                </div>

                <div>
                  <label className={`text-[10px] uppercase font-bold tracking-wider ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Mobile Number (OTP Target)</label>
                  <input 
                    type="text" 
                    value={authPhone} 
                    onChange={(e) => setAuthPhone(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-blue-500 font-semibold mt-1 transition-all ${
                      isAppDarkMode 
                        ? "bg-slate-950 border-slate-800 text-slate-100 focus:bg-slate-900" 
                        : "bg-slate-55 border-slate-200 text-slate-900 focus:bg-white"
                    }`}
                    placeholder="+91 98101 22334"
                  />
                </div>

                <div>
                  <label className={`text-[10px] uppercase font-bold tracking-wider ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Authorization Passcode</label>
                  <input 
                    type="password" 
                    defaultValue="••••••••"
                    className={`w-full border rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-blue-500 font-semibold mt-1 transition-all ${
                      isAppDarkMode 
                        ? "bg-slate-950 border-slate-800 text-slate-100 focus:bg-slate-900" 
                        : "bg-slate-55 border-slate-200 text-slate-900 focus:bg-white"
                    }`}
                  />
                  <div className="flex justify-between items-center mt-1.5">
                    <button 
                      onClick={() => setAuthMode("FORGOT")}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      Forgot Password?
                    </button>
                    <span className="text-[9px] text-slate-400 font-medium">Dual SMS Verification Active</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={triggerSendOTP}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs py-3.5 rounded-xl shadow-lg shadow-cyan-500/15 cursor-pointer transition-all active:scale-[0.98]"
              >
                Request OTP Dispatch
              </button>

              <div className="relative flex py-1 items-center">
                <div className={`flex-grow border-t ${isAppDarkMode ? "border-slate-800" : "border-slate-200/60"}`}></div>
                <span className="flex-shrink mx-4 text-[9px] uppercase font-bold text-slate-400 tracking-wider">or rapid authentication</span>
                <div className={`flex-grow border-t ${isAppDarkMode ? "border-slate-800" : "border-slate-200/60"}`}></div>
              </div>

              {isBiometricEnabled && (
                <button
                  type="button"
                  onClick={handleLaunchBiometricLogin}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2.5 cursor-pointer transition-all shadow-lg shadow-emerald-500/10 border border-emerald-500/30"
                >
                  {biometricVerifyType === "FINGERPRINT" ? (
                    <Fingerprint className="h-4.5 w-4.5 text-emerald-100 animate-pulse" />
                  ) : (
                    <ScanFace className="h-4.5 w-4.5 text-emerald-100 animate-pulse" />
                  )}
                  Unlock via Enrolled Biometrics
                </button>
              )}

              <button 
                type="button"
                onClick={() => {
                  setIsAuthenticated(true);
                  setActiveRole(authRoleSelection);
                  const fakeJwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + btoa(JSON.stringify({ name: authName, email: authEmail, role: authRoleSelection })) + ".signature";
                  setJwtToken(fakeJwtToken);
                  
                  if (authRoleSelection === "ADMIN" || authRoleSelection === "HOSPITAL") {
                    setActiveTab("admin");
                  } else if (authRoleSelection === "DOCTOR") {
                    setActiveTab("consultation");
                  } else {
                    setActiveTab("overview");
                  }
                  
                  showToast(`⚡ Rapid Authorized via Google OAuth! Welcome back, ${authName}. Role: ${authRoleSelection}`);
                }}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.65 0 3.13.57 4.3 1.69l3.22-3.22C17.56 1.63 14.99 1 12 1 7.35 1 3.39 3.63 1.5 7.5l3.86 3.03C6.27 7.54 8.92 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.65 2.83c2.13-1.97 3.36-4.87 3.36-8.49z" />
                  <path fill="#FBBC05" d="M5.36 14.47c-.24-.72-.37-1.49-.37-2.47s.13-1.75.37-2.47L1.5 6.5C.54 8.43 0 10.15 0 12s.54 3.57 1.5 5.5l3.86-3.03z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.65-2.83c-1.01.68-2.3 1.09-4.31 1.09-3.08 0-5.73-2.5-6.66-5.49L1.48 15.88C3.37 19.75 7.33 23 12 23z" />
                </svg>
                Continue with Google Secure Auth
              </button>
            </div>
          )}

          {authMode === "SIGNUP" && (
            <div className="space-y-4">
              <div className="flex bg-slate-100/80 border border-slate-200/40 p-1 rounded-2xl">
                <button 
                  onClick={() => setAuthMode("LOGIN")} 
                  className="flex-1 text-center py-2 text-xs font-bold text-slate-500 hover:text-blue-900"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => setAuthMode("SIGNUP")} 
                  className="flex-1 text-center py-2 text-xs font-bold rounded-xl bg-white text-blue-950 shadow-sm border border-slate-200/30"
                >
                  Register
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Simulate Role Authorization</label>
                  <select 
                    value={authRoleSelection}
                    onChange={(e: any) => setAuthRoleSelection(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer mt-1 font-semibold"
                  >
                    <option value="PATIENT">PATIENT (Raghav Sharma / Family Profiles)</option>
                    <option value="DOCTOR">DOCTOR (Physician Care Portal)</option>
                    <option value="HOSPITAL">HOSPITAL ADMIN (Bed Allocation Coordinator)</option>
                    <option value="ADMIN">SYSTEM ADMIN (Delhi NCR Health Registry)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Full Name</label>
                  <input 
                    type="text" 
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 mt-1 focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                    placeholder="Raghav Sharma"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Email Address</label>
                  <input 
                    type="email" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 mt-1 focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                    placeholder="raghavramghat@gmail.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mobile Number</label>
                  <input 
                    type="text" 
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 mt-1 focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                    placeholder="+91 98101 22334"
                  />
                </div>
              </div>

              <button 
                type="button"
                onClick={triggerSendOTP}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs py-3.5 rounded-xl shadow-lg shadow-cyan-500/15 cursor-pointer text-center transition-all active:scale-[0.98]"
              >
                Complete Registration Setup
              </button>
            </div>
          )}

          {authMode === "FORGOT" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-950 text-center uppercase tracking-wide">Reset Account Passcode</h3>
              <p className="text-xs text-slate-500 leading-normal text-center">
                Provide your registered mobile number under Delhi NCR registry system. We will broadcast a credentials repair link.
              </p>
              <input 
                type="text" 
                value={authPhone}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                placeholder="+91 98101 22334"
                onChange={(e) => setAuthPhone(e.target.value)}
              />
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setAuthMode("LOGIN")}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl cursor-pointer transition-all border border-slate-200/40"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    showToast("🔓 Password repair credentials dispatched successfully via SMS.");
                    setAuthMode("LOGIN");
                  }}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold text-xs py-3 rounded-xl cursor-pointer shadow"
                >
                  Send Reset Link
                </button>
              </div>
            </div>
          )}

          {authMode === "OTP_VERIFY" && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-blue-950 uppercase tracking-wider">SMS Key Authentication</h3>
                <p className="text-xs text-slate-500">Sent code to {authPhone}</p>
                {authOtpSent && (
                  <p className="text-xs text-blue-600 font-black bg-blue-50 inline-block px-3 py-1 rounded-lg border border-blue-100 mt-1 font-mono">
                    Dispatched Code: {authOtpSent}
                  </p>
                )}
              </div>

              <div>
                <input 
                  type="text" 
                  value={authOtpInput}
                  onChange={(e) => setAuthOtpInput(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-dashed border-blue-400 rounded-xl px-4 py-4 text-center text-lg font-black tracking-widest text-blue-600 focus:outline-none focus:bg-white focus:border-solid"
                  placeholder="------"
                  maxLength={6}
                />
                <p className="text-[10px] text-slate-400 text-center mt-2 leading-relaxed">
                  Tip: Look at the simulated code above, or use bypass override code <strong className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">123456</strong>
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setAuthMode("LOGIN")}
                  className={`flex-1 font-bold text-xs py-3 rounded-xl cursor-pointer border transition-all ${isAppDarkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/40"}`}
                >
                  Go Back
                </button>
                <button 
                  type="button"
                  onClick={handleVerifyOTP}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold text-xs py-3 rounded-xl cursor-pointer shadow-lg shadow-blue-500/15"
                >
                  Verify & Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === "overview") {
    return (
      <div className={`w-full font-sans antialiased selection:bg-cyan-500/20 transition-colors duration-300 ${isAppDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#F8FAFC] text-slate-900"}`}>
        <CustomCursor />
        <GrainOverlay />
        <PageTransition activeTab={activeTab} onChangeTab={(tab) => {
          setActiveTab(tab);
        }} />
        <LandingPage onNavigate={setActiveTab} hospitals={hospitals} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gridTemplateRows: "100%" }} className={`h-screen w-full font-sans overflow-hidden relative transition-colors duration-350 ${isAppDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <CustomCursor />
      <GrainOverlay />
      <PageTransition activeTab={activeTab} onChangeTab={(tab) => {
        setActiveTab(tab);
      }} />
      {/* Toast notifications */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-6 left-1/2 z-50 flex items-center gap-2.5 rounded-full bg-slate-900 px-6 py-3.5 text-xs font-semibold text-white shadow-xl shadow-slate-900/30"
          >
            <Sparkles className="h-4 w-4 text-cyan-400 animate-spin" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pill Visual Verification Modal */}
      <AnimatePresence>
        {activeVerificationPill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
            onClick={() => {
              setActiveVerificationPill(null);
              setVerifResult(null);
              setUserVerifColor("");
              setUserVerifShape("");
              setUserVerifMarkings("");
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] border border-slate-100 shadow-2xl p-6 md:p-8 max-w-2xl w-full text-slate-800 space-y-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 bg-blue-50 text-blue-600 text-[10px] font-black tracking-widest uppercase rounded">
                      Clinical Safety Standard
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      <Shield className="h-3 w-3" /> AI Authenticated
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-950 mt-1">
                    AI Pill Verification Platform
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cross-examine physical pill attributes against the certified database visual master image.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveVerificationPill(null);
                    setVerifResult(null);
                    setUserVerifColor("");
                    setUserVerifShape("");
                    setUserVerifMarkings("");
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Visual reference display */}
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden aspect-square">
                    <MedicineProductImage
                      imageUrl={activeVerificationPill.imageUrl}
                      name={activeVerificationPill.name}
                      pillsColor={activeVerificationPill.pillsColor}
                      pillsShape={activeVerificationPill.pillsShape}
                      pillsMarkings={activeVerificationPill.pillsMarkings}
                      dosageForm={activeVerificationPill.dosageForm}
                      category={activeVerificationPill.category}
                      requiresPrescription={activeVerificationPill.requiresPrescription}
                      aspectRatio="square"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 backdrop-blur-xs p-3 text-white z-10 select-none">
                      <p className="text-xs font-black truncate">{activeVerificationPill.name}</p>
                      <p className="text-[10px] opacity-80 mt-0.5 font-semibold">Category: {activeVerificationPill.category}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2.5">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      🧪 Master Pharmaceutical Index
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">Standard Color</span>
                        <span className="font-extrabold text-slate-900">{activeVerificationPill.pillsColor}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Certified Shape</span>
                        <span className="font-extrabold text-slate-900">{activeVerificationPill.pillsShape}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block font-medium">Debossed Markings / Indent</span>
                        <span className="font-extrabold text-slate-900">{activeVerificationPill.pillsMarkings}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verification Check panel */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="border-b border-dashed border-slate-200 pb-3">
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Physical Self-Inspection
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Look closely at the pill you received. Enter its traits to perform safety certification.
                      </p>
                    </div>

                    <div className="space-y-3 font-semibold text-xs text-slate-700">
                      <div className="space-y-1">
                        <label className="text-slate-600 block">Pill Base Surface Color</label>
                        <select
                          value={userVerifColor}
                          onChange={(e) => setUserVerifColor(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500 transition-all font-sans"
                        >
                          <option value="">-- Choose Color --</option>
                          <option value="Pure White">Plain White / Pure White</option>
                          <option value="Off-White / Cream">Off-White / Dull Cream</option>
                          <option value="Peach / Pale Pink">Peach / Light Pinkish Orange</option>
                          <option value="Orange / Peach Orange">Vibrant Orange</option>
                          <option value="Yellow">Yellow</option>
                          <option value="Blue">Blue / Green</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-600 block">Visual Shape Form factor</label>
                        <select
                          value={userVerifShape}
                          onChange={(e) => setUserVerifShape(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500 transition-all font-sans"
                        >
                          <option value="">-- Choose Shape --</option>
                          <option value="Circular / Round">Perfectly Round / Circular</option>
                          <option value="Oval / Oblong">Oval / Elliptical</option>
                          <option value="Round Chewable">Chewable Flat Round</option>
                          <option value="Oblong / Capsule-Shaped">Long capsule-like tablet (Oblong)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-600 block">Tablet Print/Score Markings</label>
                        <select
                          value={userVerifMarkings}
                          onChange={(e) => setUserVerifMarkings(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500 transition-all font-sans"
                        >
                          <option value="">-- Choose Markings --</option>
                          <option value="Smooth">Smooth (No markings / blank)</option>
                          <option value="Central Score Line">Dividing line in center (Score line)</option>
                          <option value="AT 10 Imprinted">'AT 10' Debossed imprint</option>
                          <option value="AL 120 Imprinted">'AL 120' Debossed imprint</option>
                          <option value="Citrus Emblem">Orange slice style textured embossing</option>
                          <option value="SR Imprinted">'SR' Debossed imprint</option>
                          <option value="Other">Other debossed characters</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Verification triggering logic */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        if (!userVerifColor || !userVerifShape || !userVerifMarkings) {
                          showToast("Please fill in all physical traits to scan.");
                          return;
                        }
                        setVerifResult({ status: "verifying" });
                        setTimeout(() => {
                          const correctColor = activeVerificationPill.pillsColor;
                          const correctShape = activeVerificationPill.pillsShape;
                          const correctMarkings = activeVerificationPill.pillsMarkings;

                          // Evaluate equality/matching bounds
                          const colorMatch = userVerifColor === correctColor;
                          const shapeMatch = userVerifShape === correctShape;
                          const markingsMatch = userVerifMarkings === correctMarkings;

                          if (colorMatch && shapeMatch && markingsMatch) {
                            setVerifResult({
                              status: "pass",
                              score: 100,
                              message: `PERFECT SECURE MATCH: All traits correspond precisely to standard indices (${correctShape}, ${correctColor}, with '${correctMarkings}'). Confident pharmaceutical consignment.`
                            });
                          } else {
                            let failedTraits = [];
                            if (!colorMatch) failedTraits.push(`Color: entered "${userVerifColor}" vs expected "${correctColor}"`);
                            if (!shapeMatch) failedTraits.push(`Shape: entered "${userVerifShape}" vs expected "${correctShape}"`);
                            if (!markingsMatch) failedTraits.push(`Markings: entered "${userVerifMarkings}" vs expected "${correctMarkings}"`);

                            setVerifResult({
                              status: "fail",
                              score: Math.round(((colorMatch ? 1 : 0) + (shapeMatch ? 1 : 0) + (markingsMatch ? 1 : 0)) * 33.3),
                              message: `MATCH DISCREPANCY DETECTED: Invalid physical signature. ${failedTraits.join(" | ")}. Please cross-verify carefully with express dispensary.`
                            });
                          }
                        }, 1200);
                      }}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow shadow-blue-600/10 active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Process AI Scanner Verification
                    </button>
                  </div>
                </div>
              </div>

              {/* Verified evaluation banner panel */}
              {verifResult && (
                <div className="animate-fade-in font-sans">
                  {verifResult.status === "verifying" ? (
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Simulating neural machine verification against Indian Drug Registry standards...</span>
                    </div>
                  ) : verifResult.status === "pass" ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-slate-800 text-xs space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold uppercase">
                        <CheckCircle className="h-4.5 w-4.5 text-emerald-600" /> Security Authentication Verified (Score: {verifResult.score}%)
                      </div>
                      <p className="font-medium leading-normal text-emerald-950">{verifResult.message}</p>
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block pt-1 font-sans">
                        🛡️ Consigned batch checked secure. Recommended safe dosage.
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-slate-800 text-xs space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-1.5 text-amber-800 font-extrabold uppercase">
                        <AlertTriangle className="h-4.5 w-4.5 text-amber-600" /> Security Verification Mismatch Alert (Score: {verifResult.score}%)
                      </div>
                      <p className="font-semibold leading-normal text-amber-950">{verifResult.message}</p>
                      <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block pt-1 font-sans">
                        ⚠️ High danger caution: DO NOT consume if physical medication doesn't match official reference traits.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR: Aesthetic Navigation bar from Bento grid mockups */}
      <aside className={`col-span-1 flex flex-col items-center py-6 justify-between h-screen overflow-y-auto relative z-20 shadow-xs transition-colors duration-300 ${isAppDarkMode ? "bg-slate-900 border-r border-slate-800" : "bg-white border-r border-slate-250"}`}>
        <div className="flex flex-col items-center gap-6 w-full shrink-0">
          {/* Logo element */}
          <div 
            onClick={() => setActiveTab("overview")}
            title="View Cinematic Landing Page"
            className="w-10 h-10 bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer rounded-xl flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-500/20 shrink-0"
          >
            CH
          </div>

          <nav className="flex flex-col space-y-4 pt-4 w-full items-center shrink-0">
            {[
              { id: "overview_classic", label: getTranslation(appLanguage, "tabOverview"), icon: Grid },
              { id: "super-app", label: getTranslation(appLanguage, "tabSuperApp"), icon: Sparkles },
              { id: "smart-network", label: getTranslation(appLanguage, "tabSmartNetwork"), icon: Compass },
              { id: "chn", label: getTranslation(appLanguage, "tabChn"), icon: MapPin },
              { id: "symptoms", label: getTranslation(appLanguage, "tabSymptoms"), icon: Brain },
              { id: "trends", label: getTranslation(appLanguage, "tabTrends"), icon: TrendingUp },
              { id: "beds", label: getTranslation(appLanguage, "tabBeds"), icon: HospitalIcon },
              { id: "consultation", label: getTranslation(appLanguage, "tabConsultation"), icon: Activity },
              { id: "pharmacy", label: getTranslation(appLanguage, "tabPharmacy"), icon: ShoppingBag },
              { id: "records", label: getTranslation(appLanguage, "tabRecords"), icon: FileText },
              { id: "insurance", label: getTranslation(appLanguage, "tabInsurance"), icon: Shield },
              { id: "sos", label: getTranslation(appLanguage, "tabSos"), icon: Ambulance },
              { id: "admin", label: getTranslation(appLanguage, "tabAdmin"), icon: Settings },
            ].filter(tab => tab.id === "admin" || enabledFeatures[tab.id] !== false).map((tab) => {
              const IconComp = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    const transitionFn = (window as any).cityHealerTransition;
                    if (transitionFn) {
                      transitionFn(tab.id);
                    } else {
                      setActiveTab(tab.id);
                    }
                    // Reset consult views when leaving tab to avoid locked simulation UI
                    if (tab.id !== "consultation") setConsultingAppt(null);
                  }}
                  title={tab.label}
                  className={`p-3 rounded-xl transition-all cursor-pointer relative group shrink-0 flex items-center justify-center ${
                    isSelected 
                      ? "text-blue-600" 
                      : `${isAppDarkMode ? "text-slate-500 hover:bg-slate-800 hover:text-slate-300" : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"}`
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className={`absolute inset-0 rounded-xl ${isAppDarkMode ? "bg-blue-950/50 border border-blue-900/40" : "bg-blue-50/70 border border-blue-100"}`}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      style={{ originY: "50%" }}
                    />
                  )}
                  <span className="relative z-10">
                    <IconComp className="w-5.5 h-5.5" />
                  </span>
                  <span className="absolute left-16 scale-0 bg-slate-900 text-white text-[10px] py-1 px-2 rounded font-medium group-hover:scale-100 transition-all z-50 whitespace-nowrap">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile and Roles controller indicators at base */}
        <div className="flex flex-col items-center gap-4 shrink-0 mt-8">
          <div className="relative group">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all cursor-pointer border ${isAppDarkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 animate-pulse" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"}`}>
              {activeRole.substring(0, 2)}
            </div>
            <div className="absolute left-16 bottom-0 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[10px] p-2 rounded transition-all whitespace-nowrap z-50">
              Active Simulation Account Key: {activeRole}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={{ height: "100vh", overflowY: "auto" }} className={`col-span-1 flex flex-col p-6 relative z-10 transition-colors duration-300 ${isAppDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
        {/* TOP STATUS HEADER WITH ROLE SWITCH PROTOCOL */}
        <header className={`flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-4 border-b shrink-0 gap-4 transition-colors duration-300 ${isAppDarkMode ? "border-slate-850" : "border-slate-100"}`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-wider uppercase font-semibold text-slate-400">Hub Service Control</span>
              <span className="rounded-full bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 font-bold flex items-center gap-1">
                <span className="w-1 px-1 h-1 bg-emerald-500 rounded-full animate-ping"></span> {getTranslation(appLanguage, "regionalNetwork")}
              </span>
            </div>
            <h1 className={`text-2xl font-black tracking-tight flex items-center gap-2 transition-all ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
              {getTranslation(appLanguage, "brandName")} <span className="text-sm font-medium text-slate-400">{getTranslation(appLanguage, "metropolitanGrid")}</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* SEARCH INPUT BAR */}
            <div className="relative w-full md:w-60">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, doctors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 whitespace-nowrap text-ellipsis transition-all ${isAppDarkMode ? "bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"}`}
              />
            </div>

            {/* DYNAMIC INTEGRATED SIMULATION SWITCHER */}
            <div className={`rounded-xl p-1 flex items-center gap-1 w-full md:w-auto overflow-x-auto text-xs font-semibold transition-all ${isAppDarkMode ? "bg-slate-900" : "bg-slate-100"}`}>
              <span className={`text-[10px] pl-2 pr-1 uppercase text-left shrink-0 ${isAppDarkMode ? "text-slate-450" : "text-slate-500"}`}>Role:</span>
              {[
                { id: "PATIENT", label: getTranslation(appLanguage, "rolePatient") },
                { id: "DOCTOR", label: getTranslation(appLanguage, "roleDoctor") },
                { id: "HOSPITAL", label: getTranslation(appLanguage, "roleHospital") },
                { id: "ADMIN", label: getTranslation(appLanguage, "roleAdmin") }
              ].map((role) => (
                <button
                  key={role.id}
                  onClick={() => {
                    setActiveRole(role.id as any);
                    showToast(`Switched workspace identity to ${role.label}`);
                    // Fast route adjustments to showcase views on role change
                    if (role.id === "ADMIN" || role.id === "HOSPITAL") {
                      setActiveTab("admin");
                    } else if (role.id === "DOCTOR") {
                      setActiveTab("consultation");
                    } else {
                      setActiveTab("overview");
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg shrink-0 transition-all cursor-pointer ${
                    activeRole === role.id 
                      ? (isAppDarkMode ? "bg-slate-800 text-blue-400 shadow-sm" : "bg-white text-blue-600 shadow-sm") 
                      : (isAppDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>

            {activeRole === "PATIENT" && (
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-2 py-1.5 flex items-center gap-1 text-xs shrink-0">
                  <span className="text-[10px] text-blue-600 font-extrabold uppercase shrink-0 pl-1">Profile:</span>
                  <select
                    value={activeFamilyMember}
                    onChange={(e) => {
                      setActiveFamilyMember(e.target.value);
                      showToast(`Active clinical timeline swapped to family profile: ${e.target.value}`);
                    }}
                    className="bg-transparent border-none text-blue-800 font-black focus:outline-none cursor-pointer"
                  >
                    {familyMembers.map((fm) => (
                      <option key={fm.name} value={fm.name} className="text-slate-900">{fm.name} ({fm.relation})</option>
                    ))}
                  </select>
                </div>
                {activeFamilyMember !== "Self" && (
                  <button
                    onClick={() => {
                      if (confirm(`⚠️ Are you sure you want to delete patient profile "${activeFamilyMember}"?`)) {
                        const targetName = activeFamilyMember;
                        setFamilyMembers(prev => prev.filter(fm => fm.name !== targetName));
                        setActiveFamilyMember("Self");
                        showToast(`🗑️ Patient profile "${targetName}" has been successfully deleted.`);
                      }
                    }}
                    className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer border ${isAppDarkMode ? "bg-red-950/20 border-red-900 text-red-400 hover:bg-red-950/45" : "bg-red-50 hover:bg-red-100 text-red-600 border-red-200"}`}
                    title="Delete Active Patient Profile"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsAddPatientOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[11px] px-2.5 py-2 rounded-xl transition-all shadow-xs hover:shadow-sm cursor-pointer flex items-center gap-1"
                  title="Add New Family Profile / Patient"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add Patient</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 p-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-bold text-xs shrink-0 cursor-pointer"
              title="Profile & Security Settings"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden lg:inline">Profile Settings</span>
            </button>

            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 p-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-bold text-xs shrink-0 cursor-pointer"
              title="Logout session"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* LOADING SHIMMER */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <Activity className="h-10 w-10 text-blue-500 animate-pulse" />
            <p className="text-sm font-semibold text-slate-500">Retrieving metropolitan clinical health databases...</p>
          </div>
        ) : (
          <div className="flex-1 pr-1 relative z-10 min-h-0 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="w-full flex flex-col flex-1"
              >
                {/* TAB VIEW 1: MASTER OVERVIEW - PREMIUM ANIMATED LANDING PAGE */}
                {activeTab === "overview" && (
                  <LandingPage onNavigate={setActiveTab} hospitals={hospitals} />
                )}

                {/* TAB VIEW 1: MASTER OVERVIEW - AUTHENTIC CLASSIC BENTO GRID */}
                {activeTab === "overview_classic" && (
              <div className="space-y-6 pb-8">
                {/* Responsive Bento Grid arrangement matching requested design HTML */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 min-h-[580px] h-auto">
                  
                  {/* Card Block 1: Hello Banner (Span 2x1, BG Blue) */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-1 bg-blue-600 rounded-3xl p-6 text-white flex flex-col justify-between shadow-lg shadow-blue-200/50 relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full shrink-0 -mr-6 -mt-6"></div>
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <h2 className="text-2xl font-extrabold mb-1 tracking-tight">Hello, {activeFamilyMember === "Self" ? authName : activeFamilyMember}</h2>
                        <p className="opacity-90 text-xs">Your last clinical review was 14 days ago. Overall health is optimal.</p>
                      </div>
                      <div className="bg-white/20 p-2 rounded-xl text-[10px] font-bold tracking-wider uppercase">
                        AI Powered
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-4">
                      <button
                        onClick={() => {
                          setActiveTab("super-app");
                          setSuperActiveSubTab("copilot");
                        }}
                        className="bg-amber-400 text-slate-950 hover:bg-amber-300 px-4 py-2.5 rounded-xl text-xs font-black shadow-md hover:shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1 animate-pulse"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        <span>AI Health Copilot</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("super-app");
                          setSuperActiveSubTab("health-id");
                        }}
                        className="bg-white/25 border border-white/30 text-white px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/35 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <IdCard className="h-3.5 w-3.5" />
                        <span>Unified Health ID</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Block 2: EMERGENCY SOS RED BLOCK (Span 1x1, BG Red) */}
                  <div
                    onClick={() => {
                      setActiveTab("super-app");
                      setSuperActiveSubTab("emergency");
                    }}
                    className="col-span-1 sm:col-span-1 lg:col-span-1 row-span-1 bg-rose-600 rounded-3xl p-6 text-white flex flex-col items-center justify-center shadow-lg shadow-rose-200/75 cursor-pointer hover:bg-rose-500 transition-all active:scale-95 border border-rose-500 group"
                  >
                    <div className="bg-white/10 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform relative">
                      <span className="absolute inset-0 bg-white/20 rounded-full animate-ping"></span>
                      <Ambulance className="w-8 h-8 text-white text-center" />
                    </div>
                    <span className="font-extrabold text-lg tracking-tight uppercase">EMERGENCY SOS</span>
                    <span className="text-[10px] opacity-80 uppercase tracking-widest font-semibold mt-1">One-Tap Response Dispatched</span>
                  </div>

                  {/* Card Block 3: QUEUE WAIT TOKEN (Span 1x1, White Glass) */}
                  <div className="col-span-1 sm:col-span-1 lg:col-span-1 row-span-1 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex justify-between items-center">
                        <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Live OPD Progression</h3>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      </div>
                      <p className="text-3xl font-black text-slate-900 tracking-tight">
                        {myQueueToken ? myQueueToken.tokenNumber : "Token #00"}
                      </p>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full bg-blue-500 ${myQueueToken ? 'w-2/3' : 'w-0'}`}></div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500">
                        {myQueueToken ? `Approx. ${myQueueToken.estimatedWaitTimeMin} mins wait index` : "No active clinics waiting token queue"}
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveTab("consultation")}
                      className="w-full text-center text-blue-600 font-bold text-[10px] py-1 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                    >
                      {myQueueToken ? "Review wait line" : "Get Virtual OPD token"}
                    </button>
                  </div>

                  {/* Card Block 4: MAPS & HOSPITAL OCCUPANCY INDEX (Span 1x2, Vertical Card) */}
                  <div className="col-span-1 sm:col-span-1 lg:col-span-1 lg:row-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Hospital Occupancy</h3>
                        <HospitalIcon className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] lg:max-h-[300px]">
                        {hospitals.slice(0, 3).map((h) => (
                          <div key={h.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-extrabold text-slate-700 truncate">{h.name}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[9px] text-slate-500">ICU: {h.icuAvailable} vacant</span>
                              <span className={`text-[10px] font-black ${h.availableBeds > 10 ? 'text-green-600' : 'text-amber-600'}`}>
                                {h.availableBeds} beds left
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, Math.max(10, 100 - (h.availableBeds / h.totalBeds) * 100))}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-4">
                      <button
                        onClick={() => {
                          setActiveTab("beds");
                          setTimeout(() => {
                            handleFindNearestHospital();
                          }, 100);
                        }}
                        className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Compass className="h-4 w-4 animate-spin-slow" />
                        Find Nearest Hospital
                      </button>
                      <button
                        onClick={() => setActiveTab("beds")}
                        className="w-full py-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-semibold text-xs text-center cursor-pointer"
                      >
                        View Live Map Locator
                      </button>
                    </div>
                  </div>

                  {/* Card Block 4B: CITY HEALTH NETWORK (CHN) DIGITAL REAL-TIME TWIN (Next to Hospital Occupancy) */}
                  <div className="col-span-1 sm:col-span-1 lg:col-span-1 lg:row-span-2 bg-gradient-to-b from-white to-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Card Title */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2 bg-transparent">
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">City Health Twin (CHN)</h3>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        </div>
                        <MapPin className="h-4 w-4 text-emerald-500" />
                      </div>

                      {/* City Selector Dropdown */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Selected NCR City</label>
                        <select
                          value={dashboardSelectedCity}
                          onChange={(e) => setDashboardSelectedCity(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 appearance-none cursor-pointer shadow-sm"
                        >
                          {Object.keys(CITIES_DATA).map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dynamic Metrics */}
                      {(() => {
                        const cityData = CITIES_DATA[dashboardSelectedCity] || CITIES_DATA.Gurugram;
                        // Dynamic computation of standard score
                        const finalScore = Math.round(cityData.baseScore - Math.max(0, (cityData.aqi - 100) * 0.08) + (cityData.bedsAvail / cityData.bedsMax) * 15);
                        
                        return (
                          <div className="space-y-3 pt-1">
                            {/* Score Display */}
                            <div className="p-3 bg-white rounded-2xl border border-slate-150 flex items-center justify-between shadow-xs">
                              <div>
                                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Health Rating</p>
                                <p className="text-xs font-black text-slate-800 leading-none mt-1">Operating Index</p>
                              </div>
                              <div className="text-center font-sans bg-transparent">
                                <span className="text-2xl font-[900] text-slate-900 leading-none">{finalScore}</span>
                                <span className="text-slate-400 text-xs font-bold">/100</span>
                              </div>
                            </div>

                            {/* AQI Display */}
                            <div className="p-3 bg-red-50/20 border border-red-100 rounded-2xl flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Atmosphere AQI</p>
                                <p className={`text-[10px] font-black uppercase ${cityData.aqi > 250 ? "text-rose-600" : cityData.aqi > 150 ? "text-amber-600" : "text-emerald-600"}`}>
                                  {cityData.aqi > 250 ? "Severe Danger" : cityData.aqi > 150 ? "Poor / Warning" : "Clear Area"}
                                </p>
                              </div>
                              <span className="text-base font-black text-slate-800 font-mono bg-transparent">{cityData.aqi}</span>
                            </div>

                            {/* General quick alerts */}
                            <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200/60 flex items-center gap-2">
                              <Activity className="h-4 w-4 text-slate-500 shrink-0 animate-pulse" />
                              <div className="text-[9px] text-slate-600 leading-normal font-semibold">
                                <span className="font-extrabold text-slate-800">Alerts: </span>
                                {cityData.outbreakZones[0]?.name || "None documented today"}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Quick navigation actions */}
                    <div className="space-y-2 mt-4">
                      <button
                        onClick={() => setActiveTab("chn")}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer text-center"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-emerald-100 animate-pulse" />
                        Launch City Twin HUB
                      </button>
                    </div>
                  </div>

                  {/* Card Block 5: CLINIC SCHEDULER & APPOINTMENTS (Span 2x1, White) */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-black text-slate-800 tracking-tight">Active Consultations</h3>
                        <div className="flex items-center gap-1.5">
                          <span
                            onClick={() => {
                              setActiveTab("super-app");
                              setSuperActiveSubTab("recommender");
                            }}
                            className="text-[10px] text-indigo-650 hover:text-indigo-500 font-black cursor-pointer hover:underline flex items-center gap-0.5 bg-indigo-50 px-2.5 py-1 rounded-xl transition-all"
                          >
                            <Sparkles className="h-3 w-3 animate-pulse" />
                            <span>AI Matcher</span>
                          </span>
                          <span className="text-slate-300 text-xs">|</span>
                          <span
                            onClick={() => setActiveTab("consultation")}
                            className="text-[10px] text-blue-600 font-bold cursor-pointer hover:underline"
                          >
                            Book Standard
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 max-h-[180px] overflow-y-auto">
                        {myAppointments.length === 0 ? (
                          <div className="text-center py-6">
                            <p className="text-xs text-slate-400">No active scheduled consultations.</p>
                          </div>
                        ) : (
                          myAppointments.map((appt) => (
                            <div key={appt.id} className="flex items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mr-3 shrink-0">
                                <Stethoscope className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-extrabold text-sm text-slate-800 truncate">{appt.doctorName}</p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {appt.specialty} • {appt.date}, {appt.time}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-[9px] font-bold rounded-full ${
                                  appt.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-800" :
                                  appt.status === "COMPLETED" ? "bg-slate-200 text-slate-700" :
                                  "bg-amber-100 text-amber-800"
                                }`}>
                                  {appt.status}
                                </span>
                                {(appt.status === "ACCEPTED" || appt.status === "PENDING") && (
                                  <button
                                    onClick={() => {
                                      setConsultingAppt(appt);
                                      setActiveTab("consultation");
                                    }}
                                    className="px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold rounded-lg"
                                  >
                                    Join chat
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex items-center gap-3">
                      <Info className="h-5 w-5 text-blue-600 shrink-0" />
                      <p className="text-[11px] text-slate-600 leading-normal">
                        To request medications or look up digital records, verify Doctor updates or select <strong>Doctor simulate role</strong> at the top header list!
                      </p>
                    </div>
                  </div>

                  {/* Card Block 6: AI METROPOLITAN HEALTH SCORE CHART (Span 2x1, Slate-950 Dark theme) */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-slate-900 rounded-3xl p-6 text-white shadow-lg flex flex-col sm:flex-row justify-between gap-6">
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                        <h3 className="text-xs font-black opacity-70 uppercase tracking-widest">AI Health Status</h3>
                        <Sparkles className="h-4 w-4 text-cyan-400" />
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4 py-1">
                        {/* Score circle SVG chart */}
                        <div className="relative w-24 h-24 shrink-0 mx-auto sm:mx-0">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <circle className="text-slate-800 opacity-20" strokeWidth="3" stroke="currentColor" fill="transparent" r="16" cx="18" cy="18" />
                            <circle className="text-cyan-400" strokeWidth="3" strokeDasharray="85, 100" strokeLinecap="round" stroke="currentColor" fill="transparent" r="16" cx="18" cy="18" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-white leading-none">85</span>
                            <span className="text-[7px] text-slate-400 font-bold tracking-widest uppercase mt-0.5 leading-none">Safe Index</span>
                          </div>
                        </div>
                        <p className="text-left text-[11px] opacity-85 leading-relaxed">
                          Recover rate has advanced 4% over the past fortnight. Keep consistent cardiovascular metrics.
                        </p>
                      </div>
                    </div>

                    <div className="sm:w-52 flex flex-col justify-between gap-3 bg-white/10 rounded-2xl p-4 border border-white/5 shrink-0">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-cyan-300 tracking-wider mb-1">AI Prediction</p>
                        <p className="text-xs opacity-90 leading-tight">
                          Minimal regional influenza exposure based on localized sewage analytics.
                        </p>
                      </div>
                      <div className="text-[10px] text-cyan-200/50 font-mono">
                        Model: Gemini 3.5 Med-Spec
                      </div>
                    </div>
                  </div>

                </div>

                {/* DYNAMIC LANDING SEGMENT CARD */}
                <div className="bg-slate-100 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-200">
                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-slate-900 leading-tight">Need custom medicines? Place express order at pharmacy grid!</h3>
                    <p className="text-xs text-slate-500 max-w-xl">
                      Browse standard painkillers, antibiotic segments, first-aid remedies, or connect verified clinical prescription tags from your reports list immediately.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("pharmacy")}
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow shrink-0 active:scale-95 transition-all text-center cursor-pointer"
                  >
                    Enter Medical Pharmacy
                  </button>
                </div>
              </div>
            )}

            {/* TAB VIEW 2: AI CLINICAL SYMPTOM CHECKER PANEL */}
            {activeTab === "symptoms" && (
              <div className="max-w-4xl mx-auto space-y-6 pb-12">
                <div className="space-y-6">
                    <div className="bg-slate-100 rounded-3xl p-6 border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-slate-900">Virtual Triage Symptom Checker</h2>
                    <p className="text-xs text-slate-500">Provide physical details below. Powered server-side with Gemini 3.5 medical analytics schema.</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-700 px-3 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> HIPAA Compliant Diagnostics
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <form onSubmit={handleCheckSymptoms} className="md:col-span-2 bg-white card border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">reported physical symptoms</label>
                      <textarea
                        id="ai-symptoms-input"
                        rows={4}
                        placeholder="Describe exact physical condition (e.g. Sharp pain in central chest moving down the left arm, shallow breathing indices, heavy coughing, high fever or fatigue...)"
                        value={aiSymptoms}
                        onChange={(e) => setAiSymptoms(e.target.value)}
                        className="w-full border border-slate-200 rounded-2xl p-4 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Personal Medical History / Chronic issues (optional)</label>
                      <input
                        id="ai-history-input"
                        type="text"
                        placeholder="e.g. Type 2 Diabetes history, hypertension medication, asthma, pacemaker..."
                        value={aiHistory}
                        onChange={(e) => setAiHistory(e.target.value)}
                        className="w-full border border-slate-100 rounded-2xl p-4 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        *AI assessment is strictly for triage guidance. In life-threatening scenarios, trigger individual SOS immediately.
                      </p>
                      <button
                        type="submit"
                        disabled={aiTesting}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow active:scale-95 transition-all text-center flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {aiTesting ? (
                          <>
                            <Clock className="h-4 w-4 animate-spin" /> Analyzing condition...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4" /> Run AI Triage Diagnosis
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Sidebar Guidelines panel */}
                  <div className="bg-slate-900 text-white rounded-3xl p-6 shadow space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-cyan-300 tracking-wider">Diagnostic Triage Tiers</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0"></span>
                          <div>
                            <p className="text-xs font-bold leading-none">CRITICAL / HIGH</p>
                            <p className="text-[9px] opacity-70 mt-1">Severe dyspnea, heart block, traumatic bleeding</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                          <div>
                            <p className="text-xs font-bold leading-none">MEDIUM</p>
                            <p className="text-[9px] opacity-70 mt-1">Severe gastrointestinal discomfort, migraine pain</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <div>
                            <p className="text-xs font-bold leading-none">LOW</p>
                            <p className="text-[9px] opacity-70 mt-1">Mild upper body aches, colds, fatigue index</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 mt-4 text-[10px] opacity-75 leading-relaxed">
                      All clinical evaluations run on custom system prompts to safely isolate urgent cardio-respiratory indicators, recommending responsive specialists and automatic transport dispatch triggers when necessary.
                    </div>
                  </div>
                </div>

                {/* ANIMATED DETAILED REPORT DIAGNOSIS DISPLAY */}
                {aiReport && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6"
                  >
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 gap-4">
                      <div>
                        <span className="font-mono text-[9px] tracking-wider uppercase font-semibold text-slate-400">Clinical Evaluation Result</span>
                        <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                          Suspected: {aiReport.suspectedCondition}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={handleRetakeDiagnostic}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer border border-slate-200"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Retake Diagnostic
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">Priority triage level:</span>
                          <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold ${
                            aiReport.urgencyLevel === "CRITICAL" ? "bg-rose-100 text-rose-800 animate-pulse border border-rose-200" :
                            aiReport.urgencyLevel === "HIGH" ? "bg-red-100 text-red-800" :
                            aiReport.urgencyLevel === "MEDIUM" ? "bg-amber-100 text-amber-800" :
                            "bg-emerald-100 text-emerald-800"
                          }`}>
                            {aiReport.urgencyLevel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="md:col-span-2 space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Analysis Reason</label>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {aiReport.explanation}
                          </p>
                        </div>

                        <div className="space-y-3 pt-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Immediate Safety Recommendations</label>
                          <ul className="grid gap-2 sm:grid-cols-2 text-xs font-medium text-slate-700">
                            {aiReport.recommendations.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 block pb-1">recommended consultant</span>
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-extrabold rounded-lg">
                              {aiReport.specialistType}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            We have filtered active doctors. Connect to consult immediately to generate medical prescriptions securely.
                          </p>
                        </div>

                        <div className="space-y-2">
                          {aiReport.flagUrgentSOS ? (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-[11px] font-bold space-y-2">
                              <div className="flex items-center gap-1.5 text-rose-600">
                                <AlertTriangle className="h-4 w-4" /> HIGH ACUTE RISK THREAT
                              </div>
                              <p className="text-[10px] leading-snug">Emergency indicators require clinical response.</p>
                              <button
                                onClick={() => {
                                  handleSOSSubmit({ preventDefault: () => {} } as any);
                                  setActiveTab("sos");
                                }}
                                className="w-full text-center py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase"
                              >
                                Dispatch SOS Ambulance NOW
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setActiveTab("consultation");
                                setSearchQuery(aiReport.specialistType);
                              }}
                              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow text-center cursor-pointer"
                            >
                              Find specialist clinician
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleRetakeDiagnostic}
                            className="w-full py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-white"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-slate-500" /> Retake Diagnostic
                          </button>
                        </div>
                      </div>
                    </div>

                    {aiReport.recommendedHospitals && aiReport.recommendedHospitals.length > 0 && (
                      <div className="border-t border-slate-100 pt-5 mt-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">AI Clinical Partner Suggestions</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">Delhi NCR Partner Network Matcher</span>
                        </div>
                        
                        <div className="grid gap-4 sm:grid-cols-3">
                          {aiReport.recommendedHospitals.map((hosp: any) => (
                            <div key={hosp.id} className="relative bg-slate-50 border border-slate-200/60 hover:border-indigo-200 hover:bg-slate-50/50 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-xs">
                              {/* Match Score Badge */}
                              <div className="absolute top-3 right-3 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
                                Match: {hosp.recommendationScore}%
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="text-xs font-extrabold text-slate-950 pr-16 truncate" title={hosp.name}>{hosp.name}</h4>
                                <p className="text-[10px] text-slate-400 line-clamp-1 font-medium">{hosp.address}</p>
                                
                                {/* Quick metrics */}
                                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[9px] font-bold text-slate-600">
                                  <div className="bg-white border border-slate-100 rounded-xl p-2 flex flex-col shadow-2xs">
                                    <span className="text-[8px] text-slate-400 font-extrabold uppercase">ICU VACANCY</span>
                                    <span className="text-indigo-600 font-extrabold">{hosp.icuAvailable} Vacable</span>
                                  </div>
                                  <div className="bg-white border border-slate-100 rounded-xl p-2 flex flex-col shadow-2xs">
                                    <span className="text-[8px] text-slate-400 font-extrabold uppercase">GENERAL BEDS</span>
                                    <span className="text-emerald-600 font-extrabold">{hosp.availableBeds} Vacable</span>
                                  </div>
                                </div>
                                
                                <p className="text-[10px] font-bold text-indigo-700 bg-indigo-50/85 p-2 rounded-xl">
                                  ⚡ {hosp.matchReason}
                                </p>
                              </div>
                              
                              <div className="flex items-center justify-between border-t border-slate-200/50 pt-3 mt-3 text-[10px] font-bold text-slate-500">
                                <div className="flex flex-col">
                                  <span className="text-[8px] text-slate-400 font-extrabold uppercase">ETA BY ROAD</span>
                                  <span className="text-slate-800 font-black">{hosp.travelTimeMin} mins ({hosp.distanceKM} km)</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab("beds");
                                    setMapSelectedHospital(hosp);
                                  }}
                                  className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white font-extrabold text-[9px] uppercase rounded-xl transition-all active:scale-95 cursor-pointer"
                                >
                                  Trace Bed Census
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          )}

            {/* TAB VIEW 3: LIVE BED RESERVE TRACKER */}
            {activeTab === "beds" && (
              <div className="space-y-6 pb-12">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 flex items-center gap-2">
                     Metropolitan Live Bed Triage Grid
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Live operational census for hospital bed allocation. Patients can map vacancies and coordinate emergency transit.
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Trauma Centers & Hospital Registries</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {hospitals.filter(h => distanceFilter >= 30 || getDistanceToUser(h) <= distanceFilter).length === 0 ? (
                        <div className="col-span-full text-center py-12 px-6 bg-white border border-slate-200 border-dashed rounded-3xl space-y-3 shadow-xs">
                          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto animate-pulse" />
                          <p className="text-sm font-extrabold text-slate-800">No hospitals found within {distanceFilter} km.</p>
                          <p className="text-xs text-slate-500">Try dragging the distance filter slider on the map to expand your results.</p>
                          <button
                            type="button"
                            onClick={() => setDistanceFilter(30)}
                            className={`px-4 py-2 text-white text-xs font-black uppercase rounded-xl shadow cursor-pointer transition-all active:scale-95 ${isAppDarkMode ? "bg-slate-850 hover:bg-slate-750" : "bg-slate-900 hover:bg-slate-800"}`}
                          >
                            Reset Search Radius
                          </button>
                        </div>
                      ) : (
                        hospitals
                          .filter(h => distanceFilter >= 30 || getDistanceToUser(h) <= distanceFilter)
                          .map((h) => {
                            const isSevere = h.availableBeds < 10;
                            return (
                              <div key={h.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-all">
                                <div>
                                  <div className="flex items-start justify-between gap-2.5">
                                    <h4 className="text-sm font-extrabold text-slate-900 leading-snug truncate-2-lines h-10">{h.name}</h4>
                                    <span className={`shrink-0 h-2 w-2 rounded-full mt-1.5 ${isSevere ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <MapPin className="h-3 w-3 shrink-0" /> {h.address}
                                  </p>
                                  <div className="text-[10px] text-teal-700 bg-teal-50 border border-teal-100/60 px-2 py-1 rounded-xl w-fit font-black flex items-center gap-1 mt-2 shadow-2xs">
                                    <Compass className="h-3.5 w-3.5 shrink-0" />
                                    {getDistanceToUser(h).toFixed(1)} km away
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                  <div className="p-2.5 bg-slate-50 rounded-xl text-center border border-slate-100 justify-between">
                                    <span className="text-[9px] text-slate-500 font-bold block">Available Beds</span>
                                    <span className={`text-lg font-black block ${isSevere ? "text-red-600" : "text-emerald-600"}`}>
                                      {h.availableBeds} <span className="text-[9px] font-medium text-slate-400">/ {h.totalBeds}</span>
                                    </span>
                                  </div>
                                  <div className="p-2.5 bg-slate-50 rounded-xl text-center border border-slate-100">
                                    <span className="text-[9px] text-slate-500 font-bold block">ICU Reserve</span>
                                    <span className={`text-lg font-black block ${h.icuAvailable === 0 ? "text-red-500" : "text-cyan-600"}`}>
                                      {h.icuAvailable} <span className="text-[9px] font-medium text-slate-400">/ {h.icuBeds}</span>
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1 pt-2">
                                  <div className="flex justify-between text-[10px] text-slate-500 uppercase font-semibold">
                                    <span>Emergency Occupancy</span>
                                    <span>{h.emergencyOccupancy}%</span>
                                  </div>
                                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div className={`h-full ${h.emergencyOccupancy > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${h.emergencyOccupancy}%` }}></div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-slate-100 text-[10px] font-bold">
                                  <a href={`tel:${h.phone}`} className="text-slate-500 hover:text-slate-900 flex items-center gap-1 shrink-0">
                                    <Phone className="h-3 w-3" /> Call Desk
                                  </a>
                                  <button
                                    onClick={() => handleSelectHospitalMap(h)}
                                    className="text-cyan-600 hover:underline cursor-pointer"
                                  >
                                    Map & Track Dispatch
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedSOSHospital(h.name);
                                      setEmergencyAddress(h.address);
                                      setActiveTab("sos");
                                    }}
                                    className="text-rose-600 hover:underline cursor-pointer"
                                  >
                                    SOS Direct
                                  </button>
                                </div>

                                <a 
                                  href={getGoogleMapsDirUrl(h.name, h.address)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full mt-2.5 bg-blue-50/50 hover:bg-blue-50 text-blue-700 hover:text-blue-800 font-extrabold text-[11px] text-center py-2.5 rounded-xl flex items-center justify-center gap-1.5 border border-blue-100 transition-all cursor-pointer shadow-xs"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Open Google Maps Live Route
                                </a>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  {/* Dynamic Map Visualizer side panel */}
                  <div className="space-y-6">
                    <div className="bg-white border border-blue-100 text-slate-800 rounded-[32px] p-6 shadow-sm space-y-4 relative overflow-hidden">
                      <div className="absolute top-1.5 right-1.5 font-mono text-[8px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase font-bold">Google Maps API Linked</div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                        <h4 className="text-sm font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5 font-sans">
                          <MapPin className="h-4 w-4 text-blue-500 animate-pulse" /> Delhi NCR Live Trauma Map
                        </h4>
                        
                        <button
                          onClick={getUserRealTimeLocation}
                          disabled={isLocatingUser}
                          id="btn-detect-gps"
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer select-none ${
                            isLocatingUser 
                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" 
                              : userLocationCoords 
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100" 
                                : "bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100/60"
                          }`}
                        >
                          <Navigation className={`h-3 w-3 ${isLocatingUser ? "animate-spin" : ""}`} />
                          {isLocatingUser ? "Locating..." : userLocationCoords ? "GPS Connected" : "Detect GPS"}
                        </button>
                      </div>
                      
                      {/* Stylized Delhi NCR Vector Grid */}
                      <div className="relative w-full aspect-square bg-sky-50/50 border border-blue-100 rounded-2xl overflow-hidden shadow-inner flex flex-col justify-between">
                        
                        {/* Floating View Control */}
                        {isMapCenteredOnUser && (
                          <div className="absolute top-3 left-3 z-45">
                            <button
                              type="button"
                              onClick={() => setIsMapCenteredOnUser(false)}
                              className="bg-white/95 backdrop-blur border border-slate-250 hover:bg-slate-50 text-blue-600 hover:text-blue-800 font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5 animate-spin-slow" />
                              Reset Normal View
                            </button>
                          </div>
                        )}

                        {/* Floating Radius HUD / Distance Filter Slider */}
                        <div className="absolute top-3 right-3 z-45 bg-white/95 backdrop-blur border border-blue-100/80 p-3 rounded-2xl shadow-md w-44 space-y-2 select-none">
                          <div className="flex justify-between items-center text-[10px] font-black tracking-wider text-slate-600 uppercase">
                            <span className="flex items-center gap-1">
                              <Compass className="h-3 w-3 text-blue-500 rotate-45" /> Radius
                            </span>
                            <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
                              {distanceFilter >= 30 ? "All" : `${distanceFilter} km`}
                            </span>
                          </div>
                          
                          <input
                            type="range"
                            min="3"
                            max="30"
                            step="1"
                            value={distanceFilter}
                            onChange={(e) => setDistanceFilter(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                            style={{
                              background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${(distanceFilter - 3) / 27 * 100}%, #1e293b ${(distanceFilter - 3) / 27 * 100}%, #1e293b 100%)`
                            }}
                          />
                          
                          <div className="flex justify-between text-[8px] font-black text-slate-500">
                            <span>3 km</span>
                            <span>15 km</span>
                            <span>Unlimited</span>
                          </div>
                        </div>

                        {/* Camera Focus Zoom Wrapper */}
                        <div 
                          className="absolute inset-0 transition-all duration-500 ease-out"
                          style={{
                            transform: isMapCenteredOnUser 
                              ? "scale(1.28) translateY(12px)" 
                              : "scale(1) translateY(0px)",
                            transformOrigin: "150px 90px"
                          }}
                        >
                          {/* Static road lines */}
                          <svg className="absolute inset-0 w-full h-full text-slate-800" strokeWidth="1" stroke="currentColor">
                            <line x1="10" y1="160" x2="310" y2="160" strokeDasharray="3,3" />
                            <line x1="160" y1="10" x2="160" y2="310" strokeDasharray="3,3" />
                            <path d="M 45,280 Q 150,120 275,95" fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="5,5" />
                          </svg>

                          {/* Interactive dynamic path highlighting to chosen hospital */}
                          {mapSelectedHospital && (
                            <svg className="absolute inset-0 w-full h-full text-[0px]" fill="none">
                              <path 
                                d={`M 150,90 Q 140,110 ${hospitalCoords[mapSelectedHospital.id]?.x || 151},${hospitalCoords[mapSelectedHospital.id]?.y || 153}`}
                                stroke="#06b6d4" 
                                strokeWidth="3.5" 
                                strokeLinecap="round"
                              />
                              
                              {/* Glowing animated pulse travel indicator */}
                              <path 
                                d={`M 150,90 Q 140,110 ${hospitalCoords[mapSelectedHospital.id]?.x || 151},${hospitalCoords[mapSelectedHospital.id]?.y || 153}`}
                                stroke="#22c55e" 
                                strokeWidth="3.5" 
                                strokeLinecap="round"
                                strokeDasharray="10 30"
                                strokeDashoffset={-ambulanceMarkerProgress * 1.5}
                              />
                            </svg>
                          )}

                          {/* Visual Location Nodes */}
                          <div className="absolute inset-0 text-[10px]">
                            {/* User Location Node (Real-time GPS device position marker) */}
                            <div 
                              style={{ left: "150px", top: "90px" }} 
                              className="absolute -translate-x-1/2 -translate-y-1/2 text-center group z-20"
                            >
                              <span className="flex h-3.5 w-3.5 relative">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${userLocationCoords ? "bg-emerald-500" : "bg-cyan-500"} opacity-75`}></span>
                                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${userLocationCoords ? "bg-emerald-600" : "bg-cyan-600"} border border-white`}></span>
                              </span>
                              <div className={`bg-slate-900 border ${userLocationCoords ? "border-emerald-500/30 text-emerald-300" : "border-slate-800 text-slate-300"} p-1.5 rounded text-[8px] whitespace-nowrap absolute top-4 left-1/2 -translate-x-1/2 opacity-95 font-bold shadow-md`}>
                                📍 {userLocationCoords ? `Live GPS: ${userLocationCoords.lat.toFixed(4)}°, ${userLocationCoords.lng.toFixed(4)}°` : "GPS Position Awaiting Grant..."}
                              </div>
                            </div>

                            {/* Hospital Markers from current database */}
                            {hospitals
                              .filter((h) => distanceFilter >= 30 || getDistanceToUser(h) <= distanceFilter)
                              .map((h) => {
                                const coords = hospitalCoords[h.id] || { x: 150, y: 150 };
                                const isSelected = mapSelectedHospital?.id === h.id;
                                return (
                                  <button 
                                    key={h.id}
                                    onClick={() => handleSelectHospitalMap(h)}
                                    style={{ left: `${coords.x}px`, top: `${coords.y}px` }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 group z-30 focus:outline-none cursor-pointer"
                                  >
                                    <span className={`flex h-4 w-4 rounded-full border border-white transition-all duration-300 ${
                                      isSelected ? "bg-cyan-500 scale-125 shadow shadow-cyan-300" : h.availableBeds > 0 ? "bg-rose-500 hover:scale-110" : "bg-slate-600 hover:scale-110 opacity-60"
                                    }`} />
                                    <div className="hidden group-hover:block bg-slate-900 border border-slate-700 p-1 rounded text-[8px] whitespace-nowrap absolute -top-8 left-1/2 -translate-x-1/2 text-white font-bold z-[100]">
                                      {h.name.split(" ")[0]} ({h.availableBeds} beds)
                                    </div>
                                  </button>
                                );
                              })}

                            {/* Ambulance dispatch icon representation */}
                            {mapSelectedHospital && isAmbulanceTracking && (
                              <div 
                                style={{ 
                                  left: `${150 + (hospitalCoords[mapSelectedHospital.id]?.x - 150) * (ambulanceMarkerProgress/100)}px`, 
                                  top: `${90 + (hospitalCoords[mapSelectedHospital.id]?.y - 90) * (ambulanceMarkerProgress/100)}px` 
                                }} 
                                className="absolute -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-slate-950 p-1 rounded-full z-40 shadow-lg border border-white scale-110 animate-bounce"
                              >
                                <Ambulance className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Mini coordinates tagger overlay */}
                        <div className="bg-[#f1f5f9] border-t border-slate-100 p-2.5 text-[9px] font-mono flex justify-between z-10 text-slate-700">
                          <div>
                            <span className="text-slate-400">Target Node: </span>
                            <span className="text-blue-600 font-bold">{mapSelectedHospital ? mapSelectedHospital.name.split(" ")[0] : "None Selected"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Lat: </span>
                            <span className="text-slate-850 font-bold">{mapSelectedHospital ? mapSelectedHospital.lat.toFixed(4) : "28.6139"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Direction coordinates details steps rendering on tap */}
                      {mapSelectedHospital ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 font-semibold text-xs leading-normal text-slate-700">
                          <div className="flex justify-between border-b border-slate-200 pb-2">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Est. Distance</span>
                              <span className="text-base font-black text-slate-900">{mapDistance}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Est. Transit Duration</span>
                              <span className="text-base font-black text-blue-600">{mapDuration}</span>
                            </div>
                          </div>

                          <div className="space-y-1 text-[10px]">
                            <span className="text-slate-400 uppercase tracking-wider text-[9px] block font-semibold">Live Driving Escort (Delhi CP Gate)</span>
                            <div className="max-h-[100px] overflow-y-auto space-y-1 font-mono text-slate-600">
                              {mapDirectionsSteps.map((stp, idx) => (
                                <p key={idx} className="truncate">
                                  <span className="text-blue-500 font-bold">{idx + 1}.</span> {stp}
                                </p>
                              ))}
                            </div>
                          </div>

                          {/* Simulated Interactive Ambulance Trigger */}
                          <div className="pt-2 space-y-2.5">
                            {isAmbulanceTracking ? (
                              <div className={`w-full p-3 rounded-xl border space-y-2 text-center transition-all ${isAppDarkMode ? "bg-blue-950/20 border-blue-900" : "bg-blue-50/50 border-blue-100"}`}>
                                <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider block animate-pulse">Ambulance GPS Tracker Active</span>
                                <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                                  <div className="bg-gradient-to-r from-blue-400 to-green-500 h-full" style={{ width: `${ambulanceMarkerProgress}%` }}></div>
                                </div>
                                <span className="text-[9px] text-slate-400 block">{ambulanceMarkerProgress}% progress along GPS pathway</span>
                              </div>
                            ) : (
                              <button
                                onClick={dispatchAmbulanceOnMap}
                                className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-extrabold text-xs py-3 rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
                              >
                                Simulate Live Ambulance Escort
                              </button>
                            )}

                            <a
                              href={getGoogleMapsDirUrl(mapSelectedHospital?.name || "", mapSelectedHospital?.address || "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full bg-blue-50 hover:bg-blue-100/85 text-blue-700 font-bold text-xs py-3 rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 text-center active:scale-[0.98] border border-blue-200"
                            >
                              <ExternalLink className="h-4 w-4 text-blue-500 animate-pulse" />
                              Redirect to Google Maps Route
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500 italic font-medium leading-relaxed">
                          Click <strong>"Map & Track Dispatch"</strong> on any hospital card to load active street routes and simulate a real-time Ambulance response track!
                        </div>
                      )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow space-y-3 text-slate-800">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-rose-100 pb-2 flex items-center gap-1.5 text-rose-600">
                        <AlertTriangle className="h-4 w-4" /> Emergency protocol guidelines
                      </h4>
                      <p className="text-xs text-slate-500 leading-normal font-medium">
                        Hospital staffs can alter bed reservation limits immediately inside the <strong>"Registry Manager" (Admin Role)</strong> to emulate real-time municipal updates!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB VIEW 4: CONSULTATIONS ROOM & OPD TOKENS */}
            {activeTab === "consultation" && (
              <div className="space-y-6 pb-12">
                {/* Book Consult Modal dialog in-frame */}
                {bookingDoc && (
                  <div className="bg-white border border-blue-200 rounded-3xl p-6 shadow-md max-w-xl mx-auto space-y-4 border-t-4 border-t-blue-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">Request consultation slot</h3>
                        <p className="text-xs text-slate-500">Scheduling slot with {bookingDoc.name}</p>
                      </div>
                      <button onClick={() => setBookingDoc(null)} className="text-slate-400 hover:text-slate-900 p-1">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <form onSubmit={handleBookAppointment} className="grid gap-4 text-xs font-medium">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-slate-600">Choose date</label>
                          <input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-lg" required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-slate-600">Choose preferred time</label>
                          <input type="text" placeholder="10:30 AM" value={apptTime} onChange={(e) => setApptTime(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-lg" required />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-600">Select Session Type</label>
                        <select
                          value={apptType}
                          onChange={(e: any) => setApptType(e.target.value)}
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                        >
                          <option value="VIRTUAL">Virtual Chat Room & Prescriptions</option>
                          <option value="IN_PERSON">In-Person Clinical Attendance</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-600">Current active symptoms or reason for visit</label>
                        <textarea
                          rows={3}
                          placeholder="Fever symptoms, joint pain review..."
                          value={apptSymptoms}
                          onChange={(e) => setApptSymptoms(e.target.value)}
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                          required
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setBookingDoc(null)} className="px-4 py-2 border border-slate-200 rounded-lg">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Book Appointment</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* DOCTOR - ACTIVE INTERACTIVE CHAT CONSULT ROOM WORKSPACE */}
                {consultingAppt ? (
                  <div className="grid gap-6 lg:grid-cols-3">
                    {/* Chat messaging column */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-[520px]">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cyan-100 text-cyan-700 rounded-xl flex items-center justify-center font-bold">
                            Rx
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-900">{consultingAppt.doctorName}</h3>
                            <p className="text-[10px] text-slate-400">Registered on clinical specialization grid • Live Chat session active</p>
                          </div>
                        </div>

                        <button
                          onClick={() => setConsultingAppt(null)}
                          className="px-3.5 py-1.5 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          Leave Counsel
                        </button>
                      </div>

                      {/* Chat screen feed */}
                      <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-2xl mb-4 border border-slate-100 shadow-inner">
                        <div className="p-3 bg-blue-50 text-blue-800 text-[11px] rounded-xl font-medium max-w-md">
                          <strong>City Healer Assistant:</strong> Consultation Room initialized. Send a detailing prompt below. Doctor answers instantly representing specialized evaluation.
                        </div>

                        {chatMessages.map((msg) => {
                          const isMe = msg.sender === (activeRole === "DOCTOR" ? "DOCTOR" : "PATIENT");
                          return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`p-3 max-w-sm rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                                isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                              }`}>
                                <p>{msg.text}</p>
                                <span className={`block text-[8px] text-right mt-1 ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                                  {msg.timestamp}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={chatBottomRef}></div>
                      </div>

                      {/* Input fields */}
                      <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder={isListening ? "Listening... Speak hands-free..." : "Type dialogue message to explain condition..."}
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            className={`w-full border rounded-xl pl-4 pr-11 py-3 text-xs font-medium focus:outline-none focus:ring-1 transition-all ${
                              isListening 
                                ? "border-rose-300 bg-rose-50/35 focus:ring-rose-500 text-rose-950 font-semibold" 
                                : "border-slate-200 focus:ring-blue-500 text-slate-800"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={toggleListening}
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg active:scale-90 transition-all ${
                              !speechSupported 
                                ? "bg-slate-100 text-slate-300 cursor-not-allowed opacity-60" 
                                : isListening 
                                ? "bg-rose-500 text-white animate-pulse shadow-sm hover:bg-rose-600" 
                                : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                            }`}
                            title={
                              !speechSupported 
                                ? "Speech recognition is not supported in this browser" 
                                : isListening 
                                ? "Listening... Click to stop" 
                                : "Describe symptoms hands-free / Voice-to-Text"
                            }
                          >
                            {isListening ? (
                              <Mic className="h-4 w-4" />
                            ) : (
                              <MicOff className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <button type="submit" className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl active:scale-95 transition-all self-stretch flex items-center justify-center">
                          <Send className="h-4 w-4" />
                        </button>
                      </form>
                    </div>

                    {/* Prescription generator sidebar based on simulation identity */}
                    <div className="space-y-6">
                      {activeRole === "DOCTOR" ? (
                        /* Doctor can write real prescriptions */
                        <form onSubmit={handleDoctorSubmitPrescription} className="bg-white border border-slate-200 rounded-3xl p-6 shadow space-y-4">
                          <div className="border-b border-amber-100 pb-2">
                            <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                              <Sparkles className="h-4 w-4" /> Clinician prescribing console
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1">Authorized under doctor signature verification rules.</p>
                          </div>

                          <div className="space-y-1.5 text-xs font-semibold">
                            <label className="text-slate-600">Diagnosis conclusion</label>
                            <input
                              type="text"
                              value={prescriptionDiagnosis}
                              onChange={(e) => setPrescriptionDiagnosis(e.target.value)}
                              placeholder="e.g. Bacterial pharyngitis or viral chest inflammation"
                              className="w-full border border-slate-200 p-2.5 rounded-lg"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                              <span>Medicines list</span>
                              <button
                                type="button"
                                onClick={() => setPrescriptionMedicines([...prescriptionMedicines, { name: "", dosage: "", frequency: "", duration: "" }])}
                                className="text-blue-600 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" /> Add drug
                              </button>
                            </div>

                            {prescriptionMedicines.map((m, idx) => (
                              <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-2">
                                <input
                                  type="text"
                                  placeholder="Medicine name (e.g. Paracetamol Acetaminophen)"
                                  value={m.name}
                                  onChange={(e) => {
                                    const next = [...prescriptionMedicines];
                                    next[idx].name = e.target.value;
                                    setPrescriptionMedicines(next);
                                  }}
                                  className="w-full border-b border-slate-200 p-1 bg-transparent placeholder:text-slate-400 text-xs text-slate-800"
                                  required
                                />
                                <div className="grid grid-cols-3 gap-1">
                                  <input
                                    type="text"
                                    placeholder="Dosage (500mg)"
                                    value={m.dosage}
                                    onChange={(e) => {
                                      const next = [...prescriptionMedicines];
                                      next[idx].dosage = e.target.value;
                                      setPrescriptionMedicines(next);
                                    }}
                                    className="border-none text-[10px] p-1 bg-transparent placeholder:text-slate-400 text-slate-700"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Freq (Twice daily)"
                                    value={m.frequency}
                                    onChange={(e) => {
                                      const next = [...prescriptionMedicines];
                                      next[idx].frequency = e.target.value;
                                      setPrescriptionMedicines(next);
                                    }}
                                    className="border-none text-[10px] p-1 bg-transparent placeholder:text-slate-400 text-slate-700"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Dur (5 days)"
                                    value={m.duration}
                                    onChange={(e) => {
                                      const next = [...prescriptionMedicines];
                                      next[idx].duration = e.target.value;
                                      setPrescriptionMedicines(next);
                                    }}
                                    className="border-none text-[10px] p-1 bg-transparent placeholder:text-slate-400 text-slate-700"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1.5 text-xs font-semibold">
                            <label className="text-slate-600">General instructions & diet tips</label>
                            <input
                              type="text"
                              value={prescriptionInstructions}
                              onChange={(e) => setPrescriptionInstructions(e.target.value)}
                              placeholder="Stay hydrated. Rest in safe posture."
                              className="w-full border border-slate-200 p-2.5 rounded-lg"
                            />
                          </div>

                          <button type="submit" className="w-full text-center py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-extrabold uppercase">
                            Issue Signature Prescription
                          </button>
                        </form>
                      ) : (
                        /* Patient sees instructions and metadata info */
                        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-cyan-300 tracking-wider">How to test prescribing?</h4>
                          <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                            Switch identity to <strong className="text-cyan-200 font-extrabold">"Doctor Simulate Role"</strong> using the role list selector at the top header to write custom diagnostics.
                          </p>
                          <div className="p-3.5 bg-white/10 rounded-2xl border border-white/5 space-y-2">
                            <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider block">Diagnosis Target</span>
                            <p className="text-xs font-medium">Patient {consultingAppt.patientName} reported symptoms: "{consultingAppt.symptoms}"</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Standard Doctor & OPD index locator layout */
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="md:col-span-2 space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Available metropolitan doctors & clinics</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {filteredDoctors.map((doc) => (
                            <div key={doc.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                              <div className="flex items-start gap-3">
                                {doc.imageUrl ? (
                                  <img src={doc.imageUrl} className="w-12 h-12 rounded-xl object-cover border border-slate-100 mr-1" alt={doc.name} />
                                ) : (
                                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold font-mono">
                                    MD
                                  </div>
                                )}
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <h4 className="text-sm font-extrabold text-slate-900 truncate pr-0.5">{doc.name}</h4>
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${doc.online ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                  </div>
                                  <p className="text-[11px] text-blue-600 font-bold truncate leading-none">{doc.specialty}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{doc.hospitalName}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold pt-2.5 border-t border-slate-100">
                                <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl leading-none">
                                  <span className="text-[9px] text-slate-400 block font-bold mb-1">Queue Size</span>
                                  <span className="text-slate-800 text-sm font-black">{doc.queueCount} patients</span>
                                </div>
                                <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl leading-none">
                                  <span className="text-[9px] text-slate-400 block font-bold mb-1">Clinic Wait</span>
                                  <span className={doc.waitTimeMin > 25 ? 'text-amber-600 text-sm font-black' : 'text-slate-800 text-sm font-black'}>
                                    {doc.waitTimeMin} mins
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-1.5">
                                <button
                                  onClick={() => handleOPDTokenRequest(doc.id)}
                                  className="flex-1 py-2 border border-blue-100 text-blue-600 font-extrabold text-xs rounded-xl hover:bg-blue-50 transition-all text-center cursor-pointer"
                                >
                                  Take OPD Token
                                </button>
                                <button
                                  onClick={() => setBookingDoc(doc)}
                                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl text-center cursor-pointer active:scale-95 transition-all"
                                >
                                  Book Slot
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* OPD Token tracker sidebar stats */}
                      <div className="space-y-6">
                        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm space-y-4">
                          <h4 className="text-xs font-black uppercase text-cyan-300 tracking-wider">Dynamic Token Dispenser</h4>
                          <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                            Generate live tokens for digital consult pathways straight to clinical OPD queues. Avoid sitting in physical hospital queue delays.
                          </p>

                          <div className="p-3.5 bg-white/10 rounded-2xl border border-white/5 space-y-2">
                            <span className="text-[9px] font-black uppercase text-cyan-400 tracking-wider block">Active Queue Session Info</span>
                            {myQueueToken ? (
                              <div className="space-y-1.5 text-xs font-semibold">
                                <p className="text-cyan-100 text-sm">Issued Token: {myQueueToken.tokenNumber}</p>
                                <p className="text-slate-300">Wait status index: {myQueueToken.estimatedWaitTimeMin} min</p>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 font-medium">To test OPD waiting matrices, allocate a token or select "Doctor role" to simulate calling patient into consultation room.</p>
                            )}
                          </div>
                        </div>

                        {/* Direct Active scheduled sessions index board */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow space-y-3">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-1">Scheduled Consultations</h4>
                          {myAppointments.filter((a) => a.status === "ACCEPTED" || a.status === "PENDING").map((appt) => (
                            <div key={appt.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-semibold">
                              <div>
                                <p className="text-slate-800">{appt.doctorName}</p>
                                <p className="text-[10px] text-slate-400">{appt.time} • {appt.date}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setConsultingAppt(appt);
                                }}
                                className="px-3.5 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                              >
                                Join Consult
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB VIEW 5: MEDICINE ORDERING / PHARMACY STORE */}
            {activeTab === "pharmacy" && (
              <div className="space-y-6 pb-12">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">Express Pharmacy Marketplace</h2>
                    <p className="text-xs text-slate-500 mt-1">Grid integrated drug dispatch. Search standard pharmaceuticals and checkout immediately.</p>
                  </div>
                  {/* Cart count trigger display */}
                  <div className="flex items-center gap-2">
                    {Object.keys(cart).length > 0 && (
                      <span className="p-1 px-3.5 bg-rose-100 text-rose-850 text-xs font-black rounded-full animate-bounce">
                        {Object.values(cart).reduce((a: number, b: number) => a + b, 0)} Items loaded
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-500">Cart Total: </span>
                    <span className="font-mono text-sm font-extrabold text-blue-600">₹{cartTotalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* AI visual Verification Announcement banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl p-5 flex items-start gap-4 shadow-sm animate-fade-in text-slate-800">
                  <div className="p-2.5 bg-blue-600 rounded-2xl text-white shrink-0 shadow-md shadow-blue-500/10">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5 font-sans">
                      🔬 AI-Powered Pill Inspection & Verification Active
                    </h4>
                    <p className="text-[11px] text-blue-850 leading-relaxed font-semibold">
                      To safeguard patient health, all express catalog medicines include certified 3D clinical visual reference keys. Verify exact pill dimensions, color signatures, and scoring markings against your physical tablets by clicking <strong className="text-blue-900 font-extrabold">"Verify Pill"</strong> on any item card.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-6">
                    {/* Search Bar Segment */}
                    <div className="bg-slate-50 border border-slate-250 rounded-3xl p-4 md:p-5 space-y-3.5 shadow-sm">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search Crocin, Dolo 650, Pan-D, or a disease/ailment..."
                            value={pharmacySearchQuery}
                            onChange={(e) => setPharmacySearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-250 rounded-2xl pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                          {pharmacySearchQuery && (
                            <button
                              onClick={() => setPharmacySearchQuery("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 font-extrabold text-[10px]"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => handleNationwideSearch()}
                          disabled={isSearchingNationwide || !pharmacySearchQuery.trim()}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-extrabold rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                        >
                          {isSearchingNationwide ? (
                            <span className="flex items-center gap-1.5">
                              <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              AI Indexing...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-blue-200 animate-pulse" />
                              Search India AI Nationwide
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Info / state indicator */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] text-slate-500 font-black tracking-wider uppercase gap-1.5 px-1">
                        <div>
                          {pharmacySearchQuery ? (
                            <span>
                              Filtering catalog by key: <span className="text-blue-600 font-black font-mono">"{pharmacySearchQuery}"</span>
                            </span>
                          ) : (
                            <span>Default Standard Indian Catalogue</span>
                          )}
                        </div>
                        {nationwideSearchSource === "gemini-nationwide-db" ? (
                          <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Nationwide AI Index Synced
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">Standard Store Base</span>
                        )}
                      </div>
                    </div>

                    {/* Catalog tabs filters */}
                    <div className="flex gap-2 border-b border-slate-100 pb-3 overflow-x-auto text-xs font-bold">
                      {[
                        { id: "all", label: "All Items" },
                        { id: "PAINKILLER", label: "Pain Relief" },
                        { id: "ANTIBIOTIC", label: "Antibiotics" },
                        { id: "CARDIO", label: "Cardio Care" },
                        { id: "VITAMINS", label: "Vitamins & Defense" },
                        { id: "CHRONIC", label: "Chronic disease" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setPharmacyTab(item.id)}
                          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                            pharmacyTab === item.id ? "bg-slate-900 text-slate-100 font-black shadow-sm" : "text-slate-500 hover:text-slate-900 bg-white border border-slate-200"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Medicines display grid */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(() => {
                        const filtered = medicines.filter((m) => {
                          const tabMatches = pharmacyTab === "all" || m.category === pharmacyTab;
                          const queryMatches = !pharmacySearchQuery.trim() ||
                            m.name.toLowerCase().includes(pharmacySearchQuery.toLowerCase()) ||
                            m.description.toLowerCase().includes(pharmacySearchQuery.toLowerCase()) ||
                            m.category.toLowerCase().includes(pharmacySearchQuery.toLowerCase()) ||
                            (m.dosageForm && m.dosageForm.toLowerCase().includes(pharmacySearchQuery.toLowerCase()));
                          return tabMatches && queryMatches;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="col-span-1 sm:col-span-2 bg-slate-50 border border-dashed border-slate-250 rounded-3xl p-8 text-center space-y-4 animate-fade-in">
                              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner">
                                <Search className="h-5 w-5" />
                              </div>
                              <div className="space-y-1.5">
                                <h4 className="text-sm font-black text-slate-900">Medication Not in Current Stock View</h4>
                                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                                  We didn't locate "{pharmacySearchQuery || "Search Category"}" in our instant catalog view. Search nationwide across India's master pharmacy database via smart AI lookup.
                                </p>
                              </div>
                              {pharmacySearchQuery && (
                                <button
                                  onClick={() => handleNationwideSearch()}
                                  className="mx-auto px-5 py-2.5 bg-blue-600 font-extrabold text-white rounded-xl text-xs hover:bg-blue-500 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow"
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-blue-200" /> Dynamic AI Look-Up Across India
                                </button>
                              )}
                            </div>
                          );
                        }

                        return filtered.map((med) => {
                          const qtyInCart = cart[med.id] || 0;
                          return (
                            <div key={med.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-350 transition-all">
                              <div className="space-y-3">
                                <MedicineProductImage
                                  imageUrl={med.imageUrl}
                                  name={med.name}
                                  pillsColor={med.pillsColor}
                                  pillsShape={med.pillsShape}
                                  pillsMarkings={med.pillsMarkings}
                                  dosageForm={med.dosageForm}
                                  category={med.category}
                                  requiresPrescription={med.requiresPrescription}
                                  onVerifyClick={() => setActiveVerificationPill(med)}
                                  aspectRatio="video"
                                />
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-start">
                                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold border border-blue-100">
                                      {med.category} • {med.dosageForm}
                                    </span>
                                    {med.requiresPrescription && (
                                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold border border-amber-100 flex items-center gap-0.5">
                                        <FileText className="h-2.5 w-2.5" /> Rx Key Required
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-sm font-extrabold text-slate-900">{med.name}</h4>
                                  <p className="text-xs text-slate-500 leading-normal font-medium">{med.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4 font-sans">
                                <span className="font-mono text-base font-extrabold text-slate-900">₹{med.price.toFixed(2)}</span>
                                {qtyInCart > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => updateCartQty(med.id, qtyInCart - 1)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg font-extrabold text-xs cursor-pointer">-</button>
                                    <span className="text-xs font-black">{qtyInCart}</span>
                                    <button onClick={() => updateCartQty(med.id, qtyInCart + 1)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg font-extrabold text-xs cursor-pointer">+</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => addToCart(med.id)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow active:scale-95 transition-all text-center cursor-pointer"
                                  >
                                    Add to cart
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Cart / Checkout section */}
                  <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest pl-1">Shopping Basket</h4>
                      
                      {Object.keys(cart).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">Your shopping cart is empty.</p>
                      ) : (
                        <div className="space-y-3 font-semibold text-xs text-slate-700">
                          {Object.entries(cart).map(([medId, qty]) => {
                            const med = medicines.find((p) => p.id === medId);
                            if (!med) return null;
                            const q = Number(qty);
                            const photo = cartItemPhotos[medId];
                            const isVerified = verifiedMatches[medId]?.affirmed;

                            return (
                              <div key={medId} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100 gap-1">
                                <div className="flex items-center gap-2 truncate pr-2">
                                  {photo ? (
                                    <img 
                                      src={photo} 
                                      alt="Verification thumbnail" 
                                      className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                                      title="Physical pill match verification attached"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-slate-100 border border-slate-150 rounded-lg flex items-center justify-center shrink-0 text-slate-400" title="No visual reference uploaded yet. See verification panel below.">
                                      <Camera className="h-4 w-4" />
                                    </div>
                                  )}
                                  <div className="truncate">
                                    <p className="text-slate-800 text-xs font-extrabold truncate">{med.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] text-slate-400 font-medium">₹{med.price.toFixed(2)} each</span>
                                      {isVerified && (
                                        <span className="bg-emerald-50 text-emerald-700 text-[8px] font-black px-1 rounded flex items-center gap-0.5">
                                          ✓ Verified
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 font-bold text-[11px]">
                                  <span className="text-slate-500">x{q}</span>
                                  <span className="text-slate-800">₹{(med.price * q).toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}

                          <div className="border-t border-slate-100 pt-3 space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Service Fee:</span> <span>₹0.00 (Express Free)</span>
                            </div>
                            <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1">
                              <span>Total to Pay:</span> <span>₹{cartTotalAmount.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Address Delivery parameters */}
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Express Delivery Address</label>
                            <input
                              type="text"
                              value={checkoutAddress}
                              onChange={(e) => setCheckoutAddress(e.target.value)}
                              className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                              placeholder="123 Hope Ave, Central district"
                            />
                          </div>

                          {/* Rx Upload simulator */}
                          <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
                              <Info className="h-3.5 w-3.5" /> High-hazard drugs check
                            </div>
                            <p className="text-[10px] text-slate-500">Some vitamins or painkillers might require validation scanner logs.</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPrescriptionAttached(true);
                                  setPrescriptionFileName("validated-digital-rx.pdf");
                                  showToast("Digital medical prescriptions automatically checked and linked!");
                                }}
                                className="px-3.5 py-1.5 bg-amber-600 text-white rounded-lg text-[9px] font-bold flex-1 text-center"
                              >
                                {prescriptionAttached ? "Change Linked prescription" : "Link Active prescription"}
                              </button>
                            </div>
                          </div>

                          <button
                            onClick={handlePlaceOrder}
                            className="w-full text-center py-3 bg-slate-900 text-slate-100 font-extrabold text-xs uppercase tracking-wider rounded-xl active:scale-95 transition-all text-center cursor-pointer"
                          >
                            Place Dispatch Order
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Order history summary card */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-1">Recent order dispatches</h4>
                      {orders.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium">No active pharmacy orders.</p>
                      ) : (
                        orders.map((o) => (
                          <div key={o.id} className={`p-3.5 border text-[11px] font-semibold space-y-2.5 rounded-2xl transition-all ${isAppDarkMode ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-100"}`}>
                            <div className={`flex justify-between items-center border-b pb-1.5 mb-1 bg-transparent ${isAppDarkMode ? "border-slate-800" : "border-slate-150"}`}>
                              <span className={`font-mono uppercase font-black text-xs ${isAppDarkMode ? "text-white" : "text-slate-800"}`}>Order {o.id}</span>
                              <span className={`px-2 py-0.5 rounded-md font-black text-[9px] ${isAppDarkMode ? "bg-emerald-950/40 text-emerald-400" : "bg-emerald-100 text-emerald-800"}`}>
                                {o.status}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {(o.items as any[]).map((it: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center gap-2 py-1 border-b border-slate-50 last:border-0 pb-1 last:pb-0 bg-transparent">
                                  <div className="flex items-center gap-2 truncate">
                                    {it.attachedPhoto ? (
                                      <img 
                                        src={it.attachedPhoto} 
                                        alt="attached identification matches" 
                                        className="w-8 h-8 object-cover rounded-md border border-slate-200 shrink-0" 
                                      />
                                    ) : (
                                      <div className="w-8 h-8 bg-slate-100 border border-slate-150 rounded-md shrink-0 flex items-center justify-center text-slate-400" title="No matching photo reference linked.">
                                        <Camera className="h-3.5 w-3.5" />
                                      </div>
                                    )}
                                    <span className="truncate text-[10px] text-slate-700 font-extrabold font-sans">
                                      {it.name} <span className="text-slate-400 font-semibold">(x{it.quantity})</span>
                                    </span>
                                  </div>
                                  {it.verified && (
                                    <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1 rounded shrink-0 uppercase tracking-wider">
                                      ✓ Verified
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <p className="text-[9px] text-slate-400 italic pt-1">Deliver to: {o.deliveryAddress}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Visual Identification Matching Workspace */}
                <MedicationVisualMatcher
                  cart={cart}
                  medicines={medicines}
                  cartItemPhotos={cartItemPhotos}
                  onSavePhoto={handleSavePhoto}
                  verifiedMatches={verifiedMatches}
                  onUpdateVerification={handleUpdateVerification}
                  showToast={showToast}
                />

                {/* AI Medication Guide Workspace */}
                <AIMedicationGuide
                  medicines={medicines}
                  showToast={showToast}
                />
              </div>
            )}

            {/* TAB VIEW 6: DIGITAL HEALTH RECORDS / CLINICAL HISTORY */}
            {activeTab === "records" && (
              <div className="space-y-6 pb-12 animate-fade-in text-slate-800">
                
                {/* Top Welcome Title Grid */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-cyan-400/10 rounded-full blur-2xl"></div>
                  <div className="space-y-2 z-10">
                    <div className="flex items-center gap-2">
                      <span className="bg-cyan-500/20 text-cyan-300 font-mono text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded">Vault ID Approved</span>
                      <span className="text-[10px] text-slate-400 font-medium">Policy: CH-POL-98101-A</span>
                    </div>
                    <h2 className="text-xl font-black text-white tracking-tight">Clinical Health Ledger: {activeFamilyMember} ({familyMembers.find(f => f.name === activeFamilyMember)?.relation || "Self"})</h2>
                    <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                      Access verified prescriptions, set medication timers, log aerosol indicators, and review diagnostic scans directly linked from hospitals.
                    </p>
                  </div>
                  <div className="bg-white/10 border border-white/10 rounded-2xl p-4 shrink-0 text-center z-10 w-full sm:w-auto">
                    <span className="text-[9px] uppercase font-bold text-cyan-300 tracking-wider block">Family Blood Type</span>
                    <span className="text-2xl font-black text-white block">
                      {familyMembers.find(f => f.name === activeFamilyMember)?.bloodGroup || "O+"}
                    </span>
                    <span className="text-[10px] text-slate-300">Age: {familyMembers.find(f => f.name === activeFamilyMember)?.age || 34} yr</span>
                  </div>
                </div>

                {/* Embedded Records Sub-navigation Bar */}
                <div className="flex flex-wrap border-b border-slate-200 gap-1 mb-2">
                  <button
                    onClick={() => setRecordsSubTab("vault")}
                    className={`py-3 px-5 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      recordsSubTab === "vault"
                        ? "border-blue-600 text-blue-600 font-black"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    📂 Medical Vault
                  </button>
                  <button
                    onClick={() => setRecordsSubTab("abha")}
                    className={`py-3 px-5 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      recordsSubTab === "abha"
                        ? "border-blue-600 text-blue-600 font-black"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    🆔 ABHA Digital Card
                  </button>
                  <button
                    onClick={() => setRecordsSubTab("analyzer")}
                    className={`py-3 px-5 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      recordsSubTab === "analyzer"
                        ? "border-blue-600 text-blue-600 font-black"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    🧪 AI report Analyzer
                  </button>
                  <button
                    onClick={() => setRecordsSubTab("vaccines")}
                    className={`py-3 px-5 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      recordsSubTab === "vaccines"
                        ? "border-blue-600 text-blue-600 font-black"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    👶 Child Vaccine Tracker
                  </button>
                </div>

                {recordsSubTab === "vault" ? (
                  <div className="space-y-6">
                    {/* Premium Interactive Vitals Dashboard Panel */}
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pulse Rate</span>
                      <Heart className="h-5 w-5 text-rose-500 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-3xl font-black text-slate-900">74</span>
                      <span className="text-[10px] text-slate-500 font-bold ml-1">BPM</span>
                    </div>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 font-bold inline-block">
                      ● Stable rhythm
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Blood Oxygen</span>
                      <Droplet className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <span className="text-3xl font-black text-slate-900">98</span>
                      <span className="text-[10px] text-slate-500 font-bold ml-1">% SpO2</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full w-[98%]"></div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Blood Pressure</span>
                      <Activity className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <span className="text-3xl font-black text-slate-900">120/80</span>
                      <span className="text-[10px] text-slate-500 font-bold ml-1">mmHg</span>
                    </div>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 font-bold inline-block">
                      ● Optimal range
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Air Smog Asthma Warning</span>
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <span className="text-3xl font-black text-slate-900">58%</span>
                      <span className="text-[10px] text-slate-500 font-bold ml-1">Sensitivity</span>
                    </div>
                    <span className="rounded-full bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 font-bold inline-block">
                      ▲ Inhaler Carry Alert
                    </span>
                  </div>
                </div>

                {/* METRICS VISUALIZATION FEATURE (RECHARTS) */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                        <Activity className="h-5 w-5 text-blue-600 shrink-0" /> Interactive Clinical Vitals History & Trends
                      </h3>
                      <p className="text-xs text-slate-500">Historical blood pressure, body chemistry glucose, or pulse rate values over time with real-time logging.</p>
                    </div>

                    {/* Chart Selector buttons */}
                    <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                      <button
                        onClick={() => setSelectedTrendChart("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedTrendChart === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        📊 Compare All
                      </button>
                      <button
                        onClick={() => setSelectedTrendChart("bp")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedTrendChart === "bp" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        ❤️ Blood Pressure
                      </button>
                      <button
                        onClick={() => setSelectedTrendChart("glucose")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedTrendChart === "glucose" ? "bg-white text-blue-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        🩸 Blood Glucose
                      </button>
                      <button
                        onClick={() => setSelectedTrendChart("pulse")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedTrendChart === "pulse" ? "bg-white text-rose-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        💓 Pulse Rate
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-3">
                    {/* Recharts container (span-2) */}
                    <div className="lg:col-span-2 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl h-[340px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {selectedTrendChart === "all" ? (
                          <LineChart data={vitalsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px" }} />
                            <Legend wrapperStyle={{ fontSize: "10px" }} />
                            <Line type="monotone" dataKey="bpSystolic" name="BP Systolic (mmHg)" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} isAnimationActive={true} animationDuration={1000} animationEasing="ease-in-out" />
                            <Line type="monotone" dataKey="glucose" name="Glucose (mg/dL)" stroke="#3b82f6" strokeWidth={2.5} isAnimationActive={true} animationDuration={1200} animationEasing="ease-in-out" />
                            <Line type="monotone" dataKey="pulse" name="Pulse Rate (BPM)" stroke="#f43f5e" strokeWidth={2.5} isAnimationActive={true} animationDuration={1400} animationEasing="ease-in-out" />
                          </LineChart>
                        ) : selectedTrendChart === "bp" ? (
                          <AreaChart data={vitalsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorBp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                            <YAxis domain={[50, 160]} tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px" }} />
                            <Legend wrapperStyle={{ fontSize: "10px" }} />
                            <Area type="monotone" dataKey="bpSystolic" name="Systolic BP" stroke="#10b981" fillOpacity={1} fill="url(#colorBp)" strokeWidth={2.5} isAnimationActive={true} animationDuration={1100} animationEasing="ease-in-out" />
                            <Area type="monotone" dataKey="bpDiastolic" name="Diastolic BP" stroke="#059669" fillOpacity={0} strokeWidth={2} isAnimationActive={true} animationDuration={1300} animationEasing="ease-in-out" />
                            <ReferenceLine y={120} stroke="#34d399" strokeDasharray="3 3" label={{ value: "Optimal Systolic 120", fill: "#059669", fontSize: 9, position: "top" }} />
                          </AreaChart>
                        ) : selectedTrendChart === "glucose" ? (
                          <AreaChart data={vitalsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorGlucose" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                            <YAxis domain={[60, 180]} tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px" }} />
                            <Legend wrapperStyle={{ fontSize: "10px" }} />
                            <Area type="monotone" dataKey="glucose" name="Glucose (mg/dL)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorGlucose)" strokeWidth={2.5} isAnimationActive={true} animationDuration={1200} animationEasing="ease-in-out" />
                            <ReferenceLine y={100} stroke="#93c5fd" strokeDasharray="3 3" label={{ value: "Fasting Limit 100", fill: "#2563eb", fontSize: 9, position: "top" }} />
                            <ReferenceLine y={140} stroke="#fca5a5" strokeDasharray="3 3" label={{ value: "Postprandial Limit 140", fill: "#dc2626", fontSize: 9, position: "top" }} />
                          </AreaChart>
                        ) : (
                          <AreaChart data={vitalsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                            <YAxis domain={[40, 120]} tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px" }} />
                            <Legend wrapperStyle={{ fontSize: "10px" }} />
                            <Area type="monotone" dataKey="pulse" name="Pulse Rate (BPM)" stroke="#f43f5e" fillOpacity={1} fill="url(#colorPulse)" strokeWidth={2.5} isAnimationActive={true} animationDuration={1200} animationEasing="ease-in-out" />
                            <ReferenceLine y={72} stroke="#fda4af" strokeDasharray="3 3" label={{ value: "Avg Pulse 72", fill: "#e11d48", fontSize: 9, position: "top" }} />
                          </AreaChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                    {/* Vitals logger form */}
                    <form onSubmit={handleAddVitalLog} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shrink-0 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1 mb-2">
                          ✏️ Track Vital Reading
                        </h4>

                        <div className="space-y-2.5">
                          {/* Log category selector */}
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Metric Type</label>
                            <div className="grid grid-cols-3 gap-1 bg-slate-200/50 p-0.5 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setVitalInputType("bp")}
                                className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${vitalInputType === "bp" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"}`}
                              >
                                BP
                              </button>
                              <button
                                type="button"
                                onClick={() => setVitalInputType("glucose")}
                                className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${vitalInputType === "glucose" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"}`}
                              >
                                Sugar
                              </button>
                              <button
                                type="button"
                                onClick={() => setVitalInputType("pulse")}
                                className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${vitalInputType === "pulse" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"}`}
                              >
                                Pulse
                              </button>
                            </div>
                          </div>

                          {/* Dynamic Inputs based on type */}
                          {vitalInputType === "bp" && (
                            <div className="grid grid-cols-2 gap-2 animate-fade-in">
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Systolic (mmHg)</label>
                                <input
                                  type="number"
                                  value={inputBPSystolic}
                                  onChange={(e) => setInputBPSystolic(e.target.value)}
                                  className="w-full bg-white border border-slate-200 px-3 py-1.5 text-xs rounded-xl focus:outline-none font-bold"
                                  min="80"
                                  max="200"
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Diastolic (mmHg)</label>
                                <input
                                  type="number"
                                  value={inputBPDiastolic}
                                  onChange={(e) => setInputBPDiastolic(e.target.value)}
                                  className="w-full bg-white border border-slate-200 px-3 py-1.5 text-xs rounded-xl focus:outline-none font-bold"
                                  min="40"
                                  max="120"
                                  required
                                />
                              </div>
                            </div>
                          )}

                          {vitalInputType === "glucose" && (
                            <div className="space-y-1 animate-fade-in">
                              <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Sugar Value (mg/dL)</label>
                              <input
                                type="number"
                                value={inputGlucose}
                                onChange={(e) => setInputGlucose(e.target.value)}
                                className="w-full bg-white border border-slate-200 px-3 py-1.5 text-xs rounded-xl focus:outline-none font-bold"
                                min="30"
                                max="400"
                                required
                              />
                            </div>
                          )}

                          {vitalInputType === "pulse" && (
                            <div className="space-y-1 animate-fade-in">
                              <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Pulse BPM (beats/min)</label>
                              <input
                                type="number"
                                value={inputPulse}
                                onChange={(e) => setInputPulse(e.target.value)}
                                className="w-full bg-white border border-slate-200 px-3 py-1.5 text-xs rounded-xl focus:outline-none font-bold"
                                min="40"
                                max="200"
                                required
                              />
                            </div>
                          )}

                          {/* Shared Logging Date Pin */}
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Log Date</label>
                            <input
                              type="date"
                              value={inputVitalDate}
                              onChange={(e) => setInputVitalDate(e.target.value)}
                              className="w-full bg-white border border-slate-200 px-3 py-1.5 text-xs rounded-xl focus:outline-none font-medium text-slate-700 cursor-pointer"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer mt-4 uppercase tracking-wider"
                      >
                        Add Entry & Plot
                      </button>
                    </form>
                  </div>
                </div>

                {/* Medication Scheduler Grid & checklist controls */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                        <Clock className="h-5 w-5 text-blue-500 shrink-0" /> {activeFamilyMember}'s Medication Adherence Timer
                      </h3>
                      <p className="text-xs text-slate-500">Real-time daily pill checklist alarms scheduler synchronized with pharmacy prescriptions.</p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shrink-0">
                      Adherence Rate: {Math.round((pillReminders.filter(p => p.takenToday).length / pillReminders.length) * 100) || 0}% Taken
                    </span>
                  </div>

                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Scheduler Checklist Column */}
                    <div className="md:col-span-2 space-y-3">
                      {pillReminders.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">No Scheduled Alarms configured. Add one on the right context form.</div>
                      ) : (
                        pillReminders.map((reminder) => (
                          <div 
                            key={reminder.id}
                            className={`p-4 border rounded-2xl transition-all flex items-center justify-between gap-4 ${
                              reminder.takenToday 
                                ? "bg-slate-50 border-emerald-100 opacity-75" 
                                : "bg-white border-slate-200 hover:border-slate-350"
                            }`}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <input 
                                type="checkbox" 
                                checked={reminder.takenToday}
                                onChange={() => toggleReminderTaken(reminder.id)}
                                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <p className={`font-extrabold text-sm ${reminder.takenToday ? "text-slate-400 line-through truncate" : "text-slate-800 truncate"}`}>
                                  {reminder.name}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  Dosage: {reminder.dosage} • Time Check: <strong>{reminder.time}</strong> • Frequency: {reminder.frequency}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-bold ${
                                reminder.takenToday ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-800"
                              }`}>
                                {reminder.takenToday ? "Checked" : "Pending"}
                              </span>
                              <button
                                onClick={() => {
                                  setPillReminders(prev => prev.filter(p => p.id !== reminder.id));
                                  showToast(`MedAlert cancelled: ${reminder.name}`);
                                }}
                                className="text-slate-400 hover:text-rose-500 p-1.5 hover:bg-slate-50 rounded-lg transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Medication Alarm Form Side Box */}
                    <form onSubmit={handleAddPillReminder} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                      <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
                        <PlusCircle className="h-4 w-4 text-slate-500 animate-pulse" /> New Adherence Alarm
                      </h4>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Pill Name</label>
                        <input 
                          type="text"
                          value={newPillName}
                          onChange={(e) => setNewPillName(e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none"
                          placeholder="e.g. Paracetamol 650"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Dosage</label>
                          <input 
                            type="text"
                            value={newPillDosage}
                            onChange={(e) => setNewPillDosage(e.target.value)}
                            className="w-full bg-white border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none"
                            placeholder="1 Tablet"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Alarm Hour</label>
                          <input 
                            type="time"
                            value={newPillTime}
                            onChange={(e) => setNewPillTime(e.target.value)}
                            className="w-full bg-white border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">Frequency</label>
                        <select
                          value={newPillFrequency}
                          onChange={(e) => setNewPillFrequency(e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none cursor-pointer"
                        >
                          <option value="Once daily morning">Once daily morning</option>
                          <option value="Twice daily after food">Twice daily after food</option>
                          <option value="Three times daily">Three times daily</option>
                          <option value="Daily before bedtime">Daily before bedtime</option>
                        </select>
                      </div>

                      <button 
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2 rounded-xl transition-all mt-2 cursor-pointer"
                      >
                        Store Adherence Alarm
                      </button>
                    </form>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950">Encrypted Digital Health Records</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Verified medical diagnoses, clinical scans, body chemistry indices, and digital pharmaceutical certifications.
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Medical Diagnosis Folders</h3>
                    <div className="space-y-4">
                      {records.map((rec) => (
                        <div key={rec.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3 hover:border-blue-100 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[9px] tracking-wider text-slate-400">{rec.date}</span>
                              <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 rounded uppercase">Certified</span>
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-900 truncate">{rec.title}</h4>
                            <p className="text-[11px] text-slate-500 italic">Issued under: {rec.doctorName}</p>
                            <p className="text-xs text-slate-600 leading-relaxed font-semibold max-w-xl">
                              {rec.diagnoseSummary}
                            </p>
                          </div>

                          {rec.attachmentName && (
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-4 shrink-0 w-full sm:w-auto">
                              <div>
                                <span className="text-[9px] font-black uppercase text-slate-400 block">linked attachment</span>
                                <span className="text-xs font-bold text-slate-700 truncate block max-w-[120px]">{rec.attachmentName}</span>
                              </div>
                              <button
                                onClick={() => {
                                  showToast(`Initializing medical scanner for dynamic document download: ${rec.attachmentName}`);
                                }}
                                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold shrink-0 shadow-sm"
                              >
                                Download Scanner
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add record simulator */}
                  <div className="space-y-6">
                    <form onSubmit={handleUploadRecord} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <div className="border-b border-blue-50 pb-2">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest pl-1">Simulate Medical Scan upload</h4>
                        <p className="text-[10px] text-slate-500 mt-1">Patients can upload direct clinical records to secure digital vaults.</p>
                      </div>

                      <div className="space-y-1.5 text-xs font-semibold">
                        <label className="text-slate-600 font-bold uppercase text-[9px] tracking-wider block">Document title / Clinic node</label>
                        <input
                          type="text"
                          value={newRecordTitle}
                          onChange={(e) => setNewRecordTitle(e.target.value)}
                          placeholder="e.g. Chest X-Ray scan report"
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1.5 text-xs font-semibold">
                        <label className="text-slate-600 font-bold uppercase text-[9px] tracking-wider block">Attending Physician</label>
                        <input
                          type="text"
                          value={newRecordDoctor}
                          onChange={(e) => setNewRecordDoctor(e.target.value)}
                          placeholder="e.g. Dr. Arthur Mitchel"
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1.5 text-xs font-semibold">
                        <label className="text-slate-600 font-bold uppercase text-[9px] tracking-wider block">File description & diagnostics summaries</label>
                        <textarea
                          rows={3}
                          value={newRecordSummary}
                          onChange={(e) => setNewRecordSummary(e.target.value)}
                          placeholder="Detail findings indices clearly..."
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1.5 text-xs font-semibold">
                        <label className="text-slate-600 font-bold uppercase text-[9px] tracking-wider block">Mock Diagnostic scan filename</label>
                        <input
                          type="text"
                          value={newRecordAttachment}
                          onChange={(e) => setNewRecordAttachment(e.target.value)}
                          placeholder="scantrack_lungs.jpg"
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                        />
                      </div>

                      <button type="submit" className="w-full text-center py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold uppercase">
                        Link Scanner Record Document
                      </button>
                    </form>

                    <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm space-y-3 text-xs leading-relaxed">
                      <h4 className="text-[10px] font-black uppercase text-cyan-300 tracking-wider">Metropolitan health credentials compliance</h4>
                      <p className="opacity-80">
                        City Healer implements symmetric cryptographic encryption protocols for decentralized health document safety, protecting patient profiles from data breaches.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : false ? (
              <>
                {activeTab === "sos" && (
                  <div className="max-w-4xl mx-auto space-y-6 pb-12">
                <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-3xl p-6 shadow-md flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-1.5">
                      <Ambulance className="h-6 w-6 animate-pulse" /> Urgent Metropolitan Emergency Trigger
                    </h2>
                    <p className="text-xs opacity-90 font-medium">Bypasses clinical checking. Instantly connects trauma vehicles and books critical care beds.</p>
                  </div>
                  <span className="w-3.5 h-3.5 rounded-full bg-white animate-ping"></span>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <form onSubmit={handleSOSSubmit} className="md:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest pb-2 border-b border-slate-100">Report Distress Information</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 text-xs font-semibold">
                        <label className="text-slate-600">Patient Emergency phone line</label>
                        <input
                          type="text"
                          value={emergencyPhone}
                          onChange={(e) => setEmergencyPhone(e.target.value)}
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1.5 text-xs font-semibold">
                        <label className="text-slate-600">Assointed Danger condition trigger</label>
                        <select
                          value={emergencyType}
                          onChange={(e: any) => setEmergencyType(e.target.value)}
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                        >
                          <option value="HEART_ATTACK">HEART ATTACK (Sudden pain, cardiovascular)</option>
                          <option value="ACCIDENT">SEVERE ACCIDENT / Homicide / Trauma</option>
                          <option value="SEVERE_BREATHING">SEVERE SHORTNESS OF BREATH / Asthma choke</option>
                          <option value="SEIZURE">EPILEPTIC SEIZURE / Stroke</option>
                          <option value="OTHER">OTHER CRITICAL SITUATION</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs font-semibold">
                      <label className="text-slate-600">Distress Location Address Coordinates</label>
                      <input
                        type="text"
                        value={emergencyAddress}
                        onChange={(e) => setEmergencyAddress(e.target.value)}
                        placeholder="Detail coordinates (e.g. 5th Cross Hope street, next to Central Cafe)"
                        className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        *SOS transmission uses localized GPS calculations to assign nearby clinics and dispatch an ambulance instantly.
                      </p>
                      <button
                        type="submit"
                        className="px-6 py-3 bg-red-650 hover:bg-red-600 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer animate-pulse shrink-0 bg-red-600"
                      >
                        TRIGGER SOS DISTRESS PANIC
                      </button>
                    </div>
                  </form>

                  {/* Sidebar tracking dispatch details */}
                  <div className="space-y-6">
                    {sosDispatched ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 text-white rounded-3xl p-5 shadow space-y-4"
                      >
                        <div className="border-b border-white/10 pb-2">
                          <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block animate-ping mr-2"></span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-400">AMBULANCE EN ROUTE</span>
                          <h4 className="font-extrabold text-sm mt-1">{sosDispatched.assignedAmbulanceRef ? sosDispatched.assignedAmbulanceRef : "AMB-231"}</h4>
                        </div>

                        <div className="space-y-2 text-xs font-semibold text-slate-300">
                          <p>Hospital Assiged: <strong className="text-white">{sosDispatched.hospitalName}</strong></p>
                          <p>Location coordinate: <span className="text-slate-400 italic block mt-0.5">{sosDispatched.address}</span></p>
                        </div>

                        <div className="font-mono text-[9px] text-slate-400 p-2.5 bg-slate-950 rounded-xl space-y-1">
                          <div className="flex justify-between">
                            <span>Status:</span> <span className="text-cyan-400">DISPATCHED</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Est. ETA:</span> <span className="text-yellow-400">3.5 min</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSosDispatched(null);
                            showToast("SOS Tracking simulator closed.");
                          }}
                          className="w-full text-center py-2 bg-white/10 text-xs font-bold rounded-lg border border-white/5"
                        >
                          Close simulator
                        </button>
                      </motion.div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 font-semibold text-xs text-slate-700 leading-normal">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">SOS Protocol status</h4>
                        <p className="text-slate-500">No active sirens dispatches connected currently in your region.</p>
                        <div className="p-3 bg-red-50 text-red-800 rounded-xl text-[11px]">
                          <strong>Note:</strong> Dispatcher monitors physical coordinates directly. Tap red panic button to simulate ambulance router.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* HISTORICAL REGIONAL ALERTS */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Regional Distress log lines</h3>
                  {alerts.length === 0 ? (
                    <p className="text-xs text-slate-400">No telemetry log alerts available.</p>
                  ) : (
                    <div className="space-y-3">
                      {alerts.map((al) => (
                        <div key={al.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-semibold">
                          <div>
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-bold uppercase mr-2">{al.type}</span>
                            <span className="text-slate-800 font-bold">{al.patientName}</span>
                            <p className="text-[10px] text-slate-400 mt-1">{al.address}</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase block">{al.status}</span>
                            <span className="text-[9px] text-blue-600 font-mono mt-1 block">Clinic: {al.hospitalName}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB VIEW 8: CLINIC HUB REGISTRY MANAGER - DELHI NCR VERIFIED ONBOARDING & MANAGEMENT HUB */}
            {activeTab === "admin" && (
              <div className="space-y-6 pb-12">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-2.5 bg-blue-100 text-blue-800 rounded font-mono text-[9px] font-black uppercase tracking-widest">
                        Government & Private Partner Network Portal
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">Managed Core: {hospitals.length} Units</span>
                    </div>
                    <h2 className={`text-xl font-black mt-1 ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>City Healer Delhi NCR Partner Network Hub</h2>
                    <p className="text-xs text-slate-400 font-medium">
                      Onboard new hospitals into the official directory and administer live bed census, clinical staffing departments, and patient bookings.
                    </p>
                  </div>
                  <div className="flex gap-2">
                     <span className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span> Live Synchronized Mode
                     </span>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-12 items-start">
                  {/* LEFT TAB: THE DYNAMIC ONBOARDING SYSTEM FORM */}
                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                        <PlusCircle className="h-4 w-4 text-blue-600" /> Onboard New NCR Partner Hospital
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">Integrate private or municipal clinical facilities into City Healer channels instantly.</p>
                    </div>

                    <form onSubmit={handleOnboardHospital} className="space-y-4 text-xs font-semibold text-slate-700">
                      <div className="space-y-1.5">
                        <label className="text-slate-600">Hospital Legal Name</label>
                        <input
                          type="text"
                          value={onboardName}
                          onChange={(e) => setOnboardName(e.target.value)}
                          placeholder="e.g. Max Super Speciality Hospital, Vaishali"
                          className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium placeholder:text-slate-300"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-600">Verified Physical Address</label>
                        <input
                          type="text"
                          value={onboardAddress}
                          onChange={(e) => setOnboardAddress(e.target.value)}
                          placeholder="e.g. Sector-1, Near Kaushambi Metro, Ghaziabad, NCR"
                          className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium placeholder:text-slate-300"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-slate-600">Total General Beds</label>
                          <input
                            type="number"
                            value={onboardTotalBeds}
                            onChange={(e) => setOnboardTotalBeds(Number(e.target.value))}
                            className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-slate-600">Total ICU Units</label>
                          <input
                            type="number"
                            value={onboardIcuBeds}
                            onChange={(e) => setOnboardIcuBeds(Number(e.target.value))}
                            className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-slate-600">Contact Hotline</label>
                          <input
                            type="text"
                            value={onboardPhone}
                            onChange={(e) => setOnboardPhone(e.target.value)}
                            placeholder="+91 (11) ...."
                            className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium placeholder:text-slate-300"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-slate-600">Emergency e-mail</label>
                          <input
                            type="email"
                            value={onboardEmail}
                            onChange={(e) => setOnboardEmail(e.target.value)}
                            placeholder="emergency@hosp.co.in"
                            className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium placeholder:text-slate-300"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-600">Clinical Specialties (comma-separated)</label>
                        <input
                          type="text"
                          value={onboardSpecialties}
                          onChange={(e) => setOnboardSpecialties(e.target.value)}
                          placeholder="Cardiology, Oncology, Pediatrics, Critical Care"
                          className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium"
                        />
                      </div>

                      {/* Intelligent Categorization */}
                      <div className="space-y-2">
                        <label className="text-slate-600 block">Delhi NCR Intelligent Categories</label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          {[
                            "Private hospitals",
                            "Government hospitals",
                            "Cardiac hospitals",
                            "Cancer hospitals",
                            "Trauma centers",
                            "Pediatric hospitals",
                            "Multi-speciality hospitals",
                            "Emergency hospitals",
                          ].map((catName) => {
                            const isCh = onboardCategories.includes(catName);
                            return (
                              <label key={catName} className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={isCh}
                                  onChange={() => {
                                    if (isCh) {
                                      setOnboardCategories(onboardCategories.filter((c) => c !== catName));
                                    } else {
                                      setOnboardCategories([...onboardCategories, catName]);
                                    }
                                  }}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                                />
                                <span>{catName}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Capabilities flags */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2.5 text-[10px] font-bold text-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Ambulance className="h-3.5 w-3.5 text-blue-600" /> Active Ambulance Fleet
                          </span>
                          <div className="flex items-center gap-2.5 font-bold">
                            <input
                              type="checkbox"
                              checked={onboardHasAmbulance}
                              onChange={(e) => setOnboardHasAmbulance(e.target.checked)}
                              className="rounded border-slate-300 focus:ring-blue-500 text-blue-600 h-3.5 w-3.5"
                            />
                            {onboardHasAmbulance && (
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={onboardAmbulanceCount}
                                onChange={(e) => setOnboardAmbulanceCount(Number(e.target.value))}
                                className="w-12 border border-slate-200 p-1 rounded text-center font-extrabold text-xs bg-white text-slate-800"
                              />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 text-cyan-600" /> Instant Telemedicine support
                          </span>
                          <input
                            type="checkbox"
                            checked={onboardHasTelemedicine}
                            onChange={(e) => setOnboardHasTelemedicine(e.target.checked)}
                            className="rounded border-slate-300 focus:ring-blue-500 text-blue-600 h-3.5 w-3.5"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Building className="h-3.5 w-3.5 text-indigo-600" /> Instant Digital OPD Booking
                          </span>
                          <input
                            type="checkbox"
                            checked={onboardHasOpdBooking}
                            onChange={(e) => setOnboardHasOpdBooking(e.target.checked)}
                            className="rounded border-slate-300 focus:ring-blue-500 text-blue-600 h-3.5 w-3.5"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 text-amber-600" /> Government Municipal Entity
                          </span>
                          <input
                            type="checkbox"
                            checked={onboardIsGovernment}
                            onChange={(e) => setOnboardIsGovernment(e.target.checked)}
                            className="rounded border-slate-300 focus:ring-blue-500 text-blue-600 h-3.5 w-3.5"
                          />
                        </div>
                      </div>

                      <button type="submit" className="w-full text-center py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black shadow-md uppercase transition-all whitespace-nowrap active:scale-95 cursor-pointer">
                        Register Verified Onboard Partner
                      </button>
                    </form>
                  </div>

                  {/* RIGHT COLUMN: INTERACTIVE CONTROL PANEL & REAL-TIME ASSET MANAGEMENTS */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                      <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                            <Settings className="h-4 w-4 text-indigo-600" /> Clinic Management & Control Deck
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-1 font-semibold">Select and manage variables, clinicians, and allocations live.</p>
                        </div>
                        
                        <div className="min-w-[200px]">
                          <select
                            value={adminHospSelect}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              setAdminHospSelect(selectedId);
                              const hObj = hospitals.find((item) => item.id === selectedId);
                              if (hObj) {
                                setAdminAvailBeds(hObj.availableBeds);
                                setAdminIcuAvail(hObj.icuAvailable);
                                setAdminOccupancy(hObj.emergencyOccupancy);
                              }
                            }}
                            className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-850"
                            required
                          >
                            <option value="">-- Choose verified partner --</option>
                            {hospitals.map((h) => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {adminHospSelect ? (
                        (() => {
                          const selectedHospDetails = hospitals.find((h) => h.id === adminHospSelect);
                          if (!selectedHospDetails) return null;
                          return (
                            <div className="space-y-6">
                              {/* Hospital Brief Data Card */}
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <h4 className="text-xs font-extrabold text-slate-950 flex items-center gap-1">
                                    <Building className="h-3.5 w-3.5 text-blue-600 animate-pulse" /> {selectedHospDetails.name}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{selectedHospDetails.address}</p>
                                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold ${selectedHospDetails.isGovernment ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                                      {selectedHospDetails.isGovernment ? "Government" : "Private Verified"}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[8px] font-extrabold">
                                      ⭐ {selectedHospDetails.rating ? selectedHospDetails.rating.toFixed(1) : "5.0"}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-1.5 text-[10px] font-bold text-slate-600 flex flex-col justify-center">
                                  <div className="flex justify-between">
                                    <span>Hotline Emergency:</span>
                                    <span className="text-slate-800 font-extrabold">{selectedHospDetails.phone}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>E-mail Contact:</span>
                                    <span className="text-slate-800 font-extrabold truncate max-w-[150px]">{selectedHospDetails.email}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Assigned clinicians:</span>
                                    <span className="text-blue-600 font-black">{doctors.filter(d => d.hospitalName === selectedHospDetails.name).length} doctors</span>
                                  </div>
                                </div>
                              </div>

                              {/* Interactive Assets Management Panels */}
                              <div className="grid gap-6 sm:grid-cols-2 items-start">
                                {/* SUB SECTION 1: LIVE VACANCIES ADJUSTMENT */}
                                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50 text-xs font-semibold">
                                  <div className="border-b border-slate-200/60 pb-1.5 flex justify-between items-center">
                                    <h4 className="text-[10px] font-black text-indigo-900 uppercase">Live Capacity Allocator</h4>
                                    <span className="text-[8px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded animate-pulse">Live HUD</span>
                                  </div>

                                  <form onSubmit={handleUpdateClinicalBeds} className="space-y-3.5">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 block">General Beds Available</label>
                                        <input
                                          type="number"
                                          max={selectedHospDetails.totalBeds}
                                          value={adminAvailBeds}
                                          onChange={(e) => setAdminAvailBeds(Number(e.target.value))}
                                          className="w-full border border-slate-200 p-2 rounded-lg bg-white text-xs text-slate-850 font-black text-center"
                                        />
                                        <span className="text-[8px] text-slate-400 block text-center mt-0.5">of {selectedHospDetails.totalBeds} total</span>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 block">ICU Beds Available</label>
                                        <input
                                          type="number"
                                          max={selectedHospDetails.icuBeds}
                                          value={adminIcuAvail}
                                          onChange={(e) => setAdminIcuAvail(Number(e.target.value))}
                                          className="w-full border border-slate-200 p-2 rounded-lg bg-white text-xs text-slate-850 font-black text-center"
                                        />
                                        <span className="text-[8px] text-slate-400 block text-center mt-0.5">of {selectedHospDetails.icuBeds} total</span>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[10px]">
                                        <label className="text-slate-500 font-bold">Emergency occupancy index (%)</label>
                                        <span className="font-extrabold text-indigo-650">{adminOccupancy}%</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={adminOccupancy}
                                        onChange={(e) => setAdminOccupancy(Number(e.target.value))}
                                        className="w-full text-indigo-600 cursor-pointer accent-indigo-600 h-1.5 bg-slate-200 rounded"
                                      />
                                    </div>

                                    <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] uppercase rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer">
                                      Update Census live
                                    </button>
                                  </form>
                                </div>

                                {/* SUB SECTION 2: ADD CLINICAL STAFF / DOCTORS */}
                                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50 text-xs font-semibold">
                                  <div className="border-b border-slate-200/60 pb-1.5">
                                    <h4 className="text-[10px] font-black text-indigo-900 uppercase">Onboard clinical staff</h4>
                                  </div>

                                  <form onSubmit={handleAddClinicalDoctor} className="space-y-3">
                                    <div className="space-y-1">
                                      <label className="text-[10px] text-slate-500">Clinician Name</label>
                                      <input
                                        type="text"
                                        value={addDocName}
                                        onChange={(e) => setAddDocName(e.target.value)}
                                        placeholder="Dr. Rajesh Malhotra"
                                        className="w-full border border-slate-200 p-2 rounded-lg bg-white text-xs text-slate-850"
                                        required
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500">Specialist Type</label>
                                        <select
                                          value={addDocSpecialty}
                                          onChange={(e) => setAddDocSpecialty(e.target.value)}
                                          className="w-full border border-slate-200 p-2 rounded-lg bg-white text-[10px] font-bold text-slate-700"
                                        >
                                          <option value="Cardiologist">Cardiologist (Heart)</option>
                                          <option value="Pulmonologist">Pulmonologist (Lungs)</option>
                                          <option value="Gastroenterologist">Gastroenterologist (Stomach)</option>
                                          <option value="Neurologist">Neurologist (Brain)</option>
                                          <option value="Pediatrician">Pediatrician (Kids)</option>
                                          <option value="Oncologist">Oncologist (Cancer)</option>
                                          <option value="Emergency Care Physician">Trauma Specialist</option>
                                          <option value="General Physician">General Physician</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500">Exp (years)</label>
                                        <input
                                          type="number"
                                          min="1"
                                          value={addDocExperience}
                                          onChange={(e) => setAddDocExperience(Number(e.target.value))}
                                          className="w-full border border-slate-200 p-2 rounded-lg bg-white text-xs font-bold text-slate-700 text-center"
                                        />
                                      </div>
                                    </div>

                                    <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px] uppercase rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer">
                                      Register clinician staff
                                    </button>
                                  </form>
                                </div>
                              </div>

                              {/* Telemetry settings live modifiers */}
                              <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/60 text-xs font-semibold space-y-3">
                                <h4 className="text-[10px] font-black text-indigo-950 uppercase tracking-widest pl-0.5 border-b border-indigo-100/50 pb-1.5 flex items-center justify-between">
                                  <span>Digital consultation / Fleet Settings</span>
                                  <span className="text-[8px] text-indigo-500">Live Switchers</span>
                                </h4>
                                
                                <div className="grid sm:grid-cols-3 gap-3">
                                  <div className="bg-white border border-slate-200/50 p-3 rounded-xl flex flex-col justify-between items-center gap-2 shadow-2xs">
                                    <span className="text-[8px] text-slate-400 font-extrabold uppercase">Telemedicine Status</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-black ${selectedHospDetails.hasTelemedicine ? "text-emerald-600" : "text-slate-400"}`}>
                                        {selectedHospDetails.hasTelemedicine ? "ENABLED" : "DISABLED"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateHospitalCapabilities({ hasTelemedicine: !selectedHospDetails.hasTelemedicine })}
                                        className="px-2 py-1 bg-slate-100 border text-slate-750 text-[8px] font-black uppercase rounded hover:bg-indigo-50 hover:text-indigo-700 transition"
                                      >
                                        Toggle
                                      </button>
                                    </div>
                                  </div>

                                  <div className="bg-white border border-slate-200/50 p-3 rounded-xl flex flex-col justify-between items-center gap-2 shadow-2xs">
                                    <span className="text-[8px] text-slate-400 font-extrabold uppercase">OPD Digital Booking</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-black ${selectedHospDetails.hasOpdBooking ? "text-emerald-600" : "text-slate-400"}`}>
                                        {selectedHospDetails.hasOpdBooking ? "ENABLED" : "DISABLED"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateHospitalCapabilities({ hasOpdBooking: !selectedHospDetails.hasOpdBooking })}
                                        className="px-2 py-1 bg-slate-100 border text-slate-750 text-[8px] font-black uppercase rounded hover:bg-indigo-50 hover:text-indigo-700 transition"
                                      >
                                        Toggle
                                      </button>
                                    </div>
                                  </div>

                                  <div className="bg-white border border-slate-200/50 p-3 rounded-xl flex flex-col justify-between items-center gap-2 shadow-2xs">
                                    <span className="text-[8px] text-slate-400 font-extrabold uppercase">Ambulance Fleet</span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateHospitalCapabilities({ 
                                          hasAmbulanceSupport: true, 
                                          ambulanceSupportCount: Math.max(0, (selectedHospDetails.ambulanceSupportCount || 0) - 1) 
                                        })}
                                        className="p-1 px-2 bg-slate-150 text-slate-800 rounded font-black text-xs hover:bg-slate-200 h-6 w-6 flex items-center justify-center cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <span className="font-extrabold text-xs text-indigo-700 px-1">
                                        {selectedHospDetails.hasAmbulanceSupport ? selectedHospDetails.ambulanceSupportCount : 0} Cars
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateHospitalCapabilities({ 
                                          hasAmbulanceSupport: true, 
                                          ambulanceSupportCount: (selectedHospDetails.ambulanceSupportCount || 0) + 1 
                                        })}
                                        className="p-1 px-2 bg-slate-150 text-slate-800 rounded font-black text-xs hover:bg-slate-200 h-6 w-6 flex items-center justify-center cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* SUB SECTION 3: APPOINTMENT FLOW FOR SELECTED UNIT */}
                              <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50 space-y-3.5">
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest pl-0.5 border-b border-slate-200/60 pb-1.5 flex items-center justify-between">
                                  <span>Assigned Clinician Appointment Queues</span>
                                  <span className="text-[8px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-extrabold uppercase">Core bookings</span>
                                </h4>

                                {(() => {
                                  // match appointments whose doctors belong to this hospital
                                  const linkedDocs = doctors.filter((d) => d.hospitalName === selectedHospDetails.name);
                                  const linkedAppts = appointments.filter((app) => 
                                    linkedDocs.some((d) => d.id === app.doctorId) || 
                                    (app.doctorName && linkedDocs.some((d) => d.name === app.doctorName))
                                  );

                                  if (linkedAppts.length === 0) {
                                    return <p className="text-[10px] text-slate-400 pl-0.5 font-bold">No active bookings registered for this clinical unit currently.</p>;
                                  }

                                  return (
                                    <div className="space-y-2.5 max-h-[185px] overflow-y-auto pr-1">
                                      {linkedAppts.map((appt) => (
                                        <div key={appt.id} className={`p-3 border rounded-xl space-y-2 text-xs transition-all ${isAppDarkMode ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200/50 hover:border-slate-300"}`}>
                                          <div className={`flex items-center justify-between gap-2 border-b pb-1.5 ${isAppDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                                            <div>
                                              <span className={`font-extrabold ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>{appt.patientName}</span>
                                              <span className="text-[9px] font-semibold text-slate-400 block mt-0.5">ID: {appt.id} | Department: {appt.specialty}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 text-[8.5px] font-black uppercase rounded ${
                                              appt.status === "ACCEPTED" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" :
                                              appt.status === "COMPLETED" ? "bg-slate-100 text-slate-600" :
                                              appt.status === "CANCELLED" ? "bg-rose-50 text-rose-850" :
                                              "bg-amber-50 text-amber-850 border border-amber-100 animate-pulse"
                                            }`}>
                                              {appt.status}
                                            </span>
                                          </div>
                                          
                                          <div className="flex sm:items-center justify-between gap-3 text-[10px]">
                                            <span className="text-slate-500 font-bold">Attending: <b className="text-slate-800">{appt.doctorName}</b></span>
                                            <span className="font-mono text-slate-400 font-bold">{appt.date} | {appt.time}</span>
                                          </div>

                                          {appt.symptoms && (
                                            <p className="p-1 px-2 bg-slate-50 rounded-lg text-[9px] text-slate-500 border border-slate-100 italic">
                                              Symptoms: {appt.symptoms}
                                            </p>
                                          )}

                                          {appt.status === "PENDING" && (
                                            <div className="flex gap-2.5 pt-1">
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  try {
                                                    await api.updateAppointmentStatus(appt.id, "ACCEPTED");
                                                    const updatedAppts = await api.getAppointments();
                                                    setAppointments(updatedAppts);
                                                    showToast(`Booking ${appt.id} accepted successfully!`);
                                                  } catch (err: any) {
                                                    showToast(err.message);
                                                  }
                                                }}
                                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg active:scale-95 cursor-pointer text-center"
                                              >
                                                Confirm Booking
                                              </button>
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  try {
                                                    await api.updateAppointmentStatus(appt.id, "CANCELLED");
                                                    const updatedAppts = await api.getAppointments();
                                                    setAppointments(updatedAppts);
                                                    showToast(`Booking ${appt.id} cancelled.`);
                                                  } catch (err: any) {
                                                    showToast(err.message);
                                                  }
                                                }}
                                                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black uppercase rounded-lg active:scale-95 cursor-pointer text-center"
                                              >
                                                Decline
                                              </button>
                                            </div>
                                          )}
                                          
                                          {appt.status === "ACCEPTED" && (
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                try {
                                                  await api.updateAppointmentStatus(appt.id, "COMPLETED");
                                                  const updatedAppts = await api.getAppointments();
                                                  setAppointments(updatedAppts);
                                                  showToast(`Booking ${appt.id} completed successfully!`);
                                                } catch (err: any) {
                                                  showToast(err.message);
                                                }
                                              }}
                                              className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[9px] font-black uppercase rounded-lg active:scale-95 cursor-pointer text-center"
                                            >
                                              De-classify (Mark Completed)
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="p-12 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-3xl">
                          <Building className="h-10 w-10 text-slate-300 mx-auto" strokeWidth={1} />
                          <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest pt-1">Select healthcare unit above</h4>
                          <p className="text-[10px] text-slate-400 max-w-sm mx-auto leading-normal">
                            Choose any representing hospital to manage their doctors, update live emergency bed vacancies, confirm/cancel dynamic appointments, or change telemedicine toggle status.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* INTERACTIVE EMERGENCY ALERTS PANEL */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest pl-1 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-rose-600" /> Delhi NCR Live Distress Dispatches (Municipal Panel)
                      </h3>

                      {alerts.length === 0 ? (
                        <p className="text-xs text-slate-400 pl-1 font-semibold">No active live SOS sirens reported on physical registers currently.</p>
                      ) : (
                        <div className="space-y-3.5 max-h-[300px] overflow-y-auto text-xs font-semibold pr-1">
                          {alerts.map((al) => (
                            <div key={al.id} className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-2.5">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="space-y-0.5">
                                  <span className="font-mono text-[9px] uppercase font-bold text-slate-400">Emergency Dispatch ID: {al.id}</span>
                                  <h4 className="text-slate-900 font-extrabold text-xs leading-snug">{al.patientName} &bull; <b className="text-rose-600">{al.type}</b></h4>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  al.status === "RESOLVED" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-800 animate-pulse"
                                }`}>
                                  {al.status}
                                </span>
                              </div>

                              <div className="text-[10px] text-slate-500 font-bold space-y-1">
                                <p>📍 Address Location: <span className={`font-black ${isAppDarkMode ? "text-slate-200" : "text-slate-800"}`}>{al.address || "Live Coordinate GPS Pin"}</span></p>
                                <p>🚑 Assigned Partner Clinic: <span className="text-blue-600 font-black">{al.hospitalName}</span></p>
                              </div>

                              <div className="flex gap-2 justify-end pt-1">
                                {al.status !== "DISPATCHED" && al.status !== "RESOLVED" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.updateAlertStatus(al.id, "DISPATCHED");
                                        const upd = await api.getEmergencyAlerts();
                                        setAlerts(upd);
                                        showToast("Ambulance dispatched live inside Delhi NCR!");
                                      } catch (err: any) { showToast(err.message); }
                                    }}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black rounded-lg uppercase cursor-pointer"
                                  >
                                    Dispatch Vehicle
                                  </button>
                                )}
                                {al.status !== "RESOLVED" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.updateAlertStatus(al.id, "RESOLVED");
                                        const upd = await api.getEmergencyAlerts();
                                        setAlerts(upd);
                                        showToast("Siren resolved successfully.");
                                      } catch (err: any) { showToast(err.message); }
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black rounded-lg uppercase cursor-pointer"
                                  >
                                    Mark Resolved
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* LIVE wait lines coordinator panel */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest pl-1 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-emerald-600" /> Active OPD digital waitlines (Live queue)
                      </h3>

                      {queueTokens.length === 0 ? (
                        <p className="text-xs text-slate-400 pl-1 font-semibold">No active wait queues allocated on physical registers.</p>
                      ) : (
                        <div className="space-y-2.5 text-xs font-semibold max-h-[300px] overflow-y-auto pr-1">
                          {queueTokens.map((tok) => (
                            <div key={tok.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/50 flex items-center justify-between text-xs font-semibold gap-3">
                              <div className="min-w-0">
                                <span className="font-mono text-xs font-black text-slate-900 mr-2 bg-slate-200 px-1.5 py-0.5 rounded">{tok.tokenNumber}</span>
                                <span className="text-slate-800 font-bold">{tok.patientName}</span>
                                <p className="text-[10px] text-slate-400 mt-1 font-semibold">Assigned Clinic Clinician: {tok.doctorName} ({tok.checkpointTime})</p>
                              </div>

                              <div className="flex gap-1.5 shrink-0 animate-fade-in">
                                {tok.status === "WAITING" && (
                                  <button
                                    onClick={() => handleUpdateTokenStatus(tok.id, "IN_CONSULTATION")}
                                    className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    Call in
                                  </button>
                                )}
                                {tok.status === "IN_CONSULTATION" && (
                                  <button
                                    onClick={() => handleUpdateTokenStatus(tok.id, "COMPLETED")}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                )}
                                {tok.status !== "COMPLETED" && tok.status !== "SKIPPED" && (
                                  <button
                                    onClick={() => handleUpdateTokenStatus(tok.id, "SKIPPED")}
                                    className="px-2.5 py-1.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    Skip
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : recordsSubTab === "abha" ? (
                  /* 1. ABHA Digital Health Card Generator Sub-tab */
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in text-slate-800">
                    <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-sm font-black text-slate-950 uppercase tracking-widest flex items-center gap-2">🆔 NDHM / Ayushman Bharat Digital Health ID</h3>
                        <p className="text-xs text-slate-500 mt-1">Acquire and compile your official 14-digit national ABHA address linked with Aadhaar security protocols.</p>
                      </div>
                      <span className="bg-blue-50 text-blue-700 px-3 py-1 text-[10px] font-bold rounded-lg shrink-0">
                        🔒 UIDAI Secure Gateway
                      </span>
                    </div>

                    {abhaStep === "AADHAAR" && (
                      <form onSubmit={handleTriggerABHAOTP} className="space-y-4 max-w-md mx-auto py-6 animate-fade-in">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Aadhaar Identity Card Key (12 Digits)</label>
                          <input
                            type="text"
                            maxLength={14}
                            placeholder="e.g. 5421 9832 1084"
                            value={abhaAadhar}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              const matches = val.match(/\d{1,4}/g);
                              setAbhaAadhar(matches ? matches.join(" ") : val);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-sm font-extrabold tracking-widest select-all focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-start gap-2.5 text-[11px] text-slate-500 font-semibold leading-relaxed">
                          <span className="text-sm">🛡️</span>
                          <p>
                            Consent authorization: I allow City Healer to coordinate with UIDAI National Portal rules to trigger verification OTP codes on my registered phone.
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={abhaLoading}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-3.5 rounded-xl shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                        >
                          {abhaLoading ? "Contacting Registry gateway..." : "Generate Verification SMS OTP"}
                        </button>
                      </form>
                    )}

                    {abhaStep === "OTP" && (
                      <form onSubmit={handleVerifyABHAOTP} className="space-y-4 max-w-md mx-auto py-6 animate-fade-in">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">India Gateway SMS verification Code</label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit passcode e.g. 123456"
                            value={abhaOtp}
                            onChange={(e) => setAbhaOtp(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-sm font-extrabold tracking-widest focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <p className="text-center text-[11px] font-semibold text-slate-400">
                          Bypass Test Code: <strong className="text-blue-600">123456</strong>
                        </p>

                        <button
                          type="submit"
                          disabled={abhaLoading}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-3.5 rounded-xl shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                        >
                          {abhaLoading ? "Authorizing Token credentials..." : "Verify OTP & Secure Card"}
                        </button>
                      </form>
                    )}

                    {abhaStep === "CARD" && abhaCardData && (
                      <div className="max-w-md mx-auto space-y-6 py-4 animate-fade-in">
                        {/* THE OFFICIAL INDIAN ABHA CARD LAYOUT */}
                        <div className="bg-gradient-to-r from-orange-50 via-white to-emerald-50 border-2 border-slate-300 rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between h-[270px]">
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-white to-emerald-500"></div>

                          {/* Card header National Identity */}
                          <div className="flex justify-between items-start pb-2 border-b border-slate-200">
                            <div>
                              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">NDHM Govt Registry Of India</span>
                              <span className="text-[10px] font-extrabold text-slate-800 block">Ministry of Health & Family Welfare</span>
                            </div>
                            <span className="text-[9px] bg-slate-900 text-white px-2 py-0.5 rounded font-black uppercase tracking-wider">Aayushman Bharat</span>
                          </div>

                          {/* Card Body Core */}
                          <div className="flex gap-4 items-center flex-1 py-3 text-xs">
                            <div className="w-20 h-20 bg-slate-200 rounded-2xl flex flex-col items-center justify-center border border-slate-300 shrink-0 font-bold uppercase text-slate-500 relative overflow-hidden">
                              <span className="text-2xl font-black">{abhaCardData.fullName.slice(0, 2)}</span>
                              <div className="absolute bottom-0 left-0 right-0 py-0.5 bg-slate-900 text-white text-[6px] font-black text-center tracking-widest uppercase">Verified</div>
                            </div>

                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div>
                                <span className="text-[7px] text-slate-400 font-extrabold uppercase">Full Name</span>
                                <h4 className="font-extrabold text-slate-950 truncate leading-none mt-0.5">{abhaCardData.fullName}</h4>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[7px] text-slate-400 font-extrabold uppercase">Birth Year</span>
                                  <p className="font-bold text-slate-800 leading-none mt-0.5">{abhaCardData.birthYear}</p>
                                </div>
                                <div>
                                  <span className="text-[7px] text-slate-400 font-extrabold uppercase">Gender</span>
                                  <p className="font-bold text-slate-800 leading-none mt-0.5">{abhaCardData.gender}</p>
                                </div>
                              </div>
                              <div>
                                <span className="text-[7px] text-slate-400 font-extrabold uppercase">ABHA Address Token</span>
                                <p className="font-extrabold text-indigo-700 leading-none mt-0.5">{abhaCardData.abhaAddress}</p>
                              </div>
                            </div>

                            <div className="w-16 h-16 bg-white border border-slate-300 rounded p-1 flex items-center justify-center shrink-0">
                              <div className="w-full h-full bg-slate-950 flex flex-col justify-between p-1.5 relative">
                                <div className="absolute top-1 left-1 w-2.5 h-2.5 border-2 border-white bg-slate-950"></div>
                                <div className="absolute top-1 right-1 w-2.5 h-2.5 border-2 border-white bg-slate-950"></div>
                                <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-2 border-white bg-slate-950"></div>
                                <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-2 border-white bg-slate-950"></div>
                                <div className="w-6 h-6 m-auto bg-white rounded-sm"></div>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer */}
                          <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[9px] font-bold text-slate-500">
                            <div>
                              <span className="text-[7px] text-slate-400 font-extrabold uppercase block leading-none">ABHA NUMBER</span>
                              <span className="text-slate-900 font-black tracking-wider block mt-0.5">{abhaCardData.abhaNumber}</span>
                            </div>
                            <span>Issued: {abhaCardData.createdDate}</span>
                          </div>
                        </div>

                        <div className="flex gap-2.5 justify-center">
                          <button
                            onClick={() => showToast("💾 Secure PDF healthcare profile dispatch complete!")}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all active:scale-95"
                          >
                            Export PDF Card
                          </button>
                          <button
                            onClick={handleResetABHAGenerator}
                            className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
                          >
                            Register New Account
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : recordsSubTab === "analyzer" ? (
                  /* 2. AI Lab Report Analyzer Sub-tab */
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in text-slate-850 bg-white">
                    <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-sm font-black text-slate-950 uppercase tracking-widest flex items-center gap-2">🧪 AI Clinical Report interpreter & OCR scan</h3>
                        <p className="text-xs text-slate-500 mt-1">Feed simulated clinical lab assays to extract diagnostics indicators using Gemini 3.5-flash pathology parser.</p>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1 text-[10px] font-bold rounded-lg shrink-0 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> High Precision AI
                      </span>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 text-xs text-slate-800 animate-fade-in">
                      <div className="md:col-span-1 space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Select Laboratory Scanned report</label>
                          <select
                            value={selectedReportTemplate}
                            onChange={(e) => setSelectedReportTemplate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 mr-2"
                          >
                            <option value="blood_cbc">Complete Blood Count (CBC) Scan</option>
                            <option value="lipid_profile">Lipid Profile Cardiovascular Panel</option>
                            <option value="thyroid_panel">Comprehensive Thyroid Assay (TSH)</option>
                          </select>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2 leading-relaxed">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Template Biomarkers profile</span>
                          {selectedReportTemplate === "blood_cbc" && (
                            <p className="font-semibold text-slate-600">Contains scanned fields: Hemoglobin (11.2 dL), WBC (11,800), RBC (4.1M), Platelets (1.8L).</p>
                          )}
                          {selectedReportTemplate === "lipid_profile" && (
                            <p className="font-semibold text-slate-600">Contains scanned fields: Total Cholesterol (248), LDL (168), HDL (35), Triglycerides (220).</p>
                          )}
                          {selectedReportTemplate === "thyroid_panel" && (
                            <p className="font-semibold text-slate-600">Contains scanned fields: Serum TSH Assay (6.9 uIU/mL), FT3 (2.4 pg), FT4 (0.85 ng).</p>
                          )}
                        </div>

                        <button
                          onClick={handleAnalyzeLabReport}
                          disabled={isReportAnalyzing}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-3.5 rounded-xl shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isReportAnalyzing ? "Extracting Character lines..." : "Launch AI Report Analyzer"}
                        </button>
                      </div>

                      <div className="md:col-span-2 space-y-4">
                        {isReportAnalyzing && (
                          <div className="p-5 bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px] rounded-2xl min-h-[160px] flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <p className="text-cyan-400 font-bold uppercase tracking-wider text-[10px]">📟 OCR Scanner logs active</p>
                              {ocrLogs.map((log, index) => (
                                <p key={index} className="animate-fade-in">✓ {log}</p>
                              ))}
                            </div>
                            <span className="text-right text-[10px] text-slate-500 animate-pulse mt-4 block">PROCESSING SCHEMATICS...</span>
                          </div>
                        )}

                        {reportAnalysisResult && (
                          <div className="space-y-4 animate-fade-in text-xs">
                            <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
                              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                                <div>
                                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-black">AI CLINICAL RESULTS</span>
                                  <h4 className="font-black text-sm text-white">{reportAnalysisResult.reportType}</h4>
                                </div>
                                <span className={`px-2.5 py-1 text-[9px] font-bold rounded uppercase ${
                                  reportAnalysisResult.urgencyRating === "LOW" ? "bg-emerald-500/10 text-emerald-350" : "bg-amber-500/15 text-amber-300"
                                }`}>
                                  Urgency: {reportAnalysisResult.urgencyRating}
                                </span>
                              </div>

                              <div className="space-y-2 mt-2">
                                <span className="text-[9px] uppercase font-black text-slate-405 tracking-wider">Scanned Biomarkers Assay</span>
                                <div className="grid gap-2 sm:grid-cols-2 text-slate-300">
                                  {reportAnalysisResult.biomarkers?.map((mark: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-slate-850 rounded-xl border border-slate-850 flex justify-between items-center gap-2">
                                      <div>
                                        <p className="font-extrabold text-white">{mark.name}</p>
                                        <p className="text-[9px] text-slate-500">Ref: {mark.referenceRange}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-black text-white">{mark.value}</p>
                                        <span className={`text-[8px] font-black uppercase tracking-wider ${
                                          mark.status === "NORMAL" ? "text-emerald-400" : "text-rose-400"
                                        }`}>{mark.status}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1 text-slate-300 leading-normal border-t border-slate-800/80 pt-3">
                                <span className="text-[9px] text-cyan-400 font-black uppercase block tracking-wider">AI DIAGNOSTICS DECODER</span>
                                <p className="font-medium">{reportAnalysisResult.aiInterpretation}</p>
                              </div>

                              <div className="bg-rose-950/20 text-rose-300 p-3 rounded-xl border-l-[3px] border-rose-500 font-medium">
                                ⚠️ <strong>Doctor Alerts:</strong> {reportAnalysisResult.doctorAlerts}
                              </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-2xl space-y-2 text-slate-700">
                              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-black">Post-analysis Recommended clinical actions</span>
                              <div className="space-y-1.5">
                                {reportAnalysisResult.actions?.map((act: string, idx: number) => (
                                  <p key={idx} className="flex gap-2.5 items-start font-medium text-xs">
                                    <span className="text-blue-600 mt-0.5">•</span>
                                    <span>{act}</span>
                                  </p>
                                ))}
                              </div>
                              <div className="pt-3 border-t border-slate-100 mt-3 flex flex-wrap justify-between items-center gap-3">
                                <span className="text-[10px] text-slate-400 font-bold">Recommended Consultant: <strong className="text-slate-900 font-extrabold">{reportAnalysisResult.recommendedSpecialist}</strong></span>
                                <button
                                  onClick={() => {
                                    setActiveTab("doctors");
                                    showToast(`Seeking available clinicians matching: ${reportAnalysisResult.recommendedSpecialist}`);
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[9px] uppercase rounded-lg active:scale-95 transition-all text-center cursor-pointer"
                                >
                                  Register Doctor Consultation
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {!isReportAnalyzing && !reportAnalysisResult && (
                          <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl min-h-[300px] flex flex-col justify-center items-center space-y-2">
                            <span className="text-3xl text-slate-300">📄</span>
                            <h4 className="font-extrabold text-slate-850">Awaiting scanner dispatch...</h4>
                            <p className="text-slate-400 max-w-sm pl-2">Configure laboratory files template in the left panel then execute clinical scans parsing.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 3. National vaccination immunization tracker and schedule */
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in text-slate-800">
                    <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-sm font-black text-slate-950 uppercase tracking-widest flex items-center gap-2">👶 National childhood immunization schedule</h3>
                        <p className="text-xs text-slate-500 mt-1">Universal Immunization Schedule of India (Mission Indradhanush parameters) tracking child development charts.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-black text-slate-500">Live completeness:</span>
                        <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden relative border border-slate-200">
                          <div
                            className="bg-emerald-500 h-full transition-all"
                            style={{ width: `${(checkedVaccines.length / 10) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-black text-emerald-600">{Math.floor((checkedVaccines.length / 10) * 100)}%</span>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse bg-white bg-white">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 border-b border-slate-200 uppercase tracking-widest text-[8px] font-black">
                            <th className="p-3 w-12 text-center">Done</th>
                            <th className="p-3">Schedule Age</th>
                            <th className="p-3">Vaccine Dose</th>
                            <th className="p-3">Shielding Diseases</th>
                            <th className="p-3 text-right">Core Registry status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                          {[
                            { id: "vac-1", age: "At Birth", name: "BCG Vaccine", targets: "Childhood Tuberculosis lung shields" },
                            { id: "vac-2", age: "At Birth", name: "Hepatitis B (Birth dose)", targets: "Hep-B chronic liver transmission cover" },
                            { id: "vac-3", age: "At Birth", name: "OPV - 0 (Oral Polio Dose)", targets: "Poliomyelitis gastro virus protection" },
                            { id: "vac-4", age: "6 Weeks", name: "OPV - 1 & Pentavalent-1", targets: "Diphtheria, Pertussis, Tetanus, HepB, Hib, Polio" },
                            { id: "vac-5", age: "6 Weeks", name: "Rotavirus Vaccine (RVV-1)", targets: "Diarrheal dehydration in infants" },
                            { id: "vac-6", age: "10 Weeks", name: "OPV - 2 & Pentavalent-2", targets: "Five-way immunological response boosting" },
                            { id: "vac-7", age: "14 Weeks", name: "OPV - 3 & Pentavalent-3", targets: "Primary defense stabilization" },
                            { id: "vac-8", age: "9-12 Months", name: "Measles-Rubella (MR) 1st Dose", targets: "Rubella congenital syndrome and severe rashes" },
                            { id: "vac-9", age: "9-12 Months", name: "JE Vaccine 1st Dose", targets: "Japanese Encephalitis brain infections" },
                            { id: "vac-10", age: "16-24 Months", name: "DPT Booster-1 & MR-2", targets: "Secures long range childhood immune cellular memory" }
                          ].map((vac, index) => {
                            const isDone = checkedVaccines.includes(vac.id);
                            return (
                              <tr key={index} className={`hover:bg-slate-50/50 transition-colors ${isDone ? "bg-slate-50/20" : ""}`}>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isDone}
                                    onChange={() => {
                                      if (isDone) {
                                        setCheckedVaccines(prev => prev.filter(v => v !== vac.id));
                                        showToast(`Removed vaccine mark: ${vac.name}`);
                                      } else {
                                        setCheckedVaccines(prev => [...prev, vac.id]);
                                        showToast(`Vaccine administered: ${vac.name}`);
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-1 cursor-pointer"
                                  />
                                </td>
                                <td className="p-3 text-slate-800 font-extrabold">{vac.age}</td>
                                <td className="p-3 text-slate-900 font-extrabold">{vac.name}</td>
                                <td className="p-3 text-slate-500 font-medium">{vac.targets}</td>
                                <td className="p-3 text-right">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                    isDone ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                  }`}>
                                    {isDone ? "ADMINISTERED" : "AWAITING SCHEDULER"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-650">
                      <p className="font-semibold text-[11px]">
                        Need help matching clinical dates with local hospitals registry? Book a paediatric check session directly from dashboard controls.
                      </p>
                      <button
                        onClick={() => {
                          setActiveTab("doctors");
                          showToast("Acquiring regional vaccination pediatric doctors list...");
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] rounded-xl shrink-0 cursor-pointer active:scale-95 transition-all"
                      >
                        Locate Baby Vaccination Clinic
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB VIEW 7: EMERGENCY SOS PANIC ROOM */}
            {activeTab === "sos" && (
              <div className="max-w-4xl mx-auto space-y-6 pb-12 font-sans">
                <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-3xl p-6 shadow-md flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-1.5 font-sans">
                      <Ambulance className="h-6 w-6 animate-pulse" /> Urgent Metropolitan Emergency Trigger
                    </h2>
                    <p className="text-xs opacity-90 font-medium font-sans">Bypasses clinical checking. Instantly connects trauma vehicles and books critical care beds.</p>
                  </div>
                  <span className="w-3.5 h-3.5 rounded-full bg-white animate-ping"></span>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <form onSubmit={handleSOSSubmit} className="md:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest pb-2 border-b border-slate-100 font-sans">Report Distress Information</h3>
                    <div className="grid gap-4 sm:grid-cols-2 font-sans">
                      <div className="space-y-1.5 text-xs font-semibold">
                        <label className="text-slate-600">Patient Emergency phone line</label>
                        <input
                          type="text"
                          value={emergencyPhone}
                          onChange={(e) => setEmergencyPhone(e.target.value)}
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1.5 text-xs font-semibold">
                        <label className="text-slate-600 font-sans">Associated Danger condition trigger</label>
                        <select
                          value={emergencyType}
                          onChange={(e: any) => setEmergencyType(e.target.value)}
                          className="w-full border border-slate-200 p-2.5 rounded-lg text-xs cursor-pointer focus:outline-none"
                        >
                          <option value="HEART_ATTACK">HEART ATTACK (Sudden pain, cardiovascular)</option>
                          <option value="ACCIDENT">SEVERE ACCIDENT / Homicide / Trauma</option>
                          <option value="SEVERE_BREATHING">SEVERE SHORTNESS OF BREATH / Asthma choke</option>
                          <option value="SEIZURE">EPILEPTIC SEIZURE / Stroke</option>
                          <option value="OTHER">OTHER CRITICAL SITUATION</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs font-semibold font-sans">
                      <label className="text-slate-600">Distress Location Address Coordinates</label>
                      <input
                        type="text"
                        value={emergencyAddress}
                        onChange={(e) => setEmergencyAddress(e.target.value)}
                        placeholder="Detail coordinates (e.g. 5th Cross Hope street, next to Central Cafe)"
                        className="w-full border border-slate-200 p-2.5 rounded-lg text-xs"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 font-sans">
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        *SOS transmission uses localized GPS calculations to assign nearby clinics and dispatch an ambulance instantly.
                      </p>
                      <button
                        type="submit"
                        className="px-6 py-3 bg-red-650 hover:bg-red-600 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer animate-pulse shrink-0 bg-red-600"
                      >
                        TRIGGER SOS DISTRESS PANIC
                      </button>
                    </div>
                  </form>

                  {/* Sidebar tracking dispatch details */}
                  <div className="space-y-6 font-sans">
                    {sosDispatched ? (
                      <div
                        className="bg-slate-900 text-white rounded-3xl p-5 shadow space-y-4"
                      >
                        <div className="border-b border-white/10 pb-2">
                          <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block animate-ping mr-2"></span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-400">AMBULANCE EN ROUTE</span>
                          <h4 className="font-extrabold text-sm mt-1">{sosDispatched.assignedAmbulanceRef ? sosDispatched.assignedAmbulanceRef : "AMB-231"}</h4>
                        </div>

                        <div className="space-y-2 text-xs font-semibold text-slate-300">
                          <p>Hospital Assigned: <strong className="text-white">{sosDispatched.hospitalName}</strong></p>
                          <p>Location coordinate: <span className="text-slate-400 italic block mt-0.5">{sosDispatched.address}</span></p>
                        </div>

                        <div className="font-mono text-[9px] text-slate-400 p-2.5 bg-slate-950 rounded-xl space-y-1">
                          <div className="flex justify-between">
                            <span>Status:</span> <span className="text-cyan-400">DISPATCHED</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Est. ETA:</span> <span className="text-yellow-400">3.5 min</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSosDispatched(null);
                            showToast("SOS Tracking simulator closed.");
                          }}
                          className="w-full text-center py-2 bg-white/10 text-xs font-bold rounded-lg border border-white/5 cursor-pointer"
                        >
                          Close simulator
                        </button>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 font-semibold text-xs text-slate-700 leading-normal">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 font-sans">SOS Protocol status</h4>
                        <p className="text-slate-500">No active sirens dispatches connected currently in your region.</p>
                        <div className="p-3 bg-red-50 text-red-800 rounded-xl text-[11px]">
                          <strong>Note:</strong> Dispatcher monitors physical coordinates directly. Tap red panic button to simulate ambulance router.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* HISTORICAL REGIONAL ALERTS */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 font-sans">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1 font-sans">Regional Distress log lines</h3>
                  {alerts.length === 0 ? (
                    <p className="text-xs text-slate-400 font-semibold font-sans">No telemetry log alerts available.</p>
                  ) : (
                    <div className="space-y-3 font-sans">
                      {alerts.map((al) => (
                        <div key={al.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-semibold">
                          <div>
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-bold uppercase mr-2">{al.type}</span>
                            <span className="text-slate-800 font-bold">{al.patientName}</span>
                            <p className="text-[10px] text-slate-400 mt-1">{al.address}</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase block">{al.status}</span>
                            <span className="text-[9px] text-blue-600 font-mono mt-1 block">Clinic: {al.hospitalName}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB VIEW 8: CLINIC HUB REGISTRY MANAGER - DELHI NCR VERIFIED ONBOARDING & MANAGEMENT HUB */}
            {activeTab === "admin" && (
              <div className="space-y-6 pb-12 font-sans">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-2.5 bg-blue-100 text-blue-800 rounded font-mono text-[9px] font-black uppercase tracking-widest">
                        Government & Private Partner Network Portal
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">Managed Core: {hospitals.length} Units</span>
                    </div>
                    <h2 className={`text-xl font-black mt-1 ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>City Healer Delhi NCR Partner Network Hub</h2>
                    <p className={`text-xs font-medium font-sans ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Onboard new hospitals into the official directory and administer live bed census, clinical staffing departments, and patient bookings.
                    </p>
                  </div>
                  <div className="flex gap-2">
                     <span className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs font-sans">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span> Live Synchronized Mode
                     </span>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-12 items-start">
                  {/* LEFT TAB: THE DYNAMIC ONBOARDING SYSTEM FORM */}
                  <div className={`lg:col-span-5 border rounded-3xl p-6 space-y-5 transition-all ${
                    isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 font-sans ${
                        isAppDarkMode ? "text-white" : "text-slate-900"
                      }`}>
                        <PlusCircle className="h-4 w-4 text-blue-600" /> Onboard New NCR Partner Hospital
                      </h3>
                      <p className={`text-[10px] mt-1 font-semibold font-sans ${
                        isAppDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}>Integrate private or municipal clinical facilities into City Healer channels instantly.</p>
                    </div>

                    <form onSubmit={handleOnboardHospital} className={`space-y-4 text-xs font-semibold ${
                      isAppDarkMode ? "text-slate-300" : "text-slate-750"
                    }`}>
                      <div className="space-y-1.5 font-sans">
                        <label className={`text-[11px] font-bold tracking-tight block ${isAppDarkMode ? "text-slate-300" : "text-slate-800"}`}>Hospital Legal Name</label>
                        <input
                          type="text"
                          value={onboardName}
                          onChange={(e) => setOnboardName(e.target.value)}
                          placeholder="e.g. Max Super Speciality Hospital, Vaishali"
                          className={`w-full border p-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                            isAppDarkMode ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-550" : "bg-white border-slate-205 text-slate-800 placeholder:text-slate-400 focus:bg-slate-50/50"
                          }`}
                          required
                        />
                      </div>

                      <div className="space-y-1.5 font-sans">
                        <label className={`text-[11px] font-bold tracking-tight block ${isAppDarkMode ? "text-slate-300" : "text-slate-800"}`}>Regional Street Address</label>
                        <input
                          type="text"
                          value={onboardAddress}
                          onChange={(e) => setOnboardAddress(e.target.value)}
                          placeholder="e.g. Sector 1, Vaishali, Ghaziabad, NCR"
                          className={`w-full border p-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                            isAppDarkMode ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-550" : "bg-white border-slate-205 text-slate-800 placeholder:text-slate-400 focus:bg-slate-50/50"
                          }`}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3.5 font-sans">
                        <div className="space-y-1.5">
                          <label className={`text-[11px] font-bold tracking-tight block ${isAppDarkMode ? "text-slate-300" : "text-slate-800"}`}>Total Bed Census</label>
                          <input
                            type="number"
                            value={onboardTotalBeds}
                            onChange={(e) => setOnboardTotalBeds(parseInt(e.target.value) || 0)}
                            className={`w-full border p-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                              isAppDarkMode ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-550" : "bg-white border-slate-205 text-slate-800 placeholder:text-slate-400 focus:bg-slate-50/50"
                            }`}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={`text-[11px] font-bold tracking-tight block ${isAppDarkMode ? "text-slate-300" : "text-slate-800"}`}>Critical care (ICU)</label>
                          <input
                            type="number"
                            value={onboardIcuBeds}
                            onChange={(e) => setOnboardIcuBeds(parseInt(e.target.value) || 0)}
                            className={`w-full border p-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                              isAppDarkMode ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-550" : "bg-white border-slate-205 text-slate-800 placeholder:text-slate-400 focus:bg-slate-50/50"
                            }`}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5 font-sans">
                        <div className="space-y-1.5">
                          <label className={`text-[11px] font-bold tracking-tight block ${isAppDarkMode ? "text-slate-300" : "text-slate-700"}`}>Emergency Desk Line</label>
                          <input
                            type="text"
                            value={onboardPhone}
                            onChange={(e) => setOnboardPhone(e.target.value)}
                            placeholder="+91 1100223"
                            className={`w-full border p-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all ${isAppDarkMode ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"}`}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={`text-[11px] font-bold tracking-tight block ${isAppDarkMode ? "text-slate-300" : "text-slate-700"}`}>Primary Support Mail</label>
                          <input
                            type="email"
                            value={onboardEmail}
                            onChange={(e) => setOnboardEmail(e.target.value)}
                            placeholder="admin@maxhospitals.com"
                            className={`w-full border p-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all ${isAppDarkMode ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-550" : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"}`}
                            required
                          />
                        </div>
                      </div>

                      {onboardHasAmbulance && (
                        <div className="space-y-1.5 animate-fade-in font-sans">
                          <label className={`text-[11px] font-bold tracking-tight block ${isAppDarkMode ? "text-slate-300" : "text-slate-800"}`}>Active Ambulances Fleet Census Count</label>
                          <input
                            type="number"
                            value={onboardAmbulanceCount}
                            onChange={(e) => setOnboardAmbulanceCount(parseInt(e.target.value) || 0)}
                            className={`w-full border p-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                              isAppDarkMode ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-550" : "bg-white border-slate-205 text-slate-800 placeholder:text-slate-400 focus:bg-slate-50/50"
                            }`}
                            required
                          />
                        </div>
                      )}

                      <div className="space-y-1.5 font-sans">
                        <label className={`text-[11px] font-bold tracking-tight block ${isAppDarkMode ? "text-slate-300" : "text-slate-800"}`}>Attested Clinical Specialties (comma separated)</label>
                        <input
                          type="text"
                          value={onboardSpecialties}
                          onChange={(e) => setOnboardSpecialties(e.target.value)}
                          placeholder="Cardiology, Paediatrics, ICU Care"
                          className={`w-full border p-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                            isAppDarkMode ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-550" : "bg-white border-slate-205 text-slate-800 placeholder:text-slate-400 focus:bg-slate-50/50"
                          }`}
                          required
                        />
                      </div>

                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold uppercase py-3 rounded-xl transition-all shadow cursor-pointer font-sans text-xs">
                        Onboard Partner Clinic Unit
                      </button>
                    </form>
                  </div>

                  {/* RIGHT COLUMN: DIRECT CENSUS MODIFICATION BOARD */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className={`border rounded-3xl p-6 transition-all ${
                      isAppDarkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-white border-slate-200 shadow-sm text-slate-850"
                    }`}>
                      <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center gap-2 font-sans">
                        <div>
                          <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            isAppDarkMode ? "text-white" : "text-slate-900"
                          }`}>⚙️ Live Beds Availability Census</h3>
                          <p className={`text-[10px] mt-0.5 font-semibold ${
                            isAppDarkMode ? "text-slate-400" : "text-slate-500"
                          }`}>Tweak regional bed tallies matching real distress situations.</p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 text-xs font-semibold font-sans">
                          <label className={`text-[11px] font-bold tracking-tight block ${isAppDarkMode ? "text-slate-300" : "text-slate-800"}`}>Target Hospital Center Node</label>
                          <select
                            value={adminHospSelect}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAdminHospSelect(val);
                              const target = hospitals.find(h => h.id === val);
                              if (target) {
                                setAdminAvailBeds(target.availableBeds);
                                setAdminIcuAvail(target.icuBedsAvailable || 0);
                                setAdminOccupancy(target.occupancyRate || 80);
                              }
                            }}
                            className={`w-full border p-2.5 rounded-xl text-xs cursor-pointer focus:outline-none font-semibold transition-all ${
                              isAppDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-201 text-slate-850"
                            }`}
                          >
                            <option value="">-- Choose verified partner --</option>
                            {hospitals.map((h) => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs font-semibold font-sans">
                          <div className="space-y-1">
                            <label className={`text-[10px] font-bold tracking-tight block text-center ${isAppDarkMode ? "text-slate-300" : "text-slate-700"}`}>Gen Beds</label>
                            <input
                              type="number"
                              disabled={!adminHospSelect}
                              value={adminAvailBeds}
                              onChange={(e) => setAdminAvailBeds(parseInt(e.target.value) || 0)}
                              className={`w-full border p-2 rounded-xl text-xs text-center font-bold font-sans transition-all ${
                                isAppDarkMode ? "bg-slate-900 border-slate-800 text-white disabled:opacity-50" : "bg-white border-slate-201 text-slate-850 disabled:bg-slate-50 disabled:text-slate-400"
                              }`}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className={`text-[10px] font-bold tracking-tight block text-center ${isAppDarkMode ? "text-slate-300" : "text-slate-700"}`}>ICU Beds</label>
                            <input
                              type="number"
                              disabled={!adminHospSelect}
                              value={adminIcuAvail}
                              onChange={(e) => setAdminIcuAvail(parseInt(e.target.value) || 0)}
                              className={`w-full border p-2 rounded-xl text-xs text-center font-bold font-sans transition-all ${
                                isAppDarkMode ? "bg-slate-900 border-slate-800 text-white disabled:opacity-50" : "bg-white border-slate-201 text-slate-850 disabled:bg-slate-50 disabled:text-slate-400"
                              }`}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className={`text-[10px] font-bold tracking-tight block text-center ${isAppDarkMode ? "text-slate-300" : "text-slate-700"}`}>Occupancy %</label>
                            <input
                              type="number"
                              disabled={!adminHospSelect}
                              value={adminOccupancy}
                              onChange={(e) => setAdminOccupancy(parseInt(e.target.value) || 0)}
                              className={`w-full border p-2 rounded-xl text-xs text-center font-bold font-sans transition-all ${
                                isAppDarkMode ? "bg-slate-900 border-slate-800 text-white disabled:opacity-50" : "bg-white border-slate-201 text-slate-850 disabled:bg-slate-50 disabled:text-slate-400"
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (!adminHospSelect) { showToast("No target hospital configured."); return; }
                          try {
                            await api.updateHospitalBeds(adminHospSelect, {
                              availableBeds: adminAvailBeds,
                              icuAvailable: adminIcuAvail,
                              emergencyOccupancy: adminOccupancy
                            });
                            const updated = await api.getHospitals();
                            setHospitals(updated);
                            showToast("Live ICU Bed Census updated inside Indian registry!");
                          } catch (err: any) { showToast(err.message); }
                        }}
                        disabled={!adminHospSelect}
                        className={`w-full text-center py-2.5 text-white font-extrabold text-xs uppercase rounded-xl transition-all cursor-pointer font-sans ${
                          adminHospSelect ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        Adjust live beds census
                      </button>
                    </div>

                    {/* Verified clinician credentials onboarding */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 text-slate-850">
                      <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5 font-sans">👨‍⚕️ Attested Doctor Onboarding</h3>
                      <form onSubmit={handleAddClinicalDoctor} className="space-y-4 text-xs font-semibold text-slate-700">
                        <div className="grid gap-3 sm:grid-cols-3 font-sans">
                          <div className="space-y-1.5">
                            <label className="text-slate-600">Doctor legal Name</label>
                            <input
                              type="text"
                              value={addDocName}
                              onChange={(e) => setAddDocName(e.target.value)}
                              placeholder="Dr. Shreya Roy"
                              className="w-full border border-slate-200 p-2.5 rounded-xl text-xs placeholder:text-slate-300 font-medium"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-slate-600">Attesting Specialization</label>
                            <select
                              value={addDocSpecialty}
                              onChange={(e) => setAddDocSpecialty(e.target.value)}
                              className="w-full border border-slate-200 p-2.5 rounded-xl text-xs cursor-pointer focus:outline-none bg-white font-medium"
                            >
                              <option value="Cardiologist">Cardiologist (Heart & cardiovascular)</option>
                              <option value="Pediatrician">Pediatrician (Child developer immunizer)</option>
                              <option value="Pulmonologist">Pulmonologist (Asthma respiratory)</option>
                              <option value="General Physician">General Family Physician</option>
                              <option value="Oncologist">Oncologist</option>
                              <option value="Neurologist">Neurologist</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-slate-600">Years of Experience</label>
                            <input
                              type="number"
                              value={addDocExperience}
                              onChange={(e) => setAddDocExperience(parseInt(e.target.value) || 0)}
                              className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium bg-white"
                              required
                            />
                          </div>
                        </div>

                        <button type="submit" className="w-full bg-slate-950 hover:bg-slate-850 text-white py-2 rounded-xl transition-all font-extrabold uppercase text-center cursor-pointer text-xs font-sans">
                          attest verified clinician credentials
                        </button>
                      </form>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider border-b border-slate-100 pb-2.5 font-sans">🚨 Live emergency distress alert stream</h3>

                      {alerts.filter(al => al.status !== "RESOLVED").length === 0 ? (
                        <p className="text-xs text-slate-400 pl-1 font-semibold font-sans">No active distress signals active on regional channels.</p>
                      ) : (
                        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 font-sans">
                          {alerts.filter(al => al.status !== "RESOLVED").map((al) => (
                            <div key={al.id} className="p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-red-100 pb-2.5">
                                <div className="space-y-0.5">
                                  <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-extrabold tracking-wider">{al.type}</span>
                                  <h4 className="text-xs font-black text-slate-850 mt-1 uppercase">{al.patientName} distress line</h4>
                                </div>
                                <span className="text-[10px] text-red-600 font-mono tracking-tight animate-pulse font-extrabold">{al.status}</span>
                              </div>

                              <div className="text-[10px] text-slate-500 font-bold space-y-1">
                                <p>📍 Address Location: <span className="text-slate-800 font-black">{al.address || "Live Coordinate GPS Pin"}</span></p>
                                <p>🚑 Assigned Partner Clinic: <span className="text-blue-600 font-black">{al.hospitalName}</span></p>
                              </div>

                              <div className="flex gap-2 justify-end pt-1 font-sans animate-fade-in">
                                {al.status !== "DISPATCHED" && al.status !== "RESOLVED" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.updateAlertStatus(al.id, "DISPATCHED");
                                        const upd = await api.getEmergencyAlerts();
                                        setAlerts(upd);
                                        showToast("Ambulance dispatched live inside Delhi NCR!");
                                      } catch (err: any) { showToast(err.message); }
                                    }}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-extrabold rounded-lg uppercase cursor-pointer"
                                  >
                                    Dispatch Vehicle
                                  </button>
                                )}
                                {al.status !== "RESOLVED" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.updateAlertStatus(al.id, "RESOLVED");
                                        const upd = await api.getEmergencyAlerts();
                                        setAlerts(upd);
                                        showToast("Siren resolved successfully.");
                                      } catch (err: any) { showToast(err.message); }
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-extrabold rounded-lg uppercase cursor-pointer"
                                  >
                                    Mark Resolved
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* LIVE wait lines coordinator panel */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                       <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest pl-1 border-b border-slate-100 pb-2 flex items-center gap-1.5 font-sans">
                         <Clock className="h-4 w-4 text-emerald-600" /> Active OPD digital waitlines (Live queue)
                       </h3>

                       {queueTokens.length === 0 ? (
                         <p className="text-xs text-slate-400 pl-1 font-semibold font-sans">No active wait queues allocated on physical registers.</p>
                       ) : (
                         <div className="space-y-2.5 text-xs font-semibold max-h-[300px] overflow-y-auto pr-1 font-sans">
                           {queueTokens.map((tok) => (
                             <div key={tok.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/50 flex items-center justify-between text-xs font-semibold gap-3">
                               <div className="min-w-0">
                                 <span className="font-mono text-xs font-black text-slate-900 mr-2 bg-slate-200 px-1.5 py-0.5 rounded">{tok.tokenNumber}</span>
                                 <span className="text-slate-800 font-bold">{tok.patientName}</span>
                                 <p className="text-[10px] text-slate-400 mt-1 font-semibold">Assigned Clinic Clinician: {tok.doctorName} ({tok.checkpointTime})</p>
                               </div>

                               <div className="flex gap-1.5 shrink-0 animate-fade-in">
                                 {tok.status === "WAITING" && (
                                   <button
                                     onClick={() => handleUpdateTokenStatus(tok.id, "IN_CONSULTATION")}
                                     className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                                   >
                                     Call in
                                   </button>
                                 )}
                                 {tok.status === "IN_CONSULTATION" && (
                                   <button
                                     onClick={() => handleUpdateTokenStatus(tok.id, "COMPLETED")}
                                     className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                                   >
                                     Complete
                                   </button>
                                 )}
                                 {tok.status !== "COMPLETED" && tok.status !== "SKIPPED" && (
                                   <button
                                     onClick={() => handleUpdateTokenStatus(tok.id, "SKIPPED")}
                                     className="px-2.5 py-1.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg cursor-pointer"
                                   >
                                     Skip
                                   </button>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB VIEW 9: HEALTH INSURANCE EXCHANGES COMPARATOR & INSURETECH AI MODULE */}
            {activeTab === "insurance" && (
              <div className="space-y-6 pb-12 animate-fade-in text-slate-800">
                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl text-[0px]">Decorator backdrop glow segment blur</div>
                  <div className="space-y-2 z-10">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-500/30 text-indigo-300 font-mono text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded">IRDAI Registry Approved</span>
                      <span className="text-[10px] text-slate-300">Region: Delhi NCR Cashless Grid</span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Unified Health Insurance Exchange hub</h2>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      Compare customized cashless health insurance plans side-by-side. Get instant AI policy validation matching your family members' disease profiles.
                    </p>
                  </div>
                  <span className="p-4 bg-white/10 rounded-2xl border border-white/10 text-center shrink-0 z-10 w-full sm:w-auto">
                    <span className="text-[9px] uppercase font-bold text-indigo-300 tracking-wider block">Insured Status</span>
                    <span className="text-lg font-black text-white block">Active Card</span>
                    <span className="text-[10px] text-emerald-400 font-bold block">₹14 Lakh Coverage</span>
                  </span>
                </div>

                {/* Main comparison dashboard & AI adviser splits */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <div>
                        <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">Top-Tier Cashless Health Plans for Delhi NCR</h3>
                        <p className="text-xs text-slate-500">Select policies to trigger the comparative side-by-side specifications check.</p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {[
                          { id: "care", name: "Care Supreme Unlimited", premium: 610, cover: "₹10 Lakh", network: "Apollo, Max, Fortis", icu: "No Limit", rating: "4.7★" },
                          { id: "hdfc", name: "HDFC ERGO Optima Secure", premium: 745, cover: "₹10 Lakh (2x benefit)", network: "All 5 Listed Hospitals", icu: "No Limit", rating: "4.9★" },
                          { id: "aditya", name: "Aditya Birla Activ Health", premium: 530, cover: "₹5 Lakh", network: "Max, Primus, Shardah", icu: "Single Private Room", rating: "4.6★" },
                          { id: "niva", name: "Niva Bupa ReAssure 2.0", premium: 675, cover: "₹10 Lakh (Carryover)", network: "Medanta, Fortis, Max", icu: "No Limit", rating: "4.8★" }
                        ].map((policy) => {
                          const isSelected = selectedPoliciesToCompare.includes(policy.id);
                          return (
                            <div 
                              key={policy.id} 
                              className={`p-5 rounded-2xl border transition-all relative flex flex-col justify-between space-y-3 cursor-pointer ${
                                isSelected ? "border-indigo-500 bg-indigo-50/20 shadow-sm" : "border-slate-200 bg-white hover:border-slate-350"
                              }`}
                              onClick={() => {
                                setSelectedPoliciesToCompare(prev => 
                                  prev.includes(policy.id) ? prev.filter(x => x !== policy.id) : [...prev, policy.id]
                                );
                              }}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-500 font-bold uppercase">{policy.rating} Rating</span>
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    readOnly
                                    className="h-4.5 w-4.5 accent-indigo-600 rounded cursor-pointer"
                                  />
                                </div>
                                <h4 className="text-sm font-extrabold text-slate-900 leading-tight">{policy.name}</h4>
                                <p className="text-[11px] text-slate-500">Cashless Network: <strong>{policy.network}</strong></p>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                                <div>
                                  <span className="text-[9px] block text-slate-400 uppercase font-bold">Sum Insured</span>
                                  <span className="text-sm font-black text-slate-950">{policy.cover}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] block text-slate-400 uppercase font-bold">Premium / mo</span>
                                  <span className="text-sm font-black text-indigo-600">₹{policy.premium}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Compare Matrix Table if selected */}
                    {selectedPoliciesToCompare.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest pl-1">Selected Policy Feature Comparison Matrix</h4>
                          <button 
                            onClick={() => setSelectedPoliciesToCompare([])}
                            className="text-xs text-rose-500 font-bold hover:underline"
                          >
                            Clear selection
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-semibold text-slate-600 border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px] tracking-wider">
                                <th className="py-2.5 pr-4 pl-1">Feature Spec</th>
                                {selectedPoliciesToCompare.map(id => (
                                  <th key={id} className="py-2.5 px-4 font-extrabold text-slate-900">
                                    {id === "care" && "Care Supreme"}
                                    {id === "hdfc" && "HDFC Optima"}
                                    {id === "aditya" && "Aditya Birla Activ"}
                                    {id === "niva" && "Niva ReAssure"}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              <tr className="hover:bg-slate-50">
                                <td className="py-3 pr-4 pl-1 text-slate-900 font-bold">Sum Insured Max</td>
                                {selectedPoliciesToCompare.map(id => (
                                  <td key={id} className="py-3 px-4 text-slate-800">
                                    {id === "care" && "₹10 Lakh"}
                                    {id === "hdfc" && "₹10 Lakh + 2x multiplier"}
                                    {id === "aditya" && "₹5 Lakh (Boost option)"}
                                    {id === "niva" && "₹10 Lakh (Unlimited carry)"}
                                  </td>
                                ))}
                              </tr>
                              <tr className="hover:bg-slate-50">
                                <td className="py-3 pr-4 pl-1 text-slate-900 font-bold">Room Rent Sublimits</td>
                                {selectedPoliciesToCompare.map(id => (
                                  <td key={id} className="py-3 px-4">
                                    {id === "care" && "No room limit"}
                                    {id === "hdfc" && "No room limit"}
                                    {id === "aditya" && "Single Private A/C max"}
                                    {id === "niva" && "No room limit"}
                                  </td>
                                ))}
                              </tr>
                              <tr className="hover:bg-slate-50">
                                <td className="py-3 pr-4 pl-1 text-slate-900 font-bold">Copay % Requirement</td>
                                {selectedPoliciesToCompare.map(id => (
                                  <td key={id} className="py-3 px-4 text-emerald-600 font-bold">
                                    0% Copay (Cashless)
                                  </td>
                                ))}
                              </tr>
                              <tr className="hover:bg-slate-50">
                                <td className="py-3 pr-4 pl-1 text-slate-900 font-bold">Waiting Period for Chronic</td>
                                {selectedPoliciesToCompare.map(id => (
                                  <td key={id} className="py-3 px-4">
                                    {id === "care" && "3 Years"}
                                    {id === "hdfc" && "3 Years (2 Yr opt-out)"}
                                    {id === "aditya" && "3 Years (Fit reward)"}
                                    {id === "niva" && "2 Years (Reduced)"}
                                  </td>
                                ))}
                              </tr>
                              <tr className="hover:bg-slate-50">
                                <td className="py-3 pr-4 pl-1 text-slate-900 font-bold">Delhi Cashless Centers</td>
                                {selectedPoliciesToCompare.map(id => (
                                  <td key={id} className="py-3 px-4 text-slate-900">
                                    {id === "care" && "Noida Max, Delhi Apollo"}
                                    {id === "hdfc" && "All 5 Prime NCR Nodes"}
                                    {id === "aditya" && "Max Noida, Sharda Greater Noida"}
                                    {id === "niva" && "Delhi Apollo, Fortis Gurgaon"}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right side Info-panel: InsureTech AI Adviser & Active Claims History */}
                  <div className="space-y-6">
                    {/* InsureTech Advisor box */}
                    <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">Insuretech AI Underwriting Adviser</h4>
                      <p className="text-[11px] text-slate-300">
                        Select patient demographics below and generate matching cashless advice based on clinical metrics inside Delhi NCR.
                      </p>

                      <div className="space-y-3.5 text-xs text-white">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-slate-400">Target Age Group</label>
                          <select 
                            value={insuranceAgeSelect} 
                            onChange={(e) => setInsuranceAgeSelect(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 text-xs rounded-xl cursor-pointer"
                          >
                            <option value="ADULT">Adult Individual (18 - 45 yr)</option>
                            <option value="FAMILY">Family Float combo (Self + Kids)</option>
                            <option value="SENIOR">Senior Citizens (45 - 80 yr)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-slate-400">Pre-existing Illness Profile</label>
                          <select 
                            value={insuranceDiseaseSelect}
                            onChange={(e) => setInsuranceDiseaseSelect(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 text-xs rounded-xl cursor-pointer"
                          >
                            <option value="NONE">No existing illness (Super Saver)</option>
                            <option value="DIABETES">Diabetes & Hypertension (Low Copay req)</option>
                            <option value="ASTHMA">Asthma / Pulmonary sensitivities (Smog tier)</option>
                            <option value="CARDIAC">Cardiac monitor logs (ICU backup limit)</option>
                          </select>
                        </div>

                        {insuranceAdviseResult ? (
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 animate-fade-in font-semibold text-[11px] leading-relaxed text-slate-300">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                              <span className="text-indigo-400 font-extrabold uppercase text-[9px]">Recommended Plan match</span>
                              <span className="bg-indigo-600 font-mono text-white text-[10px] px-2 py-0.5 rounded font-black">
                                {insuranceAdviseResult.matchScore}% Match
                              </span>
                            </div>
                            <p className="font-bold text-white text-xs">{insuranceAdviseResult.recommendedPlan}</p>
                            <p className="italic">{insuranceAdviseResult.note}</p>
                            <button 
                              type="button"
                              onClick={() => setInsuranceAdviseResult(null)}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] py-1.5 rounded-lg text-center cursor-pointer transition-all mt-1"
                            >
                              Reset Adviser Screen
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleGenerateInsuranceAdvise}
                            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xs py-3 rounded-xl shadow cursor-pointer transition-all mt-2"
                          >
                            Generate Cashless Recommendation
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dynamic claims ledger tracked per family member */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 text-slate-800">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1">
                          <Check className="h-4 w-4 text-emerald-500" /> Cashless Claims Tracker: {activeFamilyMember}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1">Live cashless hospitalization authorizations and claim history for regional hospitals.</p>
                      </div>

                      {activeFamilyMember === "Prerna Ram" ? (
                        <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between text-xs font-semibold gap-3">
                          <div>
                            <p className="font-extrabold text-[#022c22]">Acute Pulmonology Claim</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Noida Max Multispecialty • Claim ID: 98110-C</p>
                          </div>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2 py-1 rounded">₹48,200 Approved</span>
                        </div>
                      ) : activeFamilyMember === "Shanti Ram" ? (
                        <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-2xl flex items-center justify-between text-xs font-semibold gap-3">
                          <div>
                            <p className="font-extrabold text-[#451a03]">Geriatric Joint Support checkup</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Delhi Primus Super Specialty • Claim ID: 77241-K</p>
                          </div>
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-2 py-1 rounded">Sanction Pending</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between text-xs font-semibold gap-3">
                            <div>
                              <p className="font-extrabold text-[#022c22]">Digital Pharmacy Rebate</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">Apollo Cashless Pharmacy • Claim ID: 15420-R</p>
                            </div>
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2 py-1 rounded">₹1,140 Refunded</span>
                          </div>
                          <p className="text-[10px] text-slate-400 text-center italic font-semibold">No active inpatient cashless claim cards for {activeFamilyMember} today.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "super-app" && (
              <div className="space-y-6 pb-12 animate-fade-in font-sans">
                {/* Header Profile Dashboard Segment */}
                <div className={`p-6 rounded-3xl border transition-all ${
                  isAppDarkMode 
                    ? "bg-slate-950/40 border-slate-800" 
                    : "bg-white border-slate-200 shadow-xs"
                } flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`p-1 px-2.5 rounded font-mono text-[9px] font-bold uppercase tracking-widest ${
                        isAppDarkMode ? "bg-amber-500/20 text-amber-400" : "bg-blue-50 text-blue-600"
                      }`}>
                        Tier-1 Super-App Suite
                      </span>
                      <span className="text-[10px] text-slate-400">• NCR Grid Connected</span>
                    </div>
                    <h3 className={`text-xl font-black tracking-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                      City Healer Differentiators
                    </h3>
                    <p className={`text-xs ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Simulated proprietary high-fidelity clinical operating engine. Select feature modules below.
                    </p>
                  </div>

                  {/* Hot Switch Segment Buttons */}
                  <div className={`p-1 rounded-2xl flex flex-wrap gap-1 ${
                    isAppDarkMode ? "bg-slate-900" : "bg-slate-100"
                  }`}>
                    <button
                      onClick={() => setSuperActiveSubTab("copilot")}
                      className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                        superActiveSubTab === "copilot"
                          ? (isAppDarkMode ? "bg-indigo-600 text-white" : "bg-white text-slate-900 shadow-xs")
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Copilot (B)</span>
                    </button>
                    <button
                      onClick={() => setSuperActiveSubTab("health-id")}
                      className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                        superActiveSubTab === "health-id"
                          ? (isAppDarkMode ? "bg-indigo-600 text-white" : "bg-white text-slate-900 shadow-xs")
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <IdCard className="h-3.5 w-3.5 text-teal-500" />
                      <span>Unified Health ID (A)</span>
                    </button>
                    <button
                      onClick={() => setSuperActiveSubTab("emergency")}
                      className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                        superActiveSubTab === "emergency"
                          ? (isAppDarkMode ? "bg-indigo-600 text-white" : "bg-white text-slate-900 shadow-xs")
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Ambulance className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                      <span>SOS Emergency (C)</span>
                    </button>
                    <button
                      onClick={() => setSuperActiveSubTab("recommender")}
                      className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                        superActiveSubTab === "recommender"
                          ? (isAppDarkMode ? "bg-indigo-600 text-white" : "bg-white text-slate-900 shadow-xs")
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <UserCheck className="h-3.5 w-3.5 text-amber-500" />
                      <span>AI Doctor Match (D)</span>
                    </button>
                  </div>
                </div>

                {/* MODULE VIEWPOR WINDOWS */}
                <div className="transition-all duration-300">
                  {/* MODULE B: AI HEALTH COPILOT INTERACTIVE CONSOLE */}
                  {superActiveSubTab === "copilot" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                      {/* Left: Chat Terminal Screen (Span 7) */}
                      <div className={`col-span-1 lg:col-span-7 rounded-3xl border flex flex-col h-[560px] overflow-hidden ${
                        isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                      }`}>
                        {/* Console Header */}
                        <div className={`p-4 border-b flex items-center justify-between ${
                          isAppDarkMode ? "border-slate-800 bg-slate-900/60" : "border-slate-100 bg-slate-50"
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl">
                              <Bot className="h-5 w-5" />
                            </div>
                            <div>
                              <p className={`font-extrabold text-sm ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                                Resident AI Health Copilot
                              </p>
                              <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-semibold uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                Active clinical session
                              </span>
                            </div>
                          </div>
                          
                          {/* Regional Interactive Language Switcher */}
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 p-0.5 rounded-xl text-[10px]">
                            <button 
                              type="button"
                              onClick={() => {
                                setAppLanguage("en");
                                showToast("AI Engine language set to English mode.");
                              }}
                              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                appLanguage === "en" 
                                  ? "bg-indigo-650 text-white shadow-xs" 
                                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              }`}
                            >
                              English
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                setAppLanguage("hi");
                                showToast("इंटरफ़ेस की भाषा हिन्दी में बदल दी गई है। (Hindi mode Active)");
                              }}
                              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                appLanguage === "hi" 
                                  ? "bg-indigo-650 text-white shadow-xs" 
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              हिन्दी (Hindi)
                            </button>
                          </div>
                        </div>

                        {/* Messages Thread list */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {copilotHistory.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex flex-col max-w-[85%] ${
                                msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                              }`}
                            >
                              <span className="text-[9px] text-slate-400 font-bold mb-0.5 px-1">{msg.time}</span>
                              <div className={`p-3.5 rounded-2xl text-xs leading-normal whitespace-pre-wrap ${
                                msg.sender === "user"
                                  ? "bg-indigo-650 text-white rounded-br-none shadow-md"
                                  : isAppDarkMode
                                    ? "bg-slate-900 text-slate-100 rounded-bl-none border border-slate-800"
                                    : "bg-slate-100 text-slate-850 rounded-bl-none border border-slate-150"
                              }`}>
                                {msg.text}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Quick Prompts Chips Selection */}
                        <div className={`p-3 border-t flex flex-wrap gap-1.5 ${
                          isAppDarkMode ? "border-slate-800 bg-slate-900/20" : "border-slate-150 bg-slate-50/50"
                        }`}>
                          <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest pl-1 py-1 w-full text-left">Quick Chat Queries:</span>
                          <button
                            onClick={() => handleSendCopilotMessage("Tell me about my platelet safety counts")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:scale-95 ${
                              isAppDarkMode ? "bg-slate-850 hover:bg-slate-800 text-slate-300" : "bg-white hover:bg-slate-150 text-slate-700 border"
                            }`}
                          >
                            🩸 Blood platelets?
                          </button>
                          <button
                            onClick={() => handleSendCopilotMessage("How do I manage my daily caloric goals?")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:scale-95 ${
                              isAppDarkMode ? "bg-slate-850 hover:bg-slate-800 text-slate-300" : "bg-white hover:bg-slate-150 text-slate-700 border"
                            }`}
                          >
                            🍎 Calorie nutrition goals?
                          </button>
                          <button
                            onClick={() => handleSendCopilotMessage("Is Paracetamol safe to pair with cold syrups?")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:scale-95 ${
                              isAppDarkMode ? "bg-slate-850 hover:bg-slate-800 text-slate-300" : "bg-white hover:bg-slate-150 text-slate-700 border"
                            }`}
                          >
                            💊 Safe cold medicine pairing?
                          </button>
                        </div>

                        {/* Interactive Message Input Box */}
                        <div className={`p-3 border-t flex gap-2 ${
                          isAppDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-150 bg-white"
                        }`}>
                          <input
                            type="text"
                            value={copilotInputText}
                            onChange={(e) => setCopilotInputText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSendCopilotMessage(); }}
                            placeholder={isListening ? "Listening... Speak hands-free..." : "Ask Copilot about symptoms, reports, or dosage warning..."}
                            className={`flex-1 px-4 py-3 rounded-xl text-xs focus:outline-none border focus:ring-1 ${
                              isListening 
                                ? "border-rose-450 bg-rose-50/15 focus:ring-rose-500 text-rose-950 font-semibold"
                                : isAppDarkMode 
                                ? "bg-slate-900 border-slate-800 text-white focus:ring-indigo-500" 
                                : "bg-slate-50 border-slate-200 focus:ring-indigo-500 text-slate-800"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={toggleListening}
                            className={`p-3 rounded-xl active:scale-90 transition-all shrink-0 ${
                              !speechSupported 
                                ? "bg-slate-100 text-slate-300 cursor-not-allowed opacity-60" 
                                : isListening 
                                ? "bg-rose-500 text-white animate-pulse shadow-sm hover:bg-rose-600" 
                                : isAppDarkMode ? "bg-slate-900 hover:bg-slate-800 text-slate-400" : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                            }`}
                            title={
                              !speechSupported 
                                ? "Speech recognition is not supported in this browser" 
                                : isListening 
                                ? "Listening... Click to stop" 
                                : `Speak in regional language (${appLanguage === "en" ? "English" : "Hindi/हिन्दी"})`
                            }
                          >
                            {isListening ? (
                              <Mic className="h-4 w-4" />
                            ) : (
                              <MicOff className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleSendCopilotMessage()}
                            className="bg-indigo-650 hover:bg-indigo-600 text-white p-3 rounded-xl transition-all cursor-pointer shrink-0"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Right: Labs side-bar diagnostics (Span 5) */}
                      <div className="col-span-1 lg:col-span-5 space-y-4">
                        {/* AI Lab Report Analyzer */}
                        <div className={`p-5 rounded-3xl border text-left ${
                          isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        } space-y-3`}>
                          <div className="flex items-center gap-1.5">
                            <Bot className="h-4 w-4 text-indigo-400" />
                            <h4 className={`text-xs font-black uppercase tracking-wider ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                              Lab Analyzer Box (Node 1)
                            </h4>
                          </div>
                          <p className="text-[10px] text-slate-400">Pick any recent diagnostic PDF scan and simulated artificial intelligence interprets metrics into raw human explanation.</p>

                          <div className="space-y-2">
                            <label className="text-[8px] uppercase tracking-widest text-slate-400 font-bold block text-left">Select Blood / Scan Report</label>
                            <select
                              value={copilotQuickAnalysisType}
                              onChange={(e) => setCopilotQuickAnalysisType(e.target.value)}
                              className={`w-full p-2.5 text-xs rounded-xl focus:outline-none border ${
                                isAppDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                              }`}
                            >
                              <option value="CBC">Comprehensive Blood Count (CBC) • 12 May 2026</option>
                              <option value="MRI">Brain MRI Scan (Contrast) • 24 Mar 2026</option>
                              <option value="URINE">Urinalysis Biomarker Summary • 18 Jan 2026</option>
                            </select>
                          </div>

                          <button
                            onClick={handleCopilotQuickAnalyze}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Interpret Selected Findings
                          </button>
                        </div>

                        {/* AI Drug dosage spec checker */}
                        <div className={`p-5 text-left rounded-3xl border ${
                          isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        } space-y-3`}>
                          <div className="flex items-center gap-1.5">
                            <Activity className="h-4 w-4 text-pink-400" />
                            <h4 className={`text-xs font-black uppercase tracking-wider ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                              AI Prescription checker
                            </h4>
                          </div>
                          <p className="text-[10px] text-slate-400">Inter-drug warning analysis. Highlights harmful overlaps, optimal administration constraints and alcohol alerts.</p>

                          <div className="space-y-2">
                            <label className="text-[8px] uppercase tracking-widest text-slate-400 font-bold block text-left">Select Active Prescription Drug</label>
                            <select
                              value={copilotSelectedDrug}
                              onChange={(e) => setCopilotSelectedDrug(e.target.value)}
                              className={`w-full p-2.5 text-xs rounded-xl focus:outline-none border ${
                                isAppDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                              }`}
                            >
                              <option value="Metformin">Metformin Hydrochloride (Glucophage) 500mg</option>
                              <option value="Amoxicillin">Amoxicillin Trihydrate Antibiotic 250mg</option>
                              <option value="Paracetamol">Paracetamol Anti-pyretic (Calpol) 650mg</option>
                            </select>
                          </div>

                          <button
                            onClick={handleCopilotDrugCheck}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Check Dosage & Toxicity Warns
                          </button>
                        </div>

                        {/* Interactive Recovery milestones progression checklist */}
                        <div className={`p-5 text-left rounded-3xl border ${
                          isAppDarkMode ? "bg-slate-950 border-slate-850 animate-fade-in" : "bg-white border-slate-200 shadow-sm"
                        } space-y-3`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="h-4 w-4 text-teal-400" />
                              <h4 className={`text-xs font-black uppercase tracking-wider ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                                Post-Viral Recovery protocol
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold text-teal-500 bg-teal-500/10 px-2 py-0.5 rounded">
                              {Math.round((Object.values(recoveryCheckedItems).filter(Boolean).length / Object.values(recoveryCheckedItems).length) * 100)}% Complete
                            </span>
                          </div>

                          {/* Protocol Selector */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setActiveRecoveryProtocol("delhi-smog");
                                setRecoveryCheckedItems({
                                  "hydration": true,
                                  "aqi": false,
                                  "masks": true,
                                  "inhaler": false,
                                });
                              }}
                              className={`flex-1 py-1 px-2.5 text-[9px] font-extrabold uppercase rounded-lg transition-all ${
                                activeRecoveryProtocol === "delhi-smog"
                                  ? "bg-teal-600 text-white"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                              }`}
                            >
                              Smog Resp Care
                            </button>
                            <button
                              onClick={() => {
                                setActiveRecoveryProtocol("dengue");
                                setRecoveryCheckedItems({
                                  "hydration": true,
                                  "plates": false,
                                  "bedrest": true,
                                  "papaya": false,
                                });
                              }}
                              className={`flex-1 py-1 px-2.5 text-[9px] font-extrabold uppercase rounded-lg transition-all ${
                                activeRecoveryProtocol === "dengue"
                                  ? "bg-teal-600 text-white"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                              }`}
                            >
                              Dengue Fever Loop
                            </button>
                          </div>

                          {/* Dynamic checklist */}
                          <div className="space-y-2 pt-1">
                            {activeRecoveryProtocol === "delhi-smog" ? (
                              <>
                                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-500/5 text-[10px] font-semibold cursor-pointer select-none">
                                  <input type="checkbox" checked={!!recoveryCheckedItems.hydration} onChange={() => handleToggleRecoveryItem("hydration")} className="h-3.5 w-3.5 accent-teal-600" />
                                  <div>
                                    <p className={`${isAppDarkMode ? "text-slate-200" : "text-slate-900"}`}>Maintain strict hydration (&gt;2.5L clean water)</p>
                                    <span className="text-[8px] text-slate-400 block font-normal">Aqueous dilution decreases smog blood toxins</span>
                                  </div>
                                </label>
                                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-500/5 text-[10px] font-semibold cursor-pointer select-none">
                                  <input type="checkbox" checked={!!recoveryCheckedItems.aqi} onChange={() => handleToggleRecoveryItem("aqi")} className="h-3.5 w-3.5 accent-teal-600" />
                                  <div>
                                    <p className={`${isAppDarkMode ? "text-slate-200" : "text-slate-900"}`}>Keep AQI inside below 80 parameters</p>
                                    <span className="text-[8px] text-slate-400 block font-normal">Requires HEPA indoor purifier air treatment</span>
                                  </div>
                                </label>
                                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-500/5 text-[10px] font-semibold cursor-pointer select-none">
                                  <input type="checkbox" checked={!!recoveryCheckedItems.masks} onChange={() => handleToggleRecoveryItem("masks")} className="h-3.5 w-3.5 accent-teal-600" />
                                  <div>
                                    <p className={`${isAppDarkMode ? "text-slate-200" : "text-slate-900"}`}>Use high grade N95/N99 facial respirators outside</p>
                                    <span className="text-[8px] text-slate-400 block font-normal">Filters PM2.5 micro air soot efficiently</span>
                                  </div>
                                </label>
                                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-500/5 text-[10px] font-semibold cursor-pointer select-none">
                                  <input type="checkbox" checked={!!recoveryCheckedItems.inhaler} onChange={() => handleToggleRecoveryItem("inhaler")} className="h-3.5 w-3.5 accent-teal-600" />
                                  <div>
                                    <p className={`${isAppDarkMode ? "text-slate-200" : "text-slate-900"}`}>Take prescribed auxiliary corticosteroid puff</p>
                                    <span className="text-[8px] text-slate-400 block font-normal">Decreases tracheal micro bronchial swelling</span>
                                  </div>
                                </label>
                              </>
                            ) : (
                              <>
                                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-500/5 text-[10px] font-semibold cursor-pointer select-none">
                                  <input type="checkbox" checked={!!recoveryCheckedItems.hydration} onChange={() => handleToggleRecoveryItem("hydration")} className="h-3.5 w-3.5 accent-teal-600" />
                                  <div>
                                    <p className={`${isAppDarkMode ? "text-slate-200" : "text-slate-900"}`}>Hourly isotonic hydration (ORS pack + water)</p>
                                    <span className="text-[8px] text-slate-400 block font-normal">Critical for blood volume and capillary defense stability</span>
                                  </div>
                                </label>
                                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-500/5 text-[10px] font-semibold cursor-pointer select-none">
                                  <input type="checkbox" checked={!!recoveryCheckedItems.plates} onChange={() => handleToggleRecoveryItem("plates")} className="h-3.5 w-3.5 accent-teal-600" />
                                  <div>
                                    <p className={`${isAppDarkMode ? "text-slate-200" : "text-slate-900"}`}>Track platelet counts (CBC profile every 24hr)</p>
                                    <span className="text-[8px] text-slate-400 block font-normal">Emergency medical counselor trigger below 80,000 count</span>
                                  </div>
                                </label>
                                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-500/5 text-[10px] font-semibold cursor-pointer select-none">
                                  <input type="checkbox" checked={!!recoveryCheckedItems.bedrest} onChange={() => handleToggleRecoveryItem("bedrest")} className="h-3.5 w-3.5 accent-teal-600" />
                                  <div>
                                    <p className={`${isAppDarkMode ? "text-slate-200" : "text-slate-900"}`}>Complete horizontal bedrest (Zero load metrics)</p>
                                    <span className="text-[8px] text-slate-400 block font-normal">Conserves cardiac cellular energy during fever spike</span>
                                  </div>
                                </label>
                                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-500/5 text-[10px] font-semibold cursor-pointer select-none">
                                  <input type="checkbox" checked={!!recoveryCheckedItems.papaya} onChange={() => handleToggleRecoveryItem("papaya")} className="h-3.5 w-3.5 accent-teal-600" />
                                  <div>
                                    <p className={`${isAppDarkMode ? "text-slate-200" : "text-slate-900"}`}>Feed auxiliary organic papaya leaf extract</p>
                                    <span className="text-[8px] text-slate-400 block font-normal">Assists megakaryoblastic platelet synthesis support</span>
                                  </div>
                                </label>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODULE A: UNIFIED HEALTH ID TIMELINE */}
                  {superActiveSubTab === "health-id" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-slate-800">
                      {/* Left: Health ID Card layout Card (Span 5) */}
                      <div className="col-span-1 lg:col-span-12 xl:col-span-5 space-y-4 text-left">
                        {/* Beautiful simulated dynamic double-faced medical card */}
                        <div className={`p-6 rounded-[32px] border relative overflow-hidden text-white transition-all ${
                          isAppDarkMode 
                            ? "bg-linear-to-br from-indigo-950 to-slate-950 border-indigo-850 shadow-lg" 
                            : "bg-linear-to-br from-indigo-900 via-indigo-850 to-slate-900 border-indigo-700 shadow-xl"
                        }`}>
                          {/* Radial ambient globes */}
                          <div className="absolute right-0 bottom-0 w-44 h-44 bg-teal-500/10 rounded-full blur-2xl"></div>
                          <div className="absolute left-1/3 top-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>

                          {/* Card Header */}
                          <div className="flex justify-between items-start pb-4 border-b border-white/10">
                            <div>
                              <p className="text-[7px] tracking-widest font-bold font-mono text-indigo-300 uppercase">National Health Registry Node</p>
                              <h4 className="text-sm font-black tracking-tight flex items-center gap-1">
                                <QrCode className="h-4 w-4 text-teal-400" /> CITY HEALER UNIFIED ID
                              </h4>
                            </div>
                            <span className="text-[8px] uppercase font-mono font-black border border-emerald-400 bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span> Verified
                            </span>
                          </div>

                          <div className="py-5 space-y-4">
                            {/* Chip & NFC symbol */}
                            <div className="flex justify-between items-center">
                              <div className="w-9 h-7 bg-amber-400/80 rounded-md border border-amber-300 flex items-center justify-center font-bold tracking-tight text-amber-950 text-xs">
                                🔑
                              </div>
                              <Signal className="h-4 w-4 text-white/30 animate-pulse" />
                            </div>

                            {/* Main User Metadata layout */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="opacity-60 text-[8px] uppercase tracking-wider block">Unified Health ID</span>
                                <p className="font-extrabold tracking-widest font-mono text-white text-xs">{abhaIdInput}</p>
                              </div>
                              <div>
                                <span className="opacity-60 text-[8px] uppercase tracking-wider block">Patient Full Name</span>
                                <p className="font-extrabold text-white text-xs">{abhaNameInput}</p>
                              </div>
                              <div>
                                <span className="opacity-60 text-[8px] uppercase tracking-wider block">DOB / Age Details</span>
                                <p className="font-bold text-white text-xs">18 Jan 1995 ({abhaAgeInput} Years)</p>
                              </div>
                              <div>
                                <span className="opacity-60 text-[8px] uppercase tracking-wider block">Emergency Blood Group</span>
                                <p className="font-bold text-teal-300 text-xs">{abhaGroupInput}</p>
                              </div>
                            </div>
                          </div>

                          {/* Footer details card barcode and sync hashes */}
                          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-white/50">
                            <span>REGIONAL METROPOLITAN NODE: GURGAON-MAIN</span>
                            <span>INDEX: SHA-256_V4</span>
                          </div>
                        </div>

                        {/* Interactive dynamic Health ID generator panel */}
                        <div className={`p-5 rounded-3xl border ${
                          isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        } space-y-3`}>
                          <h4 className={`text-xs font-black uppercase tracking-wider ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                            Configure Dynamic ABHA ID
                          </h4>
                          <p className="text-[10px] text-slate-500">Edit clinical variables below and watch your decrypted medical credential matrix refresh instantly (ABHA compliance standard).</p>

                          <div className="grid grid-cols-2 gap-3 pb-1">
                            <div className="space-y-1">
                              <label className={`text-[8px] uppercase tracking-widest font-bold block ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Patient Name</label>
                              <input
                                type="text"
                                value={abhaNameInput}
                                onChange={(e) => setAbhaNameInput(e.target.value)}
                                className={`w-full p-2 text-xs rounded-xl focus:outline-none border ${
                                  isAppDarkMode ? "bg-slate-900 border-slate-800 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-600 focus:bg-white"
                                } font-semibold`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className={`text-[8px] uppercase tracking-widest font-bold block ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Blood Group</label>
                              <select
                                value={abhaGroupInput}
                                onChange={(e) => setAbhaGroupInput(e.target.value)}
                                className={`w-full p-2 text-xs rounded-xl focus:outline-none border ${
                                  isAppDarkMode ? "bg-slate-900 border-slate-800 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-600 focus:bg-white"
                                } font-semibold`}
                              >
                                <option value="O-Positive">O-Positive</option>
                                <option value="A-Positive">A-Positive</option>
                                <option value="B-Positive">B-Positive</option>
                                <option value="AB-Negative">AB-Negative</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className={`text-[8px] uppercase tracking-widest font-bold block ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Custom Health ID Code</label>
                              <input
                                type="text"
                                value={abhaIdInput}
                                onChange={(e) => setAbhaIdInput(e.target.value)}
                                className={`w-full p-2 text-xs rounded-xl focus:outline-none border ${
                                  isAppDarkMode ? "bg-slate-900 border-slate-800 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-600 focus:bg-white"
                                } font-semibold`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className={`text-[8px] uppercase tracking-widest font-bold block ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Patient Age</label>
                              <input
                                type="number"
                                value={abhaAgeInput}
                                onChange={(e) => setAbhaAgeInput(Number(e.target.value))}
                                className={`w-full p-2 text-xs rounded-xl focus:outline-none border ${
                                  isAppDarkMode ? "bg-slate-900 border-slate-800 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-600 focus:bg-white"
                                } font-semibold`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Hospital cloud record synchronization & file ledger (Span 7) */}
                      <div className="col-span-1 lg:col-span-12 xl:col-span-7 space-y-4 text-left">
                        {/* Ledger header and sync mechanism */}
                        <div className={`p-5 rounded-3xl border ${
                          isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        } space-y-4`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-150">
                            <div>
                              <h4 className={`text-sm font-black uppercase tracking-wider ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                                Inter-Hospital Ledger Vault (6 active nodes)
                              </h4>
                              <p className="text-[10px] text-slate-500 font-medium">Decentralized, unified timeline compiled across Max, Fortis, Medanta, and NCR Gurgaon Civil Nodes.</p>
                            </div>
                            
                            <button
                              onClick={handleSyncAbhaRecords}
                              disabled={abhaSyncing}
                              className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none flex items-center justify-center gap-1.5 shrink-0 ${
                                abhaSyncing 
                                  ? "bg-slate-700 text-slate-300 cursor-not-allowed" 
                                  : "bg-teal-600 hover:bg-teal-500 text-white shadow"
                              }`}
                            >
                              {abhaSyncing ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
                                  <span>Syncing Nodes...</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Sync Registry Nodes</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Records Ledger Grid list */}
                          <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                            {healthRecordsList.map((rec) => (
                              <div
                                key={rec.id}
                                className={`p-3.5 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:scale-[0.99] ${
                                  isAppDarkMode 
                                    ? "bg-slate-900/60 border-slate-800 hover:border-slate-700" 
                                    : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ${
                                      isAppDarkMode ? "bg-blue-950/40 text-blue-400" : "bg-blue-500/10 text-blue-600"
                                    }`}>
                                      {rec.type}
                                    </span>
                                    <span className={`text-[10px] font-mono ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                      {rec.date}
                                    </span>
                                  </div>
                                  <p className={`text-xs font-extrabold ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>{rec.title}</p>
                                  <p className="text-[10px] text-slate-400">Node: {rec.hospital} • Signee: {rec.doctor}</p>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                  <span className="px-2 py-1 text-[8px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-400 rounded flex items-center gap-1 leading-none">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span> Crypt Locked
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Add clinical report form drawer */}
                          <div className="border-t pt-4 border-slate-150 space-y-3">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block pl-1">Decrypter Sandbox: Upload External File</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              <input
                                type="text"
                                value={superNewRecordTitle}
                                onChange={(e) => setSuperNewRecordTitle(e.target.value)}
                                placeholder="E.g. Covid Vaccination Copy"
                                className={`p-2.5 text-xs rounded-xl focus:outline-none border ${
                                  isAppDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                                }`}
                              />
                              <select
                                value={superNewRecordHospital}
                                onChange={(e) => setSuperNewRecordHospital(e.target.value)}
                                className={`p-2.5 text-xs rounded-xl focus:outline-none border ${
                                  isAppDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                                }`}
                              >
                                <option value="Gurgaon Sector 45 General">Gurgaon Sector 45 General</option>
                                <option value="Medanta Medicity Clinic">Medanta Medicity Clinic</option>
                                <option value="Max Gurgaon Memorial">Max Gurgaon Memorial</option>
                                <option value="Delhi Primus Hospital">Delhi Primus Hospital</option>
                              </select>
                              <button
                                type="button"
                                onClick={(e) => handleAddHealthRecord(e as any)}
                                className="bg-teal-600 hover:bg-teal-500 text-white py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow flex items-center justify-center gap-1.5"
                              >
                                <Plus className="h-4 w-4" />
                                Save Uploaded Document
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODULE C: REAL-TIME EMERGENCY NETWORK */}
                  {superActiveSubTab === "emergency" && (
                    <div className="space-y-6 animate-fade-in text-slate-800">
                      {/* Emergency Top Level Alert Panic Command Center */}
                      <div className={`p-6 rounded-[32px] border text-center relative overflow-hidden transition-all ${
                        sosStateStatus === "ACTIVE"
                          ? "bg-rose-950/40 border-rose-900/60 shadow-lg"
                          : isAppDarkMode
                            ? "bg-slate-950 border-slate-800"
                            : "bg-white border-slate-200 shadow-sm"
                      }`}>
                        {/* Pulsing decorative layout items */}
                        {sosStateStatus === "ACTIVE" && (
                          <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none"></div>
                        )}

                        <div className="max-w-xl mx-auto space-y-4 relative z-10">
                          <div className="text-center">
                            <span className="p-1 px-3 bg-rose-500/10 text-rose-500 font-mono text-[9px] font-black uppercase tracking-widest rounded-full leading-none flex items-center gap-1 w-max mx-auto mb-2 select-none">
                              {sosStateStatus === "ACTIVE" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block"></span>
                              )}
                              Immediate Critical Command Beacon
                            </span>
                            <h3 className={`text-xl font-black tracking-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                              Gurgaon-Expressway Critical Rescue Center
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              Triggers immediate sirens on central trauma desk, dispatches GPS medical ambulance responders within 600m and alerts predefined immediate family.
                            </p>
                          </div>

                          {/* Massive Interactive Trigger Trigger */}
                          <div className="py-4">
                            {sosStateStatus === "IDLE" && (
                              <button
                                onClick={handleTriggerSOS}
                                className="w-48 h-48 bg-rose-600 hover:bg-rose-500 text-white rounded-full font-black uppercase tracking-widest text-[#fff] text-center border-[8px] border-rose-500/20 shadow-2xl transition-transform active:scale-95 duration-200 cursor-pointer flex flex-col items-center justify-center gap-2 group mx-auto"
                              >
                                <Radio className="h-9 w-9 animate-bounce text-white" />
                                <span className="text-sm font-extrabold text-[#fff]">ACTIVATE SOS</span>
                                <span className="text-[8px] opacity-75 font-semibold leading-none text-[#fff]">ONE-TAP ESCALATED DISPATCH</span>
                              </button>
                            )}

                            {sosStateStatus === "COUNTDOWN" && (
                              <div className="w-48 h-48 bg-red-800 text-white rounded-full font-black text-6xl shadow-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-1 mx-auto text-[#fff] border-[8px] border-red-700 animate-ping">
                                {sosCountDownVal}
                              </div>
                            )}

                            {sosStateStatus === "ACTIVE" && (
                              <div className="space-y-4">
                                <button
                                  onClick={handleTriggerSOS}
                                  className="w-48 h-48 bg-slate-900 hover:bg-slate-800 text-rose-500 rounded-full font-black uppercase tracking-widest text-xs border-[8px] border-rose-950/30 shadow-2xl transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-2 mx-auto"
                                >
                                  <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping"></span>
                                  <span className="font-extrabold text-[#f43f5e]">CANCEL SOS RESCUE</span>
                                  <span className="text-[8px] text-slate-400 font-semibold uppercase block">Tap countermand</span>
                                </button>

                                <div className="p-4 bg-rose-500/10 border border-rose-900/60 rounded-2xl max-w-sm mx-auto space-y-1.5 animate-fade-in">
                                  <p className="text-[10px] text-rose-450 font-bold uppercase tracking-wider block">🚨 BROADCAST CONFIRMED</p>
                                  <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                                    Trauma Desk Gurgaon Node has accepted packet. Cellular SMS dispatch links forwarded to: Mom, Sister, Spouse. GPS beacon streaming.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Map & ICU grids details row */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                        {/* Live Ambulance GPS Tracker SVG / Canvas Canvas (Span 6) */}
                        <div className={`col-span-1 lg:col-span-6 rounded-3xl border p-5 ${
                          isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        } space-y-4`}>
                          <div className="flex justify-between items-center border-b pb-3 border-slate-150">
                            <div className="flex items-center gap-1.5">
                              <Ambulance className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
                              <h4 className={`text-xs font-black uppercase tracking-wider ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                                Live Ambulance Telemetry Stream
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold text-rose-450 bg-rose-500/10 px-2.5 py-0.5 rounded">
                              {sosStateStatus === "ACTIVE" ? `Dispatch ETA: ${liveAmbulanceEta} mins` : "Status: Radar Standby"}
                            </span>
                          </div>

                          {/* Graphical Map Canvas (SVG design portraying NH8 expressway Gurgaon grid) */}
                          <div className={`h-[240px] rounded-2xl relative overflow-hidden flex items-center justify-center border ${
                            isAppDarkMode ? "bg-slate-900 border-slate-850" : "bg-slate-50 border-slate-100"
                          }`}>
                            <svg className="absolute inset-0 w-full h-full opacity-35" viewBox="0 0 400 240">
                              {/* Grid Grid network */}
                              <path d="M 0 40 L 400 40 M 0 120 L 400 120 M 0 200 L 400 200" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
                              <path d="M 60 0 L 60 240 M 200 0 L 200 240 M 340 0 L 340 240" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
                              
                              {/* National Highway 8 road path */}
                              <path d="M 30 210 Q 150 150 200 120 T 370 30" fill="none" stroke="#64748b" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M 30 210 Q 150 150 200 120 T 370 30" fill="none" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
                              
                              {/* Critical Nodes circles and text labels */}
                              <circle cx="30" cy="210" r="10" fill="#e11d48" opacity="0.3" />
                              <circle cx="30" cy="210" r="4" fill="#e11d48" />
                              
                              <circle cx="370" cy="30" r="12" fill="#0284c7" opacity="0.3" />
                              <circle cx="370" cy="30" r="5" fill="#0284c7" />
                            </svg>

                            {/* Relative floating text indicators inside Map */}
                            <span className="absolute bottom-4 left-6 text-[8px] font-mono font-bold bg-slate-950/80 text-slate-300 p-1 px-1.5 rounded uppercase tracking-wider border border-slate-800">
                              Patient SOS Origin
                            </span>
                            
                            <span className="absolute top-4 right-8 text-[8px] font-mono font-bold bg-slate-950/80 text-slate-300 p-1 px-1.5 rounded uppercase tracking-wider border border-slate-800">
                              Gurgaon Trauma Center Node
                            </span>

                            {/* Active Moving Ambulance Node marker */}
                            {sosStateStatus === "ACTIVE" ? (
                              <div
                                className="absolute bg-rose-600 border border-white text-white p-2 rounded-xl flex items-center gap-1 font-bold text-[9px] shadow-lg shadow-rose-600/30 font-sans"
                                style={{
                                  left: `${Math.round(40 + (320 * (ambulanceProgressPercent / 100)))}px`,
                                  top: `${Math.round(180 - (150 * (ambulanceProgressPercent / 100)))}px`,
                                  transform: "translate(-50%, -50%)"
                                }}
                              >
                                <span className="absolute -inset-1 bg-rose-500 rounded-xl animate-ping opacity-30"></span>
                                🚑 EMERGENCY CRITICAL RESPONDER
                              </div>
                            ) : (
                              <div className="text-center space-y-1.5 p-6 max-w-sm select-none">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Ambulance GPS Inactive</p>
                                <p className="text-[10px] text-slate-500 leading-relaxed">No telemetry to display. GPS mapping pipeline begins streaming automatically upon executing emergency SOS alarm.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ICU & Ventilator vacancies tabular grid (Span 7) */}
                        <div className={`col-span-1 lg:col-span-6 rounded-3xl border p-5 ${
                          isAppDarkMode ? "bg-slate-950 border-slate-800 animate-fade-in" : "bg-white border-slate-200 shadow-sm"
                        } space-y-4`}>
                          <div>
                            <h4 className={`text-xs font-black uppercase tracking-wider ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                              Real-Time ICU Bed & Ventilator Census: Delhi NCR
                            </h4>
                            <p className="text-[10px] text-slate-500">Live clinical vacancy matrix cross-referenced directly with representing hospital central nodes.</p>
                          </div>

                          <div className="space-y-2 overflow-y-auto max-h-[220px]">
                            {icuVentilatorStats.map((item) => (
                              <div
                                key={item.name}
                                className={`p-3 border rounded-xl flex items-center justify-between gap-3 text-xs font-semibold ${
                                  isAppDarkMode ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-100"
                                }`}
                              >
                                <div>
                                  <p className={`font-extrabold ${isAppDarkMode ? "text-slate-100" : "text-slate-900"}`}>{item.name}</p>
                                  <span className="text-[9px] text-slate-400 block font-normal">Distance: {item.distance}</span>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <span className="text-[8px] uppercase text-slate-400 block font-bold leading-none">ICU Beds</span>
                                    <span className={`text-xs font-black ${item.icubeds > 5 ? "text-teal-400" : "text-amber-500"}`}>{item.icubeds} left</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[8px] uppercase text-slate-400 block font-bold leading-none">Vents Available</span>
                                    <span className={`text-xs font-black ${item.ventAvailable > 2 ? "text-teal-400" : "text-rose-500"}`}>{item.ventAvailable}</span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-black leading-none ${
                                    item.status === "Vacant"
                                      ? "bg-teal-500/10 text-teal-400"
                                      : item.status === "Stable"
                                        ? "bg-blue-500/10 text-blue-400"
                                        : "bg-rose-500/10 text-rose-450 animate-pulse"
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODULE D: AI DOCTOR RECOMMENDATION MATCH ENGINE */}
                  {superActiveSubTab === "recommender" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-slate-800">
                      {/* Left side input questionnaire (Span 5) */}
                      <div className={`col-span-1 lg:col-span-12 xl:col-span-5 p-5 border rounded-3xl text-left ${
                        isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                      } space-y-4`}>
                        <div>
                          <h4 className={`text-xs font-black uppercase tracking-wider ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                            Configure Match Parameters
                          </h4>
                          <p className="text-[10px] text-slate-500">Intelligent doctor recommender engine correlates local physical symptoms with hospital insurance cashless grids.</p>
                        </div>

                        <div className="space-y-3 font-semibold text-xs text-slate-800">
                          {/* Symptoms */}
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest text-slate-400 font-bold block text-left">Patient Primary Concern</label>
                            <select
                              value={matcherSymptomInput}
                              onChange={(e) => setMatcherSymptomInput(e.target.value)}
                              className={`w-full p-2.5 rounded-xl border focus:outline-none ${
                                isAppDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                              }`}
                            >
                              <option value="Cardiology / Chest Breathlessness">Cardiology / Acute Chest Pressure (Fortis/Medanta)</option>
                              <option value="Pediatrics / Fever in Child">Pediatrics / Heavy Infant Fever (Gurgaon General)</option>
                              <option value="Pulmonology / Toxic AQI Smog Cough">Pulmonology / COPD respiratory irritants (Delhi Primus)</option>
                            </select>
                          </div>

                          {/* Budget */}
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest text-slate-400 font-bold block text-left">Consultation Budget Class</label>
                            <div className={`p-1 rounded-xl flex gap-1 ${isAppDarkMode ? "bg-slate-900" : "bg-slate-100"}`}>
                              {(["ECONOMY", "STANDARD", "PREMIUM"] as const).map((b) => (
                                <button
                                  key={b}
                                  type="button"
                                  onClick={() => setMatcherBudgetTier(b)}
                                  className={`flex-1 py-1 px-1.5 font-bold uppercase rounded-lg text-[9px] transition-all cursor-pointer ${
                                    matcherBudgetTier === b
                                      ? "bg-indigo-600 text-white"
                                      : "text-slate-500 hover:text-slate-700"
                                  }`}
                                >
                                  {b}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Insurance */}
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest text-slate-400 font-bold block text-left">Cashless Insurance Provider</label>
                            <select
                              value={matcherInsuranceProvider}
                              onChange={(e) => setMatcherInsuranceProvider(e.target.value)}
                              className={`w-full p-2.5 rounded-xl border focus:outline-none ${
                                isAppDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                              }`}
                            >
                              <option value="Star Health Insurance">Star Health Coverage Node (100% Cashless)</option>
                              <option value="Apollo Munich Premium">Apollo Munich Gold Net (80% Copay Free)</option>
                              <option value="HDFC ERGO Max">HDFC ERGO General Hospital Network</option>
                            </select>
                          </div>

                          {/* Distance */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                              <label className="text-[8px] uppercase tracking-widest text-slate-400 font-bold block">Max Regional Distance</label>
                              <span className="text-indigo-400">{matcherDistanceRadius} km radius</span>
                            </div>
                            <input
                              type="range"
                              min="2"
                              max="30"
                              value={matcherDistanceRadius}
                              onChange={(e) => setMatcherDistanceRadius(Number(e.target.value))}
                              className="w-full accent-indigo-600 cursor-pointer"
                            />
                          </div>

                          {/* Priority */}
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest text-slate-400 font-bold block text-left">Client Urgency Priority</label>
                            <select
                              value={matcherEmergencyPriority}
                              onChange={(e) => setMatcherEmergencyPriority(e.target.value as any)}
                              className={`w-full p-2.5 rounded-xl border focus:outline-none ${
                                isAppDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                              }`}
                            >
                              <option value="LOW">Low (Awaiting general review slot)</option>
                              <option value="NORMAL">Normal (Within 2 hours consultation window)</option>
                              <option value="HIGH">High (Immediate live wait priority index)</option>
                            </select>
                          </div>
                        </div>

                        <button
                          onClick={handleGenerateDoctorMatches}
                          disabled={matcherIsLoading}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all cursor-pointer shadow flex items-center justify-center gap-1.5"
                        >
                          {matcherIsLoading ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              <span>Correlating Clinical Matrix...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              <span>Identify Best Doctor Matches</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Right side outputs recommendations list (Span 7) */}
                      <div className="col-span-1 lg:col-span-12 xl:col-span-7 space-y-4 text-left">
                        <div className={`p-5 rounded-3xl border ${
                          isAppDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        } space-y-4`}>
                          <div>
                            <h4 className={`text-sm font-black uppercase tracking-wider ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                              Matched Experts & Success Rates
                            </h4>
                            <p className="text-[10px] text-slate-500">Cross-analyzed patient ratings, waiting indicators, and cashless approval parameters.</p>
                          </div>

                          {matcherOutputDoctors.length > 0 ? (
                            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 animate-fade-in">
                              {matcherOutputDoctors.map((doc: any, index) => {
                                // generate some mock diagnostic indicators
                                const calculatedMatchScore = index === 0 ? 99 : index === 1 ? 92 : 85; 
                                return (
                                  <div
                                    key={doc.id || index}
                                    className={`p-4 border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-indigo-500 ${
                                      isAppDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-100"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-11 h-11 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center font-bold text-base border border-slate-300`}>
                                        👨‍⚕️
                                      </div>
                                      <div>
                                        <p className={`font-extrabold text-sm ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>{doc.name}</p>
                                        <p className="text-[10px] text-indigo-400 font-extrabold">{doc.specialty} • {doc.experience} Yr Exp</p>
                                        <p className="text-[9px] text-slate-400 font-medium">Node: {doc.hospitalName}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 self-start md:self-auto">
                                      <div className="text-right">
                                        <span className="text-[8px] font-bold text-slate-450 uppercase block">Intelli-Match</span>
                                        <span className="text-xs font-black text-teal-400">{calculatedMatchScore}% Core Match</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-[8px] font-bold text-slate-450 uppercase block">Live Wait</span>
                                        <span className="text-xs font-black text-amber-500">{doc.waitTimeMin || 10} Mins</span>
                                      </div>
                                      
                                      <button
                                        onClick={() => {
                                          setActiveTab("consultation");
                                          setConsultingAppt({
                                            id: "dummy-appt",
                                            patientId: "patient-1",
                                            patientName: activeFamilyMember === "Self" ? authName : activeFamilyMember,
                                            doctorId: doc.id,
                                            doctorName: doc.name,
                                            specialty: doc.specialty,
                                            date: new Date().toISOString().split('T')[0],
                                            time: "11:30 AM",
                                            status: "PENDING",
                                            symptoms: "AI Doctor matcher diagnostic"
                                          } as any);
                                          showToast(`Booking initiated with ${doc.name}. Redirecting to Medical Counsel section...`);
                                        }}
                                        className="bg-indigo-650 hover:bg-indigo-600 text-[#fff] text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl transition-all cursor-pointer"
                                      >
                                        Book Consultation
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center p-12 py-16 space-y-2 border border-dashed rounded-2xl border-slate-200 select-none">
                              <Sparkles className="h-10 w-10 text-indigo-500/40 animate-pulse mx-auto" />
                              <p className={`font-black text-sm uppercase tracking-wide ${isAppDarkMode ? "text-white" : "text-indigo-900"}`}>Awaiting Search Submission</p>
                              <p className="text-[10px] text-slate-500 max-w-sm mx-auto leading-relaxed">Adjust your target symptoms and click identify best doctor matches to run simulated neural search against NCR hospital nodes.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "smart-network" && (
              <SmartDoctorNetwork />
            )}

            {activeTab === "chn" && (
              <CityHealthNetwork />
            )}

            {activeTab === "trends" && (
              <AIHealthTrends activityLog={activityLog} isAppDarkMode={isAppDarkMode} />
            )}
          </motion.div>
        </AnimatePresence>
            {/* ADD PATIENT / FAMILY MEMBER ONBOARD MODAL */}
            {isAddPatientOpen && (
              <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-all">
                <div className={`rounded-3xl border w-full max-w-md p-6 space-y-5 shadow-2xl relative animate-fade-in transition-all duration-300 ${
                  isAppDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-black tracking-tight">Onboard New Patient</h3>
                      <p className="text-[11px] text-slate-500">Register secondary clinical identity & update health portal profile.</p>
                    </div>
                    <button 
                      onClick={() => setIsAddPatientOpen(false)}
                      className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-400 cursor-pointer text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleAddNewPatient} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-500">Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={newPatientName}
                        onChange={(e) => setNewPatientName(e.target.value)}
                        placeholder="e.g. Shalini Ram"
                        className={`w-full px-4.5 py-3 rounded-xl border text-xs font-semibold focus:outline-none transition-all ${
                          isAppDarkMode 
                            ? "bg-slate-950 border-slate-800 focus:border-blue-500 text-white" 
                            : "bg-slate-50 border-slate-200 focus:border-blue-600 focus:bg-white text-slate-800"
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-500">Relationship</label>
                        <select 
                          value={newPatientRelation}
                          onChange={(e) => setNewPatientRelation(e.target.value)}
                          className={`w-full px-4.5 py-3 rounded-xl border text-xs font-semibold focus:outline-none transition-all ${
                            isAppDarkMode 
                              ? "bg-slate-950 border-slate-800 text-white" 
                              : "bg-slate-50 border-slate-200 text-slate-800"
                          }`}
                        >
                          <option value="Spouse">Spouse</option>
                          <option value="Mother">Mother</option>
                          <option value="Father">Father</option>
                          <option value="Son">Son</option>
                          <option value="Daughter">Daughter</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Other">Other Family</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-500">Gender</label>
                        <select 
                          value={newPatientGender}
                          onChange={(e) => setNewPatientGender(e.target.value)}
                          className={`w-full px-4.5 py-3 rounded-xl border text-xs font-semibold focus:outline-none transition-all ${
                            isAppDarkMode 
                              ? "bg-slate-950 border-slate-800 text-white" 
                              : "bg-slate-50 border-slate-200 text-slate-800"
                          }`}
                        >
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-500">Age (Years)</label>
                        <input 
                          type="number" 
                          required
                          min="1"
                          max="125"
                          value={newPatientAge}
                          onChange={(e) => setNewPatientAge(Number(e.target.value))}
                          className={`w-full px-4.5 py-3 rounded-xl border text-xs font-semibold focus:outline-none transition-all ${
                            isAppDarkMode 
                              ? "bg-slate-950 border-slate-800 focus:border-blue-500 text-white" 
                              : "bg-slate-50 border-slate-200 focus:border-blue-600 focus:bg-white text-slate-800"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-500">Blood Group</label>
                        <select 
                          value={newPatientBloodGroup}
                          onChange={(e) => setNewPatientBloodGroup(e.target.value)}
                          className={`w-full px-4.5 py-3 rounded-xl border text-xs font-semibold focus:outline-none transition-all ${
                            isAppDarkMode 
                              ? "bg-slate-950 border-slate-800 text-white" 
                              : "bg-slate-50 border-slate-200 text-slate-800"
                          }`}
                        >
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-500">Insurance Cover ID (Optional)</label>
                      <input 
                        type="text" 
                        value={newPatientPolicy}
                        onChange={(e) => setNewPatientPolicy(e.target.value)}
                        placeholder="Leave empty to auto-generate policy keys"
                        className={`w-full px-4.5 py-3 rounded-xl border text-xs font-semibold focus:outline-none transition-all ${
                          isAppDarkMode 
                            ? "bg-slate-950 border-slate-800 focus:border-blue-500 text-white" 
                            : "bg-slate-50 border-slate-200 focus:border-blue-600 focus:bg-white text-slate-800"
                        }`}
                      />
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button 
                        type="button" 
                        onClick={() => setIsAddPatientOpen(false)}
                        className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          isAppDarkMode 
                            ? "border-slate-800 hover:bg-slate-800 text-slate-300" 
                            : "border-slate-200 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        Onboard Patient
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* PROFILE & SECURITY SETTINGS MODAL */}
            {isSettingsOpen && (
              <div id="profile-settings-overlay" className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-all">
                <div 
                  id="profile-settings-container" 
                  className={`rounded-3xl border w-full max-w-lg p-6 md:p-8 space-y-6 shadow-2xl relative animate-fade-in transition-all duration-300 max-h-[85vh] overflow-y-auto ${
                    isAppDarkMode 
                      ? "bg-slate-950 border-slate-800 text-slate-100 shadow-cyan-950/20" 
                      : "bg-white border-slate-200 text-slate-800 shadow-slate-200/50"
                  }`}
                >
                  
                  {/* Close Trigger */}
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className={`absolute right-5 top-5 p-1.5 rounded-full transition-transform active:scale-95 cursor-pointer ${
                      isAppDarkMode 
                        ? "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200" 
                        : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                    }`}
                    id="close-settings-btn"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`p-1 px-2.5 rounded font-mono text-[9px] font-bold uppercase tracking-widest ${
                        isAppDarkMode ? "bg-slate-900 text-slate-400" : "bg-slate-100 text-slate-500"
                      }`}>Settings Panel</span>
                      <span className="text-[10px] text-slate-400">Firmware 14.8.2-A</span>
                    </div>
                    <h3 className={`text-lg font-black tracking-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
                      Profile & Security preferences
                    </h3>
                    <p className={`text-xs leading-normal ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Adjust your secure clinical credentials, configure active device sensor integrations, and set up bio-authenticator handshakes.
                    </p>
                  </div>

                  {/* Settings Tab Selector Bar */}
                  <div className={`flex border-b text-[10px] font-bold gap-1 pb-1 ${
                    isAppDarkMode ? "border-slate-800" : "border-slate-100"
                  }`}>
                    {[
                      { id: "profiles", label: "Profiles & Families" },
                      { id: "activity", label: "User Activity Log" },
                      { id: "features", label: "Customizable Features" },
                      { id: "system", label: "System Security" },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSettingsActiveTab(tab.id as any)}
                        className={`flex-1 py-1.5 text-center transition-all cursor-pointer border-b-2 font-extrabold ${
                          settingsActiveTab === tab.id 
                            ? "border-blue-600 text-blue-600 dark:text-cyan-400 dark:border-cyan-400" 
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* PROFILES TAB */}
                  {settingsActiveTab === "profiles" && (
                    <div className="space-y-4 animate-fade-in">
                      {/* List/Select Family or patient profile */}
                      {/* Profile user details summary card */}
                  <div className={`p-4 border rounded-2xl flex flex-col gap-4 text-xs transition-all ${
                    isAppDarkMode 
                      ? "bg-slate-900/40 border-slate-800/80" 
                      : "bg-slate-50 border-slate-100"
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-lg ${
                          isAppDarkMode ? "bg-blue-950 text-blue-400" : "bg-blue-100 text-blue-700"
                        }`}>
                          {authName.substring(0, 2)}
                        </div>
                        <div>
                          <p className={`font-extrabold text-sm ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>{authName}</p>
                          <p className={`text-[10px] ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>{authEmail} • {authPhone}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-extrabold px-2 py-1 rounded ${
                        isAppDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-200/60 text-slate-700"
                      }`}>Active Account</span>
                    </div>

                    <div className={`border-t pt-3 space-y-3 ${isAppDarkMode ? "border-slate-800" : "border-slate-200/60"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-[10px] font-medium ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>Public Doctor Profile URL</span>
                        <button
                          onClick={handleShareProfile}
                          id="share-profile-btn"
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-91 cursor-pointer ${
                            isAppDarkMode 
                              ? "bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 hover:text-indigo-200 border border-indigo-900/60 hover:border-indigo-700/80" 
                              : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 hover:border-indigo-200"
                          }`}
                        >
                          <Share2 className="h-3 w-3" />
                          Share Profile
                        </button>
                      </div>

                      {/* Social sharing row */}
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all ${
                        isAppDarkMode 
                          ? "bg-slate-950/40 border-slate-800" 
                          : "bg-white/60 border-slate-100"
                      }`}>
                        <span className={`text-[10px] font-semibold pl-1 ${
                          isAppDarkMode ? "text-slate-300" : "text-slate-500"
                        }`}>Share via:</span>
                        <div className="flex items-center gap-1.5">
                          {/* WhatsApp */}
                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                              `Check out my official doctor profile on the Gurgaon Health Network! Info, live beds, diagnostics: ${window.location.origin}/doctor/${encodeURIComponent(
                                (authRoleSelection === "DOCTOR" ? authName : `Dr. ${authName}`)
                                  .trim()
                                  .replace(/\s+/g, "-")
                                  .toLowerCase()
                              )}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            id="share-whatsapp-btn"
                            className={`flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                              isAppDarkMode 
                                ? "bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 hover:text-emerald-300 border-emerald-950/80 hover:border-emerald-800/80" 
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border-emerald-100 hover:border-emerald-200"
                            }`}
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>

                          {/* LinkedIn */}
                          <a
                            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                              `${window.location.origin}/doctor/${encodeURIComponent(
                                (authRoleSelection === "DOCTOR" ? authName : `Dr. ${authName}`)
                                  .trim()
                                  .replace(/\s+/g, "-")
                                  .toLowerCase()
                              )}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            id="share-linkedin-btn"
                            className={`flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                              isAppDarkMode 
                                ? "bg-blue-950/50 hover:bg-blue-900/60 text-blue-400 hover:text-blue-300 border-blue-950/80 hover:border-blue-850" 
                                : "bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border-blue-100 hover:border-blue-200"
                            }`}
                          >
                            <Linkedin className="h-3 w-3" />
                            LinkedIn
                          </a>

                          {/* Twitter */}
                          <a
                            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                              `${window.location.origin}/doctor/${encodeURIComponent(
                                (authRoleSelection === "DOCTOR" ? authName : `Dr. ${authName}`)
                                  .trim()
                                  .replace(/\s+/g, "-")
                                  .toLowerCase()
                              )}`
                            )}&text=${encodeURIComponent(
                              `Check out my official doctor profile on Gurgaon Health Network! @ggh_network #healthcare`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            id="share-twitter-btn"
                            className={`flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                              isAppDarkMode 
                                ? "bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700" 
                                : "bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-slate-900 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <Twitter className="h-3 w-3" />
                            Twitter
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* List of family members inside Profiles tab */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Clinical Patient Profiles</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSettingsOpen(false);
                            setIsAddPatientOpen(true);
                          }}
                          className="text-blue-600 dark:text-cyan-400 hover:underline text-[10px] font-extrabold flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add Patient Profile
                        </button>
                      </div>

                      <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                        {familyMembers.map((fm) => (
                          <div
                            key={fm.name}
                            className={`p-3 border rounded-xl flex items-center justify-between gap-3 text-xs ${
                              activeFamilyMember === fm.name
                                ? (isAppDarkMode ? "bg-blue-950/20 border-blue-500/40" : "bg-blue-50/50 border-blue-200")
                                : (isAppDarkMode ? "bg-slate-900/10 border-slate-800" : "bg-white border-slate-100")
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black uppercase text-[10px] shrink-0 ${
                                activeFamilyMember === fm.name
                                  ? (isAppDarkMode ? "bg-blue-900/55 text-blue-300" : "bg-blue-100 text-blue-700")
                                  : (isAppDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")
                              }`}>
                                {fm.name.substring(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold flex items-center gap-1.5 text-slate-900 dark:text-white truncate">
                                  <span>{fm.name}</span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                    isAppDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-150 text-slate-500"
                                  }`}>{fm.relation}</span>
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  {fm.gender} • {fm.age} yrs • Blood: {fm.bloodGroup} • Policy: {fm.policyNo}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 text-[10px]">
                              {activeFamilyMember !== fm.name && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveFamilyMember(fm.name);
                                    showToast(`Active clinical timeline swapped to family profile: ${fm.name}`);
                                  }}
                                  className="font-black uppercase tracking-wider text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                                >
                                  Select
                                </button>
                              )}
                              {fm.name !== "Self" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Remove profile option for ${fm.name}? All local cached parameters will reset.`)) {
                                      setFamilyMembers(prev => prev.filter(p => p.name !== fm.name));
                                      if (activeFamilyMember === fm.name) {
                                        setActiveFamilyMember("Self");
                                      }
                                      showToast(`🗑️ Patient profile deleted: ${fm.name}`);
                                    }
                                  }}
                                  className="font-semibold uppercase tracking-wider text-rose-500 dark:text-rose-400 hover:underline cursor-pointer ml-1"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* USER ACTIVITY LOG TAB */}
                  {settingsActiveTab === "activity" && (
                    <div className="space-y-4 animate-fade-in text-xs">
                      <div className="flex items-center justify-between pl-1">
                        <div className="space-y-0.5">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 font-extrabold text-blue-600 dark:text-cyan-400">User Activity Ledger</h4>
                          <p className="text-[10px] text-slate-500">Trace historical symptom diagnostics, drug orders, and doctor appointment scheduling.</p>
                        </div>
                        {activityLog.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Clear all activity log history entries?")) {
                                setActivityLog([]);
                                showToast("🗑️ Activity log history cleared.");
                              }
                            }}
                            className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:underline"
                          >
                            <Trash2 className="h-3 w-3" /> Clear History
                          </button>
                        )}
                      </div>

                      {activityLog.length === 0 ? (
                        <div className={`p-6 text-center border-2 border-dashed rounded-2xl flex flex-col items-center justify-center space-y-2 ${
                          isAppDarkMode ? "border-slate-800 bg-slate-900/10 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}>
                          <Clock className="h-6 w-6 text-slate-450 animate-pulse" />
                          <p className="font-extrabold text-xs">No Recent Activity Recorded</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[240px] leading-relaxed">
                            Once you schedule an appointment, submit symptoms to the AI diagnostic engine, or check out some pharmacy products, your activity details will automatically build here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                          {activityLog.map((log) => {
                            let icon = <Clock className="h-3.5 w-3.5" />;
                            if (log.type === "symptom") {
                              icon = <Brain className="h-3.5 w-3.5 text-purple-650 dark:text-purple-300" />;
                            } else if (log.type === "order") {
                              icon = <ShoppingBag className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />;
                            } else if (log.type === "appointment") {
                              icon = <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />;
                            }

                            return (
                              <div
                                key={log.id}
                                className={`p-3 border rounded-xl transition-all relative ${
                                  isAppDarkMode 
                                    ? "bg-slate-900/40 border-slate-800 hover:bg-slate-900/60" 
                                    : "bg-slate-50/50 border-slate-150/70 hover:bg-white hover:border-slate-200 hover:shadow-xs"
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 ${
                                    log.type === "symptom" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40" :
                                    log.type === "order" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40" :
                                    log.type === "appointment" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40" :
                                    "bg-slate-100 text-slate-700 dark:bg-slate-800"
                                  }`}>
                                    {icon}
                                  </div>
                                  <div className="space-y-0.5 min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-extrabold text-xs text-slate-800 dark:text-white leading-snug truncate">
                                        {log.title}
                                      </p>
                                      {log.status && (
                                        <span className={`text-[8.5px] font-black shrink-0 px-1.5 py-0.2 rounded ${
                                          log.status === "Completed" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" :
                                          log.status === "Processing" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                                          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        }`}>
                                          {log.status}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal">
                                      {log.description}
                                    </p>
                                    <div className="flex items-center gap-1.5 pt-1">
                                      <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">
                                        {new Date(log.timestamp).toLocaleString([], {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit"
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CUSTOMIZABLE FEATURES CONFIG TAB */}
                  {settingsActiveTab === "features" && (
                    <div className="space-y-4 animate-fade-in text-xs">
                      <div className="space-y-0.5">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Customize Workspace Feeds</h4>
                        <p className="text-[10px] text-slate-500">Toggle clinical portal modules on and off in real time from your sidebar navigation.</p>
                      </div>

                      <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
                        {[
                          { id: "overview", label: "Dashboard Grid Overview", desc: "Classic primary health summary bento board metrics" },
                          { id: "super-app", label: "Tier-1 Super-App Suite", desc: "Unified AI health copilot and government ABHA Digital ID gateway" },
                          { id: "smart-network", label: "Delhi NCR Smart Network", desc: "Live doctor specialty directory & matching service map" },
                          { id: "symptoms", label: "AI Diagnostic Engine", desc: "Simulate natural clinical triage diagnostic checklists" },
                          { id: "beds", label: "Live Bed Census Locator", desc: "Regional hospital emergency ICU bed locator database" },
                          { id: "consultation", label: "Medical Counsel Rooms", desc: "Digital clinical prescription writing and queues" },
                          { id: "pharmacy", label: "Pharmacy Delivery Shop", desc: "E-pharmacy local medicine dispatch checklist orders" },
                          { id: "records", label: "Health Documents Storage", desc: "Secure digital locker for clinical PDFs & lab OCR sheets" },
                          { id: "insurance", label: "Insurance Cover Autorouter", desc: "Cashless recommendation scanner & ledger tracker" },
                          { id: "sos", label: "Ambulance Panic SOS", desc: "Metropolitan emergency dispatch trigger widget and logs" },
                        ].map((feature) => (
                          <div 
                            key={feature.id}
                            className={`p-3 border rounded-xl flex items-center justify-between gap-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/20 ${
                              isAppDarkMode 
                                ? "border-slate-800 bg-slate-900/10 text-slate-200" 
                                : "border-slate-100 bg-slate-50/50 text-slate-800"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <p className="font-extrabold text-xs">{feature.label}</p>
                              <p className="text-[10px] text-slate-500 leading-normal">{feature.desc}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleFeature(feature.id)}
                              className={`w-10 h-5.5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-300 ${
                                enabledFeatures[feature.id] !== false ? "bg-blue-600 dark:bg-cyan-500" : "bg-slate-300 dark:bg-slate-700"
                              }`}
                            >
                              <div
                                className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-300 ${
                                  enabledFeatures[feature.id] !== false ? "translate-x-4.5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SYSTEM SECURITY & PREFERENCES TAB */}
                  {settingsActiveTab === "system" && (
                    <div className="space-y-4 animate-fade-in pb-1">

                  {/* Setting Groups */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-extrabold">Security & UI Preferences</h4>

                    {/* Localization Interface Language Selection toggle */}
                    <div className={`p-4 border rounded-2xl transition-all space-y-3 ${
                      isAppDarkMode 
                        ? "border-slate-800 bg-slate-900/30 hover:border-slate-700" 
                        : "border-slate-200/80 bg-white hover:border-slate-300"
                    }`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 ">
                          <Globe className={`h-3.5 w-3.5 ${isAppDarkMode ? "text-cyan-400" : "text-blue-600"}`} />
                          <span className={`font-extrabold text-xs ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                            {getTranslation(appLanguage, "languageSettingsLabel")}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed max-w-[280px]">
                          {getTranslation(appLanguage, "languageSelectDesc")}
                        </p>
                      </div>

                      {/* Pill Select Toggles */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 p-0.5 rounded-xl text-[10px] self-start w-fit">
                        <button 
                          type="button"
                          onClick={() => {
                            setAppLanguage("en");
                            showToast(translations.en.toastLangSuccess);
                          }}
                          className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            appLanguage === "en" 
                              ? "bg-slate-900 text-white shadow-xs dark:bg-slate-800" 
                              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          }`}
                        >
                          {getTranslation(appLanguage, "enLabel")}
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setAppLanguage("hi");
                            showToast(translations.hi.toastLangSuccess);
                          }}
                          className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            appLanguage === "hi" 
                              ? "bg-slate-900 text-white shadow-xs dark:bg-slate-800" 
                              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          }`}
                        >
                          {getTranslation(appLanguage, "hiLabel")}
                        </button>
                      </div>
                    </div>
                    
                    {/* Visual Interface Theme */}
                    <div className={`p-4 border rounded-2xl transition-all space-y-4 ${
                      isAppDarkMode 
                        ? "border-slate-800 bg-slate-900/30 hover:border-slate-700" 
                        : "border-slate-200/80 bg-white hover:border-slate-300"
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 ">
                            <Sun className={`h-3.5 w-3.5 ${isAppDarkMode ? "text-amber-400 animate-pulse" : "text-blue-600"}`} />
                            <span className={`font-extrabold text-xs ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>App Display Aesthetics</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed max-w-[280px]">
                            Toggle high-contrast surgical dark canvas to reduce optic fatigue during late-night clinical shifts.
                          </p>
                        </div>

                        {/* Slide Switch toggle */}
                        <div className="pt-1.5">
                          <button
                            onClick={handleToggleDarkMode}
                            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                              isAppDarkMode ? "bg-amber-500" : "bg-slate-200"
                            }`}
                            id="darkmode-toggle-trigger"
                          >
                            <div
                              className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-300 ${
                                isAppDarkMode ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Biometric Toggle Entry */}
                    <div className={`p-4 border rounded-2xl transition-all space-y-4 ${
                      isAppDarkMode 
                        ? "border-slate-800 bg-slate-900/30 hover:border-slate-700" 
                        : "border-slate-200/80 bg-white hover:border-slate-300"
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 ">
                            <Lock className={`h-3.5 w-3.5 ${isAppDarkMode ? "text-blue-400" : "text-blue-600"}`} />
                            <span className={`font-extrabold text-xs ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>Simulated Biometric Auth Gateway</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed max-w-[280px]">
                            Enable immediate bypass credentials using local hardware Touch ID or facial cameras when launching secure sessions.
                          </p>
                        </div>

                        {/* Slide Switch toggle */}
                        <div className="pt-1.5">
                          <button
                            onClick={handleToggleBiometric}
                            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                              isBiometricEnabled ? "bg-emerald-500" : "bg-slate-200"
                            }`}
                            id="biometric-toggle-trigger"
                          >
                            <div
                              className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-300 ${
                                isBiometricEnabled ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Selected Preference Selector (Tabs) */}
                      <div className={`pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isAppDarkMode ? "border-slate-800" : "border-slate-100"
                      }`}>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Preferred Biometric Method</span>
                        
                        <div className={`p-1 rounded-lg flex items-center gap-1 self-start sm:self-auto ${
                          isAppDarkMode ? "bg-slate-900" : "bg-slate-100"
                        }`}>
                          <button
                            onClick={() => {
                              setBiometricVerifyType("FINGERPRINT");
                              showToast("Device driver target changed to Touch ID Fingerprint");
                            }}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all ${
                              biometricVerifyType === "FINGERPRINT" 
                                ? (isAppDarkMode ? "bg-slate-800 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm") 
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            <Fingerprint className="h-3.5 w-3.5" />
                            Touch ID
                          </button>
                          <button
                            onClick={() => {
                              setBiometricVerifyType("FACE");
                              showToast("Device driver target changed to Camera Face ID");
                            }}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all ${
                              biometricVerifyType === "FACE" 
                                ? (isAppDarkMode ? "bg-slate-800 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm") 
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            <ScanFace className="h-3.5 w-3.5" />
                            Face ID
                          </button>
                        </div>
                      </div>

                      {isBiometricEnabled && (
                        <div className={`p-3 border rounded-xl flex items-center gap-2 text-[10px] font-semibold animate-fade-in ${
                          isAppDarkMode 
                            ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-400" 
                            : "bg-emerald-50 border-emerald-100 text-emerald-800"
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                          Enrolled and bound: Secure Keychain active on current machine.
                        </div>
                      )}
                    </div>

                    {/* Secondary Simulated Hardware Info */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className={`p-3.5 rounded-xl border text-[10px] font-semibold text-slate-500 space-y-1 ${
                        isAppDarkMode ? "bg-slate-900/40 border-slate-800/80" : "bg-slate-50 border-slate-100"
                      }`}>
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 block">Metropolitan Health Link</span>
                        <p className={`${isAppDarkMode ? "text-slate-300" : "text-slate-800"} truncate`}>SHA256: 8C3B9F-FF-182C</p>
                      </div>

                      <div className={`p-3.5 rounded-xl border text-[10px] font-semibold text-slate-500 space-y-1 ${
                        isAppDarkMode ? "bg-slate-900/40 border-slate-800/80" : "bg-slate-50 border-slate-100"
                      }`}>
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 block">Local Hardware Enclave</span>
                        <p className="text-emerald-500">Simulators Ready (ONLINE)</p>
                      </div>
                    </div>
                  </div>
                  </div>
                  )}

                  {/* Actions Footer */}
                  <div className={`border-t pt-5 flex items-center justify-between gap-4 text-xs ${
                    isAppDarkMode ? "border-slate-800" : "border-slate-100"
                  }`}>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Last changed: Today, {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    <button
                      onClick={() => setIsSettingsOpen(false)}
                      className={`font-extrabold py-2.5 px-6 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                        isAppDarkMode 
                          ? "bg-white hover:bg-slate-100 text-slate-950" 
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      Close Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HIGH FIDELITY SIMULATED BIOMETRIC SECURE GATEWAY OVERLAY */}
            {showBiometricVerifyModal && (
              <div id="biometric-verify-overlay" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div id="biometric-verify-card" className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 text-center text-white shadow-2xl relative overflow-hidden animate-fade-in space-y-6">
                  
                  {/* Subtle holographic beam decorator */}
                  <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"></div>
                  
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-base text-white tracking-tight">
                      {biometricTriggerSource === "ENROLL" 
                        ? "Simulate Biometric Registration" 
                        : "Verify Security Touch-Token"
                      }
                    </h3>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      {biometricVerifyType === "FINGERPRINT" 
                        ? "Hold finger onto device sensor array for loop enrollment" 
                        : "Face device front camera for structural point verification"
                      }
                    </p>
                  </div>

                  {/* Holographic scanner visual area */}
                  <div className="flex flex-col items-center justify-center py-4">
                    <div 
                      onClick={biometricVerifyStatus === "IDLE" ? startBiometricScanSimulation : undefined}
                      className={`w-32 h-32 rounded-full bg-slate-950 border-2 flex flex-col items-center justify-center relative cursor-pointer group active:scale-95 transition-all shadow-inner ${
                        biometricVerifyStatus === "SCANNING" ? "border-cyan-500 shadow-cyan-950/50" :
                        biometricVerifyStatus === "SUCCESS" ? "border-emerald-500 shadow-emerald-950/50" :
                        "border-slate-800 hover:border-slate-600"
                      }`}
                    >
                      {/* Pulse waves */}
                      {biometricVerifyStatus === "SCANNING" && (
                        <>
                          <span className="absolute inset-2 rounded-full border border-cyan-500/20 animate-ping"></span>
                          <span className="absolute inset-4 rounded-full border border-cyan-500/10 animate-pulse"></span>
                          {/* Laser scanning beam line */}
                          <div className="absolute h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent left-4 right-4 rounded-full animate-bounce top-1/2"></div>
                        </>
                      )}

                      {/* Icon */}
                      {biometricVerifyStatus === "SUCCESS" ? (
                        <Check className="h-14 w-14 text-emerald-400 animate-pulse" />
                      ) : biometricVerifyType === "FINGERPRINT" ? (
                        <Fingerprint className={`h-14 w-14 transition-colors ${
                          biometricVerifyStatus === "SCANNING" ? "text-cyan-400 animate-pulse" :
                          "text-slate-500 group-hover:text-slate-300"
                        }`} />
                      ) : (
                        <ScanFace className={`h-14 w-14 transition-colors ${
                          biometricVerifyStatus === "SCANNING" ? "text-cyan-400 animate-pulse" :
                          "text-slate-500 group-hover:text-slate-300"
                        }`} />
                      )}
                    </div>
                    {biometricVerifyStatus === "IDLE" && (
                      <p className="text-[9px] text-slate-500 mt-2.5 uppercase tracking-wider font-extrabold animate-pulse">Click sensor area to simulate scan</p>
                    )}
                  </div>

                  {/* Real-time scan log feedback console */}
                  <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-left font-mono text-[10px] space-y-2">
                    <div className="flex justify-between items-center text-slate-500 text-[9px] border-b border-slate-800 pb-1.5 font-bold">
                      <span>SECURE DEVICE SENSORS</span>
                      <span className="font-bold text-cyan-400 font-mono">
                        {biometricVerifyStatus === "IDLE" && "STANDBY"}
                        {biometricVerifyStatus === "SCANNING" && `SCANNING ${biometricProgress}%`}
                        {biometricVerifyStatus === "SUCCESS" && "SECURED LINKED"}
                      </span>
                    </div>
                    
                    {/* Progress bar container */}
                    <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          biometricVerifyStatus === "SUCCESS" ? 'bg-emerald-500' : 'bg-cyan-500'
                        }`} 
                        style={{ width: `${biometricProgress}%` }}
                      ></div>
                    </div>

                    <p className={`text-slate-300 leading-normal ${biometricVerifyStatus === "SUCCESS" ? "text-emerald-400" : ""}`}>
                      &gt; {biometricScanLog}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 text-xs">
                    <button
                      onClick={() => setShowBiometricVerifyModal(false)}
                      className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer"
                    >
                      Cancel / Back
                    </button>
                    {biometricVerifyStatus === "IDLE" && (
                      <button
                        onClick={startBiometricScanSimulation}
                        className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-3 rounded-xl cursor-pointer shadow shadow-cyan-400/20"
                      >
                        Scan Device Sensor
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
