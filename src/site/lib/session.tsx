/**
 * Who is signed in, for the new UI: the Firebase user (src/firebase.ts) plus the account
 * and Firestore profile from GET /api/v1/me. Staff roles are Firebase custom claims; the
 * same session signs in the doctor / hospital / admin workspaces.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, onAuthStateChanged, signOut as fbSignOut, type MockUser } from "../../firebase";
import { setDemoSession, getDemoSessionRole } from "../../utils/api";
import { request } from "./api";

export type Role = "PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN";

interface Session {
  ready: boolean;
  user: MockUser | null;
  role: Role | null;
  name: string;
  /** The signed-in user's profile (Firestore) with email and phone from the account, or null. */
  profile: any | null;
  /** Signed in, but the patient profile is not complete yet: onboarding must finish it. */
  needsOnboarding: boolean;
  demo: boolean;
  refresh: () => void;
  signOut: () => Promise<void>;
  startDemo: () => void;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(auth.currentUser);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<any | null>(null);
  const [tick, setTick] = useState(0);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [demo, setDemo] = useState(!!getDemoSessionRole());
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user) {
        // A real sign-in ends any earlier "Try the demo" session (setDemoSession's contract).
        if (getDemoSessionRole()) { setDemoSession(null); if (!cancelled) setDemo(false); }
        try {
          // Staff (doctor / hospital / admin) are recognised from their token claims; the
          // patient-only /api/v1/me is not for them.
          const claims = (await user.getIdTokenResult()).claims;
          const claimRole = String(claims.role || "patient");
          const staff = ({ doctor: "DOCTOR", hospital: "HOSPITAL", admin: "ADMIN" } as Record<string, Role>)[claimRole];
          if (staff) {
            if (!cancelled) { setRole(staff); setName(user.displayName || user.email || ""); setProfile({ email: user.email, phone: user.phoneNumber }); setNeedsOnboarding(false); }
          } else {
            const me = await request<any>("/api/v1/me");
            if (!cancelled) {
              setRole("PATIENT");
              setName(me.profile?.fullName || user.displayName || "");
              setProfile(me.profile ? { ...me.profile, email: me.email, phone: me.phoneNumber } : { email: me.email, phone: me.phoneNumber });
              setNeedsOnboarding(!me.profile?.fullName || !me.profile?.city);
            }
          }
        } catch {
          if (!cancelled) { setRole("PATIENT"); setName(user.displayName || ""); setNeedsOnboarding(false); }
        }
      } else if (getDemoSessionRole()) {
        setNeedsOnboarding(false);
        setProfile(null);
        setRole("PATIENT");
        setName("");
      } else {
        setNeedsOnboarding(false);
        setProfile(null);
        setRole(null);
        setName("");
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user, demo, tick]);

  const value: Session = {
    ready, user, role, name, profile, demo, needsOnboarding,
    refresh: () => setTick((n) => n + 1),
    signOut: async () => {
      setDemoSession(null);
      setDemo(false);
      await fbSignOut(auth);
    },
    startDemo: () => {
      setDemoSession("PATIENT");
      setDemo(true);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
