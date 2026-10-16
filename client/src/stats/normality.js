/**
 * Shapiro-Wilk normallik testi — Royston'un AS R94 algoritması (1995).
 *
 * Yöntem yayımlanmış bir algoritmadır; buradaki uygulama onun JavaScript'e
 * yazılmış hali, kod alıntısı değil. Katsayılar Royston'un makalesinden gelen
 * sabitlerdir. Sonuç SciPy'nin `shapiro` çıktısıyla çapraz doğrulanıyor
 * (ikisi de aynı algoritmayı uyguluyor).
 *
 * Algoritma bir **yaklaşımdır**: W için beklenen normal sıra istatistikleri
 * yaklaşık, p değeri de log dönüşümlü bir normal yaklaşım. Bu yüzden WO-006
 * toleransı diğer testlerden gevşek ve bu gevşeklik gizlenmiyor.
 */

import { ORIGIN, cleanNumbers, sum } from './descriptives.js';
import { normalCdf, normalQuantile } from './distributions.js';

/** c[0] + c[1]x + c[2]x² … */
const poly = (c, x) => c.reduce((acc, coefficient, i) => acc + coefficient * x ** i, 0);

// Royston AS R94 sabitleri
const C1 = [0, 0.221157, -0.147981, -2.071190, 4.434685, -2.706056];
const C2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
const C3 = [0.5440, -0.39978, 0.025054, -6.714e-4];
const C4 = [1.3822, -0.77857, 0.062767, -0.0020322];
const C5 = [-1.5861, -0.31082, -0.083751, 0.0038915];
const C6 = [-0.4803, -0.082676, 0.0030302];
const G = [-2.273, 0.459];
const SQRT_HALF = Math.SQRT1_2;
// asin(sqrt(3)/2) ve 6/π: n = 3'ün kesin dağılımı
const PI6 = 1.909859;
const STQR = 1.047198;

/**
 * W katsayıları: antisimetrik ağırlık vektörü (toplamı 0, kareler toplamı 1).
 * Dışa açık, çünkü testte bu iki özdeşlik ayrıca doğrulanıyor.
 */
export function shapiroWeights(n) {
  if (n < 3) return null;
  const a = new Array(n).fill(0);
  if (n === 3) {
    a[0] = -SQRT_HALF;
    a[2] = SQRT_HALF;
    return a;
  }
  const half = Math.floor(n / 2);
  // m_i = Φ⁻¹((i - 3/8)/(n + 1/4)), yalnız alt yarı (negatif değerler)
  const m = new Array(half);
  let summ2 = 0;
  for (let i = 1; i <= half; i++) {
    m[i - 1] = normalQuantile((i - 0.375) / (n + 0.25));
    summ2 += m[i - 1] ** 2;
  }
  summ2 *= 2;
  const ssumm2 = Math.sqrt(summ2);
  const rsn = 1 / Math.sqrt(n);

  // En uçtaki bir (n ≤ 5) ya da iki (n > 5) katsayı düzeltmeli formülden,
  // kalanlar ölçeklenerek gelir; ölçek kareler toplamını tam 1 yapar.
  const a1 = poly(C1, rsn) - m[0] / ssumm2;
  let a2 = null;
  let first;
  let fac;
  if (n > 5) {
    a2 = poly(C2, rsn) - m[1] / ssumm2;
    first = 3;
    fac = Math.sqrt((summ2 - 2 * m[0] ** 2 - 2 * m[1] ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2));
  } else {
    first = 2;
    fac = Math.sqrt((summ2 - 2 * m[0] ** 2) / (1 - 2 * a1 ** 2));
  }

  const magnitude = new Array(half);
  magnitude[0] = a1;
  if (a2 !== null) magnitude[1] = a2;
  for (let i = first; i <= half; i++) magnitude[i - 1] = -m[i - 1] / fac;

  for (let i = 0; i < half; i++) {
    a[i] = -magnitude[i];
    a[n - 1 - i] = magnitude[i];
  }
  return a;
}

/** W'den p değeri (Royston'un üç bölgeli yaklaşımı). */
function shapiroP(w, n) {
  if (n === 3) {
    const p = PI6 * (Math.asin(Math.sqrt(w)) - STQR);
    return Math.min(1, Math.max(0, p));
  }
  if (w >= 1) return 1;
  if (n <= 11) {
    const gamma = poly(G, n);
    const logged = gamma - Math.log(1 - w);
    // γ - log(1-W) ≤ 0: W dağılımın dışında, p sayısal olarak sıfıra iner.
    if (logged <= 0) return 0;
    const y = -Math.log(logged);
    const mu = poly(C3, n);
    const sigma = Math.exp(poly(C4, n));
    return 1 - normalCdf((y - mu) / sigma);
  }
  const logN = Math.log(n);
  const y = Math.log(1 - w);
  const mu = poly(C5, logN);
  const sigma = Math.exp(poly(C6, logN));
  return 1 - normalCdf((y - mu) / sigma);
}

/**
 * Shapiro-Wilk normallik testi.
 *
 * @param {Array} input ham değerler
 * @param {{alpha?: number}} [options] karar eşiği (varsayılan .05)
 * @returns {object} w, p, n, dropped, normal (karar), alternative, warnings, error
 */
export function shapiroWilk(input, { alpha = 0.05 } = {}) {
  const { values, dropped } = cleanNumbers(input);
  const n = values.length;
  const base = {
    test: 'shapiroWilk', origin: ORIGIN, n, dropped, alpha,
    w: null, p: null, normal: null, warnings: [], error: null,
  };
  // Royston'un algoritması 3 ≤ n ≤ 5000 için geçerli.
  if (n < 3) return { ...base, error: 'too_few' };
  if (n > 5000) return { ...base, error: 'too_many' };

  const x = [...values].sort((p, q) => p - q);
  if (x[0] === x[n - 1]) return { ...base, error: 'zero_variance' };

  const a = shapiroWeights(n);
  const m = sum(x) / n;
  let ss = 0;
  for (const v of x) ss += (v - m) ** 2;
  let numerator = 0;
  for (let i = 0; i < n; i++) numerator += a[i] * x[i];
  const w = Math.min(1, (numerator * numerator) / ss);
  const p = shapiroP(w, n);

  const warnings = [];
  if (dropped > 0) warnings.push('dropped_values');
  // n büyüdükçe test küçük sapmaları da reddeder: anlamlı p tek başına
  // "dağılım kullanılamaz" demez. Bu uyarı arayüzde yazılır.
  if (n > 300) warnings.push('large_sample_sensitivity');
  if (n < 20) warnings.push('low_power');

  return {
    ...base,
    w,
    p,
    normal: p >= alpha,
    // Varsayım karşılanmadıysa parametrik olmayan alternatif adıyla önerilir
    // (WO-006 dürüstlük kuralı). Karar kullanıcının, ama seçenek görünür.
    alternative: p >= alpha ? null : 'mann_whitney_or_wilcoxon',
    warnings,
  };
}
