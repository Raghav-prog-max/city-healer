"""
Build the medicine retrieval model behind the Medicine Guide and medicine search.

Replaces the Gemini calls that wrote a "guide" for any medicine name and widened catalogue
searches. Every answer now comes from a real record in an 11,825-row catalogue of medicines
sold in India (name, composition, uses, side effects, manufacturer, user-review shares).

Input : ml/raw/medicine_details.csv  "Medicine_Details" (Hugging Face: MattBastar/Medicine_Details,
                                     originally the Kaggle "11000 Medicine details" set, scraped from 1mg)
Output: models/medicine-index.json   records + two fitted TF-IDF vocabularies (server loads it)
        ml/medicine_report.json      retrieval evaluation

Two vector spaces, both TF-IDF with cosine similarity:
  name space  character 3-grams of the medicine name (and of each ingredient name), so "paracetmol" or "azithral 500" still
              finds the right product (spelling-tolerant lookup)
  use space   word 1-2 grams of the uses and composition, so "medicine for acidity" finds
              pantoprazole and rabeprazole products (semantic-ish search by indication)
Substitutes are products with the same composition (ingredients and strengths), ranked by
the share of excellent reviews.

Evaluation: name lookup with misspelt queries (top-1 accuracy) and use search with labelled
queries (precision@5: share of the top five whose composition contains an expected ingredient).

Run:  python ml/build_medicine_index.py
"""
import csv
import json
import pathlib
import re

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "ml" / "raw" / "medicine_details.csv"
OUT = ROOT / "models" / "medicine-index.json"

# Uses and side effects are run together in the source ("Pain relief Treatment of Fever").
# A new item starts at a capital letter that follows a lower-case letter or a closing bracket.
SPLIT = re.compile(r"(?<=[a-z\)])\s+(?=[A-Z])")


CONNECTORS = {"of", "and", "in", "due", "to", "with", "from", "for", "the", "or", "on", "by", "a", "an", "after", "during", "caused"}


def split_items(text):
    """"Pain reliefTreatment of Fever" -> ["Pain relief", "Treatment of Fever"]. A capitalised
    word starts a new item unless the word before it links the two ("Treatment of Fever")."""
    text = re.sub(r"([a-z\)])([A-Z])", r"\1 \2", (text or "").strip())
    words = re.sub(r"\s+", " ", text).split(" ") if text.strip() else []
    items, cur = [], []
    for w in words:
        if cur and w[:1].isupper() and cur[-1].lower() not in CONNECTORS:
            items.append(" ".join(cur)); cur = []
        cur.append(w)
    if cur:
        items.append(" ".join(cur))
    return items


def name_key(name):
    return re.sub(r"\s+", " ", name.lower()).strip()


def char_trigrams_vectorizer():
    # analyzer="char_wb" pads each word with spaces; shared/medicineIndex.ts does the same.
    return TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 3), lowercase=True, sublinear_tf=True, min_df=2)


def use_vectorizer():
    return TfidfVectorizer(ngram_range=(1, 2), lowercase=True, sublinear_tf=True, min_df=2,
                           token_pattern=r"[a-z0-9]+", stop_words="english")


