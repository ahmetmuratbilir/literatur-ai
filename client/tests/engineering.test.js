import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { partialDerivative, propagate, stepFor, effectiveDegreesOfFreedom } from '../src/stats/propagation.js';
import { TYPE_B_DIVISORS, combine, expand, tQuantile, typeA, typeB } from '../src/stats/uncertainty.js';
import { createRandom, monteCarlo } from '../src/stats/montecarlo.js';
import { inverseCalibration, linearRegression, predict } from '../src/stats/regression.js';

/**
 * WO-009 capraz dogrulama.
 *
 * Referans: NumPy 2.2.6 / SciPy 1.17.1 ve elle alinmis analitik turevler.
 * Monte Carlo dogasi geregi tam eslesmez: testi "analitik sonucun uc standart
 * hatasi icinde" diye kuruyoruz, sihirli bir esikle degil.
 */
const TOL = {
  derivative: 1e-7,
  uncertainty: 1e-12,
  regression: 1e-9,
  tQuantile: 1e-10,
};

const here = path.dirname(fileURLToPath(import.meta.url));
const ref = JSON.parse(readFileSync(path.join(here, 'fixtures', 'engineering-reference.json'), 'utf8'));
const D = ref.data;

const close = (actual, expected, tol, label) => {
  assert.ok(actual !== null && Number.isFinite(actual), `${label}: sayi beklenirken ${actual}`);
  const err = Math.abs(expected) > 1e-12
    ? Math.abs(actual - expected) / Math.abs(expected)
    : Math.abs(actual - expected);
  assert.ok(err <= tol, `${label}: bekl=${expected} bizde=${actual} hata=${err.toExponential(2)} > ${tol}`);
};

// Test modelleri
const product = ([x, y]) => x * x * y;
const ratio = ([x, y]) => x / y;
const trig = ([x, y]) => Math.sin(x) * Math.exp(y);
const cylinder = ([r, h]) => Math.PI * r * r * h;
const linear = ([a, b]) => 2 * a + 3 * b;

// --------------------------------------------------------- sayisal turev

test('adim secimi olcege gore degisiyor', () => {
  // x buyudukce adim buyur: sabit kucuk adim 1e6'da yuvarlamada kaybolur
  assert.ok(stepFor(1e6) > stepFor(1));
  assert.ok(stepFor(0) > 0, 'x = 0 iken adim sifira inmemeli');
  assert.equal(stepFor(0), stepFor(0.5), 'kucuk x icin taban 1');
});

test('sayisal kismi turev analitik turevle esliyor (3 fonksiyon)', () => {
  const cases = [
    ['product', product, ref.derivative.product],
    ['ratio', ratio, ref.derivative.ratio],
    ['trig', trig, ref.derivative.trig],
  ];
  for (const [name, model, expected] of cases) {
    expected.expected.forEach((value, index) => {
      close(partialDerivative(model, expected.at, index), value, TOL.derivative, `d(${name})/dx${index}`);
    });
  }
  assert.equal(cases.length, 3, 'is emri en az uc fonksiyon istiyor');
});

test('turev tanimsiz ya da kararsiz noktada null donuyor, cokmuyor', () => {
  // sqrt(negatif) -> NaN: model iki yanda da tanimsiz
  assert.equal(partialDerivative(([x]) => Math.sqrt(x), [-1], 0), null);
  // 1/x, x = 0: iki yan da SONLU, merkezi fark cop sayi verir (olculen 2.7e10).
  // Adim yariya indiginde tahmin ~4 kat degisiyor; tutarsizlik yakalaniyor.
  assert.equal(partialDerivative(([x]) => 1 / x, [0], 0), null, '0 etrafinda 1/x kararsiz');
  // Surekli olmayan model: basamak fonksiyonu
  assert.equal(partialDerivative(([x]) => (x < 0 ? 0 : 1), [0], 0), null, 'siçrama noktasi');

  // Kontrol duzgun fonksiyonda yanlis alarm vermiyor: turev 0 olan nokta da dahil
  close(partialDerivative(([x]) => x * x, [0], 0), 0, 1e-12, 'x² turevi x=0');
  close(partialDerivative(([x]) => Math.exp(x), [30], 0), Math.exp(30), 1e-7, 'buyuk olcekte exp');
  close(partialDerivative(([x]) => Math.cos(x), [Math.PI / 2], 0), -1, 1e-7, 'cos turevi');
  close(partialDerivative(([x]) => 1 / x, [4], 0), -1 / 16, 1e-7, 'kutuptan uzakta 1/x');
});

