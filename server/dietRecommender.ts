/**
 * Diet planner: a content-based recommender over 2,531 Indian foods with measured nutrition
 * (models/foods.json, built by ml/train_diet.py: cleaned data, fibre completed by a
 * gradient-boosting model, nutrient clusters from K-means).
 *
 * For a condition, every food gets a suitability score from its nutrient density
 * (per 100 kcal: protein, fibre, carbohydrate and fat share, and energy per 100 g), weighted
 * by what the condition calls for. A day's plan then takes, for each meal slot, the best
 * foods of the right kind, keeping the plan varied (no repeated food, no more than two dishes
 * from the same nutrient cluster in a meal). The weights follow ICMR-NIN dietary guidelines
 * for Indians (2024) and the ADA / AHA guidance for diabetes and heart disease; they are
 * stated below, not learned, because no dataset labels foods as good for a condition.
 */
import data from "../models/foods.json";

interface Food {
  id: string; name: string; hi: string; cat: string; veg: boolean;
  kcal: number; p: number; c: number; f: number; fib: number; fibEst: boolean; cl: number;
  serving: { label: string; g: number };
}
const FOODS = (data as any).foods as Food[];
const CLUSTERS = (data as any).clusters as { name: string }[];
export const FOOD_SOURCE: string = (data as any).source;

export type Condition =
  | "diabetes" | "hypertension" | "heart" | "weight_loss" | "weight_gain" | "pcos" | "fatty_liver" | "general";

interface Profile {
  label: string;
  kcal: number;
  /** Weights on standardised nutrient features (positive = prefer more). */
  w: { protein: number; fibre: number; carbShare: number; fatShare: number; density: number };
  avoid: RegExp | null;
  tips: string[];
}

const PROFILES: Record<Condition, Profile> = {
  diabetes: {
    label: "Type 2 diabetes / high blood sugar", kcal: 1600,
    w: { protein: 0.8, fibre: 1.2, carbShare: -1.0, fatShare: -0.3, density: -0.5 },
    avoid: /\b(sweet|halwa|jalebi|gulab|laddu|kheer|payasam|sugar|syrup|cake|juice|soft drink|cola|jaggery|chikki|barfi)\b/i,
    tips: ["Eat at fixed times and do not skip meals", "Fill half the plate with vegetables, a quarter with dal or protein, a quarter with grains", "Walk for 10–15 minutes after each main meal"],
  },
  pcos: {
    label: "PCOS", kcal: 1500,
    w: { protein: 1.0, fibre: 1.0, carbShare: -0.9, fatShare: -0.3, density: -0.6 },
    avoid: /\b(sweet|halwa|jalebi|gulab|laddu|sugar|cake|juice|cola|fried|pakoda|samosa|bhatura|poori)\b/i,
    tips: ["Include protein at every meal to keep blood sugar steady", "Prefer millets and whole grains to refined flour", "Aim for 150 minutes of exercise a week"],
  },
  hypertension: {
    label: "High blood pressure", kcal: 1800,
    w: { protein: 0.4, fibre: 1.0, carbShare: 0, fatShare: -0.8, density: -0.4 },
    avoid: /\b(pickle|achar|papad|chips|namkeen|mixture|bhujia|salted|sev|fried|pakoda|samosa|instant)\b/i,
    tips: ["Keep salt under 5 g a day (one teaspoon), including salt in cooking", "Avoid pickles, papad and packaged snacks: this dataset has no sodium values, so salty foods are excluded by name", "Eat potassium-rich foods such as bananas, coconut water and leafy greens"],
  },
  heart: {
    label: "Heart disease / high cholesterol", kcal: 1800,
    w: { protein: 0.5, fibre: 1.2, carbShare: 0, fatShare: -1.2, density: -0.5 },
    avoid: /\b(ghee|butter|fried|pakoda|samosa|poori|bhatura|malai|cream|mutton|keema|biryani|korma|kebab)\b/i,
    tips: ["Use mustard or groundnut oil in small amounts instead of ghee or vanaspati", "Eat fish twice a week if you are non-vegetarian", "Add oats, flaxseed and walnuts for soluble fibre and omega-3"],
  },
  weight_loss: {
    label: "Weight loss", kcal: 1500,
    w: { protein: 1.2, fibre: 1.0, carbShare: -0.4, fatShare: -0.5, density: -1.2 },
    avoid: /\b(fried|pakoda|samosa|poori|bhatura|sweet|halwa|laddu|cake|juice|cola|biryani|butter|cream)\b/i,
    tips: ["A deficit of about 500 kcal a day loses roughly half a kilo a week", "Start meals with salad or soup", "Sleep 7–8 hours: short sleep increases appetite"],
  },
  weight_gain: {
    label: "Healthy weight gain", kcal: 2600,
    w: { protein: 1.0, fibre: 0, carbShare: 0.3, fatShare: 0.3, density: 1.2 },
    avoid: /\b(cola|soft drink)\b/i,
    tips: ["Eat five to six times a day", "Add nuts, paneer, eggs or dals for protein with the extra calories", "Combine with strength training so the gain is muscle"],
  },
  fatty_liver: {
    label: "Fatty liver", kcal: 1600,
    w: { protein: 0.8, fibre: 1.0, carbShare: -0.6, fatShare: -1.0, density: -0.8 },
    avoid: /\b(fried|ghee|butter|sweet|sugar|juice|cola|cake|halwa|biryani|poori|bhatura|mutton)\b/i,
    tips: ["Avoid alcohol completely", "Cut sugar and sweet drinks: fructose builds liver fat", "Losing 7–10% of body weight reduces liver fat"],
  },
  general: {
    label: "General healthy eating", kcal: 2000,
    w: { protein: 0.6, fibre: 0.8, carbShare: 0, fatShare: -0.4, density: -0.2 },
    avoid: /\b(cola|soft drink)\b/i,
    tips: ["Eat a variety of colours of fruit and vegetables every day", "Drink 2–3 litres of water", "Keep fried food and sweets for occasions"],
  },
};

