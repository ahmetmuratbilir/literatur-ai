/**
 * APA 7 biçimlendirme ve istatistik dürüstlük kuralları.
 *
 * WO-006: bu kurallar **kodla** uygulanır, yorumla değil. Her biri testle
 * bağlanmıştır (client/tests/stats.test.js):
 *
 * 1. `p = .000` basılmaz; `p < .001` basılır.
 * 2. Etki büyüklüğü olmadan "anlamlı" kelimesi üretilmez.
 * 3. Varsayım kontrolü başarısızsa çıktı `assumptionFailed` taşır ve
 *    parametrik olmayan alternatifi adıyla söyler.
 * 4. Korelasyon "ilişki" der, "etki" demez — nedensellik ifadesi üretilmez.
 * 5. n < 30 uyarı alanını doldurur.
 * 6. Hesaplanamayan alan `null`; metne "0" ya da tahmin yazılmaz.
 *
 * Modül saf: ağ, depolama ve DOM yok. Dil seçeneği parametre, i18n bağımlılığı
 * yok (modül React'tan bağımsız kalmalı).
 */

import { ORIGIN } from './descriptives.js';

const LABELS = {
  tr: {
    nonNormal: 'normallik varsayımı karşılanmadı',
    useNonparametric: 'parametrik olmayan alternatif: Mann-Whitney U (bağımsız) veya Wilcoxon işaretli sıralar (eşleştirilmiş)',
    unequalVariances: 'varyanslar eşit değil (Levene p < .05), Welch düzeltmesi okunmalı',
    smallSample: 'örneklem küçük (n < 30), sonuç kırılgan',
    dropped: (n) => `${n} eksik ya da geçersiz değer ayıklandı`,
    significant: 'fark istatistiksel olarak anlamlı',
    notSignificant: 'fark istatistiksel olarak anlamlı değil',
    relationship: 'ilişki istatistiksel olarak anlamlı',
    noRelationship: 'ilişki istatistiksel olarak anlamlı değil',
    noCausation: 'korelasyon nedensellik göstermez',
    effectMissing: 'etki büyüklüğü hesaplanamadı, anlamlılık yorumu yapılmıyor',
    alphaLow: 'alfa .70 altında, ölçek iç tutarlılığı zayıf',
    alphaNegative: 'alfa negatif: madde yönleri ters kodlanmış olabilir',
    fewItems: 'madde sayısı az, alfa düşük çıkmaya yatkın',
    perfect: 'ilişki tam, p sayısal olarak sıfır',
    noData: 'geçerli veri yok',
    tooFew: 'veri bu test için yetersiz',
    zeroVariance: 'değerler sabit, varyans sıfır: test hesaplanamaz',
    largeSampleSensitivity: 'büyük örneklemde test küçük sapmaları da reddeder',
    lowPower: 'n < 20, testin gücü düşük',
    tooMany: 'n 5000 üzerinde, bu algoritmanın geçerli aralığı dışında',
  },
  en: {
    nonNormal: 'the normality assumption was not met',
    useNonparametric: 'non-parametric alternative: Mann-Whitney U (independent) or Wilcoxon signed-rank (paired)',
    unequalVariances: 'variances are unequal (Levene p < .05); read the Welch correction',
    smallSample: 'the sample is small (n < 30), so the result is fragile',
    dropped: (n) => `${n} missing or invalid values were removed`,
    significant: 'the difference is statistically significant',
    notSignificant: 'the difference is not statistically significant',
    relationship: 'the relationship is statistically significant',
    noRelationship: 'the relationship is not statistically significant',
    noCausation: 'correlation does not show causation',
    effectMissing: 'the effect size could not be computed, so significance is not interpreted',
    alphaLow: 'alpha is below .70; internal consistency is weak',
    alphaNegative: 'alpha is negative: some items may be reverse coded',
    fewItems: 'few items, which tends to lower alpha',
    perfect: 'the relationship is perfect; p is numerically zero',
    noData: 'no valid data',
    tooFew: 'not enough data for this test',
    zeroVariance: 'the values are constant (zero variance), so the test cannot be computed',
    largeSampleSensitivity: 'with a large sample the test rejects even small departures',
    lowPower: 'n < 20, so the test has low power',
    tooMany: 'n is above 5000, outside the valid range of this algorithm',
  },
};

const labels = (lang) => LABELS[lang] || LABELS.tr;

/** Ondalık ayırıcı: Türkçe metinde virgül, İngilizcede nokta. */
const localize = (text, lang) => (lang === 'tr' ? text.replace(/\./g, ',') : text);

/**
 * APA sayı biçimi. `leadingZero: false` olan alanlar (p, r, α) 0'dan küçük
 * olduğu bilinen değerlerdir ve başta sıfır yazılmaz.
 */