// --------------------------------------------------- birinci mertebe yayilim

test('silindir hacmi: GUM ornegi referansla esliyor', () => {
  const e = ref.propagation.cylinder;
  const got = propagate(cylinder, [
    { name: 'r', value: e.inputs.r, uncertainty: e.inputs.ur, unit: 'mm', df: e.inputs.dfR },
    { name: 'h', value: e.inputs.h, uncertainty: e.inputs.uh, unit: 'mm', df: e.inputs.dfH },
  ]);
  assert.equal(got.error, null);
  close(got.value, e.value, TOL.uncertainty, 'V');
  close(got.components[0].sensitivity, e.dVdr, TOL.derivative, 'dV/dr');
  close(got.components[1].sensitivity, e.dVdh, TOL.derivative, 'dV/dh');
  close(got.components[0].contribution, e.contributionR, TOL.derivative, 'katki r');
  close(got.components[1].contribution, e.contributionH, TOL.derivative, 'katki h');
  close(got.combinedUncertainty, e.combined, TOL.derivative, 'u_c');
  close(got.components[0].share, e.shareR, TOL.derivative, 'pay r');
  close(got.effectiveDf, e.effectiveDf, TOL.derivative, 'etkin sd');
  // Paylarin toplami 1
  close(got.components.reduce((a, c) => a + c.share, 0), 1, 1e-12, 'pay toplami');
});

test('dogrusal modelde yayilim analitik sonucu tam veriyor', () => {
  const e = ref.propagation.linear;
  const got = propagate(linear, [
    { name: 'a', value: e.inputs.a, uncertainty: e.inputs.ua },
    { name: 'b', value: e.inputs.b, uncertainty: e.inputs.ub },
  ]);
  close(got.value, e.value, TOL.uncertainty, 'deger');
  close(got.combinedUncertainty, e.combined, 1e-9, 'u_c');
});

test('belirsizligi girilmemis bilesen sifir sayilmiyor', () => {
  const got = propagate(cylinder, [
    { name: 'r', value: 5, uncertainty: 0.05 },
    { name: 'h', value: 12, uncertainty: null },
  ]);
  assert.equal(got.error, 'uncertainty_missing');
  assert.equal(got.combinedUncertainty, null, 'eksik bilesenle u_c hesaplanmamali');
  assert.ok(got.warnings.includes('uncertainty_missing'));
  // Deger ve duyarliliklar yine gosterilir: kullanici neyin eksik oldugunu gorur
  assert.ok(Number.isFinite(got.value));
  assert.equal(got.components[1].uncertainty, null);
  assert.equal(got.components[1].contribution, null);
  // uncertainty: 0 acikca girilmisse gecerli bir degerdir
  const zero = propagate(cylinder, [
    { name: 'r', value: 5, uncertainty: 0.05, df: 9 },
    { name: 'h', value: 12, uncertainty: 0, df: 9 },
  ]);
  assert.equal(zero.error, null);
  assert.ok(zero.combinedUncertainty > 0);
});

