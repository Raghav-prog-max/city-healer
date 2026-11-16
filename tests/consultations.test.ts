/**
 * What a doctor does with a Firestore booking (server/firebase/consultations.ts; P1 item 6,
 * doctor side), against the Firebase emulators: complete, cancel with a reason, write the
 * prescription, read the patient's records. A doctor reaches only appointments booked with
 * their own profile, a cancelled booking gives no access to records, and a prescription is
 * readable only by the patient and the doctor on it.
 *
 *   npm run test:server
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createActor, requireEmulators, firebaseAdmin, type Actor } from "./helpers/firebaseAccounts";
import { TERMS_VERSION, PRIVACY_VERSION } from "../shared/consent";

const PORT = Number(process.env.TEST_PORT) || 3805;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.consultations.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);
let server: ChildProcessWithoutNullStreams;
const a: Record<string, Actor> = {};
// Alice: one appointment to complete, one the doctor cancels, one that gets a prescription, one
// that starts while still confirmed ("late"), and a spare. Bob: one that stays in the future.
const appt: Record<string, string> = {};
/** An open time nobody books, published in the tests that need somewhere to reschedule to. */
let spareSlot = "";

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
  fullName: "Dr. Dev Consultant", specialty: "General Physician", qualifications: ["MBBS"],
  registrationNumber: "TEST-REG-0077", city: "Delhi", locality: "Saket", consultationTypes: ["online"],
};
const rx = {
  diagnosis: "Viral fever",
  medicines: [{ name: "Paracetamol 500 mg", dosage: "1 tablet", frequency: "Three times a day after food", duration: "3 days" }],
  instructions: "Rest and fluids. Return if the fever lasts beyond three days.",
};

/** Appointments are booked in the future; move one's times, as time passing would. */
async function setTimes(id: string, startHours: number, endHours: number) {
  const { firestore } = await firebaseAdmin();
  await firestore.collection("appointments").doc(id).update({ startsAt: inHours(startHours), endsAt: inHours(endHours) });
}
const startNow = (id: string) => setTimes(id, -0.5, 0);
const appointmentDoc = async (id: string) => (await (await firebaseAdmin()).firestore.collection("appointments").doc(id).get()).data()!;
const slotDoc = async (id: string) => (await (await firebaseAdmin()).firestore.collection("doctorSlots").doc(id).get()).data()!;

before(async () => {
  requireEmulators();
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true });
  const { firestore } = await firebaseAdmin();
  for (const col of ["doctors", "doctorSlots", "appointments", "prescriptions", "notificationOutbox"]) {
    const s = await firestore.collection(col).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  server = spawn("npx", ["tsx", "server.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DB_PATH: TEST_DB, DEMO_MODE: "false", NODE_ENV: "development", API_ONLY: "true", DISABLE_HMR: "true" },
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
  a.admin = await createActor("admin@consult.invalid", "Admin", "ADMIN");
  a.dev = await createActor("dev@consult.invalid", "Dr Dev", "DOCTOR");
  a.other = await createActor("other@consult.invalid", "Dr Other", "DOCTOR");
  a.alice = await createActor("alice@consult.invalid", "Alice Patient", "PATIENT");
  a.bob = await createActor("bob@consult.invalid", "Bob Patient", "PATIENT");
  a.nico = await createActor("nico@consult.invalid", "Nico NoConsent", "PATIENT", {}, { consent: false });

  assert.equal((await api("POST", "/api/v1/doctors/applications", a.dev.token, application)).status, 202);
  assert.equal((await api("PATCH", `/api/v1/doctors/${a.dev.uid}/verification`, a.admin.token, { verificationStatus: "verified", listingStatus: "active" })).status, 200);
  const book = async (who: Actor, hours: number) => {
    const slot = await api("POST", `/api/v1/doctors/${a.dev.uid}/slots`, a.dev.token, { startsAt: inHours(hours), endsAt: inHours(hours + 0.5), consultationType: "online" });
    assert.equal(slot.status, 201);
    const res = await api("POST", "/api/v1/appointments", who.token, { doctorId: a.dev.uid, slotId: slot.body.slotId, consultationType: "online", reason: "fever" });
    assert.equal(res.status, 201);
    return res.body.appointmentId as string;
  };
  appt.complete = await book(a.alice, 24);
  appt.cancel = await book(a.alice, 26);
  appt.prescribe = await book(a.alice, 28);
  appt.bob = await book(a.bob, 30);
  appt.late = await book(a.alice, 32);
  appt.spare = await book(a.alice, 34);

  // Health-wallet records each patient saved themselves.
  assert.equal((await api("POST", "/api/records", a.alice.token, { title: "ALICE lab report", doctorName: "Self", diagnoseSummary: "alice private" })).status, 200);
  assert.equal((await api("POST", "/api/records", a.bob.token, { title: "BOB lab report", doctorName: "Self", diagnoseSummary: "bob private" })).status, 200);
});

after(() => {
  if (server?.pid && process.platform === "win32") {
    try { spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
  }
  server?.kill();
  try { if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true }); } catch { /* windows lock */ }
});

