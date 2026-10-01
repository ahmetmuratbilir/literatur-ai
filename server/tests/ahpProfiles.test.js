import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFILES, MAX_CRITERION_WEIGHT, resolveRankingWeights, parseWeightsParam, listProfiles,
} from '../services/ahpProfiles.js';
import { DEFAULT_WEIGHTS } from '../services/ahp.js';
import { CRITERIA } from '../services/ahpMatrix.js';
import { rankFromPool, itemKey, findMissingTranslations } from '../services/rankingPipeline.js';

const sum = (w) => CRITERIA.reduce((acc, c) => acc + w[c], 0);
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('her profilin agirliklari 7 kriteri kapsar ve toplami 1', () => {
  for (const [id, p] of Object.entries(PROFILES)) {
    assert.deepEqual(Object.keys(p.weights).sort(), [...CRITERIA].sort(), `${id} eksik/fazla kriter`);
    assert.ok(close(sum(p.weights), 1, 1e-6), `${id} toplami ${sum(p.weights)}`);
    for (const c of CRITERIA) assert.ok(p.weights[c] <= MAX_CRITERION_WEIGHT, `${id}.${c} ust siniri asiyor`);
  }
});

test('Dengeli profil matristen turetilen agirliklarin kendisidir', () => {
  assert.deepEqual(PROFILES.dengeli.weights, DEFAULT_WEIGHTS);
});

test('kapali profiller sebebiyle birlikte listelenir', () => {
  const byId = Object.fromEntries(listProfiles().map((p) => [p.id, p]));
  assert.equal(byId.tesvik.available, false);
  assert.match(byId.tesvik.unavailableReason, /TR Dizin/);
  assert.equal(byId.turkce.available, false);
  assert.equal(byId.guncel.available, true);
});

test('kapali profil istenirse varsayilana doner ve NEDENINI soyler', () => {
  const r = resolveRankingWeights({ profileId: 'tesvik', lang: 'tr' });
  assert.equal(r.source, 'default');
  assert.deepEqual(r.weights, DEFAULT_WEIGHTS);
  assert.ok(r.warnings.some((w) => /kullanılamıyor/.test(w)));
  const en = resolveRankingWeights({ profileId: 'tesvik' });
  assert.ok(en.warnings.some((w) => /not available/.test(w)), 'varsayilan dil Ingilizce');
});

test('bilinmeyen profil varsayilana doner', () => {
  const r = resolveRankingWeights({ profileId: 'yok-boyle' });
  assert.equal(r.source, 'default');
  assert.equal(r.warnings.length, 1);
});

test('gecerli profil secilir', () => {
  const r = resolveRankingWeights({ profileId: 'guncel' });
  assert.equal(r.source, 'profile');
  assert.equal(r.weights.recency, 0.33);
});

test('ozel agirliklar normalize edilir', () => {
  const r = resolveRankingWeights({ weights: { keyword: 2, similarity: 2, citation: 2, quality: 2, recency: 2, reliability: 2, oa: 2 } });
  assert.equal(r.source, 'custom');
  for (const c of CRITERIA) assert.ok(close(r.weights[c], 1 / 7));
});

test('tek kritere %90 verilirse %50 ile sinirlanir, fazlasi orantili dagitilir', () => {
  const r = resolveRankingWeights({ weights: { citation: 9, keyword: 0.5, quality: 0.5, similarity: 0, recency: 0, reliability: 0, oa: 0 }, lang: 'tr' });
  assert.ok(close(r.weights.citation, MAX_CRITERION_WEIGHT));
  assert.ok(close(sum(r.weights), 1));
  // Fazla, mevcut payla ORANTILI dagitilir: sifir olanlar sifir kalir.
  assert.ok(close(r.weights.keyword, r.weights.quality));
  assert.equal(r.weights.recency, 0);
  assert.ok(r.warnings.some((w) => /sınırlandı/.test(w)));
});

test('ozel agirlik profilden onceliklidir', () => {
  assert.equal(resolveRankingWeights({ profileId: 'guncel', weights: { oa: 1 } }).source, 'custom');
});

test('eksik kriter varsayilan payini alir, bilinmeyen kriter uyari verir', () => {
  const r = resolveRankingWeights({ weights: { recency: 0.5, bogus: 3 } });
  assert.ok(r.weights.citation > 0, 'gonderilmeyen kriter sifirlanmamali');
  assert.ok(r.warnings.some((w) => /bogus/.test(w)));
});

test('tum agirliklar sifirsa varsayilan', () => {
  const zeros = Object.fromEntries(CRITERIA.map((c) => [c, 0]));
  const r = resolveRankingWeights({ weights: zeros });
  assert.equal(r.source, 'default');
});

test('weights parametresi guvenle ayristirilir', () => {
  assert.deepEqual(parseWeightsParam('{"oa":1}'), { oa: 1 });
  assert.equal(parseWeightsParam('{bozuk'), null);
  assert.equal(parseWeightsParam('[1,2]'), null);
  assert.equal(parseWeightsParam(''), null);
});

// --- Havuzdan siralama ---

