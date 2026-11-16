/**
 * HTTP hardening (server/httpHardening.ts; audit S-05, S-06, BUG-015) against the Firebase
 * emulators: security headers on every response, a JSON 400 for malformed JSON, and the general
 * write limit answering 429 with Retry-After. The records limit is set to 3 for this server
 * through RECORDS_RATE_LIMIT so the test reaches it in a few requests.
 *
 *   npm run test:server
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createActor, requireEmulators, type Actor } from "./helpers/firebaseAccounts";
import { securityHeaders, PRODUCTION_CSP } from "../server/httpHardening";

const PORT = (Number(process.env.TEST_PORT) || 3806) + 7;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "city_healer.security-headers.test.db";
const TEST_DB_PATH = path.resolve(process.cwd(), TEST_DB);
const RECORDS_LIMIT = 3;
let server: ChildProcessWithoutNullStreams;
const a: Record<string, Actor> = {};

async function api(method: string, route: string, token?: string, body?: unknown, raw?: string) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(raw !== undefined ? { body: raw } : body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let payload: any = null;
  try { payload = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, body: payload, text };
}

before(async () => {
  requireEmulators();
  if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true });
  server = spawn("npx", ["tsx", "server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env, PORT: String(PORT), DB_PATH: TEST_DB, DEMO_MODE: "false", NODE_ENV: "development",
      API_ONLY: "true", DISABLE_HMR: "true", RECORDS_RATE_LIMIT: String(RECORDS_LIMIT),
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
  a.alice = await createActor("alice@headers.invalid", "Alice Patient", "PATIENT");
  a.bob = await createActor("bob@headers.invalid", "Bob Patient", "PATIENT");
});

after(() => {
  if (server?.pid && process.platform === "win32") {
    try { spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
  }
  server?.kill();
  try { if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH, { force: true }); } catch { /* windows lock */ }
});

function assertBaseline(h: Headers) {
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("x-frame-options"), "DENY");
  assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(h.get("permissions-policy"), "camera=(), microphone=(self), geolocation=(self)");
  assert.equal(h.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(h.get("x-powered-by"), null);
}

describe("security headers", () => {
  test("are on a normal response, an unknown API route and an auth refusal", async () => {
    for (const r of [await api("GET", "/api/health"), await api("GET", "/api/no-such-route"), await api("GET", "/api/records")]) {
      assertBaseline(r.headers);
    }
  });

  test("development sets no CSP or HSTS (Vite HMR needs inline scripts and websockets)", async () => {
    const r = await api("GET", "/api/health");
    assert.equal(r.headers.get("content-security-policy"), null);
    assert.equal(r.headers.get("strict-transport-security"), null);
  });

  test("production adds HSTS and a CSP limited to self, Firebase Auth, Google Fonts and the image host", () => {
    const set: Record<string, string> = {};
    let nextCalled = false;
    securityHeaders({ production: true })({} as any, { setHeader: (k: string, v: string) => { set[k.toLowerCase()] = v; } } as any, () => { nextCalled = true; });
    assert.ok(nextCalled);
    assert.match(set["strict-transport-security"], /max-age=\d+/);
    assert.equal(set["content-security-policy"], PRODUCTION_CSP);
    for (const host of ["identitytoolkit.googleapis.com", "securetoken.googleapis.com", "firestore.googleapis.com", "fonts.googleapis.com", "fonts.gstatic.com", "images.unsplash.com"]) {
      assert.ok(PRODUCTION_CSP.includes(`https://${host}`), host);
    }
    assert.match(PRODUCTION_CSP, /default-src 'self'/);
    assert.doesNotMatch(PRODUCTION_CSP, /script-src[^;]*'unsafe-inline'/);
  });
});

describe("error bodies", () => {
  test("malformed JSON is a JSON 400 INVALID_JSON without the parser message", async () => {
    const r = await api("POST", "/api/records", a.alice.token, undefined, "{\"title\": broken");
    assert.equal(r.status, 400);
    assert.deepEqual(r.body, { error: "INVALID_JSON" });
    assert.doesNotMatch(r.text, /SyntaxError|Unexpected token|<html|at JSON\.parse/i);
    assertBaseline(r.headers);
  });

  test("malformed JSON is refused the same way without a session", async () => {
    const r = await api("POST", "/api/emergency/sos", undefined, undefined, "not json");
    assert.equal(r.status, 400);
    assert.deepEqual(r.body, { error: "INVALID_JSON" });
  });
});

describe("general write rate limit", () => {
  test(`the ${RECORDS_LIMIT + 1}th record write in the window is a 429 with Retry-After`, async () => {
    for (let i = 0; i < RECORDS_LIMIT; i++) {
      const ok = await api("POST", "/api/records", a.alice.token, { title: `limit ${i}`, doctorName: "Self", diagnoseSummary: "x" });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
    }
    const refused = await api("POST", "/api/records", a.alice.token, { title: "one too many", doctorName: "Self", diagnoseSummary: "x" });
    assert.equal(refused.status, 429);
    assert.equal(refused.body.error, "RATE_LIMITED");
    const retry = Number(refused.headers.get("retry-after"));
    assert.ok(Number.isInteger(retry) && retry > 0, `Retry-After was ${refused.headers.get("retry-after")}`);
  });

  test("reads are not counted, and another user has their own window", async () => {
    assert.equal((await api("GET", "/api/records", a.alice.token)).status, 200);
    const bob = await api("POST", "/api/records", a.bob.token, { title: "bob", doctorName: "Self", diagnoseSummary: "x" });
    assert.equal(bob.status, 200, JSON.stringify(bob.body));
  });
});
