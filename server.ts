// Must stay first: it populates process.env before any import below reads it.
import "./env";

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dns from "dns";
import { dbRun, dbGet, dbAll, initializeDatabase } from "./database";
import { detectLang } from "./shared/triage";
import { triage, TRIAGE_MODEL_LABEL } from "./shared/triageModel";
import { llmTriage } from "./server/ai/llm";
import { answerWithRetrieval } from "./server/ai/rag";
import { createFixedWindowLimiter } from "./server/rateLimit";
import { securityHeaders, bodyParserErrors, finalErrorHandler, writeRateLimit } from "./server/httpHardening";
import { scoreHospital, topK, scorePercent } from "./shared/hospitalRanking";
import { haversineKm, parseLatLng, sortByDistance, nearest, DELHI_CENTRE } from "./shared/geo";
import { matchDepartmentWithSource, doctorCategoryFor } from "./shared/specialties";
import { isUnconfirmedListing } from "./shared/hospitalData";
import { analyseLabReport, PANEL_FIELDS, type Panel } from "./shared/labModels";
import { orchestrate } from "./server/ai/orchestrator";
import { MODEL_CARDS } from "./server/ai/registry";
import { PLATFORM_MODULES, DISCLAIMER as PLATFORM_DISCLAIMER, copilotRoute, analyseText, rankProviders } from "./server/ai/platform";
import { extractDocument, MAX_DOCUMENT_BYTES } from "./server/ai/documents";
import { forecastCounts, dailySeries, MIN_DAYS } from "./shared/forecast";
import { firestore } from "./server/firebase/admin";
import { monitor } from "./server/ai/monitor";
import { lookupMedicine, searchMedicines, substitutesFor, MEDICINE_SOURCE, MEDICINE_COUNT } from "./server/medicineIndex";
import { recommendDiet, DIET_CONDITIONS, FOOD_SOURCE } from "./server/dietRecommender";
import { adminAuth, usingEmulators, firebaseConfigProblem, firebaseProjectId } from "./server/firebase/admin";
import { verifyFirebaseToken, type AuthUser, type Role } from "./server/firebase/identity";
import { providerDoctorsRouter, appointmentsRouter, verifiedProviders } from "./server/firebase/booking";
import { providerSelfRouter, adminProvidersRouter } from "./server/firebase/providers";
import { consultationsRouter, prescriptionsRouter } from "./server/firebase/consultations";
import { messagesRouter } from "./server/firebase/messages";
import { checkinRouter } from "./server/firebase/checkin";
import { rateLimit } from "./server/firebase/rateLimit";
import { requireConsent } from "./server/firebase/consent";
import { BUILD_INFO_FILE, frontendBuildProblem } from "./shared/buildEnv";
import { patientRouter } from "./server/firebase/patients";

// Fix node localhost resolution issues
dns.setDefaultResultOrder("ipv4first");

const app = express();
const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 3000;

// Anonymous access is opt-in only. Defaults to false; must be set explicitly.
const DEMO_MODE = process.env.DEMO_MODE === "true";
if (DEMO_MODE) {
  console.warn("[Security] DEMO_MODE=true — anonymous callers are served a synthetic sandbox identity. Never enable this for a real deployment.");
}

/**
 * Sign-in is Firebase Authentication (phone OTP and email/password); this server only
 * verifies Firebase ID tokens. Without a Firebase project or the local emulators nobody
 * could sign in, so refuse to start rather than run half-working.
 */
const FIREBASE_PROBLEM = firebaseConfigProblem();
if (FIREBASE_PROBLEM) {
  console.error(`[FATAL] ${FIREBASE_PROBLEM}`);
  process.exit(1);
}
console.log(usingEmulators
  ? `[Firebase] Using the local emulators (project ${firebaseProjectId}). No real accounts or SMS.`
  : `[Firebase] Using project ${firebaseProjectId}.`);

// Railway (and any PaaS) terminates TLS at a proxy, so without this every request
// reports the proxy's address as req.ip and the per-IP auth limiter becomes a single
// global bucket - one attacker could lock every user out of login. Trusting exactly
// one hop reads the real client from X-Forwarded-For without letting a client forge it.
app.set("trust proxy", 1);
app.disable("x-powered-by");
// Security headers on every response, parser errors included (server/httpHardening.ts).
app.use(securityHeaders({ production: process.env.NODE_ENV === "production" }));
app.use(express.json({ limit: "512kb" }));
// Malformed JSON is a JSON 400 {"error":"INVALID_JSON"}, not Express's HTML page.
app.use(bodyParserErrors);

/**
 * Schema creation and baseline seeding, kept as a promise so the bootstrap can
 * await it before opening the port. Starting both chains independently let the
 * server answer /api/health — the signal Railway's healthcheck and the test suite
 * both wait on — while hospitals, doctors and medicines were still being inserted,
 * so early callers saw an empty database and got "Doctor not found" on a valid id.
 */
const databaseReady = initializeDatabase()
  .then(async () => {
    console.log("[SQLite] Database schema initialized and seeded successfully.");
  })
  .catch((err) => {
    console.error("[SQLite Error] Database initialization failed:", err);
    throw err;
  });

// ----------------------------------------------------------------
// Authentication & Authorization
// ----------------------------------------------------------------


// The synthetic identity used only when DEMO_MODE=true. Its uid matches no real
// patient, so ownership-scoped queries return nothing belonging to a real person.
const DEMO_USER: AuthUser = {
  uid: "demo-sandbox-user",
  email: "demo@cityhealer.invalid",
  role: "PATIENT",
  isDemo: true
};

// Routes that carry no patient data and are reachable without a session.
const PUBLIC_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^\/api\/health$/ },
  { method: "GET", pattern: /^\/api\/hospitals$/ },
  { method: "GET", pattern: /^\/api\/doctors$/ },
  { method: "GET", pattern: /^\/api\/medicines$/ },
  // Verified-provider directory and open slots (server/firebase/booking.ts).
  { method: "GET", pattern: /^\/api\/v1\/doctors(\/[A-Za-z0-9_-]{1,128}(\/slots)?)?$/ },
  // Intelligence Platform inventory and model cards (no patient data).
  { method: "GET", pattern: /^\/api\/v1\/platform\/modules$/ },
  { method: "GET", pattern: /^\/api\/v1\/models$/ }
];

const isPublicRoute = (method: string, path: string) =>
  PUBLIC_ROUTES.some((r) => r.method === method && r.pattern.test(path));

const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.path.startsWith("/api/") || isPublicRoute(req.method, req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    if (DEMO_MODE) {
      (req as any).user = DEMO_USER;
      return next();
    }
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    // A Firebase ID token: signature, expiry, audience and revocation are all checked, so
    // a deleted or disabled account, or one whose role was just changed (set-role revokes
    // its sessions), is refused at once. Role and facility links are custom claims.
    (req as any).user = await verifyFirebaseToken(token);
    return next();
  } catch (error: any) {
    // A rejected token (bad signature, expired, revoked, disabled or deleted account) has an
    // auth/... code. Anything else means Firebase could not be reached to check it: that is
    // a 503, not "your session is invalid", or an outage would sign everyone out.
    const code = String(error?.code || error?.errorInfo?.code || "");
    if (!code.startsWith("auth/") || code === "auth/internal-error" || code === "auth/network-request-failed") {
      console.error("[Auth] Could not verify a session token:", code || error?.message);
      return res.status(503).json({ error: "Sign-in could not be checked right now. Please try again." });
    }
    // No guest fallback. An unverifiable token is rejected in every environment;
    // DEMO_MODE downgrades to the synthetic sandbox identity, never to real data.
    if (DEMO_MODE) {
      (req as any).user = DEMO_USER;
      return next();
    }
    if (process.env.LOG_AUTH_REJECTIONS === "true") console.warn(`[Auth] Token rejected: ${code}`);
    return res.status(401).json({ error: "Invalid or expired session token." });
  }
};

app.use(authenticateUser);
// Patients need a valid, current consent for every API call not explicitly exempted
// (server/firebase/consent.ts). Fails closed.
app.use(requireConsent());

const getAuthUser = (req: express.Request): AuthUser | null => (req as any).user || null;

// General write limits (BUG-015), per uid (per IP when anonymous or demo). Generous so normal
// use and the test suites never meet them; each is configurable by env (<PREFIX>_RATE_LIMIT,
// <PREFIX>_RATE_WINDOW_MS). Reads are not counted.
const TEN_MINUTES = 10 * 60 * 1000;
const writeLimit = (name: string, envPrefix: string, limit: number) =>
  writeRateLimit({ name, envPrefix, limit, windowMs: TEN_MINUTES, getUser: getAuthUser });
