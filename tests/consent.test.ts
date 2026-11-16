/**
 * Server-side consent enforcement (P0.2; server/firebase/consent.ts), against the Firebase
 * emulators. A patient without a valid, current consent is refused on every route that
 * processes personal or health data (403 CONSENT_REQUIRED), while onboarding, public browsing
 * and emergency SOS stay open. Recording consent unlocks the routes at once; withdrawing it
 * locks them again at once. Staff are not gated. If consent cannot be checked, the request is
 * refused, never let through.
 *
 *   npm run test:server
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createActor, writeConsentEvent, requireEmulators, firebaseAdmin, type Actor } from "./helpers/firebaseAccounts";
import { TERMS_VERSION, PRIVACY_VERSION } from "../shared/consent";

const PORT = Number(process.env.TEST_PORT) || 3803;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.consent.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);
let server: ChildProcessWithoutNullStreams;
const a: Record<string, Actor> = {};

async function api(method: string, route: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: payload };
}

const currentConsent = { termsAccepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, marketingOptIn: false };

/** Every kind of patient route that handles personal or health data. */
const GATED: Array<[string, string, unknown?]> = [
  ["POST", "/api/symptoms/check", { symptoms: "fever and cough for two days" }],
  ["POST", "/api/v1/copilot/chat", { message: "I have a headache" }],
  ["POST", "/api/v1/nlp/analyze", { text: "I have a headache" }],
  ["POST", "/api/ai/copilot", { message: "I have a headache" }],
  ["POST", "/api/records/analyze", { panel: "sugar", values: {} }],
  ["POST", "/api/v1/documents/extract", { text: "Hemoglobin 13.2" }],
  ["POST", "/api/diet/recommend", { condition: "diabetes" }],
  ["POST", "/api/medicines/guide", { name: "paracetamol" }],
  ["GET", "/api/records"],
  ["POST", "/api/records", { title: "Blood test", doctorName: "Dr X", diagnoseSummary: "private" }],
  ["GET", "/api/appointments"],
  ["POST", "/api/appointments", { doctorId: "doc-1", patientName: "Nora", symptoms: "cough" }],
  ["GET", "/api/v1/appointments/mine"],
  ["POST", "/api/v1/appointments", { slotId: "any" }],
  ["GET", "/api/queue"],
  ["POST", "/api/queue/take", { doctorId: "doc-1" }],
  ["GET", "/api/medicines/orders"],
  ["POST", "/api/medicines/order", { items: [], totalAmount: 0 }],
  ["POST", "/api/hospitals/hosp-1/report", { reason: "wrong phone" }],
];

async function auditActions(uid: string): Promise<string[]> {
  const { firestore } = await firebaseAdmin();
  const snap = await firestore.collection("auditLogs").where("actorUid", "==", uid).get();
  return snap.docs.map((d) => String(d.data().action));
}