test('etkin serbestlik derecesi: bir bilesende sd yoksa null', () => {
  const withDf = propagate(cylinder, [
    { value: 5, uncertainty: 0.05, df: 9 }, { value: 12, uncertainty: 0.1, df: 4 },
  ]);
  assert.ok(withDf.effectiveDf > 0);
  const without = propagate(cylinder, [
    { value: 5, uncertainty: 0.05, df: 9 }, { value: 12, uncertainty: 0.1 },
  ]);
  assert.equal(without.effectiveDf, null, 'eksik sd sonsuz varsayilmamali');
  assert.equal(effectiveDegreesOfFreedom(0, []), null);
});

test('yayilim kenar durumlari', () => {
  assert.equal(propagate(null, [{ value: 1, uncertainty: 1 }]).error, 'no_data');
  assert.equal(propagate(linear, []).error, 'no_data');
  assert.equal(propagate(linear, [{ value: NaN, uncertainty: 1 }]).error, 'invalid_input');
  assert.equal(propagate(([x]) => Math.sqrt(x), [{ value: -4, uncertainty: 1 }]).error, 'model_undefined');
});

// ------------------------------------------------------- belirsizlik butcesi

test('A tipi belirsizlik referansla esliyor', () => {
  const e = ref.typeA.repeats;
  const got = typeA(D.repeats);
  assert.equal(got.n, e.n);
  close(got.mean, e.mean, TOL.uncertainty, 'ortalama');
  close(got.sd, e.sd, TOL.uncertainty, 'ss');
  close(got.uncertainty, e.uncertainty, TOL.uncertainty, 'u_A');
  assert.equal(got.df, e.df);
  assert.equal(typeA([1]).error, 'too_few');
  assert.ok(typeA([1, 2, 3]).warnings.includes('few_repeats'));
});

test('B tipi: dagilim varsayimi boleni belirliyor ve ciktida yaziyor', () => {
  close(typeB(0.6, { distribution: 'rectangular' }).uncertainty, 0.6 / Math.sqrt(3), TOL.uncertainty, 'dikdortgen');
  close(typeB(0.6, { distribution: 'triangular' }).uncertainty, 0.6 / Math.sqrt(6), TOL.uncertainty, 'ucgen');
  close(typeB(0.6, { distribution: 'uShaped' }).uncertainty, 0.6 / Math.sqrt(2), TOL.uncertainty, 'U');
  // Sertifika: U ve k verilir
  close(typeB(0.8, { distribution: 'normal', k: 2 }).uncertainty, 0.4, TOL.uncertainty, 'normal k=2');
  assert.equal(typeB(0.6).distribution, 'rectangular', 'varsayilan dikdortgen');
  assert.equal(typeB(0.6, { distribution: 'kare' }).error, 'unknown_distribution');
  assert.equal(typeB(-1).error, 'invalid_input');
  assert.ok(typeB(0.5).warnings.includes('df_unknown'), 'sd bilinmiyorsa soylenir');
  assert.equal(Object.keys(TYPE_B_DIVISORS).length, 4);
});

test('butce: katki paylari, baskin bilesen ve eksik bilesen', () => {
  const got = combine([
    { name: 'okuma', kind: 'A', uncertainty: 0.02, df: 9 },
    { name: 'cozunurluk', kind: 'B', uncertainty: 0.0029, df: null },
    { name: 'kalibrasyon', kind: 'B', uncertainty: 0.015, df: 50 },
  ]);
  close(got.combinedUncertainty, Math.sqrt(0.02 ** 2 + 0.0029 ** 2 + 0.015 ** 2), TOL.uncertainty, 'u_c');
  close(got.budget.reduce((a, c) => a + c.share, 0), 1, 1e-12, 'pay toplami');
  assert.equal(got.dominant, 'okuma');
  assert.ok(got.warnings.includes('df_unknown'), 'bir bilesende sd yok');
  assert.equal(got.effectiveDf, null);

  const missing = combine([{ name: 'a', uncertainty: 0.1 }, { name: 'b', uncertainty: null }]);
  assert.equal(missing.error, 'uncertainty_missing');
  assert.equal(missing.combinedUncertainty, null);
  assert.equal(combine([]).error, 'no_data');

  const dominant = combine([{ uncertainty: 1, df: 9 }, { uncertainty: 0.01, df: 9 }]);
  assert.ok(dominant.warnings.includes('single_dominant_component'));
});

