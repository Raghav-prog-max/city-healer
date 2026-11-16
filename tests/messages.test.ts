/**
 * Messages about a Firestore booking (server/firebase/messages.ts), against the Firebase
 * emulators: who can read and post, the window around the visit, cancelled bookings, the
 * doctor's verification and the patient's consent, read state, ordering by seq, the 200-message
 * cap, the fixed safety notices for red-flag patient messages, rate limits, and what reaches the
 * audit log (ids only).
 *
 *   npm run test:server
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createActor, requireEmulators, firebaseAdmin, type Actor } from "./helpers/firebaseAccounts";

const PORT = Number(process.env.TEST_PORT) || 3806;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.messages.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);
// Higher than production so the suite's own polling does not trip them; the limiter tests
// below go past these on purpose.
const POST_LIMIT = 30;
const POLL_LIMIT = 60;
let server: ChildProcessWithoutNullStreams;
const a: Record<string, Actor> = {};
const appt: Record<string, string> = {};
/** Every message text posted in this suite, to check none reaches the audit log. */
const posted: string[] = [];

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

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const application = {
  fullName: "Dr. Mira Messages", specialty: "General Physician", qualifications: ["MBBS"],
  registrationNumber: "TEST-REG-0301", city: "Delhi", locality: "Saket", consultationTypes: ["online"],
};

const fs = async () => (await firebaseAdmin()).firestore;
async function setTimes(id: string, startHours: number, endHours: number) {
  await (await fs()).collection("appointments").doc(id).update({ startsAt: inHours(startHours), endsAt: inHours(endHours) });
}
const appointmentDoc = async (id: string) => (await (await fs()).collection("appointments").doc(id).get()).data()!;
const storedMessages = async (id: string) =>
  (await (await fs()).collection("appointments").doc(id).collection("messages").orderBy("seq").get()).docs.map((d) => d.data());
const auditFor = async (id: string, action?: string) =>
  (await (await fs()).collection("auditLogs").where("resourceId", "==", id).get()).docs.filter((d) => !action || d.get("action") === action);

const msgs = (id: string, after?: number) => `/api/v1/appointments/${id}/messages${after === undefined ? "" : `?after=${after}`}`;
const get = (id: string, token?: string, after?: number) => api("GET", msgs(id, after), token);
const post = (id: string, token: string | undefined, text: unknown) => {
  if (typeof text === "string") posted.push(text.trim());
  return api("POST", msgs(id), token, { text });
};
const read = (id: string, token?: string, body?: unknown) => api("POST", `/api/v1/appointments/${id}/messages/read`, token, body);
const doctorRow = async (id: string, who = a.dev) => (await api("GET", "/api/v1/appointments/doctor", who.token)).body.appointments.find((x: any) => x.id === id);
const mineRow = async (id: string, who: Actor) => (await api("GET", "/api/v1/appointments/mine", who.token)).body.appointments.find((x: any) => x.id === id);

/** An appointment written straight to Firestore, for doctors who cannot take bookings. */
async function directAppointment(doctorUid: string, patientUid: string) {
  const ref = (await fs()).collection("appointments").doc();
  await ref.set({ patientUid, doctorId: doctorUid, doctorName: "Dr Direct", specialty: "General Physician", slotId: "none", consultationType: "online", reason: "", startsAt: inHours(2), endsAt: inHours(2.5), status: "confirmed" });
  return ref.id;
}