export const DIET_CONDITIONS = Object.fromEntries(Object.entries(PROFILES).map(([k, v]) => [k, v.label])) as Record<Condition, string>;

/** Map free text ("Diabetes", "BP", "cholesterol", "sugar") to a condition. */
export function parseCondition(text: string): Condition {
  const t = String(text || "").toLowerCase();
  if (/diabet|sugar|madhumeh|शुगर|मधुमेह/.test(t)) return "diabetes";
  if (/pcos|pcod/.test(t)) return "pcos";
  if (/pressure|hypertens|\bbp\b|रक्तचाप/.test(t)) return "hypertension";
  if (/heart|cardio|cholest|lipid|दिल/.test(t)) return "heart";
  if (/liver|fatty/.test(t)) return "fatty_liver";
  if (/gain|underweight|thin/.test(t)) return "weight_gain";
  if (/weight|obes|fat loss|slim|वजन/.test(t)) return "weight_loss";
  return (Object.keys(PROFILES) as Condition[]).includes(t as Condition) ? (t as Condition) : "general";
}

// Standardise the features once over the whole food table.
function features(f: Food) {
  const per100kcal = 100 / Math.max(f.kcal, 1);
  return {
    protein: f.p * per100kcal,
    fibre: f.fib * per100kcal,
    carbShare: (f.c * 4) / Math.max(f.kcal, 1),
    fatShare: (f.f * 9) / Math.max(f.kcal, 1),
    density: f.kcal,
  };
}
const RAW = FOODS.map(features);
const KEYS = ["protein", "fibre", "carbShare", "fatShare", "density"] as const;
const STATS = Object.fromEntries(KEYS.map((k) => {
  const xs = RAW.map((r) => r[k]);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) || 1;
  return [k, { mean, sd }];
})) as Record<(typeof KEYS)[number], { mean: number; sd: number }>;

function suitability(i: number, p: Profile): number {
  let s = 0;
  for (const k of KEYS) s += p.w[k] * Math.max(-3, Math.min(3, (RAW[i][k] - STATS[k].mean) / STATS[k].sd));
  if (CLUSTERS[FOODS[i].cl]?.name === "Rich / fried" && p.w.fatShare < 0) s -= 1;
  return s;
}