test('duyarlilik katsayisi verilmezse 1 sayiliyor ama katki ona gore', () => {
  const got = combine([
    { name: 'dogrudan', uncertainty: 0.5 },
    { name: 'olcekli', uncertainty: 0.5, sensitivity: -4 },
  ]);
  close(got.budget[0].contribution, 0.5, TOL.uncertainty, 'dogrudan katki');
  close(got.budget[1].contribution, 2, TOL.uncertainty, 'olcekli katki (isaret mutlak)');
});

// ------------------------------------------------- genisletilmis belirsizlik

test('t dagilimi ters fonksiyonu referansla esliyor', () => {
  for (const [expected, p, df] of ref.tQuantile) {
    close(tQuantile(p, df), expected, TOL.tQuantile, `t_${p}(${df})`);
  }
  assert.ok(Number.isNaN(tQuantile(0, 5)));
  assert.ok(Number.isNaN(tQuantile(0.5, 0)));
});

test('genisletilmis belirsizlik k ve kapsam olasiligi ile birlikte donuyor', () => {
  const e = ref.propagation.cylinder;
  const withDf = expand(e.combined, { value: e.value, effectiveDf: e.effectiveDf });
  close(withDf.k, e.tCrit95EffDf, TOL.tQuantile, 'k (t)');
  close(withDf.expanded, e.expandedT, TOL.tQuantile, 'U (t)');
  assert.equal(withDf.basis, 't');
  assert.equal(withDf.level, 0.95);
  close(withDf.interval.upper - withDf.interval.lower, 2 * e.expandedT, TOL.tQuantile, 'aralik genisligi');

  // Serbestlik derecesi yoksa normal dagilim, ama bu soylenir
  const withoutDf = expand(e.combined, { value: e.value });
  close(withoutDf.expanded, e.expandedNormal, 1e-10, 'U (normal)');
  assert.equal(withoutDf.basis, 'normal');
  assert.ok(withoutDf.warnings.includes('df_unknown_normal_assumed'));

  // k elle verilirse o kullanilir
  const given = expand(0.5, { k: 3, level: 0.997 });
  assert.equal(given.k, 3);
  assert.equal(given.basis, 'given');
  close(given.expanded, 1.5, TOL.uncertainty, 'U (k verildi)');

  // Her ciktida k ve kapsam olasiligi dolu
  for (const out of [withDf, withoutDf, given]) {
    assert.ok(Number.isFinite(out.k) && out.k > 0, 'k eksik');
    assert.ok(out.level > 0 && out.level < 1, 'kapsam olasiligi eksik');
  }
  assert.equal(expand(-1).error, 'invalid_input');
  assert.equal(expand(0.5, { level: 1 }).error, 'invalid_input');
  assert.equal(expand(0.5).interval, null, 'deger verilmezse aralik yok');
});

// ------------------------------------------------------------- Monte Carlo

test('tohumlanabilir ureteç: ayni tohum ayni diziyi veriyor', () => {
  const a = createRandom(42);
  const b = createRandom(42);
  const c = createRandom(43);
  const first = Array.from({ length: 5 }, () => a());
  const second = Array.from({ length: 5 }, () => b());
  const other = Array.from({ length: 5 }, () => c());
  assert.deepEqual(first, second, 'ayni tohum ayni dizi');
  assert.notDeepEqual(first, other, 'farkli tohum farkli dizi');
  assert.ok(first.every((v) => v >= 0 && v < 1));
});

