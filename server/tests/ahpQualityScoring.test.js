import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateAHP, resolveWeights, DEFAULT_WEIGHTS } from '../services/ahp.js';
import { normalizeSearchResult } from '../services/searchRankingService.js';
import {
  normalizePublicationType,
  PUB_TYPE_SCORES,
  SOURCE_TYPE_SCORES,
} from '../utils/dataUtils.js';

test('journalRankingService ciktisi SOURCE_TYPE_SCORES ile ayni anahtarlari kullanir', () => {
  // enrichPaperRanking yalnizca bu uc degeri uretiyor; ucu de tabloda olmali,
  // aksi halde sessizce 0.5 fallback'ine duserler.
  for (const emitted of ['Journal', 'Preprint', 'Conference']) {
    assert.ok(
      SOURCE_TYPE_SCORES[emitted] !== undefined,
      `SOURCE_TYPE_SCORES '${emitted}' anahtarini icermeli`
    );
  }

  assert.ok(
    SOURCE_TYPE_SCORES.Preprint < SOURCE_TYPE_SCORES.Conference,
    'hakemsiz preprint hakemli konferanstan dusuk puan almali'
  );
});

test('farkli kaynaklarin yayin tipi gosterimleri ayni koda cozulur', () => {
  assert.equal(normalizePublicationType('Article'), 'fla');        // Scopus
  assert.equal(normalizePublicationType('article'), 'fla');        // OpenAlex
  assert.equal(normalizePublicationType('journal-article'), 'fla'); // Crossref
  assert.equal(normalizePublicationType('JournalArticle'), 'fla');  // Semantic Scholar
  assert.equal(normalizePublicationType('posted-content'), 'pre');  // Crossref preprint
  assert.equal(normalizePublicationType('proceedings-article'), 'cnf');
  assert.equal(normalizePublicationType(['Review']), 'rev');        // S2 dizi doner
  assert.equal(normalizePublicationType('bilinmeyen-tip'), null);
  assert.equal(normalizePublicationType(undefined), null);

  for (const code of ['fla', 'rev', 'chp', 'cnf', 'sco', 'ssu', 'crp', 'pre']) {
    assert.ok(PUB_TYPE_SCORES[code] !== undefined, `PUB_TYPE_SCORES '${code}' icermeli`);
  }
});

test('normalizeSearchResult pubType ve openAccess alanlarini doldurur', () => {
  const openAlex = normalizeSearchResult({
    title: 'Reactor safety',
    type: 'article',
    openAccess: true,
    source: 'OpenAlex',
    publicationName: 'Nuclear Engineering and Design',
  });
  assert.equal(openAlex.pubType, 'fla');
  assert.equal(openAlex.openAccess, true);

  const crossref = normalizeSearchResult({
    title: 'Reactor safety',
    type: 'posted-content',
    source: 'Crossref',
    publicationName: 'arXiv preprint',
  });
  assert.equal(crossref.pubType, 'pre');
  assert.equal(crossref.openAccess, false, 'Crossref acik erisim bilgisi vermez');

  // DOAJ/arXiv/CORE tanimi geregi acik erisim.
  const doaj = normalizeSearchResult({ title: 'X', source: 'DOAJ', publicationName: 'Open Journal' });
  assert.equal(doaj.openAccess, true);
});

test('kalite kriteri artik makale tipine gore ayrisir', async () => {
  const base = {
    keyCount: 15,
    expandedSimilarity: 0.5,
    citedbyCount: 40,
    doi: '10.1/x',
    publicationYear: 2021,
    yearConfidence: 'high',
  };

  const [journalArticle] = await calculateAHP([
    { ...base, pubType: 'fla', sourceType: 'Journal' },
  ]);
  const [preprint] = await calculateAHP([
    { ...base, pubType: 'pre', sourceType: 'Preprint' },
  ]);
  const [conference] = await calculateAHP([
    { ...base, pubType: 'cnf', sourceType: 'Conference' },
  ]);

  assert.ok(
    journalArticle.scores.quality > conference.scores.quality,
    'hakemli dergi makalesi konferans bildirisinden yuksek olmali'
  );
  assert.ok(
    conference.scores.quality > preprint.scores.quality,
    'konferans bildirisi preprintten yuksek olmali'
  );

  const distinct = new Set([
    journalArticle.scores.quality,
    conference.scores.quality,
    preprint.scores.quality,
  ]);
  assert.equal(distinct.size, 3, 'kalite skoru uc farkli deger uretmeli');
});

