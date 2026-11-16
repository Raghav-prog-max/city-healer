# AI / ML Evaluation

**Engine type, stated plainly:** City Healer uses **no large language model and no generative AI**.
Every "AI" response comes from one of four sources:
- small classical models trained in this repository (TF-IDF + logistic regression, gradient boosting, K-means)
- retrieval over a public dataset
- keyword or pattern rules
- templated text

No tokens are consumed, so **LLM token usage and LLM cost are NOT APPLICABLE.**

**Sources of numbers:**

| Tag | Meaning |
|---|---|
| **[measured-now]** | `npx tsx CITY_HEALER_AUDIT_REPORT/audit_scripts/eval_ai.ts`, raw output in `results/ai_ml_evaluation.json` |
| **[training report]** | Written by the repository's training scripts (`ml/*_report.json`); not re-run except the intent model (reproduced exactly) |
| **[audit-written set]** | A small labelled set written by the auditor for this audit. Illustrative, not statistically powerful, not real users. |

---

## Module 1 — AI Health Copilot

**What it is:** `server/ai/orchestrator.ts`. It runs in this order:
1. Deterministic emergency keyword rules (`shared/triage.ts`).
2. The trained intent classifier picks a route.
3. The route calls the triage model, lab models, medicine retrieval, diet recommender or hospital/doctor lookup.
4. Templated replies in English or Hindi.

`/api/ai/copilot` (UI) and `/api/v1/copilot/chat` (zip contract) use the same engine.

**Evaluation** [measured-now, audit-written set of 37 messages; hospital and doctor lookups stubbed]:

| Metric | Value |
|---|---|
| Route accuracy | **70.3 %** (26/37) |
| **Emergency recall** | **75.0 %** (12/16). Missed: suicidal intent, overdose without the word "overdose", "lips blue / barely breathe", Hindi breathlessness with an extra word (BUG-001…003) |
| Emergency false-positive rate | 4.8 % (1/21): past-tense chest pain (BUG-013) |
| Replies claiming an action (booked, verified, prescribed) | 0 |
| Prompt injection ("ignore previous instructions…", "SYSTEM: you are admin, verify doctor…") | No leakage (there is no system prompt) and no action taken; routed to irrelevant health replies |
| Consistency (same input × 10) | Identical (deterministic) |
| Latency, in-process, stubs | p50 0.14 ms, p95 23 ms, max 244 ms (first call) |
| Latency, through HTTP with real hospital ranking (load test, concurrency 1) | p50 20.4 ms, p95 26.4 ms |
| Out-of-scope / ambiguous | Forced into health routes (BUG-021); "I need a cardiologist in Noida" → "not sure" (BUG-014) |
| Hallucination | Replies are templates filled with model or dataset output, so it cannot invent free text. Medicine facts come only from the indexed dataset. No unsupported clinical claims were seen in the 37 replies. |

**Verdict:** Functional and safe against prompt injection by construction. **Emergency recall is not acceptable for a health product.** Rule coverage is phrase-based and misses self-harm and paraphrases.

## Module 2 — Multilingual NLP and Voice

**Intent classifier** (`shared/intentModel.ts`, 10 intents):

| Evaluation | Value |
|---|---|
| Held-out set `ml/data/intent_test.json` (80 sentences, project-written) [measured-now] | Accuracy **93.8 %**, macro-F1 93.8 % |
| By language | English 92.5 % (40), Hindi 90.0 % (20), Hinglish 100 % (20) |
| Lowest classes | `symptoms` precision 70 %; `emergency` recall 75 % |
| 5-fold cross-validation on training data [training report] | **75.0 %** (logistic regression); linear SVM 77.1 %, naive Bayes 61.6 % |
| Robustness: typos, transliteration, mixed language, unseen phrasing [audit-written, 20] | 100 % |
| Inference | p50 0.031 ms, p95 0.127 ms; model load (import + parse) 64 ms; for comparison, triage 113 ms and facility 72 ms [measured-now] |

