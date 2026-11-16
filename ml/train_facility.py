"""
Train the facility-name classifier: from a facility's name alone, is it a hospital, a clinic /
doctor's practice, a pharmacy, a dentist or a laboratory?

Why: OpenStreetMap is volunteer-mapped and some places tagged "hospital" are clinics, shops or
labs whose names have no obvious word to catch with a rule ("Sharma Ji", "Gupta & Sons"). The
directory scores every OSM listing with this model; a listing that neither a government list
confirms nor the model thinks is a hospital is shown as "Unconfirmed", ranked lower, and put in
the review queue (npm run review-hospitals), with a link to fix it on openstreetmap.org.

Input
  data/raw/osm/health_facilities.geojson   OSM India health facilities (HDX, ODbL). Labels are
      the mappers' own tags. Rows in Delhi NCR are left out of training entirely, so the model
      never sees the listings it is later asked to judge.
  data/raw/nin/nin_ncr_facilities.json     NIN health facility registry (MoHFW): facility type
  data/processed/empanelment.json          CGHS / DGEHS empanelled lists: hospital / diagnostic / dental
Output
  shared/facility-model.json   weights; inference in shared/textClassifier.ts (shared with triage / intent)
  ml/facility_report.json      held-out metrics (a 20% split of the non-NCR OSM names + official names)

Run:  python ml/train_facility.py
"""
import json
import pathlib
import random
import re
from collections import Counter

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = 42
TOKEN_PATTERN = r"[a-z0-9ऀ-ॣ०-ॿ]{2,}"
NCR_DISTRICTS = re.compile(r"gurgaon|gurugram|faridabad|gautam buddha nagar|ghaziabad", re.I)

OSM_LABEL = {
    ("hospital", None): "hospital", ("hospital", "hospital"): "hospital", (None, "hospital"): "hospital",
    ("clinic", None): "clinic", ("clinic", "clinic"): "clinic", ("doctors", "doctor"): "clinic", ("doctors", None): "clinic",
    ("pharmacy", "pharmacy"): "pharmacy", ("pharmacy", None): "pharmacy",
    ("dentist", None): "dentist", ("dentist", "dentist"): "dentist",
    (None, "laboratory"): "laboratory",
}
NIN_LABEL = {
    "<100 Bedded Hospital": "hospital", "100-500 Bedded Hospital": "hospital", ">500 Bedded Hospital": "hospital",
    "District Hospital": "hospital", "Sub-District Hospital": "hospital", "Civil Hospital/General Hospital": "hospital",
    "Maternity Home": "hospital", "Community Health Center": "hospital",
    "Dispensaries": "clinic", "SubCentre": "clinic", "Primary Health Centre": "clinic", "Urban Health Centre": "clinic",
    "M&CW Center": "clinic", "Urban Health Posts": "clinic",
}
EMPANEL_LABEL = {"hospital": "hospital", "diagnostic": "laboratory", "dental": "dentist"}


def clean_name(s):
    # "(A unit of ...)" asides and the lists' status notes say nothing about the kind of place.
    return re.sub(r"\s+", " ", re.sub(r"\([^)]*(\)|$)", " ", str(s or ""))).strip()


