/**
 * Access-matrix regression suite.
 *
 * Encodes the authorization guarantees established in the security pass so a future
 * change cannot silently reopen them. For every guarded route it asserts:
 *   anonymous -> 401, wrong role -> 403, correct role -> 200
 * plus cross-patient isolation and doctor-relationship scoping.
 *
 * Runs against a server this file starts itself, on its own port, backed by a
 * throwaway SQLite file and the Firebase emulators (accounts are Firebase users with
 * role claims). It never touches the developer's city_healer.db or a real project.
 *
 *   npm run test:server
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { verifyDoctorsInTestDb, createActor, craftEmulatorToken, firebaseAdmin, requireEmulators, signIn, type Actor } from "./helpers/firebaseAccounts";
import { TERMS_VERSION, PRIVACY_VERSION } from "../shared/consent";

const PORT = Number(process.env.TEST_PORT) || 3799;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);

let server: ChildProcessWithoutNullStreams;

const actors: Record<string, Actor> = {};
let linkedDoctorId = "";

async function api(method: string, route: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty body is fine */ }
  return { status: res.status, body: payload };
}

async function waitForHealth(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Test server did not become healthy on ${BASE}`);
}

before(async () => {
  requireEmulators();
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true });

  server = spawn("npx", ["tsx", "server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH: TEST_DB,
      DEMO_MODE: "false",
      NODE_ENV: "development",
      API_ONLY: "true",
      DISABLE_HMR: "true"
    },
    shell: process.platform === "win32"
  });
  // TEST_SERVER_LOGS=true shows the test server's own log (for diagnosing a failure).
  server.stdout.on("data", (d) => { if (process.env.TEST_SERVER_LOGS === "true") process.stdout.write(d); });
  server.stderr.on("data", (d) => { if (process.env.TEST_SERVER_LOGS === "true") process.stderr.write(d); });

  await waitForHealth();

  // Firebase accounts with role claims, as `npm run set-role` would make them. The hospital
  // desk administers hosp-1 and Dr Linked is doc-1 (claims hospitalId / doctorId); an
  // unbound HOSPITAL or DOCTOR account can see and write nothing.
  linkedDoctorId = "doc-1";
  actors.alice = await createActor("alice@test.invalid", "Alice Patient", "PATIENT");
  actors.bob = await createActor("bob@test.invalid", "Bob Patient", "PATIENT");
  actors.admin = await createActor("admin@test.invalid", "Admin Tester", "ADMIN");
  actors.hospital = await createActor("hospital@test.invalid", "Hospital Desk", "HOSPITAL", { hospitalId: "hosp-1" });
  actors.drLinked = await createActor("dr.linked@test.invalid", "Dr Linked", "DOCTOR", { doctorId: linkedDoctorId });
  actors.drUnlinked = await createActor("dr.unlinked@test.invalid", "Dr Unlinked", "DOCTOR");

  // Seeded doctors are look-only until verified; verify the ones this suite books.
  await verifyDoctorsInTestDb(TEST_DB_PATH, ["doc-1"]);

  // Bob books with doc-1, creating the clinical relationship the scoping depends on.
  const booked = await api("POST", "/api/appointments", actors.bob.token, {
    doctorId: "doc-1", patientName: "Bob Patient", symptoms: "test symptom"
  });
  assert.equal(booked.status, 200);

  // Each patient uploads a private record.
  await api("POST", "/api/records", actors.bob.token, {
    title: "BOB PRIVATE record", doctorName: "Dr X", diagnoseSummary: "bob confidential"
  });
  await api("POST", "/api/records", actors.alice.token, {
    title: "ALICE PRIVATE record", doctorName: "Dr Y", diagnoseSummary: "alice confidential"
  });
});

/**
 * Stop the spawned server.
 *
 * On Windows the server is spawned through a shell (npx is a .cmd), so the child
 * this process holds is cmd.exe and `kill()` reaps only that shell — node keeps
 * running, keeps the port bound, and keeps the test runner's event loop alive, so
 * `npm test` never exits and the next run collides on the port. taskkill /T walks
 * the process tree and terminates the real server too.
 */
function stopServer() {
  if (!server?.pid) return;
  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } catch { /* already gone */ }
  }
  server.kill();
}

after(() => {
  stopServer();
  if (existsSync(TEST_DB_PATH)) {
    try { rmSync(TEST_DB_PATH, { force: true }); } catch { /* windows file lock */ }
  }
});

// ---------------------------------------------------------------------------

describe("anonymous callers are rejected on every guarded route", () => {
  const guarded: Array<[string, string, unknown?]> = [
    ["GET", "/api/records"],
    ["POST", "/api/records", { title: "x", diagnoseSummary: "x" }],
    ["GET", "/api/appointments"],
    ["POST", "/api/appointments", { doctorId: "doc-1" }],
    ["GET", "/api/queue"],
    ["POST", "/api/queue/take", { doctorId: "doc-1" }],
    ["GET", "/api/medicines/orders"],
    ["POST", "/api/medicines/order", { items: [], totalAmount: 0 }],
    ["GET", "/api/emergency/alerts"],
    ["POST", "/api/emergency/sos", { type: "OTHER", patientPhone: "0" }],
    ["GET", "/api/users/someone"],
    ["PUT", "/api/users/someone", { name: "x" }],
    ["GET", "/api/chat/app-101"],
    ["POST", "/api/chat/app-101", { sender: "PATIENT", text: "hi" }],
    ["PUT", "/api/hospitals/hosp-1/beds", { availableBeds: 1, icuAvailable: 1, emergencyOccupancy: 1 }],
    ["POST", "/api/hospitals", { name: "x", address: "x", phone: "0" }],
    ["PUT", "/api/hospitals/hosp-1", { name: "x" }],
    ["POST", "/api/hospitals/hosp-1/doctors", { name: "x", specialty: "x" }],
    ["PUT", "/api/doctors/doc-1/online", { online: true }],
    ["PUT", "/api/appointments/app-101/status", { status: "ACCEPTED" }],
    ["POST", "/api/appointments/app-101/prescription", { diagnosis: "x", medicines: [] }],
    ["PUT", "/api/queue/tok-1/status", { status: "COMPLETED" }],
    ["PUT", "/api/emergency/alerts/sos-1/status", { status: "RESOLVED" }],
    ["POST", "/api/symptoms/check", { symptoms: "x" }],
    ["POST", "/api/records/analyze", { templateId: "blood_cbc" }],
    ["POST", "/api/medicines/guide", { name: "x" }],
    ["POST", "/api/diet/recommend", { condition: "x", preference: "Veg" }],
    ["POST", "/api/developer/ai-pipeline", { prompt: "x" }],
    ["POST", "/api/medicines/search-nationwide", { query: "x" }]
  ];

  for (const [method, route, body] of guarded) {
    test(`${method} ${route} -> 401`, async () => {
      const res = await api(method, route, undefined, body);
      assert.equal(res.status, 401, `expected 401, got ${res.status}`);
    });
  }
});

describe("public routes remain reachable without a session", () => {
  for (const route of ["/api/health", "/api/hospitals", "/api/doctors", "/api/medicines"]) {
    test(`GET ${route} -> 200`, async () => {
      const res = await api("GET", route);
      assert.equal(res.status, 200);
    });
  }
});

describe("forged and malformed tokens are rejected", () => {
  test("garbage token -> 401", async () => {
    assert.equal((await api("GET", "/api/records", "not.a.jwt")).status, 401);
  });

  test("a token from the retired sign-in (HS256 with the old hardcoded secret) -> 401", async () => {
    const crypto = await import("node:crypto");
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ uid: "attacker", email: "a@b.c", role: "ADMIN" })}`;
    const sig = crypto.createHmac("sha256", "city-healer-dev-only-secret").update(body).digest("base64url");
    assert.equal((await api("GET", "/api/records", `${body}.${sig}`)).status, 401);
  });

  test("expired token -> 401", async () => {
    const past = Math.floor(Date.now() / 1000) - 7200;
    const expired = craftEmulatorToken({ sub: actors.admin.uid, user_id: actors.admin.uid, role: "admin", iat: past, auth_time: past, exp: past + 3600 });
    assert.equal((await api("GET", "/api/records", expired)).status, 401);
  });

  test("token for a uid that does not exist -> 401", async () => {
    const ghost = craftEmulatorToken({ sub: "no-such-user", user_id: "no-such-user", role: "admin" });
    assert.equal((await api("GET", "/api/records", ghost)).status, 401);
  });

  test("a disabled account is refused at once, not when its token expires", async () => {
    const { adminAuth } = await firebaseAdmin();
    const dora = await createActor("dora@test.invalid", "Dora Patient", "PATIENT");
    assert.equal((await api("GET", "/api/records", dora.token)).status, 200);
    await adminAuth.updateUser(dora.uid, { disabled: true });
    assert.equal((await api("GET", "/api/records", dora.token)).status, 401);
  });
});