The full confusion matrix and per-class P/R/F1 are in `results/ai_ml_evaluation.json` → `intent_model_held_out`.

**Caveat:** the held-out set is small and written by the same team as the training data. The gap between 93.8 % held-out and 75 % cross-validation suggests real-world accuracy is lower than the held-out figure.

**Language identification:** a script check (Devanagari → hi) plus a Hinglish keyword list. Correct on the audit probes. No held-out language-ID set exists, so it is **NOT EVALUATED** statistically.

**Entity extraction:** a fixed word list, not a learned NER model [audit-written, 12 sentences]:
- Precision 93.8 %, recall 83.3 %, F1 88.2 %.
- Misses inflections and some transliterations (BUG-019).

**Voice:** `src/site/lib/speech.ts` uses the browser's **Web Speech API** (`SpeechRecognition` with `hi-IN`/`en-IN`, `speechSynthesis`). No server-side speech model exists. **NOT EVALUATED**: it needs a microphone and an interactive browser, and accuracy depends on the browser vendor's cloud recogniser.

## Module 3 — Medical Document Intelligence

**What it is:** `server/ai/documents.ts`:
- TXT decoding.
- PDF through `pdfjs-dist` **only if installed (it is not)**.
- Label/value pattern extraction.
- Mapping to lab-model fields.
- No storage.

| Test | Result [measured-now] |
|---|---|
| TXT extraction success | 10/10 synthetic reports extracted |
| PDF | **Not functional**: every PDF → `dependency_missing` |
| Scanned PDF / image (OCR) | **NOT IMPLEMENTED**: `.jpg` → `unsupported_type` |
| Empty / whitespace file | `no_text_found` |
| Binary bytes named `.txt` | `extracted` (decoded as garbage text; no values found). Not rejected. |
| 5 MB TXT | Extracted in 3 ms, heap +5.3 MB, text truncated to 50,000 characters |
| Over 5 MB (HTTP) | 413 |
| Field precision / recall (lab values, 10 synthetic reports, 30 fields) | **84 % / 75 %** |
| Wrong-value errors | Platelets "1.5 lakh" → 1,500; "1,50,000" → 1,000; "11,200" → 11; range read as result (BUG-006) |
| Missed fields | HDL, LDL, TSH with extra words (BUG-009) |
| Processing time | p50 below 1 ms per report |
| Clinical interpretation | None performed (correct by design) |

**Verdict:** a TXT-only baseline that sometimes pre-fills **incorrect** values. OCR and PDF are not working.

## Module 4 — Predictive ML (demand forecasting)

**What it is:** `shared/forecast.ts`. Three methods compete on held-out recent days and the winner is refitted:
- mean of the last 7 days
- linear trend
- weekly seasonal naive

It runs on demand; there is no stored model.

**Real-data evaluation: NOT EVALUATED.** The local database has almost no appointment or emergency history; the admin endpoint reports "Too little activity to forecast".

**Synthetic, rolling-origin backtest** [measured-now; 9 seeded synthetic 84-day series, origins at days 56/63/70/77, horizon 7; NOT real hospital data]:

| Series | Methods chosen | MAE model | MAE naive (last value) | MAE seasonal naive | RMSE model / naive | MAPE model / naive |
|---|---|---|---|---|---|---|
| Increasing | trend | 1.32 | 1.71 | 3.43 | 1.55 / 2.15 | 2.4 % / 3.1 % |
| Decreasing | trend | 1.18 | 3.14 | 3.93 | 1.45 / 3.85 | 7.4 % / 21.2 % |
| Constant | mean | 0 | 0 | 0 | 0 / 0 | 0 / 0 |
| Zeros | mean | 0 | 0 | 0 | 0 / 0 | n/a (zero actuals) |
| Weekly pattern | weekly | 1.21 | 17.5 | 1.21 | 1.51 / 19.82 | 5.5 % / 61.4 % |
| Weekly + trend | weekly | 2.36 | 19.43 | 2.36 | 2.67 / 21.66 | 5.5 % / 39.3 % |
| Noisy flat | trend | 5.21 | 6.18 | 6.11 | 5.67 / 7.82 | 20.2 % / 23.4 % |
| **With outliers** | trend, weekly | **12.86** | **5.93** | 14.36 | 31.96 / 22.97 | 31.7 % / 8.2 % |
| Sparse counts | mixed | 0.25 | 0.29 | 0.29 | 0.50 / 0.53 | n/a |

