/**
 * Client API Helpers for City Healer Full-Stack Integration
 */
import { auth } from "../firebase";
import * as seed from "../../seedData";

// Client-side LocalStorage database fallback for static hosting/Vercel environments
function fallbackClientDb(url: string, options?: RequestInit): any {
  console.warn(`[API Offline Fallback] Servicing request to ${url} entirely in-browser.`);
  const method = options?.method?.toUpperCase() || "GET";
  const body = typeof options?.body === "string" ? JSON.parse(options.body) : null;

  // Helpers
  const getStore = <T>(key: string, initial: T[]): T[] => {
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      return initial;
    }
  };

  const saveStore = <T>(key: string, data: T[]): void => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // Routing
  if (url === "/api/hospitals") {
    if (method === "GET") {
      return getStore("city_healer_mock_hospitals", seed.hospitals);
    }
    if (method === "POST") {
      const items = getStore("city_healer_mock_hospitals", seed.hospitals);
      const newItem = {
        id: "hosp-mock-" + Date.now(),
        ...body,
        doctorsAvailableCount: 0
      };
      items.push(newItem);
      saveStore("city_healer_mock_hospitals", items);
      return newItem;
    }
  }

  if (url.startsWith("/api/hospitals/")) {
    const parts = url.split("/");
    const id = parts[3];
    const items = getStore("city_healer_mock_hospitals", seed.hospitals);
    const itemIdx = items.findIndex((h: any) => h.id === id);

    if (url.endsWith("/beds") && method === "PUT") {
      if (itemIdx !== -1) {
        items[itemIdx] = { ...items[itemIdx], ...body };
        saveStore("city_healer_mock_hospitals", items);
        return items[itemIdx];
      }
      throw new Error("Hospital not found");
    }

    if (url.endsWith("/doctors") && method === "POST") {
      const doctors = getStore("city_healer_mock_doctors", seed.doctors);
      const newDoctor = {
        id: "doc-mock-" + Date.now(),
        hospitalId: id,
        ...body
      };
      doctors.push(newDoctor);
      saveStore("city_healer_mock_doctors", doctors);
      return newDoctor;
    }

    if (method === "PUT") {
      if (itemIdx !== -1) {
        items[itemIdx] = { ...items[itemIdx], ...body };
        saveStore("city_healer_mock_hospitals", items);
        return items[itemIdx];
      }
      throw new Error("Hospital not found");
    }
  }

  if (url === "/api/doctors") {
    return getStore("city_healer_mock_doctors", seed.doctors);
  }

  if (url.startsWith("/api/doctors/") && url.endsWith("/online") && method === "PUT") {
    const parts = url.split("/");
    const id = parts[3];
    const items = getStore("city_healer_mock_doctors", seed.doctors);
    const itemIdx = items.findIndex((d: any) => d.id === id);
    if (itemIdx !== -1) {
      items[itemIdx].online = body.online;
      saveStore("city_healer_mock_doctors", items);
      return items[itemIdx];
    }
    throw new Error("Doctor not found");
  }

  if (url === "/api/appointments") {
    if (method === "GET") {
      return getStore("city_healer_mock_appointments", seed.appointments);
    }
    if (method === "POST") {
      const items = getStore("city_healer_mock_appointments", seed.appointments);
      const newItem = {
        id: "appt-mock-" + Date.now(),
        status: "ACCEPTED",
        ...body
      };
      items.push(newItem);
      saveStore("city_healer_mock_appointments", items);
      return newItem;
    }
  }

  if (url.startsWith("/api/appointments/")) {
    const parts = url.split("/");
    const id = parts[3];
    const items = getStore("city_healer_mock_appointments", seed.appointments);
    const itemIdx = items.findIndex((a: any) => a.id === id);

    if (url.endsWith("/status") && method === "PUT") {
      if (itemIdx !== -1) {
        items[itemIdx].status = body.status;
        saveStore("city_healer_mock_appointments", items);
        return items[itemIdx];
      }
      throw new Error("Appointment not found");
    }

    if (url.endsWith("/prescription") && method === "POST") {
      if (itemIdx !== -1) {
        items[itemIdx].prescription = body;
        saveStore("city_healer_mock_appointments", items);
        return items[itemIdx];
      }
      throw new Error("Appointment not found");
    }
  }

  if (url === "/api/records") {
    if (method === "GET") {
      return getStore("city_healer_mock_records", seed.medicalRecords);
    }
    if (method === "POST") {
      const items = getStore("city_healer_mock_records", seed.medicalRecords);
      const newItem = {
        id: "rec-mock-" + Date.now(),
        date: new Date().toLocaleDateString(),
        ...body
      };
      items.push(newItem);
      saveStore("city_healer_mock_records", items);
      return newItem;
    }
  }

  if (url === "/api/queue") {
    return getStore("city_healer_mock_queue", seed.queueTokens);
  }

  if (url === "/api/queue/take" && method === "POST") {
    const items = getStore("city_healer_mock_queue", seed.queueTokens);
    const nextNo = items.length + 1;
    const newItem = {
      id: "q-mock-" + Date.now(),
      tokenNumber: "Q-" + String(nextNo).padStart(3, "0"),
      status: "WAITING",
      createdAt: new Date().toISOString(),
      ...body
    };
    items.push(newItem);
    saveStore("city_healer_mock_queue", items);
    return newItem;
  }

  if (url.startsWith("/api/queue/") && url.endsWith("/status") && method === "PUT") {
    const parts = url.split("/");
    const id = parts[3];
    const items = getStore("city_healer_mock_queue", seed.queueTokens);
    const itemIdx = items.findIndex((q: any) => q.id === id);
    if (itemIdx !== -1) {
      items[itemIdx].status = body.status;
      saveStore("city_healer_mock_queue", items);
      return items[itemIdx];
    }
    throw new Error("Queue token not found");
  }

  if (url === "/api/medicines") {
    return getStore("city_healer_mock_medicines", seed.medicineProducts);
  }

  if (url === "/api/medicines/search-nationwide" && method === "POST") {
    const medicines = getStore("city_healer_mock_medicines", seed.medicineProducts);
    const query = (body.query || "").toLowerCase();
    const matches = medicines.filter((m: any) => 
      m.name.toLowerCase().includes(query) || 
      m.saltName.toLowerCase().includes(query)
    );
    return { matches, source: "In-Browser Local Database Sandbox" };
  }

  if (url === "/api/medicines/orders") {
    return getStore("city_healer_mock_orders", []);
  }

  if (url === "/api/medicines/order" && method === "POST") {
    const items = getStore("city_healer_mock_orders", []);
    const newItem = {
      id: "order-mock-" + Date.now(),
      status: "PENDING",
      createdAt: new Date().toISOString(),
      ...body
    };
    items.push(newItem);
    saveStore("city_healer_mock_orders", items);
    return newItem;
  }

  if (url === "/api/medicines/guide" && method === "POST") {
    return {
      success: true,
      guide: `Mock Medication Guide for **${body.name}**:\n- **Usage**: Take as prescribed by doctor.\n- **Side Effects**: Drowsiness, mild nausea.\n- **Storage**: Cool and dry place.\n*(Simulated response)*`
    };
  }

  if (url === "/api/emergency/sos" && method === "POST") {
    const items = getStore("city_healer_mock_alerts", []);
    const newItem = {
      id: "sos-mock-" + Date.now(),
      status: "REPORTED",
      createdAt: new Date().toISOString(),
      ...body
    };
    items.push(newItem);
    saveStore("city_healer_mock_alerts", items);
    return newItem;
  }

  if (url === "/api/emergency/alerts") {
    return getStore("city_healer_mock_alerts", []);
  }

  if (url.startsWith("/api/emergency/alerts/") && url.endsWith("/status") && method === "PUT") {
    const parts = url.split("/");
    const id = parts[4]; // url: /api/emergency/alerts/:id/status
    const items = getStore("city_healer_mock_alerts", []);
    const itemIdx = items.findIndex((a: any) => a.id === id);
    if (itemIdx !== -1) {
      items[itemIdx].status = body.status;
      saveStore("city_healer_mock_alerts", items);
      return items[itemIdx];
    }
    throw new Error("SOS Alert not found");
  }

  if (url.startsWith("/api/chat/")) {
    const parts = url.split("/");
    const appointmentId = parts[3];
    const chats = getStore("city_healer_mock_chats", []);
    
    if (method === "GET") {
      return chats.filter((c: any) => c.appointmentId === appointmentId);
    }
    if (method === "POST") {
      const newMsg = {
        id: "chat-mock-" + Date.now(),
        appointmentId,
        sender: body.sender,
        text: body.text,
        timestamp: new Date().toISOString()
      };
      chats.push(newMsg);
      saveStore("city_healer_mock_chats", chats);
      return newMsg;
    }
  }

  // AI Symptoms check fallback
  if (url === "/api/symptoms/check" && method === "POST") {
    return {
      analysis: `### In-Browser AI Symptom Analysis\nBased on symptoms: *${body.symptoms}*.\n\n1. **Potential Conditions**: General fatigue, seasonal allergies.\n2. **Urgency**: Low.\n3. **Recommended Actions**: Rest, stay hydrated, consult a physician if symptoms persist.\n*(Simulated Gemini Response)*`
    };
  }

  if (url === "/api/records/analyze" && method === "POST") {
    return {
      analysis: `### Simulated Lab Report Analysis\n- **CBC Parameters**: Normal.\n- **Hemoglobin**: 14.2 g/dL (Optimal).\n- **White Blood Cell Count**: 7,200/mcL (Normal).\n*(Simulated Gemini Lab Review)*`
    };
  }

  if (url === "/api/diet/recommend" && method === "POST") {
    return {
      plan: `### In-Browser Nutrition Recommendation\n- **Goal**: General Health for ${body.condition}.\n- **Preference**: ${body.preference}.\n- **Suggested Diet**: Balanced whole foods, leafy greens, lean protein, complex carbs.\n*(Simulated Gemini Diet Advice)*`
    };
  }

  if (url === "/api/developer/ai-pipeline" && method === "POST") {
    return {
      result: `Developer AI Pipeline Sandbox Execution Success:\nPrompt received: "${body.prompt}"\nResult: Successfully processed through simulated NLP compiler. (LocalStorage Sandbox)`
    };
  }

  throw new Error(`Unsupported API route ${url}`);
}