before(async () => {
  requireEmulators();
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true });
  const firestore = await fs();
  // Appointments with their messages subcollections.
  for (const col of ["doctors", "doctorSlots", "appointments", "prescriptions", "notificationOutbox", "auditLogs"]) {
    await firestore.recursiveDelete(firestore.collection(col));
  }
  server = spawn("npx", ["tsx", "server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env, PORT: String(PORT), DB_PATH: TEST_DB, DEMO_MODE: "false", NODE_ENV: "development", API_ONLY: "true", DISABLE_HMR: "true",
      MESSAGES_POST_LIMIT: String(POST_LIMIT), MESSAGES_POLL_LIMIT: String(POLL_LIMIT),
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
  a.admin = await createActor("admin@msg.invalid", "Admin", "ADMIN");
  a.hospital = await createActor("hospital@msg.invalid", "Hospital Desk", "HOSPITAL", { hospitalId: "h-msg" });
  a.dev = await createActor("dev@msg.invalid", "Dr Dev", "DOCTOR");
  a.other = await createActor("other@msg.invalid", "Dr Other", "DOCTOR");
  a.pia = await createActor("pia@msg.invalid", "Dr Pia Pending", "DOCTOR");
  a.rex = await createActor("rex@msg.invalid", "Dr Rex Refused", "DOCTOR");
  a.alice = await createActor("alice@msg.invalid", "Alice Patient", "PATIENT");
  a.bob = await createActor("bob@msg.invalid", "Bob Patient", "PATIENT");
  a.carl = await createActor("carl@msg.invalid", "Carl Consent", "PATIENT");
  a.rita = await createActor("rita@msg.invalid", "Rita Rate", "PATIENT");
  a.nico = await createActor("nico@msg.invalid", "Nico NoConsent", "PATIENT", {}, { consent: false });

  const verify = async (who: Actor, reg: string, name: string) => {
    assert.equal((await api("POST", "/api/v1/doctors/applications", who.token, { ...application, fullName: name, registrationNumber: reg })).status, 202);
    assert.equal((await api("PATCH", `/api/v1/doctors/${who.uid}/verification`, a.admin.token, { verificationStatus: "verified", listingStatus: "active" })).status, 200);
  };
  await verify(a.dev, "TEST-REG-0301", application.fullName);
  await verify(a.other, "TEST-REG-0302", "Dr. Other Messages");
  // Pia's application is pending; Rex's is refused.
  assert.equal((await api("POST", "/api/v1/doctors/applications", a.pia.token, { ...application, registrationNumber: "TEST-REG-0303" })).status, 202);
  assert.equal((await api("POST", "/api/v1/doctors/applications", a.rex.token, { ...application, registrationNumber: "TEST-REG-0304" })).status, 202);
  assert.equal((await api("PATCH", `/api/v1/doctors/${a.rex.uid}/verification`, a.admin.token, { verificationStatus: "rejected", listingStatus: "hidden" })).status, 200);

  let hour = 40;
  const book = async (who: Actor, doctor = a.dev) => {
    hour += 1;
    const slot = await api("POST", `/api/v1/doctors/${doctor.uid}/slots`, doctor.token, { startsAt: inHours(hour), endsAt: inHours(hour + 0.5), consultationType: "online" });
    assert.equal(slot.status, 201);
    const res = await api("POST", "/api/v1/appointments", who.token, { doctorId: doctor.uid, slotId: slot.body.slotId, consultationType: "online", reason: "cough" });
    assert.equal(res.status, 201);
    return res.body.appointmentId as string;
  };
  appt.main = await book(a.alice);
  appt.bob = await book(a.bob);
  appt.early = await book(a.alice);
  appt.late = await book(a.alice);
  appt.cancel = await book(a.alice);
  appt.cap = await book(a.alice);
  appt.order = await book(a.bob);
  appt.carl = await book(a.carl);
  appt.rita = await book(a.rita);
  appt.otherDoc = await book(a.bob, a.other);
  for (const id of [appt.main, appt.bob, appt.cancel, appt.cap, appt.order, appt.carl, appt.rita, appt.otherDoc]) await setTimes(id, 2, 2.5);
  appt.pia = await directAppointment(a.pia.uid, a.alice.uid);
  appt.rex = await directAppointment(a.rex.uid, a.alice.uid);
});

after(() => {
  if (server?.pid && process.platform === "win32") {
    try { spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
  }
  server?.kill();
  try { if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true }); } catch { /* windows lock */ }
});

