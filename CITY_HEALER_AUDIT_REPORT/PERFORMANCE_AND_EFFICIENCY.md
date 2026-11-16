# Performance and Efficiency

## Test environment

| Item | Value |
|---|---|
| Machine | Windows 11, Intel Core Ultra 9 185H (22 logical CPUs), 34 GB RAM |
| Runtime | Node v25.2.1. The Docker image uses Node 22, which was not measured. |
| Backend under load | `node --import tsx server.ts` (TypeScript compiled on the fly) on port 3911, `NODE_ENV=development`, `API_ONLY=true`, copy of the local SQLite DB (990 active hospitals), Firebase **emulators** (Auth + Firestore) on localhost |
| Load generator | `audit_scripts/backend_audit.ts`, same machine, closed-loop `fetch` workers at concurrency 1/5/10/25/50, 200–400 requests per level. The generator shares the CPU with the server. |
| Frontend | Production build served by `node dist/server.cjs` (port 3920), measured in the browser pane (Chromium) with the Performance API. **No throttling, no Lighthouse.** |
| Raw data | `results/backend_audit.json`, `results/frontend_performance.json` |

All numbers below are **measured** unless labelled *estimate*. Emulator Firestore latency and contention differ from Google's production Firestore. Treat Firestore numbers as relative, not absolute.

## A. Frontend

| Metric | Desktop 1440×900 | Mobile 375×812 | Notes |
|---|---|---|---|
| TTFB | 16 ms (warm) / 44 ms (cold, 679 px pane) | 21 ms | localhost |
| FCP | 132 ms (warm) / 516 ms (cold) | 100 ms (warm) | |
| LCP | 180 ms (warm) / 528 ms (cold) | **1,156 ms** (warm) | LCP element is an Unsplash photo loaded from a third-party CDN |
| CLS | 0 | 0 | |
| INP | NOT MEASURED | NOT MEASURED | no interaction tracing tool |
| Requests on landing | 9 (cold) | | 0 API calls |
| Transfer on landing | **952 KB** (cold) | | 1,387 KB decoded |

**Bundle:**

| File | Size | Notes |
|---|---|---|
| Entry `index-*.js` | 762 kB (213 kB gzip) | React, router, Firebase client SDK |
| Legacy `App-*.js` | **1.61 MB** (457 kB gzip) | Loaded only for unmatched URLs |
| `html2canvas` | 202 kB | |
| `index.es` | 160 kB | |
| CSS | 209 kB | |
| `dist/assets` total | 3.2 MB | |
| `dist/server.cjs` | 6.2 MB | plus a 9.6 MB source map |

**Efficiency problems found:**

1. **No HTTP compression** (BUG-011). The 762 kB entry script goes over the wire uncompressed; gzip would make it 213 kB. On a real mobile network this is the largest single cost. *Estimate:* landing transfer would fall from ~952 KB to ~400 KB.
2. **`Cache-Control: max-age=0` on content-hashed assets.** Every visit revalidates every asset.
3. **Hero images from `images.unsplash.com`** (57–113 KB each). They are a third-party dependency and the mobile LCP element.
4. **`/api/hospitals` returns all 990 listings (918 KB, uncompressed)** to the Find care page.
5. Unnecessary re-renders: **NOT MEASURED** (React Profiler not available in a production build).

## B. Backend

Selected results (full table in `results/backend_audit.json`):

