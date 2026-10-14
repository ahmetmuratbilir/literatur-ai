/**
 * Doğrusal regresyon ve kalibrasyon eğrisi.
 *
 * Lab raporunun yarısı bu: doğru uydur, R² yaz, kalibrasyon eğrisinden
 * tersine oku.
 *
 * Dürüstlük kuralları (WO-009):
 * - R² tek başına uyum iyiliği sayılmaz: artık standart sapması (s) ve F
 *   testi yanında döner. Yüksek R² kötü bir modeli de gizleyebilir.
 * - Güven aralığı ile kestirim aralığı ayrı alanlarda; ikisi karıştırılmaz.
 *   Güven aralığı ortalama yanıtın, kestirim aralığı tek bir gözlemin.
 * - Veri aralığı dışında kestirim `extrapolation: true` taşır.
 */

import { ORIGIN, sum } from './descriptives.js';
import { fUpperTailP, tTwoTailedP } from './distributions.js';
import { tQuantile } from './uncertainty.js';

/** Çift çift temizlik: bir yanı eksik olan nokta tamamen düşer. */
function cleanPoints(xs, ys) {
  const ax = Array.isArray(xs) ? xs : [];
  const ay = Array.isArray(ys) ? ys : [];
  const length = Math.max(ax.length, ay.length);
  const x = [];
  const y = [];
  for (let i = 0; i < length; i++) {
    const xi = toNumber(ax[i]);
    const yi = toNumber(ay[i]);
    if (xi !== null && yi !== null) {
      x.push(xi);
      y.push(yi);
    }
  }
  return { x, y, dropped: length - x.length };
}

