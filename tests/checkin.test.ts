/**
 * Same-day check-in on Firestore bookings (server/firebase/checkin.ts), against the Firebase
 * emulators: who can check in, leave, read the line and call a patient in; online bookings and
 * the time window; the Asia/Kolkata day (unit-tested directly, with fixed instants); ordering by
 * booked time, not arrival; what "ahead" counts; leaving and rejoining; the cap of three;
 * "not here"; reschedule clearing the check-in; a refused doctor; and that no response carries
 * another patient's data.
 *
 *   npm run test:server
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createActor, requireEmulators, firebaseAdmin, type Actor } from "./helpers/firebaseAccounts";
import { istDayBounds, istDayKey } from "../server/firebase/istDay";

const PORT = Number(process.env.TEST_PORT) || 3807;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.checkin.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);
/** Higher than production, so the suite's own reads do not trip it; the last test goes past it. */
const POLL_LIMIT = 40;
let server: ChildProcessWithoutNullStreams;
const a: Record<string, Actor> = {};
const appt: Record<string, string> = {};

async function api(method: string, route: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: payload, headers: res.headers };
}

const MIN = 60_000;
const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const application = {
  fullName: "Dr. Chandni Checkin", specialty: "General Physician", qualifications: ["MBBS"],
  registrationNumber: "TEST-REG-0401", city: "Delhi", locality: "Saket", consultationTypes: ["online", "in_person"],
};

const fs = async () => (await firebaseAdmin()).firestore;
const appointmentDoc = async (id: string) => (await (await fs()).collection("appointments").doc(id).get()).data()!;
const auditFor = async (id: string, action?: string) =>
  (await (await fs()).collection("auditLogs").where("resourceId", "==", id).get()).docs.filter((d) => !action || d.get("action") === action);

/**
 * Times on today's Asia/Kolkata day, inside the check-in window right now, whatever the time of
 * day the suite runs: startsAt = base + k minutes (k from 0 to 30), endsAt 90 minutes later.
 * base is 20 minutes ago, kept within today's IST day, so base <= now always.
 */
function todayTimes(k: number) {
  const now = Date.now();
  const { startIso, endIso } = istDayBounds(now);
  const base = Math.max(Date.parse(startIso), Math.min(now - 20 * MIN, Date.parse(endIso) - 50 * MIN));
  const s = base + k * MIN;
  return { startsAt: new Date(s).toISOString(), endsAt: new Date(s + 90 * MIN).toISOString() };
}
const setToday = async (id: string, k: number) => (await fs()).collection("appointments").doc(id).update(todayTimes(k));
const setTimes = async (id: string, startHours: number, endHours: number) =>
  (await fs()).collection("appointments").doc(id).update({ startsAt: inHours(startHours), endsAt: inHours(endHours) });

/** A booking written straight to Firestore, for states the routes cannot reach on their own. */
async function direct(fields: Record<string, unknown>) {
  const ref = (await fs()).collection("appointments").doc();
  await ref.set({
    patientUid: "noise-patient", doctorId: a.dev.uid, doctorName: "Dr Noise", specialty: "General Physician", slotId: "none",
    consultationType: "in_person", reason: "", status: "confirmed", ...todayTimes(0), ...fields,
  });
  return ref.id;
}

const checkIn = (id: string, token?: string, body?: unknown) => api("POST", `/api/v1/appointments/${id}/check-in`, token, body);
const leave = (id: string, token?: string) => api("DELETE", `/api/v1/appointments/${id}/check-in`, token);
const queue = (id: string, token?: string) => api("GET", `/api/v1/appointments/${id}/queue`, token);
const visit = (id: string, token: string | undefined, body: unknown) => api("POST", `/api/v1/appointments/${id}/visit-state`, token, body);
const doctorRow = async (id: string, who = a.dev) => (await api("GET", "/api/v1/appointments/doctor", who.token)).body.appointments.find((x: any) => x.id === id);
const mineRow = async (id: string, who: Actor) => (await api("GET", "/api/v1/appointments/mine", who.token)).body.appointments.find((x: any) => x.id === id);

