/**
 * Belirsizlik bütçesi — GUM (JCGM 100:2008).
 *
 * A tipi: tekrarlı ölçümden istatistikle gelen belirsizlik.
 * B tipi: başka bilgiden gelen (kalibrasyon sertifikası, cihaz çözünürlüğü,
 *         üretici toleransı) belirsizlik; dağılım varsayımıyla standart
 *         belirsizliğe çevrilir.
 *
 * Dürüstlük kuralları (WO-009):
 * - Genişletilmiş belirsizlik, k ve kapsam olasılığı olmadan döndürülmez.
 * - Belirsizliği girilmemiş bileşen sıfır sayılmaz.
 * - Bütçe tablosu her bileşenin katkı payını gösterir; "toplam ± şu" tek
 *   satırı yetmez, hangi bileşenin sürüklediği görünür.
 */

import { ORIGIN, cleanNumbers, sd, sum } from './descriptives.js';
import { logGamma, normalQuantile, tCdf } from './distributions.js';
import { effectiveDegreesOfFreedom } from './propagation.js';

/**
 * B tipi belirsizlikte yarı genişlikten standart belirsizliğe çeviren
 * böleni. Dağılım varsayımı çıktıda yazılı kalır: "± 0,5 mm" ifadesi tek
 * başına hangi dağılımı varsaydığını söylemez.
 */
export const TYPE_B_DIVISORS = {
  // Yarı genişlik a, değer aralıkta eşit olasılıkla: u = a/√3 (dijital
  // gösterge çözünürlüğü, üretici toleransı)
  rectangular: Math.sqrt(3),
  // Uçlarda olasılık azalıyor: u = a/√6
  triangular: Math.sqrt(6),
  // Kalibrasyon sertifikası U ve k verir: u = U/k (k çağıranca geçilir)
  normal: 2,
  // İki uçta yoğunlaşmış (histerezis): u = a/√2
  uShaped: Math.sqrt(2),
};

/**
 * A tipi belirsizlik: tekrarlı ölçümlerin ortalamasının standart hatası.
 * @param {Array} readings ham ölçümler
 */
export function typeA(readings) {
  const { values, dropped } = cleanNumbers(readings);
  const n = values.length;
  const base = {
    kind: 'A', origin: ORIGIN, n, dropped,
    mean: null, sd: null, uncertainty: null, df: null, warnings: [], error: null,
  };
  if (n < 2) return { ...base, error: 'too_few' };
  const s = sd(values);
  const warnings = [];
  if (dropped > 0) warnings.push('dropped_values');
  // n küçükken ortalamanın standart hatası güvenilmez; GUM da n ≥ 10 öneriyor.
  if (n < 10) warnings.push('few_repeats');
  return {
    ...base,
    mean: sum(values) / n,
    sd: s,
    uncertainty: s / Math.sqrt(n),
    df: n - 1,
    warnings,
  };
}

/**
 * B tipi belirsizlik: yarı genişlik + dağılım varsayımı.
 * @param {number} halfWidth yarı genişlik a (ya da normal için U)
 * @param {{distribution?: keyof TYPE_B_DIVISORS, k?: number, df?: number}} [options]
 */
export function typeB(halfWidth, { distribution = 'rectangular', k = 2, df = null } = {}) {
  const base = {
    kind: 'B', origin: ORIGIN, distribution, halfWidth,
    uncertainty: null, df, warnings: [], error: null,
  };
  if (!Number.isFinite(halfWidth) || halfWidth < 0) return { ...base, error: 'invalid_input' };
  if (!Object.hasOwn(TYPE_B_DIVISORS, distribution)) return { ...base, error: 'unknown_distribution' };
  const divisor = distribution === 'normal' ? k : TYPE_B_DIVISORS[distribution];
  if (!(divisor > 0)) return { ...base, error: 'invalid_input' };
  return {
    ...base,
    uncertainty: halfWidth / divisor,
    divisor,
    // B tipinde serbestlik derecesi genelde bilinmez; sonsuz varsaymak
    // kullanıcının kararı olmalı, sessiz varsayım değil.
    df,
    warnings: df === null ? ['df_unknown'] : [],
  };
}

/**
 * Bileşik standart belirsizlik: bağımsız bileşenlerin karekök kareler toplamı.
 *
 * @param {Array<{name?: string, uncertainty: number|null, sensitivity?: number, unit?: string, df?: number|null}>} components
 * @returns {object} combinedUncertainty, budget (katkı payları ile), effectiveDf
 */