export function formatNumber(value, { digits = 2, leadingZero = true, lang = 'tr' } = {}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const fixed = value.toFixed(digits);
  const trimmed = leadingZero ? fixed : fixed.replace(/^(-?)0\./, '$1.');
  return localize(trimmed, lang);
}

/**
 * p değeri. `.000` hiçbir zaman basılmaz — sıfıra yuvarlanan p, "imkânsız"
 * demek değildir, yalnızca üç basamağın altındadır.
 */
export function formatP(p, { lang = 'tr' } = {}) {
  if (p === null || p === undefined || !Number.isFinite(p)) return null;
  if (p < 0.001) return `p ${localize('< .001', lang)}`;
  if (p > 0.999) return `p ${localize('> .999', lang)}`;
  return `p = ${formatNumber(p, { digits: 3, leadingZero: false, lang })}`;
}

/** Serbestlik derecesi: tam sayıysa tam, Welch'te iki ondalık. */
export function formatDf(df, { lang = 'tr' } = {}) {
  if (df === null || df === undefined || !Number.isFinite(df)) return null;
  return Number.isInteger(df) ? String(df) : formatNumber(df, { digits: 2, lang });
}

/**
 * Anlamlılık cümlesi — tek kapı.
 *
 * Etki büyüklüğü yoksa "anlamlı" kelimesi **üretilmez**; bunun yerine neden
 * yorum yapılmadığı söylenir. Kural WO-006'dan: anlamlılık tek başına etkinin
 * büyüklüğünü söylemez ve okuyucuyu yanıltır.
 */
export function significanceSentence({ p, effectSize, alpha = 0.05, kind = 'difference', lang = 'tr' }) {
  const L = labels(lang);
  if (p === null || p === undefined || !Number.isFinite(p)) return null;
  if (effectSize === null || effectSize === undefined || !Number.isFinite(effectSize)) {
    return L.effectMissing;
  }
  if (kind === 'relationship') return p < alpha ? L.relationship : L.noRelationship;
  return p < alpha ? L.significant : L.notSignificant;
}

/** Çıktıdaki uyarı kodlarını okunur cümlelere çevirir. */
export function explainWarnings(result, lang = 'tr') {
  const L = labels(lang);
  const out = [];
  for (const code of result?.warnings || []) {
    if (code === 'small_sample') out.push(L.smallSample);
    else if (code === 'dropped_values') out.push(L.dropped(result.dropped));
    else if (code === 'unequal_variances') out.push(L.unequalVariances);
    else if (code === 'zero_variance') out.push(L.zeroVariance);
    else if (code === 'low_alpha') out.push(L.alphaLow);
    else if (code === 'negative_alpha') out.push(L.alphaNegative);
    else if (code === 'few_items') out.push(L.fewItems);
    else if (code === 'perfect_correlation') out.push(L.perfect);
    else if (code === 'large_sample_sensitivity') out.push(L.largeSampleSensitivity);
    else if (code === 'low_power') out.push(L.lowPower);
  }
  return out;
}

const errorSentence = (result, lang) => {
  const L = labels(lang);
  return {
    no_data: L.noData, too_few: L.tooFew, zero_variance: L.zeroVariance, too_many: L.tooMany,
  }[result.error] || L.tooFew;
};

/** Hesaplanamayan testin ortak çıktısı: metin yok, sebep var. */
const failed = (result, lang) => ({
  origin: ORIGIN,
  test: result.test,
  text: null,
  reason: errorSentence(result, lang),
  notes: explainWarnings(result, lang),
  assumptionFailed: false,
});

/** Betimsel istatistik satırı: M = 12.47, SS = 2.08. */
export function apaDescriptives(result, { lang = 'tr' } = {}) {
  if (result.error) return failed(result, lang);
  const sdLabel = lang === 'tr' ? 'SS' : 'SD';
  const text = `n = ${result.n}, M = ${formatNumber(result.mean, { lang })}, ${sdLabel} = ${formatNumber(result.sd, { lang })}`;
  return {
    origin: ORIGIN, test: result.test, text,
    reason: null, notes: explainWarnings(result, lang), assumptionFailed: false,
  };
}

/** Shapiro-Wilk: W = .956, p = .247. */
export function apaShapiro(result, { lang = 'tr' } = {}) {
  if (result.error) return failed(result, lang);
  const L = labels(lang);
  const text = `W = ${formatNumber(result.w, { digits: 3, leadingZero: false, lang })}, ${formatP(result.p, { lang })}`;
  const notes = explainWarnings(result, lang);
  if (!result.normal) notes.unshift(L.nonNormal, L.useNonparametric);
  return {
    origin: ORIGIN, test: result.test, text, reason: null, notes,
    assumptionFailed: !result.normal,
  };
}

/**
 * Bağımsız örneklem t-testi.
 *
 * `normality` verilirse (bir ya da iki grubun Shapiro çıktısı) varsayım
 * kontrolü yapılmış sayılır. Verilmezse çıktı `assumptionFailed: null`
 * taşır: "kontrol edilmedi" ile "kontrol edildi, geçti" karıştırılmaz.
 */
