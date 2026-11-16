/**
 * Inference for the text classifiers trained in ml/ (TF-IDF over word 1-2 grams, then
 * multinomial logistic regression). Shared by the triage model and the intent model, so
 * the server and the browser need no Python at runtime.
 *
 * Each model's tests compare this code with scikit-learn's own predictions (the "parity"
 * cases saved by the training script), so a change here that drifts from training fails.
 */

export interface TextModelJson {
  classes: string[];
  terms: string[];
  idf: number[];
  coef: number[][];
  intercept: number[];
  /** Numbers were replaced by the token "0num" before training (intent model). */
  numbers?: boolean;
}

export interface TextPrediction {
  label: string;
  confidence: number;
  /** How many of the input's words and word pairs the model saw in training. */
  knownTerms: number;
  top: { label: string; confidence: number }[];
}

/**
 * Latin letters, digits and Devanagari, two or more in a row. Must match TOKEN_PATTERN in
 * the training scripts, or the model sees different words than it was trained on.
 */
const TOKEN = /[a-z0-9ऀ-ॣ०-ॿ]{2,}/g;
const NUMBER = /\d+(?:[.,]\d+)*/g;

export function normalise(text: string, numbers = false): string {
  const lower = String(text).toLowerCase();
  return numbers ? lower.replace(NUMBER, " 0num ") : lower;
}

export function tokenize(text: string, numbers = false): string[] {
  return normalise(text, numbers).match(TOKEN) || [];
}

export function createTextClassifier(model: TextModelJson) {
  const index = new Map<string, number>(model.terms.map((t, i) => [t, i]));

  return function predict(text: string): TextPrediction {
    const tokens = tokenize(text, model.numbers);
    const counts = new Map<number, number>();
    const add = (term: string) => {
      const i = index.get(term);
      if (i !== undefined) counts.set(i, (counts.get(i) || 0) + 1);
    };
    tokens.forEach((t, i) => {
      add(t);
      if (i + 1 < tokens.length) add(`${t} ${tokens[i + 1]}`);
    });

    // Sublinear tf * idf, then L2 normalisation, as TfidfVectorizer(sublinear_tf=True) does.
    const weights = new Map<number, number>();
    let norm = 0;
    for (const [i, tf] of counts) {
      const w = (1 + Math.log(tf)) * model.idf[i];
      weights.set(i, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;

    const scores = model.classes.map((_, c) => {
      let s = model.intercept[c];
      const row = model.coef[c];
      for (const [i, w] of weights) s += row[i] * (w / norm);
      return s;
    });
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const top = model.classes
      .map((label, c) => ({ label, confidence: exps[c] / sum }))
      .sort((a, b) => b.confidence - a.confidence);

    return { label: top[0].label, confidence: top[0].confidence, knownTerms: counts.size, top: top.slice(0, 3) };
  };
}