app.use("/api/v1/appointments", writeLimit("bookings", "BOOKING", 120));
app.all("/api/emergency/sos", writeLimit("sos", "SOS", 10));
app.all("/api/hospitals/:id/report", writeLimit("reports", "REPORT", 120));
app.all("/api/records", writeLimit("records", "RECORDS", 120));
app.all("/api/medicines/order", writeLimit("orders", "ORDER", 120));

/** Restrict a route to the listed roles. Assumes authenticateUser has already run. */
const requireRole = (...roles: Role[]) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions for this operation." });
    }
    next();
  };

/**
 * Per-user quota for the triage and knowledge-base routes. Keyed by the verified
 * uid rather than IP, so one account cannot burn the budget from many addresses, and
 * so the shared DEMO_MODE identity has a single collective bucket.
 */
// Per user per hour. The models run in this process in milliseconds, so the cap guards
// against abuse rather than cost (it was 30 when every call went to a paid API).
const AI_RATE_LIMIT = Number(process.env.AI_RATE_LIMIT) || 300;
const AI_RATE_WINDOW_MS = 60 * 60 * 1000;
// Fixed window per key (server/rateLimit.ts, A14).
const aiLimiter = createFixedWindowLimiter({ limit: AI_RATE_LIMIT, windowMs: AI_RATE_WINDOW_MS });

const aiRateLimit = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  // Every anonymous demo caller resolves to the same synthetic uid, so keying the
  // quota on uid alone gave all demo traffic one shared 30/hour bucket that a single
  // visitor could exhaust for everyone. Demo callers are metered per IP instead.
  const quotaKey = user.isDemo
    ? `demo:${req.ip || req.socket.remoteAddress || "unknown"}`
    : user.uid;

  const decision = aiLimiter.hit(quotaKey);
  if (!decision.allowed) {
    const retryAfterSeconds = decision.retryAfterSeconds;
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      error: `AI request quota exceeded (${AI_RATE_LIMIT} per hour). Please try again later.`,
      retryAfterSeconds
    });
  }
  next();
};

/**
 * Resolve the doctors.id owned by a DOCTOR account. Returns null when the account
 * is not linked, which callers must treat as "linked to no patients" (fail closed).
 */
async function resolveDoctorId(uid: string): Promise<string | null> {
  // Firebase custom claim `doctorId`, set by an administrator (npm run set-role).
  try {
    const claims = (await adminAuth.getUser(uid)).customClaims || {};
    return typeof claims.doctorId === "string" && claims.doctorId ? claims.doctorId : null;
  } catch {
    return null;
  }
}

/** Resolve the hospitals.id a HOSPITAL account administers. Null when unprovisioned. */
async function resolveHospitalId(uid: string): Promise<string | null> {
  // Firebase custom claim `hospitalId`, set by an administrator (npm run set-role).
  try {
    const claims = (await adminAuth.getUser(uid)).customClaims || {};
    return typeof claims.hospitalId === "string" && claims.hospitalId ? claims.hospitalId : null;
  } catch {
    return null;
  }
}

/**
 * Gate a write to one specific facility.
 *
 * requireRole only ever asked "is this caller a hospital?". It never asked "is this
 * caller *that* hospital", so any HOSPITAL login could zero out any facility's bed
 * census — the figures the triage engine routes ambulances on. ADMIN keeps blanket
 * access; a HOSPITAL account bound to no facility can write to none.
 */
async function callerAdministersHospital(req: express.Request, hospitalId: string): Promise<boolean> {
  const caller = getAuthUser(req)!;
  if (caller.role === "ADMIN") return true;
  if (caller.role !== "HOSPITAL") return false;
  const owned = await resolveHospitalId(caller.uid);
  return !!owned && owned === hospitalId;
}

/**
 * Gate a write to one specific clinician row. A DOCTOR may act only as themselves,
 * a HOSPITAL only for clinicians on its own roster, ADMIN for anyone.
 */
async function callerControlsDoctor(req: express.Request, doctorId: string): Promise<boolean> {
  const caller = getAuthUser(req)!;
  if (caller.role === "ADMIN") return true;
  if (caller.role === "DOCTOR") {
    return (await resolveDoctorId(caller.uid)) === doctorId;
  }
  if (caller.role === "HOSPITAL") {
    const owned = await resolveHospitalId(caller.uid);
    if (!owned) return false;
    const hosp = await dbGet("SELECT name FROM hospitals WHERE id = ?", [owned]);
    const doc = await dbGet("SELECT hospitalName FROM doctors WHERE id = ?", [doctorId]);
    return !!hosp && !!doc && hosp.name === doc.hospitalName;
  }
  return false;
}


/**
 * Up to three doctors of the given category for the copilot and symptom triage.
 *
 * Verified providers (Firestore, server/firebase/booking.ts) come first: they are the only
 * doctors that can be booked, and each is marked `bookable`. If fewer than three match, the
 * rest come from the look-only directory (SQLite sample doctors: online first, then nearest by
 * hospital, then best rated), marked `bookable: false` so no screen offers to book them.
 */
async function recommendDoctors(doctorSpecialty: string, userLat?: number, userLng?: number) {
  try {
    const wanted = doctorSpecialty.toLowerCase();
    let providers: any[] = [];
    try {
      providers = (await verifiedProviders())
        .filter((p) => String(p.specialty || "").trim().toLowerCase() === wanted)
        .slice(0, 3)
        .map((p) => ({
          id: p.id, name: p.fullName, specialty: p.specialty, hospitalName: [p.locality, p.city].filter(Boolean).join(", "),
          experience: p.experienceYears ?? null, consultationTypes: p.consultationTypes,
          verified: true, bookable: true, source: "verified_provider", distanceKm: null,
        }));
    } catch (err) {
      // The directory still answers if the provider list cannot be read.
      console.error("[recommendDoctors] verified providers unavailable:", err instanceof Error ? err.message : "unknown_error");
    }
    if (providers.length >= 3) return providers;

    const doctors = await dbAll("SELECT * FROM doctors WHERE specialty = ?", [doctorSpecialty]);
    const hospitals = await dbAll("SELECT name, lat, lng FROM hospitals");
    const byName = new Map(hospitals.map((h) => [h.name, h]));
    const origin = parseLatLng(userLat, userLng);
    const directory = doctors
      .map((d) => {
        const h = byName.get(d.hospitalName);
        return { ...d, online: !!d.online, verified: !!d.verified, bookable: false, source: "directory", distanceKm: origin && h ? Number(haversineKm(origin, h).toFixed(1)) : null };
      })
      .sort((a, b) =>
        Number(b.online) - Number(a.online) ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
        (b.rating || 0) - (a.rating || 0));
    return [...providers, ...directory].slice(0, 3);
  } catch (err) {
    console.error("[recommendDoctors Error]", err);
    return [];
  }
}

async function recommendHospitals(specialistType: string, urgencyLevel: string, userLat?: number, userLng?: number) {
  
  try {
    const list = await dbAll("SELECT * FROM hospitals WHERE COALESCE(listingStatus, 'active') != 'hidden'");
    const hospitalsFromDb = list.map((h) => ({
      ...h,
      departmentSources: h.departmentSources ? JSON.parse(h.departmentSources) : null,
      specialties: h.specialties ? JSON.parse(h.specialties) : [],
      categories: h.categories ? JSON.parse(h.categories) : [],
      empanelment: h.empanelment ? JSON.parse(h.empanelment) : [],
      inRegistry: !!h.registryId,
      nabhAccredited: !!h.nabhAccredited,
      unconfirmed: isUnconfirmedListing(h),
      hasAmbulanceSupport: !!h.hasAmbulanceSupport,
      isGovernment: !!h.isGovernment,
      hasTelemedicine: !!h.hasTelemedicine,
      hasOpdBooking: !!h.hasOpdBooking
    }));

    // Weighted scoring and top-k: shared/hospitalRanking.ts (A5).
    const origin = parseLatLng(userLat, userLng) || DELHI_CENTRE;
    const scored = hospitalsFromDb.map((h) => ({ hospital: h, ...scoreHospital(h, specialistType, urgencyLevel, origin) }));

    return topK(scored, 3, (x) => x.score).map((item) => ({
      ...item.hospital,
      distanceKM: item.distanceKM,
      travelTimeMin: item.travelTimeMin,
      // As a percentage of the best possible score, so the UI can show "Match: 87%".
      recommendationScore: scorePercent(item.score),
      matchReason: item.matchReason
    }));
  } catch (err) {
    console.error("[recommendHospitals Error]", err);
    return [];
  }
}