before(async () => {
  requireEmulators();
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true });
  const firestore = await fs();
  for (const col of ["doctors", "doctorSlots", "appointments", "prescriptions", "notificationOutbox", "auditLogs"]) {
    await firestore.recursiveDelete(firestore.collection(col));
  }
  server = spawn("npx", ["tsx", "server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env, PORT: String(PORT), DB_PATH: TEST_DB, DEMO_MODE: "false", NODE_ENV: "development", API_ONLY: "true", DISABLE_HMR: "true",
      MESSAGES_POLL_LIMIT: String(POLL_LIMIT),
    },
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
  a.admin = await createActor("admin@checkin.invalid", "Admin", "ADMIN");
  a.hospital = await createActor("hospital@checkin.invalid", "Hospital Desk", "HOSPITAL", { hospitalId: "h-checkin" });
  a.dev = await createActor("dev@checkin.invalid", "Dr Dev", "DOCTOR");
  a.other = await createActor("other@checkin.invalid", "Dr Other", "DOCTOR");
  a.rex = await createActor("rex@checkin.invalid", "Dr Rex", "DOCTOR");
  a.alice = await createActor("alice@checkin.invalid", "Alice Patient", "PATIENT");
  a.bob = await createActor("bob@checkin.invalid", "Bob Patient", "PATIENT");
  a.carl = await createActor("carl@checkin.invalid", "Carl Patient", "PATIENT");
  a.dana = await createActor("dana@checkin.invalid", "Dana Patient", "PATIENT");
  a.fay = await createActor("fay@checkin.invalid", "Fay Patient", "PATIENT");
  a.gus = await createActor("gus@checkin.invalid", "Gus Patient", "PATIENT");
  a.hana = await createActor("hana@checkin.invalid", "Hana Patient", "PATIENT");
  a.ivan = await createActor("ivan@checkin.invalid", "Ivan Patient", "PATIENT");
  a.nico = await createActor("nico@checkin.invalid", "Nico NoConsent", "PATIENT", {}, { consent: false });

  const verify = async (who: Actor, reg: string, name: string) => {
    assert.equal((await api("POST", "/api/v1/doctors/applications", who.token, { ...application, fullName: name, registrationNumber: reg })).status, 202);
    assert.equal((await api("PATCH", `/api/v1/doctors/${who.uid}/verification`, a.admin.token, { verificationStatus: "verified", listingStatus: "active" })).status, 200);
  };
  await verify(a.dev, "TEST-REG-0401", application.fullName);
  await verify(a.other, "TEST-REG-0402", "Dr. Other Checkin");
  await verify(a.rex, "TEST-REG-0403", "Dr. Rex Checkin");

  let hour = 40;
  const slot = async (doctor: Actor, type: "online" | "in_person", at?: number) => {
    const h = at ?? (hour += 1);
    const s = await api("POST", `/api/v1/doctors/${doctor.uid}/slots`, doctor.token, { startsAt: inHours(h), endsAt: inHours(h + 0.5), consultationType: type });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    return s.body.slotId as string;
  };
  const book = async (who: Actor, type: "online" | "in_person" = "in_person", doctor = a.dev, at?: number) => {
    const res = await api("POST", "/api/v1/appointments", who.token, { doctorId: doctor.uid, slotId: await slot(doctor, type, at), consultationType: type, reason: "back pain" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.appointmentId as string;
  };
  // The line: three of Dr Dev's in-person patients today, booked in this order.
  appt.q1 = await book(a.alice);
  appt.q2 = await book(a.bob);
  appt.q3 = await book(a.carl);
  await setToday(appt.q1, 6);
  await setToday(appt.q2, 12);
  await setToday(appt.q3, 18);
  appt.online = await book(a.dana, "online");
  appt.far = await book(a.dana);
  appt.cancelled = await book(a.dana);
  appt.resched = await book(a.fay);
  appt.reschedTo = await slot(a.dev, "in_person");
  appt.gus = await book(a.gus);
  appt.spare = await book(a.dana);
  // Dr Rex: one visit under way (stays when he is refused), one upcoming (cancelled then).
  appt.hana = await book(a.hana, "in_person", a.rex);
  appt.ivan = await book(a.ivan, "in_person", a.rex);
});

after(() => {
  if (server?.pid && process.platform === "win32") {
    try { spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
  }
  server?.kill();
  try { if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true }); } catch { /* windows lock */ }
});

