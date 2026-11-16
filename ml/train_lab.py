"""
Train the lab-report risk models used by the Lab Report Analyzer.

Each model reads values a patient can copy from an ordinary lab report and estimates the
probability of a condition. They replace the Gemini call that used to "interpret" reports.

  diabetes  Pima Indians Diabetes (NIDDK, via UCI; 768 women of Pima heritage, age 21+)
  heart     UCI Heart Disease, Cleveland Clinic subset (303 patients; target = any narrowing)
  liver     UCI Indian Liver Patient Dataset, ILPD (583 patients, Andhra Pradesh)

Input : ml/raw/pima.csv, ml/raw/cleveland.data, ml/raw/ilpd.csv  (downloaded by ml/fetch_data.py)
Output: shared/lab-models.json  scaler + logistic-regression weights the server loads
        ml/lab_report.json      cross-validation and held-out metrics for every model compared

For every dataset three classifiers are compared with stratified 5-fold cross-validation on
the training split (logistic regression, random forest, gradient boosting), then scored once
on a 25% held-out test split. Logistic regression is exported: it is within a few points of
the others on data this small, its probabilities are better calibrated, and each coefficient
times the patient's standardised value says how much that value pushed the risk up or down,
which the UI shows as "what drove this result".

Run:  python ml/train_lab.py
"""
import csv
import json
import pathlib

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score, recall_score, precision_score
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "ml" / "raw"
SEED = 42


def rows(path, skip_header=False):
    with open(path, encoding="utf8") as f:
        data = [r for r in csv.reader(f) if r and any(c.strip() for c in r)]
    return data[1:] if skip_header else data


def num(v):
    v = str(v).strip()
    return float("nan") if v in ("", "?") else float(v)


# Each feature: key used by the API, label and unit shown in the UI, whether a zero in the
# source data means "not measured", and whether to log-transform (for skewed enzyme levels).
def load_diabetes():
    feats = [
        dict(key="glucose", label="Fasting / 2-h glucose", unit="mg/dL", col=1, zero_missing=True),
        dict(key="diastolicBp", label="Diastolic blood pressure", unit="mmHg", col=2, zero_missing=True),
        dict(key="bmi", label="Body-mass index", unit="kg/m²", col=5, zero_missing=True),
        dict(key="age", label="Age", unit="years", col=7, zero_missing=False),
    ]
    X, y = [], []
    for r in rows(RAW / "pima.csv"):
        X.append([num(r[f["col"]]) for f in feats]); y.append(int(r[8]))
    X = np.array(X)
    for j, f in enumerate(feats):
        if f["zero_missing"]:
            X[X[:, j] == 0, j] = np.nan
    return feats, X, np.array(y)


def load_heart():
    feats = [
        dict(key="age", label="Age", unit="years", col=0),
        dict(key="male", label="Male (1) / female (0)", unit="", col=1),
        dict(key="chestPainType", label="Chest pain type (1 typical angina … 4 none)", unit="", col=2),
        dict(key="restingBp", label="Resting systolic blood pressure", unit="mmHg", col=3),
        dict(key="cholesterol", label="Total cholesterol", unit="mg/dL", col=4),
        dict(key="fastingSugarHigh", label="Fasting sugar above 120 mg/dL (1 yes / 0 no)", unit="", col=5),
        dict(key="maxHeartRate", label="Maximum heart rate on exercise test", unit="bpm", col=7),
        dict(key="exerciseAngina", label="Chest pain on exertion (1 yes / 0 no)", unit="", col=8),
    ]
    X, y = [], []
    for r in rows(RAW / "cleveland.data"):
        X.append([num(r[f["col"]]) for f in feats]); y.append(1 if num(r[13]) > 0 else 0)
    return feats, np.array(X), np.array(y)


def load_liver():
    feats = [
        dict(key="age", label="Age", unit="years", col=0),
        dict(key="male", label="Male (1) / female (0)", unit="", col=1),
        dict(key="totalBilirubin", label="Total bilirubin", unit="mg/dL", col=2, log=True),
        dict(key="directBilirubin", label="Direct bilirubin", unit="mg/dL", col=3, log=True),
        dict(key="alkalinePhosphatase", label="Alkaline phosphatase (ALP)", unit="U/L", col=4, log=True),
        dict(key="alt", label="ALT (SGPT)", unit="U/L", col=5, log=True),
        dict(key="ast", label="AST (SGOT)", unit="U/L", col=6, log=True),
        dict(key="totalProtein", label="Total protein", unit="g/dL", col=7),
        dict(key="albumin", label="Albumin", unit="g/dL", col=8),
        dict(key="agRatio", label="Albumin / globulin ratio", unit="", col=9),
    ]
    X, y = [], []
    for r in rows(RAW / "ilpd.csv"):
        vals = []
        for f in feats:
            v = r[f["col"]]
            vals.append(1.0 if v == "Male" else 0.0 if v == "Female" else num(v))
        X.append(vals); y.append(1 if r[10].strip() == "1" else 0)
    return feats, np.array(X), np.array(y)


