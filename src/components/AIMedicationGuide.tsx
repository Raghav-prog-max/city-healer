import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  BookOpen, 
  Utensils, 
  ShieldAlert, 
  Activity, 
  Search, 
  ChevronRight, 
  RefreshCw,
  Clock,
  Heart
} from "lucide-react";
import { api } from "../utils/api";

interface Medicine {
  id: string;
  name: string;
  category: string;
  description: string;
  dosageForm: string;
}

interface Interaction {
  item: string;
  risk: "High" | "Moderate" | "Low";
  explanation: string;
}

interface GuideData {
  name: string;
  purpose: string;
  dosage: {
    standard: string;
    maximum: string;
  };
  instructions: string[];
  localFoodInteractions: Interaction[];
  safetyPrecautions: string[];
}

interface AIMedicationGuideProps {
  medicines: Medicine[];
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

const LOADING_MESSAGES = [
  "Consulting secure clinical monograph records...",
  "Assessing biological metabolic clearance rates...",
  "Analyzing local dietary and beverage matches (Chai, Lassi, Ghee, Mosambi)...",
  "Formulating bite-sized patient advisory tips...",
  "Applying clinical pharmacy council safety standards..."
];

export function AIMedicationGuide({ medicines, showToast }: AIMedicationGuideProps) {
  const [selectedMedId, setSelectedMedId] = useState<string>("med-1");
  const [customName, setCustomName] = useState<string>("");
  const [useCustom, setUseCustom] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState<number>(0);
  const [guide, setGuide] = useState<GuideData | null>(null);

  // Cycle loading phrases for immersive feeling
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    } else {
      setLoadingTextIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Fetch initial guide on mount
  useEffect(() => {
    fetchGuide();
  }, [selectedMedId, useCustom, medicines.length]);

  const fetchGuide = async (isManualSubmit = false) => {
    let medName = "";
    if (useCustom) {
      if (!customName.trim()) {
        if (isManualSubmit && showToast) {
          showToast("Please write a custom medicine name.", "error");
        }
        return;
      }
      medName = customName.trim();
    } else {
      if (medicines.length === 0) {
        return;
      }
      const selectedMed = medicines.find((m) => m.id === selectedMedId);
      medName = selectedMed ? selectedMed.name : "Crocin Advance 650mg";
    }

    setLoading(true);
    try {
      const res = await api.getMedicationGuide(medName);
      if (res && !res.error) {
        setGuide(res);
        if (showToast) showToast(`Generated safe guide for ${medName}`, "success");
      } else {
        throw new Error(res?.error || "Unable to load guide documentation.");
      }
    } catch (err: any) {
      console.error(err);
      if (showToast) showToast(err.message || "Failed to contact pharmacist module.", "error");
    } finally {
      setLoading(false);
    }
  };

  const getRiskStyles = (risk: string) => {
    switch (risk) {
      case "High":
        return "bg-rose-50 text-rose-700 border-rose-250 font-black text-xs px-2.5 py-1 rounded-full uppercase tracking-wider";
      case "Moderate":
        return "bg-amber-50 text-amber-700 border-amber-200 font-extrabold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider";
    }
  };

  return (
    <div id="ai-medication-guide" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
      {/* Header section with branding */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Core Pharmacist AI
            </span>
          </div>
          <h3 className="text-base font-black text-slate-900 tracking-tight">AI Medication Guidance Desk</h3>
          <p className="text-xs text-slate-500 font-medium">
            Clinical advisory tool analyzing daily dosing instructions and regional dietary/liquid constraints.
          </p>
        </div>
      </div>

      {/* Selector workspace */}
      <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setUseCustom(false);
              // Trigger auto reload on toggle
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
              !useCustom 
                ? "bg-white text-slate-950 border-slate-250 shadow-sm font-black" 
                : "text-slate-500 hover:text-slate-950 bg-transparent border-transparent"
            }`}
          >
            Express Catalog Items
          </button>
          <button
            onClick={() => {
              setUseCustom(true);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
              useCustom 
                ? "bg-white text-slate-950 border-slate-250 shadow-sm font-black" 
                : "text-slate-500 hover:text-slate-950 bg-transparent border-transparent"
            }`}
          >
            Custom/Outside Drug
          </button>
        </div>

        {!useCustom ? (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Select Medicine Product</label>
            <div className="relative">
              <select
                value={selectedMedId}
                onChange={(e) => setSelectedMedId(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl p-3 pr-10 focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none shadow-sm cursor-pointer"
              >
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.category})
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Write Medicine Name & Strengths</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g., Combiflam, Metformin 500mg, Pantocid 40mg..."
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl p-3 pl-9.5 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fetchGuide(true);
                  }}
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
              </div>
            </div>
            <button
              onClick={() => fetchGuide(true)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-950 font-black text-xs rounded-xl shadow active:scale-95 transition-all text-center cursor-pointer flex justify-center items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Analyze Custom Compound
            </button>
          </div>
        )}
      </div>

