/**
 * Verified-provider booking (server/firebase/booking.ts), against the Firebase emulators:
 * applications stay hidden until an admin verifies them, only the owning verified doctor can
 * publish times, a slot can be booked once even under concurrent requests, and patients can
 * see, cancel and reschedule only their own appointments.
 *
 *   npm run test:server
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createActor, requireEmulators, firebaseAdmin, type Actor } from "./helpers/firebaseAccounts";

const PORT = Number(process.env.TEST_PORT) || 3802;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.booking.test.db";
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

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const application = {
  fullName: "Dr. Test Provider", specialty: "General Physician", qualifications: ["MBBS"],
  registrationNumber: "TEST-REG-0001", city: "Noida", locality: "Sector 62", consultationTypes: ["online", "in_person"],
};

before(async () => {
  requireEmulators();
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true });
  // Earlier runs' providers, slots and appointments would change the counts below.
  const { firestore } = await firebaseAdmin();
  for (const col of ["doctors", "doctorSlots", "appointments", "notificationOutbox"]) {
    const s = await firestore.collection(col).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  server = spawn("npx", ["tsx", "server.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DB_PATH: TEST_DB, DEMO_MODE: "false", NODE_ENV: "development", API_ONLY: "true", DISABLE_HMR: "true" },
    shell: process.platform === "win32",
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});
  const deadline = Date.now() + 60_000;
  for (;;) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* not up */ }
    if (Date.now() > deadline) throw new Error("test server did not start");
    await new Promise((r) => setTimeout(r, 400));
  }
  a.doctor = await createActor("dr.provider@booking.invalid", "Dr Provider", "DOCTOR");
  a.otherDoctor = await createActor("dr.other@booking.invalid", "Dr Other", "DOCTOR");
  a.alice = await createActor("alice@booking.invalid", "Alice Patient", "PATIENT");
  a.bob = await createActor("bob@booking.invalid", "Bob Patient", "PATIENT");
  a.admin = await createActor("admin@booking.invalid", "Admin", "ADMIN");
});

after(() => {
  if (server?.pid && process.platform === "win32") {
    try { spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
  }
  server?.kill();
  try { if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true }); } catch { /* windows lock */ }
});

describe("provider onboarding", () => {
  test("only a doctor account can apply, and the profile starts pending and hidden", async () => {
    assert.equal((await api("POST", "/api/v1/doctors/applications", a.alice.token, application)).status, 403);
    assert.equal((await api("POST", "/api/v1/doctors/applications", undefined, application)).status, 401);
    const res = await api("POST", "/api/v1/doctors/applications", a.doctor.token, application);
    assert.equal(res.status, 202);
    assert.equal(res.body.doctorId, a.doctor.uid);
    assert.equal(res.body.verificationStatus, "pending");
    const list = await api("GET", "/api/v1/doctors");
    assert.equal(list.status, 200);
    assert.ok(!list.body.doctors.some((d: any) => d.id === a.doctor.uid), "pending doctor must not be listed");
  });

  test("an application cannot set its own verification status", async () => {
    const res = await api("POST", "/api/v1/doctors/applications", a.otherDoctor.token, { ...application, verificationStatus: "verified", listingStatus: "active" });
    assert.equal(res.status, 400);
  });

  test("an unverified doctor cannot publish times", async () => {
    const res = await api("POST", `/api/v1/doctors/${a.doctor.uid}/slots`, a.doctor.token, { startsAt: inHours(24), endsAt: inHours(24.5), consultationType: "online" });
    assert.equal(res.status, 403);
  });

  test("only an admin can verify, and only consistent decisions are accepted", async () => {
    const body = { verificationStatus: "verified", listingStatus: "active" };
    assert.equal((await api("PATCH", `/api/v1/doctors/${a.doctor.uid}/verification`, a.doctor.token, body)).status, 403);
    assert.equal((await api("PATCH", `/api/v1/doctors/${a.doctor.uid}/verification`, a.admin.token, { verificationStatus: "verified", listingStatus: "hidden" })).status, 400);
    assert.equal((await api("PATCH", `/api/v1/doctors/${a.doctor.uid}/verification`, a.admin.token, body)).status, 200);
    const list = await api("GET", "/api/v1/doctors?city=Noida");
    const listed = list.body.doctors.find((d: any) => d.id === a.doctor.uid);
    assert.ok(listed, "verified doctor is listed");
    assert.equal(listed.registrationNumber, undefined, "registration number is never public");
    assert.equal(listed.ownerUid, undefined);
    assert.equal((await api("GET", "/api/v1/doctors?city=Delhi")).body.doctors.length, 0);
  });
});