describe("PATIENT is refused privileged operations", () => {
  const forbidden: Array<[string, string, unknown?]> = [
    ["GET", "/api/emergency/alerts"],
    ["PUT", "/api/hospitals/hosp-1/beds", { availableBeds: 1, icuAvailable: 1, emergencyOccupancy: 1 }],
    ["POST", "/api/hospitals", { name: "x", address: "x", phone: "0" }],
    ["PUT", "/api/hospitals/hosp-1", { name: "x" }],
    ["POST", "/api/hospitals/hosp-1/doctors", { name: "x", specialty: "x" }],
    ["PUT", "/api/doctors/doc-1/online", { online: true }],
    ["PUT", "/api/appointments/app-101/status", { status: "ACCEPTED" }],
    ["POST", "/api/appointments/app-101/prescription", { diagnosis: "x", medicines: [] }],
    ["PUT", "/api/queue/tok-1/status", { status: "COMPLETED" }],
    ["PUT", "/api/emergency/alerts/sos-1/status", { status: "RESOLVED" }]
  ];

  for (const [method, route, body] of forbidden) {
    test(`${method} ${route} -> 403`, async () => {
      const res = await api(method, route, actors.alice.token, body);
      assert.equal(res.status, 403, `expected 403, got ${res.status}`);
    });
  }

  test("cannot read another user's profile -> 403", async () => {
    assert.equal((await api("GET", `/api/users/${actors.bob.uid}`, actors.alice.token)).status, 403);
  });

  test("cannot write another user's profile -> 403", async () => {
    const res = await api("PUT", `/api/users/${actors.bob.uid}`, actors.alice.token, { name: "hacked" });
    assert.equal(res.status, 403);
  });

  test("cannot escalate own role -> 403 and role is unchanged", async () => {
    const res = await api("PUT", `/api/users/${actors.alice.uid}`, actors.alice.token, { role: "ADMIN" });
    assert.equal(res.status, 403);
    const check = await api("GET", `/api/users/${actors.alice.uid}`, actors.admin.token);
    assert.equal(check.body.role, "PATIENT");
  });
});

