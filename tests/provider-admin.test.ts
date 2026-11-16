/**
 * Provider onboarding without the command line (server/firebase/providers.ts; P1 item 11),
 * against the Firebase emulators: an admin gives an account the doctor role, the doctor applies
 * and sees the review status, the admin reviews applications, and a verified doctor manages
 * their own times. Nobody can give themselves a role, and a doctor reaches only their own data.
 *
 *   npm run test:server
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createActor, signIn, requireEmulators, firebaseAdmin, type Actor } from "./helpers/firebaseAccounts";
import { normalisePhone } from "../server/firebase/providers";

const PORT = Number(process.env.TEST_PORT) || 3804;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.providers.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);
let server: ChildProcessWithoutNullStreams;
const a: Record<string, Actor> = {};
let phoneUid = "";

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
  fullName: "Dr. Pia Provider", specialty: "General Physician", qualifications: ["MBBS", "MD"],
  registrationNumber: "DMC-TEST-0042", city: "Noida", locality: "Sector 18", consultationTypes: ["online"],
};
const PHONE = "+919876500042";

before(async () => {
  requireEmulators();
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true });
  const { firestore, adminAuth } = await firebaseAdmin();
  for (const col of ["doctors", "doctorSlots", "appointments", "notificationOutbox"]) {
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
  a.admin = await createActor("admin@providers.invalid", "Admin", "ADMIN");
  a.pia = await createActor("pia@providers.invalid", "Pia Provider", "PATIENT"); // signs up as anyone does
  a.sam = await createActor("sam@providers.invalid", "Sam Patient", "PATIENT");
  a.dana = await createActor("dana@providers.invalid", "Dr Dana", "DOCTOR");
  a.desk = await createActor("desk@providers.invalid", "Hospital Desk", "HOSPITAL", { hospitalId: "hosp-1" });
  // An account that signs in by phone, as most patients do.
  try { await adminAuth.deleteUser((await adminAuth.getUserByPhoneNumber(PHONE)).uid); } catch { /* not there */ }
  phoneUid = (await adminAuth.createUser({ phoneNumber: PHONE })).uid;
});

after(() => {
  if (server?.pid && process.platform === "win32") {
    try { spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
  }
  server?.kill();
  try { if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true }); } catch { /* windows lock */ }
});

describe("an admin gives an account the doctor role", () => {
  const grant = (token: string | undefined, body: unknown) => api("POST", "/api/v1/admin/providers/accounts", token, body);

  test("only an admin can", async () => {
    assert.equal((await grant(undefined, { email: a.pia.email })).status, 401);
    assert.equal((await grant(a.pia.token, { email: a.pia.email })).status, 403, "nobody can give themselves a role");
    assert.equal((await grant(a.dana.token, { email: a.pia.email })).status, 403);
    assert.equal((await grant(a.desk.token, { email: a.pia.email })).status, 403);
  });

  test("the request names one account, by email or phone", async () => {
    assert.equal((await grant(a.admin.token, {})).status, 400);
    assert.equal((await grant(a.admin.token, { email: a.pia.email, phone: PHONE })).status, 400);
    assert.equal((await grant(a.admin.token, { email: "not-an-email" })).status, 400);
    assert.equal((await grant(a.admin.token, { phone: "12345" })).status, 400);
    assert.equal((await grant(a.admin.token, { email: a.pia.email, role: "admin" })).status, 400, "no other role can be asked for");
  });

  test("an account that does not exist is not created", async () => {
    const r = await grant(a.admin.token, { email: "nobody@providers.invalid" });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, "ACCOUNT_NOT_FOUND");
  });

  test("a hospital or admin account is left as it is", async () => {
    const r = await grant(a.admin.token, { email: a.desk.email });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "ACCOUNT_HAS_ROLE");
    assert.equal((await grant(a.admin.token, { email: a.admin.email })).status, 409);
    const { adminAuth } = await firebaseAdmin();
    assert.equal((await adminAuth.getUser(a.desk.uid)).customClaims?.role, "hospital");
    assert.equal((await adminAuth.getUser(a.desk.uid)).customClaims?.hospitalId, "hosp-1");
  });

  test("before the grant the account cannot apply or use the doctor routes", async () => {
    assert.equal((await api("POST", "/api/v1/doctors/applications", a.pia.token, application)).status, 403);
    assert.equal((await api("GET", "/api/v1/provider/me", a.pia.token)).status, 403);
  });

  test("granting changes the role, signs the account out, and is audited", async () => {
    // Firebase revokes sessions to the second: a token issued in the same second as the
    // revocation is still accepted. Let that second pass, as it would between a real sign-up
    // and an administrator's grant, so the assertion below is about revocation, not timing.
    const issuedAt = JSON.parse(Buffer.from(a.pia.token.split(".")[1], "base64url").toString()).auth_time as number;
    const wait = (issuedAt + 1) * 1000 + 100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const r = await grant(a.admin.token, { email: a.pia.email.toUpperCase() });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(r.body, { uid: a.pia.uid, contact: a.pia.email, role: "doctor", changed: true });

    assert.equal((await api("GET", "/api/v1/me", a.pia.token)).status, 401, "the old session is revoked at once");
    a.pia.token = await signIn(a.pia.email, a.pia.password);
    const me = await api("GET", "/api/v1/provider/me", a.pia.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.application, null);

    const { firestore } = await firebaseAdmin();
    const audit = await firestore.collection("auditLogs").where("resourceId", "==", a.pia.uid).get();
    assert.ok(audit.docs.some((d) => d.get("action") === "user.role.set" && d.get("actorUid") === a.admin.uid));
  });

  test("granting again changes nothing and does not sign the doctor out", async () => {
    const r = await grant(a.admin.token, { email: a.pia.email });
    assert.equal(r.status, 200);
    assert.equal(r.body.changed, false);
    assert.equal((await api("GET", "/api/v1/provider/me", a.pia.token)).status, 200);
  });

  test("an account can be named by phone number, however it is typed", async () => {
    const r = await grant(a.admin.token, { phone: "98765 00042" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.uid, phoneUid);
    assert.equal(r.body.contact, PHONE);
    assert.equal(normalisePhone("+91 98765-00042"), PHONE);
    assert.equal(normalisePhone("9876500042"), PHONE);
    assert.equal(normalisePhone("+44 20 7946 0958"), "+442079460958");
    assert.equal(normalisePhone("12345"), null);
    assert.equal(normalisePhone("1234567890"), null, "a ten-digit number that is not an Indian mobile needs its country code");
  });
});