describe("who can use a thread", () => {
  test("anonymous callers get 401, admin and hospital accounts 403, on every route", async () => {
    for (const [token, status] of [[undefined, 401], [a.admin.token, 403], [a.hospital.token, 403]] as const) {
      assert.equal((await get(appt.main, token)).status, status);
      assert.equal((await api("POST", msgs(appt.main), token, { text: "hello" })).status, status);
      assert.equal((await read(appt.main, token)).status, status);
    }
  });

  test("another patient, another verified doctor and an unknown id all get the same 404", async () => {
    const bodies: string[] = [];
    for (const [id, token] of [[appt.main, a.bob.token], [appt.main, a.other.token], ["no-such-appointment", a.alice.token], ["no-such-appointment", a.dev.token], [appt.otherDoc, a.dev.token]] as const) {
      for (const r of [await get(id, token), await api("POST", msgs(id), token, { text: "who is this" }), await read(id, token)]) {
        assert.equal(r.status, 404, `${id}`);
        bodies.push(JSON.stringify(r.body));
      }
    }
    assert.equal(new Set(bodies).size, 1, "byte-identical bodies");
    assert.equal((await storedMessages(appt.main)).length, 0);
  });

  test("a patient without consent is stopped by the consent gate", async () => {
    const r = await get(appt.main, a.nico.token);
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "CONSENT_REQUIRED");
  });

  test("the patient and the doctor on the booking can read it", async () => {
    const p = await get(appt.main, a.alice.token);
    assert.equal(p.status, 200);
    assert.deepEqual(p.body.messages, []);
    assert.equal(p.body.canPost, true);
    assert.ok(p.body.opensAt && p.body.closesAt);
    assert.equal((await get(appt.main, a.dev.token)).status, 200);
  });
});

describe("posting", () => {
  test("the body is exactly { text }: sender, authorUid, empty, blank and over-long text are refused", async () => {
    assert.equal((await api("POST", msgs(appt.main), a.alice.token, { text: "hi", sender: "doctor" })).status, 400);
    assert.equal((await api("POST", msgs(appt.main), a.alice.token, { text: "hi", authorUid: a.dev.uid })).status, 400);
    assert.equal((await api("POST", msgs(appt.main), a.alice.token, {})).status, 400);
    assert.equal((await api("POST", msgs(appt.main), a.alice.token, { text: "" })).status, 400);
    assert.equal((await api("POST", msgs(appt.main), a.alice.token, { text: "    " })).status, 400);
    assert.equal((await api("POST", msgs(appt.main), a.alice.token, { text: "x".repeat(2001) })).status, 400);
    assert.equal((await api("POST", msgs(appt.main), a.alice.token, { text: 42 })).status, 400);
    assert.equal((await storedMessages(appt.main)).length, 0, "nothing was stored");
    assert.equal((await post(appt.main, a.alice.token, "x".repeat(2000))).status, 201, "2000 characters is allowed");
  });

  test("an ordinary patient message is stored trimmed, as the patient, and nothing answers it", async () => {
    const before = (await storedMessages(appt.main)).length;
    const r = await post(appt.main, a.alice.token, "   I still have a cough at night.   ");
    assert.equal(r.status, 201);
    assert.equal(r.body.messages.length, 1);
    assert.equal(r.body.safety, undefined);
    const m = r.body.messages[0];
    assert.equal(m.text, "I still have a cough at night.");
    assert.equal(m.sender, "patient");
    assert.equal(m.kind, "message");
    assert.equal(m.authorUid, undefined, "the response never carries uids");
    const stored = await storedMessages(appt.main);
    assert.equal(stored.length, before + 1, "exactly one message: no automated reply");
    const last = stored[stored.length - 1];
    assert.equal(last.sender, "patient");
    assert.equal(last.authorUid, a.alice.uid);
    assert.equal(last.text, "I still have a cough at night.");
  });

  test("the doctor's message is stored as the doctor", async () => {
    const r = await post(appt.main, a.dev.token, "Please take the syrup after dinner.");
    assert.equal(r.status, 201);
    assert.equal(r.body.messages[0].sender, "doctor");
    const stored = await storedMessages(appt.main);
    assert.equal(stored[stored.length - 1].authorUid, a.dev.uid);
    assert.ok(stored.every((x) => x.sender !== "doctor" || x.authorUid === a.dev.uid), "no doctor message the doctor did not write");
  });

  test("the patient's list shows an unread doctor message, without the raw chat summary", async () => {
    const row = await mineRow(appt.main, a.alice);
    assert.equal(row.chatUnread, true);
    assert.equal(row.chat, undefined);
    assert.equal(row.patientUid, undefined);
    assert.equal((await read(appt.main, a.alice.token)).status, 200);
    assert.equal((await mineRow(appt.main, a.alice)).chatUnread, false);
  });
});