export async function apiFetch<T>(url: string, options?: RequestInit, retries = 3, delayMs = 300): Promise<T> {
  let lastError: any = null;
  
  // Synchronously fetch current Firebase ID Token if signed in
  let token: string | null = null;
  try {
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
  } catch (e) {
    console.warn("[API Token Retrieval] Failed to fetch credentials:", e);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const authHeaders: Record<string, string> = {};
      if (token) {
        authHeaders["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...options?.headers,
        },
      });

      if (response.status === 404) {
        // Backend offline or Vercel static serving - fall back immediately
        throw { is404: true };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      lastError = err;
      
      // If it's a 404 or a network error, let's trigger the fallback database directly
      const isNetworkError =
        err instanceof Error &&
        (err.name === "TypeError" ||
          err.message === "Failed to fetch" ||
          err.message.includes("NetworkError") ||
          err.message.includes("fetch failed") ||
          err.message.includes("load"));

      if (err.is404 || isNetworkError) {
        // Fall back to client side localStorage database!
        try {
          return fallbackClientDb(url, options) as T;
        } catch (fallbackErr) {
          throw fallbackErr;
        }
      }

      if (attempt < retries) {
        console.warn(`[Client API Fetch Warning] Attempt ${attempt} failed for ${url}. Retrying in ${delayMs}ms...`, err);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2.5; // Exponential backoff scaling
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

export const api = {
  // Hospitals
  getHospitals: () => apiFetch<any[]>("/api/hospitals"),
  updateHospitalBeds: (id: string, body: { availableBeds?: number; icuAvailable?: number; emergencyOccupancy?: number }) =>
    apiFetch<any>(`/api/hospitals/${id}/beds`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  onboardHospital: (body: {
    name: string;
    address: string;
    totalBeds: number;
    icuBeds: number;
    phone?: string;
    lat?: number;
    lng?: number;
    email?: string;
    specialties?: string[];
    categories?: string[];
    hasAmbulanceSupport?: boolean;
    ambulanceSupportCount?: number;
    hasTelemedicine?: boolean;
    hasOpdBooking?: boolean;
    isGovernment?: boolean;
  }) =>
    apiFetch<any>("/api/hospitals", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateHospital: (id: string, body: any) =>
    apiFetch<any>(`/api/hospitals/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  addHospitalDoctor: (id: string, body: { name: string; specialty: string; experience?: number; rating?: number; online?: boolean }) =>
    apiFetch<any>(`/api/hospitals/${id}/doctors`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Doctors
  getDoctors: () => apiFetch<any[]>("/api/doctors"),
  toggleDoctorOnline: (id: string, online: boolean) =>
    apiFetch<any>(`/api/doctors/${id}/online`, {
      method: "PUT",
      body: JSON.stringify({ online }),
    }),

  // Appointments
  getAppointments: () => apiFetch<any[]>("/api/appointments"),
  createAppointment: (body: {
    doctorId: string;
    patientId?: string;
    patientName?: string;
    time?: string;
    date?: string;
    symptoms?: string;
    type?: "VIRTUAL" | "IN_PERSON";
  }) =>
    apiFetch<any>("/api/appointments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAppointmentStatus: (id: string, status: "ACCEPTED" | "COMPLETED" | "CANCELLED") =>
    apiFetch<any>(`/api/appointments/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  createPrescription: (
    id: string,
    body: {
      diagnosis: string;
      medicines: { name: string; dosage: string; frequency: string; duration: string }[];
      instructions: string;
    }
  ) =>
    apiFetch<any>(`/api/appointments/${id}/prescription`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Medical Records
  getRecords: () => apiFetch<any[]>("/api/records"),
  uploadRecord: (body: { title: string; diagnoseSummary: string; doctorName?: string; attachmentName?: string }) =>
    apiFetch<any>("/api/records", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Queue Management
  getQueue: () => apiFetch<any[]>("/api/queue"),
  takeQueueToken: (doctorId: string, patientName?: string) =>
    apiFetch<any>("/api/queue/take", {
      method: "POST",
      body: JSON.stringify({ doctorId, patientName }),
    }),
  updateQueueStatus: (id: string, status: "WAITING" | "IN_CONSULTATION" | "COMPLETED" | "SKIPPED") =>
    apiFetch<any>(`/api/queue/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  // Pharmacy
  getMedicines: () => apiFetch<any[]>("/api/medicines"),
  searchNationwide: (query: string) =>
    apiFetch<{ matches: any[]; source: string }>("/api/medicines/search-nationwide", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  getOrders: () => apiFetch<any[]>("/api/medicines/orders"),
  placeOrder: (body: {
    items: { medicineId: string; name: string; quantity: number; price: number }[];
    totalAmount: number;
    prescriptionAttached?: boolean;
    prescriptionName?: string;
    deliveryAddress?: string;
    patientName?: string;
  }) =>
    apiFetch<any>("/api/medicines/order", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMedicationGuide: (name: string) =>
    apiFetch<any>("/api/medicines/guide", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  // Emergency SOS
  triggerSOS: (body: {
    type: "HEART_ATTACK" | "ACCIDENT" | "SEVERE_BREATHING" | "SEIZURE" | "OTHER";
    patientName: string;
    patientPhone: string;
    lat?: number;
    lng?: number;
    address?: string;
  }) =>
    apiFetch<any>("/api/emergency/sos", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getEmergencyAlerts: () => apiFetch<any[]>("/api/emergency/alerts"),
  updateAlertStatus: (id: string, status: "REPORTED" | "DISPATCHED" | "RESOLVED") =>
    apiFetch<any>(`/api/emergency/alerts/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  // Chat
  getChatMessages: (appointmentId: string) => apiFetch<any[]>(`/api/chat/${appointmentId}`),
  sendChatMessage: (appointmentId: string, sender: "PATIENT" | "DOCTOR", text: string) =>
    apiFetch<any>(`/api/chat/${appointmentId}`, {
      method: "POST",
      body: JSON.stringify({ sender, text }),
    }),

  // AI Symptom Checker
  checkSymptoms: (symptoms: string, history?: string, userLat?: number, userLng?: number) =>
    apiFetch<any>("/api/symptoms/check", {
      method: "POST",
      body: JSON.stringify({ symptoms, history, userLat, userLng }),
    }),

  // AI Lab Report Analyzer
  analyzeReport: (templateId: string) =>
    apiFetch<any>("/api/records/analyze", {
      method: "POST",
      body: JSON.stringify({ templateId }),
    }),

  // AI Diet & Nutrition Planner
  getDietPlan: (condition: string, preference: string) =>
    apiFetch<any>("/api/diet/recommend", {
      method: "POST",
      body: JSON.stringify({ condition, preference }),
    }),

  // AI Developer Pipeline Sandbox
  runDeveloperAiPipeline: (prompt: string, preference?: string) =>
    apiFetch<any>("/api/developer/ai-pipeline", {
      method: "POST",
      body: JSON.stringify({ prompt, preference }),
    }),
};