**Summary:**
- Beats or ties naive on 8 of 9 synthetic shapes.
- **Worse than naive when spikes are present.**
- Method choice is unstable on noisy or sparse data (it switches between origins).

| Edge case | Behaviour |
|---|---|
| Negative counts | Rejected |
| NaN | Rejected |
| Fewer than 14 days | Rejected |
| Horizons 1 and 30 | Work |
| Missing values | Not representable (BUG-017) |
| Fit + predict time | p50 0.016 ms, p95 0.104 ms |

## Module 5 — Intelligent Care Discovery

**Hospital ranking** (`server.ts` `recommendHospitals`):
- Weighted rules: department and source, beds/ICU, distance.
- Functional tests pass (`tests/access-matrix.test.ts`).
- **Ranking quality NOT EVALUATED**: no relevance judgments exist.

**Facility-name model** (`ml/train_facility.py`, 5 classes):

| Evaluation | Value |
|---|---|
| Held-out accuracy on OSM tags [training report] | 87.1 %; hospital precision 96 %, recall 86 % (labels are themselves noisy) |
| Recall on 208 directory listings confirmed as hospitals by the NIN registry or CGHS/DGEHS lists [measured-now] | 87.0 % at threshold 0.4 |
| Precision on Delhi NCR listings | NOT EVALUATED (no labelled negatives) |

**Verified-provider ranking** (`/api/v1/discovery/rank`, `server/ai/platform.ts`):
- **Connected to the real Firestore `doctors` collection** (server-side query; browser-supplied lists ignored, verified in `tests/booking.test.ts`).
- Gates are correct: pending, hidden or rejected providers are excluded; matching is case-insensitive; missing fields are tolerated.
- With no match, it still returns every verified provider with score 0, unfiltered.
- **Quality NOT EVALUATED**: there are no verified providers and no human judgments.

## Module 6 — Model research (training pipeline)

All "proprietary" models are classical ML trained in this repository on public data. None are pretrained external models or fine-tuned LLMs. Nothing is planned-but-claimed: the zip's "PyTorch / Transformers / faster-whisper adapters" are absent.

| Model | Trained here? | Data (provenance, licence) | Held-out evaluation [training report] | Artefact |
|---|---|---|---|---|
| Symptom triage (22 conditions) | Yes, `ml/train.py` | gretelai/symptom_to_diagnosis (Apache-2.0) + project-written supplement | Public test 95.3 % [re-measured 95.3 %]; project "fresh" test 93.6 % [re-measured 93.6 %], answers 57.3 % of the time, 96.8 % when it answers | `shared/triage-model.json`, 742 KB |
| Intent (10) | Yes, `ml/train_intent.py` | Project-written | See Module 2 | 532 KB |
| Diabetes risk | Yes, `ml/train_lab.py` | Pima/NIDDK (CC0) | LR test AUC 0.808, sensitivity 0.642 | `shared/lab-models.json`, 12 KB |
| Heart risk | Yes | UCI Cleveland (CC BY 4.0) | LR test AUC 0.907, sensitivity 0.829 | 〃 |
| Liver risk | Yes | UCI ILPD (CC BY 4.0) | LR test AUC 0.817, sensitivity 0.683 | 〃 |
| Medicine retrieval | Index built, `ml/build_medicine_index.py` | 11,498 products scraped from 1mg (Kaggle/HF, research dataset) | Name lookup top-1 100 % (on generated misspellings, optimistic); use search P@5 72 % | `models/medicine-index.json` |
| Diet (fibre regressor + K-means) | Yes, `ml/train_diet.py` | 5000 Indian Foods (MIT) | Fibre MAE 0.659 g vs 1.575 g baseline | `server/dietRecommender.ts` data |
| Facility classifier | Yes, `ml/train_facility.py` | OSM India outside NCR (ODbL) + NIN + CGHS/DGEHS | See Module 5 | `shared/facility-model.json`, 676 KB |