describe("the Asia/Kolkata day (fixed +05:30, never the host time zone)", () => {
  // 18 Nov 2026 00:30 IST is 17 Nov 19:00 UTC; 17 Nov 23:30 IST is 17 Nov 18:00 UTC.
  const slot0030 = "2026-11-17T19:00:00.000Z";
  const slot2330 = "2026-11-17T18:00:00.000Z";

  test("a 00:30 IST slot is on its IST day, the day after its UTC date", () => {
    assert.equal(istDayKey(slot0030), "2026-11-18");
    assert.equal(slot0030.slice(0, 10), "2026-11-17", "the UTC date would be wrong");
  });

  test("a 23:30 IST slot stays on its IST day", () => {
    assert.equal(istDayKey(slot2330), "2026-11-17");
    assert.notEqual(istDayKey(slot2330), istDayKey(slot0030), "one hour apart, on different IST days");
  });

  test("the day runs from 18:30 UTC the day before to 18:30 UTC, half open", () => {
    const b = istDayBounds(slot0030);
    assert.deepEqual(b, { day: "2026-11-18", startIso: "2026-11-17T18:30:00.000Z", endIso: "2026-11-18T18:30:00.000Z" });
    assert.ok(b.startIso <= slot0030 && slot0030 < b.endIso, "the 00:30 slot is inside its day");
    assert.ok(slot2330 < b.startIso, "the 23:30 slot of the day before is not");
    assert.equal(istDayKey("2026-11-17T18:29:59.999Z"), "2026-11-17");
    assert.equal(istDayKey("2026-11-17T18:30:00.000Z"), "2026-11-18");
    assert.deepEqual(istDayBounds(slot2330), { day: "2026-11-17", startIso: "2026-11-16T18:30:00.000Z", endIso: "2026-11-17T18:30:00.000Z" });
    assert.equal(istDayKey(Date.parse(slot0030)), istDayKey(new Date(slot0030)), "the same for numbers and dates");
  });

  test("the check-in window is the slot's IST day, from 60 minutes before start until end", async () => {
    const { checkInOpen } = await import("../server/firebase/checkin");
    const at = (iso: string) => Date.parse(iso);
    // 00:30-01:00 IST on 18 Nov.
    const s1 = slot0030, e1 = "2026-11-17T19:30:00.000Z";
    assert.equal(checkInOpen(s1, e1, at("2026-11-17T18:15:00.000Z")), false, "23:45 IST the evening before: within 60 minutes, but another day");
    assert.equal(checkInOpen(s1, e1, at("2026-11-17T18:30:00.000Z")), true, "00:00 IST");
    assert.equal(checkInOpen(s1, e1, at(e1)), true, "until the end");
    assert.equal(checkInOpen(s1, e1, at(e1) + 1), false, "not after it");
    // 23:30-00:00 IST on 17 Nov.
    const s2 = slot2330, e2 = "2026-11-17T18:30:00.000Z";
    assert.equal(checkInOpen(s2, e2, at("2026-11-17T17:00:00.000Z")), true, "22:30 IST, exactly 60 minutes before");
    assert.equal(checkInOpen(s2, e2, at("2026-11-17T17:00:00.000Z") - 1), false, "earlier than that");
    assert.equal(checkInOpen(s2, e2, at("2026-11-17T18:29:59.999Z")), true, "23:59:59 IST");
    assert.equal(checkInOpen(s2, e2, at("2026-11-17T18:30:00.000Z")), false, "midnight IST is the next day");
  });
});

