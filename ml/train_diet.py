"""
Build the diet recommender's food model.

Replaces the Gemini call that wrote a diet plan. Plans are now assembled from real foods with
measured nutrition, by shared/dietRecommender.ts, using what this script produces.

Input : ml/raw/indian_foods_5000.json  "5000 Indian Foods Nutrition Dataset"
                                      (Hugging Face thebarbellcrew/indian-food-nutrition-5k, MIT)
Output: models/foods.json             cleaned foods, completed fibre, nutrient cluster per food
        ml/diet_report.json           fibre-model and clustering metrics

Steps
  1. Clean   keep cooked, Indian-style foods; drop raw ingredients and imported meat cuts.
  2. Fibre   only 43% of foods list fibre, and fibre matters for diabetes and heart plans.
             A gradient-boosting regressor predicts it from calories, macros and category;
             it is compared with predicting the category median, on a held-out 20%.
  3. Cluster K-means (k chosen by silhouette score, 4-9) on standardised (calories, protein, carbs, fat, fibre) per 100 g groups
             foods by nutrient profile. The recommender uses the cluster to keep a day's plan
             varied (no three dishes of the same profile) and the UI shows it as the food's type.

Run:  python ml/train_diet.py
"""
import json
import pathlib
import re

import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, silhouette_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "ml" / "raw" / "indian_foods_5000.json"
OUT = ROOT / "models" / "foods.json"
SEED = 42

EXCLUDE = re.compile(
    r"\b(beef|pork|veal|ham|bacon|turkey|lamb|separable|broilers?|by-products|giblets|imported|australian|"
    r"new zealand|raw|uncooked|dry\)|\(dry|powder|frozen|canned|retail|ground \(|choice|prime|select|"
    r"variety meats|cured|sausage|salami|pepperoni|lard|shortening|flour|atta|batter|candies|candy|chocolate|"
    r"peanut butter|toblerone|maple|syrup|amul|ritebite|whole truth|martha|id fresh|mtr|haldiram|bar|dried|oil|mix|"
    r"gizzards?|grains|puffed|alfalfa|epigamia|vitasoy|nasoya|pillsbury|cookies?|biscuits?|almond milk|dehusked)\b|- ?dry\b",
    re.I,
)
# The source mixes Indian dishes with USDA entries (game meats, Alaska Native foods, pork and
# beef cuts), and some of those are tagged "veg". So: drop the foreign ones by name, drop
# USDA-style names ("Kidney Beans (Red, Raw)"), and decide veg / non-veg from the name.
FOREIGN = re.compile(
    r"turkey|emu|elk|bison|quail|ostrich|venison|caribou|walrus|\bseal\b|whale|moose|deer|rabbit|squid|octopus|"
    r"mollus|conch|clam|oyster|lobster|beef|pork|veal|salami|alaska|restaurant|halibut|tonkatsu|pastrami|game meat|"
    r"meat extender|parmigiano|gouda|brie|gruyere|roquefort|noodles \(enriched|katsu|bratwurst|frankfurter|"
    r"mcdonald|breyers|burger king|kfc|subway|tortilla|nacho|nugget|tempura|surimi|cheddar|limburger|goat cheese|"
    r"fast food|pasta|rye bread|myfitness|ice cream|pizza|hot dog|bagel|muffin|waffle|pancake|doughnut", re.I)
USDA_STYLE = re.compile(r"\([^)]*,[^)]*\)")
MEAT = re.compile(r"meat|chicken|fish|prawn|shrimp|mutton|goat|lamb|\begg(?!plant)|omelette|keema|crab|mackerel|sardine|"
                  r"pomfret|rohu|surmai|bangda|salmon|tuna|kebab|liver\b|duck", re.I)

# What finally decides "this is an Indian dish": its name uses Indian food vocabulary, or it
# is a fruit or vegetable commonly eaten in India. Checked by reading a sample of the output.
INDIAN = re.compile(
    r"\b(dosa|idli|idly|roti|chapati|phulka|paratha|parantha|thepla|bhakri|naan|kulcha|puri|poori|bhatura|dal|daal|"
    r"sabzi|sabji|subzi|bhaji|paneer|chana|chole|rajma|lobia|moong|mung|toor|tur|masoor|urad|besan|ragi|jowar|bajra|"
    r"millet|makhana|chai|dahi|curd|buttermilk|chaas|lassi|raita|kadhi|sambar|rasam|upma|poha|khichdi|pulao|pulav|"
    r"biryani|tikka|tandoori|kebab|kabab|keema|korma|masala|curry|sukka|chettinad|pulusu|thoran|avial|kootu|poriyal|"
    r"appam|puttu|idiyappam|pongal|uttapam|pesarattu|dhokla|khandvi|cheela|chilla|halwa|kheer|payasam|ladoo|laddu|"
    r"palak|aloo|gobi|bhindi|okra|brinjal|baingan|lauki|tinda|karela|methi|saag|sprouts?|sprouted|soya|poriyal|vada|"
    r"bonda|pakoda|pakora|samosa|chutney|kofta|do pyaza|kadai|kadhai|makhani|bhurji|egg curry|fish fry|fish curry|"
    r"prawn|machli|meen|mutton|chicken|egg|omelette|amla|guava|papaya|banana|mango|apple|orange|mosambi|sweet lime|"
    r"pomegranate|watermelon|musk ?melon|chikoo|sapota|jamun|grapes|pineapple|pear|cucumber|spinach|salad|"
    r"coconut water|green tea|peanuts?|groundnut|almonds?|badam|walnuts?|akhrot|chana dal|sattu|dalia|daliya|oats)\b",
    re.I)

CATEGORIES = ["grains", "dal", "curry", "dairy", "snacks", "fruits", "non-veg", "drinks", "desserts"]


