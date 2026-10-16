/**
 * t-testleri ve Levene varyans homojenliği testi.
 *
 * WO-006: her parametrik sonuç yanında varsayım kontrolünü taşır. Bağımsız
 * örneklem testinde hem Student (eşit varyans) hem Welch döner — SPSS de
 * ikisini birlikte verir ve Levene'ye göre hangisinin okunacağını söyler.
 * Hangisinin okunması gerektiği `recommended` alanında yazar; karar kullanıcıya
 * bırakılmaz ama gerekçesi görünür kalır.
 */

import { ORIGIN, cleanNumbers, mean, sum, variance } from './descriptives.js';
import { fUpperTailP, tTwoTailedP } from './distributions.js';

/**
 * Levene testi (ortalama merkezli — SPSS'in "Levene's Test" sütunu).
 *
 * `car::leveneTest`'in varsayılanı medyan merkezlidir (Brown-Forsythe) ve
 * farklı bir sayı verir. Hedef kullanıcı SPSS'ten geldiği için ortalama
 * merkezli hali uygulandı; bu seçim çıktıda `center: 'mean'` olarak yazıyor,
 * gizlenmiyor.
 */
export function levene(groups) {
  const cleaned = groups.map((g) => cleanNumbers(g).values);
  const k = cleaned.length;
  const total = cleaned.reduce((a, g) => a + g.length, 0);
  const base = {
    test: 'levene', origin: ORIGIN, center: 'mean', k, n: total,
    f: null, df1: null, df2: null, p: null, error: null,
  };
  if (k < 2 || cleaned.some((g) => g.length < 2) || total - k < 1) {
    return { ...base, error: 'too_few' };
  }
  // z_ij = |x_ij - ortalama_i|, sonra z üzerinde tek yönlü ANOVA
  const z = cleaned.map((g) => {
    const m = mean(g);
    return g.map((v) => Math.abs(v - m));
  });
  const allZ = z.flat();
  const grand = mean(allZ);
  let between = 0;
  let within = 0;
  for (const gz of z) {
    const gm = mean(gz);
    between += gz.length * (gm - grand) ** 2;
    for (const v of gz) within += (v - gm) ** 2;
  }
  const df1 = k - 1;
  const df2 = total - k;
  if (within === 0) {
    // Tüm gruplarda sapma aynı: F tanımsız. Uydurma sayı yerine null.
    return { ...base, df1, df2, error: 'zero_variance' };
  }
  const f = (between / df1) / (within / df2);
  return { ...base, f, df1, df2, p: fUpperTailP(f, df1, df2) };
}

/** Cohen's d için havuzlanmış standart sapma. */
function pooledSd(n1, v1, n2, v2) {
  const df = n1 + n2 - 2;
  return df > 0 ? Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / df) : null;
}

/**
 * Bağımsız örneklem t-testi. Student ve Welch birlikte, Levene ile.
 * @param {Array} a birinci grup
 * @param {Array} b ikinci grup
 */
