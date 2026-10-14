import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  erfc, fUpperTailP, incompleteBeta, incompleteGamma, incompleteGammaUpper,
  logGamma, normalCdf, normalQuantile, tCdf, tTwoTailedP,
} from '../src/stats/distributions.js';
import { cleanNumbers, describe, kurtosis, median, sd, skewness, variance } from '../src/stats/descriptives.js';
import { shapiroWeights, shapiroWilk } from '../src/stats/normality.js';
import { independentT, levene, pairedT } from '../src/stats/ttest.js';
import { pearson, ranks, spearman } from '../src/stats/correlation.js';
import { cronbachAlpha } from '../src/stats/reliability.js';
import {
  apaAlpha, apaCorrelation, apaDescriptives, apaIndependentT, apaPairedT, apaShapiro,
  formatDf, formatNumber, formatP, significanceSentence,
} from '../src/stats/apa.js';

/**
 * WO-006 capraz dogrulama.
 *
 * Referans: SciPy 1.17.1 / NumPy 2.2.6. Is emri R'yi tercih ediyordu; bu
 * makinede R kurulu degil ve yedek yol SciPy olarak yazilmisti. Uretim
 * komutu fixture'in basinda duruyor.
 *
 * Tolerans tablosu (is emrinden). Shapiro-Wilk'in toleransi bilerek gevsek:
 * Royston AS R94 yaklasik bir algoritma ve p degeri log donusumunden geciyor.
 * Olculen gercek sapma cok daha kucuk ve asagida ayrica yaziliyor.
 */
const TOL = {
  descriptives: 1e-9,
  shapiroW: 1e-6,
  shapiroP: 1e-4,
  ttest: 1e-9,
  levene: 1e-7,
  correlation: 1e-9,
  correlationCi: 1e-6,
  alpha: 1e-7,
};

const here = path.dirname(fileURLToPath(import.meta.url));
const ref = JSON.parse(readFileSync(path.join(here, 'fixtures', 'stats-reference.json'), 'utf8'));
const D = ref.data;

/** Bagil hata karsilastirmasi; sifira yakin beklenen degerde mutlak hataya duser. */
const close = (actual, expected, tol, label) => {
  assert.ok(actual !== null && Number.isFinite(actual), `${label}: sayi beklenirken ${actual}`);
  const err = Math.abs(expected) > 1e-12
    ? Math.abs(actual - expected) / Math.abs(expected)
    : Math.abs(actual - expected);
  assert.ok(err <= tol, `${label}: bekl=${expected} bizde=${actual} hata=${err.toExponential(2)} > ${tol}`);
};

// ---------------------------------------------------------------- dagilimlar

test('logGamma bilinen degerleri veriyor', () => {
  close(logGamma(1), 0, 1e-15, 'logGamma(1)');
  close(logGamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-14, 'logGamma(0.5)');
  // Γ(6) = 120
  close(Math.exp(logGamma(6)), 120, 1e-13, 'Gamma(6)');
  assert.ok(Number.isNaN(logGamma(0)));
});

test('eksik beta ve gama sinirlarda tutarli', () => {
  assert.equal(incompleteBeta(2, 3, 0), 0);
  assert.equal(incompleteBeta(2, 3, 1), 1);
  close(incompleteBeta(0.5, 0.5, 0.5), 0.5, 1e-14, 'I_0.5(0.5,0.5)');
  assert.equal(incompleteGamma(1, 0), 0);
  close(incompleteGamma(1, 1), 1 - Math.exp(-1), 1e-14, 'P(1,1)');
  // Ust kuyruk dogrudan hesaplaniyor: P + Q = 1
  for (const x of [0.1, 1, 3, 10, 40]) {
    close(incompleteGamma(2.5, x) + incompleteGammaUpper(2.5, x), 1, 1e-14, `P+Q (x=${x})`);
  }
});