describe("who can check in, leave, read the line and call in", () => {
  test("anonymous callers get 401 on every route", async () => {
    assert.equal((await checkIn(appt.q1)).status, 401);
    assert.equal((await leave(appt.q1)).status, 401);
    assert.equal((await queue(appt.q1)).status, 401);
    assert.equal((await visit(appt.q1, undefined, { state: "called" })).status, 401);
  });

  test("admin, hospital and doctor accounts get 403 on check-in, leave and the line", async () => {
    for (const who of [a.admin, a.hospital, a.dev]) {
      assert.equal((await checkIn(appt.q1, who.token)).status, 403);
      assert.equal((await leave(appt.q1, who.token)).status, 403);
      assert.equal((await queue(appt.q1, who.token)).status, 403);
    }
  });

  test("patients, admin and hospital get 403 on visit-state", async () => {
    for (const who of [a.alice, a.admin, a.hospital]) assert.equal((await visit(appt.q1, who.token, { state: "called" })).status, 403);
  });

  test("another patient's booking and an unknown id get the same 404", async () => {
    const bodies: string[] = [];
    for (const [id, who] of [[appt.q1, a.bob], ["no-such-appointment", a.alice]] as const) {
      for (const r of [await checkIn(id, who.token), await leave(id, who.token), await queue(id, who.token)]) {
        assert.equal(r.status, 404);
        bodies.push(JSON.stringify(r.body));
      }
    }
    for (const r of [await visit(appt.q1, a.other.token, { state: "called" }), await visit("no-such-appointment", a.dev.token, { state: "called" })]) {
      assert.equal(r.status, 404);
      bodies.push(JSON.stringify(r.body));
    }
    assert.equal(new Set(bodies).size, 1, "byte-identical bodies");
    assert.equal((await appointmentDoc(appt.q1)).arrivedAt, undefined, "nothing was written");
  });

  test("a patient without consent is stopped by the consent gate", async () => {
    for (const r of [await checkIn("no-such-appointment", a.nico.token), await queue("no-such-appointment", a.nico.token)]) {
      assert.equal(r.status, 403);
      assert.equal(r.body.error, "CONSENT_REQUIRED");
    }
  });

  test("check-in takes no body", async () => {
    assert.equal((await checkIn(appt.q1, a.alice.token, { arrivedAt: inHours(-5) })).status, 400);
    assert.equal((await appointmentDoc(appt.q1)).arrivedAt, undefined);
  });
});

describe("when a patient can check in", () => {
  test("not on an online appointment", async () => {
    await setToday(appt.online, 5);
    for (const r of [await checkIn(appt.online, a.dana.token), await queue(appt.online, a.dana.token)]) {
      assert.equal(r.status, 409);
      assert.equal(r.body.code, "CHECKIN_NOT_IN_PERSON");
    }
  });

  test("not three hours before, not tomorrow, not after the end", async () => {
    for (const [s, e, why] of [[3, 3.5, "in three hours"], [24, 24.5, "tomorrow"], [-2, -1, "ended an hour ago"]] as const) {
      await setTimes(appt.far, s, e);
      const r = await checkIn(appt.far, a.dana.token);
      assert.equal(r.status, 409, why);
      assert.equal(r.body.code, "CHECKIN_NOT_OPEN", why);
    }
    assert.equal((await appointmentDoc(appt.far)).arrivedAt, undefined);
    assert.equal((await auditFor(appt.far)).filter((d) => d.get("action") !== "appointment.created").length, 0, "refused requests are not audited");
  });

  test("not on a cancelled or completed booking", async () => {
    assert.equal((await api("POST", `/api/v1/appointments/${appt.cancelled}/cancel`, a.dana.token)).status, 200);
    await setToday(appt.cancelled, 5);
    for (const r of [await checkIn(appt.cancelled, a.dana.token), await queue(appt.cancelled, a.dana.token), await leave(appt.cancelled, a.dana.token)]) {
      assert.equal(r.status, 409);
      assert.equal(r.body.code, "APPOINTMENT_NOT_OPEN");
    }
    const done = await direct({ patientUid: a.dana.uid, status: "completed", completedAt: inHours(-0.1) });
    const r = await checkIn(done, a.dana.token);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "APPOINTMENT_NOT_OPEN");
    assert.deepEqual((await queue(done, a.dana.token)).body, { state: "done", arrivedAt: null, ahead: 0, estimate: null });
  });
});

