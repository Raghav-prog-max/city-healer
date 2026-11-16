/**
 * Medicine retrieval model (built by ml/build_medicine_index.py) over 11,498 medicines sold
 * in India. Two TF-IDF spaces with cosine similarity:
 *
 *   name space  character 3-grams of product and ingredient names: spelling-tolerant lookup
 *   use space   words and word pairs of each product's uses and ingredients: search by need
 *
 * The vocabularies and IDF weights are the ones fitted in Python; the document vectors are
 * rebuilt here once, at first use. Server-only: the index is 4 MB.
 */
import index from "../models/medicine-index.json";

interface MedicineRecord {
  name: string;
  composition: string;
  uses: string[];
  sideEffects: string[];
  manufacturer: string;
  reviews: [number, number, number];
}

type Sparse = Map<number, number>;

const records = (index as any).records as MedicineRecord[];
const ingredients = (index as any).ingredients as string[];
const nameSpace = (index as any).nameSpace as { terms: string[]; idf: number[] };
const useSpace = (index as any).useSpace as { terms: string[]; idf: number[] };
export const MEDICINE_SOURCE: string = (index as any).source;
export const MEDICINE_COUNT = records.length;

// scikit-learn's English stop-word list, as used when the use space was fitted.
const STOP = new Set(("a about above across after afterwards again against all almost alone along already also although always am among amongst amoungst amount an and another any anyhow anyone anything anyway anywhere are around as at back be became because become becomes becoming been before beforehand behind being below beside besides between beyond bill both bottom but by call can cannot cant co con could couldnt cry de describe detail do done down due during each eg eight either eleven else elsewhere empty enough etc even ever every everyone everything everywhere except few fifteen fifty fill find fire first five for former formerly forty found four from front full further get give go had has hasnt have he hence her here hereafter hereby herein hereupon hers herself him himself his how however hundred i ie if in inc indeed interest into is it its itself keep last latter latterly least less ltd made many may me meanwhile might mill mine more moreover most mostly move much must my myself name namely neither never nevertheless next nine no nobody none noone nor not nothing now nowhere of off often on once one only onto or other others otherwise our ours ourselves out over own part per perhaps please put rather re same see seem seemed seeming seems serious several she should show side since sincere six sixty so some somehow someone something sometime sometimes somewhere still such system take ten than that the their them themselves then thence there thereafter thereby therefore therein thereupon these they thick thin third this those though three through throughout to together too top toward towards twelve twenty two un under until up upon us very via was we well were what whatever when whence whenever where whereafter whereas whereby wherein whereupon wherever whether which while whither who whoever whole whom whose why will with within without would yet you your yours yourself yourselves").split(" "));

const nameIdx = new Map(nameSpace.terms.map((t, i) => [t, i]));
const useIdx = new Map(useSpace.terms.map((t, i) => [t, i]));

/** char_wb 3-grams: each word padded with one space either side. */
function charGrams(text: string): string[] {
  const grams: string[] = [];
  for (const w of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    const p = ` ${w} `;
    if (p.length < 3) continue;
    for (let i = 0; i + 3 <= p.length; i++) grams.push(p.slice(i, i + 3));
  }
  return grams;
}

function wordGrams(text: string): string[] {
  const toks = (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => !STOP.has(t));
  const out = [...toks];
  for (let i = 0; i + 1 < toks.length; i++) out.push(`${toks[i]} ${toks[i + 1]}`);
  return out;
}

function vectorise(grams: string[], vocab: Map<string, number>, idf: number[]): Sparse {
  const tf = new Map<number, number>();
  for (const g of grams) {
    const i = vocab.get(g);
    if (i !== undefined) tf.set(i, (tf.get(i) || 0) + 1);
  }
  const v: Sparse = new Map();
  let norm = 0;
  for (const [i, c] of tf) {
    const w = (1 + Math.log(c)) * idf[i];
    v.set(i, w);
    norm += w * w;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [i, w] of v) v.set(i, w / norm);
  return v;
}

function cosine(a: Sparse, b: Sparse): number {
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [i, w] of small) {
    const o = big.get(i);
    if (o !== undefined) s += w * o;
  }
  return s;
}