describe("read state", () => {
  test("a doctor's GET alone changes nothing; POST /read marks it read", async () => {
    assert.equal((await post(appt.bob, a.bob.token, "Can I take the tablet with milk?")).status, 201);
    assert.equal((await doctorRow(appt.bob)).chat.unread, true);
    const before = (await appointmentDoc(appt.bob)).chat;
    assert.equal((await get(appt.bob, a.dev.token)).status, 200);
    const afterGet = (await appointmentDoc(appt.bob)).chat;
    assert.equal(afterGet.doctorReadSeq, before.doctorReadSeq);
    assert.equal(afterGet.doctorReadAt, before.doctorReadAt);
    assert.equal((await doctorRow(appt.bob)).chat.unread, true);

    assert.equal((await read(appt.bob, a.dev.token, { seq: 5 })).status, 400, "/read takes no body");
    assert.equal((await read(appt.bob, a.dev.token)).status, 200);
    const marked = (await appointmentDoc(appt.bob)).chat;
    assert.equal(marked.doctorReadSeq, marked.lastSeq);
    assert.ok(marked.doctorReadAt);
    assert.equal((await doctorRow(appt.bob)).chat.unread, false);

    const p = await get(appt.bob, a.bob.token);
    assert.equal(p.body.chat.doctorReadAt, marked.doctorReadAt, "the patient sees when the doctor opened it");
    assert.equal(p.body.chat.doctorReadSeq, marked.lastSeq);
    assert.equal((await read(appt.bob, a.dev.token)).status, 200, "nothing unread: a no-op 200");
    assert.equal((await appointmentDoc(appt.bob)).chat.doctorReadAt, marked.doctorReadAt);
  });
});

describe("red-flag patient messages", () => {
  test("a chest-pain message gets a fixed system notice in the same post, and the booking is marked urgent", async () => {
    assert.equal((await read(appt.main, a.dev.token)).status, 200, "the doctor has just read the thread");
    const r = await post(appt.main, a.alice.token, "I have severe chest pain and I am sweating");
    assert.equal(r.status, 201);
    assert.equal(r.body.messages.length, 2);
    assert.deepEqual(r.body.safety, { level: "emergency", kind: "emergency_notice" });
    const [own, notice] = r.body.messages;
    assert.equal(own.sender, "patient");
    assert.equal(notice.sender, "system");
    assert.equal(notice.kind, "emergency_notice");
    assert.equal(notice.seq, own.seq + 1);
    assert.equal(notice.text, "City Healer automatic message, not from your doctor. What you wrote may be an emergency. Call 112 now or use Emergency SOS. Do not wait for a reply here. Your doctor has not been alerted and has not seen your message.");
    const stored = await storedMessages(appt.main);
    assert.equal(stored[stored.length - 1].sender, "system");
    assert.equal(stored[stored.length - 1].authorUid, null);
    assert.ok((await appointmentDoc(appt.main)).chat.urgentAt);
    const row = await doctorRow(appt.main);
    assert.equal(row.chat.urgent, true);
    assert.equal(row.chat.unread, true);
    assert.equal(JSON.stringify(row).includes("chest"), false, "no message text in the doctor's list");
    assert.equal((await auditFor(appt.main, "appointment.message.red_flag")).length, 1);
  });

  test("opening the thread acknowledges it; a second red flag marks it urgent again", async () => {
    assert.equal((await read(appt.main, a.dev.token)).status, 200);
    const c = (await appointmentDoc(appt.main)).chat;
    assert.ok(c.urgentAckAt);
    assert.equal((await doctorRow(appt.main)).chat.urgent, false);
    assert.equal((await get(appt.main, a.alice.token)).body.chat.urgentAcked, true);
    await new Promise((res) => setTimeout(res, 5));
    const r = await post(appt.main, a.alice.token, "The chest pain is back and spreading to my arm");
    assert.equal(r.body.messages.length, 2);
    assert.equal(r.body.safety.kind, "emergency_notice");
    assert.equal((await doctorRow(appt.main)).chat.urgent, true);
  });

  test("Hindi text gets the Hindi notice", async () => {
    const r = await post(appt.main, a.alice.token, "मुझे सीने में तेज दर्द है");
    assert.equal(r.status, 201);
    const notice = r.body.messages[1];
    assert.equal(notice.kind, "emergency_notice");
    assert.ok(notice.text.includes("112"));
    assert.ok(notice.text.includes("सूचित नहीं"));
    assert.ok(!notice.text.includes("has not been alerted"));
  });

  test("a self-harm message gets the helpline wording", async () => {
    const r = await post(appt.main, a.alice.token, "I want to kill myself");
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.safety, { level: "emergency", kind: "self_harm_notice" });
    const notice = r.body.messages[1];
    assert.equal(notice.kind, "self_harm_notice");
    assert.ok(notice.text.startsWith("City Healer automatic message, not from your doctor. "));
    assert.ok(notice.text.includes("14416"), "Tele-MANAS");
    assert.ok(notice.text.endsWith(" Your doctor has not been alerted and has not seen your message."));
  });

  test("a doctor's message with red-flag words creates no system message", async () => {
    const before = (await storedMessages(appt.main)).length;
    const r = await post(appt.main, a.dev.token, "If the chest pain returns or you cannot breathe, call 112.");
    assert.equal(r.status, 201);
    assert.equal(r.body.messages.length, 1);
    assert.equal(r.body.safety, undefined);
    assert.equal((await storedMessages(appt.main)).length, before + 1);
  });
});

