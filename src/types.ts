/**
 * City Healer Baseline Interfaces
 */

export type Role = "PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN";

export interface Hospital {
  id: string;
  name: string;
  address: string;
  totalBeds: number;
  availableBeds: number;
  icuBeds: number;
  icuAvailable: number;
  emergencyOccupancy: number; // Percentage, e.g. 85
  lat: number;
  lng: number;
  phone: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  experience: number; // In years
  patientsServed: number;
  online: boolean;
  queueCount: number;
  hospitalName: string;
  waitTimeMin: number;
  imageUrl?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  status: "PENDING" | "ACCEPTED" | "COMPLETED" | "CANCELLED";
  symptoms: string;
  type: "VIRTUAL" | "IN_PERSON";
  notes?: string;
  prescription?: Prescription;
}

export interface QueueToken {
  id: string;
  tokenNumber: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  estimatedWaitTimeMin: number;
  status: "WAITING" | "IN_CONSULTATION" | "COMPLETED" | "SKIPPED";
  checkpointTime: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  date: string;
  title: string;
  doctorName: string;
  diagnoseSummary: string;
  attachmentName?: string;
}

export interface Prescription {
  id: string;
  appointmentId?: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  diagnosis: string;
  medicines: {
    name: string;
    dosage: string;      // e.g., "500 mg"
    frequency: string;   // e.g., "Twice daily"
    duration: string;    // e.g., "5 days"
  }[];
  instructions: string;
}

export interface MedicineProduct {
  id: string;
  name: string;
  category: "PAINKILLER" | "ANTIBIOTIC" | "CARDIO" | "VITAMINS" | "CHRONIC" | "FIRST_AID"; // Fix VITAMIN -> VITAMINS to match existing catalog keys
  price: number;
  stock: number;
  description: string;
  requiresPrescription: boolean;
  dosageForm: string; // e.g. "Tablet", "Capsule", "Syrup"
  imageUrl?: string;
  pillsColor?: string;
  pillsShape?: string;
  pillsMarkings?: string;
}

export interface OrderItem {
  medicineId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface MedicineOrder {
  id: string;
  patientId: string;
  patientName: string;
  items: OrderItem[];
  totalAmount: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  prescriptionAttached?: boolean;
  prescriptionName?: string;
  deliveryAddress: string;
  createdAt: string;
}

export interface EmergencyAlert {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  lat: number;
  lng: number;
  address: string;
  type: "HEART_ATTACK" | "ACCIDENT" | "SEVERE_BREATHING" | "SEIZURE" | "OTHER";
  status: "REPORTED" | "DISPATCHED" | "RESOLVED";
  timestamp: string;
  assignedAmbulanceRef?: string;
  hospitalName?: string;
}

export interface ChatMessage {
  id: string;
  sender: "PATIENT" | "DOCTOR";
  text: string;
  timestamp: string;
}
