# Recommended Action Plan

Ordered by risk. Nothing here has been implemented: each item needs your approval.
Effort estimates are rough (S = under half a day, M = 1–2 days, L = 3+ days).

## P0 — Before any real patient uses the product

| # | Action | Fixes | Effort |
|---|---|---|---|
| 1 | Expand deterministic emergency detection: self-harm, overdose (quantity + pills), breathing paraphrases; token-proximity matching instead of exact substrings; Hindi variants with inserted words. Add a crisis response with Tele-MANAS 14416 and 112. Escalate when the intent model itself predicts `emergency`. | BUG-001/002/003, S-01 | M |
| 2 | Build a curated emergency regression set (at least 200 messages in en/hi/Hinglish, reviewed by a clinician) and require 100 % recall on it in CI. Track the false-positive rate. | S-01 | M |
| 3 | Enforce consent on the server (`requireConsent` middleware → `403 CONSENT_REQUIRED`) and make the client gate fail closed. | BUG-004/005, S-02/03 | S |
| 4 | Fix lab-value parsing: Indian digit grouping, "lakh", parenthesised ranges, plausibility bounds per analyte, wider label gaps (HDL/LDL/TSH). Visually mark pre-filled values until confirmed. Add the audit's 10 synthetic reports as tests. | BUG-006/009 | M |
| 5 | `.dockerignore` → `.env*` (keep `.env.example`); pass `VITE_*` as build args; set `DEMO_MODE` default false. | BUG-007, S-04/07 | S |

## P1 — Before further feature work

| # | Action | Fixes | Effort |
|---|---|---|---|
| 6 | **Choose one appointment system** (Firestore) and one doctor repository. Point the dashboard, doctor tools and copilot `findDoctors` at it; retire or migrate the SQLite booking routes. | BUG-008, INTEGRATION 1–2 | L |
| 7 | Remove the legacy `src/App.tsx` catch-all and the localStorage fallback database; add a proper 404 page. Choose one deploy target (drop `vercel.json` or add an API there). | BUG-012, S-08 | M |
| 8 | General rate limiting (per user and IP) on all write routes; stricter limits on SOS and booking. | S-05 | S |
| 9 | Security headers: CSP (self, Firebase, Google; self-host the hero images) and HSTS behind HTTPS. JSON error handler. | S-06, BUG-015 | S |
| 10 | Show load errors instead of empty states in the dashboard. | BUG-016 | S |
| 11 | Minimal doctor and admin UI for provider applications, verification and slot publishing (currently API/CLI only). | INTEGRATION 8 | L |

## P2 — Efficiency

| # | Action | Measured today | Effort |
|---|---|---|---|
| 12 | Cache parsed hospitals in memory (invalidate on writes); filter or paginate `/api/hospitals` by distance | copilot/triage ~60 req/s, `/api/hospitals` 918 KB and ~50 req/s | S–M |
| 13 | Enable gzip/brotli compression and `Cache-Control: immutable, max-age=31536000` for `/assets/*` | 762 kB uncompressed entry script, `max-age=0` | S |
| 14 | Self-host and resize the hero images (WebP/AVIF, `srcset`) | Mobile LCP 1.16 s (warm, unthrottled), third-party | S |
| 15 | Soak test for memory growth (213 → 730 MB under load) | — | S |
| 16 | Run Lighthouse with mobile throttling and add Playwright E2E for onboarding → booking | not available today | M |

## P3 — AI/ML quality and operations

| # | Action | Effort |
|---|---|---|
| 17 | Collect a real, consented, de-identified evaluation set for intent and triage. The current held-out sets are small and written by the team; intent CV accuracy (75 %) is well below held-out (93.8 %). | L |
| 18 | Add an out-of-scope route and fix plain care requests ("I need a cardiologist in Noida") | S |
| 19 | Forecast: accept missing days; add robust handling (median or winsorised) for spikes; evaluate on real aggregate data once available | S |
| 20 | Dataset cards (provenance, licence, consent, exclusions) for every training set; artefact hashes in model cards | S |
| 21 | Persist monitoring (latency, abstention, error rate) beyond process memory; add alerting and drift tracking | M |
| 22 | Install `pdfjs-dist` (your approval needed) and test text-layer PDFs; decide whether OCR is in scope | S |
| 23 | Fix `ml/*.py` console encoding (`sys.stdout.reconfigure(encoding="utf-8")`) for Windows reproducibility | S |
| 24 | Clean up stale files: `firebase-applet-config.json`, `firebase-blueprint.json`, root `firestore.rules`, duplicate zips in Downloads | S |

## Suggested order

**P0 items 1–5 first** (about 4–6 days). Then re-run `CITY_HEALER_AUDIT_REPORT/audit_scripts/eval_ai.ts` and `backend_audit.ts` to confirm. Then P1 item 6, the consolidation, before building anything new on either appointment system.