describe("availability", () => {
  test("only the owning doctor publishes, in the future, without overlaps", async () => {
    const slot = { startsAt: inHours(24), endsAt: inHours(24.5), consultationType: "online" };
    assert.equal((await api("POST", `/api/v1/doctors/${a.doctor.uid}/slots`, a.otherDoctor.token, slot)).status, 403);
    assert.equal((await api("POST", `/api/v1/doctors/${a.doctor.uid}/slots`, a.doctor.token, { ...slot, startsAt: inHours(-2), endsAt: inHours(-1) })).status, 400);
    assert.equal((await api("POST", `/api/v1/doctors/${a.doctor.uid}/slots`, a.doctor.token, slot)).status, 201);
    assert.equal((await api("POST", `/api/v1/doctors/${a.doctor.uid}/slots`, a.doctor.token, { ...slot, startsAt: inHours(24.25), endsAt: inHours(24.75) })).status, 409);
    assert.equal((await api("POST", `/api/v1/doctors/${a.doctor.uid}/slots`, a.doctor.token, { startsAt: inHours(25), endsAt: inHours(25.5), consultationType: "online" })).status, 201);
    assert.equal((await api("POST", `/api/v1/doctors/${a.doctor.uid}/slots`, a.doctor.token, { startsAt: inHours(26), endsAt: inHours(26.5), consultationType: "in_person" })).status, 201);
    const open = await api("GET", `/api/v1/doctors/${a.doctor.uid}/slots`);
    assert.equal(open.status, 200);
    assert.equal(open.body.slots.length, 3);
  });

  test("an unlisted doctor's times are not public", async () => {
    assert.equal((await api("GET", `/api/v1/doctors/${a.otherDoctor.uid}/slots`)).status, 404);
  });
});

describe("booking", () => {
  let slots: any[] = [];
  let aliceAppt = "";

  before(async () => { slots = (await api("GET", `/api/v1/doctors/${a.doctor.uid}/slots`)).body.slots; });

  test("staff accounts cannot book", async () => {
    const res = await api("POST", "/api/v1/appointments", a.doctor.token, { doctorId: a.doctor.uid, slotId: slots[0].id, consultationType: "online" });
    assert.equal(res.status, 403);
  });

  test("the consultation type must match the slot", async () => {
    const res = await api("POST", "/api/v1/appointments", a.alice.token, { doctorId: a.doctor.uid, slotId: slots[0].id, consultationType: "in_person" });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "CONSULTATION_TYPE_MISMATCH");
  });

  test("a slot is booked once, even when two patients try at the same moment", async () => {
    const body = { doctorId: a.doctor.uid, slotId: slots[0].id, consultationType: "online" };
    const [r1, r2] = await Promise.all([api("POST", "/api/v1/appointments", a.alice.token, body), api("POST", "/api/v1/appointments", a.bob.token, body)]);
    const statuses = [r1.status, r2.status].sort();
    assert.deepEqual(statuses, [201, 409]);
    const winner = r1.status === 201 ? r1 : r2;
    // Make Alice the owner for the rest of the suite, whichever request won.
    if (r1.status === 201) aliceAppt = winner.body.appointmentId;
    else {
      const bobAppt = winner.body.appointmentId;
      assert.equal((await api("POST", `/api/v1/appointments/${bobAppt}/cancel`, a.bob.token)).status, 200);
      const again = await api("POST", "/api/v1/appointments", a.alice.token, body);
      assert.equal(again.status, 201);
      aliceAppt = again.body.appointmentId;
    }
    const open = (await api("GET", `/api/v1/doctors/${a.doctor.uid}/slots`)).body.slots;
    assert.ok(!open.some((s: any) => s.id === slots[0].id), "booked slot is no longer open");
  });

  test("patients see only their own appointments, with the doctor's name", async () => {
    const mine = await api("GET", "/api/v1/appointments/mine", a.alice.token);
    const appt = mine.body.appointments.find((x: any) => x.id === aliceAppt);
    assert.ok(appt);
    assert.equal(appt.doctorName, application.fullName);
    assert.equal(appt.patientUid, a.alice.uid);
    const bobs = await api("GET", "/api/v1/appointments/mine", a.bob.token);
    assert.ok(!bobs.body.appointments.some((x: any) => x.id === aliceAppt && x.status === "confirmed"));
  });

  test("another patient cannot cancel or reschedule it", async () => {
    assert.equal((await api("POST", `/api/v1/appointments/${aliceAppt}/cancel`, a.bob.token)).status, 404);
    assert.equal((await api("POST", `/api/v1/appointments/${aliceAppt}/reschedule`, a.bob.token, { newSlotId: slots[1].id })).status, 404);
  });

  test("rescheduling moves to an open slot of the same type and frees the old one", async () => {
    const wrongType = slots.find((s) => s.consultationType === "in_person");
    assert.equal((await api("POST", `/api/v1/appointments/${aliceAppt}/reschedule`, a.alice.token, { newSlotId: wrongType.id })).status, 409);
    const target = slots.find((s) => s.consultationType === "online" && s.id !== slots[0].id);
    const res = await api("POST", `/api/v1/appointments/${aliceAppt}/reschedule`, a.alice.token, { newSlotId: target.id });
    assert.equal(res.status, 200);
    const open = (await api("GET", `/api/v1/doctors/${a.doctor.uid}/slots`)).body.slots.map((s: any) => s.id);
    assert.ok(open.includes(slots[0].id), "old slot is open again");
    assert.ok(!open.includes(target.id), "new slot is taken");
  });

  test("cancelling frees the slot, and a cancelled appointment cannot be cancelled again", async () => {
    assert.equal((await api("POST", `/api/v1/appointments/${aliceAppt}/cancel`, a.alice.token)).status, 200);
    assert.equal((await api("POST", `/api/v1/appointments/${aliceAppt}/cancel`, a.alice.token)).status, 409);
    const open = (await api("GET", `/api/v1/doctors/${a.doctor.uid}/slots`)).body.slots;
    assert.equal(open.length, 3);
  });

  test("a rejected doctor can no longer be booked", async () => {
    assert.equal((await api("PATCH", `/api/v1/doctors/${a.doctor.uid}/verification`, a.admin.token, { verificationStatus: "rejected", listingStatus: "hidden" })).status, 200);
    const res = await api("POST", "/api/v1/appointments", a.alice.token, { doctorId: a.doctor.uid, slotId: slots[1].id, consultationType: "online" });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "DOCTOR_NOT_BOOKABLE");
    assert.ok(!(await api("GET", "/api/v1/doctors")).body.doctors.some((d: any) => d.id === a.doctor.uid));
  });
});