def main():
    foods = json.loads(RAW.read_text(encoding="utf8"))
    kept = []
    for f in foods:
        # Supplements (protein isolates, psyllium husk) are not meals.
        name = f["name"]
        if (EXCLUDE.search(name) or FOREIGN.search(name) or USDA_STYLE.search(name)
                or f["calories"] <= 0 or f["protein"] > 50 or (f.get("fiber") or 0) > 30):
            continue
        if not INDIAN.search(name):
            continue
        if MEAT.search(name):
            f["diet"] = "non-veg"
        elif f["category"] == "non-veg":
            continue  # tagged non-veg but names no meat or fish we recognise
        kept.append(f)
    print(f"foods: {len(foods)} -> {len(kept)} after cleaning")

    def row(f):
        cat = [1.0 if f["category"] == c else 0.0 for c in CATEGORIES]
        return [f["calories"], f["protein"], f["carbs"], f["fat"], 1.0 if f["diet"] == "veg" else 0.0] + cat

    have = [f for f in kept if isinstance(f.get("fiber"), (int, float))]
    missing = [f for f in kept if not isinstance(f.get("fiber"), (int, float))]
    X = np.array([row(f) for f in have]); y = np.array([f["fiber"] for f in have], dtype=float)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=SEED)
    gbr = GradientBoostingRegressor(random_state=SEED, n_estimators=300, max_depth=3, learning_rate=0.05).fit(X_tr, y_tr)
    mae_model = mean_absolute_error(y_te, gbr.predict(X_te))
    # Baseline: the median fibre of the food's category in the training split.
    cat_idx = {c: 5 + i for i, c in enumerate(CATEGORIES)}
    med = {c: float(np.median(y_tr[X_tr[:, cat_idx[c]] == 1])) if (X_tr[:, cat_idx[c]] == 1).any() else float(np.median(y_tr)) for c in CATEGORIES}
    base = [med[CATEGORIES[int(np.argmax(x[5:]))]] for x in X_te]
    mae_base = mean_absolute_error(y_te, base)
    print(f"fibre MAE: model {mae_model:.2f} g  vs category median {mae_base:.2f} g  (n_test={len(y_te)})")
    gbr.fit(X, y)
    for f in missing:
        f["fiber"] = round(max(0.0, float(gbr.predict(np.array([row(f)]))[0])), 1)
        f["fiberEstimated"] = True

    nutr = np.array([[f["calories"], f["protein"], f["carbs"], f["fat"], f["fiber"]] for f in kept], dtype=float)
    Z = StandardScaler().fit_transform(nutr)
    scores = {}
    for k in range(4, 10):
        km = KMeans(n_clusters=k, n_init=10, random_state=SEED).fit(Z)
        scores[k] = float(silhouette_score(Z, km.labels_, sample_size=2000, random_state=SEED))
    k_best = max(scores, key=scores.get)
    km = KMeans(n_clusters=k_best, n_init=10, random_state=SEED).fit(Z)
    centres = []
    for c in range(k_best):
        m = nutr[km.labels_ == c].mean(axis=0)
        centres.append({"calories": round(m[0]), "protein": round(m[1], 1), "carbs": round(m[2], 1), "fat": round(m[3], 1), "fiber": round(m[4], 1),
                        "size": int((km.labels_ == c).sum())})

    def name_cluster(c):
        if c["fat"] >= 15 and c["calories"] >= 280: return "Rich / fried"
        if c["fiber"] >= 10: return "Pulses / high fibre"
        if c["protein"] >= 15: return "Protein-rich"
        if c["carbs"] >= 40: return "Starchy / grains"
        if c["fiber"] >= 5: return "High fibre"
        if c["calories"] <= 90: return "Light / low calorie"
        return "Balanced"

    names = [name_cluster(c) for c in centres]
    # Two clusters can earn the same name; tell them apart by their dominant nutrient.
    for i, n in enumerate(names):
        if names.count(n) > 1:
            names[i] = f"{n} ({'higher' if centres[i]['calories'] > np.mean([c['calories'] for c in centres]) else 'lower'} calorie)"
    for i, c in enumerate(centres):
        c["name"] = names[i]
        print(f"  cluster {i}: {names[i]:28s} {c}")

    out_foods = []
    for f, label in zip(kept, km.labels_):
        serving = (f.get("servings") or [{}])[0]
        out_foods.append({
            "id": f["id"], "name": f["name"], "hi": f.get("hindiName") or "", "cat": f["category"], "veg": f["diet"] == "veg",
            "kcal": f["calories"], "p": f["protein"], "c": f["carbs"], "f": f["fat"], "fib": f["fiber"],
            "fibEst": bool(f.get("fiberEstimated")), "cl": int(label),
            "serving": {"label": serving.get("label", "100 g"), "g": serving.get("amount", 100)},
        })

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({
        "version": 1,
        "source": "5000 Indian Foods Nutrition Dataset (Hugging Face thebarbellcrew/indian-food-nutrition-5k, MIT licence)",
        "clusters": centres, "foods": out_foods,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    (ROOT / "ml" / "diet_report.json").write_text(json.dumps({
        "foods_raw": len(foods), "foods_kept": len(kept), "fibre_measured": len(have), "fibre_predicted": len(missing),
        "fibre_model": {"algorithm": "gradient boosting regressor", "test_mae_g": round(mae_model, 3), "baseline_category_median_mae_g": round(mae_base, 3)},
        "kmeans": {"k": k_best, "silhouette_by_k": {str(k): round(v, 3) for k, v in scores.items()}, "clusters": centres},
    }, indent=2), encoding="utf8")
    print(f"silhouette by k: { {k: round(v, 3) for k, v in scores.items()} }")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