export function apaIndependentT(result, { lang = 'tr', normality = null, alpha = 0.05 } = {}) {
  if (result.error) return failed(result, lang);
  const L = labels(lang);
  const branch = result.recommended === 'welch' ? result.welch : result.student;
  if (!branch) return failed({ ...result, error: 'zero_variance' }, lang);
  const sdLabel = lang === 'tr' ? 'SS' : 'SD';
  const text = [
    `t(${formatDf(branch.df, { lang })}) = ${formatNumber(branch.t, { lang })}`,
    formatP(branch.p, { lang }),
    `d = ${formatNumber(result.cohensD, { lang })}`,
  ].join(', ');
  const groups = `${lang === 'tr' ? 'Grup 1' : 'Group 1'}: n = ${result.n1}, M = ${formatNumber(result.mean1, { lang })}, ${sdLabel} = ${formatNumber(result.sd1, { lang })}`
    + ` · ${lang === 'tr' ? 'Grup 2' : 'Group 2'}: n = ${result.n2}, M = ${formatNumber(result.mean2, { lang })}, ${sdLabel} = ${formatNumber(result.sd2, { lang })}`;

  const notes = explainWarnings(result, lang);
  const checks = [].concat(normality || []);
  const nonNormal = checks.some((c) => c && c.normal === false);
  if (nonNormal) notes.unshift(L.nonNormal, L.useNonparametric);
  return {
    origin: ORIGIN, test: result.test, text, groups, reason: null, notes,
    which: result.recommended,
    conclusion: significanceSentence({ p: branch.p, effectSize: result.cohensD, alpha, lang }),
    // null = kontrol edilmedi. false = kontrol edildi ve geçti.
    assumptionFailed: checks.length === 0 ? null : nonNormal,
  };
}

/** Eşleştirilmiş t-testi. */
export function apaPairedT(result, { lang = 'tr', normality = null, alpha = 0.05 } = {}) {
  if (result.error) return failed(result, lang);
  const L = labels(lang);
  const text = [
    `t(${formatDf(result.df, { lang })}) = ${formatNumber(result.t, { lang })}`,
    formatP(result.p, { lang }),
    `d = ${formatNumber(result.cohensD, { lang })}`,
  ].join(', ');
  const notes = explainWarnings(result, lang);
  const checks = [].concat(normality || []);
  const nonNormal = checks.some((c) => c && c.normal === false);
  if (nonNormal) notes.unshift(L.nonNormal, L.useNonparametric);
  return {
    origin: ORIGIN, test: result.test, text, reason: null, notes,
    conclusion: significanceSentence({ p: result.p, effectSize: result.cohensD, alpha, lang }),
    assumptionFailed: checks.length === 0 ? null : nonNormal,
  };
}

/**
 * Korelasyon. Çıktı her zaman "ilişki" der ve nedensellik uyarısını taşır:
 * "etki", "neden olur", "artırır" gibi ifadeler üretilmez (WO-006).
 */
export function apaCorrelation(result, { lang = 'tr', alpha = 0.05 } = {}) {
  if (result.error) return failed(result, lang);
  const L = labels(lang);
  const symbol = result.test === 'spearman' ? (lang === 'tr' ? 'rs' : 'rs') : 'r';
  const parts = [
    `${symbol}(${formatDf(result.df, { lang })}) = ${formatNumber(result.r, { digits: 3, leadingZero: false, lang })}`,
    formatP(result.p, { lang }),
  ];
  if (result.ci) {
    const lo = formatNumber(result.ci.lower, { digits: 3, leadingZero: false, lang });
    const hi = formatNumber(result.ci.upper, { digits: 3, leadingZero: false, lang });
    parts.push(`%95 ${lang === 'tr' ? 'GA' : 'CI'} [${lo}, ${hi}]`);
  }
  return {
    origin: ORIGIN, test: result.test, text: parts.join(', '), reason: null,
    notes: [...explainWarnings(result, lang), L.noCausation],
    // r'nin kendisi etki büyüklüğüdür: ayrıca bir d istenmez.
    conclusion: significanceSentence({ p: result.p, effectSize: result.r, alpha, kind: 'relationship', lang }),
    assumptionFailed: false,
  };
}

/** Cronbach alfa: α = .87 (5 madde). */
export function apaAlpha(result, { lang = 'tr' } = {}) {
  if (result.error) return failed(result, lang);
  const itemWord = lang === 'tr' ? 'madde' : 'items';
  const text = `α = ${formatNumber(result.alpha, { digits: 2, leadingZero: false, lang })} (${result.k} ${itemWord}, n = ${result.n})`;
  return {
    origin: ORIGIN, test: result.test, text, reason: null,
    notes: explainWarnings(result, lang), assumptionFailed: false,
  };
}