test('ureteç duzgun dagiliyor (ortalama ve varyans)', () => {
  const random = createRandom(7);
  const n = 200000;
  let total = 0;
  let squares = 0;
  for (let i = 0; i < n; i++) {
    const v = random();
    total += v;
    squares += v * v;
  }
  const average = total / n;
  const variance = squares / n - average * average;
  // Duzgun dagilim: ortalama 0.5, varyans 1/12
  assert.ok(Math.abs(average - 0.5) < 0.005, `ortalama ${average}`);
  assert.ok(Math.abs(variance - 1 / 12) < 0.005, `varyans ${variance}`);
});

test('Monte Carlo ayni tohumla yinelenen sonuc veriyor', () => {
  const inputs = [{ value: 10, uncertainty: 0.3 }, { value: 20, uncertainty: 0.4 }];
  const first = monteCarlo(linear, inputs, { trials: 20000, seed: 99 });
  const again = monteCarlo(linear, inputs, { trials: 20000, seed: 99 });
  const different = monteCarlo(linear, inputs, { trials: 20000, seed: 100 });
  assert.equal(first.value, again.value, 'ayni tohum ayni sonuc');
  assert.equal(first.standardUncertainty, again.standardUncertainty);
  assert.notEqual(first.value, different.value);
  assert.equal(first.seed, 99, 'tohum ciktida duruyor');
});

test('Monte Carlo dogrusal modelde analitik sonuca yakinsiyor', () => {
  const e = ref.propagation.linear;
  const inputs = [
    { value: e.inputs.a, uncertainty: e.inputs.ua },
    { value: e.inputs.b, uncertainty: e.inputs.ub },
  ];
  const trials = 200000;
  const got = monteCarlo(linear, inputs, { trials, seed: 2026 });
  // Ortalamanin standart hatasi u/sqrt(n); esik uc standart hata
  const seMean = e.combined / Math.sqrt(trials);
  assert.ok(Math.abs(got.value - e.value) < 3 * seMean, `deger ${got.value} vs ${e.value}`);
  // Standart sapmanin standart hatasi yaklasik u/sqrt(2n)
  const seSd = e.combined / Math.sqrt(2 * trials);
  assert.ok(Math.abs(got.standardUncertainty - e.combined) < 3 * seSd,
    `u ${got.standardUncertainty} vs ${e.combined}`);
  // Dogrusal modelde birinci mertebe ile fark olmamali
  assert.ok(got.linearityGap < 0.02, `fark ${got.linearityGap}`);
  assert.ok(!got.warnings.includes('nonlinear_model'));
  assert.equal(got.coverageInterval.level, 0.95);
  assert.equal(got.coverageInterval.method, 'symmetric_percentile');
});

test('dogrusal olmayan modelde birinci mertebe ile fark isaretleniyor', () => {
  // y = exp(x), x'in belirsizligi buyuk: dogrusallastirma kiriliyor
  const exponential = ([x]) => Math.exp(x);
  const got = monteCarlo(exponential, [{ value: 1, uncertainty: 0.8 }], { trials: 100000, seed: 5 });
  assert.ok(got.linearityGap > 0.1, `fark ${got.linearityGap}`);
  assert.ok(got.warnings.includes('nonlinear_model'));
  // Birinci mertebe sonucu da donuyor: kullanici ikisini karsilastirabilir
  assert.ok(Number.isFinite(got.firstOrder));
});