describe("the window around the visit", () => {
  test("posting opens one day before the start", async () => {
    await setTimes(appt.early, 25, 25.5);
    const early = await post(appt.early, a.alice.token, "Early question");
    assert.equal(early.status, 409);
    assert.equal(early.body.code, "CHAT_NOT_OPEN_YET");
    const g = await get(appt.early, a.alice.token);
    assert.equal(g.status, 200, "the patient can still read it");
    assert.equal(g.body.canPost, false);
    assert.equal(g.body.closedCode, "CHAT_NOT_OPEN_YET");
    assert.match(g.body.closedReason, /from one day before your appointment/);
    const d = await get(appt.early, a.dev.token);
    assert.equal(d.status, 409);
    assert.equal(d.body.code, "CHAT_NOT_OPEN_YET");
    await setTimes(appt.early, 23, 23.5);
    assert.equal((await post(appt.early, a.alice.token, "Question a day ahead")).status, 201);
    assert.equal((await post(appt.early, a.dev.token, "Answer a day ahead")).status, 201);
  });

  test("it is still open 13 days after the end, and closed for both sides after 15", async () => {
    await setTimes(appt.late, -13 * 24 - 1, -13 * 24);
    assert.equal((await post(appt.late, a.alice.token, "Follow-up after 13 days")).status, 201);
    assert.equal((await get(appt.late, a.dev.token)).status, 200);
    await setTimes(appt.late, -15 * 24 - 1, -15 * 24);
    for (const token of [a.alice.token, a.dev.token]) {
      const r = await post(appt.late, token, "Too late");
      assert.equal(r.status, 409);
      assert.equal(r.body.code, "CHAT_CLOSED");
    }
    const d = await get(appt.late, a.dev.token);
    assert.equal(d.status, 409);
    assert.equal(d.body.code, "CHAT_CLOSED");
    assert.equal(d.body.messages, undefined);
    const p = await get(appt.late, a.alice.token);
    assert.equal(p.status, 200);
    assert.equal(p.body.messages.length, 1, "the patient keeps their thread");
    assert.equal(p.body.canPost, false);
    assert.equal(p.body.closedCode, "CHAT_CLOSED");
  });
});