function toNumber(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Basit doğrusal regresyon: y = a + b·x.
 *
 * @returns {object} slope, intercept, standart hataları ve p değerleri,
 *   r, r2, adjustedR2, residualSd, anova {f, df1, df2, p}, n, dropped, xRange
 */
export function linearRegression(xs, ys) {
  const { x, y, dropped } = cleanPoints(xs, ys);
  const n = x.length;
  const base = {
    test: 'linearRegression', origin: ORIGIN, n, dropped,
    slope: null, intercept: null, slopeSe: null, interceptSe: null,
    slopeT: null, slopeP: null, interceptT: null, interceptP: null,
    r: null, r2: null, adjustedR2: null, residualSd: null, df: null,
    anova: null, xRange: null, warnings: [], error: null,
  };
  // İki nokta bir doğru belirler ama artık yok: belirsizlik hesaplanamaz.
  if (n < 3) return { ...base, error: 'too_few' };

  const mx = sum(x) / n;
  const my = sum(y) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  if (sxx === 0) return { ...base, error: 'zero_variance' };

  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const df = n - 2;
  // Artık kareler toplamı; kayan nokta yüzünden küçük negatif çıkabilir.
  const ssResidual = Math.max(0, syy - slope * sxy);
  const ssModel = syy - ssResidual;
  const residualVariance = ssResidual / df;
  const residualSd = Math.sqrt(residualVariance);

  const warnings = [];
  if (dropped > 0) warnings.push('dropped_values');
  if (n < 10) warnings.push('few_points');

  let slopeSe = null;
  let interceptSe = null;
  let slopeT = null;
  let slopeP = null;
  let interceptT = null;
  let interceptP = null;
  let anova = null;
  if (residualSd > 0) {
    slopeSe = residualSd / Math.sqrt(sxx);
    interceptSe = residualSd * Math.sqrt(1 / n + mx ** 2 / sxx);
    slopeT = slope / slopeSe;
    slopeP = tTwoTailedP(slopeT, df);
    interceptT = intercept / interceptSe;
    interceptP = tTwoTailedP(interceptT, df);
    const f = (ssModel / 1) / residualVariance;
    anova = { f, df1: 1, df2: df, p: fUpperTailP(f, 1, df) };
  } else {
    // Noktalar doğru üzerinde tam: standart hatalar sıfır, t tanımsız.
    warnings.push('perfect_fit');
  }

  const r2 = syy > 0 ? ssModel / syy : null;
  return {
    ...base,
    slope,
    intercept,
    slopeSe,
    interceptSe,
    slopeT,
    slopeP,
    interceptT,
    interceptP,
    // r'nin işareti eğimden gelir
    r: syy > 0 ? Math.sign(slope) * Math.sqrt(Math.max(0, Math.min(1, r2))) : null,
    r2,
    // Düzeltilmiş R²: tek yordayıcı için de bildirilir, R²'yi şişmiş gösterme
    adjustedR2: r2 === null ? null : 1 - ((1 - r2) * (n - 1)) / df,
    residualSd,
    df,
    anova,
    xRange: { min: Math.min(...x), max: Math.max(...x) },
    sxx,
    meanX: mx,
    warnings,
  };
}

/**
 * Uydurulmuş doğrudan kestirim.
 *
 * @param {object} fit linearRegression çıktısı
 * @param {number} atX
 * @param {{level?: number}} [options]
 * @returns {object} fitted, confidenceInterval (ortalama yanıt),
 *   predictionInterval (tek gözlem), extrapolation
 */
export function predict(fit, atX, { level = 0.95 } = {}) {
  const base = {
    test: 'regressionPredict', origin: ORIGIN, x: atX,
    fitted: null, confidenceInterval: null, predictionInterval: null,
    extrapolation: null, warnings: [], error: null,
  };
  if (!fit || fit.error || !Number.isFinite(atX)) return { ...base, error: fit?.error || 'invalid_input' };

  const fitted = fit.intercept + fit.slope * atX;
  // Veri aralığı dışı kestirim: model o bölgede doğrulanmadı.
  const extrapolation = atX < fit.xRange.min || atX > fit.xRange.max;
  const warnings = extrapolation ? ['extrapolation'] : [];
  if (!(fit.residualSd > 0)) {
    return { ...base, fitted, extrapolation, warnings: [...warnings, 'perfect_fit'] };
  }

  const crit = tQuantile(1 - (1 - level) / 2, fit.df);
  const leverage = 1 / fit.n + (atX - fit.meanX) ** 2 / fit.sxx;
  // Ortalama yanıtın aralığı
  const confidenceHalf = crit * fit.residualSd * Math.sqrt(leverage);
  // Tek bir yeni gözlemin aralığı: artık varyansı da eklenir, bu yüzden geniş
  const predictionHalf = crit * fit.residualSd * Math.sqrt(1 + leverage);
  return {
    ...base,
    fitted,
    confidenceInterval: { lower: fitted - confidenceHalf, upper: fitted + confidenceHalf, level, of: 'mean_response' },
    predictionInterval: { lower: fitted - predictionHalf, upper: fitted + predictionHalf, level, of: 'single_observation' },
    extrapolation,
    warnings,
  };
}

/**
 * Kalibrasyon eğrisinden tersine okuma: ölçülen yanıttan derişim/değer.
 *
 * Belirsizlik, eğim ve kesmenin belirsizliğiyle birlikte artık saçılımından
 * gelir (klasik kalibrasyon formülü). Eğim sıfıra yakınsa sonuç kullanılamaz
 * ve bu söylenir — bölme büyük bir belirsizliği gizler.
 *
 * @param {object} fit linearRegression çıktısı
 * @param {number} response ölçülen y
 * @param {{level?: number, replicates?: number}} [options]
 */
export function inverseCalibration(fit, response, { level = 0.95, replicates = 1 } = {}) {
  const base = {
    test: 'inverseCalibration', origin: ORIGIN, response,
    value: null, uncertainty: null, interval: null,
    extrapolation: null, warnings: [], error: null,
  };
  if (!fit || fit.error || !Number.isFinite(response)) return { ...base, error: fit?.error || 'invalid_input' };
  if (!(fit.residualSd > 0)) return { ...base, error: 'perfect_fit' };
  if (!Number.isFinite(replicates) || replicates < 1) return { ...base, error: 'invalid_input' };
  // Eğim standart hatasının üç katının altındaysa eğim güvenilir değil.
  if (!(Math.abs(fit.slope) > 3 * fit.slopeSe)) return { ...base, error: 'slope_not_significant' };

  const value = (response - fit.intercept) / fit.slope;
  const leverage = 1 / replicates + 1 / fit.n + (value - fit.meanX) ** 2 / fit.sxx;
  const uncertainty = (fit.residualSd / Math.abs(fit.slope)) * Math.sqrt(leverage);
  const crit = tQuantile(1 - (1 - level) / 2, fit.df);
  const half = crit * uncertainty;
  const extrapolation = value < fit.xRange.min || value > fit.xRange.max;
  const warnings = [];
  if (extrapolation) warnings.push('extrapolation');
  if (fit.n < 10) warnings.push('few_points');
  return {
    ...base,
    value,
    uncertainty,
    interval: { lower: value - half, upper: value + half, level },
    extrapolation,
    warnings,
  };
}
