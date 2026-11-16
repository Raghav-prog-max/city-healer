/**
 * Connects the three vocabularies the app uses for the same thing:
 *
 *   triage says      "Gastroenterologist / Hepatologist"   (a kind of doctor)
 *   hospitals list   "Gastroenterology", "Hepatology"      (departments)
 *   doctors carry    "Gastroenterologist"                  (one of eight categories)
 *
 * Comparing these as plain text matched almost nothing, so hospital ranking never
 * awarded its specialty points. Each specialist is mapped here to the word stems its
 * departments contain, and to the doctor category that treats it.
 */

interface SpecialistRule {
  /** Appears in the triage specialist name. */
  key: string;
  /** Stems found in the names of suitable hospital departments. */
  departments: string[];
  /** The doctor category to book. */
  doctor: string;
}

import type { DepartmentSource } from "./hospitalData";

const GENERAL_DEPARTMENTS = ["general medicine", "internal medicine", "all clinical", "preventive health", "outpatient"];

const RULES: SpecialistRule[] = [
  { key: "emergency", departments: ["emergency", "trauma", "critical care"], doctor: "Emergency Care Physician" },
  { key: "paediatric", departments: ["paediatr", "pediatr", "neonat"], doctor: "Pediatrician" },
  { key: "ophthalm", departments: ["ophthalm", "eye"], doctor: "General Physician" },
  { key: "gyn", departments: ["gyn", "obstet", "maternity"], doctor: "General Physician" },
  { key: "psychiatr", departments: ["psychiatr"], doctor: "General Physician" },
  // Not the key "ent": it is inside "gastroENTerologist".
  { key: "otolaryng", departments: ["ent", "otolaryng"], doctor: "General Physician" },
  { key: "cardiolog", departments: ["cardio", "cardiac"], doctor: "Cardiologist" },
  { key: "pulmonolog", departments: ["pulmon", "asthma", "respir"], doctor: "Pulmonologist" },
  { key: "allerg", departments: ["allerg", "pulmon", "asthma", ...GENERAL_DEPARTMENTS], doctor: "Pulmonologist" },
  { key: "gastroenterolog", departments: ["gastro", "hepat"], doctor: "Gastroenterologist" },
  { key: "hepatolog", departments: ["hepat", "gastro"], doctor: "Gastroenterologist" },
  { key: "neurolog", departments: ["neuro"], doctor: "Neurologist" },
  { key: "orthop", departments: ["ortho", "joint", "spine"], doctor: "General Physician" },
  { key: "rheumatolog", departments: ["ortho", "joint", ...GENERAL_DEPARTMENTS], doctor: "General Physician" },
  { key: "urolog", departments: ["urolog", "nephro", "renal"], doctor: "General Physician" },
  { key: "vascular", departments: ["vascular", "general surgery"], doctor: "General Physician" },
  { key: "dermatolog", departments: ["dermat", ...GENERAL_DEPARTMENTS], doctor: "General Physician" },
  { key: "endocrinolog", departments: ["endocrin", "diabet", ...GENERAL_DEPARTMENTS], doctor: "General Physician" },
  { key: "diabetolog", departments: ["diabet", "endocrin", ...GENERAL_DEPARTMENTS], doctor: "General Physician" },
  { key: "pediatric", departments: ["pediatr", "paediatr", "neonat"], doctor: "Pediatrician" },
  { key: "oncolog", departments: ["onco"], doctor: "Oncologist" },
  { key: "general physician", departments: GENERAL_DEPARTMENTS, doctor: "General Physician" },
];

/** Rules for a triage specialist such as "Neurologist / Emergency Medicine", in the order named. */
function rulesFor(specialistType: string): SpecialistRule[] {
  const parts = String(specialistType || "").toLowerCase().split("/").map((p) => p.trim()).filter(Boolean);
  const found: SpecialistRule[] = [];
  for (const part of parts) {
    const rule = RULES.find((r) => part.includes(r.key));
    if (rule && !found.includes(rule)) found.push(rule);
  }
  return found;
}

/** The hospital department that treats this specialist's cases, or null if the hospital has none. */
export function matchingDepartment(specialistType: string, hospitalSpecialties: string[]): string | null {
  for (const rule of rulesFor(specialistType)) {
    for (const stem of rule.departments) {
      const dept = (hospitalSpecialties || []).find((s) => String(s).toLowerCase().includes(stem));
      if (dept) return dept;
    }
  }
  return null;
}

/** The doctor category to book for this specialist; a general physician when none fits. */
export function doctorCategoryFor(specialistType: string): string {
  return rulesFor(specialistType)[0]?.doctor || "General Physician";
}

const SOURCE_RANK: Record<DepartmentSource, number> = { listed: 3, empanelled: 3, name: 3, standard: 1 };

/**
 * The best department this hospital has for the specialist, with where that department is
 * known from (see shared/hospitalData.ts). A listed or name-derived department beats one that
 * is only expected under a public-health standard.
 */
export function matchDepartmentWithSource(
  specialistType: string,
  hospitalSpecialties: string[],
  sources?: Record<string, DepartmentSource> | null,
): { department: string; source: DepartmentSource } | null {
  let best: { department: string; source: DepartmentSource } | null = null;
  for (const rule of rulesFor(specialistType)) {
    for (const stem of rule.departments) {
      for (const dept of hospitalSpecialties || []) {
        const name = String(dept).toLowerCase();
        // "ent" must be a whole word, or it matches "parENTal" and "gastroENTerology".
        const hit = stem === "ent" ? /ent/.test(name) : name.includes(stem);
        if (!hit) continue;
        const source = sources?.[dept] || "listed";
        if (!best || SOURCE_RANK[source] > SOURCE_RANK[best.source]) best = { department: dept, source };
      }
    }
    if (best && SOURCE_RANK[best.source] === 3) return best;
  }
  return best;
}