const stripStrengths = (c: string) => c.toLowerCase().replace(/[\d.]+\s*(mg|mcg|g|ml|iu|%)/g, " ");

let nameVectors: Sparse[] | null = null;
let useVectors: Sparse[] | null = null;
let byComposition: Map<string, number[]> | null = null;

function build() {
  if (nameVectors) return;
  const docs = [...records.map((r) => r.name), ...ingredients];
  nameVectors = docs.map((d) => vectorise(charGrams(d), nameIdx, nameSpace.idf));
  useVectors = records.map((r) => vectorise(wordGrams(r.uses.join(" ") + " " + stripStrengths(r.composition)), useIdx, useSpace.idf));
  byComposition = new Map();
  records.forEach((r, i) => {
    const key = r.composition.toLowerCase().replace(/\s+/g, " ").trim();
    byComposition!.set(key, [...(byComposition!.get(key) || []), i]);
  });
}

export interface MedicineCard {
  name: string;
  composition: string;
  uses: string[];
  sideEffects: string[];
  manufacturer: string;
  reviews: { excellent: number; average: number; poor: number };
  score?: number;
}

const card = (i: number, score?: number): MedicineCard => {
  const r = records[i];
  return {
    name: r.name, composition: r.composition, uses: r.uses, sideEffects: r.sideEffects, manufacturer: r.manufacturer,
    reviews: { excellent: r.reviews[0], average: r.reviews[1], poor: r.reviews[2] },
    ...(score !== undefined ? { score: Number(score.toFixed(3)) } : {}),
  };
};

/** Best product (or ingredient) for a typed name, tolerant of misspelling. */
export function lookupMedicine(query: string): { match: MedicineCard | null; ingredient: string | null; similarity: number } {
  build();
  const q = vectorise(charGrams(query), nameIdx, nameSpace.idf);
  let best = -1, bestScore = 0;
  nameVectors!.forEach((v, i) => {
    const s = cosine(q, v);
    if (s > bestScore) { bestScore = s; best = i; }
  });
  if (best < 0 || bestScore < 0.25) return { match: null, ingredient: null, similarity: bestScore };
  if (best < records.length) return { match: card(best), ingredient: null, similarity: bestScore };

  // An ingredient: show its best-reviewed single-ingredient product.
  const ingredient = ingredients[best - records.length];
  const products = records
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.composition.toLowerCase().startsWith(ingredient))
    .sort((a, b) => Number(a.r.composition.includes("+")) - Number(b.r.composition.includes("+")) || b.r.reviews[0] - a.r.reviews[0]);
  return { match: products.length ? card(products[0].i) : null, ingredient, similarity: bestScore };
}

/** Products with exactly the same composition: generic substitutes, best reviewed first. */
export function substitutesFor(name: string, limit = 5): MedicineCard[] {
  build();
  const i = records.findIndex((r) => r.name === name);
  if (i < 0) return [];
  const key = records[i].composition.toLowerCase().replace(/\s+/g, " ").trim();
  return (byComposition!.get(key) || [])
    .filter((j) => j !== i)
    .sort((a, b) => records[b].reviews[0] - records[a].reviews[0])
    .slice(0, limit)
    .map((j) => card(j));
}

/** Search by need ("medicine for acidity"), by name, or both; one result per composition. */
export function searchMedicines(query: string, limit = 8): MedicineCard[] {
  build();
  const qu = vectorise(wordGrams(query), useIdx, useSpace.idf);
  const qn = vectorise(charGrams(query), nameIdx, nameSpace.idf);
  const scored = records.map((r, i) => {
    const byUse = qu.size ? cosine(qu, useVectors![i]) : 0;
    const byName = cosine(qn, nameVectors![i]);
    // A strong name match wins outright; otherwise rank by use, nudged by reviews.
    const s = byName > 0.6 ? 1 + byName : byUse * (0.9 + 0.1 * (r.reviews[0] / 100));
    return { i, s };
  }).filter((x) => x.s > 0.05).sort((a, b) => b.s - a.s);

  const seen = new Set<string>();
  const out: MedicineCard[] = [];
  for (const { i, s } of scored) {
    const key = records[i].composition.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card(i, s));
    if (out.length >= limit) break;
  }
  return out;
}