test('ust kuyruk cikarmayla hesaplanmiyor: Phi(-8) basamak kaybetmiyor', () => {
  // Duzeltme oncesi 0.5*(1+erf(z/sqrt2)) yoluyla bagil hata 1.8e-2'ydi.
  close(normalCdf(-8), 6.22096057427174e-16, 1e-12, 'normalCdf(-8)');
  close(erfc(6), 2.1519736712498913e-17, 1e-12, 'erfc(6)');
  close(fUpperTailP(30, 1, 100), 3.2277008422573064e-7, 1e-12, 'F ust kuyruk');
});

test('normalCdf ve normalQuantile birbirinin tersi', () => {
  for (const p of [1e-10, 1e-6, 0.001, 0.025, 0.3, 0.5, 0.975, 0.999, 1 - 1e-9]) {
    close(normalCdf(normalQuantile(p)), p, 1e-12, `tersi (p=${p})`);
  }
  close(normalQuantile(0.975), 1.959963984540054, 1e-13, 'z_.975');
  assert.ok(Number.isNaN(normalQuantile(0)));
  assert.ok(Number.isNaN(normalQuantile(1)));
});

test('t ve F dagilimlari bilinen degerleri veriyor', () => {
  close(tTwoTailedP(0, 7), 1, 1e-15, 't=0');
  close(tTwoTailedP(2.306004135, 8), 0.05, 1e-9, 't_.975(8)');
  close(tCdf(0, 5), 0.5, 1e-15, 'tCdf(0)');
  close(fUpperTailP(1, 1, 1), 0.5, 1e-12, 'F(1,1,1)');
  assert.equal(fUpperTailP(0, 2, 10), 1);
});

// --------------------------------------------------------------- betimseller

test('eksik veri ayiklaniyor ve sayisi raporlaniyor', () => {
  const { values, dropped } = cleanNumbers([1, '2', null, '', NaN, 'abc', undefined, Infinity, true, '3,5']);
  assert.deepEqual(values, [1, 2, 3.5]);
  assert.equal(dropped, 7);
  const out = describe([5, 'x', null, 7, 9]);
  assert.equal(out.n, 3);
  assert.equal(out.dropped, 2);
  assert.ok(out.warnings.includes('dropped_values'));
});

test('betimsel istatistikler referansla esliyor (3 veri kumesi)', () => {
  for (const [key, expected] of Object.entries(ref.descriptives)) {
    const got = describe(D[key]);
    assert.equal(got.n, expected.n, `${key}.n`);
    assert.equal(got.origin, 'computed');
    for (const field of ['mean', 'sd', 'median', 'min', 'max', 'variance', 'skewness', 'kurtosis']) {
      close(got[field], expected[field], TOL.descriptives, `desc.${key}.${field}`);
    }
  }
  // Kume sayisi: tipik, kucuk orneklem ve kenar durumlar birlikte
  assert.ok(Object.keys(ref.descriptives).length >= 3);
});

test('kenar durumlar: bos, tek deger, sifir varyans — cokme yok, null doner', () => {
  const empty = describe([]);
  assert.equal(empty.error, 'no_data');
  assert.equal(empty.mean, null);
  assert.equal(empty.sd, null);

  const single = describe([42]);
  assert.equal(single.n, 1);
  assert.equal(single.mean, 42);
  assert.equal(single.sd, null, 'n=1 icin ss tanimsiz');
  assert.equal(single.skewness, null);

  const constant = describe([3, 3, 3, 3, 3]);
  assert.equal(constant.sd, 0);
  assert.equal(constant.skewness, null, 'sifir varyansta carpiklik tanimsiz');
  assert.equal(constant.kurtosis, null);
  assert.ok(constant.warnings.includes('zero_variance'));

  assert.equal(variance([1]), null);
  assert.equal(sd([]), null);
  assert.equal(median([]), null);
  assert.equal(skewness([1, 2]), null);
  assert.equal(kurtosis([1, 2, 3]), null, 'basiklik n>=4 ister');
});

test('medyan tek ve cift n icin dogru, girdiyi bozmuyor', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  const input = [5, 1, 3];
  median(input);
  assert.deepEqual(input, [5, 1, 3], 'siralama girdiyi degistirmemeli');
});

// ------------------------------------------------------------ Shapiro-Wilk

