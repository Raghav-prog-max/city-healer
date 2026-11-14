# Triage model

The symptom-triage classifier that City Healer runs on its own server. No external
AI service is called.

## What it is

| Item | Detail |
| --- | --- |
| Task | Classify a free-text symptom description into one of 22 conditions |
| Languages | English, Hindi (Devanagari) and romanised Hindi |
| Features | TF-IDF over word 1-2 grams, sublinear term frequency, L2 normalised (3,958 features) |
| Classifier | Multinomial logistic regression (scikit-learn) |
| Output | `shared/triage-model.json` (version 2), loaded by `shared/triageModel.ts` |

## Data

| Set | Source | Size | Used for |
| --- | --- | --- | --- |
| Public | [gretelai/symptom_to_diagnosis](https://huggingface.co/datasets/gretelai/symptom_to_diagnosis), Apache-2.0, English | 853 train, 212 test | Training and testing |
| Supplement | Written for this project with AI assistance: everyday English, Hindi, romanised Hindi | 352 (16 per condition) | Training |
| Fresh test | Written for this project with AI assistance, worded differently from the supplement | 110 (5 per condition) | Testing only |

The supplement and fresh test are **not real patient records**. They exist because the
public data is English only and written in one style, and no public Hindi symptom
dataset was found.

## Results

Version 1 was trained on the public data alone; version 2 adds the supplement.

| Test set | Version 1 | Version 2 |
| --- | --- | --- |
| Public test (212, English) | 95.3% | 95.3% |
| Fresh test, all (110) | 22.7% | 93.6% |
| Fresh test, English (44) | 50.0% | 93.2% |
| Fresh test, Hindi (44) | 4.5% | 93.2% |
| Fresh test, romanised Hindi (22) | 4.5% | 95.5% |

Version 1's 95% on the public test hid how poorly it handled wording it had not seen.

The server shows a model answer only when the top probability is at least 0.40. On the
fresh test, version 2 answers 57% of descriptions and is right on 96.8% of those; 1.8%
of all descriptions get a confident wrong answer. The rest go to the safety rules.

Three classifiers were compared with 5-fold cross-validation on all 1,205 training
sentences: Naive Bayes 80.8%, logistic regression 84.1%, linear SVM 84.7%. These are
lower than the test figures because each fold holds out part of the small supplement.
Logistic regression is exported because it gives a probability for each condition.
Full figures are in `ml/report.json`.

## How triage uses it

1. **Safety rules first.** `shared/triage.ts` checks for red-flag wording in English
   and Hindi (chest pain, stroke signs, heavy bleeding, unconsciousness). A match
   returns CRITICAL with the SOS flag and the model is not consulted.
2. **Trained model.** Otherwise the model predicts a condition, from English or Hindi text. If it is confident,
   the patient sees that condition, an urgency level, a specialist and advice.
3. **Rules again.** If the model is not confident, the keyword rules answer, and say
   "not enough detail" when they recognise nothing.

## Limits

- The fresh test was written by the same author as the supplement, so its 93.6% is
  an optimistic estimate. Sentences from real users will score lower.
- The dataset has no emergencies, which is why the safety rules run first.
- Hindi training data is small (about 9 sentences per condition across both scripts)
  and romanised Hindi spelling varies a lot, so unusual spellings will be missed.
- 22 conditions is a narrow range. Anything else is passed to the rules when the
  model is unsure, or occasionally mislabelled with confidence.
- The model has not been clinically validated. It is a triage aid, not a diagnosis.

## Retrain

```bash
python -m pip install -r ml/requirements.txt
python ml/train.py
npm test
```

`npm test` includes a parity check: the TypeScript inference must give the same label
and confidence as scikit-learn on the samples in `ml/parity.json`.