test('acik erisim kriteri artik skoru etkiler', async () => {
  const base = {
    keyCount: 10,
    expandedSimilarity: 0.4,
    citedbyCount: 20,
    doi: '10.1/x',
    publicationYear: 2022,
    yearConfidence: 'high',
    pubType: 'fla',
    sourceType: 'Journal',
  };

  const [open] = await calculateAHP([{ ...base, openAccess: true }]);
  const [closed] = await calculateAHP([{ ...base, openAccess: false }]);

  assert.equal(open.scores.oa, 1);
  assert.equal(closed.scores.oa, 0);
  assert.ok(open.totalPoint > closed.totalPoint, 'acik erisim toplam skoru yukseltmeli');
});

test('resolveWeights gecersiz girdide varsayilana doner, gecerliyi normalize eder', () => {
  assert.deepEqual(resolveWeights(null), DEFAULT_WEIGHTS);
  assert.deepEqual(resolveWeights('gecersiz'), DEFAULT_WEIGHTS);
  assert.deepEqual(resolveWeights({}), DEFAULT_WEIGHTS);

  // Toplami 1 olmayan agirliklar normalize edilmeli.
  const doubled = resolveWeights(
    Object.fromEntries(Object.entries(DEFAULT_WEIGHTS).map(([k, v]) => [k, v * 2]))
  );
  const sum = Object.values(doubled).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `agirliklar toplami 1 olmali, ${sum} bulundu`);
  assert.ok(Math.abs(doubled.keyword - DEFAULT_WEIGHTS.keyword) < 1e-9);
});

test('customWeights siralamayi gercekten degistirir', async () => {
  const guncelAmaAtifsiz = {
    title: 'Guncel', keyCount: 3, expandedSimilarity: 0.1, citedbyCount: 0,
    publicationYear: new Date().getFullYear(), yearConfidence: 'high',
    pubType: 'fla', sourceType: 'Journal', doi: '10.1/a',
  };
  const eskiAmaCokAtifli = {
    title: 'Eski', keyCount: 3, expandedSimilarity: 0.1, citedbyCount: 5000,
    publicationYear: 2005, yearConfidence: 'high',
    pubType: 'fla', sourceType: 'Journal', doi: '10.1/b',
  };

  const citationHeavy = await calculateAHP([guncelAmaAtifsiz, eskiAmaCokAtifli], {
    keyword: 0, similarity: 0, citation: 1, quality: 0, recency: 0, reliability: 0, oa: 0,
  });
  assert.equal(citationHeavy[0].title, 'Eski');

  const recencyHeavy = await calculateAHP([guncelAmaAtifsiz, eskiAmaCokAtifli], {
    keyword: 0, similarity: 0, citation: 0, quality: 0, recency: 1, reliability: 0, oa: 0,
  });
  assert.equal(recencyHeavy[0].title, 'Guncel');
});

test('tek tip icerik barindiran kaynaklar icin pubType varsayilani uygulanir', () => {
  // DOAJ ve arXiv ham tip alani dondurmez; tip bilgisi kaynagin kendisinden gelir.
  const doaj = normalizeSearchResult({ title: 'X', source: 'DOAJ', publicationName: 'Open Nuclear Journal' });
  assert.equal(doaj.pubType, 'fla');

  const arxiv = normalizeSearchResult({ title: 'Y', source: 'ArXiv', publicationName: 'arXiv' });
  assert.equal(arxiv.pubType, 'pre');

  // Acik tip bilgisi varsa varsayilan ezilmemeli.
  const explicit = normalizeSearchResult({ title: 'Z', source: 'DOAJ', type: 'review', publicationName: 'Open Nuclear Journal' });
  assert.equal(explicit.pubType, 'rev');
});