test('Shapiro-Wilk agirliklari: toplam 0, kareler toplami tam 1', () => {
  for (const n of [3, 4, 5, 6, 7, 12, 30, 101, 500]) {
    const a = shapiroWeights(n);
    assert.equal(a.length, n);
    const total = a.reduce((x, y) => x + y, 0);
    const squares = a.reduce((x, y) => x + y * y, 0);
    assert.ok(Math.abs(total) < 1e-12, `n=${n} agirlik toplami ${total}`);
    assert.ok(Math.abs(squares - 1) < 1e-12, `n=${n} kareler toplami ${squares}`);
    // Antisimetri: en kucuk gozlem negatif, en buyuk pozitif agirlik alir
    assert.ok(a[0] < 0 && a[n - 1] > 0);
  }
  assert.equal(shapiroWeights(2), null);
});

test('Shapiro-Wilk W ve p referansla esliyor', () => {
  let worstW = 0;
  let worstP = 0;
  for (const [key, expected] of Object.entries(ref.shapiro)) {
    const got = shapiroWilk(D[key]);
    close(got.w, expected.w, TOL.shapiroW, `shapiro.${key}.w`);
    close(got.p, expected.p, TOL.shapiroP, `shapiro.${key}.p`);
    worstW = Math.max(worstW, Math.abs(got.w - expected.w) / Math.abs(expected.w));
    worstP = Math.max(worstP, Math.abs(got.p - expected.p) / Math.abs(expected.p));
  }
  // Olculen sapma, izin verilen toleransin cok altinda: gevsek tolerans
  // kullanilmadi, yalnizca emniyet payi olarak duruyor.
  assert.ok(worstW < 1e-8, `W sapmasi ${worstW.toExponential(2)}`);
  assert.ok(worstP < 1e-6, `p sapmasi ${worstP.toExponential(2)}`);
});

test('Shapiro-Wilk kenar durumlari', () => {
  assert.equal(shapiroWilk([1, 2]).error, 'too_few');
  assert.equal(shapiroWilk([4, 4, 4, 4]).error, 'zero_variance');
  assert.equal(shapiroWilk(Array.from({ length: 5001 }, (_, i) => i)).error, 'too_many');
  // n = 3 kesin dagilimdan: W her zaman >= 0.75
  const three = shapiroWilk([1, 2, 10]);
  assert.ok(three.w >= 0.75 && three.w <= 1);
  assert.ok(three.p >= 0 && three.p <= 1);
});

test('normallik reddedilince parametrik olmayan alternatif adiyla oneriliyor', () => {
  const skewed = shapiroWilk(D.skewed);
  assert.equal(skewed.normal, false, 'carpik veri normal sayilmamali');
  assert.equal(skewed.alternative, 'mann_whitney_or_wilcoxon');
  const normal = shapiroWilk(D.typical30);
  assert.equal(normal.normal, true);
  assert.equal(normal.alternative, null);
});

// --------------------------------------------------------------- t-testleri

test('bagimsiz t: Student, Welch, Levene ve d referansla esliyor', () => {
  const cases = { equalSize: ['groupA', 'groupB'], unevenSize: ['groupA', 'groupUneven'], tiedVsSkewed: ['tied', 'skewed'] };
  for (const [key, [a, b]] of Object.entries(cases)) {
    const expected = ref.independentT[key];
    const got = independentT(D[a], D[b]);
    for (const field of ['t', 'df', 'p']) {
      close(got.student[field], expected.student[field], TOL.ttest, `ind.${key}.student.${field}`);
      close(got.welch[field], expected.welch[field], TOL.ttest, `ind.${key}.welch.${field}`);
    }
    close(got.cohensD, expected.cohensD, TOL.ttest, `ind.${key}.d`);
    close(got.levene.f, expected.levene.f, TOL.levene, `ind.${key}.levene.f`);
    close(got.levene.p, expected.levene.p, TOL.levene, `ind.${key}.levene.p`);
    assert.equal(got.levene.df1, expected.levene.df1);
    assert.equal(got.levene.df2, expected.levene.df2);
    assert.equal(got.levene.center, 'mean', 'SPSS ile ayni merkezleme');
  }
});

