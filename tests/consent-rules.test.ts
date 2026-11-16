/** The pure consent rule (shared/consent.ts): which consent events count as a valid consent. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { consentStatusOf, TERMS_VERSION, PRIVACY_VERSION, type ConsentEvent } from "../shared/consent";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 16);
const grant = (over: Partial<ConsentEvent> = {}): ConsentEvent => ({
  action: "grant", termsAccepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, recordedAtMs: NOW - DAY, ...over,
});
const withdraw = (recordedAtMs: number | null): ConsentEvent => ({ action: "withdraw", recordedAtMs });

describe("consent status", () => {
  test("no events is missing", () => {
    assert.equal(consentStatusOf([]), "missing");
  });

  test("an acceptance of the current terms and privacy versions is valid", () => {
    assert.equal(consentStatusOf([grant()]), "valid");
  });

  test("records written before the action field existed still count as acceptances", () => {
    assert.equal(consentStatusOf([grant({ action: undefined })]), "valid");
  });

  test("an older terms or privacy version is outdated", () => {
    assert.equal(consentStatusOf([grant({ termsVersion: "2025-01-01" })]), "outdated");
    assert.equal(consentStatusOf([grant({ privacyVersion: "2025-01-01" })]), "outdated");
  });

  test("the latest event decides, whatever order they arrive in", () => {
    const earlier = NOW - 3 * DAY, later = NOW - DAY;
    assert.equal(consentStatusOf([grant({ recordedAtMs: earlier }), withdraw(later)]), "withdrawn");
    assert.equal(consentStatusOf([withdraw(later), grant({ recordedAtMs: earlier })]), "withdrawn");
    assert.equal(consentStatusOf([withdraw(earlier), grant({ recordedAtMs: later })]), "valid");
    // An earlier acceptance of the current versions does not rescue a later, older-version one.
    assert.equal(consentStatusOf([grant({ recordedAtMs: earlier }), grant({ recordedAtMs: later, termsVersion: "2025-01-01" })]), "outdated");
  });

  test("an event with no server timestamp yet counts as the newest", () => {
    assert.equal(consentStatusOf([grant({ recordedAtMs: NOW }), withdraw(null)]), "withdrawn");
    assert.equal(consentStatusOf([withdraw(NOW), grant({ recordedAtMs: null })]), "valid");
  });

  test("malformed records are invalid, never valid", () => {
    assert.equal(consentStatusOf([grant({ termsAccepted: false })]), "invalid");
    assert.equal(consentStatusOf([grant({ termsAccepted: "true" })]), "invalid");
    assert.equal(consentStatusOf([grant({ termsVersion: undefined })]), "invalid");
    assert.equal(consentStatusOf([grant({ privacyVersion: 20261115 })]), "invalid");
    assert.equal(consentStatusOf([grant({ action: "approve" as any })]), "invalid");
  });

  test("marketing opt-in alone is not consent", () => {
    const marketingOnly = { marketingOptIn: true, recordedAtMs: NOW } as ConsentEvent;
    assert.equal(consentStatusOf([marketingOnly]), "invalid");
  });

  test("expiry applies only when a maximum age is set", () => {
    const old = grant({ recordedAtMs: NOW - 400 * DAY });
    assert.equal(consentStatusOf([old], { now: NOW }), "valid");
    assert.equal(consentStatusOf([old], { now: NOW, maxAgeDays: null }), "valid");
    assert.equal(consentStatusOf([old], { now: NOW, maxAgeDays: 365 }), "expired");
    assert.equal(consentStatusOf([grant({ recordedAtMs: NOW - 10 * DAY })], { now: NOW, maxAgeDays: 365 }), "valid");
  });
});