// ----------------------------------------------------------------
// Authentication Routes (Dedicated Backend replacement for Firebase Auth)
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Accounts: Firebase Authentication + Firestore patient profiles
// ----------------------------------------------------------------
// Sign-up, sign-in and password changes happen in the browser with the Firebase SDK
// (phone OTP or email/password). There are no /api/auth routes any more.
app.use("/api/v1/me", patientRouter());
// Verified providers, slots and Firestore-transaction booking (City_Healer_Integrated_Doctor_Booking).
app.use("/api/v1/doctors", providerDoctorsRouter());
// What the doctor does with a booking (complete, cancel, prescribe, read the patient's records).
// Mounted first: the booking router below is for patients only.
app.use("/api/v1/appointments", consultationsRouter({
  recordsOfPatient: (patientUid) => dbAll("SELECT * FROM medical_records WHERE patientId = ? ORDER BY date DESC", [patientUid]),
}));
app.use("/api/v1/prescriptions", prescriptionsRouter());
// Messages between the two parties of a booking (server/firebase/messages.ts). Also before the
// patient-only booking router, since doctors use these routes too. The limiters are in memory
// (server/firebase/rateLimit.ts). Polls are counted per open panel (uid and appointment), with
// one per-uid ceiling over all of them, so a doctor with several threads open is not refused.
const appointmentPostLimit = rateLimit({ limit: Number(process.env.MESSAGES_POST_LIMIT) || 20, windowMs: 10 * 60_000 });
const messagesPollLimit = rateLimit({ limit: Number(process.env.MESSAGES_POLL_LIMIT) || 30, windowMs: 60_000, perAppointment: true });
const queuePollLimit = rateLimit({ limit: Number(process.env.QUEUE_POLL_LIMIT) || Number(process.env.MESSAGES_POLL_LIMIT) || 30, windowMs: 60_000, perAppointment: true });
const appointmentPollCeiling = rateLimit({ limit: Number(process.env.APPOINTMENT_POLL_CEILING) || 300, windowMs: 60_000 });
app.use("/api/v1/appointments", messagesRouter({ postLimit: appointmentPostLimit, pollLimit: [appointmentPollCeiling, messagesPollLimit] }));
// Same-day check-in on in-person bookings (server/firebase/checkin.ts). Before the patient-only
// booking router too, since doctors call patients in. GET /queue has its own per-booking poll
// limiter under the same per-uid ceiling.
app.use("/api/v1/appointments", checkinRouter({ pollLimit: [appointmentPollCeiling, queuePollLimit] }));
app.use("/api/v1/appointments", appointmentsRouter());
// Doctor and admin screens for provider onboarding (server/firebase/providers.ts).
app.use("/api/v1/provider", providerSelfRouter());
app.use("/api/v1/admin/providers", adminProvidersRouter());

// ----------------------------------------------------------------
// General API Routes (Querying SQLite Database)
// ----------------------------------------------------------------

// Health route
const SERVER_STARTED_AT = new Date().toISOString();

app.get("/api/health", (req, res) => {
  // aiModel is reported so the UI can label triage results with what produced them.
  res.json({
    status: "ok",
    time: new Date(),
    aiEnabled: true,
    aiModel: TRIAGE_MODEL_LABEL,
    aiModels: MODEL_CARDS.map((m) => ({ id: m.id, name: m.name, version: m.version, status: m.status })),
    // Lets the sign-in screen offer the sandbox only where the server allows it.
    demoMode: DEMO_MODE,
    // Which Firebase the browser should talk to (emulators locally, a project in production).
    auth: { provider: "firebase", emulators: usingEmulators, projectId: firebaseProjectId }
  });
});

// GET list of hospitals
app.get("/api/hospitals", async (req, res) => {
  try {
    const list = await dbAll("SELECT * FROM hospitals WHERE COALESCE(listingStatus, 'active') != 'hidden'");
    const result = list.map((h) => ({
      ...h,
      specialties: h.specialties ? JSON.parse(h.specialties) : [],
      categories: h.categories ? JSON.parse(h.categories) : [],
      bedsReported: !!h.bedsReportedAt,
      departmentSources: h.departmentSources ? JSON.parse(h.departmentSources) : null,
      inRegistry: !!h.registryId,
      empanelment: h.empanelment ? JSON.parse(h.empanelment) : [],
      nabhAccredited: !!h.nabhAccredited,
      generalCare: !!h.generalCare,
      unconfirmed: isUnconfirmedListing(h),
      hasAmbulanceSupport: !!h.hasAmbulanceSupport,
      isGovernment: !!h.isGovernment,
      hasTelemedicine: !!h.hasTelemedicine,
      hasOpdBooking: !!h.hasOpdBooking
    }));
    // With ?lat=&lng= each hospital carries its distance and the list is nearest first.
    const origin = parseLatLng(req.query.lat, req.query.lng);
    if (!origin) return res.json(result);
    res.json(sortByDistance(result.map((h) => ({ ...h, distanceKm: Number(haversineKm(origin, h).toFixed(1)) }))));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch hospitals", message: err.message });
  }
});

// Anyone signed in can report a problem with a listing; administrators review them.
const REPORT_REASONS = ["not_a_hospital", "closed", "wrong_location", "wrong_details", "animal_hospital"];
app.post("/api/hospitals/:id/report", async (req, res) => {
  const caller = getAuthUser(req)!;
  if (caller.isDemo) return res.status(403).json({ error: "Sign in to report a problem." });
  const { reason, note } = req.body || {};
  if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: `reason must be one of ${REPORT_REASONS.join(", ")}.` });
  const hosp = await dbGet("SELECT id FROM hospitals WHERE id = ?", [req.params.id]);
  if (!hosp) return res.status(404).json({ error: "Hospital not found" });
  try {
    await dbRun(
      "INSERT INTO hospital_reports (id, hospitalId, uid, reason, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [`rep-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, hosp.id, caller.uid, reason, typeof note === "string" ? note.slice(0, 300) : null, new Date().toISOString()]);
    res.status(201).json({ success: true });
  } catch (err: any) {
    if (/UNIQUE/.test(err?.message || "")) return res.status(409).json({ error: "You have already reported this listing. Thank you." });
    res.status(500).json({ error: "Could not save the report." });
  }
});

app.get("/api/hospital-reports", requireRole("ADMIN"), async (_req, res) => {
  const rows = await dbAll(`
    SELECT r.hospitalId, h.name, h.address, h.listingStatus, r.reason, COUNT(*) AS reports, MAX(r.createdAt) AS lastAt
    FROM hospital_reports r JOIN hospitals h ON h.id = r.hospitalId
    WHERE r.status = 'open' GROUP BY r.hospitalId, r.reason ORDER BY reports DESC, lastAt DESC`);
  res.json(rows);
});

// Hide a wrong listing (or restore it). ADMIN only; the reason is kept with the listing.
app.put("/api/hospitals/:id/listing", requireRole("ADMIN"), async (req, res) => {
  const { status, reason } = req.body || {};
  if (status !== "hidden" && status !== "active") return res.status(400).json({ error: "status must be hidden or active." });
  const hosp = await dbGet("SELECT id FROM hospitals WHERE id = ?", [req.params.id]);
  if (!hosp) return res.status(404).json({ error: "Hospital not found" });
  // A restored listing is "active-reviewed", so a later enrich run does not hide it again.
  await dbRun("UPDATE hospitals SET listingStatus = ?, hiddenReason = ?, confirmation = CASE WHEN ? = 'hidden' THEN confirmation ELSE COALESCE(confirmation, 'reviewed') END WHERE id = ?", [status === "hidden" ? "hidden" : "active-reviewed", status === "hidden" ? String(reason || "reviewed by an administrator").slice(0, 200) : null, status === "hidden" ? "hidden" : "active", hosp.id]);
  await dbRun("UPDATE hospital_reports SET status = 'resolved' WHERE hospitalId = ?", [hosp.id]);
  res.json({ success: true });
});