const mine = async (who: Actor, id: string) => (await api("GET", "/api/v1/appointments/mine", who.token)).body.appointments.find((x: any) => x.id === id);

describe("completing an appointment", () => {
  test("only the doctor it was booked with can, and only a doctor", async () => {
    assert.equal((await api("POST", `/api/v1/appointments/${appt.complete}/complete`)).status, 401);
    assert.equal((await api("POST", `/api/v1/appointments/${appt.complete}/complete`, a.alice.token)).status, 403);
    assert.equal((await api("POST", `/api/v1/appointments/${appt.complete}/complete`, a.admin.token)).status, 403);
    assert.equal((await api("POST", `/api/v1/appointments/${appt.complete}/complete`, a.other.token)).status, 404, "another doctor cannot tell it exists");
    assert.equal((await api("POST", "/api/v1/appointments/no-such-appointment/complete", a.dev.token)).status, 404);
  });

  test("not before it has started", async () => {
    const r = await api("POST", `/api/v1/appointments/${appt.complete}/complete`, a.dev.token);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "APPOINTMENT_NOT_STARTED");
  });

  test("once started it is completed, once, and the patient sees it", async () => {
    await startNow(appt.complete);
    assert.equal((await api("POST", `/api/v1/appointments/${appt.complete}/complete`, a.dev.token)).status, 200);
    assert.equal((await mine(a.alice, appt.complete)).status, "completed");
    const again = await api("POST", `/api/v1/appointments/${appt.complete}/complete`, a.dev.token);
    assert.equal(again.status, 409);
    assert.equal(again.body.code, "APPOINTMENT_NOT_OPEN");
  });

  test("a completed appointment cannot be cancelled or rescheduled by the patient", async () => {
    const slot = await api("POST", `/api/v1/doctors/${a.dev.uid}/slots`, a.dev.token, { startsAt: inHours(40), endsAt: inHours(40.5), consultationType: "online" });
    assert.equal(slot.status, 201);
    spareSlot = slot.body.slotId;

    const cancel = await api("POST", `/api/v1/appointments/${appt.complete}/cancel`, a.alice.token);
    assert.equal(cancel.status, 409);
    assert.equal(cancel.body.code, "APPOINTMENT_NOT_CANCELLABLE");
    const move = await api("POST", `/api/v1/appointments/${appt.complete}/reschedule`, a.alice.token, { newSlotId: spareSlot });
    assert.equal(move.status, 409);
    assert.equal(move.body.code, "APPOINTMENT_NOT_RESCHEDULABLE");
    assert.equal((await mine(a.alice, appt.complete)).status, "completed");
    assert.equal((await slotDoc(spareSlot)).status, "open", "the time it was aimed at is untouched");
  });

  test("the doctor cannot cancel an appointment that is already completed", async () => {
    const r = await api("POST", `/api/v1/appointments/${appt.complete}/doctor-cancel`, a.dev.token, { reason: "Changed my mind" });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "APPOINTMENT_NOT_OPEN");
    assert.equal((await mine(a.alice, appt.complete)).status, "completed");
  });
});

