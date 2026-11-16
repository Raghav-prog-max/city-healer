# City Healer: algorithms and techniques (Milestone 4, A1 to A14)

This file maps each of the 14 algorithms in the Milestone 4 document ("Relevance of Algorithms /
Techniques") to the code that implements it, where the app uses it, the tests that check it, its
complexity, and its limitations. Line numbers are for the commit that adds this file.

**What kind of intelligence answers.** City Healer has three kinds of engine, and this file keeps
them apart:

- **Rules**: hand-written keyword and regular-expression rules (A2, A3, A4). Deterministic.
- **Trained models**: TF-IDF + logistic regression triage and intent models, a TF-IDF medicine
  retrieval index, lab risk models. Trained offline in `ml/`, run in-process, no network.
- **LLM (optional)**: Gemini, used only when `GEMINI_API_KEY` is set (see `.env.example`). No key
  is configured in this repository, and none is needed: with no key the app makes no external AI
  call and every answer comes from the rules and trained models. Responses that can come from
  either say which one did, in `engine` (`"offline"` or `"llm:<model>"`).

**Nothing here is clinically validated.** The keyword lists, model training data, weights and the
waiting-time formula have not been reviewed or measured by clinicians. They are decision support
for a prototype, not diagnosis.

Unit tests: `tests/algorithms.test.ts` (part of `npm run test:unit`; no server, no network: every
LLM test injects a fake model caller or a fake `fetch`). Server tests: `npm run test:server`.

| # | Technique | Status | Source |
|---|---|---|---|
| A1 | LLM structured JSON triage | added (optional, off without a key) | `server/ai/llm.ts` |
| A2 | Severity-ordered emergency rules | existing | `shared/emergencySafety.ts`, `shared/triage.ts` |
| A3 | Bilingual keyword / co-occurrence matching | existing | `shared/triage.ts` |
| A4 | Unicode language detection | existing | `shared/triage.ts` |
| A5 | Weighted hospital scoring + top-k | existing, moved to a testable module | `shared/hospitalRanking.ts` |
| A6 | Nearest-neighbour linear scan | existing, moved to a testable function | `shared/geo.ts` |
| A7 | OPD waiting-time estimation | added (generalises the old formula) | `shared/waitTime.ts` |
| A8 | Exponential backoff + model failover | added | `server/ai/llm.ts` |
| A9 | Graceful degradation | added for the LLM path; offline chain existing | `server/ai/llm.ts`, `server/ai/rag.ts` |
| A10 | Retrieval-augmented generation | added | `server/ai/rag.ts` |
| A11 | Robust JSON extraction + schema validation | added | `server/ai/llm.ts` |
| A12 | RBAC + resource ownership | existing | `server.ts`, `server/firebase/*` |
| A13 | bcrypt + JWT | deviation (see below) | `server/firebase/identity.ts`, `scripts/legacy-passwords.ts` |
| A14 | Fixed-window rate limiting | existing, moved to a testable module | `server/rateLimit.ts` |

---

## A1. LLM triage with structured JSON output

- **Purpose.** When an LLM is configured, ask it for triage in a fixed, machine-readable schema so
  the app can route to hospitals and show SOS without parsing prose.
- **Input.** Symptom text, reply language (`en` / `hi`), optional `LlmConfig` and injected `CallModel`.
- **Output.** `EngineTriage`: `suspectedCondition, explanation, specialistType, specialistEn,
  urgencyLevel (LOW|MEDIUM|HIGH|CRITICAL), recommendations[], flagUrgentSOS, source, lang, engine`,
  plus `engineFallbackReason` when the offline engine answered although a key is set.
- **Source.** `server/ai/llm.ts:286` `llmTriage`; prompt `TRIAGE_SYSTEM_PROMPT` `:253`; schema
  `LlmTriageSchema` `:79`; Gemini REST caller `geminiCaller` `:217` (JSON response mode, key in the
  `x-goog-api-key` header, per-call timeout).
- **Used by.** `POST /api/symptoms/check` (`server.ts:1596`). With no key the response is exactly
  the previous offline result plus `engine: "offline"`.
- **Tests.** `tests/algorithms.test.ts`: "A1: a valid model reply becomes the triage result, tagged
  with the model", "A1: CRITICAL from the model always raises the SOS flag", "A1: the Gemini caller
  asks for JSON and sends the key in a header, not the URL"; server: `tests/access-matrix.test.ts`
  "with no LLM key the offline engine answers and says so".
- **Complexity.** One prompt per attempt; local work O(n) in the reply length (A11).
- **Limitations.** Never exercised against the real Gemini API in this repository (no key; tests
  use fakes). The model may escalate urgency but is never consulted when the rules fire (A2).
  A model answer is not checked against the trained model; it replaces it when valid.

## A2. Severity-ordered emergency rules

- **Purpose.** Recognise emergencies deterministically, checking the most dangerous categories
  first, so "cough and chest pain" is cardiac, never a cold; unclear input is "not assessed".
- **Input.** Free text. **Output.** `OfflineTriage` with `urgencyLevel`, `flagUrgentSOS`,
  `emergencyCategory`, `notAssessed`.
- **Source.** `shared/emergencySafety.ts:104` `detectEmergency` (normalised regular expressions
  for self-harm, overdose, breathing, chest pain, bleeding, unconscious); `shared/triage.ts:406`
  `classify` and `:413` `classifyRest` (severity order: facility search, life-threatening, trauma,
  neuro, cardio-respiratory, gastro, fever, headache, URI, unknown); `:437` `triageWithoutAI`.
- **Used by.** `shared/triageModel.ts:180` `triage` runs the rules before the trained model;
  `llmTriage` (A1) returns before calling any LLM when they fire; the copilot orchestrator
  (`server/ai/orchestrator.ts:94`) checks them first on every message.
- **Tests.** `tests/algorithms.test.ts` "A2: cough plus chest pain is treated as cardio-respiratory,
  never as a cold", "A2: unrecognised input is not guessed", "A2: emergency rules override the LLM -
  the model is never called"; `tests/triage-heuristic.test.ts`; `tests/emergency-safety.test.ts`
  ("critical safety set: 100% recall required"; not part of `test:unit`, run it with `npx tsx --test`).
- **Complexity.** O(k * m) for k terms and message length m.
- **Limitations.** Keyword lists are not clinically validated; the safety set in
  `tests/fixtures/emergency_safety_set.json` is a draft awaiting clinician review.

## A3. Bilingual keyword matching with co-occurrence

- **Purpose.** Match English, Devanagari Hindi and romanised Hindi; match body part and symptom
  separately and require both, so an adjective in between ("सीने में तेज़ दर्द") still matches.
- **Input / output.** Lower-cased text; boolean matches feeding A2.
- **Source.** `shared/triage.ts:53` term sets `T`, `:123` body-part/symptom pairs `PART`,
  `:34` `hasAny`, `:37` `hasAll`, co-occurrence at `:420`-`:423`.
- **Used by.** Every triage (A2).
- **Tests.** "A3: Devanagari chest + pain with an adjective in between still escalates",
  "A3: romanised Hindi is matched too"; `tests/triage-heuristic.test.ts` Hindi cases.
- **Complexity.** O(k * m). **Limitations.** Substring matching; spelling variants beyond the
  listed ones are missed (the trained model and A2's regular expressions cover some of them).

## A4. Unicode-range language detection

- **Purpose.** Reply in Hindi when the text contains Devanagari (U+0900 to U+097F).
- **Input.** Text. **Output.** `"hi"` or `"en"`.
- **Source.** `shared/triage.ts:40` `detectLang`.
- **Used by.** `/api/symptoms/check` when `lang` is not sent, `triage`, `llmTriage`, the orchestrator.
- **Tests.** "A4: any Devanagari character means Hindi; Latin only means English".
- **Complexity.** O(n), one regular expression. **Limitations.** Romanised Hindi is detected as
  English (the reply is then in English; matching still works, A3).

## A5. Weighted multi-criteria hospital scoring and top-k

- **Purpose.** Recommend the hospital that fits the condition, not only the nearest.
- **Formula.** S = department (50 listed / named / empanelled, 30 IPHS-expected, 15 large general
  hospital without a list) - 40 if unconfirmed + 10 free bed + 20 free ICU when HIGH/CRITICAL +
  max(0, 40 - d_km). Maximum 120; shown as a percentage.
- **Input.** Hospital rows, specialist, urgency, patient position (central Delhi if none).
  **Output.** Top 3 hospitals with `distanceKM`, `travelTimeMin`, `recommendationScore`, `matchReason`.
- **Source.** `shared/hospitalRanking.ts:42` `scoreHospital`, `:74` `topK`, `:83` `scorePercent`;
  called from `server.ts:351` `recommendHospitals`.
- **Used by.** `/api/symptoms/check`, the copilot and the consultation auto-reply.
- **Tests.** "A5: a hospital with the needed department outranks a nearer one without it",
  "A5: ICU counts only for HIGH or CRITICAL; the maximum is 120", "A5: topK returns the k best,
  best first, stable on ties"; server: `tests/access-matrix.test.ts` "triage routes the patient to
  the right place".
- **Complexity.** O(n log n) for n hospitals (sort), O(n) space.
- **Deviation from the Milestone 4 text.** The document lists a rating term (5 per star). It was
  removed from the code because ratings in this data are unverified and imported hospitals have
  none. Distance is Haversine (great-circle), already the planned improvement; travel time is
  distance at about 22 km/h plus 5 minutes, not live traffic (the random traffic factor is gone).

## A6. Nearest-neighbour search (linear scan)

- **Purpose.** On SOS, alert the hospital closest to the caller.
- **Input.** Caller position, hospital list. **Output.** `{ item, distanceKm }` or null.
- **Source.** `shared/geo.ts:56` `nearest` (Haversine `:18`).
- **Used by.** `POST /api/emergency/sos` (`server.ts:1414`).
- **Tests.** "A6: picks the closest point and reports its distance"; `tests/geo.test.ts`.
- **Complexity.** O(n) time, O(1) space. **Limitations.** Ignores ambulance availability and
  traffic; a k-d tree or geohash only pays off at thousands of facilities.

## A7. OPD waiting-time estimation

- **Purpose.** Tell a patient roughly how long they will wait, with an honest range.
- **Input.** `{ patientsAhead, recentConsultMinutes?, slotMinutes?, doctorDelayMin?, fixedOverheadMin? }`.
- **Output.** `{ minutes, low, high, perPatientMin, basis, confidence, note }`. Per-patient time is
  the median of recent consultations (range: quartiles), else the slot length (range x0.8 to
  x1.3), else 12 minutes (range x0.6 to x1.5); plus 10 minutes overhead plus the doctor's delay.
- **Source.** `shared/waitTime.ts:56` `estimateOpdWait` (API documented in the file header).
- **Used by.** The same-day check-in queue (`server/firebase/checkin.ts` `ownView`): while a patient
  is waiting, `GET /api/v1/appointments/:id/queue` and `POST .../check-in` return
  `estimate: { low, high, basis, confidence }` from the number of patients ahead and the booking's slot
  length, and the patient screen shows it as a rough range next to "N patients before you". Tested in
  tests/checkin.test.ts ("the last booked checks in first and is not ahead of anyone").
- **Tests.** "A7: with no timing data it equals the original 12q + 10", "A7: uses the median of
  recent consultations and the doctor's delay, with a range", "A7: slot length is the fallback, and
  bad input is cleaned".
- **Complexity.** O(r log r) for r recent durations; O(1) without history.
- **Limitations.** No consultation durations are recorded yet, so in production today it always
  uses the 12-minute default (`confidence: "low"`). Not validated against real waits.

## A8. Exponential backoff with jitter and model failover

- **Purpose.** Ride out brief overloads of an AI service; switch model on a longer outage; do not
  retry errors that will fail the same way.
- **Input.** Model list (`GEMINI_MODELS`), prompt, `CallModel`, backoff options.
  **Output.** `{ model, text, attempts }` or the last error.
- **Algorithm.** Per model up to 3 attempts; wait before retry i is min(5 s, 600 ms x 3^i) with
  equal jitter (uniform in [d/2, d]); 400/401/403/404 are permanent and stop retries and failover;
  an overall budget (default 15 s) caps the total time.
- **Source.** `server/ai/llm.ts:139` `backoffDelay`, `:149` `withBackoff`, `:176`
  `generateWithFailover`; status classification in `geminiCaller` `:217`.
- **Used by.** `llmTriage` (A1) and `answerWithRetrieval` (A10), when a key is set.
- **Tests.** "A8: delays grow by the factor, with jitter in [d/2, d]", "A8: a transient failure is
  retried, waiting between attempts", "A8: after the first model's retries fail, the second model
  answers", "A8: a permanent error (bad key) stops retries and failover", "A8: the Gemini caller
  marks 5xx as transient and 4xx as permanent".
- **Complexity.** At most models x attempts calls (6 by default), bounded by the time budget.
- **Limitations.** No circuit breaker: a model known to be down is retried on every request.
  429 is treated as transient (retried), which can add load during a quota outage.

## A9. Graceful degradation (fallback chain)

- **Purpose.** Always return a usable answer and the SOS path, with or without an AI service.
- **Chain.** Emergency rules (A2) -> LLM primary -> LLM fallback model (only with a key) ->
  offline trained model -> offline rules ("not assessed" rather than a guess). For RAG: LLM answer
  limited to retrieved passages -> templated answer quoting them -> abstain when nothing is retrieved.
- **Source.** `server/ai/llm.ts:286` `llmTriage` (no key, HTTP error, timeout, invalid JSON or
  schema all fall back, with `engineFallbackReason`); `server/ai/rag.ts:78`; offline chain
  `shared/triageModel.ts:180`.
- **Used by.** `/api/symptoms/check`, `/api/v1/knowledge/ask`.
- **Tests.** "A9: no key configured means exactly the offline result plus engine: offline",
  "A9: invalid JSON from the model falls back to offline and says why", "A9: a timeout on every
  model falls back to offline"; `tests/triage-model.test.ts` "hybrid triage".
- **Complexity.** Offline path O(k * m) + model inference O(terms).
- **Limitations.** The other AI routes (lab reports, diet, copilot) have no LLM path at all; they
  are offline only, so there is nothing to degrade from.

## A10. Retrieval-augmented generation

- **Purpose.** Answer medicine questions only from the app's own dataset, with citations, so no
  medicine, composition or use is invented.
- **Input.** Question, `k` (1 to 10, default 3), optional retriever / LLM config.
- **Output.** `RagAnswer`: `answer, citations[] (subset of passage ids), passages[] ({id, title,
  text, source, score}), engine, abstained, engineFallbackReason?, disclaimer`.
- **Algorithm.** Retrieve: TF-IDF cosine similarity over 11,498 medicines (character 3-grams of
  names, words and word pairs of uses; `server/medicineIndex.ts:155` `searchMedicines`), top-k,
  score floor 0.08, one passage per composition. Generate: offline, a template that quotes each
  passage with its id; with a key, the LLM receives only the passages and must reply
  `{answer, citations}`; an answer citing nothing or an id not retrieved is discarded (A9).
- **Source.** `server/ai/rag.ts:44` `retrieveMedicinePassages`, `:62` `templatedAnswer`,
  `:78` `answerWithRetrieval`.
- **Used by.** `POST /api/v1/knowledge/ask` (`server.ts:1714`, auth + `aiRateLimit`). The existing
  copilot pipeline (`server/ai/orchestrator.ts`, also behind `/api/developer/ai-pipeline`) is the
  intent -> plan -> retrieve -> synthesise flow described in Milestone 4, implemented with the
  trained intent model and templated synthesis rather than an LLM.
- **Tests.** "A10: the real retriever returns top-k cited passages from the medicine dataset",
  "A10: offline generation quotes and cites every retrieved passage", "A10: nothing retrieved means
  abstain, not an answer from memory", "A10: the LLM sees only the passages and its citations must
  be among them"; server: `tests/access-matrix.test.ts` "knowledge answers cite the retrieved
  medicine passages (RAG, offline)".
- **Complexity.** Retrieval O(N * t) for N medicines and t query terms (sparse cosine), then
  O(N log N) sort; generation O(k).
- **Limitations.** One corpus (the public medicine dataset, not a pharmacology reference). The
  citation check proves an id was retrieved, not that the sentence is faithful to the passage.
  No UI screen calls the endpoint yet.

## A11. Robust JSON extraction and schema validation

- **Purpose.** One stray line from a model must not break a triage result, and a reply in the
  wrong shape must never reach the patient.
- **Input.** Model text. **Output.** Parsed value, or `{ ok: false, error }`.
- **Algorithm.** Try the whole text; then a ```json fence; then the span from the first `{`/`[` to
  the last `}`/`]`; each also with trailing commas removed (string-aware). Then zod validation
  (`LlmTriageSchema`: enum urgency, 1 to 8 recommendations, length limits).
- **Source.** `server/ai/llm.ts:35` `extractJson`, `stripTrailingCommas`, `:95` `parseJsonWith`,
  `parseTriageJson`.
- **Used by.** `llmTriage` (A1), `answerWithRetrieval` (A10).
- **Tests.** "A11: plain, fenced, prose-wrapped and trailing-comma JSON all parse", "A11: commas
  inside strings are left alone", "A11: schema validation rejects wrong types and unknown urgency
  levels".
- **Complexity.** O(n) per attempt, at most 6 attempts. **Limitations.** Does not repair other
  malformations (single quotes, comments, truncated output); those fall back offline.

## A12. Role-based access control and resource ownership

- **Purpose.** Four roles (PATIENT, DOCTOR, HOSPITAL, ADMIN); each request is checked on the server,
  and data is scoped to its owner.
- **Input.** Verified identity (A13) and the resource id. **Output.** 401 / 403 or the scoped data.
- **Source.** `server.ts:132` `authenticateUser`, `:182` `requireRole`, `:264`
  `callerAdministersHospital`, `:276` `callerControlsDoctor`, `:293` `doctorTreatsPatient`;
  `server/firebase/identity.ts` (role from the custom claim); per-route owner filters in
  `server/firebase/booking.ts`, `consultations.ts`, `patients.ts`; `firestore.rules`.
- **Tests.** Server only (needs real tokens from the Auth emulator): `tests/access-matrix.test.ts`
  ("anonymous callers are rejected on every guarded route", "PATIENT is refused privileged
  operations", "cross-patient isolation", "doctor scoping follows the clinical relationship"),
  `tests/resource-ownership.test.ts` ("a hospital may act only on its own facility", ...).
  No unit test in `tests/algorithms.test.ts`: the checks are Express middleware over Firebase.
- **Complexity.** O(1) role check; ownership checks are one indexed lookup.
- **Deviation.** Milestone 4 says the role is re-checked against the database on each request.
  The role is now a Firebase custom claim inside the token, and freshness comes from
  `verifyIdToken(token, checkRevoked = true)`: set-role revokes the user's sessions, so a demoted
  account is refused at once.

## A13. bcrypt and JWT: deviation, documented

What Milestone 4 describes (bcrypt-hashed passwords in SQLite, a self-signed 7-day JWT with
`JWT_SECRET`) was the original sign-in. It has been replaced by Firebase Authentication:

- **JWT.** Every API request carries a Firebase ID token, a JWT signed with RS256 by Google.
  `server/firebase/identity.ts:48` verifies signature, expiry, audience and issuer with
  `adminAuth.verifyIdToken(token, true)`, and `true` also checks revocation, disabled and deleted
  accounts. Tokens last one hour (refreshed by the client SDK), not seven days, and there is no
  `JWT_SECRET`: the server never issues tokens. Tests: `tests/access-matrix.test.ts` "forged and
  malformed tokens are rejected".
- **Password hashing.** Firebase Authentication hashes passwords itself (a modified scrypt); this
  code never sees or stores a password hash at sign-up or sign-in.
- **bcrypt, genuinely used.** Only in the one-off migration of old SQLite accounts
  (`scripts/migrate-users.ts`): old bcrypt hashes are imported into Firebase as BCRYPT, and
  `scripts/legacy-passwords.ts:14` `hasLegacyDerivedPassword` uses `bcrypt.compare` to find
  accounts whose password was derived from their email by the retired sign-in, which are imported
  without a password. Tests: "A13: a hash of the email-derived legacy password is detected",
  "A13: a real password is not flagged, and no hash is not flagged".
- **Why no new bcrypt use was added.** Hashing passwords a second time beside Firebase would add a
  second credential store to protect for no benefit.
- **Complexity.** bcrypt compare costs about 2^cost rounds per candidate (cost 10 for legacy hashes).

## A14. Fixed-window rate limiting

- **Purpose.** Protect the AI routes from abuse.
- **Input.** Key (verified uid, or `demo:<ip>` for the shared demo identity). **Output.**
  `{ allowed, count, remaining, retryAfterSeconds }`; the middleware answers 429 with
  `Retry-After` when refused.
- **Algorithm.** Per key, a window opens at the first request and lasts one hour; at most
  `AI_RATE_LIMIT` (default 300) requests per window; expired windows pruned above 5,000 keys.
- **Source.** `server/rateLimit.ts:26` `createFixedWindowLimiter`; middleware `server.ts:206`
  `aiRateLimit` (limiter `:204`). Same behaviour and limits as before the move.
- **Used by.** All AI routes (`/api/symptoms/check`, `/api/records/analyze`, `/api/medicines/*`,
  `/api/diet/recommend`, `/api/ai/copilot`, `/api/v1/*` AI routes, `/api/developer/ai-pipeline`,
  `/api/chat/:id`, `/api/v1/knowledge/ask`).
- **Tests.** "A14: allows `limit` requests per window, then refuses with Retry-After", "A14: a new
  window opens once the old one has passed", "A14: expired windows are pruned once the map is over
  its cap"; server: `tests/access-matrix.test.ts` "AI endpoints are metered per user".
- **Complexity.** O(1) per request; O(keys) memory.
- **Deviation / limitations.** Milestone 4 lists "auth routes: 20 attempts per 10 minutes, AI: 30
  per hour, per IP". Sign-in now happens in Firebase Authentication, which applies its own abuse
  protection, so this server has no auth routes to limit; the AI limit is per user (per IP only for
  demo callers) and was raised to 300/hour once the models ran in-process. In-memory: resets on
  restart and is per process (Redis or similar would be needed for several servers). Windows start
  at each key's first request rather than on clock boundaries.