describe("the line: booked time decides, not arrival", () => {
  test("before checking in, a patient is not in the line", async () => {
    const r = await queue(appt.q3, a.carl.token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { state: "not_arrived", arrivedAt: null, ahead: 0, estimate: null });
  });

  test("noise that must never count: other doctors, online, cancelled, completed, called, another day", async () => {
    const arrived = inHours(-0.1);
    appt.noise = [
      await direct({ doctorId: a.other.uid, arrivedAt: arrived, ...todayTimes(0) }),
      await direct({ consultationType: "online", arrivedAt: arrived, ...todayTimes(1) }),
      await direct({ status: "cancelled", cancelledBy: "city_healer", arrivedAt: arrived, ...todayTimes(2) }),
      await direct({ status: "completed", arrivedAt: arrived, ...todayTimes(3) }),
      await direct({ arrivedAt: arrived, calledAt: arrived, ...todayTimes(4) }),
      // Yesterday, same doctor, still marked waiting: earlier than everyone, but another day.
      await direct({ arrivedAt: arrived, startsAt: new Date(Date.parse(todayTimes(0).startsAt) - 24 * 3600_000).toISOString(), endsAt: new Date(Date.parse(todayTimes(0).endsAt) - 24 * 3600_000).toISOString() }),
      // Booked later than everyone in the line, arrived first.
      await direct({ arrivedAt: inHours(-1), ...todayTimes(25) }),
    ].join(",");
  });

  test("the last booked checks in first and is not ahead of anyone", async () => {
    const r = await checkIn(appt.q3, a.carl.token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.state, "waiting");
    assert.equal(r.body.ahead, 0);
    assert.ok(r.body.arrivedAt);
  });

  test("each patient booked earlier who checks in goes before them", async () => {
    const bob = await checkIn(appt.q2, a.bob.token);
    assert.equal(bob.body.ahead, 0, "nobody booked before Bob is waiting");
    assert.equal((await queue(appt.q3, a.carl.token)).body.ahead, 1);
    const alice = await checkIn(appt.q1, a.alice.token);
    assert.equal(alice.body.ahead, 0);
    assert.equal((await queue(appt.q2, a.bob.token)).body.ahead, 1);
    assert.equal((await queue(appt.q3, a.carl.token)).body.ahead, 2, "Carl arrived first and is still third");
    // A7: a rough wait from the number ahead and the slot length, as a range, never a promised time.
    const carl = (await queue(appt.q3, a.carl.token)).body;
    assert.equal(carl.estimate.basis, "slot-length");
    assert.ok(carl.estimate.low > 0 && carl.estimate.low <= carl.estimate.high, JSON.stringify(carl.estimate));
    const bobView = (await queue(appt.q2, a.bob.token)).body;
    assert.ok(carl.estimate.high > bobView.estimate.high, "more people ahead means a longer estimate");
  });

  test("the response holds the caller's own state and a count, nothing about anyone else", async () => {
    const r = await queue(appt.q3, a.carl.token);
    assert.deepEqual(Object.keys(r.body).sort(), ["ahead", "arrivedAt", "estimate", "state"]);
    const text = JSON.stringify(r.body) + JSON.stringify((await checkIn(appt.q3, a.carl.token)).body);
    for (const s of [a.alice.uid, a.bob.uid, appt.q1, appt.q2, a.dev.uid, "Alice", "Bob", ...appt.noise.split(",")]) assert.ok(!text.includes(s), `leaked ${s}`);
  });

  test("checking in again returns the same arrival and writes nothing", async () => {
    const first = (await appointmentDoc(appt.q3)).arrivedAt;
    const again = await checkIn(appt.q3, a.carl.token);
    assert.equal(again.status, 200);
    assert.equal(again.body.arrivedAt, first);
    assert.equal((await appointmentDoc(appt.q3)).checkInCount, 1);
    assert.equal((await auditFor(appt.q3, "appointment.checked_in")).length, 1);
  });

  test("a patient who cancels drops out of the others' count", async () => {
    // Bob's booking is cancelled (as a refusal or the patient would): the status filter drops it.
    await (await fs()).collection("appointments").doc(appt.q2).update({ status: "cancelled" });
    assert.equal((await queue(appt.q3, a.carl.token)).body.ahead, 1);
    await (await fs()).collection("appointments").doc(appt.q2).update({ status: "confirmed" });
    assert.equal((await queue(appt.q3, a.carl.token)).body.ahead, 2);
  });

  test("the doctor's list shows arrivals; the patient's list shows their own", async () => {
    const row = await doctorRow(appt.q1);
    assert.ok(row.arrivedAt);
    assert.equal(row.calledAt, null);
    assert.equal((await mineRow(appt.q1, a.alice)).arrivedAt, row.arrivedAt);
    assert.equal((await mineRow(appt.q1, a.alice)).checkInCount, undefined);
  });
});