| Endpoint | c | RPS | p50 ms | p95 ms | p99 ms | Errors | Server CPU (% of 1 core) |
|---|---|---|---|---|---|---|---|
| `GET /api/health` | 1 | 2,275 | 0.4 | 0.7 | 1.4 | 0 % | 89 |
| 〃 | 50 | 4,468 | 11.2 | 18.0 | 20.6 | 0 % | 122 |
| `GET /api/hospitals` (SQLite, 918 KB) | 1 | **40** | 22.6 | 39.6 | 51.6 | 0 % | 73 |
| 〃 | 50 | **46** | 1,008 | **1,392** | 1,819 | 0 % | 82 |
| `GET /api/v1/doctors` (Firestore) | 1 | 104 | 8.6 | 17.9 | 25.6 | 0 % | 28 |
| 〃 | 50 | 1,136 | 27.2 | 148.8 | 163.5 | 0 % | 115 |
| `GET /api/v1/appointments/mine` (Firestore) | 1 | 92 | 8.9 | 18.0 | 25.7 | 0 % | 37 |
| 〃 | 50 | 740 | 60.3 | 105.1 | 130.0 | 0 % | 87 |
| `POST /api/v1/nlp/analyze` | 1 | 644 | 1.3 | 2.6 | 7.5 | 0 % | 65 |
| 〃 | 25 | 2,078 | 10.7 | 16.4 | 26.9 | 0 % | 106 |
| `POST /api/v1/copilot/chat` | 1 | **47** | 20.4 | 26.4 | 34.8 | 0 % | 81 |
| 〃 | 50 | **58** | 838.6 | **999.2** | 1,121.5 | 0 % | 93 |
| `POST /api/symptoms/check` | 1 | 51 | 19.2 | 23.2 | 27.7 | 0 % | 79 |
| 〃 | 50 | 61 | 809.0 | 889.5 | 904.2 | 0 % | 100 |
| `POST /api/v1/documents/extract` (1 KB) | 1 | 755 | 1.1 | 2.0 | 6.7 | 0 % | 51 |
| 〃 | 25 | 2,045 | 10.8 | 20.1 | 24.7 | 0 % | 96 |

| Other measurement | Value |
|---|---|
| Server cold start (spawn → healthy) | 9.0 s |
| Server memory (working set) | ~213 MB at start → ~730 MB peak during the copilot/triage phases → ~635 MB at the end. The growth was not investigated further; possible garbage-collection lag or retention. **Needs a longer soak test.** |
| Error rate | 0 % in every phase |
| Database query count | **NOT MEASURED** (no instrumentation). By code: `recommendHospitals` = 1 full `SELECT *` over hospitals + JSON parsing per request; copilot symptom routes also call it. |
| Transaction contention (Firestore emulator) | 20 simultaneous bookings of one slot took **3.6–7.8 s** wall time per round (p50 per request 3.0–7.0 s). Correctness held (1 success, 19 conflicts). The emulator serialises transactions pessimistically; production Firestore will differ. **Not representative of production latency.** |

**Bottleneck:** one Node process is CPU-bound on synchronous work.
- `copilot` and `symptoms/check` saturate one core at ~60 req/s, because each call ranks all hospitals: it reads 990 rows and JSON-parses three columns per row.
- `/api/hospitals` serialises 918 KB per request (~40–56 req/s).
- Latency grows linearly with concurrency on these routes (queueing on the event loop). At 50 concurrent users, p95 is about 1–1.4 s.

## C. AI efficiency

See AI_ML_EVALUATION.md → "AI efficiency summary".

- In-model inference is sub-millisecond: intent p50 0.031 ms, triage p50 0.084 ms, facility p50 0.012 ms, forecast fit+predict p50 0.016 ms.
- The route-level cost is the database work around the models, not the models.
- **LLM tokens and cost: NOT APPLICABLE.**

## D. ML efficiency

| Model | Training time | Model size | Inference | Dataset size | vs baseline |
|---|---|---|---|---|---|
| Intent | **4.3 s** (re-run, measured) | 532 KB | 0.03 ms | 80 test / project-written train set | CV 75 % (LR) vs 61.6 % (naive Bayes) |
| Triage | not re-run | 742 KB | 0.08 ms | 212 public test, 110 fresh | Public test 95.3 % |
| Facility | not re-run (needs a 100 MB download) | 676 KB | 0.01 ms | 73,952 names | Held-out 87.1 % |
| Lab (3) | not re-run | 12 KB | not measured separately | 768 / 303 / 583 patients | AUC 0.81–0.91 |
| Forecast | fitted per call | none | 0.016 ms | synthetic only | See AI_ML_EVALUATION Module 4 |

Speed figures say nothing about predictive quality; quality is reported separately in AI_ML_EVALUATION.md.

## Bottlenecks, ranked

| # | Bottleneck | Bug |
|---|---|---|
| 1 | Per-request full hospital scan and parse in copilot, triage and `/api/hospitals` | BUG-010 |
| 2 | No compression or long caching on static assets and JSON | BUG-011 |
| 3 | 918 KB hospital list sent to the browser | none |
| 4 | Legacy 1.6 MB chunk still shipped and reachable | BUG-012 |
| 5 | Third-party LCP images on mobile | none |
| 6 | Memory growth under load (needs a soak test) | none |