export function independentT(a, b) {
  const ca = cleanNumbers(a);
  const cb = cleanNumbers(b);
  const n1 = ca.values.length;
  const n2 = cb.values.length;
  const dropped = ca.dropped + cb.dropped;
  const base = {
    test: 'independentT', origin: ORIGIN, n1, n2, dropped,
    mean1: null, mean2: null, sd1: null, sd2: null, meanDifference: null,
    student: null, welch: null, levene: null, cohensD: null, dType: 'pooled',
    recommended: null, warnings: [], error: null,
  };
  if (n1 < 2 || n2 < 2) return { ...base, error: 'too_few' };

  const m1 = sum(ca.values) / n1;
  const m2 = sum(cb.values) / n2;
  const v1 = variance(ca.values);
  const v2 = variance(cb.values);
  const diff = m1 - m2;
  const lev = levene([ca.values, cb.values]);
  const warnings = [];
  if (n1 < 30 || n2 < 30) warnings.push('small_sample');
  if (dropped > 0) warnings.push('dropped_values');

  if (v1 === 0 && v2 === 0) {
    // İki grup da sabit: t tanımsız (sıfır bölme). Çökme yok, null döner.
    return {
      ...base, mean1: m1, mean2: m2, sd1: 0, sd2: 0, meanDifference: diff,
      levene: lev, warnings, error: 'zero_variance',
    };
  }

  const dfStudent = n1 + n2 - 2;
  const sp = pooledSd(n1, v1, n2, v2);
  const seStudent = sp * Math.sqrt(1 / n1 + 1 / n2);
  const student = seStudent > 0
    ? { t: diff / seStudent, df: dfStudent, p: tTwoTailedP(diff / seStudent, dfStudent), se: seStudent }
    : null;

  // Welch–Satterthwaite
  const seWelch = Math.sqrt(v1 / n1 + v2 / n2);
  let welch = null;
  if (seWelch > 0) {
    const num = (v1 / n1 + v2 / n2) ** 2;
    const den = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
    const dfWelch = den > 0 ? num / den : null;
    welch = dfWelch
      ? { t: diff / seWelch, df: dfWelch, p: tTwoTailedP(diff / seWelch, dfWelch), se: seWelch }
      : null;
  }

  // Levene anlamlıysa (p < .05) varyanslar eşit sayılmaz: Welch okunur.
  const recommended = lev.p !== null && lev.p < 0.05 ? 'welch' : 'student';
  if (recommended === 'welch') warnings.push('unequal_variances');

  return {
    ...base,
    mean1: m1, mean2: m2, sd1: Math.sqrt(v1), sd2: Math.sqrt(v2),
    meanDifference: diff,
    student, welch, levene: lev,
    cohensD: sp > 0 ? diff / sp : null,
    recommended,
    warnings,
  };
}

/**
 * Eşleştirilmiş örneklem t-testi. Çiftlerden biri eksikse o çift düşer ve
 * `dropped` içinde sayılır (liste boyu eşit değilse de fazlası düşer).
 */
export function pairedT(a, b) {
  const rawA = Array.isArray(a) ? a : [];
  const rawB = Array.isArray(b) ? b : [];
  const length = Math.max(rawA.length, rawB.length);
  const diffs = [];
  const xs = [];
  const ys = [];
  for (let i = 0; i < length; i++) {
    const pair = cleanNumbers([rawA[i], rawB[i]]);
    // İkisi birlikte geçerliyse çift kullanılır; biri eksikse çift tamamen düşer.
    if (pair.values.length === 2) {
      xs.push(pair.values[0]);
      ys.push(pair.values[1]);
      diffs.push(pair.values[0] - pair.values[1]);
    }
  }
  const n = diffs.length;
  const base = {
    test: 'pairedT', origin: ORIGIN, n, dropped: length - n,
    mean1: null, mean2: null, meanDifference: null, sdDifference: null,
    t: null, df: null, p: null, se: null, cohensD: null, dType: 'dz',
    warnings: [], error: null,
  };
  if (n < 2) return { ...base, error: 'too_few' };

  const md = sum(diffs) / n;
  const vd = variance(diffs);
  const sdd = Math.sqrt(vd);
  const warnings = [];
  if (n < 30) warnings.push('small_sample');
  if (base.dropped > 0) warnings.push('dropped_values');
  if (sdd === 0) {
    // Tüm farklar aynı: t tanımsız.
    return {
      ...base, mean1: sum(xs) / n, mean2: sum(ys) / n, meanDifference: md,
      sdDifference: 0, warnings, error: 'zero_variance',
    };
  }
  const se = sdd / Math.sqrt(n);
  const df = n - 1;
  const t = md / se;
  return {
    ...base,
    mean1: sum(xs) / n, mean2: sum(ys) / n,
    meanDifference: md, sdDifference: sdd,
    t, df, p: tTwoTailedP(t, df), se,
    // d_z: farkların ortalaması / farkların standart sapması (SPSS'in verdiği).
    cohensD: md / sdd,
    warnings,
  };
}