      {/* Guide details panel */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="py-16 flex flex-col items-center justify-center space-y-4"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-indigo-600 scale-90">
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-black text-slate-850 animate-pulse">Consulting AI Pharmacist Core...</p>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight font-medium max-w-xs">{LOADING_MESSAGES[loadingTextIndex]}</p>
            </div>
          </motion.div>
        ) : guide ? (
          <motion.div
            key="content"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Safe Advisory Banner */}
            <div className="p-5 bg-gradient-to-br from-indigo-50/60 to-slate-50/40 border border-slate-200 rounded-2xl flex items-start gap-4 shadow-sm">
              <div className="p-2.5 bg-blue-500 rounded-xl text-white shrink-0 shadow-md">
                <BookOpen className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-1 text-xs">
                <span className="font-mono text-[9px] font-black text-blue-600 uppercase tracking-widest block">Clinical Safety Monograph</span>
                <h4 className="text-slate-900 font-extrabold text-sm">{guide.name}</h4>
                <p className="text-slate-500 leading-relaxed font-semibold">{guide.purpose}</p>
              </div>
            </div>

            {/* Dosages Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 bg-lime-50/30 border border-slate-150 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Standard Intake Dose</span>
                </div>
                <p className="text-xs text-slate-800 font-bold leading-normal">{guide.dosage.standard}</p>
              </div>

              <div className="p-4 bg-orange-50/30 border border-slate-150 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Crucial Maximum Limits</span>
                </div>
                <p className="text-xs text-slate-850 font-bold leading-normal">{guide.dosage.maximum}</p>
              </div>
            </div>

            {/* Administration Guide */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-1">Administration Ingestion Checklist</h4>
              <div className="grid gap-2">
                {guide.instructions.map((inst, index) => (
                  <div key={index} className="flex gap-3 p-3 bg-slate-50/60 border border-slate-100 rounded-xl items-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs text-slate-700 font-bold leading-relaxed">{inst}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Local Diet Interactions Table */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pl-1">
                <Utensils className="h-4.5 w-4.5 text-slate-700 shrink-0" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Regional Food & Beverage Safe-Zones</h4>
              </div>
              <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-55 border-b border-slate-150 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <th className="p-3 pl-4">Regional Item</th>
                      <th className="p-3">Risk Level</th>
                      <th className="p-3 pr-4">Physiological Interaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guide.localFoodInteractions.map((item, index) => (
                      <tr key={index} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-all">
                        <td className="p-3 pl-4 font-extrabold text-xs text-slate-850 font-sans">{item.item}</td>
                        <td className="p-3">
                          <span className={getRiskStyles(item.risk)}>{item.risk}</span>
                        </td>
                        <td className="p-3 pr-4 text-[11px] text-slate-550 leading-relaxed font-semibold font-sans">{item.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Safety Warnings Panel */}
            <div className="p-5 bg-rose-50/40 border border-rose-200 rounded-2xl space-y-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                <span className="text-xs font-black text-rose-950 uppercase tracking-wider">Critical Pharmacist Precautions</span>
              </div>
              <ul className="space-y-2 list-none">
                {guide.safetyPrecautions.map((warn, index) => (
                  <li key={index} className="flex gap-2.5 items-start text-slate-700 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                    <span className="font-bold leading-normal text-slate-800">{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-450 font-semibold">
            Select a medicine or inputs above to fetch a guided analysis.
          </div>
        )}
      </AnimatePresence>

      {/* Clinical Disclaimer Disclaimer */}
      <div className="pt-4 border-t border-slate-150 flex items-start gap-2.5 text-[10px] text-slate-400 font-semibold leading-relaxed">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
        <p>
          <strong>Clinical Monograph Notice:</strong> Content rendered above is auto-collated by AI. Do not modify custom doses or halt ongoing prescriptions without formal consultation with your consulting physician specialist.
        </p>
      </div>
    </div>
  );
}
