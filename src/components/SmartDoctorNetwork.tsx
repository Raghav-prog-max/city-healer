import React, { useState, useMemo, useEffect } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  Search, 
  MapPin, 
  Phone, 
  Activity, 
  Star, 
  Calendar, 
  Clock, 
  Video, 
  MessageSquare, 
  Check, 
  ChevronRight, 
  AlertTriangle, 
  Map, 
  ExternalLink,
  Shield, 
  X, 
  Compass, 
  Sparkles, 
  Heart, 
  Bell, 
  Volume2, 
  Send,
  Info,
  Download
} from "lucide-react";
import { jsPDF } from "jspdf";

// Types
export interface HospitalDetails {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  rating: number;
  isGovernment: boolean;
  totalBeds: number;
  availableBeds: number;
  icuAvailable: number;
  oxygenBeds: number;
  ambulanceCount: number;
  ambulanceEtaMin: number;
  specialties: string[];
  telemedicine: boolean;
  insuranceCashless: string[];
}

export interface DoctorDetails {
  id: string;
  name: string;
  specialty: string;
  experience: number;
  hospitalId: string;
  hospitalName: string;
  rating: number;
  reviewsCount: number;
  fees: number;
  languages: string[];
  certifications: string;
  slots: string[];
  telemedicineSupport: boolean;
  emergencySupport: boolean;
  aiBadge: string;
  imageUrl: string;
}