before(async () => {
  requireEmulators();
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true });
  server = spawn("npx", ["tsx", "server.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DB_PATH: TEST_DB, DEMO_MODE: "false", NODE_ENV: "development", API_ONLY: "true", DISABLE_HMR: "true", CONSENT_MAX_AGE_DAYS: "" },
    shell: process.platform === "win32",
  });
  server.stdout.on("data", (d) => { if (process.env.TEST_SERVER_LOGS === "true") process.stdout.write(d); });
  server.stderr.on("data", (d) => { if (process.env.TEST_SERVER_LOGS === "true") process.stderr.write(d); });
  const deadline = Date.now() + 60_000;
  for (;;) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* not up */ }
    if (Date.now() > deadline) throw new Error("test server did not start");
    await new Promise((r) => setTimeout(r, 400));
  }

  // Patients with no consent at all (as an account made directly with the Firebase SDK, or one
  // whose onboarding was interrupted, would be).
  a.nora = await createActor("nora@consent.invalid", "Nora NoConsent", "PATIENT", {}, { consent: false });
  a.wren = await createActor("wren@consent.invalid", "Wren Withdraws", "PATIENT", {}, { consent: false });
  // Consent states written directly, before each patient's first call.
  a.olga = await createActor("olga@consent.invalid", "Olga Outdated", "PATIENT", {}, { consent: false });
  await writeConsentEvent(a.olga.uid, { termsVersion: "2025-01-01", privacyVersion: "2025-01-01" });
  a.ivan = await createActor("ivan@consent.invalid", "Ivan Invalid", "PATIENT", {}, { consent: false });
  await writeConsentEvent(a.ivan.uid, { termsAccepted: false });
  a.wade = await createActor("wade@consent.invalid", "Wade Withdrawn", "PATIENT", {}, { consent: false });
  await writeConsentEvent(a.wade.uid, { recordedAt: new Date(Date.now() - 2 * 86_400_000) });
  await writeConsentEvent(a.wade.uid, { action: "withdraw", recordedAt: new Date(Date.now() - 86_400_000) });
  a.rhea = await createActor("rhea@consent.invalid", "Rhea Regranted", "PATIENT", {}, { consent: false });
  await writeConsentEvent(a.rhea.uid, { action: "withdraw", recordedAt: new Date(Date.now() - 2 * 86_400_000) });
  await writeConsentEvent(a.rhea.uid, { recordedAt: new Date(Date.now() - 86_400_000) });
  // A consented patient and staff.
  a.cora = await createActor("cora@consent.invalid", "Cora Consented", "PATIENT");
  a.doctor = await createActor("dr@consent.invalid", "Dr Staff", "DOCTOR", { doctorId: "doc-1" });
  a.hospital = await createActor("desk@consent.invalid", "Hospital Desk", "HOSPITAL", { hospitalId: "hosp-1" });
  a.admin = await createActor("admin@consent.invalid", "Admin", "ADMIN");
});

after(() => {
  if (server?.pid && process.platform === "win32") {
    try { spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
  }
  server?.kill();
  try { if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true }); } catch { /* windows lock */ }
});