describe("PATIENT is allowed their own operations", () => {
  test("reads own profile -> 200", async () => {
    assert.equal((await api("GET", `/api/users/${actors.alice.uid}`, actors.alice.token)).status, 200);
  });
  test("updates own non-role fields -> 200", async () => {
    const res = await api("PUT", `/api/users/${actors.alice.uid}`, actors.alice.token, { name: "Alice Renamed" });
    assert.equal(res.status, 200);
  });
  test("reads own records -> 200", async () => {
    assert.equal((await api("GET", "/api/records", actors.alice.token)).status, 200);
  });
});

describe("cross-patient isolation", () => {
  test("Alice sees none of Bob's records", async () => {
    const res = await api("GET", "/api/records", actors.alice.token);
    assert.equal(res.status, 200);
    const titles = (res.body as any[]).map((r) => r.title);
    assert.ok(!titles.some((t) => t.includes("BOB PRIVATE")), `leaked: ${titles.join(", ")}`);
  });

  test("Bob sees his own record and not Alice's", async () => {
    const res = await api("GET", "/api/records", actors.bob.token);
    const titles = (res.body as any[]).map((r) => r.title);
    assert.ok(titles.some((t) => t.includes("BOB PRIVATE")));
    assert.ok(!titles.some((t) => t.includes("ALICE PRIVATE")));
  });

  test("Alice sees only her own appointments", async () => {
    const res = await api("GET", "/api/appointments", actors.alice.token);
    assert.ok((res.body as any[]).every((a) => a.patientId === actors.alice.uid));
  });

  test("Alice cannot read a consultation she is not party to -> 403", async () => {
    const bobAppts = await api("GET", "/api/appointments", actors.bob.token);
    const id = (bobAppts.body as any[])[0].id;
    assert.equal((await api("GET", `/api/chat/${id}`, actors.alice.token)).status, 403);
  });
});

