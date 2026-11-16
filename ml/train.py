"""
Train the City Healer symptom-triage classifier.

Input : ml/data/train.jsonl, ml/data/test.jsonl   gretelai/symptom_to_diagnosis (Apache-2.0), English
        ml/data/supplement_train.json            project-written everyday English, Hindi, romanised Hindi
        ml/data/fresh_test.json                  project-written held-out test in the same three forms
Output: shared/triage-model.json   weights the Node server loads; no Python at runtime
        ml/report.json             cross-validation and held-out test metrics
        ml/parity.json             sample predictions, used by the TypeScript parity test

Pipeline: TF-IDF (word 1-2 grams, sublinear tf, L2 norm) -> multinomial logistic regression.
Three classifiers are compared with 5-fold cross-validation; logistic regression is exported
because it gives probabilities, which the server needs to decide when to trust the model and
when to fall back to the safety rules.

Two models are trained so the effect of the supplementary data is measured, not assumed:
  baseline  public dataset only
  final     public dataset + supplementary sentences   (exported)

Run:  python ml/train.py
"""
import json
import pathlib

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
from sklearn.svm import LinearSVC

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "ml" / "data"
SEED = 42
THRESHOLD = 0.4

# Latin letters, digits and Devanagari (excluding the danda punctuation marks). The default
# scikit-learn pattern splits Hindi words at every vowel sign, so it is replaced. The same
# expression is used by shared/triageModel.ts.
TOKEN_PATTERN = r"[a-z0-9ऀ-ॣ०-ॿ]{2,}"


def load_jsonl(name):
    rows = [json.loads(line) for line in (DATA / name).read_text(encoding="utf8").splitlines() if line.strip()]
    return [r["input_text"] for r in rows], [r["output_text"] for r in rows]


def load_grouped(name):
    """{label: {en: [...], hi: [...], hing: [...]}} -> texts, labels, language tags"""
    raw = json.loads((DATA / name).read_text(encoding="utf8"))
    texts, labels, langs = [], [], []
    for label, groups in raw.items():
        if label.startswith("_"):
            continue
        for lang, sentences in groups.items():
            for s in sentences:
                texts.append(s); labels.append(label); langs.append(lang)
    return texts, labels, langs


def vectorizer():
    return TfidfVectorizer(lowercase=True, token_pattern=TOKEN_PATTERN, ngram_range=(1, 2), min_df=2, max_features=6000, sublinear_tf=True)


def classifier():
    return LogisticRegression(C=10, max_iter=3000, random_state=SEED)


def fit(x, y):
    vec = vectorizer()
    clf = classifier()
    clf.fit(vec.fit_transform(x), y)
    return vec, clf


def evaluate(vec, clf, x, y):
    proba = clf.predict_proba(vec.transform(x))
    pred = clf.classes_[proba.argmax(axis=1)]
    conf = proba.max(axis=1)
    y = np.array(y)
    answered = conf >= THRESHOLD
    return {
        "samples": len(y),
        "accuracy": round(float(accuracy_score(y, pred)), 4),
        "macro_f1": round(float(f1_score(y, pred, average="macro")), 4),
        # What the patient experiences: the model only answers above the threshold.
        "answered_share": round(float(answered.mean()), 4),
        "accuracy_when_answered": round(float(accuracy_score(y[answered], pred[answered])), 4) if answered.any() else None,
        "confidently_wrong_share": round(float((answered & (pred != y)).mean()), 4),
    }, pred, conf