def main():
    seen, records = set(), []
    with open(RAW, encoding="utf8") as f:
        for r in csv.DictReader(f):
            name = re.sub(r"\s+", " ", r["Medicine Name"]).strip()
            if not name or name_key(name) in seen:
                continue
            seen.add(name_key(name))
            records.append({
                "name": name,
                "composition": re.sub(r"\s+", " ", r["Composition"]).strip(),
                "uses": split_items(r["Uses"]),
                "sideEffects": split_items(r["Side_effects"]),
                "manufacturer": r["Manufacturer"].strip(),
                "reviews": [int(r["Excellent Review %"] or 0), int(r["Average Review %"] or 0), int(r["Poor Review %"] or 0)],
            })

    # Ingredient names are looked up too, so "paracetamol" finds paracetamol products even
    # though no product is called that. They are appended after the products.
    ingredients = sorted({re.sub(r"\s*\(.*?\)", "", part).strip().lower()
                          for r in records for part in r["composition"].split("+") if part.strip()})
    names = [r["name"] for r in records]
    lookup_docs = names + ingredients
    use_docs = [" ".join(r["uses"]) + " " + re.sub(r"[\d.]+\s*(mg|mcg|g|ml|iu|%)", " ", r["composition"].lower()) for r in records]

    name_vec = char_trigrams_vectorizer().fit(lookup_docs)
    use_vec = use_vectorizer().fit(use_docs)
    N = name_vec.transform(lookup_docs)
    U = use_vec.transform(use_docs)

    # ---- evaluation ----
    def lookup(q):
        return int(np.argmax(linear_kernel(name_vec.transform([q]), N)[0]))

    lookup_cases = [  # misspelt / partial query -> word the right product's name starts with
        ("dolo 650", "dolo"), ("crocin advanc", "crocin"), ("paracetmol", "ingredient:paracetamol"), ("metfromin", "ingredient:metformin"), ("azithral 500", "azithral"),
        ("azee 500", "azee"), ("pan 40", "pan"), ("montair lc", "montair"), ("telma 40", "telma"),
        ("augmentin 625", "augmentin"), ("allegra 120", "allegra"), ("thyronorm 50", "thyronorm"), ("glycomet 500", "glycomet"),
        ("atorva 10", "atorva"), ("amlong 5", "amlong"), ("ecosprin 75", "ecosprin"), ("razo 20", "razo"),
        ("meftal spas", "meftal"), ("ondem 4", "ondem"), ("sinarest", "sinarest"), ("zifi 200", "zifi"),
    ]
    lookup_results = []
    for q, expect in lookup_cases:
        i = lookup(q)
        got = names[i] if i < len(names) else "ingredient:" + ingredients[i - len(names)]
        lookup_results.append({"query": q, "found": got, "ok": got.lower().startswith(expect)})

    search_cases = [  # query -> ingredients that count as relevant
        ("medicine for acidity", ["pantoprazole", "rabeprazole", "omeprazole", "esomeprazole", "ranitidine", "famotidine", "antacid", "magaldrate", "sodium alginate"]),
        ("fever and pain relief", ["paracetamol", "ibuprofen", "aceclofenac", "diclofenac", "nimesulide", "mefenamic"]),
        ("high blood pressure", ["telmisartan", "amlodipine", "losartan", "olmesartan", "metoprolol", "cilnidipine", "ramipril", "chlorthalidone", "hydrochlorothiazide", "bisoprolol", "nebivolol", "valsartan"]),
        ("type 2 diabetes", ["metformin", "glimepiride", "vildagliptin", "sitagliptin", "teneligliptin", "dapagliflozin", "empagliflozin", "gliclazide", "voglibose", "pioglitazone", "linagliptin", "insulin", "remogliflozin"]),
        ("allergy sneezing runny nose", ["cetirizine", "levocetirizine", "fexofenadine", "montelukast", "bilastine", "desloratadine", "olopatadine", "chlorpheniramine", "azelastine", "fluticasone", "ebastine", "rupatadine", "phenylephrine"]),
        ("bacterial infection", ["amoxycillin", "amoxicillin", "azithromycin", "cefixime", "cefpodoxime", "ofloxacin", "ciprofloxacin", "levofloxacin", "doxycycline", "clarithromycin", "cefuroxime", "linezolid", "ceftriaxone", "faropenem", "clavulanic", "cefdinir", "moxifloxacin",
            "ceftazidime", "netilmicin", "gentamicin", "amikacin", "cefoperazone", "piperacillin", "meropenem", "cefotaxime", "cephalexin", "cefadroxil", "norfloxacin", "nitrofurantoin", "sulbactam", "tazobactam", "vancomycin", "erythromycin", "roxithromycin", "cefprozil", "ampicillin", "cloxacillin"]),
        ("high cholesterol", ["atorvastatin", "rosuvastatin", "fenofibrate", "ezetimibe", "simvastatin", "pitavastatin", "gemfibrozil", "saroglitazar", "omega"]),
        ("asthma", ["salbutamol", "levosalbutamol", "budesonide", "formoterol", "montelukast", "salmeterol", "fluticasone", "doxofylline", "theophylline", "ipratropium", "tiotropium", "glycopyrronium", "beclometasone", "acebrophylline"]),
        ("fungal infection of skin", ["clotrimazole", "luliconazole", "terbinafine", "itraconazole", "ketoconazole", "fluconazole", "sertaconazole", "amorolfine", "miconazole", "eberconazole"]),
        ("vitamin d deficiency", ["cholecalciferol", "vitamin d3", "calcitriol", "ergocalciferol", "alfacalcidol"]),
    ]
    search_results = []
    for q, good in search_cases:
        top = np.argsort(-linear_kernel(use_vec.transform([q]), U)[0])[:5]
        hits = [records[i]["composition"].lower() for i in top]
        rel = [any(g in h for g in good) for h in hits]
        search_results.append({"query": q, "precision_at_5": sum(rel) / 5, "top": [records[i]["name"] for i in top]})

    lookup_acc = float(np.mean([r["ok"] for r in lookup_results]))
    p5 = float(np.mean([r["precision_at_5"] for r in search_results]))
    print(f"records {len(records)}  name lookup top-1 {lookup_acc:.3f}  use search P@5 {p5:.3f}")
    for r in lookup_results:
        if not r["ok"]:
            print("  lookup miss:", r)
    for r in search_results:
        print(f"  P@5 {r['precision_at_5']:.1f}  {r['query']}: {r['top'][:3]}")

    def vocab(vec):
        terms = [None] * len(vec.vocabulary_)
        for t, i in vec.vocabulary_.items():
            terms[i] = t
        return {"terms": terms, "idf": [round(float(v), 5) for v in vec.idf_]}

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({
        "version": 1,
        "source": "Medicine_Details (Hugging Face MattBastar/Medicine_Details; Kaggle '11000 Medicine details', scraped from 1mg)",
        "nameSpace": {**vocab(name_vec), "analyzer": "char_wb", "n": 3},
        "useSpace": {**vocab(use_vec), "analyzer": "word", "ngram": [1, 2]},
        "ingredients": ingredients,
        "records": records,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    (ROOT / "ml" / "medicine_report.json").write_text(json.dumps({
        "records": len(records), "name_lookup_top1": round(lookup_acc, 3), "use_search_precision_at_5": round(p5, 3),
        "lookup": lookup_results, "search": search_results,
    }, indent=2, ensure_ascii=False), encoding="utf8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