test('Levene anlamliysa Welch onerilir, degilse Student', () => {
  const same = independentT(D.groupA, D.groupB);
  assert.ok(same.levene.p > 0.05);
  assert.equal(same.recommended, 'student');

  const different = independentT(D.tied, D.skewed);
  assert.ok(different.levene.p < 0.05, 'bu iki kumenin varyansi acikca farkli');
  assert.equal(different.recommended, 'welch');
  assert.ok(different.warnings.includes('unequal_variances'));
});

test('Levene uc grupla da referansla esliyor', () => {
  const expected = ref.levene.threeGroups;
  const got = levene([D.groupA, D.groupB, D.groupUneven]);
  close(got.f, expected.f, TOL.levene, 'levene3.f');
  close(got.p, expected.p, TOL.levene, 'levene3.p');
  assert.equal(got.df1, expected.df1);
  assert.equal(got.df2, expected.df2);
  assert.equal(levene([[1, 2]]).error, 'too_few');
  assert.equal(levene([[5, 5, 5], [7, 7, 7]]).error, 'zero_variance');
});

test('eslestirilmis t referansla esliyor', () => {
  const expected = ref.pairedT.prePost;
  const got = pairedT(D.pre, D.post);
  for (const field of ['t', 'df', 'p', 'meanDifference', 'sdDifference', 'cohensD']) {
    close(got[field], expected[field], TOL.ttest, `paired.${field}`);
  }
  assert.equal(got.dType, 'dz');
});

test('eslestirilmis t: eksik yani olan cift tamamen dusuyor', () => {
  const got = pairedT([1, 2, null, 4, 5], [2, 4, 6, null, 10]);
  assert.equal(got.n, 3, 'iki cift dusmeli');
  assert.equal(got.dropped, 2);
  assert.ok(got.warnings.includes('dropped_values'));
  // Liste boylari farkliysa fazlasi da dusuyor
  assert.equal(pairedT([1, 2, 3], [2, 4]).n, 2);
});

test('t-testi kenar durumlari: yetersiz veri ve sifir varyans', () => {
  assert.equal(independentT([1], [2, 3]).error, 'too_few');
  assert.equal(pairedT([1], [2]).error, 'too_few');
  const flat = independentT([5, 5, 5], [5, 5, 5]);
  assert.equal(flat.error, 'zero_variance');
  assert.equal(flat.student, null);
  const flatPaired = pairedT([1, 2, 3], [2, 3, 4]);
  assert.equal(flatPaired.error, 'zero_variance', 'tum farklar ayni');
  assert.equal(flatPaired.t, null);
});

// -------------------------------------------------------------- korelasyon

test('ortalama siralar: bagli degerler ayni sirayi aliyor', () => {
  assert.deepEqual(ranks([10, 20, 30]), [1, 2, 3]);
  assert.deepEqual(ranks([10, 10, 30]), [1.5, 1.5, 3]);
  assert.deepEqual(ranks([5, 5, 5, 5]), [2.5, 2.5, 2.5, 2.5]);
  assert.deepEqual(ranks([30, 10, 20]), [3, 1, 2]);
});

test('Pearson ve Spearman referansla esliyor, GA dahil', () => {
  const cases = { positive: ['corrX', 'corrY'], negative: ['corrX', 'corrNeg'] };
  for (const [key, [x, y]] of Object.entries(cases)) {
    const ep = ref.pearson[key];
    const gp = pearson(D[x], D[y]);
    close(gp.r, ep.r, TOL.correlation, `pearson.${key}.r`);
    close(gp.p, ep.p, TOL.correlation, `pearson.${key}.p`);
    close(gp.ci.lower, ep.ciLower, TOL.correlationCi, `pearson.${key}.ci.lower`);
    close(gp.ci.upper, ep.ciHigh, TOL.correlationCi, `pearson.${key}.ci.upper`);
    assert.equal(gp.ci.level, 0.95);

    const es = ref.spearman[key];
    const gs = spearman(D[x], D[y]);
    close(gs.r, es.r, TOL.correlation, `spearman.${key}.r`);
    close(gs.p, es.p, TOL.correlation, `spearman.${key}.p`);
    assert.equal(gs.method, 't_approximation', 'yaklasim oldugu cikti icinde yaziyor');
  }
});