describe("the doctor calls in, or marks not here", () => {
  test("the body is checked", async () => {
    for (const body of [{ state: "done" }, { state: "NONSENSE" }, {}, { state: "called", patientUid: a.bob.uid }]) {
      assert.equal((await visit(appt.q1, a.dev.token, body)).status, 400, JSON.stringify(body));
    }
  });

  test("a patient who has not checked in cannot be called", async () => {
    await setToday(appt.spare, 8);
    for (const state of ["called", "not_here"]) {
      const r = await visit(appt.spare, a.dev.token, { state });
      assert.equal(r.status, 409);
      assert.equal(r.body.code, "NOT_CHECKED_IN");
    }
  });

  test("calling in: the patient is told, and those after them move up", async () => {
    const r = await visit(appt.q1, a.dev.token, { state: "called" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { appointmentId: appt.q1, state: "called" });
    assert.equal((await queue(appt.q1, a.alice.token)).body.state, "called");
    assert.equal((await queue(appt.q2, a.bob.token)).body.ahead, 0);
    assert.equal((await queue(appt.q3, a.carl.token)).body.ahead, 1);
    assert.ok((await doctorRow(appt.q1)).calledAt);
  });

  test("calling again is a 200 that changes nothing", async () => {
    const before = (await appointmentDoc(appt.q1)).calledAt;
    assert.equal((await visit(appt.q1, a.dev.token, { state: "called" })).status, 200);
    assert.equal((await appointmentDoc(appt.q1)).calledAt, before);
    assert.equal((await auditFor(appt.q1, "appointment.called")).length, 1);
  });

  test("a called patient cannot leave the line", async () => {
    const r = await leave(appt.q1, a.alice.token);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "NOT_WAITING");
  });

  test("not here clears the arrival; the others move up and the patient can check in again", async () => {
    assert.deepEqual((await visit(appt.q2, a.dev.token, { state: "not_here" })).body, { appointmentId: appt.q2, state: "not_arrived" });
    const bob = await queue(appt.q2, a.bob.token);
    assert.deepEqual(bob.body, { state: "not_arrived", arrivedAt: null, ahead: 0, estimate: null });
    assert.equal((await queue(appt.q3, a.carl.token)).body.ahead, 0);
    assert.equal((await auditFor(appt.q2, "appointment.arrival_cleared")).length, 1);
    const again = await checkIn(appt.q2, a.bob.token);
    assert.equal(again.body.state, "waiting");
    assert.equal((await appointmentDoc(appt.q2)).checkInCount, 2);
    assert.equal((await queue(appt.q3, a.carl.token)).body.ahead, 1);
  });

  test("finishing is the existing complete route, and the patient sees done", async () => {
    // complete needs startsAt <= now; just after IST midnight todayTimes(6) can be a few minutes ahead.
    await (await fs()).collection("appointments").doc(appt.q1).update({ startsAt: inHours(-0.01) });
    assert.equal((await api("POST", `/api/v1/appointments/${appt.q1}/complete`, a.dev.token)).status, 200);
    assert.equal((await queue(appt.q1, a.alice.token)).body.state, "done");
    const r = await visit(appt.q1, a.dev.token, { state: "called" });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "APPOINTMENT_NOT_OPEN");
  });
});