def main():
    x_pub, y_pub = load_jsonl("train.jsonl")
    x_test, y_test = load_jsonl("test.jsonl")
    x_sup, y_sup, _ = load_grouped("supplement_train.json")
    x_fresh, y_fresh, l_fresh = load_grouped("fresh_test.json")
    x_all, y_all = x_pub + x_sup, y_pub + y_sup

    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    comparison = {}
    for name, clf in {"naive_bayes": MultinomialNB(alpha=0.1), "logistic_regression": classifier(), "linear_svm": LinearSVC(C=1, random_state=SEED)}.items():
        scores = cross_val_score(make_pipeline(vectorizer(), clf), x_all, y_all, cv=folds, scoring="accuracy")
        comparison[name] = {"cv_accuracy_mean": round(float(scores.mean()), 4), "cv_accuracy_std": round(float(scores.std()), 4)}
        print(f"{name:20s} 5-fold CV accuracy {scores.mean():.4f} +/- {scores.std():.4f}")

    models = {"baseline_public_only": fit(x_pub, y_pub), "final_public_plus_supplement": fit(x_all, y_all)}
    fresh = np.array(l_fresh)
    results = {}
    for name, (vec, clf) in models.items():
        r = {"public_test": evaluate(vec, clf, x_test, y_test)[0], "fresh_test_all": evaluate(vec, clf, x_fresh, y_fresh)[0]}
        for lang, title in (("en", "fresh_test_english"), ("hi", "fresh_test_hindi"), ("hing", "fresh_test_romanised_hindi")):
            keep = fresh == lang
            r[title] = evaluate(vec, clf, list(np.array(x_fresh)[keep]), list(np.array(y_fresh)[keep]))[0]
        results[name] = r
        print(f"\n{name}")
        for k, v in r.items():
            print(f"  {k:28s} n={v['samples']:3d}  accuracy {v['accuracy']:.3f}  answered {v['answered_share']:.2f}  right when answered {v['accuracy_when_answered']}  confidently wrong {v['confidently_wrong_share']:.3f}")

    vec, clf = models["final_public_plus_supplement"]
    _, pred, conf = evaluate(vec, clf, x_test, y_test)
    report = {
        "datasets": {
            "public": "gretelai/symptom_to_diagnosis (Apache-2.0), English",
            "supplement": "project-written everyday English, Hindi and romanised Hindi sentences (not patient records)",
            "fresh_test": "project-written held-out sentences in the same three forms, never used in training",
        },
        "train_samples": {"public": len(y_pub), "supplement": len(y_sup), "total": len(y_all)},
        "classes": len(clf.classes_),
        "features": len(vec.vocabulary_),
        "confidence_threshold": THRESHOLD,
        "model_comparison_5fold_cv": comparison,
        "exported_model": "final_public_plus_supplement (logistic regression)",
        "results": results,
        "per_class_public_test": classification_report(y_test, pred, output_dict=True, zero_division=0),
        "confusion_matrix_public_test": {"labels": list(clf.classes_), "matrix": confusion_matrix(y_test, pred, labels=clf.classes_).tolist()},
    }
    (ROOT / "ml" / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf8")

    terms = sorted(vec.vocabulary_, key=vec.vocabulary_.get)
    final = results["final_public_plus_supplement"]
    model = {
        "version": 2,
        "kind": "tfidf-logistic-regression",
        "trainedOn": "gretelai/symptom_to_diagnosis + project supplement (English, Hindi, romanised Hindi)",
        "trainSamples": len(y_all),
        "publicTestAccuracy": final["public_test"]["accuracy"],
        "freshTestAccuracy": final["fresh_test_all"]["accuracy"],
        "ngramRange": [1, 2],
        "sublinearTf": True,
        "classes": list(clf.classes_),
        "terms": terms,
        "idf": [round(float(v), 5) for v in vec.idf_],
        "intercept": [round(float(v), 5) for v in clf.intercept_],
        "coef": [[round(float(v), 4) for v in row] for row in clf.coef_],
    }
    out = ROOT / "shared" / "triage-model.json"
    out.write_text(json.dumps(model, separators=(",", ":"), ensure_ascii=False), encoding="utf8")
    print(f"\nWrote {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB, {len(terms)} features)")

    proba = clf.predict_proba(vec.transform(x_fresh))
    parity = [{"text": x_test[i], "label": str(pred[i]), "confidence": round(float(conf[i]), 4)} for i in range(0, len(x_test), 11)]
    parity += [{"text": x_fresh[i], "label": str(clf.classes_[proba[i].argmax()]), "confidence": round(float(proba[i].max()), 4)} for i in range(0, len(x_fresh), 4)]
    (ROOT / "ml" / "parity.json").write_text(json.dumps(parity, indent=1, ensure_ascii=False), encoding="utf8")


if __name__ == "__main__":
    main()
