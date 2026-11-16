/**
 * AUDIT SCRIPT (not production code). Security probes, Firestore-rules probes, concurrent
 * booking, and load tests against a THROWAWAY server: a copy of the local SQLite database and
 * throwaway Firebase emulators (firebase.test.json ports). Never touches a real Firebase project.
 *
 *   node scripts/dev-firebase.mjs --no-persist "npx tsx CITY_HEALER_AUDIT_REPORT/audit_scripts/backend_audit.ts"
 *
 * Writes CITY_HEALER_AUDIT_REPORT/results/backend_audit.json.
 */
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { copyFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createActor, requireEmulators, type Actor } from "../../tests/helpers/firebaseAccounts";

requireEmulators();
const PROJECT = process.env.GCLOUD_PROJECT || "demo-city-healer";
const FS = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const DB_COPY = path.join(os.tmpdir(), `city_healer.audit.${Date.now()}.db`);
copyFileSync("city_healer.db", DB_COPY);

const out: any = { generated_at: new Date().toISOString(), environment: { node: process.version, cpus: os.cpus().length, cpu_model: os.cpus()[0]?.model, total_mem_gb: Math.round(os.totalmem() / 1e9), platform: `${os.platform()} ${os.release()}` }, notes: [] };

function startServer(port: number, extraEnv: Record<string, string> = {}) {
  const t0 = performance.now();
  const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
    env: { ...process.env, PORT: String(port), DB_PATH: DB_COPY, DEMO_MODE: "false", NODE_ENV: "development", API_ONLY: "true", DISABLE_HMR: "true", AI_RATE_LIMIT: "1000000", ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs: string[] = [];
  child.stdout!.on("data", (d) => logs.push(String(d)));
  child.stderr!.on("data", (d) => logs.push(String(d)));
  return { child, t0, logs, base: `http://127.0.0.1:${port}` };
}
async function waitHealthy(base: string, t0: number) {
  for (;;) {
    try { if ((await fetch(`${base}/api/health`)).ok) return Math.round(performance.now() - t0); } catch { /* not up */ }
    if (performance.now() - t0 > 120_000) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 200));
  }
}
function procStats(pid: number) {
  try {
    const j = execFileSync("powershell", ["-NoProfile", "-Command", `Get-Process -Id ${pid} | Select-Object CPU,WorkingSet64 | ConvertTo-Json`], { encoding: "utf8" });
    const o = JSON.parse(j);
    return { cpuSeconds: Number(o.CPU), workingSetMb: Math.round(Number(o.WorkingSet64) / 1e6) };
  } catch { return null; }
}

const srv = startServer(3911);
out.server_cold_start_ms_to_healthy = await waitHealthy(srv.base, srv.t0);
const B = srv.base;
async function api(method: string, route: string, token?: string, body?: unknown, headers: Record<string, string> = {}) {
  const a = performance.now();
  const res = await fetch(`${B}${route}`, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text, headers: Object.fromEntries(res.headers.entries()), ms: performance.now() - a };
}

// ------------------------------------------------------------------ actors
const A: Record<string, Actor> = {};
A.alice = await createActor("alice@audit.invalid", "Alice Audit", "PATIENT");
A.bob = await createActor("bob@audit.invalid", "Bob Audit", "PATIENT");
A.doctor = await createActor("dr@audit.invalid", "Dr Audit", "DOCTOR", { doctorId: "doc-1" });
A.admin = await createActor("admin@audit.invalid", "Admin Audit", "ADMIN");
A.hosp = await createActor("hosp@audit.invalid", "Hosp Audit", "HOSPITAL", { hospitalId: "hosp-1" });

// ------------------------------------------------------------------ security probes
const sec: any[] = [];
const check = (name: string, ok: boolean, detail: unknown) => sec.push({ name, result: ok ? "PASS" : "FAIL", detail });