describe("leaving and rejoining, up to three check-ins", () => {
  test("leaving takes the patient out of the line; leaving again is a no-op", async () => {
    const r = await leave(appt.q3, a.carl.token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { state: "not_arrived" });
    assert.equal((await queue(appt.q3, a.carl.token)).body.state, "not_arrived");
    assert.equal((await leave(appt.q3, a.carl.token)).status, 200);
    assert.equal((await auditFor(appt.q3, "appointment.check_in_left")).length, 1);
  });

  test("the patient can rejoin, and is placed by booked time again", async () => {
    const r = await checkIn(appt.q3, a.carl.token);
    assert.equal(r.body.state, "waiting");
    assert.equal(r.body.ahead, 1, "Bob, booked earlier, is still ahead");
  });

  test("the fourth check-in is refused", async () => {
    assert.equal((await leave(appt.q3, a.carl.token)).status, 200);
    assert.equal((await checkIn(appt.q3, a.carl.token)).status, 200);
    assert.equal((await appointmentDoc(appt.q3)).checkInCount, 3);
    assert.equal((await leave(appt.q3, a.carl.token)).status, 200);
    const r = await checkIn(appt.q3, a.carl.token);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "CHECKIN_LIMIT");
    assert.equal((await queue(appt.q3, a.carl.token)).body.state, "not_arrived");
    assert.equal((await auditFor(appt.q3, "appointment.checked_in")).length, 3);
    assert.equal((await auditFor(appt.q3, "appointment.check_in_left")).length, 3);
  });
});

describe("rescheduling clears the check-in", () => {
  test("arrivedAt, calledAt and checkInCount are removed with the old time", async () => {
    await setToday(appt.resched, 9);
    assert.equal((await checkIn(appt.resched, a.fay.token)).status, 200);
    assert.equal((await visit(appt.resched, a.dev.token, { state: "called" })).status, 200);
    // The visit has not started yet, so the patient may still move it.
    await setTimes(appt.resched, 0.5, 1);
    const r = await api("POST", `/api/v1/appointments/${appt.resched}/reschedule`, a.fay.token, { newSlotId: appt.reschedTo });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const doc = await appointmentDoc(appt.resched);
    assert.equal(doc.arrivedAt, undefined);
    assert.equal(doc.calledAt, undefined);
    assert.equal(doc.checkInCount, undefined);
    const row = await mineRow(appt.resched, a.fay);
    assert.equal(row.arrivedAt, null);
    assert.equal(row.calledAt, null);
    assert.deepEqual((await queue(appt.resched, a.fay.token)).body, { state: "not_arrived", arrivedAt: null, ahead: 0, estimate: null });
  });
});