// Hospital staff report their beds. Totals may be reported too; available counts are capped
// at the total only when a total is known. Every report is timestamped (bedsReportedAt), and
// only reported numbers are ever shown or used for routing.
app.put("/api/hospitals/:id/beds", requireRole("HOSPITAL", "ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { availableBeds, icuAvailable, emergencyOccupancy, totalBeds, icuBeds } = req.body;

  try {
    if (!(await callerAdministersHospital(req, id))) {
      return res.status(403).json({ error: "You may only modify the facility your account administers." });
    }
    const hosp = await dbGet("SELECT * FROM hospitals WHERE id = ?", [id]);
    if (!hosp) {
      return res.status(404).json({ error: "Hospital not found" });
    }

    const updates: string[] = [];
    const params: any[] = [];
    const updatedValues: any = {};

    const total = typeof totalBeds === "number" && totalBeds > 0 ? Math.round(totalBeds) : hosp.totalBeds;
    const icuTotal = typeof icuBeds === "number" && icuBeds >= 0 ? Math.round(icuBeds) : hosp.icuBeds;
    if (total !== hosp.totalBeds) { updates.push("totalBeds = ?"); params.push(total); updatedValues.totalBeds = total; }
    if (icuTotal !== hosp.icuBeds) { updates.push("icuBeds = ?"); params.push(icuTotal); updatedValues.icuBeds = icuTotal; }
    const cap = (v: number, max: number | null) => Math.max(0, max === null || max === undefined ? Math.round(v) : Math.min(max, Math.round(v)));
    if (typeof availableBeds === "number") {
      const val = cap(availableBeds, total);
      updates.push("availableBeds = ?");
      params.push(val);
      updatedValues.availableBeds = val;
    }
    if (typeof icuAvailable === "number") {
      const val = cap(icuAvailable, icuTotal);
      updates.push("icuAvailable = ?");
      params.push(val);
      updatedValues.icuAvailable = val;
    }
    if (typeof emergencyOccupancy === "number") {
      const val = Math.max(0, Math.min(100, emergencyOccupancy));
      updates.push("emergencyOccupancy = ?");
      params.push(val);
      updatedValues.emergencyOccupancy = val;
    }

    if (updates.length > 0) {
      updates.push("bedsReportedAt = ?");
      updatedValues.bedsReportedAt = new Date().toISOString();
      params.push(updatedValues.bedsReportedAt, id);
      await dbRun(`UPDATE hospitals SET ${updates.join(", ")} WHERE id = ?`, params);
    }

    res.json({ success: true, hospital: { ...hosp, ...updatedValues } });
  } catch (err: any) {
    console.error("[Bed Update Error]", err);
    res.status(500).json({ error: "Bed update failed", message: err.message });
  }
});

// The facility a HOSPITAL desk account administers (its hospitalId claim, as resolveHospitalId
// reads it), for the hospital workspace (src/site/staff/HospitalWorkspace.tsx). Includes a listing
// an administrator has hidden, so the desk can still see and update it.
app.get("/api/v1/hospital/facility", requireRole("HOSPITAL"), async (req, res) => {
  try {
    const hospitalId = await resolveHospitalId(getAuthUser(req)!.uid);
    if (!hospitalId) return res.status(404).json({ error: "NOT_LINKED", message: "This account is not linked to a facility yet." });
    const h = await dbGet("SELECT * FROM hospitals WHERE id = ?", [hospitalId]);
    if (!h) return res.status(404).json({ error: "NOT_FOUND", message: "The linked facility no longer exists." });
    res.json({
      id: h.id, name: h.name, address: h.address, phone: h.phone ?? null,
      totalBeds: h.totalBeds ?? null, availableBeds: h.availableBeds ?? null,
      icuBeds: h.icuBeds ?? null, icuAvailable: h.icuAvailable ?? null,
      emergencyOccupancy: h.emergencyOccupancy ?? null, bedsReportedAt: h.bedsReportedAt ?? null,
      listingStatus: h.listingStatus || "active",
    });
  } catch (err: any) {
    console.error("[Hospital facility Error]", err?.message);
    res.status(500).json({ error: "Could not read the facility." });
  }
});