describe("doctor scoping follows the clinical relationship", () => {
  test("unlinked doctor sees zero records", async () => {
    const res = await api("GET", "/api/records", actors.drUnlinked.token);
    assert.equal(res.status, 200);
    assert.equal((res.body as any[]).length, 0);
  });

  test("unlinked doctor sees zero appointments", async () => {
    const res = await api("GET", "/api/appointments", actors.drUnlinked.token);
    assert.equal((res.body as any[]).length, 0);
  });

  test("linked doctor sees his patient's record but not an unrelated patient's", async () => {
    const res = await api("GET", "/api/records", actors.drLinked.token);
    const titles = (res.body as any[]).map((r) => r.title);
    assert.ok(titles.some((t) => t.includes("BOB PRIVATE")), "should see linked patient");
    assert.ok(!titles.some((t) => t.includes("ALICE PRIVATE")), "must not see unrelated patient");
  });

  test("linked doctor only sees his own appointments", async () => {
    const res = await api("GET", "/api/appointments", actors.drLinked.token);
    assert.ok((res.body as any[]).every((a) => a.doctorId === linkedDoctorId));
  });
});

describe("privileged roles retain access", () => {
  test("HOSPITAL may write the bed census -> 200", async () => {
    const res = await api("PUT", "/api/hospitals/hosp-1/beds", actors.hospital.token, {
      availableBeds: 100, icuAvailable: 10, emergencyOccupancy: 50
    });
    assert.equal(res.status, 200);
  });
  test("HOSPITAL may read the dispatch stream -> 200", async () => {
    assert.equal((await api("GET", "/api/emergency/alerts", actors.hospital.token)).status, 200);
  });
  test("ADMIN may read all records -> 200", async () => {
    assert.equal((await api("GET", "/api/records", actors.admin.token)).status, 200);
  });
  test("ADMIN may change another user's role -> 200", async () => {
    const res = await api("PUT", `/api/users/${actors.bob.uid}`, actors.admin.token, { role: "PATIENT" });
    assert.equal(res.status, 200);
  });
});

describe("AI endpoints are metered per user", () => {
  test("quota returns 429 once exceeded, and the limit is per-account", async () => {
    // Must match the server default in server.ts (AI_RATE_LIMIT, per user per hour).
    const limit = Number(process.env.AI_RATE_LIMIT) || 300;
    let sawTooMany = false;
    for (let i = 0; i < limit + 5; i++) {
      const res = await api("POST", "/api/diet/recommend", actors.alice.token, {
        condition: "Diabetes", preference: "Veg"
      });
      if (res.status === 429) { sawTooMany = true; break; }
    }
    assert.ok(sawTooMany, `expected a 429 within ${limit + 5} calls`);

    // A different account still has its own budget.
    const other = await api("POST", "/api/diet/recommend", actors.bob.token, {
      condition: "Diabetes", preference: "Veg"
    });
    assert.equal(other.status, 200, "quota must be per-user, not global");
  });
});

