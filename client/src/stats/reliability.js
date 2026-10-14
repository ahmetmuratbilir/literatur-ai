/**
 * Cronbach alfa ve madde-toplam korelasyonları.
 *
 * Girdi: satır = katılımcı, sütun = madde. Eksik değeri olan satır tamamen
 * düşer (listwise) ve `dropped` içinde sayılır — alfa eksik hücreyle
 * hesaplanamaz, sessizce doldurmak yerine satır atılır (tüzük 2.8).
 */

import { ORIGIN, sum, variance } from './descriptives.js';

function toNumber(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Tam satırları ayıklar. @returns {{rows: number[][], dropped: number}} */
export function cleanMatrix(input, itemCount) {
  const raw = Array.isArray(input) ? input : [];
  const rows = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== itemCount) continue;
    const values = row.map(toNumber);
    if (values.every((v) => v !== null)) rows.push(values);
  }
  return { rows, dropped: raw.length - rows.length };
}

/** İki eşit boy dizinin Pearson r'si; biri sabitse null. */
function pearsonR(xs, ys) {
  const n = xs.length;
  const mx = sum(xs) / n;
  const my = sum(ys) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

/**
 * Cronbach alfa.
 *
 * @param {Array<Array>} matrix satır = katılımcı, sütun = madde
 * @returns {object} alpha, k, n, dropped, itemTotalCorrelations (düzeltilmiş),
 *   alphaIfDeleted, warnings, error
 */
export function cronbachAlpha(matrix) {
  const first = Array.isArray(matrix) && Array.isArray(matrix[0]) ? matrix[0].length : 0;
  const { rows, dropped } = cleanMatrix(matrix, first);
  const k = first;
  const n = rows.length;
  const base = {
    test: 'cronbachAlpha', origin: ORIGIN, k, n, dropped,
    alpha: null, itemTotalCorrelations: null, alphaIfDeleted: null,
    warnings: [], error: null,
  };
  if (k < 2 || n < 2) return { ...base, error: 'too_few' };

  const columns = Array.from({ length: k }, (_, j) => rows.map((r) => r[j]));
  const totals = rows.map((r) => sum(r));
  const totalVariance = variance(totals);
  if (!totalVariance) {
    // Toplam puan sabit: alfa tanımsız (sıfır bölme).
    return { ...base, error: 'zero_variance' };
  }
  const itemVariances = columns.map((c) => variance(c) ?? 0);
  const alpha = (k / (k - 1)) * (1 - sum(itemVariances) / totalVariance);

  // Düzeltilmiş madde-toplam korelasyonu: madde ile DİĞER maddelerin toplamı.
  const itemTotalCorrelations = columns.map((column, j) => {
    const rest = rows.map((r) => sum(r.filter((_, idx) => idx !== j)));
    return pearsonR(column, rest);
  });

  // Madde atılırsa alfa ne olur: k-1 maddeyle yeniden hesap.
  const alphaIfDeleted = k > 2
    ? columns.map((_, j) => {
      const reduced = rows.map((r) => r.filter((_, idx) => idx !== j));
      const rt = variance(reduced.map((r) => sum(r)));
      if (!rt) return null;
      const iv = Array.from({ length: k - 1 }, (_, c) => variance(reduced.map((r) => r[c])) ?? 0);
      return ((k - 1) / (k - 2)) * (1 - sum(iv) / rt);
    })
    : null;

  const warnings = [];
  if (n < 30) warnings.push('small_sample');
  if (dropped > 0) warnings.push('dropped_values');
  // Alfa madde sayısına duyarlı: az maddeyle düşük alfa olağan, bu söylenir.
  if (k < 3) warnings.push('few_items');
  if (alpha < 0) warnings.push('negative_alpha');
  else if (alpha < 0.7) warnings.push('low_alpha');

  return { ...base, alpha, itemTotalCorrelations, alphaIfDeleted, warnings };
}