describe("the doctor cancels", () => {
  const cancel = (token: string | undefined, body?: unknown) => api("POST", `/api/v1/appointments/${appt.cancel}/doctor-cancel`, token, body);

  test("a reason is required, and only the appointment's doctor can cancel", async () => {
    assert.equal((await cancel(a.dev.token, {})).status, 400);
    assert.equal((await cancel(a.dev.token, { reason: "x" })).status, 400);
    assert.equal((await cancel(a.dev.token, { reason: "Emergency", status: "completed" })).status, 400);
    assert.equal((await cancel(a.other.token, { reason: "Not mine to cancel" })).status, 404);
    assert.equal((await cancel(a.alice.token, { reason: "I am the patient" })).status, 403);
    assert.equal((await mine(a.alice, appt.cancel)).status, "confirmed");
  });

  test("a cancellation aimed at a time the appointment no longer has is refused", async () => {
    // As if the patient rescheduled while the doctor still had the old time on screen.
    const r = await cancel(a.dev.token, { reason: "Not available then", startsAt: inHours(99) });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "APPOINTMENT_CHANGED");
    assert.equal((await mine(a.alice, appt.cancel)).status, "confirmed");
    assert.equal((await cancel(a.dev.token, { reason: "Not available then", startsAt: "tomorrow" })).status, 400);
  });

  test("the patient sees the cancellation and its reason, and the time is not offered again", async () => {
    const before = (await api("GET", `/api/v1/doctors/${a.dev.uid}/slots`)).body.slots.length;
    const { slotId, startsAt } = await appointmentDoc(appt.cancel);
    assert.equal((await slotDoc(slotId)).status, "booked");
    assert.equal((await cancel(a.dev.token, { reason: "Called away to an emergency", startsAt })).status, 200);
    const slot = await slotDoc(slotId);
    assert.equal(slot.status, "withdrawn", "the doctor's time is withdrawn, not left booked and not reopened");
    assert.equal(slot.appointmentId, undefined);
    assert.ok(!(await api("GET", "/api/v1/provider/slots", a.dev.token)).body.slots.some((s: any) => s.id === slotId), "and is gone from the doctor's own list");
    const seen = await mine(a.alice, appt.cancel);
    assert.equal(seen.status, "cancelled");
    assert.equal(seen.cancelledBy, "doctor");
    assert.equal(seen.cancelReason, "Called away to an emergency");
    assert.equal((await api("GET", `/api/v1/doctors/${a.dev.uid}/slots`)).body.slots.length, before, "no open time appeared for patients");

    const { firestore } = await firebaseAdmin();
    const outbox = await firestore.collection("notificationOutbox").where("appointmentId", "==", appt.cancel).get();
    assert.ok(outbox.docs.some((d) => d.get("type") === "appointment_cancelled_by_doctor" && d.get("recipientUid") === a.alice.uid));
  });

  test("a cancelled appointment cannot be cancelled, completed or prescribed for", async () => {
    assert.equal((await cancel(a.dev.token, { reason: "Again" })).status, 409);
    await startNow(appt.cancel);
    assert.equal((await api("POST", `/api/v1/appointments/${appt.cancel}/complete`, a.dev.token)).status, 409);
    const r = await api("POST", `/api/v1/appointments/${appt.cancel}/prescription`, a.dev.token, rx);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "APPOINTMENT_CANCELLED");
  });
});