describe("intelligence platform endpoints", () => {
  test("the module inventory is public; the AI endpoints need a session", async () => {
    const mods = await api("GET", "/api/v1/platform/modules");
    assert.equal(mods.status, 200);
    assert.equal(mods.body.modules.length, 7);
    assert.equal((await api("POST", "/api/v1/nlp/analyze", undefined, { text: "mujhe bukhar hai" })).status, 401);
    const nlp = await api("POST", "/api/v1/nlp/analyze", a.alice.token, { text: "mujhe bukhar hai" });
    assert.equal(nlp.status, 200);
    assert.equal(nlp.body.classification.intent, "symptoms");
  });

  test("the copilot answers an emergency with the urgent route", async () => {
    const r = await api("POST", "/api/v1/copilot/chat", a.alice.token, { message: "I have difficulty breathing", language: "en" });
    assert.equal(r.status, 200);
    assert.equal(r.body.route, "urgent_human_care");
    assert.deepEqual(r.body.safetyFlags, ["possible_urgent_symptom_language"]);
  });

  test("a report file is read without being stored", async () => {
    const res = await fetch(`${BASE}/api/v1/documents/extract?filename=report.txt`, {
      method: "POST", headers: { "Content-Type": "text/plain", Authorization: `Bearer ${a.alice.token}` },
      body: "Fasting glucose: 132 mg/dL\nHbA1c - 7.1 %",
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.lab.panel, "diabetes");
    assert.equal(body.lab.values.hba1c, 7.1);
    const unauth = await fetch(`${BASE}/api/v1/documents/extract?filename=report.txt`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" });
    assert.equal(unauth.status, 401);
  });

  test("forecasts are for hospital staff and admins only", async () => {
    const counts = Array.from({ length: 21 }, (_, i) => 10 + (i % 7));
    assert.equal((await api("POST", "/api/v1/ml/demand-forecast", a.alice.token, { dailyCounts: counts })).status, 403);
    const r = await api("POST", "/api/v1/ml/demand-forecast", a.admin.token, { dailyCounts: counts, horizonDays: 7 });
    assert.equal(r.status, 200);
    assert.equal(r.body.forecast.length, 7);
    assert.equal((await api("POST", "/api/v1/ml/demand-forecast", a.admin.token, { dailyCounts: [1, 2, 3] })).status, 400);
    assert.equal((await api("GET", "/api/v1/ml/demand-forecast?series=appointments", a.alice.token)).status, 403);
    assert.equal((await api("GET", "/api/v1/ml/demand-forecast?series=appointments", a.admin.token)).status, 200);
  });

  test("discovery ranks only verified, active providers from the server's own records", async () => {
    // The suite's doctor was rejected above; a request cannot smuggle in its own provider list.
    const r = await api("POST", "/api/v1/discovery/rank", a.alice.token, {
      specialty: "General Physician", city: "Noida",
      providers: [{ id: "fake", verificationStatus: "verified", listingStatus: "active", specialty: "General Physician", city: "Noida" }],
    });
    assert.equal(r.status, 200);
    assert.ok(!r.body.results.some((x: any) => x.doctor.id === "fake" || x.doctor.id === a.doctor.uid));
  });
});