describe("a cancelled booking", () => {
  test("the patient can read but not post; the doctor loses access at once", async () => {
    assert.equal((await post(appt.cancel, a.alice.token, "Before I cancel")).status, 201);
    assert.equal((await api("POST", `/api/v1/appointments/${appt.cancel}/cancel`, a.alice.token)).status, 200);
    const d = await get(appt.cancel, a.dev.token);
    assert.equal(d.status, 409);
    assert.equal(d.body.code, "APPOINTMENT_CANCELLED");
    assert.equal((await post(appt.cancel, a.dev.token, "Doctor after cancel")).body.code, "APPOINTMENT_CANCELLED");
    assert.equal((await read(appt.cancel, a.dev.token)).status, 409);
    const p = await get(appt.cancel, a.alice.token);
    assert.equal(p.status, 200);
    assert.equal(p.body.messages.length, 1);
    assert.equal(p.body.canPost, false);
    const pp = await post(appt.cancel, a.alice.token, "After I cancelled");
    assert.equal(pp.status, 409);
    assert.equal(pp.body.code, "APPOINTMENT_CANCELLED");
    assert.equal((await storedMessages(appt.cancel)).length, 1);
  });

  test("a post racing a cancel never lands on a cancelled booking", async () => {
    const id = appt.rita;
    const [p, c] = await Promise.all([post(id, a.rita.token, "Racing the cancel"), api("POST", `/api/v1/appointments/${id}/cancel`, a.rita.token)]);
    assert.equal(c.status, 200);
    const stored = await storedMessages(id);
    if (p.status === 201) assert.equal(stored.length, 1, "committed before the cancel");
    else { assert.equal(p.status, 409); assert.equal(stored.length, 0); }
    assert.equal((await post(id, a.rita.token, "After the race")).status, 409);
    assert.equal((await storedMessages(id)).length, stored.length);
    // Rita's later tests need an open booking again.
    await (await fs()).collection("appointments").doc(id).update({ status: "confirmed" });
  });
});

describe("the doctor's verification and the patient's consent", () => {
  test("a pending or refused doctor is refused on GET, POST and /read", async () => {
    for (const [who, id] of [[a.pia, appt.pia], [a.rex, appt.rex]] as const) {
      for (const r of [await get(id, who.token), await post(id, who.token, "Unverified hello"), await read(id, who.token)]) {
        assert.equal(r.status, 403);
        assert.equal(r.body.code, "DOCTOR_NOT_VERIFIED");
      }
    }
    assert.equal((await storedMessages(appt.pia)).length, 0);
  });

  test("when the patient withdraws consent the doctor's access ends at once, and nothing is audited", async () => {
    assert.equal((await post(appt.carl, a.carl.token, "Consent test message")).status, 201);
    assert.equal((await get(appt.carl, a.dev.token)).status, 200);
    assert.equal((await api("POST", "/api/v1/me/consents/withdraw", a.carl.token)).status, 201);
    const auditBefore = (await auditFor(appt.carl)).length;
    const g = await get(appt.carl, a.dev.token);
    assert.equal(g.status, 409);
    assert.equal(g.body.code, "PATIENT_CONSENT_REQUIRED");
    assert.equal(g.body.messages, undefined);
    const p = await post(appt.carl, a.dev.token, "Doctor after withdrawal");
    assert.equal(p.status, 409);
    assert.equal(p.body.code, "PATIENT_CONSENT_REQUIRED");
    assert.equal((await read(appt.carl, a.dev.token)).status, 409);
    assert.equal((await auditFor(appt.carl)).length, auditBefore, "refused requests write nothing");
    assert.equal((await storedMessages(appt.carl)).length, 1);
    const own = await get(appt.carl, a.carl.token);
    assert.equal(own.status, 403);
    assert.equal(own.body.error, "CONSENT_REQUIRED");
  });
});

describe("order, cursor and cap", () => {
  test("ten concurrent posts from both sides get seq 1..10 with no gaps or duplicates", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => post(appt.order, i % 2 ? a.dev.token : a.bob.token, `Concurrent message ${i}`)));
    for (const r of rs) assert.equal(r.status, 201, JSON.stringify(r.body));
    const seqs = (await storedMessages(appt.order)).map((m) => m.seq);
    assert.deepEqual(seqs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const c = (await appointmentDoc(appt.order)).chat;
    assert.equal(c.lastSeq, 10);
    assert.equal(c.count, 10);
  });

  test("?after returns only later messages, including a notice written with the patient's message", async () => {
    const r = await post(appt.order, a.bob.token, "Now I cannot breathe properly");
    assert.equal(r.body.messages.length, 2);
    const later = await get(appt.order, a.bob.token, 1);
    assert.deepEqual(later.body.messages.map((m: any) => m.seq), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const tail = await get(appt.order, a.bob.token, 10);
    assert.deepEqual(tail.body.messages.map((m: any) => [m.seq, m.sender]), [[11, "patient"], [12, "system"]]);
    assert.deepEqual((await get(appt.order, a.bob.token, 12)).body.messages, []);
    assert.equal((await get(appt.order, a.bob.token)).body.messages.length, 12);
    assert.equal((await api("GET", `${msgs(appt.order)}?after=-1`, a.bob.token)).status, 400);
    assert.equal((await api("GET", `${msgs(appt.order)}?after=abc`, a.bob.token)).status, 400);
  });

  test("a thread holds at most 200 messages", async () => {
    await (await fs()).collection("appointments").doc(appt.cap).update({ chat: { count: 199, lastSeq: 199 } });
    assert.equal((await post(appt.cap, a.alice.token, "Message two hundred")).status, 201);
    const full = await post(appt.cap, a.alice.token, "Message two hundred and one");
    assert.equal(full.status, 409);
    assert.equal(full.body.code, "THREAD_FULL");
    assert.equal((await post(appt.cap, a.dev.token, "Doctor in a full thread")).body.code, "THREAD_FULL");
    assert.equal((await storedMessages(appt.cap)).length, 1);
  });
});

