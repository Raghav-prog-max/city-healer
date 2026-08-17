/**
 * Access-matrix regression suite.
 *
 * Encodes the authorization guarantees established in the security pass so a future
 * change cannot silently reopen them. For every guarded route it asserts:
 *   anonymous -> 401, wrong role -> 403, correct role -> 200
 * plus cross-patient isolation and doctor-relationship scoping.
 *
 * Runs against a server this file starts itself, on its own port, backed by a
 * throwaway SQLite file. It never touches the developer's city_healer.db.
 *
 *   npm test
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.TEST_PORT) || 3799;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);
const TEST_JWT_SECRET = "test-only-secret-not-used-anywhere-else-0123456789";

let server: ChildProcessWithoutNullStreams;

interface Actor { uid: string; token: string; headers: Record<string, string>; }

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

/** Write the doctor link directly into the throwaway test database. */
async function linkDoctorInTestDb(uid: string, doctorId: string): Promise<void> {
  const sqlite3 = (await import("sqlite3")).default;
  const db = new sqlite3.Database(TEST_DB_PATH);
  await new Promise<void>((resolve, reject) => {
    db.run("UPDATE users SET doctorId = ? WHERE uid = ?", [doctorId, uid], function (err) {
      if (err) return reject(err);
      if (this.changes !== 1) return reject(new Error(`link-doctor affected ${this.changes} rows`));
      resolve();
    });
  });
  await new Promise<void>((resolve) => db.close(() => resolve()));
}

async function register(email: string, name: string, role: string): Promise<Actor> {
  const password = "TestPassw0rd!x";
  await api("POST", "/api/auth/register", undefined, { email, password, name, role });
  const login = await api("POST", "/api/auth/login", undefined, { email, password });
  assert.equal(login.status, 200, `login failed for ${email}: ${JSON.stringify(login.body)}`);
  const token = login.body.token as string;
  return { uid: login.body.user.uid, token, headers: { Authorization: `Bearer ${token}` } };
}

before(async () => {
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true });

  server = spawn("npx", ["tsx", "server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH: TEST_DB,
      JWT_SECRET: TEST_JWT_SECRET,
      DEMO_MODE: "false",
      NODE_ENV: "development",
      API_ONLY: "true",
      DISABLE_HMR: "true"
    },
    shell: process.platform === "win32"
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});

  await waitForHealth();

  actors.alice = await register("alice@test.invalid", "Alice Patient", "PATIENT");
  actors.bob = await register("bob@test.invalid", "Bob Patient", "PATIENT");
  actors.admin = await register("admin@test.invalid", "Admin Tester", "ADMIN");
  actors.hospital = await register("hospital@test.invalid", "Hospital Desk", "HOSPITAL");
  actors.drLinked = await register("dr.linked@test.invalid", "Dr Linked", "DOCTOR");
  actors.drUnlinked = await register("dr.unlinked@test.invalid", "Dr Unlinked", "DOCTOR");

  // Bob books with doc-1, creating the clinical relationship the scoping depends on.
  const booked = await api("POST", "/api/appointments", actors.bob.token, {
    doctorId: "doc-1", patientName: "Bob Patient", symptoms: "test symptom"
  });
  assert.equal(booked.status, 200);
  linkedDoctorId = "doc-1";

  // Provision Dr Linked against doc-1 (normally the link-doctor CLI).
  // Open the TEST database explicitly. Importing ../database here would resolve
  // DB_PATH from this process's env, which is unset, and write to the real DB.
  await linkDoctorInTestDb(actors.drLinked.uid, linkedDoctorId);

  // Each patient uploads a private record.
  await api("POST", "/api/records", actors.bob.token, {
    title: "BOB PRIVATE record", doctorName: "Dr X", diagnoseSummary: "bob confidential"
  });
  await api("POST", "/api/records", actors.alice.token, {
    title: "ALICE PRIVATE record", doctorName: "Dr Y", diagnoseSummary: "alice confidential"
  });
});

after(() => {
  server?.kill();
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

  test("token signed with the old hardcoded secret -> 401", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const forged = jwt.sign(
      { uid: "attacker", email: "a@b.c", role: "ADMIN" },
      "city-healer-dev-only-secret",
      { expiresIn: "7d" }
    );
    assert.equal((await api("GET", "/api/records", forged)).status, 401);
  });

  test("expired token -> 401", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const expired = jwt.sign(
      { uid: actors.admin.uid, email: "admin@test.invalid", role: "ADMIN" },
      TEST_JWT_SECRET,
      { expiresIn: -60 }
    );
    assert.equal((await api("GET", "/api/records", expired)).status, 401);
  });

  test("validly signed token for a uid that does not exist -> 401", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const ghost = jwt.sign(
      { uid: "no-such-user", email: "ghost@test.invalid", role: "ADMIN" },
      TEST_JWT_SECRET,
      { expiresIn: "7d" }
    );
    assert.equal((await api("GET", "/api/records", ghost)).status, 401);
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
    const limit = Number(process.env.AI_RATE_LIMIT) || 30;
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