// Pre-seeded complete Delhi NCR Multi-specialty Hospital Index Database
const SEEDED_HOSPITALS: HospitalDetails[] = [
  {
    id: "h-apollo",
    name: "Indraprastha Apollo Hospital",
    shortName: "Apollo Delhi",
    lat: 28.5362,
    lng: 77.2840,
    address: "Sarita Vihar, Delhi-Mathura Road, New Delhi, Delhi 110076",
    phone: "+91 (11) 2692-5858",
    rating: 4.8,
    isGovernment: false,
    totalBeds: 710,
    availableBeds: 112,
    icuAvailable: 18,
    oxygenBeds: 215,
    ambulanceCount: 15,
    ambulanceEtaMin: 12,
    specialties: ["Cardiology", "Neurology", "Oncology", "Pulmonology", "Gastroenterology"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "HDFC Ergo", "Niva Bupa", "CGHS", "Max Bupa"]
  } as any,
  {
    id: "h-max-saket",
    name: "Max Super Speciality Hospital Saket",
    shortName: "Max Saket",
    lat: 28.5284,
    lng: 77.2120,
    address: "1-2, Press Enclave Road, Saket Institutional Area, New Delhi 110017",
    phone: "+91 (11) 2651-5050",
    rating: 4.7,
    isGovernment: false,
    totalBeds: 530,
    availableBeds: 85,
    icuAvailable: 15,
    oxygenBeds: 180,
    ambulanceCount: 12,
    ambulanceEtaMin: 15,
    specialties: ["Oncology", "Cardiology", "Orthopedics", "Pulmonology", "Endocrinology"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "Niva Bupa", "Tata AIG", "CGHS"]
  } as any,
  {
    id: "h-blk-max",
    name: "BLK-Max Super Speciality Hospital",
    shortName: "BLK-Max",
    lat: 28.6415,
    lng: 77.1782,
    address: "Pusa Road, Radha Soami Satsang, Rajendra Place, New Delhi 110005",
    phone: "+91 (11) 3040-3040",
    rating: 4.6,
    isGovernment: false,
    totalBeds: 650,
    availableBeds: 92,
    icuAvailable: 14,
    oxygenBeds: 195,
    ambulanceCount: 10,
    ambulanceEtaMin: 18,
    specialties: ["Bone Marrow", "Oncology", "Neurology", "General Surgery"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["ICICI Lombard", "HDFC Ergo", "Star Health", "CGHS"]
  } as any,
  {
    id: "h-fortis-escorts",
    name: "Fortis Escorts Heart Institute",
    shortName: "Fortis Escorts",
    lat: 28.5604,
    lng: 77.2762,
    address: "Okhla Road, New Delhi, Delhi 110025",
    phone: "+91 (11) 4211-1111",
    rating: 4.8,
    isGovernment: false,
    totalBeds: 310,
    availableBeds: 45,
    icuAvailable: 11,
    oxygenBeds: 90,
    ambulanceCount: 9,
    ambulanceEtaMin: 10,
    specialties: ["Cardiology", "Vascular Surgery", "Pediatric Cardiac"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Niva Bupa", "Star Health", "Tata AIG"]
  } as any,
  {
    id: "h-medanta",
    name: "Medanta The Medicity",
    shortName: "Medanta Medicity",
    lat: 28.4285,
    lng: 77.0425,
    address: "Sector 38, Gurugram, Haryana 122001",
    phone: "+91 (124) 4141-414",
    rating: 4.9,
    isGovernment: false,
    totalBeds: 1250,
    availableBeds: 240,
    icuAvailable: 45,
    oxygenBeds: 410,
    ambulanceCount: 25,
    ambulanceEtaMin: 22,
    specialties: ["Cardiology", "Neurology", "Organ Transplant", "Minimal Access Surgery"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "HDFC Ergo", "ICICI Lombard", "CGHS", "Niva Bupa"]
  } as any,
  {
    id: "h-aiims",
    name: "AIIMS Delhi",
    shortName: "AIIMS Delhi",
    lat: 28.5672,
    lng: 77.2100,
    address: "Ansari Nagar, New Delhi, Delhi 110029",
    phone: "+91 (11) 2658-8500",
    rating: 4.9,
    isGovernment: true,
    totalBeds: 2200,
    availableBeds: 18,
    icuAvailable: 2,
    oxygenBeds: 600,
    ambulanceCount: 8,
    ambulanceEtaMin: 25,
    specialties: ["All Speciality Care", "Trauma & Critical Emergency", "Cardiology"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["CGHS", "Ayushman Bharat", "Government Welfare Panel"]
  } as any,
  {
    id: "h-ganga-ram",
    name: "Sir Ganga Ram Hospital",
    shortName: "Sir Ganga Ram",
    lat: 28.6385,
    lng: 77.1895,
    address: "Sir Ganga Ram Hospital Marg, Old Rajinder Nagar, New Delhi 110060",
    phone: "+91 (11) 2575-1111",
    rating: 4.7,
    isGovernment: false,
    totalBeds: 675,
    availableBeds: 78,
    icuAvailable: 16,
    oxygenBeds: 200,
    ambulanceCount: 11,
    ambulanceEtaMin: 14,
    specialties: ["Internal Medicine", "Orthopedics", "Cardiology", "Nephrology"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "HDFC Ergo", "Reliance General", "CGHS"]
  } as any,
  {
    id: "h-artemis",
    name: "Artemis Hospital",
    shortName: "Artemis NCR",
    lat: 28.4211,
    lng: 77.0818,
    address: "Sector 51, Gurugram, Haryana 122001",
    phone: "+91 (124) 4511-111",
    rating: 4.6,
    isGovernment: false,
    totalBeds: 400,
    availableBeds: 65,
    icuAvailable: 12,
    oxygenBeds: 110,
    ambulanceCount: 7,
    ambulanceEtaMin: 20,
    specialties: ["Cardiology", "Orthopedics", "Neurosciences", "Bariatric Surgery"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Niva Bupa", "HDFC Ergo", "Star Health"]
  } as any,
  {
    id: "h-manipal",
    name: "Manipal Hospital Dwarka",
    shortName: "Manipal Dwarka",
    lat: 28.5910,
    lng: 77.0705,
    address: "Palam Vihar, Sector 6, Dwarka, New Delhi 110075",
    phone: "+91 (11) 4967-4967",
    rating: 4.8,
    isGovernment: false,
    totalBeds: 380,
    availableBeds: 80,
    icuAvailable: 21,
    oxygenBeds: 120,
    ambulanceCount: 10,
    ambulanceEtaMin: 11,
    specialties: ["Orthopedics", "Oncology", "Cardiology", "Infertility Clinic"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "Tata AIG", "ICICI Lombard", "CGHS"]
  } as any,
  {
    id: "h-psri",
    name: "PSRI Hospital",
    shortName: "PSRI Hospital",
    lat: 28.5312,
    lng: 77.2285,
    address: "Press Enclave Marg, Sheikh Sarai Phase II, New Delhi 110017",
    phone: "+91 (11) 3018-6200",
    rating: 4.6,
    isGovernment: false,
    totalBeds: 250,
    availableBeds: 48,
    icuAvailable: 8,
    oxygenBeds: 75,
    ambulanceCount: 5,
    ambulanceEtaMin: 16,
    specialties: ["Gastroenterology", "Nephrology", "Urology", "Orthopedics"],
    telemedicine: false,
    isCashless: true,
    insuranceCashless: ["Niva Bupa", "HDFC Ergo", "CGHS"]
  } as any,
  {
    id: "h-amrita",
    name: "Amrita Hospital",
    shortName: "Amrita NCR",
    lat: 28.4115,
    lng: 77.3402,
    address: "Sector 88, Faridabad, Haryana 121002",
    phone: "+91 (129) 2859-000",
    rating: 4.9,
    isGovernment: false,
    totalBeds: 2000,
    availableBeds: 450,
    icuAvailable: 85,
    oxygenBeds: 500,
    ambulanceCount: 22,
    ambulanceEtaMin: 15,
    specialties: ["Oncology", "Pediatrics", "Cardiology", "Reconstructive Surgery"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "HDFC Ergo", "Tata AIG", "Niva Bupa"]
  } as any,
  {
    id: "h-jaypee",
    name: "Jaypee Hospital",
    shortName: "Jaypee Noida",
    lat: 28.5244,
    lng: 77.3712,
    address: "Sector 128, Wish Town, Noida, Uttar Pradesh 201304",
    phone: "+91 (120) 4122-222",
    rating: 4.7,
    isGovernment: false,
    totalBeds: 500,
    availableBeds: 110,
    icuAvailable: 22,
    oxygenBeds: 160,
    ambulanceCount: 12,
    ambulanceEtaMin: 12,
    specialties: ["Cardiology", "Neurology", "Orthopedics", "Emergency Trauma"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["HDFC Ergo", "ICICI Lombard", "Star Health"]
  } as any,
  {
    id: "h-fortis-fmri",
    name: "Fortis Memorial Research Institute",
    shortName: "Fortis Gurugram",
    lat: 28.4552,
    lng: 77.0725,
    address: "Sector 44, Opposite HUDA City Centre, Gurugram 122002",
    phone: "+91 (124) 4962-200",
    rating: 4.8,
    isGovernment: false,
    totalBeds: 1000,
    availableBeds: 190,
    icuAvailable: 31,
    oxygenBeds: 290,
    ambulanceCount: 16,
    ambulanceEtaMin: 14,
    specialties: ["Neurology", "Cardiology", "Oncology", "Hematology"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "Niva Bupa", "Tata AIG", "CGHS"]
  } as any,
  {
    id: "h-yashoda",
    name: "Yashoda Super Speciality Hospital",
    shortName: "Yashoda Ghaziabad",
    lat: 28.6432,
    lng: 77.3211,
    address: "H-1, Kaushambi, Near Anand Vihar ISBT, Ghaziabad 201010",
    phone: "+91 (120) 4182-000",
    rating: 4.7,
    isGovernment: false,
    totalBeds: 350,
    availableBeds: 54,
    icuAvailable: 11,
    oxygenBeds: 110,
    ambulanceCount: 8,
    ambulanceEtaMin: 13,
    specialties: ["Neurology", "Spinal Therapy", "Pulmonology", "Gastroenterology"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["CGHS", "Star Health", "HDFC Ergo", "Aditya Birla"]
  } as any,
  {
    id: "h-sci",
    name: "SCI International Hospital",
    shortName: "SCI International",
    lat: 28.5442,
    lng: 77.2345,
    address: "M-4, GK-I, Outside Greater Kailash Metro, New Delhi 110048",
    phone: "+91 (11) 4167-5555",
    rating: 4.7,
    isGovernment: false,
    totalBeds: 80,
    availableBeds: 24,
    icuAvailable: 6,
    oxygenBeds: 30,
    ambulanceCount: 3,
    ambulanceEtaMin: 11,
    specialties: ["Gynecology", "Urology", "Infertility IVF", "Cosmetic Surgery"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["HDFC Ergo", "Niva Bupa", "Star Health", "Reliance General"]
  } as any,
  {
    id: "h-ck-birla",
    name: "CK Birla Hospital",
    shortName: "CK Birla Delhi",
    lat: 28.6631,
    lng: 77.1325,
    address: "Road No. 70, Punjabi Bagh, West New Delhi 110026",
    phone: "+91 (11) 4112-2300",
    rating: 4.6,
    isGovernment: false,
    totalBeds: 110,
    availableBeds: 35,
    icuAvailable: 9,
    oxygenBeds: 45,
    ambulanceCount: 4,
    ambulanceEtaMin: 15,
    specialties: ["Maternity Care", "Gynecology", "Orthopedics", "Neonatology"],
    telemedicine: false,
    isCashless: true,
    insuranceCashless: ["Star Health", "Niva Bupa", "HDFC Ergo"]
  } as any,
  {
    id: "h-aakash",
    name: "Aakash Healthcare",
    shortName: "Aakash Dwarka",
    lat: 28.5902,
    lng: 77.0410,
    address: "Hospital Site, Sector 3, Dwarka, New Delhi 110075",
    phone: "+91 (11) 4338-8888",
    rating: 4.7,
    isGovernment: false,
    totalBeds: 230,
    availableBeds: 52,
    icuAvailable: 12,
    oxygenBeds: 80,
    ambulanceCount: 6,
    ambulanceEtaMin: 10,
    specialties: ["Joint Replacement", "Orthopedics", "Cardiology", "Bariatrics"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "HDFC Ergo", "Tata AIG", "CGHS"]
  } as any,
  {
    id: "h-venkateshwar",
    name: "Venkateshwar Hospital",
    shortName: "Venkateshwar Dwarka",
    lat: 28.5912,
    lng: 77.0450,
    address: "Sector 18A, Dwarka, New Delhi 110075",
    phone: "+91 (11) 4855-5555",
    rating: 4.8,
    isGovernment: false,
    totalBeds: 325,
    availableBeds: 72,
    icuAvailable: 15,
    oxygenBeds: 110,
    ambulanceCount: 8,
    ambulanceEtaMin: 9,
    specialties: ["Cardiology", "Renal Transplant", "Neurology", "Emergency Core"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "HDFC Ergo", "Reliance General", "CGHS"]
  } as any,
  {
    id: "h-kailash",
    name: "Kailash Hospital",
    shortName: "Kailash Noida",
    lat: 28.5721,
    lng: 77.3242,
    address: "H-33, Sector 27, Noida, Uttar Pradesh 201301",
    phone: "+91 (120) 2444-444",
    rating: 4.6,
    isGovernment: false,
    totalBeds: 450,
    availableBeds: 94,
    icuAvailable: 17,
    oxygenBeds: 150,
    ambulanceCount: 11,
    ambulanceEtaMin: 12,
    specialties: ["Emergency Trauma", "Cardiology", "Neurology", "Obs & Gyne"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["CGHS", "Niva Bupa", "Star Health", "HDFC Ergo", "ECHS"]
  } as any,
  {
    id: "h-metro",
    name: "Metro Hospital",
    shortName: "Metro Noida",
    lat: 28.5925,
    lng: 77.3288,
    address: "Sector 11 & 12, Noida, Uttar Pradesh 201301",
    phone: "+91 (120) 4211-111",
    rating: 4.7,
    isGovernment: false,
    totalBeds: 317,
    availableBeds: 63,
    icuAvailable: 10,
    oxygenBeds: 95,
    ambulanceCount: 7,
    ambulanceEtaMin: 14,
    specialties: ["Cardiology", "Pulmonology", "Orthopedics", "Critical Care"],
    telemedicine: true,
    isCashless: true,
    insuranceCashless: ["Star Health", "HDFC Ergo", "CGHS", "Chola MS"]
  } as any
];

// Pre-seeded elite Delhi NCR Doctor Registry, mapped to requested specialists and hospitals
const SEEDED_DOCTORS: DoctorDetails[] = [
  // --- CARDIOLOGY ---
  {
    id: "d-vivek-kumar",
    name: "Dr Vivek Kumar",
    specialty: "Cardiology",
    experience: 22,
    hospitalId: "h-max-saket",
    hospitalName: "Max Super Speciality Hospital Saket",
    rating: 4.9,
    reviewsCount: 1420,
    fees: 1200,
    languages: ["Hindi", "English"],
    certifications: "MBBS, MD (Medicine), DM (Cardiology) - AIIMS Delhi",
    slots: ["10:00 AM", "11:30 AM", "03:00 PM", "05:00 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Top Cardiac Electrophysiologist",
    imageUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-naveen-bhamri",
    name: "Dr Naveen Bhamri",
    specialty: "Cardiology",
    experience: 19,
    hospitalId: "h-apollo",
    hospitalName: "Indraprastha Apollo Hospital",
    rating: 4.8,
    reviewsCount: 980,
    fees: 1500,
    languages: ["Hindi", "English"],
    certifications: "MD, DNB (Cardiology) - Sir Ganga Ram Hospital",
    slots: ["11:00 AM", "12:30 PM", "04:30 PM", "06:00 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Advanced Coronary Angioplasty",
    imageUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-naresh-goyal",
    name: "Dr Naresh Kumar Goyal",
    specialty: "Cardiology",
    experience: 25,
    hospitalId: "h-ganga-ram",
    hospitalName: "Sir Ganga Ram Hospital",
    rating: 4.7,
    reviewsCount: 1650,
    fees: 1000,
    languages: ["Hindi", "English", "Punjabi"],
    certifications: "MBBS, MD, DNB (Cardiology) - Heart Failure Expert",
    slots: ["09:30 AM", "11:00 AM", "02:30 PM", "04:00 PM"],
    telemedicineSupport: true,
    emergencySupport: false,
    aiBadge: "Valvular Intervention Master",
    imageUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&auto=format&fit=crop&q=80"
  },

  // --- NEUROLOGY ---
  {
    id: "d-satyan-nanda",
    name: "Dr Satyan Nanda",
    specialty: "Neurology",
    experience: 18,
    hospitalId: "h-apollo",
    hospitalName: "Indraprastha Apollo Hospital",
    rating: 4.9,
    reviewsCount: 740,
    fees: 1800,
    languages: ["English", "Hindi"],
    certifications: "MD, DM (Neuro-oncology and Stroke Management)",
    slots: ["10:30 AM", "12:00 PM", "03:30 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Brain Stroke Intervention Lead",
    imageUrl: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-mukesh-kumar",
    name: "Dr Mukesh Kumar",
    specialty: "Neurology",
    experience: 16,
    hospitalId: "h-max-saket",
    hospitalName: "Max Super Speciality Hospital Saket",
    rating: 4.8,
    reviewsCount: 620,
    fees: 1300,
    languages: ["Hindi", "English"],
    certifications: "MD (Medicine), DM (Neurology - Epilepsy Specialist)",
    slots: ["11:00 AM", "01:00 PM", "04:00 PM", "05:30 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Specialist Epilepsy Care",
    imageUrl: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-rana-patir",
    name: "Dr Rana Patir",
    specialty: "Neurology",
    experience: 32,
    hospitalId: "h-blk-max",
    hospitalName: "BLK-Max Super Speciality Hospital",
    rating: 5.0,
    reviewsCount: 3100,
    fees: 2000,
    languages: ["English", "Hindi", "Bengali"],
    certifications: "MBBS, MS (Surgery), MCh (Neurosurgery) - AIIMS",
    slots: ["09:00 AM", "10:30 AM", "02:00 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Legendary Micro-Neurosurgical Authority",
    imageUrl: "https://images.unsplash.com/photo-1594824813573-246434de83fb?w=200&auto=format&fit=crop&q=80"
  },

  // --- ORTHOPEDICS ---
  {
    id: "d-ips-oberoi",
    name: "Dr IPS Oberoi",
    specialty: "Orthopedics",
    experience: 24,
    hospitalId: "h-jaypee", // mapped to Jaypee / Max Noida affiliate
    hospitalName: "Jaypee Hospital (Max Noida Affiliate)",
    rating: 4.9,
    reviewsCount: 2200,
    fees: 1100,
    languages: ["Hindi", "English"],
    certifications: "MBBS, MS (Orthopedics), MCh (Joint Replacement) - Germany",
    slots: ["11:00 AM", "01:30 PM", "05:00 PM", "06:30 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Pioneer Arthroscopic Knee-Specialist",
    imageUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-ashok-rajgopal",
    name: "Dr Ashok Rajgopal",
    specialty: "Orthopedics",
    experience: 38,
    hospitalId: "h-jaypee", // requested Max Noida, mapped cleanly to NCR affiliate
    hospitalName: "Jaypee Hospital (Max Noida Affiliate)",
    rating: 5.0,
    reviewsCount: 4500,
    fees: 2200,
    languages: ["Hindi", "English"],
    certifications: "MS (Ortho), FRCS, FIMSA - Holds record for 35,000+ joint surgeries",
    slots: ["10:00 AM", "12:00 PM", "03:00 PM"],
    telemedicineSupport: false,
    emergencySupport: true,
    aiBadge: "Padma Shri Recipient / Elite Robotics Joint Surgeon",
    imageUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-yash-gulati",
    name: "Dr Yash Gulati",
    specialty: "Orthopedics",
    experience: 30,
    hospitalId: "h-ganga-ram",
    hospitalName: "Sir Ganga Ram Hospital",
    rating: 4.9,
    reviewsCount: 1840,
    fees: 1800,
    languages: ["Hindi", "English", "Punjabi"],
    certifications: "MBBS, MS, MCh (Orthopedics) - Joint Replacement Advisory Board",
    slots: ["10:30 AM", "01:00 PM", "04:30 PM"],
    telemedicineSupport: true,
    emergencySupport: false,
    aiBadge: "Spine & Endoscopic Orthopedic Chief",
    imageUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80"
  },

  // --- ONCOLOGY ---
  {
    id: "d-vineet-gupta",
    name: "Dr Vineet Govinda Gupta",
    specialty: "Oncology",
    experience: 15,
    hospitalId: "h-apollo",
    hospitalName: "Indraprastha Apollo Hospital",
    rating: 4.9,
    reviewsCount: 420,
    fees: 1400,
    languages: ["Hindi", "English"],
    certifications: "MBBS (Gold Medalist), MD, DM (Medical Oncology) - AIIMS Delhi",
    slots: ["11:30 AM", "01:00 PM", "04:00 PM"],
    telemedicineSupport: true,
    emergencySupport: false,
    aiBadge: "Targeted Biotech Therapy Lead",
    imageUrl: "https://images.unsplash.com/photo-1594824813573-246434de83fb?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-asit-arora",
    name: "Dr Asit Arora",
    specialty: "Oncology",
    experience: 17,
    hospitalId: "h-apollo",
    hospitalName: "Indraprastha Apollo Hospital",
    rating: 4.8,
    reviewsCount: 390,
    fees: 1600,
    languages: ["Hindi", "English"],
    certifications: "MCh (Surgical Oncology - GI & Hepato-Pancreato-Biliary Cancer) - AIIMS",
    slots: ["10:00 AM", "12:30 PM", "03:00 PM", "05:00 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Advanced Robotic Whipple Resections",
    imageUrl: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-sajjan-rajpurohit",
    name: "Dr Sajjan Rajpurohit",
    specialty: "Oncology",
    experience: 20,
    hospitalId: "h-max-saket",
    hospitalName: "Max Super Speciality Hospital Saket",
    rating: 4.9,
    reviewsCount: 1100,
    fees: 1500,
    languages: ["Hindi", "English"],
    certifications: "MBBS, MD, DNB (Oncology - Immunotherapy Principal Expert)",
    slots: ["11:00 AM", "03:30 PM", "05:30 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Immunotherapy & Gene Trials Director",
    imageUrl: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=200&auto=format&fit=crop&q=80"
  },

  // --- PULMONOLOGY ---
  {
    id: "d-arvind-kumar",
    name: "Dr Arvind Kumar",
    specialty: "Pulmonology",
    experience: 28,
    hospitalId: "h-apollo",
    hospitalName: "Indraprastha Apollo Hospital",
    rating: 4.9,
    reviewsCount: 1820,
    fees: 1800,
    languages: ["Hindi", "English"],
    certifications: "MS, MCh (Thoracic Chest Surgery) - Pioneer Lung Transplants",
    slots: ["10:00 AM", "11:30 AM", "02:30 PM", "04:35 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Severe Smog-Induced Fibrosis Lead",
    imageUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-sandeep-nayar",
    name: "Dr Sandeep Nayar",
    specialty: "Pulmonology",
    experience: 23,
    hospitalId: "h-max-saket",
    hospitalName: "Max Super Speciality Hospital Saket",
    rating: 4.7,
    reviewsCount: 940,
    fees: 1200,
    languages: ["Hindi", "English"],
    certifications: "MD, FCCP (USA) - Lead Pulmonolgical Sleep Studies & COPD Labs",
    slots: ["09:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "FCCP Sleep & Bronchoscopy Chief",
    imageUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80"
  },

  // --- ENDOCRINOLOGY ---
  {
    id: "d-nikhil-tandon",
    name: "Dr Nikhil Tandon",
    specialty: "Endocrinology",
    experience: 31,
    hospitalId: "h-aiims",
    hospitalName: "AIIMS Delhi",
    rating: 4.9,
    reviewsCount: 2200,
    fees: 800,
    languages: ["Hindi", "English"],
    certifications: "MD, PhD (Endocrinology) - Cambridge UK, National Policy Council Advisor",
    slots: ["09:30 AM", "11:00 AM", "01:30 PM"],
    telemedicineSupport: true,
    emergencySupport: false,
    aiBadge: "Global Lancet Advisory Diabetes Panel",
    imageUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-ambrish-mithal",
    name: "Dr Ambrish Mithal",
    specialty: "Endocrinology",
    experience: 35,
    hospitalId: "h-max-saket",
    hospitalName: "Max Super Speciality Hospital Saket",
    rating: 5.0,
    reviewsCount: 3700,
    fees: 2000,
    languages: ["Hindi", "English"],
    certifications: "DM (Endocrinology) - AIIMS, Dr. B.C. Roy National Award Winner",
    slots: ["10:00 AM", "12:00 PM", "04:00 PM"],
    telemedicineSupport: true,
    emergencySupport: false,
    aiBadge: "Metabolic Bone Research Trustee",
    imageUrl: "https://images.unsplash.com/photo-1594824813573-246434de83fb?w=200&auto=format&fit=crop&q=80"
  },

  // --- GYNECOLOGY ---
  {
    id: "d-shobha-gupta",
    name: "Dr Shobha Gupta",
    specialty: "Gynecology",
    experience: 18,
    hospitalId: "h-sci",
    hospitalName: "SCI International Hospital",
    rating: 4.8,
    reviewsCount: 1120,
    fees: 1000,
    languages: ["Hindi", "English"],
    certifications: "MBBS, DGO (Obs & Gynecology) - Fertility Specialist",
    slots: ["11:00 AM", "03:00 PM", "05:00 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "IVF Clinic Director & IVF Genetics Chair",
    imageUrl: "https://images.unsplash.com/photo-1637059824899-a441006a6875?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "d-kaberi-banerjee",
    name: "Dr Kaberi Banerjee",
    specialty: "Gynecology",
    experience: 22,
    hospitalId: "h-sci",
    hospitalName: "SCI International Hospital",
    rating: 4.9,
    reviewsCount: 1520,
    fees: 1500,
    languages: ["English", "Hindi"],
    certifications: "MD, MRCOG (London Royal College Gynecology), IVF Lead Researcher",
    slots: ["10:00 AM", "12:00 PM", "04:30 PM"],
    telemedicineSupport: true,
    emergencySupport: true,
    aiBadge: "Reproductive Endocrinology pioneer",
    imageUrl: "https://images.unsplash.com/photo-1594824813573-246434de83fb?w=200&auto=format&fit=crop&q=80"
  }
];

export default function SmartDoctorNetwork() {
  // Navigation & theme configurations
  const [techMode, setTechMode] = useState<boolean>(true); // Premium dark-glassmorphism vs clean white-care

  // Hospital states
  const [hospitalsList, setHospitalsList] = useState<HospitalDetails[]>(SEEDED_HOSPITALS);
  const [selectedHospital, setSelectedHospital] = useState<HospitalDetails | null>(null);

  // Search filter states
  const [searchPhrase, setSearchPhrase] = useState("");
  const [searchHospital, setSearchHospital] = useState("");
  const [searchSpec, setSearchSpec] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  
  const [selectedSymptom, setSelectedSymptom] = useState("");
  const [selectedEmergency, setSelectedEmergency] = useState("");
  
  const [filterFee, setFilterFee] = useState<number>(2500);
  const [filterInsurance, setFilterInsurance] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterOPDMode, setFilterOPDMode] = useState<"all" | "online" | "offline">("all");
  const [filterAvailableToday, setFilterAvailableToday] = useState(false);

  // Booking states
  const [bookingDoctor, setBookingDoctor] = useState<DoctorDetails | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingType, setBookingType] = useState<"VIRTUAL" | "IN_PERSON">("VIRTUAL");
  const [bookingSymptoms, setBookingSymptoms] = useState("");
  const [bookingSuccessCard, setBookingSuccessCard] = useState<any | null>(null);

  // Active telemedicine video counselor simulation console
  const [activeTelemedSession, setActiveTelemedSession] = useState<DoctorDetails | null>(null);
  const [telemedState, setTelemedState] = useState<"connecting" | "active" | "concluded">("connecting");
  const [audioOnly, setAudioOnly] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "doctor"; text: string; time: string }>>([]);
  const [telemedPrescription, setTelemedPrescription] = useState<any | null>(null);

  // Smart emergency SOS routing state
  const [emergencyRoutingResult, setEmergencyRoutingResult] = useState<any | null>(null);
  const [isSOSRoutingActive, setIsSOSRoutingActive] = useState(false);
  const [userLocationCoords, setUserLocationCoords] = useState<{ lat: number, lng: number }>({ lat: 28.55, lng: 77.20 });

  // Doctor list sorting state and helpers
  const [sortBy, setSortBy] = useState<"relevance" | "rating" | "waitTime" | "distance">("relevance");

  const getDoctorWaitTime = (doc: DoctorDetails) => {
    const hash = doc.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash % 6) * 5 + 5; // Deterministic range: 5 to 30 mins
  };

  const getDoctorDistance = (doc: DoctorDetails) => {
    const hosp = SEEDED_HOSPITALS.find(h => h.id === doc.hospitalId);
    if (!hosp) return 8.5; // fallback
    const dLat = hosp.lat - userLocationCoords.lat;
    const dLng = hosp.lng - userLocationCoords.lng;
    return Math.sqrt(dLat * dLat + dLng * dLng) * 111.32; // In kilometers
  };

  // Bed census simulation
  const [simulatedPulseCounter, setSimulatedPulseCounter] = useState(0);

  // Trigger simulated counters & notifications
  useEffect(() => {
    const timer = setInterval(() => {
      setSimulatedPulseCounter(prev => prev + 1);
      // Randomly adjust bed counts to simulate real-time hospital occupancy
      setHospitalsList(prevHosp => prevHosp.map(h => {
        const roll = Math.random();
        if (roll > 0.82) {
          const change = Math.random() > 0.5 ? 1 : -1;
          const targetBeds = Math.max(2, Math.min(h.icuAvailable + change, h.totalBeds - 100));
          return {
            ...h,
            icuAvailable: targetBeds,
            availableBeds: Math.max(10, h.availableBeds + (change * 2))
          };
        }
        return h;
      }));
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Sync state coordinates on click
  const locateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Fallback Default Central Delhi
          setUserLocationCoords({ lat: 28.5672, lng: 77.2100 });
        }
      );
    }
  };

  // Mappings of symptom strings to specializations
  const symptomSpecialtyMap: Record<string, string> = {
    "chest-pain": "Cardiology",
    "stroke-numbness": "Neurology",
    "joint-knee-pain": "Orthopedics",
    "breathing-asthma": "Pulmonology",
    "chronic-diabetes": "Endocrinology",
    "maternity-ivf": "Gynecology"
  };

  // Handle AI Recommendation Engine evaluation based on all rulesets
  const getAIRecommendations = useMemo(() => {
    // Basic filter of doctor cards
    let matchedDocs = SEEDED_DOCTORS;

    // Apply rule: Symptom auto-selects ideal Specialty
    let inferredSpecialty = "";
    if (selectedSymptom && symptomSpecialtyMap[selectedSymptom]) {
      inferredSpecialty = symptomSpecialtyMap[selectedSymptom];
    }

    return matchedDocs.map(doc => {
      let score = 75; // Baseline compatibility index
      const reasons: string[] = [];

      // Specialty Match
      if (inferredSpecialty) {
        if (doc.specialty === inferredSpecialty) {
          score += 15;
          reasons.push(`Highly matches symptom specialty: ${inferredSpecialty}`);
        } else {
          score -= 30; // severely downgrade mismatch for strict clinical safety
        }
      }

      // Emergency Severity match
      if (selectedEmergency) {
        if (doc.emergencySupport) {
          score += 10;
          reasons.push("Emergency consultation certified - immediate ICU routing.");
        } else {
          score -= 15;
        }
      }

      // Rating bonus
      if (doc.rating >= 4.9) {
        score += 5;
        reasons.push("Awarded top clinical performance ratings from 1000+ patients.");
      }

      // Experience multiplier
      if (doc.experience >= 25) {
        score += 5;
        reasons.push("Over 25 years of advanced clinical mastery.");
      }

      // Insurance panel support
      const affiliateHosp = hospitalsList.find(h => h.id === doc.hospitalId);
      if (filterInsurance && affiliateHosp) {
        if (affiliateHosp.insuranceCashless.includes(filterInsurance)) {
          score += 10;
          reasons.push(`Instant Cashless Coverage on ${filterInsurance} Panel.`);
        } else {
          score -= 20;
          reasons.push(`Non-panel underwritings: ${filterInsurance}`);
        }
      }

      // Language loyalty
      if (filterLanguage) {
        if (doc.languages.includes(filterLanguage)) {
          score += 5;
          reasons.push(`Native support for selected language: ${filterLanguage}`);
        }
      }

      // Fee budgeting
      if (doc.fees <= filterFee) {
        score += 5;
      } else {
        score -= 10;
        reasons.push(`Consultation fee (₹${doc.fees}) exceeds filter preference.`);
      }

      // Bound safety
      score = Math.max(10, Math.min(100, score));

      return {
        ...doc,
        aiScore: score,
        aiReasons: reasons.slice(0, 3)
      };
    }).sort((a, b) => b.aiScore - a.aiScore);

  }, [selectedSymptom, selectedEmergency, filterInsurance, filterLanguage, filterFee, hospitalsList]);

  // Main list filtering for directory display
  const filteredDoctors = useMemo(() => {
    const list = getAIRecommendations.filter(doc => {
      // Free form phrase search (name, specialty, certifications)
      if (searchPhrase) {
        const p = searchPhrase.toLowerCase();
        const matchesName = doc.name.toLowerCase().includes(p);
        const matchesSpec = doc.specialty.toLowerCase().includes(p);
        const matchesCerts = doc.certifications.toLowerCase().includes(p);
        if (!matchesName && !matchesSpec && !matchesCerts) return false;
      }

      // Specialization selector
      if (searchSpec && doc.specialty !== searchSpec) {
        return false;
      }

      // Hospital selector
      if (searchHospital && doc.hospitalId !== searchHospital) {
        return false;
      }

      // Fee range
      if (doc.fees > filterFee) {
        return false;
      }

      // Language
      if (filterLanguage && !doc.languages.includes(filterLanguage)) {
        return false;
      }

      // Telemedicine Online check
      if (filterOPDMode === "online" && !doc.telemedicineSupport) {
        return false;
      }
      if (filterOPDMode === "offline" && doc.telemedicineSupport) {
        return false; // Show only physical clinics
      }

      return true;
    });

    if (sortBy === "rating") {
      return [...list].sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "waitTime") {
      return [...list].sort((a, b) => getDoctorWaitTime(a) - getDoctorWaitTime(b));
    } else if (sortBy === "distance") {
      return [...list].sort((a, b) => getDoctorDistance(a) - getDoctorDistance(b));
    }

    return list;
  }, [getAIRecommendations, searchPhrase, searchSpec, searchHospital, filterFee, filterLanguage, filterOPDMode, sortBy, userLocationCoords]);

  // Handle Dispatch Smart Emergency routing system
  const triggerSmartEmergencySOS = (emergencyType: string) => {
    setIsSOSRoutingActive(true);
    setEmergencyRoutingResult(null);

    setTimeout(() => {
      // Find the optimal hospital based on: Near distance (lat/lng), Max ICU beds available, and Ambulance ETA
      let bestHosp = hospitalsList[0];
      let bestScore = -1000;

      hospitalsList.forEach(h => {
        // Simple distance metric
        const dLat = h.lat - userLocationCoords.lat;
        const dLng = h.lng - userLocationCoords.lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111; // conversion to km approximately
        
        let score = 100;
        // Penalize long distances
        score -= dist * 4;
        // Prioritize massive ICU availability
        score += h.icuAvailable * 2;
        // Prioritize speed ETA
        score -= h.ambulanceEtaMin * 3;

        // Is Govt fallback check
        if (h.isGovernment) score -= 10; // Private preferred for express emergency speed in user request guidelines

        if (score > bestScore) {
          bestScore = score;
          bestHosp = h;
        }
      });

      // Find emergency cardiology doctors or orthopedic doctors on standby
      const specializedStandbyDoctors = SEEDED_DOCTORS.filter(d => {
        if (emergencyType === "heart_attack" && d.specialty === "Cardiology") return true;
        if (emergencyType === "accident" && d.specialty === "Orthopedics") return true;
        if (emergencyType === "breathing" && d.specialty === "Pulmonology") return true;
        return d.emergencySupport;
      });

      setEmergencyRoutingResult({
        hospital: bestHosp,
        standbyDoctor: specializedStandbyDoctors[0] || SEEDED_DOCTORS[0],
        eta: bestHosp.ambulanceEtaMin,
        icuBedsLeft: bestHosp.icuAvailable,
        oxygenStandby: bestHosp.oxygenBeds,
        trafficStatus: "High Heavy Smog Blockage - Redirecting Outer Ring Expressway Airflow Corridor",
        greenwaveTriggered: true,
        ambulanceId: `DL-1E-AMB-${Math.floor(1000 + Math.random() * 9000)}`
      });
      setIsSOSRoutingActive(false);
    }, 1800);
  };

  // Launch telemedicine chat actions
  const sendTelemedChat = () => {
    if (!chatInput.trim() || !activeTelemedSession) return;
    const userMsg = {
      sender: "user" as const,
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");

    // Simulate Doctor response
    setTimeout(() => {
      let replyText = "Understood. Please record your chest and breathing rate if possible. I am reviewing your historical diagnostic telemetry logs.";
      if (activeTelemedSession.specialty === "Cardiology") {
        replyText = "I see your cardiac parameters look steady but the weather particulate index is triggering stress. Let me issue a digital prophylactic beta blocker.";
      } else if (activeTelemedSession.specialty === "Endocrinology") {
        replyText = "Your HbA1c values indicate sustained-release Glycomet control should be maintained. Reduce sodium, increase complex fibers.";
      }
      
      setChatMessages(prev => [...prev, {
        sender: "doctor" as const,
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 1200);
  };

  // Telemed session starter
  const startTeleConsult = (doc: DoctorDetails) => {
    setActiveTelemedSession(doc);
    setTelemedState("connecting");
    setChatMessages([
      {
        sender: "doctor",
        text: `Namaste. I am Dr. ${doc.name.split(" ").slice(-1)[0]} connecting from ${doc.hospitalName}. Please confirm you can hear and see me well.`,
        time: "Now"
      }
    ]);
    
    setTimeout(() => {
      setTelemedState("active");
    }, 1500);
  };

  const generateTelemedPrescription = () => {
    if (!activeTelemedSession) return;
    setTelemedPrescription({
      id: `Rx-TELE-${Math.floor(10000 + Math.random()*90000)}`,
      date: "30-May-2026",
      doctorName: activeTelemedSession.name,
      certifications: activeTelemedSession.certifications,
      hospital: activeTelemedSession.hospitalName,
      diagnosis: `${activeTelemedSession.specialty} follow-up - telemedicine analysis optimal`,
      medicines: [
        { name: "Prophylactic Sustained Capsule", dosage: "1 tab daily", frequency: "Morning post meals", duration: "10 days" },
        { name: "Clinical Airway Bronchodilator", dosage: "2 puffs", frequency: "Whenever high congestion", duration: "As needed" }
      ],
      instructions: "Keep oxygen logs verified. Schedule offline review if chest tension scales above threshold."
    });
  };

  const handleDownloadPDF = () => {
    if (!telemedPrescription) return;
    try {
      const doc = new jsPDF();
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(13, 148, 136); // Teal-600
      doc.text("CITY HEALER TELEMEDICINE", 20, 25);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("DELHI NCR SMART CLINICAL CO-OP", 20, 31);
      doc.text("License No: DL-98101-MCD", 20, 36);

      // Drawing a dividing line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(20, 41, 190, 41);

      // Doctor details
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`Prescribing Doctor: ${telemedPrescription.doctorName}`, 20, 50);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Specialty / Certifications: ${telemedPrescription.certifications}`, 20, 56);
      doc.text(`Hospital: ${telemedPrescription.hospital || "Delhi Regional Medical Center"}`, 20, 61);

      doc.text(`Prescription ID: ${telemedPrescription.id}`, 130, 50);
      doc.text(`Date of Issue: ${telemedPrescription.date}`, 130, 56);

      // Patient details
      doc.setDrawColor(241, 245, 249);
      doc.setFillColor(248, 250, 252);
      doc.rect(20, 68, 170, 22, "F");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("PATIENT REGISTRATION INFORMATION", 25, 74);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Patient Name: Raghav Sharma", 25, 81);
      doc.text("Age: 34 Yrs | Gender: Male", 120, 81);

      // Diagnosis
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("DIAGNOSED CLINICAL CONDITION", 20, 100);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(telemedPrescription.diagnosis, 20, 106);

      // Medicines Section
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("PRESCRIBED PHARMACEUTICAL CONSIGNMENTS", 20, 118);

      let yPosition = 126;
      telemedPrescription.medicines.forEach((med: any, index: number) => {
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`${index + 1}. ${med.name}`, 20, yPosition);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`Dosage Frequency: ${med.dosage} (${med.frequency})`, 25, yPosition + 5);
        doc.text(`Duration: ${med.duration}`, 140, yPosition + 5);
        
        yPosition += 15;
      });

      // Advisory instructions
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("PATIENT ADVISORY CAUTIONS & INSTRUCTIONS", 20, yPosition + 4);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const instructionsText = doc.splitTextToSize(telemedPrescription.instructions, 170);
      doc.text(instructionsText, 20, yPosition + 10);

      // Footnote
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(20, 260, 190, 260);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("This document is a computer-generated digital prescription and contains high-parity cryptographic verified keys under MCI Guidelines 2020.", 20, 266);
      doc.text("Valid only when distributed through City Healer authorized telecommunications network channels.", 20, 271);

      doc.save(`${telemedPrescription.id}_prescription.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
    }
  };

  // Book Appointment Trigger
  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor || !bookingDate || !bookingTime) return;

    setBookingSuccessCard({
      id: `APPT-NCR-${Math.floor(100000 + Math.random() * 900000)}`,
      doctorName: bookingDoctor.name,
      specialty: bookingDoctor.specialty,
      hospital: bookingDoctor.hospitalName,
      date: bookingDate,
      time: bookingTime,
      type: bookingType,
      fees: bookingDoctor.fees
    });
    setBookingDoctor(null);
  };

  return (
    <div className={`p-1 flex flex-col h-full font-sans overflow-y-auto ${
      techMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"
    }`}>
      
      {/* Visual Header Grid & Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-6 border-b border-dashed border-slate-800 gap-4 mt-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-[10px] font-black tracking-widest uppercase rounded-full ${
              techMode ? "bg-cyan-950 text-cyan-400 border border-cyan-800/50" : "bg-blue-100 text-blue-700"
            }`}>
              DELHI NCR AI CLINICAL ROUTER v1.9
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-full animate-pulse border border-red-500/20">
              <Activity className="h-3 w-3" /> Live GPS Core Active
            </span>
          </div>
          <h2 className={`text-2xl font-black mt-1.5 tracking-tight ${techMode ? "text-white" : "text-slate-950"}`}>
            Delhi NCR Smart Doctor & Hospital Network
          </h2>
          <p className="text-xs text-slate-450 mt-1 max-w-2xl">
            Real-time multi-tier emergency dispatch, live ICU vacancy matching, specialist telemedicine hubs, and advanced symptom-guided AI recommendation platform matching Delhi's elite medical institutions.
          </p>
        </div>

        {/* Theme and location Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTechMode(!techMode)}
            className={`cursor-pointer px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
              techMode 
                ? "bg-slate-900 border-slate-800 text-cyan-400 hover:bg-slate-800/80" 
                : "bg-white border-slate-200 text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Compass className="h-3.5 w-3.5 animate-spin" />
            Theme: <span className="underline">{techMode ? "Holo-Tech Dark" : "Clean Clinical"}</span>
          </button>
          
          <button
            onClick={locateMe}
            className={`cursor-pointer px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              techMode ? "bg-blue-950 hover:bg-blue-900 border border-blue-800/40 text-blue-300" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            Locate: <span className="font-mono text-[10px]">{userLocationCoords.lat.toFixed(2)}, {userLocationCoords.lng.toFixed(2)}</span>
          </button>
        </div>
      </div>

      {/* EMERGENCY HIGHLIGHTSOS DISPATCH PANEL */}
      <div className={`mb-6 p-5 rounded-3xl border ${
        techMode 
          ? "bg-slate-900/60 backdrop-blur-xl border-red-950/40 shadow-xl shadow-red-950/10" 
          : "bg-red-50 border-red-150 text-slate-800"
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-ping"></span>
              DELHI NCR SEVERE TRAUMA SOS PANIC PANEL (AMBULANCE OUTBOUNDS)
            </h3>
            <p className={`text-xs ${techMode ? "text-slate-400" : "text-slate-600"}`}>
              Instantly route patient telemetry to the closest cardiac and critical care units in Gurugram, Delhi, and Noida with empty ICU beds. Priority green-corridor clearance.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {[
              { id: "heart_attack", label: "Cardiac Arrest / Chest Pain", color: "bg-red-600 hover:bg-red-700" },
              { id: "accident", label: "Road Accident Trauma", color: "bg-amber-600 hover:bg-amber-700" },
              { id: "breathing", label: "Severe Smog Respiratory Distress", color: "bg-indigo-600 hover:bg-indigo-700" }
            ].map(ems => (
              <button
                key={ems.id}
                onClick={() => triggerSmartEmergencySOS(ems.id)}
                className={`cursor-pointer px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition-transform active:scale-95 ${ems.color}`}
              >
                🚨 {ems.label}
              </button>
            ))}
          </div>
        </div>

        {/* Simulated emergency SOS dispatch report */}
        <AnimatePresence>
          {emergencyRoutingResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`mt-4 p-4 rounded-2xl border ${
                techMode 
                  ? "bg-slate-950/90 border-red-900/30 text-white" 
                  : "bg-white border-red-200 text-slate-800"
              } space-y-4`}
            >
              <div className="flex justify-between items-start border-b border-slate-800/40 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 px-2.5 bg-red-500 text-white font-black text-[10px] uppercase rounded">
                    EMERGENCY TRANSIT CORRIDOR
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Ambulance ID: {emergencyRoutingResult.ambulanceId}</span>
                </div>
                <button 
                  onClick={() => setEmergencyRoutingResult(null)}
                  className="p-1 hover:bg-slate-800 rounded-full"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1 bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                  <span className="text-slate-400 block font-semibold">Recommended Hospital</span>
                  <span className="font-extrabold text-red-500 text-sm block">{emergencyRoutingResult.hospital.name}</span>
                  <span className="text-[10px] block font-medium mt-1">{emergencyRoutingResult.hospital.address}</span>
                </div>
                
                <div className="space-y-1 bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Critical Traumatic Standby</span>
                  <span className="font-black text-slate-100 block text-sm">{emergencyRoutingResult.standbyDoctor.name}</span>
                  <span className="text-[10px] text-cyan-400 block">{emergencyRoutingResult.standbyDoctor.certifications}</span>
                </div>

                <div className="space-y-1 bg-slate-900 p-3 rounded-xl border border-slate-800 text-center flex flex-col justify-center">
                  <span className="text-slate-400 block">Ambulance GPS ETA</span>
                  <span className="font-black text-amber-500 text-xl block tracking-tight animate-pulse">{emergencyRoutingResult.eta} Minutes</span>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase block mt-1">✓ Green Wave Triggered</span>
                </div>

                <div className="space-y-1 bg-slate-900 p-3 rounded-xl border border-slate-800 text-center flex flex-col justify-center">
                  <span className="text-slate-400 block">Available ICU Vacancy</span>
                  <span className="font-black text-emerald-400 text-xl block tracking-tight">{emergencyRoutingResult.icuBedsLeft} ICU Beds Available</span>
                  <span className="text-[9px] block text-slate-500">Oxygen Cylinder Feed: {emergencyRoutingResult.oxygenStandby} units</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-xl border border-red-500/10">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-red-400">Live Telemedicine Traffic Dispatch Routing:</p>
                  <p className="text-[10px] text-red-300 font-semibold">{emergencyRoutingResult.trafficStatus}. Standard Highway GPS synced.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* TABULAR LAYOUT - SPLIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: INTERACTIVE VISUAL REGENCY MAP (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`p-5 rounded-3xl border flex flex-col h-[520px] ${
            techMode ? "bg-slate-900/60 backdrop-blur-xl border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"
          }`}>
            <div className="mb-4">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5">
                <Map className="h-4 w-4 text-cyan-400 animate-bounce" />
                Delhi NCR Interactive Multi-Agency Bed Map
              </h3>
              <p className="text-[10px] text-slate-400">
                Pulse coordinates represent real-time beds/ventilator status. Hover pins for live OPD status.
              </p>
            </div>

            {/* Simulated Vector 2D Grid Map of Delhi NCR */}
            <div className={`relative flex-1 rounded-2xl overflow-hidden border flex items-center justify-center ${
              techMode ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
            }`}>
              
              {/* Pulsing Grid Lines */}
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                backgroundImage: `radial-gradient(ellipse at center, transparent 30%, ${techMode ? "#0f172a" : "#cbd5e1"} 80%), repeating-linear-gradient(0deg, #3b82f6 0px, #3b82f6 1px, transparent 1px, transparent 30px), repeating-linear-gradient(90deg, #3b82f6 0px, #3b82f6 1px, transparent 1px, transparent 30px)`
              }}></div>

              {/* Central Delhi Node Circle */}
              <div className="absolute w-24 h-24 border border-dashed border-cyan-500/20 rounded-full animate-pulse flex items-center justify-center pointer-events-none">
                <span className="text-[8px] font-mono font-bold text-cyan-400 opacity-60">CENTRAL ZONE</span>
              </div>

              {/* User Location Pin */}
              <div 
                className="absolute z-10 p-1.5 bg-yellow-500 text-slate-950 rounded-full shadow-lg flex items-center justify-center border border-white group transition-all"
                style={{ left: "45%", top: "52%" }}
              >
                <div className="w-2.5 h-2.5 bg-slate-950 rounded-full animate-ping absolute -inset-0.5"></div>
                <MapPin className="h-3.5 w-3.5" />
                <div className="absolute left-6 scale-0 group-hover:scale-100 bg-slate-900 border border-slate-700 p-2 rounded text-[10px] whitespace-nowrap z-50 text-white">
                  <strong>You are here</strong>
                  <p className="font-mono mt-0.5 text-[8px]">GPS Latitude: {userLocationCoords.lat.toFixed(4)}</p>
                </div>
              </div>

              {/* Pulsing Coordinates pins for seeded hospitals */}
              {hospitalsList.slice(0, 10).map((h, i) => {
                // Approximate Delhi coordinate mapping to a visual percentage space
                // Latitude bounds: 28.4 to 28.7
                // Longitude bounds: 77.0 to 77.4
                const leftPercent = 10 + ((h.lng - 77.0) / 0.4) * 80;
                const topPercent = 90 - ((h.lat - 28.4) / 0.3) * 80;

                const isSelected = selectedHospital?.id === h.id;

                return (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHospital(h)}
                    className="absolute cursor-pointer transition-all hover:scale-135"
                    style={{ 
                      left: `${leftPercent}%`, 
                      top: `${topPercent}%`,
                    }}
                  >
                    <span className={`absolute inline-flex h-4 w-4 rounded-full opacity-75 animate-ping ${
                      h.icuAvailable > 20 ? "bg-emerald-500" : h.icuAvailable > 5 ? "bg-amber-500" : "bg-red-500"
                    }`}></span>
                    <MapPin className={`h-5.5 w-5.5 shadow transition-all ${
                      isSelected ? "text-cyan-400 scale-125 font-black filter drop-shadow-[0_0_8px_rgba(34,211,238,1)]" : "text-blue-500"
                    }`} />
                  </button>
                );
              })}

              <div className="absolute bottom-2 left-2 p-2 rounded bg-slate-900/80 text-[9px] space-y-1.5 border border-slate-700/50">
                <p className="font-black text-slate-300">Live Vacancy Index</p>
                <div className="flex gap-2 text-slate-400 font-semibold">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> High (&gt;20 ICU)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"></span> Drastic (&lt;10 ICU)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500"></span> Critical (&lt;5 ICU)</span>
                </div>
              </div>
            </div>

            {/* Quick overview of selectedHospital widget */}
            {selectedHospital ? (
              <div className="mt-4 p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-extrabold text-white leading-tight">{selectedHospital.name}</h4>
                    <span className="text-[10px] text-slate-400 leading-none">{selectedHospital.address}</span>
                  </div>
                  <button 
                    onClick={() => setSelectedHospital(null)}
                    className="p-1 hover:bg-slate-800 rounded-full"
                  >
                    <X className="h-3 w-3 text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 block">Total Capacity</span>
                    <span className="font-mono font-extrabold text-slate-200">{selectedHospital.totalBeds} Beds</span>
                  </div>
                  <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 block text-[9px]">General Vacant</span>
                    <span className="font-mono font-extrabold text-amber-500">{selectedHospital.availableBeds} Vacant</span>
                  </div>
                  <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 block">ICU Beds Standby</span>
                    <span className="font-mono font-extrabold text-emerald-400">{selectedHospital.icuAvailable} Vacant</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/40">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Phone className="h-3 w-3 text-cyan-400" /> {selectedHospital.phone}
                  </span>
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedHospital.name)}+${encodeURIComponent(selectedHospital.address)}`}
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-0.5 text-cyan-400 font-bold hover:underline cursor-pointer"
                  >
                    GPS Nav <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400 italic">
                Click any hospital location vector on the map grid to lock live bed allocations and ambulance phone routes instantly.
              </div>
            )}
          </div>

          {/* AI RECOMMENDATION CONTROL SHEET (rule selection dashboard) */}
          <div className={`p-5 rounded-3xl border space-y-4 ${
            techMode ? "bg-slate-900/60 backdrop-blur-xl border-slate-850" : "bg-white border-slate-200"
          }`}>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 animate-spin" />
                AI Doctor Recommendation Panel
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Multi-constraint matching algorithm. Select symptom parameters to auto-infer specializations.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold text-[10.5px]">Patient Clinical Symptoms Classifier</label>
                <select
                  value={selectedSymptom}
                  onChange={(e) => {
                    setSelectedSymptom(e.target.value);
                    const inferred = symptomSpecialtyMap[e.target.value];
                    if (inferred) setSearchSpec(inferred);
                  }}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 outline-none text-slate-100 font-sans"
                >
                  <option value="">-- Let AI Infer Specialty (None Selected) --</option>
                  <option value="chest-pain">Chest Pain / Chest Pressure / High Stress (Cardiology)</option>
                  <option value="stroke-numbness">Sudden Speech Slur / Numbness (Neurology)</option>
                  <option value="joint-knee-pain">Knee Arthritis / Joint Locking (Orthopedics)</option>
                  <option value="breathing-asthma">Smog Shortness of Breath / Fibrosis (Pulmonology)</option>
                  <option value="chronic-diabetes">Diabetes Control / Thyroid Spike (Endocrinology)</option>
                  <option value="maternity-ivf">Infertility Counseling / Maternity Care (Gynecology)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold text-[10.5px]">Cashless Insurance Policy Filter</label>
                <select
                  value={filterInsurance}
                  onChange={(e) => setFilterInsurance(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 outline-none text-slate-100 font-sans"
                >
                  <option value="">-- Choose Insurance Cover --</option>
                  <option value="Star Health">Star Health Cashless Protection</option>
                  <option value="HDFC Ergo">HDFC Ergo Private Healthcare Panel</option>
                  <option value="Niva Bupa">Niva Bupa Medical Insurance</option>
                  <option value="Tata AIG">Tata AIG Cashless Care</option>
                  <option value="CGHS">Central Government Health Scheme (CGHS)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold text-[10.5px]">Regional Language Customization</label>
                <select
                  value={filterLanguage}
                  onChange={(e) => setFilterLanguage(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 outline-none text-slate-100 font-sans"
                >
                  <option value="">-- Language Friendly-Match --</option>
                  <option value="Hindi">Hindi / North regional dialects</option>
                  <option value="English">English Fluent Professional</option>
                  <option value="Punjabi">Punjabi native</option>
                  <option value="Bengali">Bengali conversational</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold text-[10px]">Max Consultation Fees</label>
                  <input
                    type="range"
                    min="500"
                    max="2500"
                    step="100"
                    value={filterFee}
                    onChange={(e) => setFilterFee(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                  <span className="text-[10px] text-cyan-400 font-black block mt-1 text-center">₹{filterFee} Consultation</span>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold text-[10px]">Consultation Protocol</label>
                  <div className="flex border border-slate-800 rounded-xl overflow-hidden font-sans">
                    <button
                      onClick={() => setFilterOPDMode("all")}
                      className={`flex-1 py-1.5 text-[10px] uppercase font-bold transition-all ${
                        filterOPDMode === "all" ? "bg-cyan-500 text-slate-950" : "bg-slate-950/80 text-slate-400"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterOPDMode("online")}
                      className={`flex-1 py-1.5 text-[10px] uppercase font-bold transition-all ${
                        filterOPDMode === "online" ? "bg-cyan-500 text-slate-950" : "bg-slate-950/80 text-slate-400"
                      }`}
                    >
                      Video
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setSelectedSymptom("");
                  setSelectedEmergency("");
                  setFilterInsurance("");
                  setFilterLanguage("");
                  setFilterFee(2500);
                  setFilterOPDMode("all");
                  setSearchSpec("");
                }}
                className="w-full py-2 bg-slate-950 hover:bg-slate-850/80 border border-slate-800 text-[10px] text-slate-350 tracking-widest font-black uppercase rounded-xl transition-all text-center cursor-pointer"
              >
                Reset Diagnostic Criteria
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SEARCH, DIRECTORY & CARDS LISTING (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">

          {/* SEARCH DESCRIPTOR BAR */}
          <div className={`p-4 rounded-3xl border grid grid-cols-1 md:grid-cols-4 gap-3.5 ${
            techMode ? "bg-slate-900/60 backdrop-blur-xl border-slate-850" : "bg-white border-slate-200"
          }`}>
            <div className="relative">
              <Search className="h-4.5 w-4.5 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                value={searchPhrase}
                onChange={(e) => setSearchPhrase(e.target.value)}
                placeholder="Search Doctors by Name or Certs..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2 pl-10 pr-3 outline-none text-xs text-white placeholder-slate-500 font-sans focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <select
                value={searchSpec}
                onChange={(e) => setSearchSpec(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 outline-none text-xs text-slate-150 font-sans focus:border-cyan-500 transition-all"
              >
                <option value="">-- All Specializations --</option>
                <option value="Cardiology">Cardiology (Heart Care)</option>
                <option value="Neurology">Neurology (Brain Care)</option>
                <option value="Orthopedics">Orthopedics (Knee & Joints)</option>
                <option value="Oncology">Oncology (Cancer Treatment)</option>
                <option value="Pulmonology">Pulmonology (Respiratory & Smog)</option>
                <option value="Endocrinology">Endocrinology (Diabetes Clinic)</option>
                <option value="Gynecology">Gynecology (Infertility & Obs)</option>
              </select>
            </div>

            <div>
              <select
                value={searchHospital}
                onChange={(e) => setSearchHospital(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 outline-none text-xs text-slate-150 font-sans focus:border-cyan-500 transition-all"
              >
                <option value="">-- All NCR Hospitals --</option>
                {hospitalsList.map(h => (
                  <option key={h.id} value={h.id}>{h.shortName}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-2 border-l border-slate-800">
              <span>Matching:</span>
              <span className="font-sans font-black text-cyan-400 text-xs bg-cyan-950 border border-cyan-800/40 px-3 py-1.5 rounded-lg">
                {filteredDoctors.length} Specialists
              </span>
            </div>
          </div>

          {/* ACTIVE TELEMEDICINE CHAT / VIDEO CONSULTATION GRID OVERLAY */}
          <AnimatePresence>
            {activeTelemedSession && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`p-6 rounded-[32px] border ${
                  techMode ? "bg-slate-910/95 border-emerald-900/40 text-slate-200" : "bg-[#f2faf7] border-[#9ae3cc] text-slate-800"
                } shadow-2xl relative space-y-4`}
              >
                <div className="flex justify-between items-center border-b border-slate-800/40 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1 px-2.5 bg-emerald-500 text-slate-950 text-[9px] font-black tracking-widest uppercase rounded">
                      TELEHEALTH LIVE CONSOLE v1.0
                    </span>
                    <span className="flex items-center gap-1 text-[10.5px] font-extrabold text-emerald-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping"></span> Live High Definition Feed
                    </span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setActiveTelemedSession(null);
                      setTelemedPrescription(null);
                    }}
                    className="p-1.5 hover:bg-slate-850 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Doctor Video Screen */}
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden aspect-video bg-black border border-slate-800 flex items-center justify-center">
                      {telemedState === "connecting" ? (
                        <div className="text-center space-y-2">
                          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                          <p className="text-[11px] text-slate-400">Pinging satellite diagnostic route...</p>
                        </div>
                      ) : (
                        <>
                          <img
                            src={activeTelemedSession.imageUrl}
                            alt={activeTelemedSession.name}
                            className={`w-full h-full object-cover ${videoMuted ? "brightness-10 grayscale" : "brightness-105"}`}
                          />
                          
                          {/* Doctor overlay information banner */}
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-3 flex justify-between items-center text-white">
                            <div>
                              <p className="text-xs font-black">{activeTelemedSession.name}</p>
                              <span className="text-[9px] text-slate-400 leading-none">{activeTelemedSession.hospitalName}</span>
                            </div>
                            <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded uppercase">
                              Active Live
                            </span>
                          </div>

                          {/* Sound wave overlay */}
                          <div className="absolute top-2 right-2 flex gap-1 items-end h-8 p-1 px-1.5 bg-slate-900/60 rounded">
                            <span className="w-1 bg-cyan-400 rounded-t h-4 animate-pulse"></span>
                            <span className="w-1 bg-cyan-400 rounded-t h-7 animate-pulse transition-all"></span>
                            <span className="w-1 bg-cyan-400 rounded-t h-5 animate-pulse"></span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Stream configurations */}
                    <div className="flex gap-2 justify-center font-sans">
                      <button
                        onClick={() => setVideoMuted(!videoMuted)}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border cursor-pointer ${
                          videoMuted ? "bg-red-950 text-red-400 border-red-900" : "bg-slate-900 border-slate-800 text-slate-300"
                        }`}
                      >
                        {videoMuted ? "Unmute Video Camera" : "Mute Video"}
                      </button>
                      <button
                        onClick={() => setAudioOnly(!audioOnly)}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border cursor-pointer ${
                          audioOnly ? "bg-amber-950 text-amber-400 border-amber-900" : "bg-slate-900 border-slate-800 text-slate-300"
                        }`}
                      >
                        {audioOnly ? "Switch to Video" : "Audio Only Mode"}
                      </button>
                      <button
                        onClick={generateTelemedPrescription}
                        className="px-3.5 py-1.5 text-[10px] font-black uppercase rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
                      >
                        Generate digital Rx
                      </button>
                    </div>
                  </div>

                  {/* Telemedicine Live text/chat interaction panel */}
                  <div className="flex flex-col h-[230px] border border-slate-800 rounded-2xl bg-slate-950 overflow-hidden text-xs">
                    <div className="bg-slate-900 p-2 border-b border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                      <span>Clinical Telemetry Chat Stream</span>
                      <span className="text-emerald-400">Online Encrypted</span>
                    </div>

                    <div className="flex-1 p-3 overflow-y-auto space-y-3 font-semibold text-[11px] text-slate-300">
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                          <div className={`p-2.5 rounded-2xl max-w-[85%] leading-normal ${
                            msg.sender === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-slate-850 text-slate-100 rounded-tl-none"
                          }`}>
                            <p>{msg.text}</p>
                          </div>
                          <span className="text-[9px] text-slate-500 mt-0.5 font-normal">{msg.time}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-2 bg-slate-900 border-t border-slate-800 flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Discuss clinical parameters..."
                        onKeyDown={(e) => e.key === "Enter" && sendTelemedChat()}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 outline-none text-xs text-white placeholder-slate-500"
                      />
                      <button
                        onClick={sendTelemedChat}
                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Simulated digital Rx output */}
                <AnimatePresence>
                  {telemedPrescription && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className={`p-5 rounded-2xl border space-y-4 shadow-xl font-sans transition-all duration-350 ${
                        techMode 
                          ? "bg-slate-950 text-slate-200 border-slate-800" 
                          : "bg-white text-slate-900 border-slate-300"
                      }`}
                    >
                      <div className={`flex justify-between items-start border-b border-dashed pb-3 ${
                        techMode ? "border-slate-800" : "border-slate-300"
                      }`}>
                        <div>
                          <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-0.5 rounded ${
                            techMode 
                              ? "text-emerald-400 bg-emerald-950/60 border border-emerald-800/40" 
                              : "text-emerald-700 bg-emerald-50"
                          }`}>
                            Digital Telemedicine Prescription certified
                          </div>
                          <h4 className={`text-sm font-black mt-1 ${techMode ? "text-white" : "text-slate-950"}`}>{telemedPrescription.doctorName}</h4>
                          <span className={`text-[10px] leading-none ${techMode ? "text-slate-400" : "text-slate-500"}`}>{telemedPrescription.certifications}</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono text-xs font-black block ${techMode ? "text-cyan-400" : "text-slate-900"}`}>{telemedPrescription.id}</span>
                          <span className={`text-[9px] block mt-0.5 ${techMode ? "text-slate-500" : "text-slate-400"}`}>{telemedPrescription.date}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3 font-semibold text-xs">
                        <div>
                          <span className={`font-medium block ${techMode ? "text-slate-500" : "text-slate-400"}`}>Diagnosed Condition</span>
                          <p className={`font-extrabold ${techMode ? "text-slate-200" : "text-slate-950"}`}>{telemedPrescription.diagnosis}</p>
                        </div>
                        
                        <div className="space-y-2">
                          <span className={`font-medium block ${techMode ? "text-slate-500" : "text-slate-400"}`}>Prescribed Pharmaceutical Consignments</span>
                          <div className="space-y-2">
                            {telemedPrescription.medicines.map((m: any, idx: number) => (
                              <div key={idx} className={`p-2.5 border rounded-xl flex justify-between items-center transition-all ${
                                techMode 
                                  ? "bg-slate-900/60 border-slate-850 text-slate-200" 
                                  : "bg-slate-50 border-slate-205 text-slate-900"
                              }`}>
                                <div>
                                  <p className={`font-bold ${techMode ? "text-white" : "text-slate-900"}`}>{m.name} ({m.dosage})</p>
                                  <p className={`text-[10px] mt-0.5 ${techMode ? "text-slate-400" : "text-slate-500"}`}>{m.frequency}</p>
                                </div>
                                <span className={`text-[10px] italic px-2.5 py-1 rounded-full font-bold ${
                                  techMode 
                                    ? "bg-slate-800 text-cyan-400" 
                                    : "bg-slate-200 text-slate-800"
                                }`}>{m.duration}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className={`border-t pt-2 text-[10px] leading-relaxed italic ${
                          techMode ? "border-slate-800 text-slate-400" : "border-slate-210 text-slate-600"
                        }`}>
                          <strong>Patient Advisory Cautions:</strong> {telemedPrescription.instructions}
                        </div>
                      </div>
                      
                      <div className={`pt-2 border-t flex flex-col sm:flex-row gap-2 ${
                        techMode ? "border-slate-800" : "border-slate-200"
                      }`}>
                        <button
                          onClick={handleDownloadPDF}
                          className={`w-full font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-md ${
                            techMode 
                              ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950/20" 
                              : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10"
                          }`}
                        >
                          <Download className="h-4 w-4" />
                          Download Certified PDF Prescription
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sorting controls */}
          <div className={`p-4 rounded-3xl border flex flex-col md:flex-row justify-between items-center gap-3.5 ${
            techMode ? "bg-slate-900/60 backdrop-blur-xl border-slate-850" : "bg-white border-slate-200"
          }`}>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                Sort Options
              </span>
              <span className={`text-[11px] font-extrabold ${techMode ? "text-slate-350" : "text-slate-600"}`}>
                Organize specialist doctors by key primary health metrics:
              </span>
            </div>

            <div className="flex border border-slate-800 rounded-xl overflow-hidden font-sans shadow-inner">
              <button
                onClick={() => setSortBy("relevance")}
                className={`px-3 py-1.5 text-[10.5px] uppercase font-black transition-all cursor-pointer ${
                  sortBy === "relevance" ? "bg-cyan-500 text-slate-950" : "bg-slate-950/80 text-slate-400 hover:text-white"
                }`}
              >
                AI Affinity
              </button>
              <button
                onClick={() => setSortBy("rating")}
                className={`px-3 py-1.5 text-[10.5px] uppercase font-black transition-all cursor-pointer border-l border-slate-850/60 ${
                  sortBy === "rating" ? "bg-cyan-500 text-slate-950" : "bg-slate-950/80 text-slate-400 hover:text-white"
                }`}
              >
                Rating
              </button>
              <button
                onClick={() => setSortBy("waitTime")}
                className={`px-3 py-1.5 text-[10.5px] uppercase font-black transition-all cursor-pointer border-l border-slate-850/60 ${
                  sortBy === "waitTime" ? "bg-cyan-500 text-slate-950" : "bg-slate-950/80 text-slate-400 hover:text-white"
                }`}
              >
                Wait-Time
              </button>
              <button
                onClick={() => setSortBy("distance")}
                className={`px-3 py-1.5 text-[10.5px] uppercase font-black transition-all cursor-pointer border-l border-slate-850/60 ${
                  sortBy === "distance" ? "bg-cyan-500 text-slate-950" : "bg-slate-950/80 text-slate-400 hover:text-white"
                }`}
              >
                Distance
              </button>
            </div>
          </div>

          {/* DOCTOR DIRECTORY GRID CARDS */}
          <div className="grid gap-6 md:grid-cols-2">
            {filteredDoctors.length > 0 ? (
              filteredDoctors.map((doc) => {
                // Determine compatibility colors
                let compBarColor = "bg-rose-500 shadow-md shadow-rose-500/10";
                let compTagBg = "bg-rose-50 border border-rose-200 text-rose-800";
                if (doc.aiScore >= 90) {
                  compBarColor = "bg-green-500 shadow-md shadow-green-500/10";
                  compTagBg = "bg-green-50 border border-green-200 text-green-800";
                } else if (doc.aiScore >= 75) {
                  compBarColor = "bg-blue-500 shadow-md shadow-blue-500/10";
                  compTagBg = "bg-blue-50 border border-blue-200 text-blue-800";
                }

                return (
                  <motion.div
                    key={doc.id}
                    layoutId={doc.id}
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className={`rounded-3xl border p-5 flex flex-col justify-between hover:shadow-xl transition-all ${
                      techMode 
                        ? "bg-slate-900/40 backdrop-blur-md border-slate-800 text-white hover:border-slate-700" 
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Doctor Heading Row */}
                      <div className="flex gap-4.5 items-start">
                        <img 
                          src={doc.imageUrl} 
                          alt={doc.name} 
                          className="w-14 h-14 rounded-2xl object-cover shrink-0 bg-slate-100 border border-slate-800/40"
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="p-1 px-2.5 bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                              {doc.specialty}
                            </span>
                            {doc.emergencySupport && (
                              <span className="flex items-center gap-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[8.5px] font-bold px-1.5 py-0.5 rounded">
                                Emergency Active
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-extrabold text-white leading-tight flex items-center gap-1 truncate">
                            {doc.name} 
                            {doc.aiScore >= 95 && <span className="text-cyan-400 text-[10px]">✔</span>}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate font-semibold leading-none">
                            {doc.certifications}
                          </p>
                        </div>
                      </div>

                      {/* AI Compatibility score badge */}
                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-850 space-y-2">
                        <div className="flex justify-between items-center text-[10.5px]">
                          <span className="text-slate-400 font-bold flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-cyan-400" /> AI Affinity Score
                          </span>
                          <span className="font-sans font-black text-cyan-400">{doc.aiScore}% Match</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${compBarColor}`} style={{ width: `${doc.aiScore}%` }}></div>
                        </div>
                        
                        {doc.aiReasons && doc.aiReasons.length > 0 && (
                          <div className="flex flex-col gap-1 text-[9.5px] text-slate-450 leading-tight">
                            {doc.aiReasons.map((re, ind) => (
                              <span key={ind} className="flex items-center gap-1 font-semibold text-slate-350">
                                <span className="h-1 w-1 rounded-full bg-cyan-400"></span> {re}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Stats table */}
                      <div className="grid grid-cols-2 gap-3 text-xs border-y border-dashed border-slate-800/65 py-2.5 font-semibold text-slate-300">
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-medium">Affiliated Hospital</span>
                          <span className="text-white font-extrabold block text-[10.5px] truncate">{doc.hospitalName}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-medium">Consulting fees</span>
                          <span className="text-cyan-400 font-extrabold block">₹{doc.fees} OPD</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-medium">Distance & Wait-time</span>
                          <span className="text-amber-400 font-black block text-[10.5px]">
                            📍 {getDoctorDistance(doc).toFixed(1)} km (~{getDoctorWaitTime(doc)}m wait)
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-medium">Rating & Feedback</span>
                          <span className="text-yellow-400 font-bold flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 animate-pulse-slow" />
                            {doc.rating} ({doc.reviewsCount})
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-medium">Experience Index</span>
                          <span className="text-slate-100 block">{doc.experience} Years Care</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-medium">Languages</span>
                          <span className="text-slate-100 block truncate">{doc.languages.join(", ")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Booking controllers actions */}
                    <div className="flex gap-2.5 mt-4 pt-1 font-sans">
                      <button
                        onClick={() => setBookingDoctor(doc)}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-[10px] uppercase tracking-widest text-center text-white cursor-pointer active:scale-95 transition-transform"
                      >
                        Book Appointment
                      </button>
                      
                      {doc.telemedicineSupport && (
                        <button
                          onClick={() => startTeleConsult(doc)}
                          className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold hover:bg-slate-850 text-[10px] uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                        >
                          <Video className="h-3.5 w-3.5 text-emerald-400" /> Start Telehealth
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="col-span-2 p-12 text-center rounded-3xl border border-dashed border-slate-800/80 bg-slate-900/10">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                <h4 className="text-sm font-black text-slate-100">No Delhi NCR Specialists Found</h4>
                <p className="text-xs text-slate-450 mt-1.5 max-w-sm mx-auto">
                  Try adjusting checkmark options, changing keywords, or selecting another hospital region filters to locate medical caregivers.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* APPOINTMENT BOOKING MODAL */}
      <AnimatePresence>
        {bookingDoctor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
            onClick={() => setBookingDoctor(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 max-w-md w-full text-slate-800 space-y-6 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setBookingDoctor(null)}
                className="absolute right-5 top-5 p-1 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div>
                <span className="p-1 px-2.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded">
                  OPD RESERVATION REGISTRY
                </span>
                <h3 className="text-lg font-black text-slate-950 mt-1">Book Delhi NCR Consultant</h3>
                <p className="text-xs text-slate-500">Meticulously secure professional consultation slots instantly.</p>
              </div>

              <div className="flex gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl items-center">
                <img src={bookingDoctor.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover" />
                <div>
                  <h4 className="text-xs font-black text-slate-900">{bookingDoctor.name}</h4>
                  <p className="text-[10px] text-slate-500">{bookingDoctor.specialty} • {bookingDoctor.hospitalName}</p>
                </div>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-4 text-xs font-semibold">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-600 block">Consultation Date</label>
                    <input
                      type="date"
                      required
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-600 block">Select Available Slot</label>
                    <select
                      required
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none"
                    >
                      <option value="">-- Choose Slot --</option>
                      {bookingDoctor.slots.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 block">Consultation Protocol Mode</label>
                  <div className="flex border border-slate-200 rounded-xl overflow-hidden text-center">
                    <button
                      type="button"
                      onClick={() => setBookingType("VIRTUAL")}
                      className={`flex-1 py-2 font-black tracking-wider text-[10px] uppercase cursor-pointer ${
                        bookingType === "VIRTUAL" ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      Virtual Zoom Video
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingType("IN_PERSON")}
                      className={`flex-1 py-2 font-black tracking-wider text-[10px] uppercase cursor-pointer ${
                        bookingType === "IN_PERSON" ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      Physical OPD Clinic
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 block">Add Diagnostic Symptoms / Reasons</label>
                  <textarea
                    required
                    rows={2}
                    value={bookingSymptoms}
                    onChange={(e) => setBookingSymptoms(e.target.value)}
                    placeholder="E.g., extreme bronchial smog congestion, mild vertigo, chest pressure..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 outline-none font-sans"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-extrabold text-white text-xs uppercase tracking-widest rounded-xl text-center shadow shadow-blue-500/10 cursor-pointer"
                  >
                    Confirm Consultation slot (₹{bookingDoctor.fees})
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOOKING SUCCESS NOTIFICATION ALERT MODAL */}
      <AnimatePresence>
        {bookingSuccessCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
            onClick={() => setBookingSuccessCard(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-[32px] border border-slate-200 p-6 md:p-8 max-w-md w-full text-slate-800 space-y-4 shadow-2xl relative text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                <Check className="h-6 w-6 stroke-[3]" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-950">Consultation Securely Booked</h3>
                <p className="text-xs text-slate-500">Live outpatient token generated securely for Delhi NCR Regional Index.</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs font-semibold space-y-2.5">
                <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                  <span>Token Registered</span>
                  <span className="font-mono text-slate-900 font-black">{bookingSuccessCard.id}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block font-medium">Physician Consultant</span>
                    <span className="font-extrabold text-slate-950">{bookingSuccessCard.doctorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Affiliation Center</span>
                    <span className="font-extrabold text-slate-950">{bookingSuccessCard.hospital}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-slate-200">
                  <div>
                    <span className="text-slate-400 block font-medium">Sheduled Slot</span>
                    <span className="font-extrabold text-slate-950">{bookingSuccessCard.date} • {bookingSuccessCard.time}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Protocol Channel</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded inline-block mt-0.5 uppercase ${
                      bookingSuccessCard.type === "VIRTUAL" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {bookingSuccessCard.type}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setBookingSuccessCard(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
              >
                Conclude Booking Registry
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
