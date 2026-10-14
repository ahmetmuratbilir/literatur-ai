/**
 * Monte Carlo belirsizlik yayılımı (JCGM 101:2008).
 *
 * Neden gerekiyor: birinci mertebe yayılım (propagation.js) modeli
 * doğrusallaştırır. Model belirgin doğrusal değilse sonuç yanlış çıkar ve
 * yanlışlığı görünmez. Monte Carlo modeli olduğu gibi kullanır.
 *
 * **Tohum çıktıda döner.** Denetim izi (tüzük 2.3) rastgele bir hesapta
 * ancak tohum kayıtlıysa işler: aynı tohum aynı sayıyı vermiyorsa kullanıcı
 * sonucunu savunamaz. Bu yüzden `Math.random` kullanılmıyor — o tohumlanamaz.
 */

import { ORIGIN, mean, sd } from './descriptives.js';
import { propagate } from './propagation.js';

/**
 * Tohumlanabilir üreteç: splitmix64'ün 32 bit türevi (mulberry32).
 * Kriptografik değil, istatistiksel yayılım için yeterli ve yinelenebilir.
 * @param {number} seed
 * @returns {() => number} [0, 1) aralığında sayı
 */
export function createRandom(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller: düzgün dağılımdan standart normal. Çiftler halinde üretir,
 * ikincisi saklanır.
 */
function normalSampler(random) {
  let spare = null;
  return function nextNormal() {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    let u = 0;
    // log(0) olmasın
    while (u === 0) u = random();
    const v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    const angle = 2 * Math.PI * v;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

/** Desteklenen girdi dağılımları. */
export const DISTRIBUTIONS = ['normal', 'rectangular', 'triangular', 'student'];

/**
 * Bir girdi için örnekleyici kurar.
 * `rectangular` ve `triangular`, B tipi belirsizliğin yarı genişlik
 * varsayımlarıyla aynı: standart belirsizlik u verildiğinde yarı genişlik
 * a = u·√3 (dikdörtgen) ve a = u·√6 (üçgen).
 */
function samplerFor(input, random, nextNormal) {
  const { value, uncertainty, distribution = 'normal', df = null } = input;
  if (distribution === 'rectangular') {
    const a = uncertainty * Math.sqrt(3);
    return () => value + a * (2 * random() - 1);
  }
  if (distribution === 'triangular') {
    const a = uncertainty * Math.sqrt(6);
    // İki düzgün sayının ortalaması üçgen dağılım verir.
    return () => value + a * (random() + random() - 1);
  }
  if (distribution === 'student') {
    if (!(df > 2)) return null;
    // t dağılımı: z / sqrt(chi²_v / v). Varyansı v/(v-2) olduğu için
    // standart belirsizliğe ölçeklenir.
    const scale = uncertainty / Math.sqrt(df / (df - 2));
    return () => {
      let chi = 0;
      for (let i = 0; i < df; i++) {
        const z = nextNormal();
        chi += z * z;
      }
      return value + scale * (nextNormal() / Math.sqrt(chi / df));
    };
  }
  return () => value + uncertainty * nextNormal();
}

/**
 * Monte Carlo yayılımı.
 *
 * @param {(values: number[]) => number} model
 * @param {Array<{name?: string, value: number, uncertainty: number, distribution?: string, df?: number, unit?: string}>} inputs
 * @param {{trials?: number, seed?: number, level?: number}} [options]
 * @returns {object} value (örneklem ortalaması), standardUncertainty,
 *   coverageInterval, trials, seed, firstOrder (karşılaştırma), warnings, error
 */
export function monteCarlo(model, inputs, { trials = 100000, seed = 20261014, level = 0.95 } = {}) {
  const list = Array.isArray(inputs) ? inputs : [];
  const base = {
    test: 'monteCarlo', origin: ORIGIN,
    value: null, standardUncertainty: null, coverageInterval: null,
    trials: 0, seed, level, discarded: 0,
    firstOrder: null, linearityGap: null, warnings: [], error: null,
  };
  if (typeof model !== 'function' || list.length === 0) return { ...base, error: 'no_data' };
  if (!Number.isFinite(trials) || trials < 100) return { ...base, error: 'too_few_trials' };
  if (list.some((i) => !Number.isFinite(i?.value))) return { ...base, error: 'invalid_input' };
  // Belirsizliği girilmemiş girdi sıfır sayılmaz (WO-009 dürüstlük kuralı).
  if (list.some((i) => !Number.isFinite(i?.uncertainty))) return { ...base, error: 'uncertainty_missing' };
  if (list.some((i) => i.distribution && !DISTRIBUTIONS.includes(i.distribution))) {
    return { ...base, error: 'unknown_distribution' };
  }

  const random = createRandom(seed);
  const nextNormal = normalSampler(random);
  const samplers = list.map((input) => samplerFor(input, random, nextNormal));
  if (samplers.some((s) => s === null)) return { ...base, error: 'invalid_input' };

  const draws = new Float64Array(trials);
  const point = new Array(list.length);
  let kept = 0;
  for (let trial = 0; trial < trials; trial++) {
    for (let i = 0; i < samplers.length; i++) point[i] = samplers[i]();
    const y = model(point);
    // Modelin tanımsız kaldığı çekiliş (√negatif, 0'a bölme) atılır ve
    // sayısı raporlanır — sessizce yok sayılmaz.
    if (Number.isFinite(y)) draws[kept++] = y;
  }
  const discarded = trials - kept;
  if (kept < 100) return { ...base, trials: kept, discarded, error: 'model_undefined' };

  const values = Array.from(draws.subarray(0, kept));
  const average = mean(values);
  const deviation = sd(values);

  // Kapsama aralığı: en kısa değil, simetrik yüzdelik (JCGM 101 §7.7'deki
  // olasılıkça simetrik aralık). Çarpık çıktıda bu seçim önemlidir, yazılı.
  const sorted = [...values].sort((p, q) => p - q);
  const alpha = (1 - level) / 2;
  const lowerIndex = Math.floor(alpha * (kept - 1));
  const upperIndex = Math.ceil((1 - alpha) * (kept - 1));

  // Birinci mertebe ile karşılaştırma: doğrusal yaklaşım kırıldıysa görünsün.
  const first = propagate(model, list.map((i) => ({ ...i, uncertainty: i.uncertainty })));
  const warnings = [];
  if (discarded > 0) warnings.push('discarded_trials');
  let gap = null;
  if (first.combinedUncertainty > 0 && deviation !== null) {
    gap = Math.abs(deviation - first.combinedUncertainty) / first.combinedUncertainty;
    // %10'dan büyük fark: modeli doğrusallaştırmak sonucu değiştiriyor.
    if (gap > 0.1) warnings.push('nonlinear_model');
  }
  if (kept < 10000) warnings.push('few_trials');

  return {
    ...base,
    value: average,
    standardUncertainty: deviation,
    coverageInterval: {
      lower: sorted[lowerIndex], upper: sorted[upperIndex], level, method: 'symmetric_percentile',
    },
    trials: kept,
    discarded,
    firstOrder: first.combinedUncertainty ?? null,
    linearityGap: gap,
    warnings,
  };
}