{
  const protectedRoutes: [string, string][] = [["GET", "/api/appointments"], ["GET", "/api/records"], ["GET", "/api/v1/me"], ["GET", "/api/v1/appointments/mine"], ["POST", "/api/v1/nlp/analyze"], ["POST", "/api/ai/copilot"], ["GET", "/api/queue"], ["GET", "/api/medicines/orders"], ["GET", "/api/emergency/alerts"], ["GET", "/api/ai/monitoring"]];
  const r = await Promise.all(protectedRoutes.map(async ([m, p]) => [m, p, (await api(m, p, undefined, m === "POST" ? {} : undefined)).status]));
  check("protected routes refuse calls without a token (DEMO_MODE=false)", r.every((x) => x[2] === 401), r);
  const garbage = await api("GET", "/api/v1/me", "not-a-token");
  check("garbage bearer token is refused", garbage.status === 401, garbage.status);
}
{
  const own = await api("GET", `/api/users/${A.alice.uid}`, A.alice.token);
  const other = await api("GET", `/api/users/${A.alice.uid}`, A.bob.token);
  check("IDOR: patient cannot read another patient's user record", other.status === 403 || other.status === 404, { own: own.status, other: other.status });
  const esc = await api("PUT", `/api/users/${A.bob.uid}`, A.bob.token, { role: "ADMIN" });
  const me = await api("GET", "/api/v1/me", A.bob.token);
  check("privilege escalation: patient cannot make themselves ADMIN", !(me.body?.role === "ADMIN" || me.body?.role === "admin"), { put: esc.status, roleAfter: me.body?.role });
  const verify = await api("PATCH", `/api/v1/doctors/${A.doctor.uid}/verification`, A.alice.token, { verificationStatus: "verified", listingStatus: "active" });
  check("patient cannot verify a doctor", verify.status === 403, verify.status);
  const mon = await api("GET", "/api/ai/monitoring", A.alice.token);
  check("patient cannot read AI monitoring (admin only)", mon.status === 403, mon.status);
  const fc = await api("GET", "/api/v1/ml/demand-forecast?series=appointments", A.hosp.token);
  check("hospital account cannot read platform-wide demand forecast (admin only)", fc.status === 403, fc.status);
  const beds = await api("PUT", "/api/hospitals/hosp-2/beds", A.hosp.token, { availableBeds: 0 });
  check("hospital staff cannot change another hospital's beds", beds.status === 403, beds.status);
}
{
  const bad = await api("POST", "/api/v1/nlp/analyze", A.alice.token, "{not json", {});
  check("malformed JSON does not leak a stack trace", !/at\s+\S+\s+\(|node_modules|\.ts:\d+/.test(bad.text), { status: bad.status, body: bad.text.slice(0, 160) });
  const long = await api("POST", "/api/v1/nlp/analyze", A.alice.token, { text: "a".repeat(5000) });
  check("over-long NLP input is rejected", long.status === 400, long.status);
  const big = await fetch(`${B}/api/v1/documents/extract?filename=big.txt`, { method: "POST", headers: { "Content-Type": "text/plain", Authorization: `Bearer ${A.alice.token}` }, body: "x".repeat(6 * 1024 * 1024) });
  check("upload over 5 MB is refused", big.status === 413, big.status);
  const exe = await fetch(`${B}/api/v1/documents/extract?filename=evil.exe`, { method: "POST", headers: { "Content-Type": "application/octet-stream", Authorization: `Bearer ${A.alice.token}` }, body: new Uint8Array([77, 90, 0, 0]) });
  check("executable upload is refused (unsupported_type)", (await exe.json()).status === "unsupported_type", exe.status);
  const html = await fetch(`${B}/api/v1/documents/extract?filename=x.html`, { method: "POST", headers: { "Content-Type": "text/html", Authorization: `Bearer ${A.alice.token}` }, body: "<script>alert(1)</script>" });
  check("unexpected content type is not parsed as a document", html.status === 400, html.status);
}
{
  const h = await api("GET", "/api/health", undefined, undefined, { Origin: "https://evil.example" });
  out.response_headers_sample = { route: "/api/health", headers: Object.fromEntries(Object.entries(h.headers).filter(([k]) => /^(x-|content-security|strict-transport|access-control|referrer|permissions)/i.test(k))) };
  check("no permissive CORS header for a foreign origin", !h.headers["access-control-allow-origin"], h.headers["access-control-allow-origin"] || "(none)");
  check("baseline headers present (nosniff, frame DENY, referrer policy)", h.headers["x-content-type-options"] === "nosniff" && h.headers["x-frame-options"] === "DENY" && !!h.headers["referrer-policy"], { nosniff: h.headers["x-content-type-options"], frame: h.headers["x-frame-options"], referrer: h.headers["referrer-policy"] });
  check("no CSP in development (Vite needs inline scripts and websockets)", !h.headers["content-security-policy"], h.headers["content-security-policy"] || "(none)");
}
{
  // CSP and HSTS are production-only (server/httpHardening.ts): check them on a production-mode
  // API server (API_ONLY, so no built frontend is needed).
  const sp = startServer(3913, { NODE_ENV: "production" });
  await waitHealthy("http://127.0.0.1:3913", sp.t0);
  const r = await fetch("http://127.0.0.1:3913/api/health");
  const csp = r.headers.get("content-security-policy") || "";
  out.production_headers_sample = { csp, hsts: r.headers.get("strict-transport-security") };
  check("production: Content-Security-Policy present, no unsafe-eval, frames denied", !!csp && !/unsafe-eval/.test(csp) && /frame-ancestors 'none'/.test(csp), csp.slice(0, 200) || "(none)");
  check("production: Strict-Transport-Security present", !!r.headers.get("strict-transport-security"), r.headers.get("strict-transport-security") || "(none)");
  sp.child.kill();
}
{
  // General (non-AI) rate limiting: 150 rapid calls to a write route.
  const statuses = new Set<number>();
  for (let i = 0; i < 150; i++) statuses.add((await api("POST", "/api/hospitals/hosp-1/report", A.alice.token, { reason: "wrong_details" })).status);
  check("non-AI routes have a rate limit (150 rapid report submissions)", statuses.has(429), [...statuses]);
}

// ------------------------------------------------------------------ Firestore rules (client-SDK path, REST with an ID token)
{
  const fs = async (method: string, docPath: string, token: string, body?: unknown) => {
    const res = await fetch(`${FS}/${docPath}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return res.status;
  };
  const r = {
    read_own_patientProfile: await fs("GET", `patientProfiles/${A.alice.uid}`, A.alice.token),
    read_other_patientProfile: await fs("GET", `patientProfiles/${A.bob.uid}`, A.alice.token),
    write_own_patientProfile: await fs("PATCH", `patientProfiles/${A.alice.uid}`, A.alice.token, { fields: { fullName: { stringValue: "x" } } }),
    read_auditLogs: await fs("GET", "auditLogs/any", A.admin.token),
    list_doctors: await fs("GET", "doctors", A.alice.token),
    write_doctorSlot: await fs("PATCH", "doctorSlots/forged", A.alice.token, { fields: { status: { stringValue: "open" } } }),
    read_appointments: await fs("GET", "appointments", A.alice.token),
    write_doctor_as_doctor: await fs("PATCH", `doctors/${A.doctor.uid}`, A.doctor.token, { fields: { verificationStatus: { stringValue: "verified" } } }),
  };
  out.firestore_rules_probe = r;
  check("Firestore: own profile readable, others' not", r.read_own_patientProfile === 200 && r.read_other_patientProfile === 403, r);
  check("Firestore: clients cannot write profiles, slots, doctors or read audit/appointments", [r.write_own_patientProfile, r.read_auditLogs, r.list_doctors, r.write_doctorSlot, r.read_appointments, r.write_doctor_as_doctor].every((s) => s === 403), r);
}

// ------------------------------------------------------------------ booking: concurrency and integrity
{
  const app = await api("POST", "/api/v1/doctors/applications", A.doctor.token, { fullName: "Dr Audit Provider", specialty: "General Physician", qualifications: ["MBBS"], registrationNumber: "AUDIT-0001", city: "Noida", locality: "Sector 62", consultationTypes: ["online"] });
  await api("PATCH", `/api/v1/doctors/${A.doctor.uid}/verification`, A.admin.token, { verificationStatus: "verified", listingStatus: "active" });
  const patients: Actor[] = [];
  for (let i = 0; i < 20; i++) patients.push(await createActor(`p${i}@audit.invalid`, `Patient ${i}`, "PATIENT"));
  const rounds: any[] = [];
  for (let round = 0; round < 5; round++) {
    const start = new Date(Date.now() + (48 + round) * 3600_000).toISOString(), end = new Date(Date.parse(start) + 1800_000).toISOString();
    const slot = await api("POST", `/api/v1/doctors/${A.doctor.uid}/slots`, A.doctor.token, { startsAt: start, endsAt: end, consultationType: "online" });
    const t = performance.now();
    const res = await Promise.all(patients.map((p) => api("POST", "/api/v1/appointments", p.token, { doctorId: A.doctor.uid, slotId: slot.body.slotId, consultationType: "online" })));
    const wall = performance.now() - t;
    const lat = res.map((r) => r.ms).sort((a, b) => a - b);
    rounds.push({ attempts: res.length, created_201: res.filter((r) => r.status === 201).length, conflict_409: res.filter((r) => r.status === 409).length, other: res.filter((r) => r.status !== 201 && r.status !== 409).map((r) => r.status), wall_ms: Math.round(wall), p50_ms: Math.round(lat[Math.floor(lat.length / 2)]), max_ms: Math.round(lat[lat.length - 1]) });
  }
  out.concurrent_booking = { application_status: app.status, patients: 20, rounds };
  check("20 concurrent bookings of one slot: exactly one succeeds (5 rounds)", rounds.every((r) => r.created_201 === 1 && r.conflict_409 === 19), rounds.map((r) => `${r.created_201}/${r.conflict_409}/${r.other}`));
  // Past slot / unverified doctor (legacy SQLite route): look-only doctors must refuse booking
  // The SQLite booking system was retired (PR #12): its routes must now answer a JSON 404.
  const legacy = await api("POST", "/api/appointments", A.alice.token, { doctorId: "doc-5", patientName: "Alice", date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: "10:00", type: "VIRTUAL", symptoms: "" });
  check("retired SQLite booking route answers 404 (cannot book a directory doctor)", legacy.status === 404, { status: legacy.status, code: legacy.body?.error });
  const past = await api("POST", "/api/appointments", A.alice.token, { doctorId: "doc-1", patientName: "Alice", date: "2020-01-01", time: "10:00", type: "VIRTUAL", symptoms: "" });
  check("retired SQLite booking route answers 404 for any date", past.status === 404, past.status);
}

// ------------------------------------------------------------------ load tests
async function load(name: string, make: () => Promise<Response>, levels: number[], perLevel: number) {
  const pid = srv.child.pid!;
  const results: any[] = [];
  for (const c of levels) {
    const before = procStats(pid);
    const lat: number[] = []; let errors = 0, done = 0;
    const t = performance.now();
    await Promise.all(Array.from({ length: c }, async () => {
      while (done < perLevel) {
        done++;
        const a = performance.now();
        try { const r = await make(); await r.arrayBuffer(); if (r.status >= 400) errors++; } catch { errors++; }
        lat.push(performance.now() - a);
      }
    }));
    const wall = (performance.now() - t) / 1000;
    const after = procStats(pid);
    lat.sort((a, b) => a - b);
    const p = (q: number) => Math.round(lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] * 10) / 10;
    results.push({ concurrency: c, requests: lat.length, rps: Math.round(lat.length / wall), mean_ms: Math.round((lat.reduce((s, x) => s + x, 0) / lat.length) * 10) / 10, p50_ms: p(0.5), p95_ms: p(0.95), p99_ms: lat.length >= 100 ? p(0.99) : "n/a (<100 samples)", error_rate: Math.round((errors / lat.length) * 1000) / 10,
      server_cpu_percent_of_one_core: before && after ? Math.round(((after.cpuSeconds - before.cpuSeconds) / wall) * 100) : null, server_working_set_mb: after?.workingSetMb ?? null });
  }
  return { endpoint: name, results };
}
const tokenA = A.alice.token;
const H = (body?: unknown, ct = "application/json") => ({ method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${tokenA}`, ...(body ? { "Content-Type": ct } : {}) }, ...(body ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
// First (cold) AI calls, before the warm load tests
out.ai_first_call_ms = {
  copilot: Math.round((await api("POST", "/api/v1/copilot/chat", tokenA, { message: "mujhe bukhar aur khansi hai" })).ms),
  nlp: Math.round((await api("POST", "/api/v1/nlp/analyze", tokenA, { text: "mujhe bukhar hai" })).ms),
};
const levels = [1, 5, 10, 25, 50];
out.load_tests = [
  await load("GET /api/health", () => fetch(`${B}/api/health`), levels, 400),
  await load("GET /api/hospitals (990 listings, SQLite)", () => fetch(`${B}/api/hospitals?lat=28.61&lng=77.2`), levels, 200),
  await load("GET /api/v1/doctors (Firestore)", () => fetch(`${B}/api/v1/doctors`), levels, 200),
  await load("POST /api/v1/nlp/analyze", () => fetch(`${B}/api/v1/nlp/analyze`, H({ text: "mujhe kal se bukhar aur sir dard hai" })), levels, 400),
  await load("POST /api/v1/copilot/chat", () => fetch(`${B}/api/v1/copilot/chat`, H({ message: "I have fever and cough since two days" })), levels, 300),
  await load("POST /api/symptoms/check (triage)", () => fetch(`${B}/api/symptoms/check`, H({ symptoms: "fever cough and body ache for 3 days" })), levels, 300),
  await load("POST /api/v1/documents/extract (1 KB txt)", () => fetch(`${B}/api/v1/documents/extract?filename=r.txt`, H("Haemoglobin: 11.2 g/dL\nWBC: 7.8\nPlatelets: 150\nMCV: 72\n".repeat(10), "text/plain")), levels, 300),
  await load("GET /api/v1/appointments/mine (Firestore query)", () => fetch(`${B}/api/v1/appointments/mine`, H()), levels, 200),
];
out.hospitals_payload_kb = Math.round((await (await fetch(`${B}/api/hospitals`)).arrayBuffer()).byteLength / 1024);

// ------------------------------------------------------------------ AI rate limit (separate server with a low quota)
{
  const s2 = startServer(3912, { AI_RATE_LIMIT: "5" });
  await waitHealthy(s2.base, s2.t0);
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await fetch(`${s2.base}/api/v1/nlp/analyze`, H({ text: "fever" }))).status);
  check("AI rate limit enforced per user (quota 5)", codes.slice(0, 5).every((c) => c === 200) && codes[5] === 429, codes);
  s2.child.kill();
}

out.security_checks = sec;
out.server_log_lines_containing_message_text = srv.logs.join("").split(/\n/).filter((l) => /bukhar|fever and cough|Haemoglobin/i.test(l)).length;
srv.child.kill();
try { rmSync(DB_COPY, { force: true }); } catch { /* locked */ }
writeFileSync("CITY_HEALER_AUDIT_REPORT/results/backend_audit.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ cold: out.server_cold_start_ms_to_healthy, sec: sec.map((s) => `${s.result} ${s.name}`), booking: out.concurrent_booking.rounds, ai_first: out.ai_first_call_ms, payload: out.hospitals_payload_kb, logs: out.server_log_lines_containing_message_text }, null, 1));
for (const l of out.load_tests) for (const r of l.results) console.log(l.endpoint.padEnd(48), JSON.stringify(r));
process.exit(0);
