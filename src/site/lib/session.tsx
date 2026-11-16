/**
 * Who is signed in, for the new UI: the Firebase user (src/firebase.ts) plus the account
 * and Firestore profile from GET /api/v1/me. Staff roles are Firebase custom claims; the
 * same session signs in the doctor / hospital / admin workspaces.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, onAuthStateChanged, signOut as fbSignOut, type MockUser } from "../../firebase";
import { setDemoSession, getDemoSessionRole } from "./demo";
import { request, CONSENT_REQUIRED_EVENT } from "./api";

export type Role = "PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN";

interface Session {
  ready: boolean;
  user: MockUser | null;
  role: Role | null;
  name: string;
  /** The signed-in user's profile (Firestore) with email and phone from the account, or null. */
  profile: any | null;
  /**
   * Signed in as a patient, but the profile is not complete or there is no valid, current consent
   * (never given, withdrawn, or the terms changed): onboarding must finish before the dashboard.
   */
  needsOnboarding: boolean;
  /** The profile is complete and only the consent is needed: onboarding shows just that step. */
  needsConsentOnly: boolean;
  /**
   * The account could not be read (server or network failure), so it is not known whether the
   * profile and consent are in place. Patient screens stay closed until a retry succeeds.
   */
  checkFailed: boolean;
  demo: boolean;
  refresh: () => void;
  signOut: () => Promise<void>;
  startDemo: () => void;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(auth.currentUser);
  // Firebase restores a saved sign-in asynchronously after a page load. Until its first report,
  // "no user" only means "not known yet": deciding then would send a signed-in person to the
  // sign-in page on every refresh.
  const [authKnown, setAuthKnown] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<any | null>(null);
  const [tick, setTick] = useState(0);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsConsentOnly, setNeedsConsentOnly] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [demo, setDemo] = useState(!!getDemoSessionRole());
  // Which sign-in the state above was worked out for. Until it matches the current one the
  // session is not ready, so no screen acts on the previous person's (or nobody's) answers.
  const sessionKey = user ? `user:${user.uid}` : demo ? "demo" : "none";
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthKnown(true); }), []);

  // A patient route answered 403 CONSENT_REQUIRED: read the account again, which routes the
  // person to the consent step.
  useEffect(() => {
    const onConsentRequired = () => setTick((n) => n + 1);
    window.addEventListener(CONSENT_REQUIRED_EVENT, onConsentRequired);
    return () => window.removeEventListener(CONSENT_REQUIRED_EVENT, onConsentRequired);
  }, []);

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
            if (!cancelled) { setRole(staff); setName(user.displayName || user.email || ""); setProfile({ email: user.email, phone: user.phoneNumber }); setNeedsOnboarding(false); setNeedsConsentOnly(false); setCheckFailed(false); }
          } else {
            const me = await request<any>("/api/v1/me");
            if (!cancelled) {
              setRole("PATIENT");
              setName(me.profile?.fullName || user.displayName || "");
              setProfile(me.profile ? { ...me.profile, email: me.email, phone: me.phoneNumber } : { email: me.email, phone: me.phoneNumber });
              // The server enforces consent on every patient route; this only decides which
              // screen to show. Anything but "valid" (including a missing answer) asks again.
              const profileDone = !!me.profile?.fullName && !!me.profile?.city;
              const consentValid = me.consent?.status === "valid";
              setNeedsOnboarding(!profileDone || !consentValid);
              setNeedsConsentOnly(profileDone && !consentValid);
              setCheckFailed(false);
            }
          }
        } catch {
          // Fail closed: not knowing is not the same as "nothing to set up". The patient
          // screens show a retry instead of opening without a profile or consent.
          if (!cancelled) { setRole("PATIENT"); setName(user.displayName || ""); setNeedsOnboarding(false); setNeedsConsentOnly(false); setCheckFailed(true); }
        }
      } else if (getDemoSessionRole()) {
        setNeedsOnboarding(false);
        setNeedsConsentOnly(false);
        setCheckFailed(false);
        setProfile(null);
        setRole("PATIENT");
        setName("");
      } else {
        setNeedsOnboarding(false);
        setNeedsConsentOnly(false);
        setCheckFailed(false);
        setProfile(null);
        setRole(null);
        setName("");
      }
      if (!cancelled) setResolvedKey(sessionKey);
    })();
    return () => { cancelled = true; };
  }, [user, demo, tick]);

  const value: Session = {
    ready: authKnown && resolvedKey === sessionKey,
    user, role, name, profile, demo, needsOnboarding, needsConsentOnly, checkFailed,
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

/**
 * Where a staff account lands: doctors in the provider workspace, hospital desks in the hospital
 * workspace, admins in provider review.
 */
export function staffHome(role: string, href: (path: string) => string) {
  return role === "DOCTOR" ? href("/provider") : role === "HOSPITAL" ? href("/hospital") : role === "ADMIN" ? href("/admin/providers") : href("/");
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