// Register a new hospital dynamically (Onboarding Hub)
app.post("/api/hospitals", requireRole("HOSPITAL", "ADMIN"), async (req, res) => {
  const {
    name, address, totalBeds, icuBeds, phone, lat, lng, email,
    specialties, categories, hasAmbulanceSupport, ambulanceSupportCount,
    hasTelemedicine, hasOpdBooking, isGovernment
  } = req.body;

  if (!name || !address) {
    return res.status(400).json({ error: "Hospital name and address are required" });
  }

  try {
    const generatedId = "hosp-" + Date.now() + "-" + Math.floor(100 + Math.random() * 900);
    const tBeds = Number(totalBeds) || 120;
    const iBeds = Number(icuBeds) || 15;

    const newHosp = {
      id: generatedId,
      name,
      address,
      totalBeds: tBeds,
      availableBeds: tBeds,
      icuBeds: iBeds,
      icuAvailable: iBeds,
      emergencyOccupancy: 15,
      lat: Number(lat) || (28.5 + Math.random() * 0.2),
      lng: Number(lng) || (77.1 + Math.random() * 0.3),
      phone: phone || "+91 (11) 5555-5555",
      rating: 4.5,
      specialties: Array.isArray(specialties) && specialties.length > 0 ? specialties : ["General Medicine", "Emergency Care"],
      categories: Array.isArray(categories) && categories.length > 0 ? categories : ["Private hospitals", "Multi-speciality hospitals"],
      hasAmbulanceSupport: hasAmbulanceSupport === undefined ? true : !!hasAmbulanceSupport,
      ambulanceSupportCount: Number(ambulanceSupportCount) || 3,
      isGovernment: !!isGovernment,
      hasTelemedicine: hasTelemedicine === undefined ? true : !!hasTelemedicine,
      hasOpdBooking: hasOpdBooking === undefined ? true : !!hasOpdBooking,
      email: email || `contact@${name.toLowerCase().replace(/[^a-z0-9]/g, "") || "hospital"}.com`,
      doctorsAvailableCount: 5
    };

    await dbRun(`
      INSERT INTO hospitals (
        id, name, address, totalBeds, availableBeds, icuBeds, icuAvailable, 
        emergencyOccupancy, lat, lng, phone, rating, specialties, categories, 
        hasAmbulanceSupport, ambulanceSupportCount, isGovernment, hasTelemedicine, 
        hasOpdBooking, email, doctorsAvailableCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newHosp.id, newHosp.name, newHosp.address, newHosp.totalBeds, newHosp.availableBeds,
      newHosp.icuBeds, newHosp.icuAvailable, newHosp.emergencyOccupancy, newHosp.lat, newHosp.lng,
      newHosp.phone, newHosp.rating, JSON.stringify(newHosp.specialties), JSON.stringify(newHosp.categories),
      newHosp.hasAmbulanceSupport ? 1 : 0, newHosp.ambulanceSupportCount, newHosp.isGovernment ? 1 : 0,
      newHosp.hasTelemedicine ? 1 : 0, newHosp.hasOpdBooking ? 1 : 0, newHosp.email, newHosp.doctorsAvailableCount
    ]);

    res.json({ success: true, hospital: newHosp });
  } catch (err: any) {
    console.error("[Hospital Onboarding Error]", err);
    res.status(500).json({ error: "Hospital onboarding failed", message: err.message });
  }
});

// Update standard characteristics of a hospital (Management Console)
app.put("/api/hospitals/:id", requireRole("HOSPITAL", "ADMIN"), async (req, res) => {
  const { id } = req.params;
  const {
    name, address, totalBeds, availableBeds, icuBeds, icuAvailable,
    emergencyOccupancy, phone, email, specialties, categories,
    hasAmbulanceSupport, ambulanceSupportCount, hasTelemedicine, hasOpdBooking, isGovernment
  } = req.body;

  try {
    if (!(await callerAdministersHospital(req, id))) {
      return res.status(403).json({ error: "You may only modify the facility your account administers." });
    }
    const hosp = await dbGet("SELECT * FROM hospitals WHERE id = ?", [id]);
    if (!hosp) {
      return res.status(404).json({ error: "Hospital not found" });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push("name = ?"); params.push(name); }
    if (address !== undefined) { updates.push("address = ?"); params.push(address); }
    if (phone !== undefined) { updates.push("phone = ?"); params.push(phone); }
    if (email !== undefined) { updates.push("email = ?"); params.push(email); }
    
    if (totalBeds !== undefined) {
      const val = Number(totalBeds) || hosp.totalBeds;
      updates.push("totalBeds = ?");
      params.push(val);
    }
    if (availableBeds !== undefined) {
      updates.push("availableBeds = ?");
      params.push(Math.max(0, Math.min(Number(totalBeds || hosp.totalBeds), Number(availableBeds))));
    }
    if (icuBeds !== undefined) {
      const val = Number(icuBeds) || hosp.icuBeds;
      updates.push("icuBeds = ?");
      params.push(val);
    }
    if (icuAvailable !== undefined) {
      updates.push("icuAvailable = ?");
      params.push(Math.max(0, Math.min(Number(icuBeds || hosp.icuBeds), Number(icuAvailable))));
    }
    if (emergencyOccupancy !== undefined) {
      updates.push("emergencyOccupancy = ?");
      params.push(Math.max(0, Math.min(100, Number(emergencyOccupancy))));
    }

    if (specialties !== undefined) {
      updates.push("specialties = ?");
      params.push(JSON.stringify(Array.isArray(specialties) ? specialties : []));
    }
    if (categories !== undefined) {
      updates.push("categories = ?");
      params.push(JSON.stringify(Array.isArray(categories) ? categories : []));
    }
    
    if (hasAmbulanceSupport !== undefined) { updates.push("hasAmbulanceSupport = ?"); params.push(hasAmbulanceSupport ? 1 : 0); }
    if (ambulanceSupportCount !== undefined) { updates.push("ambulanceSupportCount = ?"); params.push(Number(ambulanceSupportCount) || 0); }
    if (hasTelemedicine !== undefined) { updates.push("hasTelemedicine = ?"); params.push(hasTelemedicine ? 1 : 0); }
    if (hasOpdBooking !== undefined) { updates.push("hasOpdBooking = ?"); params.push(hasOpdBooking ? 1 : 0); }
    if (isGovernment !== undefined) { updates.push("isGovernment = ?"); params.push(isGovernment ? 1 : 0); }

    if (updates.length > 0) {
      params.push(id);
      await dbRun(`UPDATE hospitals SET ${updates.join(", ")} WHERE id = ?`, params);
    }

    const updatedHosp = await dbGet("SELECT * FROM hospitals WHERE id = ?", [id]);
    res.json({
      success: true,
      hospital: {
        ...updatedHosp,
        specialties: updatedHosp.specialties ? JSON.parse(updatedHosp.specialties) : [],
        categories: updatedHosp.categories ? JSON.parse(updatedHosp.categories) : [],
        hasAmbulanceSupport: !!updatedHosp.hasAmbulanceSupport,
        isGovernment: !!updatedHosp.isGovernment,
        hasTelemedicine: !!updatedHosp.hasTelemedicine,
        hasOpdBooking: !!updatedHosp.hasOpdBooking
      }
    });
  } catch (err: any) {
    console.error("[Hospital Update Error]", err);
    res.status(500).json({ error: "Hospital update failed", message: err.message });
  }
});

// Add clinical doctors directly linked from onboarded hospital
app.post("/api/hospitals/:id/doctors", requireRole("HOSPITAL", "ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { name, specialty, rating, experience, online } = req.body;

  if (!name || !specialty) {
    return res.status(400).json({ error: "Doctor name and specialty are required" });
  }

  try {
    if (!(await callerAdministersHospital(req, id))) {
      return res.status(403).json({ error: "You may only add clinicians to the facility your account administers." });
    }

    const hosp = await dbGet("SELECT * FROM hospitals WHERE id = ?", [id]);
    if (!hosp) {
      return res.status(404).json({ error: "Hospital partner not found" });
    }

    const docId = "doc-" + Date.now();
    const newDoc = {
      id: docId,
      name,
      specialty,
      rating: Number(rating) || 4.5,
      experience: Number(experience) || 5,
      patientsServed: 120,
      online: online === undefined ? 1 : (online ? 1 : 0),
      queueCount: 0,
      hospitalName: hosp.name,
      waitTimeMin: 0,
      imageUrl: `https://i.pravatar.cc/150?u=${docId}`
    };

    await dbRun(`
      INSERT INTO doctors (id, name, specialty, rating, experience, patientsServed, online, queueCount, hospitalName, waitTimeMin, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newDoc.id, newDoc.name, newDoc.specialty, newDoc.rating, newDoc.experience,
      newDoc.patientsServed, newDoc.online, newDoc.queueCount, newDoc.hospitalName, newDoc.waitTimeMin, newDoc.imageUrl
    ]);

    // Increment doctors count in hospital
    await dbRun("UPDATE hospitals SET doctorsAvailableCount = doctorsAvailableCount + 1 WHERE id = ?", [id]);

    res.json({ success: true, doctor: { ...newDoc, online: !!newDoc.online } });
  } catch (err: any) {
    console.error("[Doctor Onboarding Error]", err);
    res.status(500).json({ error: "Doctor onboarding failed", message: err.message });
  }
});

// GET list of active Doctors
/** The Delhi NCR city in a hospital address, for filtering doctors by city. */
const NCR_CITY_PATTERNS: Array<[string, RegExp]> = [
  ["Greater Noida", /greater noida/i], ["Noida", /noida/i], ["Gurugram", /gurugram|gurgaon/i],
  ["Ghaziabad", /ghaziabad/i], ["Faridabad", /faridabad/i], ["Delhi", /delhi/i],
];
const cityFromAddress = (address: string) => NCR_CITY_PATTERNS.find(([, re]) => re.test(address || ""))?.[0] || null;
/** "Okhla Road, Sukhdev Vihar, New Delhi, Delhi 110025" -> "Sukhdev Vihar". */
const localityFromAddress = (address: string) => {
  const parts = String(address || "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length >= 3 ? parts[parts.length - 3] : parts[0] || null;
};

app.get("/api/doctors", async (req, res) => {
  try {
    const list = await dbAll(`
      SELECT d.*, h.id AS hospitalId, h.address AS hospitalAddress
      FROM doctors d LEFT JOIN hospitals h ON h.name = d.hospitalName`);
    const result = list.map(d => ({
      ...d,
      online: !!d.online,
      verified: !!d.verified,
      city: cityFromAddress(d.hospitalAddress),
      locality: localityFromAddress(d.hospitalAddress),
    }));
    // With ?lat=&lng= each doctor carries the distance to their hospital, nearest first.
    const origin = parseLatLng(req.query.lat, req.query.lng);
    if (!origin) return res.json(result);
    const hospitals = await dbAll("SELECT name, lat, lng FROM hospitals");
    const byName = new Map(hospitals.map((h) => [h.name, h]));
    res.json(sortByDistance(result.map((d) => {
      const h = byName.get(d.hospitalName);
      return { ...d, distanceKm: h ? Number(haversineKm(origin, h).toFixed(1)) : null };
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch doctors", message: err.message });
  }
});

// Toggle Doctor Online Status
app.put("/api/doctors/:id/online", requireRole("DOCTOR", "HOSPITAL", "ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { online } = req.body;

  try {
    const doc = await dbGet("SELECT * FROM doctors WHERE id = ?", [id]);
    if (!doc) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Availability drives who patients can reach, so forcing another clinician
    // offline is sabotage. A doctor may toggle only themselves.
    if (!(await callerControlsDoctor(req, id))) {
      return res.status(403).json({ error: "You may only change availability for your own clinician profile." });
    }

    const activeStatus = online ? 1 : 0;
    await dbRun("UPDATE doctors SET online = ? WHERE id = ?", [activeStatus, id]);

    res.json({ success: true, doctor: { ...doc, online: !!activeStatus } });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to toggle online status", message: err.message });
  }
});

// GET Medical Records
app.get("/api/records", async (req, res) => {
  const caller = getAuthUser(req)!;
  try {
    let list: any[];

    if (caller.role === "ADMIN") {
      list = await dbAll("SELECT * FROM medical_records");
    } else if (caller.role === "DOCTOR") {
      // Doctors read a patient's records only through a booking, with the time window and the
      // patient's consent: GET /api/v1/appointments/:id/records (server/firebase/consultations.ts).
      // This list is the caller's own records, and a doctor has none here.
      return res.json([]);
    } else {
      // PATIENT and HOSPITAL: own records only, scoped from the verified token uid.
      list = await dbAll("SELECT * FROM medical_records WHERE patientId = ?", [caller.uid]);
    }

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch medical records", message: err.message });
  }
});

// Upload diagnostic record
app.post("/api/records", async (req, res) => {
  const { title, diagnoseSummary, doctorName, attachmentName } = req.body;
  try {
    const recId = "rec-" + Date.now();
    const newRec = {
      id: recId,
      patientId: getAuthUser(req)!.uid,
      date: new Date().toISOString().split("T")[0],
      title: title || "Uploaded Health Record",
      doctorName: doctorName || "Self-Uploaded",
      diagnoseSummary: diagnoseSummary || "Uploaded file description",
      attachmentName: attachmentName || "medical_scans.jpg"
    };

    await dbRun(`
      INSERT INTO medical_records (id, patientId, date, title, doctorName, diagnoseSummary, attachmentName)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [newRec.id, newRec.patientId, newRec.date, newRec.title, newRec.doctorName, newRec.diagnoseSummary, newRec.attachmentName]);

    res.json({ success: true, record: newRec });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to upload health record", message: err.message });
  }
});