test('Monte Carlo dagilim secenekleri ve kenar durumlari', () => {
  const base = { value: 5, uncertainty: 0.2 };
  for (const distribution of ['normal', 'rectangular', 'triangular']) {
    const got = monteCarlo(([x]) => x, [{ ...base, distribution }], { trials: 50000, seed: 11 });
    assert.equal(got.error, null, distribution);
    // Hangi dagilim olursa olsun standart belirsizlik korunur
    assert.ok(Math.abs(got.standardUncertainty - 0.2) < 0.01, `${distribution}: ${got.standardUncertainty}`);
  }
  const student = monteCarlo(([x]) => x, [{ ...base, distribution: 'student', df: 10 }], { trials: 50000, seed: 12 });
  assert.equal(student.error, null);
  assert.ok(Math.abs(student.standardUncertainty - 0.2) < 0.02, `student: ${student.standardUncertainty}`);

  assert.equal(monteCarlo(([x]) => x, [{ ...base, distribution: 'kare' }]).error, 'unknown_distribution');
  assert.equal(monteCarlo(([x]) => x, [{ ...base, distribution: 'student', df: 1 }]).error, 'invalid_input');
  assert.equal(monteCarlo(([x]) => x, [{ value: 5, uncertainty: null }]).error, 'uncertainty_missing');
  assert.equal(monteCarlo(([x]) => x, []).error, 'no_data');
  assert.equal(monteCarlo(([x]) => x, [base], { trials: 10 }).error, 'too_few_trials');
});

test('tanimsiz kalan cekilisler atiliyor ve sayisi raporlaniyor', () => {
  // x ~ N(0.5, 1): cekilislerin bir kismi negatif, sqrt tanimsiz
  const got = monteCarlo(([x]) => Math.sqrt(x), [{ value: 0.5, uncertainty: 1 }], { trials: 20000, seed: 3 });
  assert.ok(got.discarded > 0, 'bir kismi atilmali');
  assert.equal(got.trials + got.discarded, 20000);
  assert.ok(got.warnings.includes('discarded_trials'));
  // Tamami tanimsizsa hata
  const allBad = monteCarlo(() => NaN, [{ value: 1, uncertainty: 0.1 }], { trials: 1000, seed: 4 });
  assert.equal(allBad.error, 'model_undefined');
});

// -------------------------------------------------------------- regresyon

test('dogrusal regresyon referansla esliyor (2 veri kumesi)', () => {
  const cases = { calibration: ['calX', 'calY'], noisy: ['noisyX', 'noisyY'] };
  for (const [label, [xk, yk]] of Object.entries(cases)) {
    const e = ref.regression[label];
    const got = linearRegression(D[xk], D[yk]);
    assert.equal(got.error, null, label);
    assert.equal(got.n, e.n);
    assert.equal(got.df, e.df);
    for (const field of ['slope', 'intercept', 'slopeSe', 'interceptSe', 'slopeP', 'r', 'r2', 'adjustedR2', 'residualSd']) {
      close(got[field], e[field], TOL.regression, `${label}.${field}`);
    }
    close(got.anova.f, e.anovaF, TOL.regression, `${label}.anova.f`);
    close(got.anova.p, e.anovaP, TOL.regression, `${label}.anova.p`);
    assert.equal(got.anova.df1, 1);
    assert.equal(got.anova.df2, e.df);
    // R² tek basina donmuyor: artik ss ve F yaninda
    assert.ok(Number.isFinite(got.residualSd) && got.anova !== null);
  }
});

test('kestirim: guven araligi ve kestirim araligi ayri ve referansla esliyor', () => {
  const e = ref.regression.noisy;
  const fit = linearRegression(D.noisyX, D.noisyY);
  const got = predict(fit, e.predictAt);
  close(got.fitted, e.fitted, TOL.regression, 'uydurulmus deger');
  close(got.confidenceInterval.upper - got.fitted, e.ciHalf, TOL.regression, 'GA yarim genislik');
  close(got.predictionInterval.upper - got.fitted, e.piHalf, TOL.regression, 'KA yarim genislik');
  // Kestirim araligi her zaman daha genis: artik varyansi da iceriyor
  assert.ok(e.piHalf > e.ciHalf);
  assert.equal(got.confidenceInterval.of, 'mean_response');
  assert.equal(got.predictionInterval.of, 'single_observation');
  assert.equal(got.extrapolation, false);
});