describe("writing a prescription", () => {
  const write = (token: string | undefined, body: unknown, id = appt.prescribe) => api("POST", `/api/v1/appointments/${id}/prescription`, token, body);

  test("not before the appointment has started", async () => {
    const r = await write(a.dev.token, rx);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "APPOINTMENT_NOT_STARTED");
  });

  test("the request is checked: diagnosis, medicines with name and dosage, nothing else", async () => {
    await startNow(appt.prescribe);
    assert.equal((await write(a.dev.token, { medicines: [] })).status, 400);
    assert.equal((await write(a.dev.token, { ...rx, medicines: [{ name: "Paracetamol" }] })).status, 400);
    assert.equal((await write(a.dev.token, { ...rx, medicines: "paracetamol" })).status, 400);
    assert.equal((await write(a.dev.token, { ...rx, doctorName: "Dr. Someone Else" })).status, 400, "the signature cannot be supplied");
    assert.equal((await write(a.dev.token, { ...rx, patientUid: a.bob.uid })).status, 400, "the patient cannot be supplied");
    assert.equal((await write(a.dev.token, { ...rx, medicines: Array.from({ length: 21 }, () => rx.medicines[0]) })).status, 400);
  });

  test("only the appointment's doctor can prescribe", async () => {
    assert.equal((await write(undefined, rx)).status, 401);
    assert.equal((await write(a.alice.token, rx)).status, 403);
    assert.equal((await write(a.admin.token, rx)).status, 403);
    assert.equal((await write(a.other.token, rx)).status, 404, "a prescription in another doctor's name would be forgery");
    assert.equal((await api("GET", `/api/v1/appointments/${appt.prescribe}/prescription`, a.alice.token)).status, 404, "nothing was written by the refused attempts");
  });

  test("it is written once, signed with the booked doctor's name, and completes the appointment", async () => {
    assert.equal((await write(a.dev.token, rx)).status, 201);
    const seen = await mine(a.alice, appt.prescribe);
    assert.equal(seen.status, "completed");
    assert.equal(seen.hasPrescription, true);

    const got = await api("GET", `/api/v1/appointments/${appt.prescribe}/prescription`, a.alice.token);
    assert.equal(got.status, 200);
    assert.equal(got.body.prescription.doctorName, application.fullName);
    assert.equal(got.body.prescription.diagnosis, rx.diagnosis);
    assert.deepEqual(got.body.prescription.medicines, rx.medicines);
    assert.equal(got.body.prescription.patientUid, undefined);

    const again = await write(a.dev.token, { ...rx, diagnosis: "Something else" });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, "PRESCRIPTION_EXISTS");
    assert.equal((await api("GET", `/api/v1/appointments/${appt.prescribe}/prescription`, a.alice.token)).body.prescription.diagnosis, rx.diagnosis, "the first one stands");
  });

  test("a prescription can follow an appointment already marked completed", async () => {
    assert.equal((await write(a.dev.token, { ...rx, diagnosis: "Seasonal allergy" }, appt.complete)).status, 201);
  });

  test("only the patient and the doctor on it can read it", async () => {
    const route = `/api/v1/appointments/${appt.prescribe}/prescription`;
    assert.equal((await api("GET", route, a.dev.token)).status, 200);
    assert.equal((await api("GET", route, a.bob.token)).status, 404);
    assert.equal((await api("GET", route, a.other.token)).status, 404);
    assert.equal((await api("GET", route, a.admin.token)).status, 403);
    assert.equal((await api("GET", route)).status, 401);
  });

  test("a patient's list holds their own prescriptions only", async () => {
    const alice = await api("GET", "/api/v1/prescriptions/mine", a.alice.token);
    assert.equal(alice.status, 200);
    assert.deepEqual(alice.body.prescriptions.map((p: any) => p.diagnosis).sort(), ["Seasonal allergy", "Viral fever"]);
    assert.deepEqual((await api("GET", "/api/v1/prescriptions/mine", a.bob.token)).body.prescriptions, []);
    assert.equal((await api("GET", "/api/v1/prescriptions/mine", a.dev.token)).status, 403);
  });

  test("a patient without consent cannot read prescriptions", async () => {
    const r = await api("GET", "/api/v1/prescriptions/mine", a.nico.token);
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "CONSENT_REQUIRED");
  });

  test("the audit trail records the act, not the diagnosis or medicines", async () => {
    const { firestore } = await firebaseAdmin();
    const audit = await firestore.collection("auditLogs").where("actorUid", "==", a.dev.uid).get();
    const actions = audit.docs.map((d) => d.get("action"));
    assert.ok(actions.includes("prescription.issued"));
    assert.ok(actions.includes("appointment.completed"));
    assert.ok(actions.includes("appointment.cancelled_by_doctor"));
    const text = JSON.stringify(audit.docs.map((d) => d.data()));
    assert.ok(!text.includes("Viral fever") && !text.includes("Paracetamol") && !text.includes("Called away"), "no clinical text in audit events");
  });

  test("the doctor's booking list shows which appointments have a prescription", async () => {
    const list = (await api("GET", "/api/v1/appointments/doctor", a.dev.token)).body.appointments;
    const by = Object.fromEntries(list.map((x: any) => [x.id, x]));
    assert.equal(by[appt.prescribe].hasPrescription, true);
    assert.equal(by[appt.bob].hasPrescription, false);
    assert.equal(by[appt.cancel].cancelledBy, "doctor");
  });
});