// GET Medicines
app.get("/api/medicines", async (req, res) => {
  try {
    const list = await dbAll("SELECT * FROM medicines");
    const result = list.map(m => ({
      ...m,
      requiresPrescription: !!m.requiresPrescription
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch medicines", message: err.message });
  }
});

// Search Nationwide medicines
app.post("/api/medicines/search-nationwide", aiRateLimit, async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Search query is required." });
  }

  try {
    const allMeds = await dbAll("SELECT * FROM medicines");
    const matched = allMeds.filter(m => 
      m.name.toLowerCase().includes(query.toLowerCase()) || 
      m.category.toLowerCase().includes(query.toLowerCase()) ||
      m.description.toLowerCase().includes(query.toLowerCase())
    ).map(m => ({ ...m, requiresPrescription: !!m.requiresPrescription }));

    // Orderable products from the pharmacy catalogue, plus matches from the medicine
    // retrieval model (11,498 medicines), which are information only, not for sale here.
    const reference = searchMedicines(String(query), 8);
    monitor.record("medicine-retrieval", { confidence: reference[0]?.score ?? 0, abstained: reference.length === 0, label: "search" });
    res.json({ matches: matched, reference, source: matched.length ? "catalogue+retrieval-model" : "retrieval-model", referenceSource: MEDICINE_SOURCE });
  } catch (err: any) {
    console.error("[Search Medicines Error]", err);
    res.status(500).json({ error: "Medicine search failed", message: err.message });
  }
});

// GET Pharmacy Orders
app.get("/api/medicines/orders", async (req, res) => {
  const caller = getAuthUser(req)!;
  try {
    const list =
      caller.role === "ADMIN"
        ? await dbAll("SELECT * FROM medicine_orders")
        : await dbAll("SELECT * FROM medicine_orders WHERE patientId = ?", [caller.uid]);
    const result = list.map(o => ({
      ...o,
      items: JSON.parse(o.itemsJson),
      prescriptionAttached: !!o.prescriptionAttached
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch orders", message: err.message });
  }
});

// Place Pharmacy Order
app.post("/api/medicines/order", async (req, res) => {
  const { items, totalAmount, prescriptionAttached, prescriptionName, deliveryAddress, patientName } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required to place an order" });
  }

  if (items.length > 100) {
    return res.status(400).json({ error: "An order may contain at most 100 line items." });
  }

  try {
    const orderId = "order-" + Date.now() + "-" + Math.floor(Math.random() * 100);
    const caller = getAuthUser(req)!;
    const patientId = caller.uid;
    const pName = patientName || caller.email || "Pharmacy Guest Patient";

    /**
     * Price and quantity are rebuilt from the catalogue, never taken from the body.
     * Previously `totalAmount` was stored as sent, so an order worth thousands could
     * be declared as 1; and a negative quantity ran `stock - (-500)`, minting stock.
     * The client's figures are now treated as a display hint and discarded.
     */
    const priced: Array<{ medicineId: string; name: string; quantity: number; price: number }> = [];
    let computedTotal = 0;
    const needsRx: string[] = [];

    for (const raw of items) {
      const qty = Number(raw?.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        return res.status(400).json({ error: "Each quantity must be a whole number between 1 and 100." });
      }
      const med = await dbGet("SELECT * FROM medicines WHERE id = ?", [raw?.medicineId]);
      if (!med) {
        return res.status(404).json({ error: `Unknown medicine: ${raw?.medicineId}` });
      }
      if (med.stock < qty) {
        return res.status(400).json({ error: `${med.name} has only ${med.stock} in stock.` });
      }
      if (med.requiresPrescription) needsRx.push(med.name);

      priced.push({ medicineId: med.id, name: med.name, quantity: qty, price: med.price });
      computedTotal += med.price * qty;
    }

    // requiresPrescription was returned to the client but never enforced, so
    // prescription-only medicines could be bought with nothing attached.
    if (needsRx.length > 0 && !prescriptionAttached) {
      return res.status(400).json({
        error: `A prescription is required for: ${needsRx.join(", ")}.`,
        requiresPrescription: needsRx
      });
    }

    const newOrder = {
      id: orderId,
      patientId,
      patientName: pName,
      items: priced,
      totalAmount: Number(computedTotal.toFixed(2)),
      status: "PENDING",
      prescriptionAttached: !!prescriptionAttached,
      prescriptionName: prescriptionName || "None",
      deliveryAddress: deliveryAddress || "Self Pickup at Apollo Counter",
      createdAt: new Date().toISOString()
    };

    await dbRun(`
      INSERT INTO medicine_orders (id, patientId, patientName, itemsJson, totalAmount, status, prescriptionAttached, prescriptionName, deliveryAddress, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newOrder.id, newOrder.patientId, newOrder.patientName, JSON.stringify(newOrder.items),
      newOrder.totalAmount, newOrder.status, newOrder.prescriptionAttached ? 1 : 0,
      newOrder.prescriptionName, newOrder.deliveryAddress, newOrder.createdAt
    ]);

    // Decrement from the validated line items, so quantity is always positive here.
    for (const item of priced) {
      await dbRun("UPDATE medicines SET stock = MAX(0, stock - ?) WHERE id = ?", [item.quantity, item.medicineId]);
    }

    res.json({ success: true, order: newOrder });
  } catch (err: any) {
    console.error("[Place Order Error]", err);
    res.status(500).json({ error: "Failed to place order", message: err.message });
  }
});

// Emergency SOS dispatch trigger
app.post("/api/emergency/sos", async (req, res) => {
  const { type, patientName, patientPhone, lat, lng, address } = req.body;

  try {
    const hospitalsList = await dbAll("SELECT * FROM hospitals");
    if (hospitalsList.length === 0) {
      return res.status(500).json({ error: "No responding medical facilities registered in network." });
    }

    const tLat = Number(lat) || 28.5362;
    const tLng = Number(lng) || 77.2840;

    // Closest hospital by linear scan (shared/geo.ts nearest, A6).
    const nearestHospital = nearest({ lat: tLat, lng: tLng }, hospitalsList)?.item ?? hospitalsList[0];

    const alertId = "sos-" + Date.now();
    const alert = {
      id: alertId,
      patientId: getAuthUser(req)!.uid,
      patientName: patientName || "Emergency Distress Caller",
      patientPhone: patientPhone || "+91 99999-99999",
      lat: tLat,
      lng: tLng,
      address: address || "Connaught Place, New Delhi",
      type: type || "ACCIDENT",
      status: "REPORTED",
      timestamp: new Date().toISOString(),
      assignedAmbulanceRef: "AMB-" + Math.floor(100 + Math.random() * 900),
      hospitalName: nearestHospital.name
    };

    await dbRun(`
      INSERT INTO emergency_alerts (id, patientId, patientName, patientPhone, lat, lng, address, type, status, timestamp, assignedAmbulanceRef, hospitalName)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      alert.id, alert.patientId, alert.patientName, alert.patientPhone, alert.lat, alert.lng,
      alert.address, alert.type, alert.status, alert.timestamp, alert.assignedAmbulanceRef, alert.hospitalName
    ]);

    // Dispatch ambulance from hospital
    await dbRun("UPDATE hospitals SET ambulanceSupportCount = MAX(0, ambulanceSupportCount - 1) WHERE name = ?", [nearestHospital.name]);

    res.json({ success: true, alert });
  } catch (err: any) {
    console.error("[SOS Trigger Error]", err);
    res.status(500).json({ error: "Failed to dispatch SOS alert", message: err.message });
  }
});

// GET Emergency Alerts
// Dispatch stream carries caller name, phone and GPS — responders only.
/**
 * The facility a hospital desk account administers (hospitalId claim), as its name, which is how
 * alerts record the hospital they were routed to. null for an unlinked desk.
 */
async function ownFacilityName(req: express.Request): Promise<string | null> {
  const hospitalId = await resolveHospitalId(getAuthUser(req)!.uid);
  if (!hospitalId) return null;
  const h = await dbGet("SELECT name FROM hospitals WHERE id = ?", [hospitalId]);
  return h?.name || null;
}

// Alerts hold the caller's name, phone and location: a hospital desk sees only the alerts routed
// to its own facility (an unlinked desk sees none); an administrator sees all.
app.get("/api/emergency/alerts", requireRole("HOSPITAL", "ADMIN"), async (req, res) => {
  try {
    let list: any[];
    if (getAuthUser(req)!.role === "ADMIN") {
      list = await dbAll("SELECT * FROM emergency_alerts");
    } else {
      const facility = await ownFacilityName(req);
      list = facility ? await dbAll("SELECT * FROM emergency_alerts WHERE hospitalName = ?", [facility]) : [];
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch emergency alerts", message: err.message });
  }
});

// Update SOS Alert status
app.put("/api/emergency/alerts/:id/status", requireRole("HOSPITAL", "ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const ALLOWED_SOS = ["REPORTED", "DISPATCHED", "RESOLVED"];
  if (!ALLOWED_SOS.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${ALLOWED_SOS.join(", ")}.` });
  }

  try {
    const alert = await dbGet("SELECT * FROM emergency_alerts WHERE id = ?", [id]);
    // A desk may act only on alerts routed to its own facility; any other answers like a missing one.
    if (alert && getAuthUser(req)!.role === "HOSPITAL" && alert.hospitalName !== (await ownFacilityName(req))) {
      return res.status(404).json({ error: "Distress alert registry not found" });
    }
    if (!alert) {
      return res.status(404).json({ error: "Distress alert registry not found" });
    }

    await dbRun("UPDATE emergency_alerts SET status = ? WHERE id = ?", [status, id]);

    // Restore ambulance back to home hospital if resolved
    if (status === "RESOLVED") {
      await dbRun("UPDATE hospitals SET ambulanceSupportCount = ambulanceSupportCount + 1 WHERE name = ?", [alert.hospitalName]);
    }

    res.json({ success: true, alert: { ...alert, status } });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update alert status", message: err.message });
  }
});

// ----------------------------------------------------------------
// Clinical Endpoints (trained triage model and local knowledge base)
// ----------------------------------------------------------------

// Symptom checker
app.post("/api/symptoms/check", aiRateLimit, async (req, res) => {
  const { symptoms, userLat, userLng, lang } = req.body;
  const language = lang === "hi" || lang === "en" ? lang : detectLang(String(symptoms || ""));

  if (!symptoms) {
    return res.status(400).json({ error: "Please enter your symptoms for clinical analysis." });
  }

  // Safety rules first, then (only if GEMINI_API_KEY is set) the LLM, else the trained model
  // and the rules again: server/ai/llm.ts. `engine` says which answered ("offline" | "llm:<model>").
  const result: any = await llmTriage(String(symptoms), language);
  // Route on the English specialist: the displayed one may be in Hindi.
  const specialist = result.specialistEn || result.specialistType;
  result.recommendedHospitals = await recommendHospitals(specialist, result.urgencyLevel, userLat, userLng);
  result.doctorSpecialty = doctorCategoryFor(specialist);
  result.recommendedDoctors = await recommendDoctors(result.doctorSpecialty, userLat, userLng);
  res.json(result);
});

// Lab Report Analyzer: reference ranges + trained risk models (shared/labModels.ts)
const SAMPLE_REPORTS: Record<string, { panel: Panel; values: Record<string, number> }> = {
  blood_cbc: { panel: "cbc", values: { haemoglobin: 11.2, wbc: 11800, platelets: 185000, rbc: 4.1, mcv: 74, male: 1 } },
  lipid_profile: { panel: "heart", values: { age: 52, male: 1, chestPainType: 4, restingBp: 138, cholesterol: 248, ldl: 168, hdl: 35, triglycerides: 220, fastingSugarHigh: 0, maxHeartRate: 150, exerciseAngina: 0 } },
  thyroid_panel: { panel: "thyroid", values: { tsh: 6.9, ft4: 0.85, ft3: 2.4 } },
  liver_panel: { panel: "liver", values: { age: 45, male: 1, totalBilirubin: 1.8, directBilirubin: 0.6, alkalinePhosphatase: 210, alt: 96, ast: 88, totalProtein: 6.4, albumin: 3.2, agRatio: 0.9 } },
  diabetes_panel: { panel: "diabetes", values: { glucose: 138, hba1c: 6.8, diastolicBp: 84, bmi: 27.5, age: 48 } },
};

app.get("/api/records/analyze/panels", (_req, res) => {
  res.json({ panels: PANEL_FIELDS, samples: SAMPLE_REPORTS });
});

app.post("/api/records/analyze", aiRateLimit, async (req, res) => {
  const { templateId, panel, values } = req.body || {};
  const sample = templateId ? SAMPLE_REPORTS[templateId] : null;
  const chosen: Panel | undefined = panel || sample?.panel;
  if (!chosen || !(chosen in PANEL_FIELDS)) {
    return res.status(400).json({ error: `Choose a panel: ${Object.keys(PANEL_FIELDS).join(", ")}.` });
  }
  const input = values && typeof values === "object" ? values : sample?.values || {};
  const t0 = performance.now();
  const analysis = analyseLabReport(chosen, input);
  if (analysis.risk) monitor.record(`${chosen}-risk-model`, { confidence: Math.abs(analysis.risk.probability - 0.5) * 2, abstained: false, label: analysis.risk.level, ms: performance.now() - t0 });
  res.json({ ...analysis, isSample: !values && !!sample });
});

// Medicine Guide: the medicine retrieval model (server/medicineIndex.ts)
app.post("/api/medicines/guide", aiRateLimit, async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Medicine name is required." });
  }
  const t0 = performance.now();
  const found = lookupMedicine(name);
  monitor.record("medicine-retrieval", { confidence: found.similarity, abstained: !found.match || found.similarity < 0.5, label: found.match?.name || "none", ms: performance.now() - t0 });
  if (!found.match || found.similarity < 0.35) {
    return res.json({ found: false, query: name, suggestions: searchMedicines(name, 5), source: MEDICINE_SOURCE });
  }
  res.json({
    found: true,
    query: name,
    exactMatch: found.similarity >= 0.75,
    similarity: Number(found.similarity.toFixed(3)),
    matchedIngredient: found.ingredient,
    medicine: found.match,
    substitutes: substitutesFor(found.match.name, 5),
    source: MEDICINE_SOURCE,
    catalogueSize: MEDICINE_COUNT,
  });
});

// Diet Planner: content-based recommender over Indian foods (server/dietRecommender.ts)
app.get("/api/diet/conditions", (_req, res) => res.json({ conditions: DIET_CONDITIONS, source: FOOD_SOURCE }));

app.post("/api/diet/recommend", aiRateLimit, async (req, res) => {
  const { condition, preference, seed } = req.body || {};
  if (!condition) {
    return res.status(400).json({ error: "Choose a health condition." });
  }
  const t0 = performance.now();
  const plan = recommendDiet(String(condition), String(preference || "veg"), Number(seed) || 1);
  monitor.record("diet-recommender", { confidence: 1, abstained: false, label: plan.conditionKey, ms: performance.now() - t0 });
  res.json(plan);
});

// ----------------------------------------------------------------
// City Healer AI: orchestrator, model registry and monitoring
// ----------------------------------------------------------------
const aiContext = (req: express.Request) => {
  const { lang, userLat, userLng } = req.body || {};
  return {
    lang: lang === "hi" || lang === "en" ? lang : undefined,
    lat: parseLatLng(userLat, userLng)?.lat,
    lng: parseLatLng(userLat, userLng)?.lng,
    findHospitals: recommendHospitals,
    findDoctors: recommendDoctors,
  };
};

// Health Copilot: every message goes through the orchestrator.
app.post("/api/ai/copilot", aiRateLimit, async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Type a message." });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message is too long (2000 characters maximum)." });
  }
  try {
    res.json(await orchestrate(message.trim(), aiContext(req)));
  } catch (err: any) {
    console.error("[Copilot Error]", err);
    res.status(500).json({ error: "The assistant could not answer. For an emergency call 112." });
  }
});

// Retrieval-augmented answer over the medicine dataset (server/ai/rag.ts, A10): top-k cited
// passages, then a templated answer (or, with GEMINI_API_KEY, an LLM answer limited to them).
app.post("/api/v1/knowledge/ask", aiRateLimit, async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!question || question.length > 500) return res.status(400).json({ error: "question must be 1 to 500 characters." });
  const k = Number(req.body?.k) || 3;
  try {
    res.json(await answerWithRetrieval(question, { k }));
  } catch (err) {
    console.error("[knowledge ask]", (err as Error)?.message);
    res.status(500).json({ error: "The question could not be answered." });
  }
});

// Model registry and model cards.
app.get("/api/ai/models", (_req, res) => res.json({ models: MODEL_CARDS }));

// ---------------------------------------------------------------------------------------------
// Intelligence Platform (City_Healer_Intelligence_Platform_Seven_Modules.zip), ported from its
// FastAPI service into this server: the same routes under /api/v1, behind Firebase identity
// instead of a shared API key, using this app's trained models. See server/ai/platform.ts.

app.get("/api/v1/platform/modules", (_req, res) => res.json({ modules: PLATFORM_MODULES }));
app.get("/api/v1/models", (_req, res) => res.json({ models: MODEL_CARDS }));

// Module 1: the copilot in the zip's response shape (answer, disclaimer, intent, safety, route).
app.post("/api/v1/copilot/chat", aiRateLimit, async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 2000) return res.status(400).json({ error: "message must be 1 to 2000 characters." });
  const language = ["auto", "en", "hi", "hinglish"].includes(req.body?.language) ? req.body.language : "auto";
  try {
    const ctx = aiContext(req);
    if (language === "hi") ctx.lang = "hi";
    else if (language === "en" || language === "hinglish") ctx.lang = "en";
    const reply = await orchestrate(message, ctx);
    const route = copilotRoute(reply);
    res.json({
      answer: reply.reply,
      disclaimer: `${reply.disclaimer} ${PLATFORM_DISCLAIMER}`,
      intent: { intent: reply.intent, confidence: reply.confidence },
      safetyFlags: route === "urgent_human_care" ? ["possible_urgent_symptom_language"] : [],
      route,
      card: reply.card ?? null,
      model: { id: "city-healer-orchestrator", models: [...new Set(reply.trace.map((t) => t.model))] },
    });
  } catch (err) {
    console.error("[Copilot v1 Error]", err);
    res.status(500).json({ error: "The assistant could not answer. For an emergency call 112." });
  }
});

// Module 2: intent (trained), language and entity candidates.
app.post("/api/v1/nlp/analyze", aiRateLimit, (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > 2000) return res.status(400).json({ error: "text must be 1 to 2000 characters." });
  res.json(analyseText(text));
});

// Module 3: a report file as the raw request body (text/plain or application/pdf), its name in
// ?filename=. Read in memory, never stored or logged.
app.post("/api/v1/documents/extract", aiRateLimit,
  express.raw({ type: ["application/pdf", "text/plain", "text/csv", "application/octet-stream"], limit: MAX_DOCUMENT_BYTES }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "Send the file as the request body (Content-Type application/pdf or text/plain)." });
    const filename = String(req.query.filename || "").slice(0, 200);
    try {
      res.json(await extractDocument(filename, new Uint8Array(req.body)));
    } catch (err) {
      console.error("[Document extract Error]", (err as Error)?.message);
      res.status(500).json({ error: "The document could not be read." });
    }
  });

// Module 4: demand forecast from counts supplied by staff, or from this app's own daily totals.
app.post("/api/v1/ml/demand-forecast", requireRole("HOSPITAL", "ADMIN"), (req, res) => {
  const counts = req.body?.dailyCounts ?? req.body?.daily_counts;
  const horizon = Number(req.body?.horizonDays ?? req.body?.horizon_days ?? 7);
  if (!Array.isArray(counts) || counts.length > 365) return res.status(400).json({ error: `dailyCounts must be a list of ${MIN_DAYS} to 365 daily counts.` });
  try { res.json(forecastCounts(counts.map(Number), horizon)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});

app.get("/api/v1/ml/demand-forecast", requireRole("ADMIN"), async (req, res) => {
  const series = String(req.query.series || "appointments");
  const days = Math.min(365, Math.max(MIN_DAYS, Number(req.query.days) || 90));
  const horizon = Math.min(30, Math.max(1, Number(req.query.horizon) || 7));
  try {
    let dates: string[] = [];
    if (series === "appointments") {
      // Every booking lives in Firestore (server/firebase/booking.ts); count them by start date.
      // A Firestore failure is a failed forecast (500), not "too little activity".
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const snap = await firestore.collection("appointments").where("startsAt", ">=", since).get();
      dates = snap.docs.map((d) => String(d.get("startsAt")));
    } else if (series === "emergencies") {
      dates = (await dbAll("SELECT timestamp FROM emergency_alerts")).map((r) => r.timestamp);
    } else {
      return res.status(400).json({ error: "series must be appointments or emergencies." });
    }
    const { start, counts } = dailySeries(dates, days);
    const active = counts.filter((c) => c > 0).length;
    if (active < 3) {
      return res.json({ series, start, counts, forecast: null, message: `Too little activity to forecast: ${active} of the last ${days} days had any ${series}.` });
    }
    res.json({ series, start, counts, ...forecastCounts(counts, horizon) });
  } catch (err) {
    console.error("[forecast]", err);
    res.status(500).json({ error: "Forecast failed." });
  }
});

// Module 5: rank verified providers for a request. Provider records come only from the server's
// own Firestore; nothing the browser sends can make a provider eligible.
app.post("/api/v1/discovery/rank", aiRateLimit, async (req, res) => {
  const b = req.body || {};
  const ok = typeof b.specialty === "string" && b.specialty.length >= 2 && b.specialty.length <= 100
    && typeof b.city === "string" && b.city.length >= 2 && b.city.length <= 50;
  if (!ok) return res.status(400).json({ error: "specialty and city are required." });
  const ct = b.consultationType ?? b.consultation_type, pl = b.preferredLanguage ?? b.preferred_language;
  const consultationType = ["online", "in_person"].includes(ct) ? ct : null;
  const preferredLanguage = ["en", "hi", "hinglish"].includes(pl) ? pl : null;
  try {
    const snap = await firestore.collection("doctors").where("verificationStatus", "==", "verified").where("listingStatus", "==", "active").limit(500).get();
    const ranked = rankProviders(snap.docs.map((d) => ({ id: d.id, ...d.data() })), { specialty: b.specialty, city: b.city, consultationType, preferredLanguage });
    res.json({
      results: ranked.slice(0, 20).map(({ provider: p, score, reasons }) => ({
        doctor: { id: p.id, fullName: p.fullName, specialty: p.specialty, city: p.city, locality: p.locality, consultationTypes: p.consultationTypes, languages: p.languages, consultationFee: p.consultationFee },
        score, reasons,
      })),
      method: "explainable weighted rules: specialty 50, city 30, consultation type 10, language 5; verified and active only",
    });
  } catch (err) {
    console.error("[discovery rank]", err);
    res.status(500).json({ error: "Ranking failed." });
  }
});


// Live monitoring: calls, abstentions, confidence, latency, unknown-input rate per model.
app.get("/api/ai/monitoring", requireRole("ADMIN"), (_req, res) => res.json({ since: SERVER_STARTED_AT, models: monitor.snapshot() }));

// Developer console: the same orchestrator, with its step-by-step trace.
app.post("/api/developer/ai-pipeline", aiRateLimit, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Prompt query is required." });
  }
  try {
    const r = await orchestrate(String(prompt), aiContext(req));
    res.json({
      intent: r.intent,
      confidence: r.confidence,
      plan: r.trace.map((s) => `${s.step}: ${s.model}`),
      executionLogs: [`[Orchestrator] "${prompt}"`, ...r.trace.map((s) => `${s.step} -> ${s.model}: ${s.detail} (${s.ms} ms)`)],
      result: r.reply,
      card: r.card,
      source: "city-healer-orchestrator",
    });
  } catch (err: any) {
    console.error("[Developer Pipeline Error]", err);
    res.status(500).json({ error: "Pipeline failed", message: err.message });
  }
});

// ----------------------------------------------------------------
// Development/Production Serve Configuration
// ----------------------------------------------------------------
async function initServer() {
  // Nothing may be served until the tables exist and the baseline rows are in:
  // the port opening is what every readiness probe treats as "this server can
  // answer questions about hospitals and doctors".
  await databaseReady;

  // Any /api route not defined above (including the retired SQLite appointment, queue and chat
  // routes) is a JSON 404, never the frontend's index.html.
  app.use("/api", (_req, res) => res.status(404).json({ error: "NOT_FOUND", message: "No such API route." }));

  if (process.env.API_ONLY === "true") {
    // Used by the access-matrix suite: the API is the subject under test, and
    // booting Vite to compile a 600KB client adds minutes for no benefit.
    console.log("[Server] API_ONLY=true — skipping the frontend middleware.");
  } else if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Refuse to serve a frontend compiled for the wrong Firebase (for example one built with a
    // developer's .env.local in emulator mode): it would load, and nobody could sign in.
    let buildInfo: any = null;
    try { buildInfo = JSON.parse(fs.readFileSync(path.join(distPath, BUILD_INFO_FILE), "utf8")); } catch { /* an older build has no record */ }
    const buildProblem = frontendBuildProblem(buildInfo, { usingEmulators, projectId: firebaseProjectId });
    if (buildProblem) throw new Error(`[FATAL] ${buildProblem}`);
    if (!buildInfo) console.warn(`[Server] dist/${BUILD_INFO_FILE} not found: cannot confirm which Firebase the frontend was built for.`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Last: an unhandled error is a JSON 500 without a stack trace.
  app.use(finalErrorHandler);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[City Healer Service Online] Listening securely on port ${PORT}`);
  });
}

initServer().catch((error) => {
  // Refusing to listen is deliberate. A server that is up but cannot reach its
  // database looks healthy to the platform and fails every real request, which is
  // strictly worse than a restart.
  console.error("Failed to bootstrap full stack Express framework:", error);
  process.exit(1);
});