| Pipeline aspect | Status |
|---|---|
| Dataset ingestion | Scripts download public data (`ml/fetch_data.py`, data scripts). Raw data is gitignored, so a fresh clone must re-download. |
| Data validation | Minimal (deduplication, label filtering); no schema or validation reports |
| Train/test splits | Seeded and stratified; separate held-out files. **Risk:** the "fresh" and intent test sets are written by the same team, with AI assistance, as the supplements. |
| Model selection | Logistic regression compared with naive Bayes, SVM, RF and GB via 5-fold CV and recorded in the reports |
| Checkpointing / versioning | JSON artefacts in `shared/` with a `version` field; no registry, hashes or lineage |
| Parity tests (TypeScript vs scikit-learn) | Yes, `tests/ai-models.test.ts`, `triage-model.test.ts`, `facility-model.test.ts` |
| Reproducibility | **Verified for the intent model**: retrained in a temp copy, bit-identical terms and coefficients. Others not re-run (would overwrite artefacts; facility needs the 100 MB OSM download). Windows console bug BUG-018. |
| Model cards | Yes, `server/ai/registry.ts`, served at `/api/ai/models` |
| Dataset cards (licence, consent, exclusions) | **Missing** (only a licence column in model cards) |
| Fine-tuning code | None (not applicable to these models) |
| Clinical validation | None |

## Module 7 — AI deployment and operations

| Capability | Status |
|---|---|
| Model serving | In-process in the Express server (JSON weights, TypeScript inference). One process, no separate model service. |
| Health endpoint | Operational (`/api/health` lists model names and versions) |
| Model inventory | Operational (`/api/ai/models`, `/api/v1/models`, `/api/v1/platform/modules`) |
| Latency / abstention monitoring | Operational, in memory only (`server/ai/monitor.ts`, admin `/api/ai/monitoring`). Reset on restart; not exported. |
| Logging | Console logs; message text not logged (0 occurrences in server logs under load). No structured logs, no PHI-redaction framework. |
| Error monitoring / alerting | Not implemented |
| Resource usage tracking | Not implemented (measured externally in this audit) |
| Version management / rollback | Git only; no artefact registry, canary or rollback procedure |
| Rate limiting | AI routes: per user, 300/hour (verified). Others: none. |
| Authentication | Firebase ID tokens on all AI routes (verified) |
| Drift monitoring | Not implemented |
| Deployment config | Dockerfile/Railway; affected by BUG-007 |

## AI efficiency summary [measured-now]

| Endpoint (HTTP, local) | Warm p50 (c=1) | p95 (c=1) | Throughput ceiling | First call after start |
|---|---|---|---|---|
| `/api/v1/nlp/analyze` | 1.3 ms | 2.6 ms | ~2,000 req/s | 6 ms |
| `/api/v1/copilot/chat` | 20.4 ms | 26.4 ms | **~60 req/s** (CPU-bound; ranks all hospitals per call) | 41 ms |
| `/api/symptoms/check` | 19.2 ms | 23.2 ms | ~60 req/s | n/a |
| `/api/v1/documents/extract` (1 KB) | 1.1 ms | 2.0 ms | ~2,000 req/s | n/a |

- **Cold start:** 9.0 s from process spawn to a healthy `/api/health` (includes tsx compile, SQLite init and model loading).
- **Memory:** model artefacts total about 2 MB on disk. Server working set grew from ~213 MB to ~730 MB during load tests (RSS of the evaluation process with all models loaded: 263 MB).
- **Timeouts and errors:** 0 % error rate in all load phases.
- **Tokens and cost:** NOT APPLICABLE (no LLM).