test('veri araligi disinda kestirim isaretleniyor', () => {
  const fit = linearRegression(D.noisyX, D.noisyY);
  const outside = predict(fit, 25);
  assert.equal(outside.extrapolation, true);
  assert.ok(outside.warnings.includes('extrapolation'));
  const inside = predict(fit, 5);
  assert.equal(inside.extrapolation, false);
  assert.ok(!inside.warnings.includes('extrapolation'));
  // Sinirda: aralik icinde sayilir
  assert.equal(predict(fit, fit.xRange.max).extrapolation, false);
});

test('kalibrasyondan tersine okuma ve belirsizligi', () => {
  const fit = linearRegression(D.calX, D.calY);
  const got = inverseCalibration(fit, 0.5);
  // Egim ~0.0988, kesme ~0.0085: x = (0.5 - b)/a
  close(got.value, (0.5 - fit.intercept) / fit.slope, 1e-12, 'ters okuma');
  assert.ok(got.uncertainty > 0);
  assert.ok(got.interval.lower < got.value && got.value < got.interval.upper);
  assert.equal(got.extrapolation, false);
  // Tekrar sayisi artarsa belirsizlik azalir
  const repeated = inverseCalibration(fit, 0.5, { replicates: 5 });
  assert.ok(repeated.uncertainty < got.uncertainty);
  // Egim anlamsizsa sonuc verilmez: bolme buyuk belirsizligi gizler
  const flat = linearRegression([1, 2, 3, 4, 5], [5.0, 5.1, 4.9, 5.05, 4.95]);
  assert.equal(inverseCalibration(flat, 5).error, 'slope_not_significant');
  assert.equal(inverseCalibration(fit, NaN).error, 'invalid_input');
  assert.equal(inverseCalibration(fit, 0.5, { replicates: 0 }).error, 'invalid_input');
});

test('regresyon kenar durumlari: az nokta, sabit x, tam uyum, eksik veri', () => {
  assert.equal(linearRegression([1, 2], [3, 4]).error, 'too_few', 'iki noktada artik yok');
  assert.equal(linearRegression([5, 5, 5, 5], [1, 2, 3, 4]).error, 'zero_variance');

  const perfect = linearRegression([1, 2, 3, 4], [2, 4, 6, 8]);
  assert.equal(perfect.error, null);
  close(perfect.slope, 2, 1e-12, 'tam uyum egimi');
  assert.equal(perfect.residualSd, 0);
  assert.equal(perfect.slopeSe, null, 'standart hata sifir degil, tanimsiz');
  assert.equal(perfect.slopeT, null);
  assert.equal(perfect.anova, null);
  assert.ok(perfect.warnings.includes('perfect_fit'));
  assert.equal(predict(perfect, 5).confidenceInterval, null);
  assert.equal(inverseCalibration(perfect, 5).error, 'perfect_fit');

  const gaps = linearRegression([1, 2, null, 4, 5], [2, 4.1, 6, null, 10.2]);
  assert.equal(gaps.n, 3);
  assert.equal(gaps.dropped, 2);
  assert.ok(gaps.warnings.includes('dropped_values'));
  assert.equal(predict(linearRegression([1, 2], [3, 4]), 5).error, 'too_few');
});

test('her cikti kendi kokenini tasiyor (origin: computed)', () => {
  const fit = linearRegression(D.noisyX, D.noisyY);
  const results = [
    propagate(linear, [{ value: 1, uncertainty: 0.1 }, { value: 2, uncertainty: 0.2 }]),
    typeA(D.repeats),
    typeB(0.5),
    combine([{ uncertainty: 0.1, df: 9 }]),
    expand(0.1, { effectiveDf: 9 }),
    monteCarlo(linear, [{ value: 1, uncertainty: 0.1 }, { value: 2, uncertainty: 0.2 }], { trials: 1000 }),
    fit,
    predict(fit, 5),
    inverseCalibration(linearRegression(D.calX, D.calY), 0.5),
  ];
  for (const r of results) assert.equal(r.origin, 'computed', r.test || r.kind);
});