function reason(i: number, p: Profile): string {
  const z = Object.fromEntries(KEYS.map((k) => [k, (RAW[i][k] - STATS[k].mean) / STATS[k].sd]));
  const f = FOODS[i];
  const bits: string[] = [];
  if (p.w.fibre > 0 && z.fibre > 0.3) bits.push(`${f.fib} g fibre per 100 g${f.fibEst ? " (estimated)" : ""}`);
  if (p.w.protein > 0 && z.protein > 0.3) bits.push(`${f.p} g protein per 100 g`);
  if (p.w.carbShare < 0 && z.carbShare < -0.3) bits.push("low in carbohydrate");
  if (p.w.fatShare < 0 && z.fatShare < -0.3) bits.push("low in fat");
  if (p.w.density < 0 && z.density < -0.3) bits.push(`only ${f.kcal} kcal per 100 g`);
  if (p.w.density > 0 && z.density > 0.3) bits.push(`energy-dense (${f.kcal} kcal per 100 g)`);
  return bits.slice(0, 2).join(", ") || CLUSTERS[f.cl]?.name.toLowerCase() || "balanced";
}

const BREAKFAST = /\b(idli|dosa|upma|poha|oats|dalia|daliya|paratha|uttapam|cheela|chilla|appam|pesarattu|pongal|sandwich|thepla|besan|ragi|millet|sprouts?|omelette|egg|puttu|idiyappam)\b/i;
const MAIN_GRAIN = /\b(rice|roti|chapati|phulka|khichdi|bajra|jowar|makki|millet|pulao|bhakri|ragi mudde|quinoa)\b/i;
const DRINK_LIGHT = /\b(buttermilk|chaas|lassi|curd|dahi|yogurt|yoghurt|coconut water|green tea|milk|raita|sprouts?)\b/i;

interface Slot { meal: string; share: number; picks: { test: (f: Food) => boolean; n: number }[] }

const SLOTS: Slot[] = [
  { meal: "Breakfast (8:00 am)", share: 0.25, picks: [{ test: (f) => BREAKFAST.test(f.name) && f.cat !== "non-veg" || (BREAKFAST.test(f.name) && /egg|omelette/i.test(f.name)), n: 1 }, { test: (f) => f.cat === "dairy" || f.cat === "fruits", n: 1 }] },
  { meal: "Mid-morning (11:00 am)", share: 0.1, picks: [{ test: (f) => f.cat === "fruits" || DRINK_LIGHT.test(f.name), n: 1 }] },
  { meal: "Lunch (1:30 pm)", share: 0.3, picks: [{ test: (f) => f.cat === "grains" && MAIN_GRAIN.test(f.name), n: 1 }, { test: (f) => f.cat === "dal", n: 1 }, { test: (f) => f.cat === "curry" || f.cat === "non-veg", n: 1 }] },
  { meal: "Evening (5:00 pm)", share: 0.1, picks: [{ test: (f) => f.cat === "snacks" || f.cat === "fruits", n: 1 }] },
  { meal: "Dinner (8:00 pm)", share: 0.25, picks: [{ test: (f) => f.cat === "grains" && MAIN_GRAIN.test(f.name), n: 1 }, { test: (f) => f.cat === "dal" || f.cat === "curry" || f.cat === "non-veg", n: 1 }] },
];

/** Foods of one family (all the soya dishes, all the paneer dishes...) appear once a day. */
const FAMILIES = /soya|sprout|paneer|egg|omelette|chicken|mutton|fish|prawn|rajma|chana|chole|moong|toor|masoor|urad|idli|dosa|rice|roti|chapati|phulka|paratha|poha|upma|oats|dalia|khichdi|sambar|rasam|curd|dahi|lassi|buttermilk|chaas|tofu|peanut/i;
const family = (f: Food) => (f.name.match(FAMILIES)?.[0] || f.id).toLowerCase();

