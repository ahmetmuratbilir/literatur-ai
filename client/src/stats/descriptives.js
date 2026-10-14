/**
 * Betimsel istatistik ve ortak veri temizliği.
 *
 * WO-006 kuralları:
 * - Eksik veri sessizce düşmez: ayıklanan değerin sayısı `dropped` alanında
 *   çıktıyla birlikte döner (kabul kriteri).
 * - Hesaplanamayan alan `null` kalır, tahminle doldurulmaz (tüzük 3.6).
 * - Çarpıklık ve basıklık SPSS/Excel kuralıyla (G1 ve G2, yanlılık düzeltmeli);
 *   hedef kullanıcı SPSS'ten geliyor, aynı sayıyı görmesi gerekiyor.
 */

/** Hesaplanan her çıktının ortak kökeni (tüzük 3.6; WO-006 mimari sapması). */
export const ORIGIN = 'computed';

/**
 * Sayıya çevrilebilen değerleri ayıklar. `null`, `undefined`, boş dize,
 * `NaN`, `Infinity` ve sayıya çevrilemeyen metin atılır; kaçının atıldığı
 * sayılır.
 * @returns {{values: number[], dropped: number}}
 */
export function cleanNumbers(input) {
  const raw = Array.isArray(input) ? input : [];
  const values = [];
  for (const item of raw) {
    if (item === null || item === undefined || item === '' || typeof item === 'boolean') continue;
    const n = typeof item === 'number' ? item : Number(String(item).trim().replace(',', '.'));
    if (Number.isFinite(n)) values.push(n);
  }
  return { values, dropped: raw.length - values.length };
}

export const sum = (values) => values.reduce((a, b) => a + b, 0);
export const mean = (values) => (values.length ? sum(values) / values.length : null);

/** Örneklem varyansı (n-1). n < 2 ise null. */
export function variance(values) {
  const n = values.length;
  if (n < 2) return null;
  const m = sum(values) / n;
  let ss = 0;
  for (const v of values) ss += (v - m) ** 2;
  return ss / (n - 1);
}

/** Örneklem standart sapması (n-1). */
export function sd(values) {
  const v = variance(values);
  return v === null ? null : Math.sqrt(v);
}

/** Medyan (çift n'de iki orta değerin ortalaması). */
export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Çarpıklık (G1) — SPSS ve Excel'in bildirdiği yanlılık düzeltmeli değer.
 * n < 3 ya da sıfır varyans: null.
 */
export function skewness(values) {
  const n = values.length;
  const s = sd(values);
  if (n < 3 || !s) return null;
  const m = sum(values) / n;
  let m3 = 0;
  for (const v of values) m3 += ((v - m) / s) ** 3;
  return (n / ((n - 1) * (n - 2))) * m3;
}

/**
 * Basıklık (G2) — fazlalık basıklık, SPSS/Excel kuralı (normal dağılımda 0).
 * n < 4 ya da sıfır varyans: null.
 */
export function kurtosis(values) {
  const n = values.length;
  const s = sd(values);
  if (n < 4 || !s) return null;
  const m = sum(values) / n;
  let m4 = 0;
  for (const v of values) m4 += ((v - m) / s) ** 4;
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * m4
    - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

/**
 * Betimsel istatistik özeti.
 * @param {Array} input ham değerler (metin ve eksik veri olabilir)
 * @returns {object} n, dropped, mean, sd, se, median, min, max, range,
 *   variance, skewness, kurtosis, warnings, error
 */
export function describe(input) {
  const { values, dropped } = cleanNumbers(input);
  const n = values.length;
  const base = { test: 'descriptives', origin: ORIGIN, n, dropped, warnings: [], error: null };
  if (n === 0) {
    return {
      ...base,
      error: 'no_data',
      mean: null, sd: null, se: null, median: null, min: null, max: null,
      range: null, variance: null, skewness: null, kurtosis: null,
    };
  }
  const s = sd(values);
  const warnings = [];
  if (n < 30) warnings.push('small_sample');
  if (dropped > 0) warnings.push('dropped_values');
  if (s === 0) warnings.push('zero_variance');
  return {
    ...base,
    warnings,
    mean: sum(values) / n,
    sd: s,
    se: s === null ? null : s / Math.sqrt(n),
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    range: Math.max(...values) - Math.min(...values),
    variance: variance(values),
    skewness: skewness(values),
    kurtosis: kurtosis(values),
  };
}