export function combine(components) {
  const list = Array.isArray(components) ? components : [];
  const base = {
    test: 'uncertaintyBudget', origin: ORIGIN,
    combinedUncertainty: null, budget: [], effectiveDf: null,
    warnings: [], error: null,
  };
  if (!list.length) return { ...base, error: 'no_data' };

  const budget = list.map((c, i) => {
    const u = Number.isFinite(c?.uncertainty) ? c.uncertainty : null;
    // Duyarlılık katsayısı verilmezse 1: bileşen doğrudan sonucun biriminde.
    const sensitivity = Number.isFinite(c?.sensitivity) ? c.sensitivity : 1;
    return {
      name: c?.name ?? `u${i + 1}`,
      kind: c?.kind ?? null,
      unit: c?.unit ?? null,
      distribution: c?.distribution ?? null,
      uncertainty: u,
      sensitivity,
      contribution: u === null ? null : Math.abs(sensitivity) * u,
      df: Number.isFinite(c?.df) ? c.df : null,
      share: null,
    };
  });

  const warnings = [];
  if (budget.some((c) => c.uncertainty === null)) {
    // Eksik bileşen sıfır sayılmaz: bileşik belirsizlik hesaplanmaz.
    return { ...base, budget, warnings: ['uncertainty_missing'], error: 'uncertainty_missing' };
  }
  if (budget.some((c) => c.df === null)) warnings.push('df_unknown');

  const squares = budget.map((c) => c.contribution ** 2);
  const total = squares.reduce((a, b) => a + b, 0);
  const combined = Math.sqrt(total);
  budget.forEach((c, i) => {
    c.share = total > 0 ? squares[i] / total : null;
  });
  // Baskın bileşen: iyileştirme çabası nereye gitmeli.
  const dominant = budget.reduce((best, c) => (best && best.share >= c.share ? best : c), null);
  if (dominant && dominant.share > 0.9) warnings.push('single_dominant_component');

  return {
    ...base,
    combinedUncertainty: combined,
    budget,
    effectiveDf: effectiveDegreesOfFreedom(combined, budget),
    dominant: dominant ? dominant.name : null,
    warnings,
  };
}

/**
 * Genişletilmiş belirsizlik U = k·u_c.
 *
 * Kapsam katsayısı etkin serbestlik derecesi varsa t dağılımından, yoksa
 * normal dağılımdan gelir — hangisi olduğu `basis` alanında yazar. k ve
 * kapsam olasılığı sonuçla **birlikte** döner; "± 0,4" tek başına anlamsız
 * olduğu için ayrı döndürülmüyor (WO-009).
 *
 * @param {number} combinedUncertainty u_c
 * @param {{value?: number|null, level?: number, effectiveDf?: number|null, k?: number|null}} [options]
 */
export function expand(combinedUncertainty, { value = null, level = 0.95, effectiveDf = null, k = null } = {}) {
  const base = {
    test: 'expandedUncertainty', origin: ORIGIN,
    value, combinedUncertainty, expanded: null, k: null, level,
    basis: null, interval: null, warnings: [], error: null,
  };
  if (!Number.isFinite(combinedUncertainty) || combinedUncertainty < 0) {
    return { ...base, error: 'invalid_input' };
  }
  if (!(level > 0) || !(level < 1)) return { ...base, error: 'invalid_input' };

  let factor = null;
  let basis = null;
  if (Number.isFinite(k) && k > 0) {
    factor = k;
    basis = 'given';
  } else if (Number.isFinite(effectiveDf) && effectiveDf > 0) {
    factor = tQuantile(1 - (1 - level) / 2, effectiveDf);
    basis = 't';
  } else {
    factor = normalQuantile(1 - (1 - level) / 2);
    basis = 'normal';
  }
  if (!Number.isFinite(factor)) return { ...base, error: 'invalid_input' };

  const expanded = factor * combinedUncertainty;
  const warnings = [];
  // Serbestlik derecesi bilinmeden normal dağılım varsaymak, az tekrarlı
  // ölçümde aralığı olduğundan dar gösterir. Söylenir.
  if (basis === 'normal' && effectiveDf === null) warnings.push('df_unknown_normal_assumed');
  return {
    ...base,
    expanded,
    k: factor,
    basis,
    effectiveDf,
    interval: Number.isFinite(value) ? { lower: value - expanded, upper: value + expanded } : null,
    warnings,
  };
}

/**
 * t dağılımının ters birikimli fonksiyonu — Newton'la `tCdf` üzerinden.
 * Yalnız kapsam katsayısı için gerekiyor; ayrı bir modül açmaya değmedi.
 */
export function tQuantile(p, df) {
  if (!(p > 0) || !(p < 1) || !(df > 0)) return NaN;
  // Normal yaklaşımdan başla, sonra t'ye çek.
  let t = normalQuantile(p);
  if (!Number.isFinite(t)) return NaN;
  for (let i = 0; i < 60; i++) {
    const density = tDensity(t, df);
    if (!(density > 0)) break;
    const step = (tCdf(t, df) - p) / density;
    t -= step;
    if (Math.abs(step) < 1e-14 * Math.max(1, Math.abs(t))) break;
  }
  return t;
}

/** Student t yoğunluğu — Newton adımının türevi. */
function tDensity(t, df) {
  // log Γ((v+1)/2) - log Γ(v/2) - ½·log(vπ) - (v+1)/2·log(1 + t²/v)
  const logDensity = logGamma((df + 1) / 2) - logGamma(df / 2)
    - 0.5 * Math.log(df * Math.PI)
    - ((df + 1) / 2) * Math.log(1 + (t * t) / df);
  return Math.exp(logDensity);
}