describe("a refused doctor", () => {
  test("cannot call patients in, and no one can check in with them", async () => {
    await setToday(appt.hana, 0); // under way: a refusal leaves it confirmed
    assert.equal((await checkIn(appt.hana, a.hana.token)).status, 200);
    const reject = await api("PATCH", `/api/v1/doctors/${a.rex.uid}/verification`, a.admin.token, { verificationStatus: "rejected", listingStatus: "hidden" });
    assert.equal(reject.status, 200);
    assert.equal(reject.body.cancelledAppointments, 1);

    for (const state of ["called", "not_here"]) {
      const r = await visit(appt.hana, a.rex.token, { state });
      assert.equal(r.status, 403);
      assert.equal(r.body.code, "DOCTOR_NOT_VERIFIED");
    }
    assert.equal((await appointmentDoc(appt.hana)).calledAt, undefined);

    const again = await checkIn(appt.hana, a.hana.token);
    assert.equal(again.status, 409);
    assert.equal(again.body.code, "DOCTOR_NOT_AVAILABLE");
    assert.equal((await leave(appt.hana, a.hana.token)).status, 200, "the patient can still leave");

    // The upcoming booking the refusal cancelled has no line.
    await setToday(appt.ivan, 5);
    for (const r of [await checkIn(appt.ivan, a.ivan.token), await queue(appt.ivan, a.ivan.token)]) {
      assert.equal(r.status, 409);
      assert.equal(r.body.code, "APPOINTMENT_NOT_OPEN");
    }
  });
});

describe("audit and limits", () => {
  test("audit events hold ids only", async () => {
    const all = (await (await fs()).collection("auditLogs").get()).docs.filter((d) => String(d.get("action")).match(/checked_in|check_in_left|appointment\.called|arrival_cleared/));
    const actions = new Set(all.map((d) => d.get("action")));
    for (const x of ["appointment.checked_in", "appointment.check_in_left", "appointment.called", "appointment.arrival_cleared"]) assert.ok(actions.has(x), x);
    for (const d of all) {
      assert.deepEqual(Object.keys(d.data()).sort(), ["action", "actorUid", "createdAt", "resourceId", "resourceType"]);
      assert.equal(d.get("resourceType"), "appointment");
    }
    const text = JSON.stringify(all.map((d) => d.data()));
    assert.ok(!text.includes("back pain") && !text.includes("Alice") && !text.includes("Carl"));
  });

  test("polling the line is rate limited per account", async () => {
    let last = await queue(appt.gus, a.gus.token);
    assert.equal(last.status, 200);
    for (let i = 0; i < POLL_LIMIT && last.status === 200; i++) last = await queue(appt.gus, a.gus.token);
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers.get("retry-after")) >= 1);
    assert.equal((await queue(appt.q3, a.carl.token)).status, 200, "another account is not affected");
  });
});

describe("the doctor's Today list", () => {
  test("today's bookings are listed for a doctor with more than 300 bookings in all", async () => {
    // GET /doctor's general list is an unordered limit(300): Firestore returns it in document-id
    // order. 300 older bookings whose ids sort first would crowd today's out of it; the day query
    // must still bring today's booking in.
    const firestore = await fs();
    const batch = firestore.batch();
    for (let i = 0; i < 300; i++) {
      const at = Date.now() - (30 * 24 * 60 + i) * MIN;
      batch.set(firestore.collection("appointments").doc(`aaa-old-${String(i).padStart(3, "0")}`), {
        patientUid: "noise-patient", doctorId: a.other.uid, doctorName: "Dr Other", specialty: "General Physician", slotId: "none",
        consultationType: "in_person", reason: "", status: "completed", startsAt: new Date(at).toISOString(), endsAt: new Date(at + 30 * MIN).toISOString(),
      });
    }
    batch.set(firestore.collection("appointments").doc("zzz-today"), {
      patientUid: "noise-patient", doctorId: a.other.uid, doctorName: "Dr Other", specialty: "General Physician", slotId: "none",
      consultationType: "in_person", reason: "", status: "confirmed", arrivedAt: new Date().toISOString(), ...todayTimes(3),
    });
    await batch.commit();
    const row = await doctorRow("zzz-today", a.other);
    assert.ok(row, "today's booking is in the doctor's list");
    assert.ok(row.arrivedAt, "with its check-in");
    const r = await api("GET", "/api/v1/appointments/doctor", a.other.token);
    assert.equal(new Set(r.body.appointments.map((x: any) => x.id)).size, r.body.appointments.length, "no booking listed twice");
  });
});