describe("a patient with no consent", () => {
  for (const [method, route, body] of GATED) {
    test(`${method} ${route} is refused with CONSENT_REQUIRED`, async () => {
      const r = await api(method, route, a.nora.token, body);
      assert.equal(r.status, 403, JSON.stringify(r.body));
      assert.equal(r.body.error, "CONSENT_REQUIRED");
      assert.equal(r.body.consentStatus, "missing");
    });
  }

  test("the refusal carries no data, only what the app needs to ask again", async () => {
    const r = await api("GET", "/api/records", a.nora.token);
    assert.deepEqual(Object.keys(r.body).sort(), ["consentStatus", "error", "message"]);
  });

  test("the account route still answers and reports the missing consent with the versions to accept", async () => {
    const r = await api("GET", "/api/v1/me", a.nora.token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.consent, { status: "missing", termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  });

  test("the profile can still be saved (onboarding saves it before the consent)", async () => {
    const r = await api("PUT", "/api/v1/me/profile", a.nora.token, { locality: "Saket" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });

  test("public browsing still works", async () => {
    for (const route of ["/api/health", "/api/hospitals", "/api/doctors", "/api/medicines", "/api/v1/doctors", "/api/v1/models", "/api/ai/models", "/api/v1/platform/modules"]) {
      const r = await api("GET", route, a.nora.token);
      assert.equal(r.status, 200, `${route}: ${JSON.stringify(r.body).slice(0, 200)}`);
    }
  });

  test("emergency SOS is never blocked by consent", async () => {
    const r = await api("POST", "/api/emergency/sos", a.nora.token, { type: "OTHER", patientName: "Nora", patientPhone: "9999900000", lat: 28.61, lng: 77.21 });
    assert.notEqual(r.body?.error, "CONSENT_REQUIRED");
    assert.ok(r.status >= 200 && r.status < 300, `SOS answered ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  });

  test("without a session the answer is still 401, not a consent prompt", async () => {
    const r = await api("GET", "/api/records");
    assert.equal(r.status, 401);
  });

  test("another patient's consent does not count", async () => {
    assert.equal((await api("GET", "/api/records", a.cora.token)).status, 200);
    assert.equal((await api("GET", "/api/records", a.nora.token)).status, 403);
  });
});

describe("recording consent", () => {
  test("terms not accepted is rejected", async () => {
    const r = await api("POST", "/api/v1/me/consents", a.nora.token, { ...currentConsent, termsAccepted: false });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "VALIDATION_ERROR");
  });

  test("an older version cannot be accepted, and the answer names the current ones", async () => {
    const r = await api("POST", "/api/v1/me/consents", a.nora.token, { ...currentConsent, termsVersion: "2025-01-01" });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, "CONSENT_VERSION_MISMATCH");
    assert.equal(r.body.termsVersion, TERMS_VERSION);
    assert.equal(r.body.privacyVersion, PRIVACY_VERSION);
  });

  test("unknown fields are rejected", async () => {
    const r = await api("POST", "/api/v1/me/consents", a.nora.token, { ...currentConsent, uid: a.cora.uid });
    assert.equal(r.status, 400);
  });

  test("rejected attempts leave the patient without consent", async () => {
    assert.equal((await api("GET", "/api/v1/me", a.nora.token)).body.consent.status, "missing");
    assert.equal((await api("GET", "/api/records", a.nora.token)).status, 403);
  });

  test("rejected attempts record no consent event", async () => {
    const { firestore } = await firebaseAdmin();
    const consents = await firestore.collection("patientConsents").where("uid", "==", a.nora.uid).get();
    assert.equal(consents.size, 0);
  });

  test("accepting the current versions unlocks patient routes at once", async () => {
    const r = await api("POST", "/api/v1/me/consents", a.nora.token, currentConsent);
    assert.equal(r.status, 201, JSON.stringify(r.body));

    assert.equal((await api("GET", "/api/v1/me", a.nora.token)).body.consent.status, "valid");
    const records = await api("GET", "/api/records", a.nora.token);
    assert.equal(records.status, 200);
    assert.deepEqual(records.body, [], "the record posted while consent was missing must not exist");
    const appts = await api("GET", "/api/appointments", a.nora.token);
    assert.equal(appts.status, 200);
    assert.deepEqual(appts.body, [], "the appointment posted while consent was missing must not exist");
    assert.equal((await api("GET", "/api/v1/appointments/mine", a.nora.token)).status, 200);
    const triage = await api("POST", "/api/symptoms/check", a.nora.token, { symptoms: "fever and cough for two days" });
    assert.equal(triage.status, 200, JSON.stringify(triage.body).slice(0, 200));
    const chat = await api("POST", "/api/v1/copilot/chat", a.nora.token, { message: "I have a headache" });
    assert.equal(chat.status, 200, JSON.stringify(chat.body).slice(0, 200));
  });

  test("the acceptance is stored as an append-only event with versions and a server timestamp, and audited", async () => {
    const { firestore } = await firebaseAdmin();
    const snap = await firestore.collection("patientConsents").where("uid", "==", a.nora.uid).get();
    assert.equal(snap.size, 1);
    const doc = snap.docs[0].data();
    assert.equal(doc.action, "grant");
    assert.equal(doc.termsAccepted, true);
    assert.equal(doc.termsVersion, TERMS_VERSION);
    assert.equal(doc.privacyVersion, PRIVACY_VERSION);
    assert.ok(doc.recordedAt?.toMillis?.() > 0, "recordedAt is a server timestamp");
    assert.ok((await auditActions(a.nora.uid)).includes("patient.consent.record"));
  });
});

describe("withdrawing consent", () => {
  test("a withdrawal locks patient routes at once and is audited", async () => {
    assert.equal((await api("POST", "/api/v1/me/consents", a.wren.token, currentConsent)).status, 201);
    assert.equal((await api("GET", "/api/records", a.wren.token)).status, 200);

    const w = await api("POST", "/api/v1/me/consents/withdraw", a.wren.token);
    assert.equal(w.status, 201, JSON.stringify(w.body));
    assert.equal(w.body.consentStatus, "withdrawn");

    const r = await api("GET", "/api/records", a.wren.token);
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "CONSENT_REQUIRED");
    assert.equal(r.body.consentStatus, "withdrawn");
    const chat = await api("POST", "/api/v1/copilot/chat", a.wren.token, { message: "I have a headache" });
    assert.equal(chat.status, 403);
    assert.ok((await auditActions(a.wren.uid)).includes("patient.consent.withdraw"));
  });

  test("after withdrawing, the account, SOS and public browsing still work", async () => {
    const me = await api("GET", "/api/v1/me", a.wren.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.consent.status, "withdrawn");
    assert.equal((await api("GET", "/api/hospitals", a.wren.token)).status, 200);
    const sos = await api("POST", "/api/emergency/sos", a.wren.token, { type: "OTHER", patientName: "Wren", patientPhone: "9999900001" });
    assert.notEqual(sos.body?.error, "CONSENT_REQUIRED");
  });

  test("the earlier acceptance is kept: withdrawal is a new event, not a deletion", async () => {
    const { firestore } = await firebaseAdmin();
    const snap = await firestore.collection("patientConsents").where("uid", "==", a.wren.uid).get();
    assert.deepEqual(snap.docs.map((d) => d.data().action).sort(), ["grant", "withdraw"]);
  });

  test("consent can be given again after a withdrawal", async () => {
    assert.equal((await api("POST", "/api/v1/me/consents", a.wren.token, currentConsent)).status, 201);
    assert.equal((await api("GET", "/api/records", a.wren.token)).status, 200);
    assert.equal((await api("GET", "/api/v1/me", a.wren.token)).body.consent.status, "valid");
  });
});

describe("stored consent states", () => {
  const cases: Array<[string, string, string]> = [
    ["olga", "outdated", "an acceptance of older terms"],
    ["ivan", "invalid", "a record without termsAccepted true"],
    ["wade", "withdrawn", "an acceptance followed by a withdrawal"],
  ];
  for (const [who, status, what] of cases) {
    test(`${what} is refused as ${status}`, async () => {
      const r = await api("GET", "/api/records", a[who].token);
      assert.equal(r.status, 403);
      assert.equal(r.body.error, "CONSENT_REQUIRED");
      assert.equal(r.body.consentStatus, status);
      assert.equal((await api("GET", "/api/v1/me", a[who].token)).body.consent.status, status);
    });
  }

  test("a withdrawal followed by a new acceptance is valid", async () => {
    assert.equal((await api("GET", "/api/records", a.rhea.token)).status, 200);
  });

  test("a patient on older terms is let in after accepting the current ones", async () => {
    assert.equal((await api("POST", "/api/v1/me/consents", a.olga.token, currentConsent)).status, 201);
    assert.equal((await api("GET", "/api/records", a.olga.token)).status, 200);
  });
});

describe("staff are not gated by patient consent", () => {
  test("a doctor, hospital desk and admin with no consent record use their routes", async () => {
    assert.equal((await api("GET", "/api/appointments", a.doctor.token)).status, 200);
    assert.equal((await api("GET", "/api/emergency/alerts", a.hospital.token)).status, 200);
    assert.equal((await api("GET", "/api/hospital-reports", a.admin.token)).status, 200);
  });

  test("staff cannot record or withdraw patient consent", async () => {
    assert.equal((await api("POST", "/api/v1/me/consents", a.doctor.token, currentConsent)).status, 403);
    assert.equal((await api("POST", "/api/v1/me/consents/withdraw", a.admin.token)).status, 403);
  });
});

describe("the consent check itself (requireConsent middleware)", () => {
  // Driven directly, with the consent lookup replaced, to cover what the HTTP tests cannot:
  // a failing lookup, and how often the lookup runs.
  type Outcome = { nexted: boolean; status?: number; body?: any };
  async function run(mw: any, user: any, method = "GET", reqPath = "/api/records"): Promise<Outcome> {
    const out: Outcome = { nexted: false };
    const res: any = { status(code: number) { out.status = code; return res; }, json(b: any) { out.body = b; return res; } };
    await mw({ method, path: reqPath, user }, res, () => { out.nexted = true; });
    return out;
  }
  const patient = (uid: string) => ({ uid, email: `${uid}@x.invalid`, role: "PATIENT" });
  let requireConsent: typeof import("../server/firebase/consent").requireConsent;
  let forgetConsent: typeof import("../server/firebase/consent").forgetConsent;
  let CONSENT_EXEMPT: typeof import("../server/firebase/consent").CONSENT_EXEMPT;
  before(async () => { ({ requireConsent, forgetConsent, CONSENT_EXEMPT } = await import("../server/firebase/consent")); });

  test("fails closed: if consent cannot be read the request is refused with 503", async () => {
    const mw = requireConsent(async () => { throw new Error("firestore unavailable"); });
    const out = await run(mw, patient("mw-fail"));
    assert.equal(out.nexted, false);
    assert.equal(out.status, 503);
    assert.equal(out.body.error, "CONSENT_CHECK_UNAVAILABLE");
    assert.ok(!JSON.stringify(out.body).includes("firestore unavailable"), "internal error text is not sent to the client");
  });

  test("a failed lookup is not remembered: the next request checks again", async () => {
    let calls = 0;
    const mw = requireConsent(async () => { calls++; if (calls === 1) throw new Error("blip"); return "valid"; });
    assert.equal((await run(mw, patient("mw-retry"))).status, 503);
    assert.equal((await run(mw, patient("mw-retry"))).nexted, true);
  });

  test("every status other than valid is refused", async () => {
    for (const status of ["missing", "withdrawn", "outdated", "expired", "invalid"] as const) {
      const out = await run(requireConsent(async () => status), patient(`mw-${status}`));
      assert.equal(out.nexted, false, status);
      assert.equal(out.status, 403, status);
      assert.equal(out.body.consentStatus, status);
    }
  });

  test("the lookup is cached per patient, and forgetConsent clears it", async () => {
    let calls = 0;
    const mw = requireConsent(async () => { calls++; return "valid"; });
    await run(mw, patient("mw-cache"));
    await run(mw, patient("mw-cache"));
    assert.equal(calls, 1);
    await run(mw, patient("mw-cache-other"));
    assert.equal(calls, 2, "one patient's cached status is never used for another");
    forgetConsent("mw-cache");
    await run(mw, patient("mw-cache"));
    assert.equal(calls, 3);
  });

  test("staff, the demo sandbox, signed-out callers and non-API paths are not checked", async () => {
    const mw = requireConsent(async () => { throw new Error("must not be called"); });
    for (const role of ["DOCTOR", "HOSPITAL", "ADMIN"]) {
      assert.equal((await run(mw, { uid: `mw-${role}`, role })).nexted, true, role);
    }
    assert.equal((await run(mw, { uid: "demo-sandbox-user", role: "PATIENT", isDemo: true })).nexted, true);
    assert.equal((await run(mw, undefined)).nexted, true);
    assert.equal((await run(mw, patient("mw-page"), "GET", "/en/dashboard")).nexted, true);
  });

  test("exemptions are exact: look-alike paths and other methods are still gated", async () => {
    const mw = requireConsent(async () => "missing");
    const gated: Array<[string, string]> = [
      ["POST", "/api/hospitals"], ["GET", "/api/hospitals/hosp-1"], ["GET", "/api/emergency/sos"],
      ["POST", "/api/emergency/sos/extra"], ["GET", "/api/v1/meow"], ["GET", "/api/v1/doctors/abc/slots/extra"],
      ["POST", "/api/v1/doctors"], ["GET", "/api/medicines/orders"], ["GET", "/api/records/analyze/panels"],
    ];
    for (const [method, p] of gated) {
      assert.equal((await run(mw, patient("mw-exact"), method, p)).status, 403, `${method} ${p}`);
    }
    const open: Array<[string, string]> = [
      ["GET", "/api/v1/me"], ["PUT", "/api/v1/me/profile"], ["POST", "/api/v1/me/consents"], ["POST", "/api/v1/me/consents/withdraw"],
      ["POST", "/api/emergency/sos"], ["GET", "/api/hospitals"], ["GET", "/api/v1/doctors/abc/slots"],
    ];
    for (const [method, p] of open) {
      assert.equal((await run(mw, patient("mw-exact"), method, p)).nexted, true, `${method} ${p}`);
    }
  });

  test("every exemption says why it exists", () => {
    for (const e of CONSENT_EXEMPT) assert.ok(e.why.length > 10, String(e.pattern));
  });
});