def load():
    rows = []  # (name, label, source)
    geo = json.loads((ROOT / "data/raw/osm/health_facilities.geojson").read_text(encoding="utf8"))
    for f in geo["features"]:
        p = f["properties"]
        label = OSM_LABEL.get((p.get("amenity"), p.get("healthcare")))
        name = p.get("name_en") or p.get("name")
        if not label or not name or not re.search(r"[A-Za-z]", name):
            continue
        if "delhi" in str(p.get("adm1_name", "")).lower() or NCR_DISTRICTS.search(str(p.get("adm2_name", ""))):
            continue
        rows.append((name, label, "osm"))
        # Hindi names too, so a listing named only in Devanagari is not judged on unseen words.
        if p.get("name_hi") and p.get("name_hi") != name:
            rows.append((p["name_hi"], label, "osm"))
    for r in json.loads((ROOT / "data/raw/nin/nin_ncr_facilities.json").read_text(encoding="utf8")):
        label = NIN_LABEL.get(r["facility_type"])
        if label and r.get("health_facility_name"):
            rows.append((r["health_facility_name"], label, "nin"))
    for e in json.loads((ROOT / "data/processed/empanelment.json").read_text(encoding="utf8"))["facilities"]:
        label = EMPANEL_LABEL.get(e["kind"])
        if label:
            rows.append((clean_name(e["name"]), label, "empanelment"))
    # One copy of each (name, label): chains repeat names thousands of times.
    seen, out = set(), []
    for name, label, src in rows:
        key = (name.lower().strip(), label)
        if key not in seen:
            seen.add(key)
            out.append((name, label, src))
    return out


def main():
    rows = load()
    random.Random(SEED).shuffle(rows)
    names = [r[0] for r in rows]
    labels = [r[1] for r in rows]
    print(f"{len(rows)} names:", dict(Counter(labels)), "by source:", dict(Counter(r[2] for r in rows)))

    Xtr, Xte, ytr, yte = train_test_split(names, labels, test_size=0.2, random_state=SEED, stratify=labels)
    pipe = make_pipeline(
        TfidfVectorizer(lowercase=True, token_pattern=TOKEN_PATTERN, ngram_range=(1, 2), sublinear_tf=True, min_df=3, max_features=12000),
        LogisticRegression(max_iter=3000, C=4.0, class_weight="balanced"),
    )
    pipe.fit(Xtr, ytr)
    pred = pipe.predict(Xte)
    acc = accuracy_score(yte, pred)
    print(f"held-out accuracy {acc:.3f}")
    report = {
        "names": len(rows), "train": len(Xtr), "test": len(Xte),
        "labels": dict(Counter(labels)),
        "held_out_accuracy": round(float(acc), 3),
        "per_class": classification_report(yte, pred, output_dict=True, zero_division=0),
        "note": "OSM labels are the mappers' tags and are themselves noisy; the held-out score measures agreement with them.",
    }
    print(classification_report(yte, pred, zero_division=0))

    # Names with no telltale word: how the model splits them is the point of having it.
    probe = ["Sharma Ji", "Gupta and Sons", "Jayprakash Infotech", "Kailash Hospital", "Apollo Pharmacy",
             "Dr Lal PathLabs", "Smile Dental Care", "Dr. Mehta's Clinic", "Saket City", "Fortis Escorts Heart Institute"]
    report["probe"] = {}
    for p, pp in zip(probe, pipe.predict_proba(probe)):
        report["probe"][p] = {c: round(float(v), 3) for c, v in zip(pipe.classes_, pp)}
        print(f"  {p:32s}", {c: round(float(v), 2) for c, v in zip(pipe.classes_, pp)})

    vec, clf = pipe[0], pipe[1]
    terms = [None] * len(vec.vocabulary_)
    for t, i in vec.vocabulary_.items():
        terms[i] = t
    out = {
        "version": 1,
        "kind": "facility",
        "classes": list(clf.classes_),
        "terms": terms,
        "idf": [round(float(v), 6) for v in vec.idf_],
        "coef": [[round(float(v), 4) for v in row] for row in clf.coef_],
        "intercept": [round(float(v), 6) for v in clf.intercept_],
        "parity": [{"text": t, "label": str(p), "confidence": round(float(max(pp)), 6)}
                   for t, p, pp in zip(Xte[:12], pipe.predict(Xte[:12]), pipe.predict_proba(Xte[:12]))],
    }
    (ROOT / "shared" / "facility-model.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf8")
    (ROOT / "ml" / "facility_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf8")
    print(f"wrote shared/facility-model.json ({len(terms)} terms, {len(out['classes'])} classes)")


if __name__ == "__main__":
    main()
