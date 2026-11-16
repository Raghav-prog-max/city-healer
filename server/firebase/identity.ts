/**
 * Who is calling: verifies the Firebase ID token in "Authorization: Bearer ..." and maps its
 * custom claims to this server's roles. Adapted from the zip's src/middleware/authenticate.ts.
 *
 * Roles are Firebase custom claims, set only by an administrator (scripts/set-role.ts):
 *   role        patient | caregiver | doctor | hospital | admin   (absent = patient)
 *   doctorId    for doctors: the row in `doctors` this account is (scopes their patients)
 *   hospitalId  for hospital staff: the facility they administer (scopes bed updates)
 * A user can never set their own claims; the client SDK has no way to.
 */
import { adminAuth } from "./admin";

export type Role = "PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN";

export interface AuthUser {
  uid: string;
  email: string;
  phone?: string;
  role: Role;
  /** "caregiver" accounts use the patient routes; kept so they can be told apart later. */
  claimRole?: string;
  doctorId?: string;
  hospitalId?: string;
  isDemo?: boolean;
}

const CLAIM_TO_ROLE: Record<string, Role> = {
  patient: "PATIENT",
  caregiver: "PATIENT",
  doctor: "DOCTOR",
  hospital: "HOSPITAL",
  admin: "ADMIN",
};

export const ROLE_TO_CLAIM: Record<Role, string> = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  HOSPITAL: "hospital",
  ADMIN: "admin",
};

/**
 * Verify a Firebase ID token. checkRevoked: a disabled or deleted account, or one whose
 * sessions were revoked (e.g. after a role change), is refused at once rather than when its
 * one-hour token expires. Throws on any invalid token.
 */
export async function verifyFirebaseToken(token: string): Promise<AuthUser> {
  const decoded = await adminAuth.verifyIdToken(token, true);
  const claim = typeof decoded.role === "string" ? decoded.role : "patient";
  return {
    uid: decoded.uid,
    email: decoded.email || "",
    phone: decoded.phone_number,
    role: CLAIM_TO_ROLE[claim] || "PATIENT",
    claimRole: claim,
    doctorId: typeof decoded.doctorId === "string" ? decoded.doctorId : undefined,
    hospitalId: typeof decoded.hospitalId === "string" ? decoded.hospitalId : undefined,
  };
}
