import { create } from "zustand";

export interface PatientTask {
  id: string;
  name: string;
  symptom: string;
  arrivalTime: number;
  burstTime: number; // simulated minutes
  priority: number;  // 1 = High, 2 = Medium, 3 = Low
  remainingTime?: number;
  completedTime?: number;
  waitingTime?: number;
  turnaroundTime?: number;
  startTime?: number;
}

export interface GanttSegment {
  patientId: string;
  patientName: string;
  start: number;
  end: number;
}

interface DeveloperStore {
  // Navigation
  activeSubTab: "architecture" | "scheduler" | "datastructures" | "aipipeline" | "state";
  setActiveSubTab: (tab: "architecture" | "scheduler" | "datastructures" | "aipipeline" | "state") => void;

  // OS Scheduler Simulation State
  schedulerAlgo: "FCFS" | "RR" | "SJF";
  setSchedulerAlgo: (algo: "FCFS" | "RR" | "SJF") => void;
  schedulerStatus: "idle" | "running" | "finished";
  timeQuantum: number;
  setTimeQuantum: (q: number) => void;
  simulationSpeed: number; // milliseconds per simulated tick
  setSimulationSpeed: (speed: number) => void;
  patients: PatientTask[];
  setPatients: (patients: PatientTask[]) => void;
  simulationLogs: string[];
  addSimulationLog: (log: string) => void;
  ganttChart: GanttSegment[];
  avgWaitingTime: number;
  avgTurnaroundTime: number;
  resetScheduler: () => void;
  setSchedulerResults: (gantt: GanttSegment[], avgWait: number, avgTurnaround: number, updatedPatients: PatientTask[]) => void;

  // Trie Autocomplete state
  trieSearchInput: string;
  setTrieSearchInput: (input: string) => void;
  trieNodesVisited: string[];
  setTrieNodesVisited: (nodes: string[]) => void;

  // Priority Queue SOS state
  sosQueue: { id: string; name: string; priority: number; symptom: string }[];
  addToSosQueue: (item: { id: string; name: string; priority: number; symptom: string }) => void;
  dequeueSosQueue: () => void;
  clearSosQueue: () => void;

  // AI Pipeline state
  aiInputText: string;
  setAiInputText: (text: string) => void;
  aiPipelineStep: "idle" | "intent" | "planning" | "execution" | "done";
  setAiPipelineStep: (step: "idle" | "intent" | "planning" | "execution" | "done") => void;
  aiPipelineLogs: string[];
  addAiPipelineLog: (log: string) => void;
  clearAiPipelineLogs: () => void;
}

const INITIAL_PATIENTS: PatientTask[] = [
  { id: "P1", name: "Ramesh Kumar", symptom: "Acute Dyspnea (Asthma)", arrivalTime: 0, burstTime: 8, priority: 1 },
  { id: "P2", name: "Aisha Patel", symptom: "High Fever & Chills", arrivalTime: 2, burstTime: 4, priority: 2 },
  { id: "P3", name: "Joseph Masih", symptom: "Severe Abdominal Pain", arrivalTime: 4, burstTime: 6, priority: 2 },
  { id: "P4", name: "Siddharth Sen", symptom: "Mild Cough (Smog)", arrivalTime: 6, burstTime: 3, priority: 3 },
  { id: "P5", name: "Gurpreet Kaur", symptom: "Cardiovascular Checkup", arrivalTime: 8, burstTime: 5, priority: 1 },
];

export const useDeveloperStore = create<DeveloperStore>((set) => ({
  // Navigation
  activeSubTab: "architecture",
  setActiveSubTab: (tab) => set({ activeSubTab: tab }),

  // OS Scheduler
  schedulerAlgo: "FCFS",
  setSchedulerAlgo: (algo) => set({ schedulerAlgo: algo }),
  schedulerStatus: "idle",
  timeQuantum: 3,
  setTimeQuantum: (q) => set({ timeQuantum: q }),
  simulationSpeed: 500,
  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
  patients: INITIAL_PATIENTS,
  setPatients: (patients) => set({ patients }),
  simulationLogs: ["Console initialized. Select algorithm and start simulation."],
  addSimulationLog: (log) => set((state) => ({ simulationLogs: [...state.simulationLogs, log] })),
  ganttChart: [],
  avgWaitingTime: 0,
  avgTurnaroundTime: 0,
  resetScheduler: () => set({
    patients: INITIAL_PATIENTS.map(p => ({ ...p })),
    schedulerStatus: "idle",
    simulationLogs: ["Scheduler reset. Ready for simulation."],
    ganttChart: [],
    avgWaitingTime: 0,
    avgTurnaroundTime: 0
  }),
  setSchedulerResults: (gantt, avgWait, avgTurnaround, updatedPatients) => set({
    ganttChart: gantt,
    avgWaitingTime: avgWait,
    avgTurnaroundTime: avgTurnaround,
    patients: updatedPatients,
    schedulerStatus: "finished"
  }),

  // Trie Autocomplete
  trieSearchInput: "",
  setTrieSearchInput: (input) => set({ trieSearchInput: input }),
  trieNodesVisited: [],
  setTrieNodesVisited: (nodes) => set({ trieNodesVisited: nodes }),

  // Priority Queue SOS
  sosQueue: [
    { id: "SOS-101", name: "Vipul Sharma", priority: 1, symptom: "Cardiac Arrest Alert" },
    { id: "SOS-102", name: "Neha Singh", priority: 3, symptom: "Minor Hand Fracture" },
    { id: "SOS-103", name: "Abdul Khan", priority: 2, symptom: "Diabetic Ketoacidosis" }
  ],
  addToSosQueue: (item) => set((state) => {
    // Priority Queue insert (sorted by priority ascending, where 1 is highest priority)
    const newQueue = [...state.sosQueue, item].sort((a, b) => a.priority - b.priority);
    return { sosQueue: newQueue };
  }),
  dequeueSosQueue: () => set((state) => {
    const [, ...rest] = state.sosQueue;
    return { sosQueue: rest };
  }),
  clearSosQueue: () => set({ sosQueue: [] }),

  // AI Pipeline
  aiInputText: "My grandmother is having trouble breathing due to Delhi smog. Which doctor can consult her immediately?",
  setAiInputText: (text) => set({ aiInputText: text }),
  aiPipelineStep: "idle",
  setAiPipelineStep: (step) => set({ aiPipelineStep: step }),
  aiPipelineLogs: [],
  addAiPipelineLog: (log) => set((state) => ({ aiPipelineLogs: [...state.aiPipelineLogs, log] })),
  clearAiPipelineLogs: () => set({ aiPipelineLogs: [] })
}));
