import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Cpu, 
  Play, 
  RotateCcw, 
  Check, 
  Search, 
  Database, 
  Server, 
  Workflow, 
  Plus, 
  PlayCircle, 
  Code, 
  Terminal, 
  Activity, 
  UserPlus, 
  Brain,
  Layers,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Eye,
  Settings
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  Cell
} from "recharts";
import { useDeveloperStore, PatientTask, GanttSegment } from "../hooks/useDeveloperStore";
import { api } from "../utils/api";

export default function DeveloperHub({ isAppDarkMode = false }: { isAppDarkMode?: boolean }) {
  const {
    activeSubTab,
    setActiveSubTab,
    // Scheduler
    schedulerAlgo,
    setSchedulerAlgo,
    schedulerStatus,
    timeQuantum,
    setTimeQuantum,
    simulationSpeed,
    setSimulationSpeed,
    patients,
    setPatients,
    simulationLogs,
    addSimulationLog,
    ganttChart,
    avgWaitingTime,
    avgTurnaroundTime,
    resetScheduler,
    setSchedulerResults,
    // Trie
    trieSearchInput,
    setTrieSearchInput,
    trieNodesVisited,
    setTrieNodesVisited,
    // SOS Queue
    sosQueue,
    addToSosQueue,
    dequeueSosQueue,
    clearSosQueue,
    // AI Pipeline
    aiInputText,
    setAiInputText,
    aiPipelineStep,
    setAiPipelineStep,
    aiPipelineLogs,
    addAiPipelineLog,
    clearAiPipelineLogs
  } = useDeveloperStore();

  const [activeArchNode, setActiveArchNode] = useState<string>("frontend");
  const [schedulerLogsList, setSchedulerLogsList] = useState<string[]>([]);
  const [currentSimTime, setCurrentSimTime] = useState<number>(0);
  const [schedulerRunning, setSchedulerRunning] = useState<boolean>(false);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // New Patient Add States
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientSymptom, setNewPatientSymptom] = useState("");
  const [newPatientArrival, setNewPatientArrival] = useState(0);
  const [newPatientBurst, setNewPatientBurst] = useState(5);
  const [newPatientPriority, setNewPatientPriority] = useState<number>(2);

  // SOS Add States
  const [newSosName, setNewSosName] = useState("");
  const [newSosSymptom, setNewSosSymptom] = useState("");
  const [newSosPriority, setNewSosPriority] = useState<number>(2);

  // Clean scheduler logs helper
  const addLog = (msg: string) => {
    setSchedulerLogsList(prev => [...prev, `[Time ${currentSimTime}m] ${msg}`]);
    addSimulationLog(msg);
  };

  // -------------------------------------------------------------
  // OS Queue Scheduler Logic (FCFS, SJF, Round Robin)
  // -------------------------------------------------------------
  const handleStartSimulation = () => {
    if (schedulerRunning || schedulerStatus === "finished") return;
    setSchedulerRunning(true);
    useDeveloperStore.setState({ schedulerStatus: "running" });
    setSchedulerLogsList([`[Start] Initiating ${schedulerAlgo} OPD triaging queue...`]);

    const queuePatients = patients.map(p => ({ ...p, remainingTime: p.burstTime, waitingTime: 0, turnaroundTime: 0 }));
    let time = 0;
    const gantt: GanttSegment[] = [];
    const finished: PatientTask[] = [];
    let currentJob: PatientTask | null = null;
    let rrQueue: PatientTask[] = [];
    let timeSinceQuantumStart = 0;

    const tick = () => {
      // 1. Add arriving patients to active pool
      const arriving = queuePatients.filter(p => p.arrivalTime === time);
      arriving.forEach(p => {
        setSchedulerLogsList(prev => [...prev, `[Time ${time}m] 📥 Patient ${p.name} (${p.id}) arrived with burst time ${p.burstTime}m.`]);
        if (schedulerAlgo === "RR") {
          rrQueue.push(p);
        }
      });

      // 2. Select next patient if idle or switching
      if (schedulerAlgo === "FCFS") {
        if (!currentJob) {
          const ready = queuePatients.filter(p => p.arrivalTime <= time && (p.remainingTime ?? 0) > 0);
          if (ready.length > 0) {
            // Sort by arrival time
            ready.sort((a, b) => a.arrivalTime - b.arrivalTime);
            currentJob = ready[0];
            currentJob.startTime = time;
            setSchedulerLogsList(prev => [...prev, `[Time ${time}m] ⚡ Doctor consulting Patient ${currentJob?.name} (${currentJob?.id}).`]);
          }
        }
      } else if (schedulerAlgo === "SJF") {
        if (!currentJob) {
          const ready = queuePatients.filter(p => p.arrivalTime <= time && (p.remainingTime ?? 0) > 0);
          if (ready.length > 0) {
            // Sort by burst time (Shortest Job First)
            ready.sort((a, b) => (a.remainingTime ?? 0) - (b.remainingTime ?? 0));
            currentJob = ready[0];
            currentJob.startTime = time;
            setSchedulerLogsList(prev => [...prev, `[Time ${time}m] ⚡ Doctor consulting Patient ${currentJob?.name} (${currentJob?.id}) - shortest queue duration.`]);
          }
        }
      } else if (schedulerAlgo === "RR") {
        // RR Scheduler
        if (currentJob) {
          if ((currentJob.remainingTime ?? 0) <= 0) {
            // Finished
            currentJob = null;
            timeSinceQuantumStart = 0;
          } else if (timeSinceQuantumStart >= timeQuantum) {
            // Preempt current job
            setSchedulerLogsList(prev => [...prev, `[Time ${time}m] ⏳ Time quantum expired. Preempting Patient ${currentJob?.name} (${currentJob?.id}).`]);
            rrQueue.push(currentJob);
            currentJob = null;
            timeSinceQuantumStart = 0;
          }
        }

        if (!currentJob && rrQueue.length > 0) {
          currentJob = rrQueue.shift()!;
          if (currentJob.startTime === undefined) {
            currentJob.startTime = time;
          }
          setSchedulerLogsList(prev => [...prev, `[Time ${time}m] ⚡ Doctor consulting Patient ${currentJob?.name} (${currentJob?.id}) for quantum slot.`]);
        }
      }

      // 3. Execute tick
      if (currentJob) {
        gantt.push({
          patientId: currentJob.id,
          patientName: currentJob.name,
          start: time,
          end: time + 1
        });
        currentJob.remainingTime = (currentJob.remainingTime ?? 0) - 1;
        timeSinceQuantumStart++;

        // Add waiting times to other waiting patients
        queuePatients.forEach(p => {
          if (p.id !== currentJob?.id && p.arrivalTime <= time && (p.remainingTime ?? 0) > 0) {
            p.waitingTime = (p.waitingTime ?? 0) + 1;
          }
        });

        if (currentJob.remainingTime === 0) {
          currentJob.completedTime = time + 1;
          currentJob.turnaroundTime = currentJob.completedTime - currentJob.arrivalTime;
          currentJob.waitingTime = currentJob.turnaroundTime - currentJob.burstTime;
          finished.push(currentJob);
          setSchedulerLogsList(prev => [...prev, `[Time ${time + 1}m] ✅ Patient ${currentJob?.name} (${currentJob?.id}) consultation complete!`]);
          currentJob = null;
          timeSinceQuantumStart = 0;
        }
      } else {
        setSchedulerLogsList(prev => [...prev, `[Time ${time}m] 💤 Doctor core status: Idle. Awaiting emergency arrivals.`]);
      }

      time++;
      setCurrentSimTime(time);

      // Check if all patients are completed
      const activeOrPending = queuePatients.filter(p => (p.remainingTime ?? 0) > 0 || p.arrivalTime >= time);
      if (activeOrPending.length === 0 && !currentJob) {
        clearInterval(simIntervalRef.current!);
        setSchedulerRunning(false);

        // Calculate averages
        const avgW = queuePatients.reduce((sum, p) => sum + (p.waitingTime ?? 0), 0) / queuePatients.length;
        const avgT = queuePatients.reduce((sum, p) => sum + (p.turnaroundTime ?? 0), 0) / queuePatients.length;

        setSchedulerResults(gantt, parseFloat(avgW.toFixed(2)), parseFloat(avgT.toFixed(2)), queuePatients);
        setSchedulerLogsList(prev => [...prev, `[Simulation Complete] Average Waiting Time: ${avgW.toFixed(2)}m, Average Turnaround Time: ${avgT.toFixed(2)}m`]);
      }
    };

    simIntervalRef.current = setInterval(tick, simulationSpeed);
  };

  const handleResetSimulation = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
    }
    setSchedulerRunning(false);
    setCurrentSimTime(0);
    setSchedulerLogsList([]);
    resetScheduler();
  };

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const handleAddPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName || !newPatientSymptom) return;
    const newP: PatientTask = {
      id: `P${patients.length + 1}`,
      name: newPatientName,
      symptom: newPatientSymptom,
      arrivalTime: Number(newPatientArrival),
      burstTime: Number(newPatientBurst),
      priority: Number(newPatientPriority)
    };
    setPatients([...patients, newP]);
    setNewPatientName("");
    setNewPatientSymptom("");
  };

  // -------------------------------------------------------------
  // Trie Medicine Autocomplete Search Visualizer Logic
  // -------------------------------------------------------------
  // Sample pharmacy catalog
  const medicineCatalog = ["crocin", "combiflam", "allegra", "augmentin", "limcee", "glycomet", "ascoril", "atorva"];
  
  // Custom visual Trie structure builder
  const buildVisualTrie = () => {
    const root: any = { char: "*", children: {}, path: "" };
    medicineCatalog.forEach(med => {
      let curr = root;
      for (let i = 0; i < med.length; i++) {
        const char = med[i];
        if (!curr.children[char]) {
          curr.children[char] = { char, children: {}, path: curr.path + char };
        }
        curr = curr.children[char];
      }
      curr.isWord = true;
    });
    return root;
  };

  const trieRoot = buildVisualTrie();

  // Search input change handler
  const handleTrieInputChange = (val: string) => {
    setTrieSearchInput(val);
    const cleanVal = val.toLowerCase().trim();
    const visited: string[] = [];
    
    // Track the path taken in Trie
    let curr = trieRoot;
    visited.push("*");
    for (let i = 0; i < cleanVal.length; i++) {
      const char = cleanVal[i];
      if (curr.children[char]) {
        curr = curr.children[char];
        visited.push(curr.path);
      } else {
        break; // Diverges from Trie nodes
      }
    }
    setTrieNodesVisited(visited);
  };

  // -------------------------------------------------------------
  // Priority Queue Emergency SOS Heap Logic
  // -------------------------------------------------------------
  const handleAddSos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSosName || !newSosSymptom) return;
    const newItem = {
      id: `SOS-${Math.floor(100 + Math.random() * 900)}`,
      name: newSosName,
      priority: Number(newSosPriority),
      symptom: newSosSymptom
    };
    addToSosQueue(newItem);
    setNewSosName("");
    setNewSosSymptom("");
  };

  // -------------------------------------------------------------
  // AI Agentic Pipeline Simulation Logic
  // -------------------------------------------------------------
  const handleRunAiPipeline = () => {
    if (!aiInputText.trim()) return;
    clearAiPipelineLogs();
    setAiPipelineStep("intent");
    addAiPipelineLog("💡 Received query: " + aiInputText);

    setTimeout(() => {
      addAiPipelineLog("🔍 Executing Intent Recognition parser...");
      addAiPipelineLog("🎯 Intent recognized: 'DOCTOR_CONSULT_SEARCH' | Category: 'Pulmonology/Respiratory' | Smog Alert Level: HIGH.");
      setAiPipelineStep("planning");

      setTimeout(() => {
        addAiPipelineLog("📋 Formulating multi-step execution plan...");
        addAiPipelineLog("📝 Step 1: Query local hospital bed occupancy databases.");
        addAiPipelineLog("📝 Step 2: Fetch active online doctors matching 'Pulmonologist'.");
        addAiPipelineLog("📝 Step 3: Fetch real-time AQI and smog recovery safety advisory.");
        setAiPipelineStep("execution");

        setTimeout(() => {
          addAiPipelineLog("⚡ Executing plan steps...");
          addAiPipelineLog("🔗 Fetching Firebase collection: /doctors where specialty == 'Pulmonologist'. Found: Dr. Naresh Trehan (Online).");
          addAiPipelineLog("🤖 Running Gemini prompt engineering refinement...");
          setAiPipelineStep("done");
          addAiPipelineLog("❇️ Pipeline successfully generated structured response card!");
        }, 1200);
      }, 1000);
    }, 800);
  };

  // Recharts custom charts data
  const chartData = patients.map(p => ({
    name: p.id,
    waitingTime: p.waitingTime ?? 0,
    turnaroundTime: p.turnaroundTime ?? 0,
    burstTime: p.burstTime
  }));

  // Render Trie Node helper function (Recursive)
  const renderTrieNodes = (node: any, level = 0): React.ReactNode => {
    const isNodeActive = trieNodesVisited.includes(node.path || "*");
    const hasChildren = Object.keys(node.children).length > 0;
    
    return (
      <div key={node.path || "root"} className="flex flex-col items-center mx-1">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
          isNodeActive 
            ? "bg-indigo-500 text-white border-indigo-400 shadow-md shadow-indigo-500/25 scale-110" 
            : isAppDarkMode 
              ? "bg-slate-900 border-slate-800 text-slate-400" 
              : "bg-slate-50 border-slate-200 text-slate-600"
        }`}>
          {node.char}
        </div>
        {hasChildren && (
          <div className="flex justify-center mt-3 border-t border-slate-200 dark:border-slate-800 pt-3 relative">
            {Object.keys(node.children).map(char => 
              renderTrieNodes(node.children[char], level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in font-sans">
      {/* Top Banner and Navigation */}
      <div className={`p-6 rounded-3xl border transition-all ${
        isAppDarkMode ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      } flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`p-1 px-2.5 rounded font-mono text-[9px] font-bold uppercase tracking-widest ${
              isAppDarkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-blue-50 text-blue-600"
            }`}>
              Engineering Console & Sandbox
            </span>
            <span className="text-[10px] text-slate-400">• Full-Stack Capabilities Sandbox</span>
          </div>
          <h3 className={`text-xl font-black tracking-tight ${isAppDarkMode ? "text-white" : "text-slate-950"}`}>
            Developer Portfolio Hub
          </h3>
          <p className={`text-xs ${isAppDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Explore live interactive implementations demonstrating core CS algorithms, visual data structures, AI intent-to-execution pipelines, and state management.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className={`p-1 rounded-2xl flex flex-wrap gap-1 ${
          isAppDarkMode ? "bg-slate-900" : "bg-slate-100"
        }`}>
          {[
            { id: "architecture", label: "Architecture", icon: Layers },
            { id: "scheduler", label: "OPD Scheduler", icon: Activity },
            { id: "datastructures", label: "Data Structures", icon: Brain },
            { id: "aipipeline", label: "AI Agent Pipeline", icon: Sparkles },
            { id: "state", label: "Zustand State", icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? (isAppDarkMode ? "bg-indigo-600 text-white" : "bg-white text-slate-900 shadow-xs")
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Sandbox Area */}
      <div className="transition-all duration-300">
        {/* SUBTAB 1: ARCHITECTURE NODE MAP */}
        {activeSubTab === "architecture" && (
          <div className={`p-6 rounded-3xl border ${
            isAppDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          } space-y-6`}>
            <div>
              <h4 className={`text-md font-black flex items-center gap-2 ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                <Layers className="h-5 w-5 text-indigo-500" /> Interactive Platform Architecture Map
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Visual representation of City Healer's full stack data flows. Click nodes to trace their roles, framework APIs, and databases.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Architecture Node Schema (Left) */}
              <div className="lg:col-span-2 relative min-h-[350px] bg-slate-950 rounded-3xl border border-slate-850 p-6 flex flex-col justify-between overflow-hidden">
                {/* Custom SVG Connector Lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <path d="M 120 100 L 260 100" stroke="#4f46e5" strokeWidth="2" strokeDasharray="5,5" className="animate-[dash_2s_linear_infinite]" />
                  <path d="M 120 180 L 260 180" stroke="#4f46e5" strokeWidth="2" strokeDasharray="5,5" />
                  <path d="M 380 140 L 520 80" stroke="#10b981" strokeWidth="2" strokeDasharray="3,3" />
                  <path d="M 380 140 L 520 220" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3,3" />
                </svg>

                <style>{`
                  @keyframes dash {
                    to {
                      stroke-dashoffset: -20;
                    }
                  }
                `}</style>

                {/* Node Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full relative z-10 my-auto">
                  {/* Column 1: Client Front */}
                  <div className="flex flex-col justify-center space-y-8">
                    <button
                      onClick={() => setActiveArchNode("frontend")}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                        activeArchNode === "frontend" 
                          ? "bg-blue-950/60 border-blue-500 shadow-md shadow-blue-500/20 scale-105" 
                          : "bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl w-fit mb-2">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <p className="text-white text-xs font-black">React 18 & Vite Client</p>
                      <p className="text-[10px] text-slate-400 mt-1">Tailwind CSS & Zustand state controller.</p>
                    </button>
                  </div>

                  {/* Column 2: Middleware / Server */}
                  <div className="flex flex-col justify-center space-y-8">
                    <button
                      onClick={() => setActiveArchNode("backend")}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                        activeArchNode === "backend" 
                          ? "bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-500/20 scale-105" 
                          : "bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-2">
                        <Server className="h-5 w-5" />
                      </div>
                      <p className="text-white text-xs font-black">Express Node Framework</p>
                      <p className="text-[10px] text-slate-400 mt-1">Server routing, Firebase authentication middleware.</p>
                    </button>
                  </div>

                  {/* Column 3: Cloud & Databases */}
                  <div className="flex flex-col justify-center space-y-6">
                    <button
                      onClick={() => setActiveArchNode("ai")}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                        activeArchNode === "ai" 
                          ? "bg-emerald-950/60 border-emerald-500 shadow-md shadow-emerald-500/20 scale-105" 
                          : "bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-2">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <p className="text-white text-xs font-black">Gemini 2.5 Flash SDK</p>
                      <p className="text-[10px] text-slate-400 mt-1">Pathology diagnostics & Indian diet advisor scheduler.</p>
                    </button>

                    <button
                      onClick={() => setActiveArchNode("database")}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                        activeArchNode === "database" 
                          ? "bg-amber-950/60 border-amber-500 shadow-md shadow-amber-500/20 scale-105" 
                          : "bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl w-fit mb-2">
                        <Database className="h-5 w-5" />
                      </div>
                      <p className="text-white text-xs font-black">Cloud Firestore DB</p>
                      <p className="text-[10px] text-slate-400 mt-1">Secure real-time patient census records.</p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Node Explainer (Right) */}
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {activeArchNode === "frontend" && (
                    <motion.div
                      key="frontend"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`p-5 rounded-3xl border h-full flex flex-col justify-between ${
                        isAppDarkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-blue-500 font-extrabold text-sm uppercase">
                          <Smartphone className="h-4 w-4" /> Client-Side Specs
                        </div>
                        <h5 className="text-sm font-black mt-1">React 18 & Framer Motion UI</h5>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          The client layout represents a modern Single Page Application (SPA) driven by Vite's hot-reload bundler. Built with Tailwind CSS utilities and custom GSAP/Lenis smooth scrolling parameters.
                        </p>
                        <div className="pt-2 space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Frontend Skill Integrations:</p>
                          <ul className="text-xs text-slate-650 space-y-1 list-disc pl-4">
                            <li><strong>Framer Motion:</strong> Drives fluid PageTransitions.</li>
                            <li><strong>Zustand:</strong> Dynamic client-side global state store.</li>
                            <li><strong>Recharts:</strong> Renders demographic medical trend charts.</li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeArchNode === "backend" && (
                    <motion.div
                      key="backend"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`p-5 rounded-3xl border h-full flex flex-col justify-between ${
                        isAppDarkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-indigo-500 font-extrabold text-sm uppercase">
                          <Server className="h-4 w-4" /> Middleware Specs
                        </div>
                        <h5 className="text-sm font-black mt-1">Express Server Core API</h5>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Serves as the gateway for secure operations. Includes Firebase JWT session authentication middleware that intercepts client tokens and extracts patient UIDs for secure Firestore calls.
                        </p>
                        <div className="pt-2 space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Backend Skill Integrations:</p>
                          <ul className="text-xs text-slate-650 space-y-1 list-disc pl-4">
                            <li><strong>Firebase Admin SDK:</strong> Secure verification check.</li>
                            <li><strong>Express Router:</strong> Pathology and diet endpoints.</li>
                            <li><strong>JWT Security:</strong> Client verification logic block.</li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeArchNode === "ai" && (
                    <motion.div
                      key="ai"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`p-5 rounded-3xl border h-full flex flex-col justify-between ${
                        isAppDarkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-500 font-extrabold text-sm uppercase">
                          <Sparkles className="h-4 w-4" /> AI Layer Specs
                        </div>
                        <h5 className="text-sm font-black mt-1">Gemini 2.5 Flash SDK Integration</h5>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Powers smart clinical services. Communicates with Google's GenAI model using precise system guidelines to output structured medical advice and pathological analyses.
                        </p>
                        <div className="pt-2 space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">AI Skill Integrations:</p>
                          <ul className="text-xs text-slate-650 space-y-1 list-disc pl-4">
                            <li><strong>Google @google/genai:</strong> Core API SDK client.</li>
                            <li><strong>Intent Recognizer:</strong> Context-aware prompt routing.</li>
                            <li><strong>Ayurvedic Diet Planner:</strong> Curates clinical meal tables.</li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeArchNode === "database" && (
                    <motion.div
                      key="database"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`p-5 rounded-3xl border h-full flex flex-col justify-between ${
                        isAppDarkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-amber-500 font-extrabold text-sm uppercase">
                          <Database className="h-4 w-4" /> Database Specs
                        </div>
                        <h5 className="text-sm font-black mt-1">Cloud Firestore Database</h5>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Serves as the secure data persistence engine. Access is protected by rule layers matching patient UIDs, enforcing field structures, and preventing diagnostic record tampering.
                        </p>
                        <div className="pt-2 space-y-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">DB Skill Integrations:</p>
                          <ul className="text-xs text-slate-650 space-y-1 list-disc pl-4">
                            <li><strong>Zero-Trust Rules:</strong> Implements 14 strict rules.</li>
                            <li><strong>Relational Checkups:</strong> Triggers check constraints on patient UIDs.</li>
                            <li><strong>Audit Trail Schema:</strong> Denies medical record deletion.</li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: OS PATIENT OPD SCHEDULER SIMULATOR */}
        {activeSubTab === "scheduler" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Scheduler Panel (Left - Span 7) */}
            <div className={`lg:col-span-7 p-6 rounded-3xl border ${
              isAppDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            } space-y-6`}>
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h4 className={`text-md font-black flex items-center gap-2 ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                    <Activity className="h-5 w-5 text-indigo-500 animate-pulse" /> OPD Queue Scheduler Simulator
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Trages patients to doctor consultation slots using OS scheduling algorithms.
                  </p>
                </div>

                <div className="flex gap-2">
                  {(["FCFS", "SJF", "RR"] as const).map(algo => (
                    <button
                      key={algo}
                      disabled={schedulerRunning}
                      onClick={() => setSchedulerAlgo(algo)}
                      className={`px-3 py-1.5 text-xs font-black rounded-lg cursor-pointer transition-all ${
                        schedulerAlgo === algo 
                          ? "bg-indigo-650 text-white shadow-xs" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-550 hover:bg-slate-200"
                      }`}
                    >
                      {algo}
                    </button>
                  ))}
                </div>
              </div>

              {/* RR Controls */}
              {schedulerAlgo === "RR" && (
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-150 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500">RR Time Quantum (Minutes):</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    disabled={schedulerRunning}
                    value={timeQuantum}
                    onChange={(e) => setTimeQuantum(Number(e.target.value))}
                    className="w-16 p-1 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-800 text-center font-extrabold focus:outline-none"
                  />
                </div>
              )}

              {/* Simulation Controls */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-500">Clock Tick Speed:</span>
                  <select 
                    value={simulationSpeed} 
                    onChange={e => setSimulationSpeed(Number(e.target.value))}
                    disabled={schedulerRunning}
                    className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-1 rounded font-extrabold text-xs"
                  >
                    <option value="800">Slow (800ms)</option>
                    <option value="400">Normal (400ms)</option>
                    <option value="150">Fast (150ms)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {schedulerStatus === "idle" || schedulerStatus === "running" ? (
                    <button
                      onClick={handleStartSimulation}
                      disabled={schedulerRunning}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" /> Start Sim
                    </button>
                  ) : null}

                  <button
                    onClick={handleResetSimulation}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                </div>
              </div>

              {/* Active Queue Table */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase text-slate-400">Simulated OPD Patient Registry</p>
                <div className="overflow-x-auto rounded-2xl border dark:border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 uppercase tracking-widest text-[9px]">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Patient</th>
                        <th className="p-3">Symptom</th>
                        <th className="p-3 text-center">Arrival</th>
                        <th className="p-3 text-center">Burst (Min)</th>
                        <th className="p-3 text-center">Priority</th>
                        <th className="p-3 text-center">Wait</th>
                        <th className="p-3 text-center">Turnaround</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {patients.map(p => (
                        <tr key={p.id} className={`${
                          p.remainingTime === 0 
                            ? "bg-slate-50/50 dark:bg-slate-950/20 opacity-60" 
                            : "hover:bg-slate-50/20"
                        }`}>
                          <td className="p-3 font-mono font-bold text-slate-400">{p.id}</td>
                          <td className="p-3 font-black">{p.name}</td>
                          <td className="p-3 text-slate-500">{p.symptom}</td>
                          <td className="p-3 text-center font-semibold">{p.arrivalTime}m</td>
                          <td className="p-3 text-center font-extrabold">{p.burstTime}m</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              p.priority === 1 
                                ? "bg-rose-50 text-rose-700" 
                                : p.priority === 2 
                                  ? "bg-amber-50 text-amber-700" 
                                  : "bg-emerald-50 text-emerald-700"
                            }`}>
                              {p.priority === 1 ? "Critical" : p.priority === 2 ? "Urgent" : "Routine"}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-indigo-500">{p.waitingTime ?? "-"}m</td>
                          <td className="p-3 text-center font-bold text-emerald-500">{p.turnaroundTime ?? "-"}m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Patient Form */}
              <form onSubmit={handleAddPatient} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 border dark:border-slate-800 rounded-2xl">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Patient Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Adesh Kumar"
                    value={newPatientName}
                    onChange={e => setNewPatientName(e.target.value)}
                    className="w-full p-2 border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Symptom</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chest Congestion"
                    value={newPatientSymptom}
                    onChange={e => setNewPatientSymptom(e.target.value)}
                    className="w-full p-2 border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Arrival (m)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPatientArrival}
                    onChange={e => setNewPatientArrival(Number(e.target.value))}
                    className="w-full p-2 border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Burst (m)</label>
                  <input
                    type="number"
                    min="1"
                    value={newPatientBurst}
                    onChange={e => setNewPatientBurst(Number(e.target.value))}
                    className="w-full p-2 border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-indigo-650 hover:bg-indigo-700 text-white p-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer transition-all"
                  >
                    <UserPlus className="h-4 w-4" /> Add Patient
                  </button>
                </div>
              </form>
            </div>

            {/* Simulation Dashboard Panel (Right - Span 5) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Gantt Live Timeline Visualizer */}
              <div className={`p-6 rounded-3xl border ${
                isAppDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              } space-y-4`}>
                <h5 className="text-xs font-black uppercase text-slate-450 tracking-widest border-b border-slate-100 dark:border-slate-850 pb-2">
                  OPD Timeline / Gantt Chart
                </h5>

                <div className="space-y-3 min-h-[140px] flex flex-col justify-center">
                  {ganttChart.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center italic font-semibold">
                      Start simulation to track live allocation.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1 p-2 bg-slate-950 rounded-2xl border border-slate-850 overflow-x-auto">
                        {ganttChart.map((seg, idx) => (
                          <div 
                            key={idx} 
                            title={`Patient: ${seg.patientName} (${seg.patientId}) Time: ${seg.start}m-${seg.end}m`}
                            className="h-8 min-w-[20px] flex-1 bg-indigo-600 hover:bg-indigo-500 rounded border border-indigo-400 flex items-center justify-center text-[9px] text-white font-extrabold shadow-sm"
                          >
                            {seg.patientId}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold font-mono px-1">
                        <span>Time: 0m</span>
                        <span>Current: {currentSimTime}m</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Simulation Statistics & Analytics Graph */}
              <div className={`p-6 rounded-3xl border ${
                isAppDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              } space-y-4`}>
                <h5 className="text-xs font-black uppercase text-slate-450 tracking-widest border-b border-slate-100 dark:border-slate-850 pb-2">
                  Scheduling Metrics Analytics
                </h5>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 border dark:border-slate-850 rounded-2xl text-center space-y-1">
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-wide">Avg Waiting Time</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{avgWaitingTime}m</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 border dark:border-slate-850 rounded-2xl text-center space-y-1">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wide">Avg Turnaround</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{avgTurnaroundTime}m</p>
                  </div>
                </div>

                {schedulerStatus === "finished" && (
                  <div className="h-[160px] pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: "10px", borderRadius: "10px" }} />
                        <Legend wrapperStyle={{ fontSize: "9px" }} />
                        <Bar name="Wait Time" dataKey="waitingTime" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        <Bar name="Turnaround" dataKey="turnaroundTime" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Console Logs */}
              <div className={`p-6 rounded-3xl border flex flex-col h-[200px] ${
                isAppDarkMode ? "bg-slate-950 border-slate-850" : "bg-slate-950 border-slate-900"
              }`}>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-extrabold uppercase border-b border-slate-800 pb-2 mb-2 shrink-0">
                  <Terminal className="h-4 w-4" /> Live Scheduler Log Terminal
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1">
                  {schedulerLogsList.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  {schedulerLogsList.length === 0 && (
                    <div className="text-slate-500 italic">Waiting for simulation execution...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: INTERACTIVE DATA STRUCTURES */}
        {activeSubTab === "datastructures" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            {/* Section Left: Trie Autocomplete medicine search tree */}
            <div className={`p-6 rounded-3xl border ${
              isAppDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            } space-y-6`}>
              <div>
                <h4 className={`text-md font-black flex items-center gap-2 ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                  <Brain className="h-5 w-5 text-indigo-500" /> Trie Data Structure medicine Autocomplete
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Type medicine keywords and watch the prefix tree lookup nodes light up character-by-character.
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search: crocin, combiflam, allegra, augmentin, limcee..."
                    value={trieSearchInput}
                    onChange={e => handleTrieInputChange(e.target.value)}
                    className="w-full pl-9 p-2 border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl"
                  />
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-2xl flex flex-col items-center overflow-x-auto min-h-[220px] justify-center">
                  <div className="flex flex-col items-center">
                    {renderTrieNodes(trieRoot)}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl text-[10px] text-slate-550 border dark:border-slate-850 space-y-1">
                  <p className="font-bold text-slate-400 uppercase">Trie Tracer Output Logs:</p>
                  <p className="font-mono font-extrabold text-indigo-500">
                    Visited path: {trieNodesVisited.join(" ➔ ")}
                  </p>
                  <p className="font-semibold">
                    Matching dictionary entries: {medicineCatalog.filter(m => m.startsWith(trieSearchInput.toLowerCase())).join(", ") || "None"}
                  </p>
                </div>
              </div>
            </div>

            {/* Section Right: SOS Priority Queue heap tracker */}
            <div className={`p-6 rounded-3xl border ${
              isAppDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            } space-y-6`}>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h4 className={`text-md font-black flex items-center gap-2 ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                    <Layers className="h-5 w-5 text-indigo-500" /> SOS Priority Queue Heap Tracker
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Sorts incoming emergency alarms. Critical alerts are prioritized at the top of the dispatcher heap.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={dequeueSosQueue}
                  disabled={sosQueue.length === 0}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  🚑 Dispatch Top SOS
                </button>
              </div>

              {/* Dynamic Queue Stack representation */}
              <div className="space-y-4">
                <div className="space-y-3 min-h-[220px] flex flex-col justify-center p-4 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-3xl">
                  {sosQueue.length === 0 ? (
                    <p className="text-xs text-slate-450 italic text-center font-semibold">
                      SOS Queue is empty. Trigger alarms below.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {sosQueue.map((item, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`p-3 border rounded-2xl flex items-center justify-between transition-all ${
                              index === 0 
                                ? "bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 text-rose-950" 
                                : isAppDarkMode 
                                  ? "bg-slate-900 border-slate-800 text-slate-350" 
                                  : "bg-white border-slate-150 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded font-black text-slate-500">
                                Heap Pos #{index + 1}
                              </span>
                              <div>
                                <p className="text-xs font-black">{item.name} ({item.id})</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{item.symptom}</p>
                              </div>
                            </div>

                            <span className={`text-[10px] font-black px-2 py-1 rounded ${
                              item.priority === 1 
                                ? "bg-rose-100 text-rose-800" 
                                : item.priority === 2 
                                  ? "bg-amber-100 text-amber-800" 
                                  : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {item.priority === 1 ? "Priority 1: Critical" : item.priority === 2 ? "Priority 2: Urgent" : "Priority 3: Minor"}
                            </span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Add SOS Trigger Form */}
                <form onSubmit={handleAddSos} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 p-4 rounded-2xl">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Patient</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bob Smith"
                      value={newSosName}
                      onChange={e => setNewSosName(e.target.value)}
                      className="w-full p-2 border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Incident</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Heart Palpitations"
                      value={newSosSymptom}
                      onChange={e => setNewSosSymptom(e.target.value)}
                      className="w-full p-2 border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Severity Level</label>
                    <select
                      value={newSosPriority}
                      onChange={e => setNewSosPriority(Number(e.target.value))}
                      className="w-full p-2 border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl"
                    >
                      <option value="1">Priority 1 (Critical)</option>
                      <option value="2">Priority 2 (Urgent)</option>
                      <option value="3">Priority 3 (Minor)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white p-2.5 rounded-xl text-xs font-black cursor-pointer transition-all"
                    >
                      ⚡ SOS Alert Trigger
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 4: AI AGENT PIPELINE */}
        {activeSubTab === "aipipeline" && (
          <div className={`p-6 rounded-3xl border ${
            isAppDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          } space-y-6 animate-fade-in`}>
            <div>
              <h4 className={`text-md font-black flex items-center gap-2 ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                <Sparkles className="h-5 w-5 text-indigo-500" /> AI Intent-to-Execution Agentic Pipeline
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Visualizes the flow: User Query ➔ Intent Recognition ➔ Execution Plan ➔ Structured Diagnostic Result.
              </p>
            </div>

            {/* Input query box */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Ask something like: Recommend an asthma diet chart for Veg preference..."
                  value={aiInputText}
                  onChange={e => setAiInputText(e.target.value)}
                  className="flex-1 p-3 border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleRunAiPipeline}
                  className="px-5 py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <PlayCircle className="h-4 w-4" /> Run Pipeline
                </button>
              </div>

              {/* Visual Pipeline Steps */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                {[
                  { 
                    id: "intent", 
                    label: "1. Intent Recognition", 
                    desc: "Parses user context and categorizes queries (Consultation vs. Diet vs. SOS).",
                    color: "border-blue-300 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/10 text-blue-500"
                  },
                  { 
                    id: "planning", 
                    label: "2. Planner Formulation", 
                    desc: "Decides which APIs, catalogs, and databases need query lookups.",
                    color: "border-purple-300 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/10 text-purple-500"
                  },
                  { 
                    id: "execution", 
                    label: "3. Service Execution", 
                    desc: "Pulls Firestore entries, AQI data, and constructs localized prompts.",
                    color: "border-amber-300 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/10 text-amber-500"
                  },
                  { 
                    id: "done", 
                    label: "4. Structured Output", 
                    desc: "Formats structured JSON matching specific pharmacological validation schemas.",
                    color: "border-emerald-300 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10 text-emerald-500"
                  }
                ].map(step => {
                  const isActive = aiPipelineStep === step.id || 
                    (step.id === "intent" && aiPipelineStep !== "idle") ||
                    (step.id === "planning" && (aiPipelineStep === "planning" || aiPipelineStep === "execution" || aiPipelineStep === "done")) ||
                    (step.id === "execution" && (aiPipelineStep === "execution" || aiPipelineStep === "done")) ||
                    (step.id === "done" && aiPipelineStep === "done");

                  return (
                    <div 
                      key={step.id} 
                      className={`p-4 border rounded-2xl space-y-2 transition-all duration-300 ${
                        isActive 
                          ? `${step.color} shadow-sm border-2 scale-102` 
                          : "border-slate-200 dark:border-slate-800 opacity-40 bg-transparent"
                      }`}
                    >
                      <p className="text-xs font-black">{step.label}</p>
                      <p className="text-[10px] text-slate-500 leading-normal">{step.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Console Logs */}
              <div className="bg-slate-950 border border-slate-900 p-5 rounded-3xl flex flex-col h-[200px]">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-extrabold uppercase border-b border-slate-800 pb-2 mb-2">
                  <Terminal className="h-4 w-4" /> Live AI Agent Log Output
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1.5">
                  {aiPipelineLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  {aiPipelineLogs.length === 0 && (
                    <div className="text-slate-500 italic">Enter a query above and trigger the AI pipeline execution console.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 5: ZUSTAND STATE INSPECTOR */}
        {activeSubTab === "state" && (
          <div className={`p-6 rounded-3xl border ${
            isAppDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          } space-y-6 animate-fade-in`}>
            <div>
              <h4 className={`text-md font-black flex items-center gap-2 ${isAppDarkMode ? "text-white" : "text-slate-900"}`}>
                <Code className="h-5 w-5 text-indigo-500" /> Zustand Global State Inspector
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Visualizes active state variables managed globally in City Healer's reactive Zustand store hook.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-900 p-5 rounded-3xl font-mono text-[11px] text-blue-400 overflow-x-auto">
              <span className="text-[10px] text-slate-450 uppercase tracking-widest block border-b border-slate-800 pb-2 mb-3">
                // Live Reactive Store Dump
              </span>
              <pre className="leading-relaxed">
                {JSON.stringify({
                  activeSubTab,
                  schedulerAlgo,
                  schedulerStatus,
                  timeQuantum,
                  simulationSpeed,
                  patientsCount: patients.length,
                  trieSearchInput,
                  visitedTrieNodes: trieNodesVisited,
                  sosQueueCount: sosQueue.length,
                  sosQueueList: sosQueue.map(item => ({ id: item.id, name: item.name, p: item.priority })),
                  aiPipelineStep,
                  aiPipelineLogsCount: aiPipelineLogs.length
                }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