describe("audit and leakage", () => {
  test("one appointment.message.sent per post", async () => {
    const before = (await auditFor(appt.bob, "appointment.message.sent")).length;
    assert.equal((await post(appt.bob, a.bob.token, "Audit me once")).status, 201);
    assert.equal((await auditFor(appt.bob, "appointment.message.sent")).length, before + 1);
  });

  test("a doctor GET that returns messages is audited; an empty poll is not", async () => {
    const viewed = async () => (await auditFor(appt.bob, "appointment.messages.viewed")).length;
    const before = await viewed();
    const full = await get(appt.bob, a.dev.token);
    assert.ok(full.body.messages.length > 0);
    assert.equal(await viewed(), before + 1);
    assert.equal((await get(appt.bob, a.dev.token, full.body.chat.lastSeq)).body.messages.length, 0);
    assert.equal(await viewed(), before + 1, "empty poll writes nothing");
    await get(appt.bob, a.bob.token);
    assert.equal(await viewed(), before + 1, "the patient reading their own thread is not a view");
  });

  test("audit documents hold only ids, never text or the emergency category", async () => {
    const all = (await (await fs()).collection("auditLogs").get()).docs.map((d) => d.data())
      .filter((d) => String(d.action).startsWith("appointment.message"));
    assert.ok(all.length > 0);
    for (const d of all) assert.deepEqual(Object.keys(d).sort(), ["action", "actorUid", "createdAt", "resourceId", "resourceType"]);
    const text = JSON.stringify(all);
    for (const t of posted) assert.ok(!text.includes(t), "no message text in audit");
    for (const word of ["chest", "self_harm", "chest_pain", "emergency_notice", "self_harm_notice", "Alice", "Dr. Mira"]) assert.ok(!text.includes(word), word);
  });

  test("no response carries authorUid or patientUid", async () => {
    for (const [id, token] of [[appt.main, a.alice.token], [appt.main, a.dev.token], [appt.order, a.bob.token]] as const) {
      const s = JSON.stringify((await get(id, token)).body);
      assert.ok(!s.includes("authorUid") && !s.includes("patientUid") && !s.includes("doctorId"));
      assert.ok(!s.includes(a.alice.uid) && !s.includes(a.bob.uid) && !s.includes(a.dev.uid));
    }
  });
});

describe("rate limits", () => {
  test("posting past the post limit is 429 with Retry-After", async () => {
    let last: Awaited<ReturnType<typeof post>> | null = null;
    for (let i = 0; i < POST_LIMIT + 5; i++) {
      last = await post(appt.rita, a.rita.token, `Rate message ${i}`);
      if (last.status === 429) break;
      assert.equal(last.status, 201, JSON.stringify(last.body));
    }
    assert.equal(last!.status, 429);
    assert.ok(Number(last!.headers.get("retry-after")) > 0);
    assert.equal(last!.body.code, "RATE_LIMITED");
  });

  test("polling past the poll limit is 429 with Retry-After", async () => {
    let last: Awaited<ReturnType<typeof get>> | null = null;
    for (let i = 0; i < POLL_LIMIT + 5; i++) {
      last = await get(appt.rita, a.rita.token, 0);
      if (last.status === 429) break;
      assert.equal(last.status, 200);
    }
    assert.equal(last!.status, 429);
    assert.ok(Number(last!.headers.get("retry-after")) > 0);
  });

  test("one account's limit does not affect another's", async () => {
    assert.equal((await get(appt.bob, a.bob.token)).status, 200);
  });
});