test('Spearman bagli degerlerle de referansla esliyor', () => {
  const expected = ref.spearman.tied;
  const got = spearman(D.tied, D.skewed.slice(0, 12));
  close(got.r, expected.r, TOL.correlation, 'spearman.tied.r');
  close(got.p, expected.p, TOL.correlation, 'spearman.tied.p');
});

test('korelasyon kenar durumlari: eksik cift, sabit degisken, tam iliski', () => {
  const dropped = pearson([1, 2, null, 4], [2, 4, 6, 8]);
  assert.equal(dropped.n, 3);
  assert.equal(dropped.dropped, 1);

  assert.equal(pearson([1, 2], [3, 4]).error, 'too_few');
  assert.equal(pearson([5, 5, 5, 5], [1, 2, 3, 4]).error, 'zero_variance');
  assert.equal(spearman([5, 5, 5, 5], [1, 2, 3, 4]).error, 'zero_variance');

  const perfect = pearson([1, 2, 3, 4], [2, 4, 6, 8]);
  assert.equal(perfect.r, 1);
  assert.equal(perfect.p, 0);
  assert.equal(perfect.t, null, 't sonsuz: sayi uydurulmuyor');
  assert.ok(perfect.warnings.includes('perfect_correlation'));
  assert.equal(perfect.ci, null, '|r| = 1 icin Fisher donusumu tanimsiz');
});

// ------------------------------------------------------------- Cronbach alfa

test('Cronbach alfa ve madde-toplam korelasyonlari referansla esliyor', () => {
  for (const [key, expected] of Object.entries(ref.cronbach)) {
    const got = cronbachAlpha(ref.matrix[key]);
    // Referans kovaryans ortalamasi yolundan, bizdeki varyans toplami
    // yolundan geliyor: iki farkli cebirsel yol, ayni sonuc.
    close(got.alpha, expected.alpha, TOL.alpha, `alpha.${key}`);
    assert.equal(got.k, expected.k);
    assert.equal(got.n, expected.n);
    expected.itemTotal.forEach((value, i) => {
      close(got.itemTotalCorrelations[i], value, TOL.correlation, `alpha.${key}.itemTotal[${i}]`);
    });
  }
});

test('alfa kenar durumlari: eksik satir, yetersiz madde, sabit toplam', () => {
  const withGap = cronbachAlpha([[4, 5, 3], [5, null, 4], [3, 2, 3], [4, 4, 4], [2, 1, 2]]);
  assert.equal(withGap.n, 4, 'eksik hucreli satir dusuyor');
  assert.equal(withGap.dropped, 1);

  assert.equal(cronbachAlpha([[1], [2]]).error, 'too_few', 'tek madde');
  assert.equal(cronbachAlpha([[1, 2, 3]]).error, 'too_few', 'tek katilimci');
  assert.equal(cronbachAlpha([[1, 2], [2, 1], [3, 0]]).error, 'zero_variance', 'toplam sabit');
  // Farkli uzunluktaki satir da dusuyor
  assert.equal(cronbachAlpha([[4, 5, 3], [5, 4], [3, 2, 3], [4, 4, 4]]).dropped, 1);
});

test('madde atilirsa alfa alani k > 2 oldugunda dolu', () => {
  const five = cronbachAlpha(ref.matrix.likert);
  assert.equal(five.alphaIfDeleted.length, 5);
  assert.ok(five.alphaIfDeleted.every((v) => v === null || Number.isFinite(v)));
  const two = cronbachAlpha([[4, 5], [5, 4], [3, 2], [4, 4], [2, 1]]);
  assert.equal(two.alphaIfDeleted, null, 'iki maddede madde atmak anlamsiz');
  assert.ok(two.warnings.includes('few_items'));
});

// --------------------------------------------- APA bicimi ve durustluk kurallari

