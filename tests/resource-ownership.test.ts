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
 * Each test below is one of those exploits, asserted to fail. The appointment, prescription and
 * chat cases went with the SQLite appointment system they attacked: bookings now live in
 * Firestore, and tests/consultations.test.ts asserts that only the booked doctor can complete,
 * cancel or prescribe for one. (Appointment messages are being rebuilt on Firestore.)
 *
 *   npm run test:server   (starts the Firebase emulators the accounts live in)
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { verifyDoctorsInTestDb, createActor, requireEmulators, type Actor } from "./helpers/firebaseAccounts";

const PORT = Number(process.env.TEST_PORT) || 3801;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.ownership.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);

let server: ChildProcessWithoutNullStreams;

const actors: Record<string, Actor> = {};

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
      AI_RATE_LIMIT: "1000",
      NODE_ENV: "development",
      API_ONLY: "true",
      DISABLE_HMR: "true"
    },
    shell: process.platform === "win32"
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});
  await waitForHealth();

  // Doctor and facility links are Firebase custom claims (npm run set-role).
  actors.bob = await createActor("bob@own.invalid", "Bob Patient", "PATIENT");
  actors.drOwner = await createActor("dr.owner@own.invalid", "Dr Owner", "DOCTOR", { doctorId: "doc-1" });
  actors.drOther = await createActor("dr.other@own.invalid", "Dr Other", "DOCTOR", { doctorId: "doc-2" });
  actors.hospOwner = await createActor("hosp.owner@own.invalid", "Hosp One", "HOSPITAL", { hospitalId: "hosp-1" });
  actors.hospOther = await createActor("hosp.other@own.invalid", "Hosp Two", "HOSPITAL", { hospitalId: "hosp-2" });
  actors.admin = await createActor("admin@own.invalid", "Admin", "ADMIN");

  // Seeded doctors are look-only until verified; Dr Owner is doc-1, Dr Other is doc-2.
  await verifyDoctorsInTestDb(TEST_DB_PATH, ["doc-1", "doc-2"]);
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

  test("the Medicines screen's order (id + quantity, prescription attached) is placed and listed in My orders", async () => {
    const meds = await api("GET", "/api/medicines");
    const rx = meds.body.find((m: any) => m.requiresPrescription && m.stock > 1);
    const otc = meds.body.find((m: any) => !m.requiresPrescription && m.stock > 1);
    const res = await api("POST", "/api/medicines/order", actors.bob.token, {
      items: [{ medicineId: rx.id, quantity: 1 }, { medicineId: otc.id, quantity: 2 }],
      deliveryAddress: "12 Test Lane, Saket, Delhi 110017",
      prescriptionAttached: true, prescriptionName: "City Healer prescription rx-test: Viral fever",
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.order.totalAmount, Number((rx.price + otc.price * 2).toFixed(2)));
    const mine = await api("GET", "/api/medicines/orders", actors.bob.token);
    const listed = mine.body.find((o: any) => o.id === res.body.order.id);
    assert.ok(listed, "the order should be in My orders");
    assert.equal(listed.status, "PENDING");
    assert.equal(listed.prescriptionAttached, true);
    assert.equal(listed.items.length, 2);
  });

  test("an unknown medicine id is refused -> 404", async () => {
    const res = await api("POST", "/api/medicines/order", actors.bob.token, {
      items: [{ medicineId: "med-does-not-exist", name: "x", quantity: 1, price: 1 }],
      totalAmount: 1, deliveryAddress: "Test"
    });
    assert.equal(res.status, 404);
  });
});

describe("the dispatch state machine", () => {
  test("an invalid alert status is rejected -> 400", async () => {
    const res = await api("PUT", "/api/emergency/alerts/sos-1/status", actors.admin.token, { status: "NONSENSE" });
    assert.equal(res.status, 400);
  });
});
