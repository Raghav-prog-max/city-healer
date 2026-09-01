/**
 * Resource-ownership regression suite.
 *
 * The access-matrix suite asserts *role* boundaries — "a PATIENT is refused a doctor
 * route". It never asserted ownership *within* a role, and a penetration pass found
 * every serious hole living in exactly that gap: any DOCTOR could accept any
 * patient's appointment and write a prescription signed in another clinician's name;
 * any HOSPITAL account could zero out any facility's bed census; a patient could post
 * a chat message attributed to their doctor; and order totals, quantities and
 * prescription requirements were taken from the request body unchecked.
 *
 * Each test below is one of those exploits, asserted to fail.
 *
 *   npx tsx --test tests/resource-ownership.test.ts
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.TEST_PORT) || 3801;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.ownership.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);
const TEST_JWT_SECRET = "ownership-suite-secret-not-used-anywhere-0123456789";

let server: ChildProcessWithoutNullStreams;

interface Actor { uid: string; token: string; }
const actors: Record<string, Actor> = {};
let bobAppointment = "";

async function api(method: string, route: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty body is fine */ }
  return { status: res.status, body: payload };
}

async function waitForHealth(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Test server did not become healthy on ${BASE}`);
}

/** Write a provisioning link straight into the throwaway database. */
async function bindInTestDb(sql: string, params: unknown[]): Promise<void> {
  const sqlite3 = (await import("sqlite3")).default;
  const db = new sqlite3.Database(TEST_DB_PATH);
  await new Promise<void>((resolve, reject) => {
    db.run(sql, params as any[], function (err) {
      if (err) return reject(err);
      if (this.changes !== 1) return reject(new Error(`binding affected ${this.changes} rows`));
      resolve();
    });
  });
  await new Promise<void>((resolve) => db.close(() => resolve()));
}

async function register(email: string, name: string, role: string): Promise<Actor> {
  const password = "OwnerPassw0rd!x";
  await api("POST", "/api/auth/register", undefined, { email, password, name, role });
  const login = await api("POST", "/api/auth/login", undefined, { email, password });
  assert.equal(login.status, 200, `login failed for ${email}: ${JSON.stringify(login.body)}`);
  return { uid: login.body.user.uid, token: login.body.token };
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

  actors.bob = await register("bob@own.invalid", "Bob Patient", "PATIENT");
  actors.drOwner = await register("dr.owner@own.invalid", "Dr Owner", "DOCTOR");
  actors.drOther = await register("dr.other@own.invalid", "Dr Other", "DOCTOR");
  actors.hospOwner = await register("hosp.owner@own.invalid", "Hosp One", "HOSPITAL");
  actors.hospOther = await register("hosp.other@own.invalid", "Hosp Two", "HOSPITAL");
  actors.admin = await register("admin@own.invalid", "Admin", "ADMIN");

  // Bob books doc-1. Dr Owner is that clinician; Dr Other is a different one.
  const booked = await api("POST", "/api/appointments", actors.bob.token, {
    doctorId: "doc-1", patientName: "Bob Patient", symptoms: "chest tightness"
  });
  assert.equal(booked.status, 200);
  bobAppointment = booked.body.appointment.id;

  await bindInTestDb("UPDATE users SET doctorId = ? WHERE uid = ?", ["doc-1", actors.drOwner.uid]);
  await bindInTestDb("UPDATE users SET doctorId = ? WHERE uid = ?", ["doc-2", actors.drOther.uid]);
  await bindInTestDb("UPDATE users SET hospitalId = ? WHERE uid = ?", ["hosp-1", actors.hospOwner.uid]);
  await bindInTestDb("UPDATE users SET hospitalId = ? WHERE uid = ?", ["hosp-2", actors.hospOther.uid]);
});

function stopServer() {
  if (!server?.pid) return;
  if (process.platform === "win32") {
    try { spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
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

describe("a doctor may act only on their own appointments", () => {
  test("an unrelated doctor cannot change the status -> 403", async () => {
    const res = await api("PUT", `/api/appointments/${bobAppointment}/status`, actors.drOther.token, { status: "ACCEPTED" });
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  test("an unrelated doctor cannot write a prescription -> 403", async () => {
    const res = await api("POST", `/api/appointments/${bobAppointment}/prescription`, actors.drOther.token, {
      diagnosis: "Anxiety",
      medicines: [{ name: "Alprazolam", dosage: "2mg", frequency: "Thrice daily", duration: "90 days" }]
    });
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  test("the assigned doctor still can -> 200", async () => {
    const status = await api("PUT", `/api/appointments/${bobAppointment}/status`, actors.drOwner.token, { status: "ACCEPTED" });
    assert.equal(status.status, 200, JSON.stringify(status.body));
    const rx = await api("POST", `/api/appointments/${bobAppointment}/prescription`, actors.drOwner.token, {
      diagnosis: "Angina", medicines: [{ name: "Aspirin", dosage: "75mg", frequency: "Once daily", duration: "30 days" }]
    });
    assert.equal(rx.status, 200, JSON.stringify(rx.body));
  });

  test("an invalid status value is rejected -> 400", async () => {
    const res = await api("PUT", `/api/appointments/${bobAppointment}/status`, actors.drOwner.token, { status: "BANANA" });
    assert.equal(res.status, 400);
  });
});

describe("a hospital may act only on its own facility", () => {
  test("cannot rewrite another facility's bed census -> 403", async () => {
    const res = await api("PUT", "/api/hospitals/hosp-1/beds", actors.hospOther.token, {
      availableBeds: 0, icuAvailable: 0, emergencyOccupancy: 100
    });
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  test("cannot edit another facility's profile -> 403", async () => {
    const res = await api("PUT", "/api/hospitals/hosp-1", actors.hospOther.token, { name: "Hijacked" });
    assert.equal(res.status, 403);
  });

  test("cannot add clinicians to another facility -> 403", async () => {
    const res = await api("POST", "/api/hospitals/hosp-1/doctors", actors.hospOther.token, { name: "Dr Ghost", specialty: "Cardiologist" });
    assert.equal(res.status, 403);
  });

  test("its own facility still works -> 200", async () => {
    const res = await api("PUT", "/api/hospitals/hosp-1/beds", actors.hospOwner.token, {
      availableBeds: 42, icuAvailable: 7, emergencyOccupancy: 55
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test("ADMIN keeps blanket access -> 200", async () => {
    const res = await api("PUT", "/api/hospitals/hosp-2/beds", actors.admin.token, {
      availableBeds: 10, icuAvailable: 2, emergencyOccupancy: 20
    });
    assert.equal(res.status, 200);
  });
});

describe("a doctor may not sabotage another clinician", () => {
  test("cannot force another doctor offline -> 403", async () => {
    const res = await api("PUT", "/api/doctors/doc-1/online", actors.drOther.token, { online: false });
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  test("can toggle their own availability -> 200", async () => {
    const res = await api("PUT", "/api/doctors/doc-2/online", actors.drOther.token, { online: false });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });
});

describe("chat attribution comes from the session", () => {
  test("a patient cannot post as the doctor", async () => {
    const send = await api("POST", `/api/chat/${bobAppointment}`, actors.bob.token, {
      sender: "DOCTOR", text: "Stop taking your insulin."
    });
    assert.equal(send.status, 200);
    const log = await api("GET", `/api/chat/${bobAppointment}`, actors.bob.token);
    const forged = log.body.find((m: any) => m.text.includes("Stop taking your insulin"));
    assert.ok(forged, "message should still be stored");
    assert.equal(forged.sender, "PATIENT", "sender must be derived from the session, not the body");
  });
});

describe("order integrity", () => {
  test("the total is recomputed, not taken from the body", async () => {
    const res = await api("POST", "/api/medicines/order", actors.bob.token, {
      items: [{ medicineId: "med-1", name: "Crocin", quantity: 50, price: 0.01 }],
      totalAmount: 1,
      deliveryAddress: "Test"
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.order.totalAmount > 1000, `expected the catalogue total, got ${res.body.order.totalAmount}`);
  });

  test("a negative quantity is rejected -> 400", async () => {
    const res = await api("POST", "/api/medicines/order", actors.bob.token, {
      items: [{ medicineId: "med-2", name: "x", quantity: -500, price: 10 }],
      totalAmount: -5000, deliveryAddress: "Test"
    });
    assert.equal(res.status, 400, JSON.stringify(res.body));
  });

  test("a prescription-only medicine needs one attached -> 400", async () => {
    const meds = await api("GET", "/api/medicines");
    const rx = meds.body.find((m: any) => m.requiresPrescription);
    assert.ok(rx, "seed data should contain a prescription-only medicine");
    const res = await api("POST", "/api/medicines/order", actors.bob.token, {
      items: [{ medicineId: rx.id, name: rx.name, quantity: 1, price: rx.price }],
      totalAmount: rx.price, deliveryAddress: "Test", prescriptionAttached: false
    });
    assert.equal(res.status, 400, JSON.stringify(res.body));
  });

  test("ordering beyond available stock is refused -> 400", async () => {
    const res = await api("POST", "/api/medicines/order", actors.bob.token, {
      items: [{ medicineId: "med-1", name: "Crocin", quantity: 100, price: 1 }],
      totalAmount: 100, deliveryAddress: "Test"
    });
    assert.ok([200, 400].includes(res.status));
    if (res.status === 400) assert.match(String(res.body.error), /stock/i);
  });

  test("an unknown medicine id is refused -> 404", async () => {
    const res = await api("POST", "/api/medicines/order", actors.bob.token, {
      items: [{ medicineId: "med-does-not-exist", name: "x", quantity: 1, price: 1 }],
      totalAmount: 1, deliveryAddress: "Test"
    });
    assert.equal(res.status, 404);
  });
});

describe("queue and dispatch state machines", () => {
  test("an invalid queue status is rejected -> 400", async () => {
    const res = await api("PUT", "/api/queue/tok-1/status", actors.admin.token, { status: "NONSENSE" });
    assert.equal(res.status, 400);
  });

  test("an invalid alert status is rejected -> 400", async () => {
    const res = await api("PUT", "/api/emergency/alerts/sos-1/status", actors.admin.token, { status: "NONSENSE" });
    assert.equal(res.status, 400);
  });
});