describe("reading a patient's records", () => {
  test("records do not open at booking: only from a day before the appointment", async () => {
    const early = await api("GET", `/api/v1/appointments/${appt.bob}/records`, a.dev.token);
    assert.equal(early.status, 409);
    assert.equal(early.body.code, "RECORDS_NOT_YET_AVAILABLE");
    assert.equal(early.body.records, undefined);
    await setTimes(appt.bob, 25, 25.5);
    assert.equal((await api("GET", `/api/v1/appointments/${appt.bob}/records`, a.dev.token)).status, 409, "still more than a day away");
    await setTimes(appt.bob, 2, 2.5);
  });

  test("the doctor sees the records of the patient on their appointment, and only that patient's", async () => {
    const r = await api("GET", `/api/v1/appointments/${appt.bob}/records`, a.dev.token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.records.map((x: any) => x.title), ["BOB lab report"]);
    const alice = await api("GET", `/api/v1/appointments/${appt.prescribe}/records`, a.dev.token);
    assert.deepEqual(alice.body.records.map((x: any) => x.title), ["ALICE lab report"]);
    assert.equal(alice.body.records[0].patientId, undefined);
  });

  test("another doctor, a patient and an admin cannot use the route", async () => {
    const route = `/api/v1/appointments/${appt.bob}/records`;
    assert.equal((await api("GET", route, a.other.token)).status, 404);
    assert.equal((await api("GET", route, a.bob.token)).status, 403);
    assert.equal((await api("GET", route, a.admin.token)).status, 403);
    assert.equal((await api("GET", route)).status, 401);
  });

  test("access ends two weeks after the appointment", async () => {
    const route = `/api/v1/appointments/${appt.complete}/records`;
    assert.equal((await api("GET", route, a.dev.token)).status, 200, "a recently completed appointment still gives access");
    await setTimes(appt.complete, -13 * 24 - 1, -13 * 24);
    assert.equal((await api("GET", route, a.dev.token)).status, 200, "13 days on");
    await setTimes(appt.complete, -15 * 24 - 1, -15 * 24);
    const late = await api("GET", route, a.dev.token);
    assert.equal(late.status, 409);
    assert.equal(late.body.code, "RECORDS_ACCESS_ENDED");
    assert.equal(late.body.records, undefined);
  });

  test("when the patient withdraws consent, the doctor's access to their records ends at once", async () => {
    const route = `/api/v1/appointments/${appt.prescribe}/records`;
    assert.equal((await api("POST", "/api/v1/me/consents/withdraw", a.alice.token)).status, 201);
    const r = await api("GET", route, a.dev.token);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "PATIENT_CONSENT_REQUIRED");
    assert.equal(r.body.records, undefined);
    const grant = await api("POST", "/api/v1/me/consents", a.alice.token, { termsAccepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, marketingOptIn: false });
    assert.equal(grant.status, 201);
    assert.equal((await api("GET", route, a.dev.token)).status, 200, "and returns when consent is given again");
  });

  test("a cancelled booking gives no access to records", async () => {
    const r = await api("GET", `/api/v1/appointments/${appt.cancel}/records`, a.dev.token);
    assert.equal(r.status, 409);
    assert.equal(r.body.records, undefined);
  });

  test("when the patient cancels, the doctor's access to their records ends", async () => {
    assert.equal((await api("POST", `/api/v1/appointments/${appt.bob}/cancel`, a.bob.token)).status, 200);
    assert.equal((await api("GET", `/api/v1/appointments/${appt.bob}/records`, a.dev.token)).status, 409);
  });

  test("refused reads are not recorded as views", async () => {
    const { firestore } = await firebaseAdmin();
    const count = async () => (await firestore.collection("auditLogs").where("actorUid", "==", a.dev.uid).get()).docs.filter((d) => d.get("action") === "patient.records.viewed").length;
    const before = await count();
    assert.equal((await api("GET", `/api/v1/appointments/${appt.cancel}/records`, a.dev.token)).status, 409);
    assert.equal(await count(), before);
  });

  test("each read of a patient's records is audited", async () => {
    const { firestore } = await firebaseAdmin();
    const audit = await firestore.collection("auditLogs").where("actorUid", "==", a.dev.uid).get();
    const views = audit.docs.filter((d) => d.get("action") === "patient.records.viewed").map((d) => d.get("resourceId"));
    assert.ok(views.includes(a.bob.uid));
    assert.ok(views.includes(a.alice.uid));
  });
});

