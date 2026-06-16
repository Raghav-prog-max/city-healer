/**
 * Client API Helpers for City Healer Full-Stack Integration
 */
import { auth } from "../firebase";

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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      lastError = err;
      const isNetworkError =
        err instanceof Error &&
        (err.name === "TypeError" ||
          err.message === "Failed to fetch" ||
          err.message.includes("NetworkError") ||
          err.message.includes("Failed to fetch") ||
          err.message.includes("fetch failed") ||
          err.message.includes("load"));

      if (isNetworkError && attempt < retries) {
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
};
