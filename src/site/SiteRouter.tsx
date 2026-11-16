import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LocaleProvider, storedLocale, useI18n } from "./i18n";
import { SessionProvider, useSession, staffHome } from "./lib/session";
import { LOCALES } from "./i18n/messages";
import LandingPage from "./landing/ZipLanding";
import { ErrorNote } from "./components/ui";

const SignInPage = lazy(() => import("./auth/SignInPage"));
const Onboarding = lazy(() => import("./onboarding/Onboarding"));
const PatientDashboard = lazy(() => import("./dashboard/PatientDashboard"));
const ProviderWorkspace = lazy(() => import("./staff/ProviderWorkspace"));
const AdminProviders = lazy(() => import("./staff/AdminProviders"));
const AdminHospitals = lazy(() => import("./staff/AdminHospitals"));
const HospitalWorkspace = lazy(() => import("./staff/HospitalWorkspace"));
const NotFoundPage = lazy(() => import("./app/NotFoundPage"));
const EmergencyPublic = lazy(() => import("./app/EmergencyPage").then((m) => ({ default: m.EmergencyPublic })));
const ModelsPublic = lazy(() => import("./app/ModelsPage").then((m) => ({ default: m.ModelsPublic })));

function Loading() {
  return <div className="ch grid min-h-screen place-items-center text-subtle">…</div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, user, demo, role, needsOnboarding, checkFailed, refresh } = useSession();
  const { href, t } = useI18n();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user && !demo) {
    return <Navigate to={`${href("/sign-in")}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  // Staff accounts have their own workspaces.
  if (role && role !== "PATIENT") return <Navigate to={staffHome(role, href)} replace />;
  // The account could not be read, so the profile and consent are unknown: stay closed and
  // offer a retry rather than opening the dashboard (the server refuses its data anyway).
  if (checkFailed) {
    return (
      <div className="ch grid min-h-screen place-items-center px-4">
        <div className="max-w-[440px]"><ErrorNote message={t.app.accountCheckFailed} onRetry={refresh} /></div>
      </div>
    );
  }
  // Signed in (e.g. a phone code just verified) but the profile is not finished, or there is
  // no valid, current consent (never given, withdrawn, or the terms changed).
  if (needsOnboarding) return <Navigate to={href("/get-started")} replace />;
  return <>{children}</>;
}

/** A staff screen: signed in with exactly this role. The server enforces the same on every call. */
function RequireRole({ role, children }: { role: "DOCTOR" | "HOSPITAL" | "ADMIN"; children: React.ReactNode }) {
  const session = useSession();
  const { href, t } = useI18n();
  const location = useLocation();
  if (!session.ready) return <Loading />;
  if (!session.user) return <Navigate to={`${href("/sign-in")}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (session.role !== role) {
    return (
      <div className="ch grid min-h-screen place-items-center px-4">
        <div className="max-w-[440px]"><ErrorNote message={t.staff.wrongRole} /></div>
      </div>
    );
  }
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
                <Route path={`/${l}/provider`} element={<RequireRole role="DOCTOR"><ProviderWorkspace /></RequireRole>} />
                <Route path={`/${l}/hospital`} element={<RequireRole role="HOSPITAL"><HospitalWorkspace /></RequireRole>} />
                <Route path={`/${l}/admin/providers`} element={<RequireRole role="ADMIN"><AdminProviders /></RequireRole>} />
                <Route path={`/${l}/admin/hospitals`} element={<RequireRole role="ADMIN"><AdminHospitals /></RequireRole>} />
                <Route path={`/${l}/emergency`} element={<EmergencyPublic />} />
                <Route path={`/${l}/models`} element={<ModelsPublic />} />
                <Route path={`/${l}/app/*`} element={<AppRedirect />} />
              </React.Fragment>
            ))}
            <Route path="/login" element={<Navigate to={`/${storedLocale()}/sign-in`} replace />} />
            {/* The earlier workspace lived at /dashboard (no language prefix); old links land on the
                dashboard, which sends staff accounts on to their own workspace. */}
            <Route path="/dashboard" element={<Navigate to={`/${storedLocale()}/dashboard`} replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </LocaleProvider>
    </SessionProvider>
  );
}
