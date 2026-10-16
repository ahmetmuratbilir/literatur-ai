/**
 * Pearson ve Spearman korelasyonu.
 *
 * WO-006 dürüstlük kuralı: çıktı nedensellik ifadesi üretmez. Bu modül yalnız
 * sayı döndürür; "ilişki" / "etki" ayrımı apa.js'te uygulanır.
 */

import { ORIGIN, sum, variance } from './descriptives.js';
import { normalQuantile, tTwoTailedP } from './distributions.js';

/**
 * İki listeyi çift çift temizler: bir çiftin herhangi bir yanı eksikse çift
 * tamamen düşer (SPSS'in "exclude cases pairwise" davranışı).
 * @returns {{xs: number[], ys: number[], dropped: number}}
 */
export function cleanPairs(a, b) {
  const rawA = Array.isArray(a) ? a : [];
  const rawB = Array.isArray(b) ? b : [];
  const length = Math.max(rawA.length, rawB.length);
  const xs = [];
  const ys = [];
  for (let i = 0; i < length; i++) {
    const x = toNumber(rawA[i]);
    const y = toNumber(rawB[i]);
    if (x !== null && y !== null) {
      xs.push(x);
      ys.push(y);
    }
  }
  return { xs, ys, dropped: length - xs.length };
}

function toNumber(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Ham Pearson r (temizlenmiş, eşit boyda iki dizi). */
function pearsonR(xs, ys) {
  const n = xs.length;
  const mx = sum(xs) / n;
  const my = sum(ys) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  // Kayan nokta, |r| değerini 1'in bir tık üstüne çıkarabiliyor; sınırlanıyor.
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

/**
 * Ortalama sıralar (bağlı değerlere eşit sıra verir) — Spearman bunu kullanır.
 */
export function ranks(values) {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((p, q) => p.value - q.value);
  const out = new Array(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j++;
    // Bağlı grup [i, j]: hepsine ortalama sıra verilir (1 tabanlı).
    const average = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k].index] = average;
    i = j + 1;
  }
  return out;
}

/** Fisher z dönüşümüyle %95 güven aralığı. n ≤ 3 ise null. */
function fisherInterval(r, n, level = 0.95) {
  if (n <= 3 || r === null || Math.abs(r) >= 1) return null;
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const crit = normalQuantile(1 - (1 - level) / 2);
  const lo = Math.tanh(z - crit * se);
  const hi = Math.tanh(z + crit * se);
  return { lower: lo, upper: hi, level };
}

function correlate(kind, a, b, { level }) {
  const { xs, ys, dropped } = cleanPairs(a, b);
  const n = xs.length;
  const base = {
    test: kind, origin: ORIGIN, n, dropped,
    r: null, t: null, df: null, p: null, ci: null,
    warnings: [], error: null,
  };
  if (n < 3) return { ...base, error: 'too_few' };

  const useRanks = kind === 'spearman';
  const r = useRanks ? pearsonR(ranks(xs), ranks(ys)) : pearsonR(xs, ys);
  const warnings = [];
  if (n < 30) warnings.push('small_sample');
  if (dropped > 0) warnings.push('dropped_values');
  if (r === null) {
    // Bir değişken sabit: korelasyon tanımsız.
    return { ...base, warnings, error: 'zero_variance' };
  }
  if (useRanks && (variance(xs) === 0 || variance(ys) === 0)) {
    return { ...base, warnings, error: 'zero_variance' };
  }

  const df = n - 2;
  let t = null;
  let p = null;
  if (Math.abs(r) >= 1) {
    // Tam ilişki: t sonsuz, p sıfır. Sayı uydurulmuyor, p = 0 gerçek sınır.
    p = 0;
    warnings.push('perfect_correlation');
  } else {
    t = r * Math.sqrt(df / (1 - r * r));
    p = tTwoTailedP(t, df);
  }
  return { ...base, r, t, df, p, ci: fisherInterval(r, n, level), warnings };
}

/** Pearson momentler çarpımı korelasyonu. */
export function pearson(a, b, { level = 0.95 } = {}) {
  return correlate('pearson', a, b, { level });
}

/**
 * Spearman sıra korelasyonu. p değeri t yaklaşımıyla (df = n-2) hesaplanır —
 * SciPy'nin `spearmanr` varsayılanı da bu; küçük n'de kesin dağılım değil,
 * yaklaşımdır ve bu çıktıda `method` alanında yazar.
 */
export function spearman(a, b, { level = 0.95 } = {}) {
  return { ...correlate('spearman', a, b, { level }), method: 't_approximation' };
}