describe("accounts (Firebase) and patient profiles (Firestore)", () => {
  test("the retired /api/auth sign-in routes no longer exist", async () => {
    const r = await api("POST", "/api/auth/login", undefined, { email: "alice@test.invalid", password: "TestPassw0rd!x" });
    assert.notEqual(r.status, 200);
    assert.equal(r.body?.token, undefined);
  });

  test("GET /api/v1/me returns the caller's identity and own profile", async () => {
    const r = await api("GET", "/api/v1/me", actors.alice.token);
    assert.equal(r.status, 200);
    assert.equal(r.body.uid, actors.alice.uid);
    assert.equal(r.body.email, "alice@test.invalid");
    assert.equal(r.body.role, "patient");
    assert.equal(typeof r.body.profile.fullName, "string"); // another test renames her
    assert.equal(r.body.profile.city !== undefined, true);
  });

  test("the profile schema is strict: unknown fields and cities outside Delhi NCR are refused", async () => {
    const extra = await api("PUT", "/api/v1/me/profile", actors.alice.token, { city: "Noida", isAdmin: true });
    assert.equal(extra.status, 400);
    const city = await api("PUT", "/api/v1/me/profile", actors.alice.token, { city: "Mumbai" });
    assert.equal(city.status, 400);
    const ok = await api("PUT", "/api/v1/me/profile", actors.alice.token, { city: "Noida", locality: "Sector 62" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.profile.city, "Noida");
  });

  test("a first profile needs a name and a city", async () => {
    const fresh = await createActor("frank@test.invalid", "Frank", "PATIENT");
    const { firestore } = await firebaseAdmin();
    await firestore.collection("patientProfiles").doc(fresh.uid).delete();
    const r = await api("PUT", "/api/v1/me/profile", fresh.token, { locality: "Somewhere" });
    assert.equal(r.status, 400);
  });

  test("consent must accept the terms, and is recorded with its versions and an audit event", async () => {
    // Only the current versions can be accepted (tests/consent.test.ts covers the rest).
    const refused = await api("POST", "/api/v1/me/consents", actors.alice.token, { termsAccepted: false, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
    assert.equal(refused.status, 400);
    const ok = await api("POST", "/api/v1/me/consents", actors.alice.token, { termsAccepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, marketingOptIn: false });
    assert.equal(ok.status, 201);
    const { firestore } = await firebaseAdmin();
    const consents = await firestore.collection("patientConsents").where("uid", "==", actors.alice.uid).get();
    assert.ok(consents.size >= 1);
    const audit = await firestore.collection("auditLogs").where("actorUid", "==", actors.alice.uid).get();
    assert.ok(audit.docs.some((d) => d.data().action === "patient.consent.record"));
    assert.ok(audit.docs.every((d) => !("termsVersion" in d.data())), "audit events hold no request payloads");
  });

  test("staff accounts are refused the patient routes", async () => {
    assert.equal((await api("GET", "/api/v1/me", actors.drLinked.token)).status, 403);
  });

  test("nobody can give themselves a role", async () => {
    const r = await api("PUT", `/api/users/${actors.alice.uid}`, actors.alice.token, { role: "ADMIN" });
    assert.equal(r.status, 403);
  });

  test("an administrator's role change revokes the account's existing sessions", async () => {
    const gina = await createActor("gina@test.invalid", "Gina Patient", "PATIENT");
    // Revocation is compared in whole seconds: a token issued in the same second as the
    // revocation still counts as valid, so let a second pass after sign-in first.
    await new Promise((res) => setTimeout(res, 1100));
    const r = await api("PUT", `/api/users/${gina.uid}`, actors.admin.token, { role: "DOCTOR" });
    assert.equal(r.status, 200);
    assert.equal((await api("GET", "/api/records", gina.token)).status, 401);
    const fresh = await signIn(gina.email, gina.password);
    assert.equal((await api("GET", "/api/v1/me", fresh)).status, 403, "now a doctor, so not a patient route");
  });
});

describe("bed numbers are shown only when a hospital reports them", () => {
  test("no hospital starts with invented bed or ICU counts", async () => {
    const r = await api("GET", "/api/hospitals");
    const h = r.body.find((x: any) => x.id === "hosp-2");
    assert.equal(h.bedsReported, false);
    assert.equal(h.availableBeds, null);
    assert.equal(h.icuAvailable, null);
  });

  test("a hospital desk's report is stored with its totals and the time", async () => {
    const before = Date.now();
    const put = await api("PUT", "/api/hospitals/hosp-1/beds", actors.hospital.token, { totalBeds: 220, availableBeds: 31, icuBeds: 20, icuAvailable: 4 });
    assert.equal(put.status, 200);
    const h = (await api("GET", "/api/hospitals")).body.find((x: any) => x.id === "hosp-1");
    assert.equal(h.bedsReported, true);
    assert.equal(h.availableBeds, 31);
    assert.equal(h.icuAvailable, 4);
    assert.ok(new Date(h.bedsReportedAt).getTime() >= before - 1000);
    const over = await api("PUT", "/api/hospitals/hosp-1/beds", actors.hospital.token, { availableBeds: 999 });
    assert.equal(over.body.hospital.availableBeds, 220, "capped at the reported total");
  });
});

describe("hospital listings can be reported and hidden", () => {
  test("a signed-in user can report a listing once, with a known reason", async () => {
    assert.equal((await api("POST", "/api/hospitals/hosp-3/report", undefined, { reason: "closed" })).status, 401);
    assert.equal((await api("POST", "/api/hospitals/hosp-3/report", actors.alice.token, { reason: "made-up" })).status, 400);
    assert.equal((await api("POST", "/api/hospitals/hosp-3/report", actors.alice.token, { reason: "closed" })).status, 201);
    assert.equal((await api("POST", "/api/hospitals/hosp-3/report", actors.alice.token, { reason: "closed" })).status, 409);
  });

  test("only an administrator sees reports and can hide a listing", async () => {
    assert.equal((await api("GET", "/api/hospital-reports", actors.alice.token)).status, 403);
    assert.equal((await api("PUT", "/api/hospitals/hosp-3/listing", actors.alice.token, { status: "hidden" })).status, 403);
    const reports = await api("GET", "/api/hospital-reports", actors.admin.token);
    assert.ok(reports.body.some((r: any) => r.hospitalId === "hosp-3" && r.reason === "closed"));
  });

  test("a hidden listing disappears from lists and recommendations, and can be restored", async () => {
    const hide = await api("PUT", "/api/hospitals/hosp-3/listing", actors.admin.token, { status: "hidden", reason: "closed" });
    assert.equal(hide.status, 200);
    assert.ok(!(await api("GET", "/api/hospitals")).body.some((h: any) => h.id === "hosp-3"));
    const restore = await api("PUT", "/api/hospitals/hosp-3/listing", actors.admin.token, { status: "active" });
    assert.equal(restore.status, 200);
    assert.ok((await api("GET", "/api/hospitals")).body.some((h: any) => h.id === "hosp-3"));
  });
});

describe("the doctor directory is look-only until a doctor is verified", () => {
  test("doctors carry their verification state, city and locality", async () => {
    const r = await api("GET", "/api/doctors");
    assert.equal(r.status, 200);
    const unverified = r.body.find((d: any) => d.id === "doc-3");
    assert.equal(unverified.verified, false);
    assert.ok(unverified.city, "city comes from the hospital address");
    assert.equal(r.body.find((d: any) => d.id === "doc-1").verified, true);
  });

  test("booking an unverified doctor is refused", async () => {
    const r = await api("POST", "/api/appointments", actors.alice.token, { doctorId: "doc-3", date: "2099-01-05", time: "10:00 AM" });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "DOCTOR_NOT_VERIFIED");
  });

  test("an OPD token with an unverified doctor is refused", async () => {
    const r = await api("POST", "/api/queue/take", actors.alice.token, { doctorId: "doc-3" });
    assert.equal(r.status, 409);
  });

  test("a verified doctor cannot be booked in the past or twice for the same slot", async () => {
    const past = await api("POST", "/api/appointments", actors.alice.token, { doctorId: "doc-1", date: "2020-01-01", time: "10:00 AM" });
    assert.equal(past.status, 400);
    const first = await api("POST", "/api/appointments", actors.alice.token, { doctorId: "doc-1", date: "2099-02-10", time: "11:30 AM" });
    assert.equal(first.status, 200);
    const second = await api("POST", "/api/appointments", actors.bob.token, { doctorId: "doc-1", date: "2099-02-10", time: "11:30 AM" });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "SLOT_TAKEN");
    const booked = await api("GET", "/api/doctors/doc-1/booked?date=2099-02-10", actors.bob.token);
    assert.deepEqual(booked.body.booked, ["11:30 AM"]);
  });
});

describe("location-aware lists", () => {
  test("hospitals come back nearest first when a position is given", async () => {
    const r = await api("GET", "/api/hospitals?lat=28.5672&lng=77.2100");
    assert.equal(r.status, 200);
    const d = r.body.map((h: any) => h.distanceKm);
    assert.ok(d.every((x: any) => typeof x === "number"));
    assert.deepEqual(d, [...d].sort((a, b) => a - b));
  });

  test("doctors carry the distance to their hospital, nearest first", async () => {
    const r = await api("GET", "/api/doctors?lat=28.5672&lng=77.2100");
    assert.equal(r.status, 200);
    const d = r.body.map((x: any) => x.distanceKm).filter((x: any) => x !== null);
    assert.ok(d.length > 0);
    assert.deepEqual(d, [...d].sort((a: number, b: number) => a - b));
  });

  test("without a position the lists are returned as before", async () => {
    const r = await api("GET", "/api/hospitals");
    assert.equal(r.status, 200);
    assert.equal(r.body[0].distanceKm, undefined);
  });
});

describe("triage routes the patient to the right place", () => {
  // Its own account: another suite deliberately exhausts Alice's triage quota.
  let erin: Actor;
  before(async () => { erin = await createActor("erin@test.invalid", "Erin Patient", "PATIENT"); });
  const check = (symptoms: string, lang?: string) =>
    api("POST", "/api/symptoms/check", erin.token, { symptoms, lang, userLat: 28.5672, userLng: 77.21 });

  test("recommended hospitals have a department for the condition", async () => {
    const r = await check("I get a burning feeling in my chest after meals and sour liquid comes up when I lie down at night");
    assert.equal(r.status, 200);
    assert.match(r.body.suspectedCondition, /reflux/i);
    assert.equal(r.body.doctorSpecialty, "Gastroenterologist");
    assert.ok(r.body.recommendedHospitals.length > 0);
    for (const h of r.body.recommendedHospitals) {
      assert.ok(h.specialties.some((s: string) => /gastro|hepat/i.test(s)), `${h.name}: ${h.specialties.join(", ")}`);
      assert.ok(h.recommendationScore <= 100);
    }
    assert.ok(r.body.recommendedDoctors.every((d: any) => d.specialty === "Gastroenterologist"));
  });

  test("a different condition gets different hospitals", async () => {
    const gastro = await check("I get a burning feeling in my chest after meals and sour liquid comes up when I lie down at night");
    const cardiac = await check("crushing chest pain spreading to my left arm");
    assert.equal(cardiac.body.urgencyLevel, "CRITICAL");
    assert.notDeepEqual(
      cardiac.body.recommendedHospitals.map((h: any) => h.id),
      gastro.body.recommendedHospitals.map((h: any) => h.id)
    );
  });

  test("routing still works when the reply is in Hindi", async () => {
    const r = await check("I get a burning feeling in my chest after meals and sour liquid comes up when I lie down at night", "hi");
    assert.equal(r.body.lang, "hi");
    assert.equal(r.body.doctorSpecialty, "Gastroenterologist");
    assert.ok(r.body.recommendedHospitals.every((h: any) => h.specialties.some((s: string) => /gastro|hepat/i.test(s))));
  });
});