/** Small seeded generator, so "another plan" gives a different but repeatable day. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export interface DietPlan {
  condition: string;
  conditionKey: Condition;
  dietOption: string;
  targetKcal: number;
  totalKcal: number;
  schedule: { meal: string; items: string; benefit: string; kcal: number; foods: { name: string; hindi: string; portion: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; fibre: number; why: string; type: string }[] }[];
  tips: string[];
  energyProfile: string;
  ayurvedicElement: string;
  medicinalTip: string;
  method: string;
  source: string;
}

export function recommendDiet(conditionText: string, preference: string, seed = 1): DietPlan {
  const key = parseCondition(conditionText);
  const p = PROFILES[key];
  const veg = !/non/i.test(String(preference || "veg"));
  const random = rng(seed);
  const scores = FOODS.map((_, i) => suitability(i, p));
  const used = new Set<string>();
  const families = new Set<string>();

  const schedule = SLOTS.map((slot) => {
    const clusterCount = new Map<number, number>();
    const foods: DietPlan["schedule"][number]["foods"] = [];
    for (const pick of slot.picks) {
      const pool = FOODS.map((f, i) => ({ f, i }))
        .filter(({ f }) => (veg ? f.veg : true) && pick.test(f) && !used.has(f.id) && !families.has(family(f)) && !(p.avoid && p.avoid.test(f.name)))
        .filter(({ f }) => (clusterCount.get(f.cl) || 0) < 2)
        .sort((a, b) => scores[b.i] - scores[a.i])
        .slice(0, 8);
      for (let n = 0; n < pick.n && pool.length; n++) {
        // Choose among the best few, so plans vary while staying near the top.
        const k = Math.floor(random() * Math.min(4, pool.length));
        const { f, i } = pool.splice(k, 1)[0];
        used.add(f.id);
        families.add(family(f));
        clusterCount.set(f.cl, (clusterCount.get(f.cl) || 0) + 1);
        const g = f.serving.g || 100;
        foods.push({
          name: f.name, hindi: f.hi, portion: f.serving.label, grams: g, kcal: Math.round((f.kcal * g) / 100),
          protein: +(f.p * g / 100).toFixed(1), carbs: +(f.c * g / 100).toFixed(1), fat: +(f.f * g / 100).toFixed(1), fibre: +(f.fib * g / 100).toFixed(1),
          why: reason(i, p), type: CLUSTERS[f.cl]?.name || "",
        });
      }
    }
    // Scale servings so the meal carries its share of the day's calories (half-serving steps,
    // between half and three servings).
    const base = foods.reduce((a, b) => a + b.kcal, 0) || 1;
    const factor = Math.min(3, Math.max(0.5, Math.round(((slot.share * p.kcal) / base) * 2) / 2));
    for (const f of foods) {
      // Fruit, drinks and curd stay near one serving; grains, dals and curries carry the scaling.
      const light = /fruits|drinks|dairy/.test(FOODS.find((x) => x.name === f.name)?.cat || "");
      const k = light ? Math.min(factor, 1.5) : factor;
      f.portion = k === 1 ? f.portion : `${k} × ${f.portion}`;
      f.kcal = Math.round(f.kcal * k);
      f.protein = +(f.protein * k).toFixed(1); f.carbs = +(f.carbs * k).toFixed(1);
      f.fat = +(f.fat * k).toFixed(1); f.fibre = +(f.fibre * k).toFixed(1);
    }
    const kcal = foods.reduce((a, b) => a + b.kcal, 0);
    return {
      meal: slot.meal,
      items: foods.map((f) => `${f.name} (${f.portion})`).join(" + "),
      benefit: foods.map((f) => `${f.name}: ${f.why}`).join("; "),
      kcal,
      foods,
    };
  });

  const totalKcal = schedule.reduce((a, b) => a + b.kcal, 0);
  return {
    condition: p.label,
    conditionKey: key,
    dietOption: veg ? "Vegetarian" : "Non-vegetarian",
    targetKcal: p.kcal,
    totalKcal,
    schedule,
    tips: p.tips,
    energyProfile: `${totalKcal} kcal a day (target for this condition: about ${p.kcal} kcal)`,
    ayurvedicElement: "",
    medicinalTip: p.tips[0],
    method: "Content-based recommender: foods ranked by nutrient density against the condition's targets, varied across K-means nutrient clusters",
    source: FOOD_SOURCE,
  };
}