const YEAR = new Date().getFullYear();
function pool() {
  return [
    // Eski ama cok atifli klasik
    { id: 'klasik', title: 'Classic reactor safety analysis', doi: '10.1/klasik', keyCount: 12, expandedSimilarity: 0.8,
      citedBy: 4000, publicationYear: YEAR - 25, yearConfidence: 'high', pubType: 'ar', titleTR: 'Klasik', teaserTR: 'k' },
    // Yeni, az atifli
    { id: 'yeni', title: 'Recent reactor safety advances', doi: '10.1/yeni', keyCount: 12, expandedSimilarity: 0.8,
      citedBy: 2, publicationYear: YEAR, yearConfidence: 'high', pubType: 'ar', titleTR: 'Yeni', teaserTR: 'y' },
  ];
}

const noTranslate = async () => { throw new Error('cagrilmamaliydi'); };

test('AYNI havuz, FARKLI agirlik -> FARKLI siralama (M3 in temel vaadi)', async () => {
  const p = pool();
  const byCitation = await rankFromPool(p, { weights: PROFILES.atif.weights, translate: noTranslate });
  const byRecency = await rankFromPool(p, { weights: PROFILES.guncel.weights, translate: noTranslate });
  assert.equal(byCitation.results[0].id, 'klasik');
  assert.equal(byRecency.results[0].id, 'yeni');
});

test('siralama havuzu degistirmez (ayni havuz tekrar kullanilabilir)', async () => {
  const p = pool();
  const snapshot = JSON.stringify(p);
  await rankFromPool(p, { weights: PROFILES.atif.weights, translate: noTranslate });
  assert.equal(JSON.stringify(p), snapshot);
});

test('ceviriler tamsa ceviri servisi cagrilmaz', async () => {
  // noTranslate cagrilsaydi hata firlatirdi.
  const r = await rankFromPool(pool(), { translateEnabled: true, translate: noTranslate });
  assert.equal(r.translatedCount, 0);
});

test('onbellekteki ceviriler anahtarla uygulanir, yalnizca eksik olan cevrilir', async () => {
  const p = pool().map(({ titleTR, teaserTR, ...rest }) => ({ ...rest, description: 'abstract text' }));
  const cached = { [itemKey(p[0])]: { titleTR: 'Klasik', teaserTR: 'k' } };
  const translated = [];
  const r = await rankFromPool(p, {
    translateEnabled: true,
    translations: cached,
    translate: async (items) => { for (const i of items) { translated.push(i.id); i.titleTR = 'TR'; i.teaserTR = 'tr'; } },
  });
  assert.deepEqual(translated, ['yeni'], 'yalnizca cevirisi olmayan makale cevrilmeli');
  assert.ok(r.translations[itemKey(p[1])], 'yeni ceviri haritaya eklenmeli (onbellege yazilabilsin)');
});

test('ceviri hatasi siralamayi dusurmez', async () => {
  const p = pool().map(({ titleTR, ...rest }) => rest);
  const silent = console.warn;
  console.warn = () => {};
  try {
    const r = await rankFromPool(p, { translateEnabled: true, translate: async () => { throw new Error('LLM kapali'); } });
    assert.equal(r.results.length, 2);
  } finally {
    console.warn = silent;
  }
});

test('yalnizca baslik cevrilir: ozeti olan ama basligi cevrilmis makale eksik SAYILMAZ', () => {
  const ranked = Array.from({ length: 12 }, (_, i) => ({ id: i, titleTR: i < 9 ? 't' : undefined, description: 'x' }));
  assert.deepEqual(findMissingTranslations(ranked).map((r) => r.id), [9, 10, 11]);
});

test('onbellekte ozet cevirisi olsa bile uygulanmaz', async () => {
  const p = pool().map(({ titleTR, teaserTR, ...rest }) => rest);
  const cached = Object.fromEntries(p.map((x) => [itemKey(x), { titleTR: 'T', teaserTR: 'ozet' }]));
  const r = await rankFromPool(p, { translateEnabled: true, translations: cached, translate: noTranslate });
  assert.ok(r.results.every((x) => x.titleTR === 'T' && !x.teaserTR));
});

test('ceviri VARSAYILAN KAPALI: servis cagrilmaz, onbellekteki ceviri de uygulanmaz', async () => {
  const p = pool().map(({ titleTR, teaserTR, ...rest }) => rest);
  const cached = { [itemKey(p[0])]: { titleTR: 'Klasik', teaserTR: 'k' } };
  const r = await rankFromPool(p, { translations: cached, translate: noTranslate });
  assert.ok(r.results.every((x) => !x.titleTR), 'kullanici Ingilizce istedi; Turkce baslik gelmemeli');
  assert.deepEqual(r.translations, cached, 'onbellekteki ceviriler silinmemeli (sonra acilabilir)');
});

test('profil adlari dile gore gelir', () => {
  const en = Object.fromEntries(listProfiles('en').map((p) => [p.id, p]));
  const tr = Object.fromEntries(listProfiles('tr').map((p) => [p.id, p]));
  assert.equal(en.dengeli.label, 'Balanced');
  assert.equal(tr.dengeli.label, 'Dengeli');
  assert.equal(en.guncel.unavailableReason, null, 'acik profilde sebep yok');
  assert.match(en.turkce.unavailableReason, /DergiPark/);
  assert.deepEqual(en.atif.weights, tr.atif.weights, 'agirliklar dilden bagimsiz');
});