test('p = .000 hicbir ciktida basilmiyor', () => {
  assert.equal(formatP(0), 'p < ,001');
  assert.equal(formatP(1e-20), 'p < ,001');
  assert.equal(formatP(0.0009), 'p < ,001');
  assert.equal(formatP(0.0009, { lang: 'en' }), 'p < .001');
  assert.equal(formatP(1), 'p > ,999');
  assert.equal(formatP(0.032, { lang: 'en' }), 'p = .032');
  assert.equal(formatP(null), null);

  // Her testin APA ciktisi tarandi: ".000" ya da ",000" gecmiyor
  const outputs = [
    apaShapiro(shapiroWilk(D.skewed)),
    apaIndependentT(independentT(D.groupA, D.groupB)),
    apaPairedT(pairedT(D.pre, D.post)),
    apaCorrelation(pearson(D.corrX, D.corrY)),
    apaCorrelation(pearson([1, 2, 3, 4], [2, 4, 6, 8])),
    apaAlpha(cronbachAlpha(ref.matrix.likert)),
    apaDescriptives(describe(D.typical30)),
  ];
  for (const out of outputs) {
    const text = `${out.text || ''} ${out.conclusion || ''} ${out.notes.join(' ')}`;
    // Yalniz p degerine bakilir: "r = 1,000" mesru bir tam korelasyondur.
    assert.ok(!/p\s*=\s*[.,]0+(?!\d)/.test(text), `"${text}" icinde sifira yuvarlanmis p var`);
  }
});

test('etki buyuklugu olmadan anlamlilik iddiasi uretilmiyor', () => {
  // Yasak olan, iddia kalibi: "istatistiksel olarak anlamli". Gerekce
  // cumlesindeki "anlamlilik yorumu yapilmiyor" ifadesi iddia degil.
  const CLAIM = /istatistiksel olarak anlamlı/;
  const CLAIM_EN = /statistically significant/;

  const withEffect = significanceSentence({ p: 0.01, effectSize: 0.8 });
  assert.match(withEffect, CLAIM);

  for (const missing of [null, undefined, NaN]) {
    const out = significanceSentence({ p: 0.01, effectSize: missing });
    assert.ok(!CLAIM.test(out), `etki yokken anlamlilik iddia edildi: ${out}`);
    assert.match(out, /etki büyüklüğü hesaplanamadı/);
  }
  assert.equal(significanceSentence({ p: null, effectSize: 0.5 }), null);

  const en = significanceSentence({ p: 0.01, effectSize: null, lang: 'en' });
  assert.ok(!CLAIM_EN.test(en), `"${en}"`);
  assert.match(significanceSentence({ p: 0.01, effectSize: 0.8, lang: 'en' }), CLAIM_EN);

  // Sifir varyansta d hesaplanamiyor: ucu ucuna APA ciktisi da iddia etmemeli.
  const noEffect = apaIndependentT({ ...independentT(D.groupA, D.groupB), cohensD: null });
  assert.ok(!CLAIM.test(noEffect.conclusion), noEffect.conclusion);
});

test('korelasyon nedensellik ifadesi uretmiyor', () => {
  const out = apaCorrelation(pearson(D.corrX, D.corrY));
  const text = `${out.text} ${out.conclusion} ${out.notes.join(' ')}`;
  assert.match(out.conclusion, /ilişki/);
  assert.ok(!/\betki\b/.test(out.conclusion), 'korelasyon sonucunda "etki" gecmemeli');
  assert.ok(!/neden olur|artırır|azaltır|yol açar/.test(text));
  assert.ok(out.notes.some((n) => /nedensellik göstermez/.test(n)));
});

test('varsayim kontrolu yapilmadiysa "gecti" denmiyor', () => {
  const t = independentT(D.groupA, D.groupB);
  // Normallik verilmedi: null = kontrol edilmedi
  assert.equal(apaIndependentT(t).assumptionFailed, null);
  // Kontrol edildi ve gecti
  const ok = apaIndependentT(t, { normality: [shapiroWilk(D.groupA), shapiroWilk(D.groupB)] });
  assert.equal(ok.assumptionFailed, false);
  // Kontrol edildi ve gecmedi: alternatif adiyla soyleniyor
  const bad = apaIndependentT(independentT(D.skewed, D.groupB), { normality: [shapiroWilk(D.skewed)] });
  assert.equal(bad.assumptionFailed, true);
  assert.ok(bad.notes.some((n) => /Mann-Whitney/.test(n)));
  assert.equal(apaPairedT(pairedT(D.pre, D.post)).assumptionFailed, null);
});