describe("the doctor applies and follows the review", () => {
  test("a submitted application is pending and shown back to the doctor", async () => {
    assert.equal((await api("POST", "/api/v1/doctors/applications", a.pia.token, application)).status, 202);
    const me = await api("GET", "/api/v1/provider/me", a.pia.token);
    assert.equal(me.body.application.verificationStatus, "pending");
    assert.equal(me.body.application.listingStatus, "hidden");
    assert.equal(me.body.application.registrationNumber, application.registrationNumber, "a doctor sees their own registration number");
    assert.deepEqual(me.body.application.qualifications, application.qualifications);
  });

  test("the application list is for admins only", async () => {
    for (const who of ["pia", "dana", "sam", "desk"]) {
      assert.equal((await api("GET", "/api/v1/admin/providers", a[who].token)).status, 403, who);
    }
    assert.equal((await api("GET", "/api/v1/admin/providers")).status, 401);
    assert.equal((await api("GET", "/api/v1/admin/providers?status=bogus", a.admin.token)).status, 400);
  });

  test("an admin sees pending applications with what a reviewer needs", async () => {
    const list = await api("GET", "/api/v1/admin/providers", a.admin.token);
    assert.equal(list.status, 200);
    assert.equal(list.body.providers.length, 1, "pending is the default; nobody else has applied");
    const p = list.body.providers[0];
    assert.equal(p.id, a.pia.uid);
    assert.equal(p.contact, a.pia.email);
    assert.equal(p.registrationNumber, application.registrationNumber);
    assert.equal(p.verificationStatus, "pending");
    assert.equal((await api("GET", "/api/v1/admin/providers?status=verified", a.admin.token)).body.providers.length, 0);
  });

  test("a rejection reaches the doctor with its reason, and re-applying goes back to pending", async () => {
    const reject = await api("PATCH", `/api/v1/doctors/${a.pia.uid}/verification`, a.admin.token, { verificationStatus: "rejected", listingStatus: "hidden", reviewNote: "Registration number not found in the DMC register" });
    assert.equal(reject.status, 200);
    let me = await api("GET", "/api/v1/provider/me", a.pia.token);
    assert.equal(me.body.application.verificationStatus, "rejected");
    assert.equal(me.body.application.reviewNote, "Registration number not found in the DMC register");

    assert.equal((await api("POST", "/api/v1/doctors/applications", a.pia.token, { ...application, registrationNumber: "DMC-TEST-0043" })).status, 202);
    me = await api("GET", "/api/v1/provider/me", a.pia.token);
    assert.equal(me.body.application.verificationStatus, "pending");
    assert.equal(me.body.application.reviewNote, "", "an old rejection note is not shown on a new application");
  });

  test("verifying records where the registration was checked, for admins only", async () => {
    const ok = await api("PATCH", `/api/v1/doctors/${a.pia.uid}/verification`, a.admin.token, { verificationStatus: "verified", listingStatus: "active", reviewNote: "Checked with Delhi Medical Council" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.reviewNote, undefined);
    const me = await api("GET", "/api/v1/provider/me", a.pia.token);
    assert.equal(me.body.application.verificationStatus, "verified");
    assert.equal(me.body.application.reviewNote, "", "the internal verification note is not sent to the doctor");
    const verified = await api("GET", "/api/v1/admin/providers?status=verified", a.admin.token);
    assert.equal(verified.body.providers[0].reviewNote, "Checked with Delhi Medical Council");
    const publicView = (await api("GET", `/api/v1/doctors/${a.pia.uid}`)).body.doctor;
    assert.equal(publicView.reviewNote, undefined);
    assert.equal(publicView.registrationNumber, undefined);
  });

  test("an over-long review note is refused", async () => {
    const r = await api("PATCH", `/api/v1/doctors/${a.pia.uid}/verification`, a.admin.token, { verificationStatus: "verified", listingStatus: "active", reviewNote: "x".repeat(301) });
    assert.equal(r.status, 400);
  });
});

describe("a verified doctor manages their own times", () => {
  let open = "", booked = "";

  test("published times are listed for the doctor with their status", async () => {
    const first = await api("POST", `/api/v1/doctors/${a.pia.uid}/slots`, a.pia.token, { startsAt: inHours(24), endsAt: inHours(24.5), consultationType: "online" });
    const second = await api("POST", `/api/v1/doctors/${a.pia.uid}/slots`, a.pia.token, { startsAt: inHours(25), endsAt: inHours(25.5), consultationType: "online" });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    booked = first.body.slotId; open = second.body.slotId;
    assert.equal((await api("POST", "/api/v1/appointments", a.sam.token, { doctorId: a.pia.uid, slotId: booked, consultationType: "online" })).status, 201);

    const mine = await api("GET", "/api/v1/provider/slots", a.pia.token);
    assert.equal(mine.status, 200);
    assert.deepEqual(mine.body.slots.map((s: any) => [s.id, s.status]), [[booked, "booked"], [open, "open"]]);
  });

  test("the doctor routes are for doctors, and show only the doctor's own times", async () => {
    assert.equal((await api("GET", "/api/v1/provider/slots", a.sam.token)).status, 403);
    assert.equal((await api("GET", "/api/v1/provider/slots", a.admin.token)).status, 403);
    assert.equal((await api("GET", "/api/v1/provider/slots")).status, 401);
    assert.deepEqual((await api("GET", "/api/v1/provider/slots", a.dana.token)).body.slots, []);
    assert.equal((await api("GET", "/api/v1/provider/me", a.dana.token)).body.application, null);
  });

  test("a booked time cannot be withdrawn", async () => {
    const r = await api("DELETE", `/api/v1/provider/slots/${booked}`, a.pia.token);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "SLOT_BOOKED");
    const appts = await api("GET", "/api/v1/appointments/mine", a.sam.token);
    assert.equal(appts.body.appointments[0].status, "confirmed", "the patient's appointment is untouched");
  });

  test("another doctor cannot withdraw it, and cannot tell that it exists", async () => {
    assert.equal((await api("DELETE", `/api/v1/provider/slots/${open}`, a.dana.token)).status, 404);
    assert.equal((await api("DELETE", "/api/v1/provider/slots/no-such-slot", a.dana.token)).status, 404);
    assert.equal((await api("DELETE", `/api/v1/provider/slots/${open}`, a.sam.token)).status, 403);
  });

  test("withdrawing an open time removes it from booking, once", async () => {
    assert.equal((await api("DELETE", `/api/v1/provider/slots/${open}`, a.pia.token)).status, 200);
    assert.equal((await api("DELETE", `/api/v1/provider/slots/${open}`, a.pia.token)).status, 404);
    assert.deepEqual((await api("GET", `/api/v1/doctors/${a.pia.uid}/slots`)).body.slots, [], "no open times are offered to patients");
    assert.deepEqual((await api("GET", "/api/v1/provider/slots", a.pia.token)).body.slots.map((s: any) => s.id), [booked]);
    const book = await api("POST", "/api/v1/appointments", a.sam.token, { doctorId: a.pia.uid, slotId: open, consultationType: "online" });
    assert.equal(book.status, 409, "a withdrawn time cannot be booked");
  });

  test("a withdrawn time can be published again", async () => {
    const again = await api("POST", `/api/v1/doctors/${a.pia.uid}/slots`, a.pia.token, { startsAt: inHours(25), endsAt: inHours(25.5), consultationType: "online" });
    assert.equal(again.status, 201);
  });

  test("the doctor sees who booked", async () => {
    const r = await api("GET", "/api/v1/appointments/doctor", a.pia.token);
    assert.equal(r.status, 200);
    assert.equal(r.body.appointments.length, 1);
    assert.equal(r.body.appointments[0].patientName, "Sam Patient");
  });
});
