import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LocaleProvider, storedLocale, useI18n } from "./i18n";
import { SessionProvider, useSession } from "./lib/session";
import { LOCALES } from "./i18n/messages";
import LandingPage from "./landing/ZipLanding";

const SignInPage = lazy(() => import("./auth/SignInPage"));
const Onboarding = lazy(() => import("./onboarding/Onboarding"));
const PatientDashboard = lazy(() => import("./dashboard/PatientDashboard"));
const EmergencyPublic = lazy(() => import("./app/EmergencyPage").then((m) => ({ default: m.EmergencyPublic })));
const ModelsPublic = lazy(() => import("./app/ModelsPage").then((m) => ({ default: m.ModelsPublic })));
// The doctor, hospital and admin workspaces (and every older screen) still live in App.tsx.
// Loaded only when one of them is opened, so the landing page stays light.
const LegacyApp = lazy(() => import("../App"));

function Loading() {
  return <div className="ch grid min-h-screen place-items-center text-subtle">…</div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, user, demo, role, needsOnboarding } = useSession();
  const { href } = useI18n();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user && !demo) {
    return <Navigate to={`${href("/sign-in")}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  // Staff accounts have their own workspaces.
  if (role && role !== "PATIENT") return <Navigate to="/dashboard" replace />;
  // Signed in (e.g. a phone code just verified) but the profile is not finished yet.
  if (needsOnboarding) return <Navigate to={href("/get-started")} replace />;
  return <>{children}</>;
}

/** The first patient screens lived under /app; their links now open the matching dashboard view. */
const APP_TO_DASHBOARD: Record<string, string> = {
  home: "", assistant: "/assistant", "find-care": "/find", wallet: "/records", nutrition: "/nutrition",
  medicines: "/medicines", emergency: "/emergency", settings: "/settings", models: "/models",
};
function AppRedirect() {
  const { href } = useI18n();
  const location = useLocation();
  const part = location.pathname.split("/")[3] || "home";
  return <Navigate to={href(`/dashboard${APP_TO_DASHBOARD[part] ?? ""}`) + location.search} replace />;
}

export default function SiteRouter() {
  return (
    <SessionProvider>
      <LocaleProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Navigate to={`/${storedLocale()}`} replace />} />
            {LOCALES.map((l) => (
              <React.Fragment key={l}>
                <Route path={`/${l}`} element={<LandingPage />} />
                <Route path={`/${l}/sign-in`} element={<SignInPage />} />
                <Route path={`/${l}/get-started`} element={<Onboarding />} />
                <Route path={`/${l}/dashboard/*`} element={<RequireAuth><PatientDashboard /></RequireAuth>} />
                <Route path={`/${l}/emergency`} element={<EmergencyPublic />} />
                <Route path={`/${l}/models`} element={<ModelsPublic />} />
                <Route path={`/${l}/app/*`} element={<AppRedirect />} />
              </React.Fragment>
            ))}
            <Route path="/login" element={<Navigate to={`/${storedLocale()}/sign-in`} replace />} />
            <Route path="*" element={<LegacyApp />} />
          </Routes>
        </Suspense>
      </LocaleProvider>
    </SessionProvider>
  );
}