test('n < 30 uyari alanini dolduruyor', () => {
  assert.ok(describe(D.small8).warnings.includes('small_sample'));
  assert.ok(!describe(D.typical30).warnings.includes('small_sample'), 'n = 30 kucuk sayilmaz');
  const out = apaDescriptives(describe(D.small8));
  assert.ok(out.notes.some((n) => /örneklem küçük/.test(n)));
  assert.ok(independentT(D.groupA, D.groupUneven).warnings.includes('small_sample'));
  assert.ok(pairedT(D.pre, D.post).warnings.includes('small_sample'));
});

test('APA sayi bicimi: bastaki sifir kurali ve Turkce ondalik', () => {
  assert.equal(formatNumber(12.345), '12,35');
  assert.equal(formatNumber(12.345, { lang: 'en' }), '12.35');
  assert.equal(formatNumber(0.876, { digits: 3, leadingZero: false, lang: 'en' }), '.876');
  assert.equal(formatNumber(-0.876, { digits: 3, leadingZero: false, lang: 'en' }), '-.876');
  assert.equal(formatNumber(null), null);
  assert.equal(formatNumber(Infinity), null);
  assert.equal(formatDf(12), '12');
  assert.equal(formatDf(27.4567, { lang: 'en' }), '27.46');
  assert.equal(formatDf(null), null);
});

test('hesaplanamayan test metin yerine sebep donduruyor', () => {
  const out = apaDescriptives(describe([]));
  assert.equal(out.text, null);
  assert.match(out.reason, /geçerli veri yok/);
  assert.equal(apaShapiro(shapiroWilk([1, 2])).text, null);
  assert.equal(apaIndependentT(independentT([5, 5, 5], [5, 5, 5])).text, null);
  assert.equal(apaCorrelation(pearson([1, 2], [3, 4])).text, null);
  assert.equal(apaAlpha(cronbachAlpha([[1], [2]])).text, null);
});

test('her cikti kendi kokenini tasiyor (origin: computed)', () => {
  const results = [
    describe(D.small8), shapiroWilk(D.small8), independentT(D.groupA, D.groupB),
    pairedT(D.pre, D.post), pearson(D.corrX, D.corrY), spearman(D.corrX, D.corrY),
    cronbachAlpha(ref.matrix.likert), levene([D.groupA, D.groupB]),
  ];
  for (const r of results) assert.equal(r.origin, 'computed', r.test);
  assert.equal(apaDescriptives(describe(D.small8)).origin, 'computed');
  assert.equal(apaShapiro(shapiroWilk([1, 2])).origin, 'computed', 'hata ciktisinda da koken var');
});

test('APA metinleri bekledigimiz kaliba uyuyor', () => {
  const t = apaIndependentT(independentT(D.groupA, D.groupB), { lang: 'en' });
  assert.match(t.text, /^t\(28\) = -?\d+\.\d{2}, p [<=>] \.?\d+, d = -?\d+\.\d{2}$/);
  assert.match(t.groups, /Group 1: n = 15, M = \d+\.\d{2}, SD = \d+\.\d{2}/);
  const c = apaCorrelation(pearson(D.corrX, D.corrY), { lang: 'en' });
  assert.match(c.text, /^r\(13\) = \.\d{3}, p [<=>] \.?\d+, %95 CI \[\.\d{3}, \.\d{3}\]$/);
  const a = apaAlpha(cronbachAlpha(ref.matrix.likert), { lang: 'en' });
  assert.match(a.text, /^α = \.\d{2} \(5 items, n = 10\)$/);
  const d = apaDescriptives(describe(D.typical30));
  assert.match(d.text, /^n = 30, M = \d+,\d{2}, SS = \d+,\d{2}$/);
});