def prepare(feats, X):
    """Median-impute missing values and log-transform skewed columns. Returns X and medians."""
    X = X.copy()
    medians = []
    for j, f in enumerate(feats):
        col = X[:, j]
        med = float(np.nanmedian(col))
        col[np.isnan(col)] = med
        medians.append(med)
        if f.get("log"):
            X[:, j] = np.log1p(col)
    return X, medians


def evaluate(name, feats, X_raw, y):
    X_tr_raw, X_te_raw, y_tr, y_te = train_test_split(X_raw, y, test_size=0.25, stratify=y, random_state=SEED)
    # Medians come from the training split only, so the test split stays unseen.
    X_tr, medians = prepare(feats, X_tr_raw)
    X_te = X_te_raw.copy()
    for j, f in enumerate(feats):
        X_te[np.isnan(X_te[:, j]), j] = medians[j]
        if f.get("log"):
            X_te[:, j] = np.log1p(X_te[:, j])

    candidates = {
        "logistic_regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=1.0, class_weight="balanced")),
        "random_forest": RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=SEED, class_weight="balanced"),
        "gradient_boosting": GradientBoostingClassifier(random_state=SEED),
    }
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    comparison = {}
    for cname, model in candidates.items():
        s = cross_validate(model, X_tr, y_tr, cv=cv, scoring=["accuracy", "roc_auc"])
        model.fit(X_tr, y_tr)
        p = model.predict_proba(X_te)[:, 1]
        pred = (p >= 0.5).astype(int)
        comparison[cname] = {
            "cv_accuracy": round(float(s["test_accuracy"].mean()), 3),
            "cv_auc": round(float(s["test_roc_auc"].mean()), 3),
            "test_accuracy": round(float(accuracy_score(y_te, pred)), 3),
            "test_auc": round(float(roc_auc_score(y_te, p)), 3),
            "test_sensitivity": round(float(recall_score(y_te, pred)), 3),
            "test_precision": round(float(precision_score(y_te, pred)), 3),
        }

    # Export logistic regression refitted on all the data.
    X_all, medians_all = prepare(feats, X_raw)
    lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=1.0, class_weight="balanced"))
    lr.fit(X_all, y)
    scaler, clf = lr[0], lr[1]
    exported = {
        "features": [
            {
                "key": f["key"], "label": f["label"], "unit": f["unit"], "log": bool(f.get("log")),
                "median": round(medians_all[j], 4),
                "mean": round(float(scaler.mean_[j]), 6), "scale": round(float(scaler.scale_[j]), 6),
                "coef": round(float(clf.coef_[0][j]), 6),
            }
            for j, f in enumerate(feats)
        ],
        "intercept": round(float(clf.intercept_[0]), 6),
        "samples": int(len(y)),
        "positiveRate": round(float(y.mean()), 3),
        "metrics": comparison["logistic_regression"],
    }
    # Parity cases for the TypeScript test: raw inputs and scikit-learn's probability.
    rng = np.random.default_rng(SEED)
    idx = rng.choice(len(y), size=8, replace=False)
    parity = []
    for i in idx:
        raw = {f["key"]: (None if np.isnan(X_raw[i, j]) else float(X_raw[i, j])) for j, f in enumerate(feats)}
        parity.append({"input": raw, "probability": round(float(lr.predict_proba(X_all[i:i + 1])[0, 1]), 6)})
    exported["parity"] = parity
    print(f"{name:9s} n={len(y)}  " + "  ".join(f"{k}: acc {v['test_accuracy']:.3f} auc {v['test_auc']:.3f}" for k, v in comparison.items()))
    return exported, comparison


def main():
    models, report = {}, {}
    for name, loader, source in [
        ("diabetes", load_diabetes, "Pima Indians Diabetes Database (NIDDK / UCI)"),
        ("heart", load_heart, "UCI Heart Disease, Cleveland Clinic Foundation"),
        ("liver", load_liver, "UCI Indian Liver Patient Dataset (ILPD)"),
    ]:
        feats, X, y = loader()
        exported, comparison = evaluate(name, feats, X, y)
        exported["source"] = source
        models[name] = exported
        report[name] = {"source": source, "samples": int(len(y)), "positive_rate": round(float(y.mean()), 3), "models": comparison}

    out = {"version": 1, "algorithm": "standardised features -> logistic regression (class-balanced)", "models": models}
    (ROOT / "shared" / "lab-models.json").write_text(json.dumps(out, indent=1), encoding="utf8")
    (ROOT / "ml" / "lab_report.json").write_text(json.dumps(report, indent=2), encoding="utf8")
    print("wrote shared/lab-models.json and ml/lab_report.json")


if __name__ == "__main__":
    main()
