"""
Train the City Healer intent classifier.

It decides what a message is asking for (symptoms, a lab report, a medicine, a diet, a
doctor, an emergency, a hospital bed, insurance, a greeting, thanks), so the Health Copilot,
the consultation auto-reply and the developer pipeline can hand it to the right model. It
replaces the Gemini call that used to classify the developer pipeline's prompt.

Input : ml/data/intent_train.json  project-written, English / Hindi / romanised Hindi
        ml/data/intent_test.json   held-out, written separately
        ml/data/train.jsonl + supplement_train.json  160 symptom sentences sampled as extra "symptoms" examples
Output: shared/intent-model.json   weights the Node server and the browser load
        ml/intent_report.json      cross-validation and held-out metrics

Same pipeline as the triage model (TF-IDF word 1-2 grams -> logistic regression) and the same
tokeniser, so the TypeScript inference in shared/textClassifier.ts serves both.

Run:  python ml/train_intent.py
"""
import json
import re
import pathlib

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
from sklearn.svm import LinearSVC

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "ml" / "data"
SEED = 42
TOKEN_PATTERN = r"[a-z0-9ऀ-ॣ०-ॿ]{2,}"


def load(name):
    raw = json.loads((DATA / name).read_text(encoding="utf8"))
    texts, labels, langs = [], [], []
    for label, groups in raw.items():
        if label.startswith("_"):
            continue
        for lang, sentences in groups.items():
            for s in sentences:
                texts.append(s); labels.append(label); langs.append(lang)
    return texts, labels, langs


NUMBER = re.compile(r"\d+(?:[.,]\d+)*")


def normalise(text):
    """Every number becomes the token "0num": "ALT 120" and "SGPT 90" then look alike.
    Must match normalise() in shared/textClassifier.ts."""
    return NUMBER.sub(" 0num ", text.lower())


def vectorizer():
    return TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, token_pattern=TOKEN_PATTERN,
                           lowercase=True, preprocessor=normalise)


def triage_symptom_sentences(n=160):
    """Symptom descriptions from the triage training data, as extra examples of "symptoms"."""
    rows = [json.loads(l) for l in (DATA / "train.jsonl").read_text(encoding="utf8").splitlines() if l.strip()]
    texts = [r["input_text"] for r in rows]
    sup = json.loads((DATA / "supplement_train.json").read_text(encoding="utf8"))
    for label, groups in sup.items():
        if not label.startswith("_"):
            for sents in groups.values():
                texts.extend(sents)
    rng = np.random.default_rng(SEED)
    return [texts[i] for i in rng.choice(len(texts), size=min(n, len(texts)), replace=False)]


def main():
    X, y, _ = load("intent_train.json")
    extra = triage_symptom_sentences()
    X, y = X + extra, y + ["symptoms"] * len(extra)
    Xt, yt, lt = load("intent_test.json")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    candidates = {
        "naive_bayes": make_pipeline(vectorizer(), MultinomialNB(alpha=0.3)),
        "logistic_regression": make_pipeline(vectorizer(), LogisticRegression(max_iter=3000, C=20)),
        "linear_svm": make_pipeline(vectorizer(), LinearSVC(C=1.0)),
    }
    report = {"train_sentences": len(X), "test_sentences": len(Xt), "classes": sorted(set(y)), "models": {}}
    for name, model in candidates.items():
        cvs = cross_val_score(model, X, y, cv=cv, scoring="accuracy")
        model.fit(X, y)
        acc = accuracy_score(yt, model.predict(Xt))
        report["models"][name] = {"cv_accuracy": round(float(cvs.mean()), 3), "test_accuracy": round(float(acc), 3)}
        print(f"{name:20s} cv {cvs.mean():.3f}  held-out {acc:.3f}")

    lr = candidates["logistic_regression"]
    pred = lr.predict(Xt)
    by_lang = {}
    for lang in sorted(set(lt)):
        idx = [i for i, l in enumerate(lt) if l == lang]
        by_lang[lang] = round(float(np.mean([pred[i] == yt[i] for i in idx])), 3)
    report["held_out_by_language"] = by_lang
    report["per_class"] = classification_report(yt, pred, output_dict=True, zero_division=0)
    report["errors"] = [{"text": Xt[i], "expected": yt[i], "predicted": pred[i]} for i in range(len(Xt)) if pred[i] != yt[i]]
    print("by language:", by_lang)
    for e in report["errors"]:
        print("  miss:", e)

    vec, clf = lr[0], lr[1]
    terms = [None] * len(vec.vocabulary_)
    for t, i in vec.vocabulary_.items():
        terms[i] = t
    out = {
        "version": 1,
        "kind": "intent",
        "numbers": True,
        "classes": list(clf.classes_),
        "terms": terms,
        "idf": [round(float(v), 6) for v in vec.idf_],
        "coef": [[round(float(v), 5) for v in row] for row in clf.coef_],
        "intercept": [round(float(v), 6) for v in clf.intercept_],
        "parity": [{"text": t, "label": str(p), "confidence": round(float(max(pp)), 6)}
                   for t, p, pp in zip(Xt[:12], lr.predict(Xt[:12]), lr.predict_proba(Xt[:12]))],
    }
    (ROOT / "shared" / "intent-model.json").write_text(json.dumps(out), encoding="utf8")
    (ROOT / "ml" / "intent_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf8")
    print(f"wrote shared/intent-model.json ({len(terms)} terms, {len(out['classes'])} intents)")


if __name__ == "__main__":
    main()