describe("once an appointment has started it is the doctor's to close", () => {
  test("the patient can no longer cancel or move it", async () => {
    await startNow(appt.late);
    const cancel = await api("POST", `/api/v1/appointments/${appt.late}/cancel`, a.alice.token);
    assert.equal(cancel.status, 409);
    assert.equal(cancel.body.code, "APPOINTMENT_STARTED");
    const move = await api("POST", `/api/v1/appointments/${appt.late}/reschedule`, a.alice.token, { newSlotId: spareSlot });
    assert.equal(move.status, 409);
    assert.equal(move.body.code, "APPOINTMENT_STARTED");
    assert.equal((await mine(a.alice, appt.late)).status, "confirmed");
    assert.equal((await slotDoc(spareSlot)).status, "open");
  });

  test("so the doctor can still complete it", async () => {
    assert.equal((await api("POST", `/api/v1/appointments/${appt.late}/complete`, a.dev.token)).status, 200);
  });

  test("an appointment with a prescription cannot be cancelled by the doctor", async () => {
    const r = await api("POST", `/api/v1/appointments/${appt.prescribe}/doctor-cancel`, a.dev.token, { reason: "Changed my mind" });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "APPOINTMENT_NOT_OPEN");
    assert.equal((await mine(a.alice, appt.prescribe)).status, "completed");
    assert.equal((await api("GET", `/api/v1/appointments/${appt.prescribe}/prescription`, a.alice.token)).status, 200);
  });
});

describe("a doctor who is no longer verified", () => {
  const refusedEverywhere = async (why: string) => {
    for (const [method, route, body] of [
      ["POST", `/api/v1/appointments/${appt.spare}/complete`, undefined],
      ["POST", `/api/v1/appointments/${appt.late}/prescription`, rx],
      ["GET", `/api/v1/appointments/${appt.prescribe}/records`, undefined],
    ] as const) {
      const r = await api(method, route, a.dev.token, body);
      assert.equal(r.status, 403, `${why}: ${method} ${route}`);
      assert.equal(r.body.code, "DOCTOR_NOT_VERIFIED");
      assert.equal(r.body.records, undefined);
    }
  };

  test("while verified, the doctor can read records on a completed appointment", async () => {
    assert.equal((await api("GET", `/api/v1/appointments/${appt.prescribe}/records`, a.dev.token)).status, 200);
  });

  test("after a refusal they cannot complete, prescribe or read records, though they keep the doctor role", async () => {
    const reject = await api("PATCH", `/api/v1/doctors/${a.dev.uid}/verification`, a.admin.token, { verificationStatus: "rejected", listingStatus: "hidden", reviewNote: "Registration could not be confirmed" });
    assert.equal(reject.status, 200);
    assert.equal((await api("GET", "/api/v1/provider/me", a.dev.token)).status, 200, "still a doctor account");
    await refusedEverywhere("rejected");
    assert.equal((await api("GET", `/api/v1/appointments/${appt.late}/prescription`, a.alice.token)).status, 404, "no prescription was written");
  });

  test("nor while a new application is pending", async () => {
    assert.equal((await api("POST", "/api/v1/doctors/applications", a.dev.token, application)).status, 202);
    await refusedEverywhere("pending");
  });

  test("they can still cancel, which releases the patient", async () => {
    const { startsAt } = await appointmentDoc(appt.spare);
    const r = await api("POST", `/api/v1/appointments/${appt.spare}/doctor-cancel`, a.dev.token, { reason: "No longer practising on City Healer", startsAt });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await mine(a.alice, appt.spare)).status, "cancelled");
  });

  test("a doctor account with no profile at all is refused too", async () => {
    // "other" has the doctor role but never applied; give it an appointment as if one existed.
    const { firestore } = await firebaseAdmin();
    const ref = firestore.collection("appointments").doc();
    await ref.set({ patientUid: a.bob.uid, doctorId: a.other.uid, doctorName: "Dr Other", specialty: "General Physician", slotId: "none", consultationType: "online", startsAt: inHours(-1), endsAt: inHours(-0.5), status: "confirmed" });
    for (const [method, route, body] of [["POST", `/api/v1/appointments/${ref.id}/complete`, undefined], ["POST", `/api/v1/appointments/${ref.id}/prescription`, rx], ["GET", `/api/v1/appointments/${ref.id}/records`, undefined]] as const) {
      assert.equal((await api(method, route, a.other.token, body)).status, 403, `${method} ${route}`);
    }
    await ref.delete();
  });
});
