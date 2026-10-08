import test from 'node:test';
import assert from 'node:assert/strict';

import { createResolver } from '../services/resolver/pipeline.js';
import { createCache } from '../services/resolver/cache.js';
import { titleSimilarity } from '../services/resolver/validate.js';

// Karar kurallari, 8 Eki 2026 denetiminde gercek API'lerle bulunan hatalardan:
// yanlis DOI "bulundu" sayiliyordu, kisa baslikli gercek kunye 0,82'de
// kaliyordu, sahte 2025 kopyalari aramayi kesiyordu, uydurma kunyeye baska
// yazarin makalesi oneriliyordu. Kaynaklar sahte; ag yok.

const rec = (title, family, year, doi, extra = {}) => ({
  source: 'crossref', title, authors: [{ family, given: 'A.' }], year, doi, venue: 'X', type: 'journal-article', ...extra,
});

const LECUN = rec('Deep learning', 'LeCun', 2015, '10.1038/nature14539');
const DQN = rec('Human-level control through deep reinforcement learning', 'Mnih', 2015, '10.1038/nature14236');
const VASWANI = { ...rec('Attention is All you Need', 'Vaswani', 2017, null), source: 's2' };
const COPY = (n) => rec('Attention Is All You Need', 'Vaswani', 2025, `10.65215/copy${n}`);

function sources(overrides = {}) {
  const calls = [];
  const wrap = (name, fn) => async (ctx, ...args) => { calls.push(name); return fn(...args); };
  const S = {
    crossrefWork: wrap('crossrefWork', () => null),
    doiOrgCsl: wrap('doiOrgCsl', () => null),
    openAlexWork: wrap('openAlexWork', () => null),
    crossrefByPii: wrap('crossrefByPii', () => null),
    arxivWork: wrap('arxivWork', () => null),
    europePmcById: wrap('europePmcById', () => null),
    crossrefBibliographic: wrap('crossrefBibliographic', () => []),
    openAlexSearch: wrap('openAlexSearch', () => []),
    s2Match: wrap('s2Match', () => []),
    europePmcSearch: wrap('europePmcSearch', () => []),
    fetchPageMeta: wrap('fetchPageMeta', () => ({ ok: false })),
    waybackUrl: wrap('waybackUrl', () => null),
  };
  for (const [k, fn] of Object.entries(overrides)) S[k] = wrap(k, fn);
  return { S, calls };
}

const make = (S) => createResolver({
  sources: S,
  cache: createCache({ dbReady: () => false }),
  unpaywall: async () => ({ status: 'not_configured' }),
  translate: async () => null,
  env: {},
});

test('kunyedeki DOI baska makaleyi gosteriyorsa "bulundu" denmez; asil makale aday', async () => {
  const { S, calls } = sources({
    crossrefWork: (doi) => (doi === '10.1038/nature14236' ? DQN : LECUN),
    crossrefBibliographic: (q) => {
      assert.ok(!/10\.1038/.test(q), `arama DOI'siz olmali: ${q}`);
      return [LECUN];
    },
  });
  const r = await make(S).resolve('LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436-444. https://doi.org/10.1038/nature14236');
  assert.equal(r.status, 'candidates');
  assert.equal(r.match, null);
  assert.deepEqual(r.candidates.map((c) => c.doi), ['10.1038/nature14539', '10.1038/nature14236']);
  assert.equal(r.discrepancies[0].note, 'doi_points_elsewhere');
  assert.ok(calls.includes('crossrefBibliographic'));
});

test('kunyedeki DOI dogruysa arama yapilmadan bulundu', async () => {
  const { S, calls } = sources({ crossrefWork: () => LECUN });
  const r = await make(S).resolve('LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436-444. https://doi.org/10.1038/nature14539');
  assert.equal(r.status, 'found');
  assert.equal(r.match.doi, '10.1038/nature14539');
  assert.ok(!calls.includes('crossrefBibliographic'));
});

test('kisa baslikli tam kunye (LeCun "Deep learning") bulunuyor', async () => {
  const { S } = sources({ crossrefBibliographic: () => [LECUN], crossrefWork: () => LECUN });
  const r = await make(S).resolve('LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436-444.');
  assert.equal(r.status, 'found');
  assert.equal(r.match.doi, '10.1038/nature14539');
});

test('kisa baslik: kunyede tum baslik karsilastiriliyor, serbest metinde tavan korunuyor', () => {
  assert.equal(titleSimilarity('Deep learning', 'Deep learning', { structured: true }), 1);
  assert.ok(titleSimilarity('Deep learning', 'Human-level control through deep reinforcement learning', { structured: true }) < 0.5);
  assert.equal(titleSimilarity('OEE', 'OEE in apparel industry'), 0.7);
});

test('yili tutmayan kopyalar aramayi kesmiyor; asil makale bulunuyor', async () => {
  const { S, calls } = sources({
    crossrefBibliographic: () => [COPY(1), COPY(2), COPY(3)],
    s2Match: () => [VASWANI],
  });
  const r = await make(S).resolve('Vaswani, A., Shazeer, N., & Polosukhin, I. (2017). Attention is all you need. Advances in Neural Information Processing Systems, 30.');
  assert.ok(calls.includes('s2Match'), calls.join(','));
  assert.equal(r.status, 'found');
  assert.equal(r.match.year, 2017);
});

test('yalnizca yili tutmayan kayit varsa en fazla aday', async () => {
  const { S } = sources({ crossrefBibliographic: () => [COPY(1)] });
  const r = await make(S).resolve('Vaswani, A., Shazeer, N., & Polosukhin, I. (2017). Attention is all you need. Advances in Neural Information Processing Systems, 30.');
  assert.equal(r.status, 'candidates');
});

test('uydurma kunye: ilk yazar ve yil tutmayan benzer baslik onerilmiyor', async () => {
  const other = { ...rec('A systematic literature review on machine learning applications for sustainable agriculture supply chain performance', 'Sharma', 2020, '10.1016/j.cor.2020.104926'),
    authors: [{ family: 'Sharma' }, { family: 'Kamble' }, { family: 'Gunasekaran' }, { family: 'Kumar' }] };
  const { S } = sources({ crossrefBibliographic: () => [other], openAlexSearch: () => [other] });
  const r = await make(S).resolve('Kumar, R., Zhang, L., & Patel, S. (2022). Machine learning applications in sustainable supply chain management: A systematic review. Journal of Cleaner Production, 345, 131045.');
  assert.equal(r.status, 'not_found');
  assert.deepEqual(r.candidates, []);
});

test('uydurma kunye: yil tutsa da ilk yazari hic gecmeyen benzer baslik onerilmiyor', async () => {
  const other = rec('Deep Reinforcement Learning for Traffic Signal Control: A Review', 'Rasheed', 2020, '10.1109/access.2020.3034141');
  const { S } = sources({ crossrefBibliographic: () => [other], openAlexSearch: () => [other] });
  const r = await make(S).resolve('Johnson, M., & Lee, S. (2020). Deep reinforcement learning for autonomous urban traffic signal control: A comprehensive survey. IEEE Transactions on Intelligent Transportation Systems, 21(8), 3456-3470.');
  assert.equal(r.status, 'not_found');
});

test('baslik birebir tutuyorsa soyadi farkli yazilmis gercek makale aday kalir', async () => {
  const real = rec('Using thematic analysis in psychology', 'Braun', 2006, '10.1191/1478088706qp063oa');
  const { S } = sources({ crossrefBibliographic: () => [real] });
  const r = await make(S).resolve('Brown, V., & Clarke, V. (2006). Using thematic analysis in psychology. Qualitative Research in Psychology, 3(2), 77-101.');
  assert.notEqual(r.status, 'not_found');
});

test('ayni eserin iki DOI\'si (SAGE + JSTOR) belirsizlik sayilmiyor', async () => {
  const title = 'Evaluating Structural Equation Models with Unobservable Variables and Measurement Error';
  const two = (doi) => ({ ...rec(title, 'Fornell', 1981, doi), authors: [{ family: 'Fornell' }, { family: 'Larcker' }] });
  const sibling = { ...rec(`Structural Equation Models with Unobservable Variables and Measurement Error: Algebra and Statistics`, 'Fornell', 1981, '10.2307/3150980'), authors: [{ family: 'Fornell' }, { family: 'Larcker' }] };
  const { S } = sources({ crossrefBibliographic: () => [two('10.1177/002224378101800104'), two('10.2307/3151312'), sibling] });
  const r = await make(S).resolve('Fornell, C., & Larcker, D. F. (1981). Evaluating structural equation models with unobservable variables and measurement error. Journal of Marketing Research, 18(1), 39-50.');
  assert.equal(r.status, 'found');
  assert.equal(r.match.doi, '10.1177/002224378101800104');
});

test('farkli iki eser cok yakinsa hala belirsiz', async () => {
  const a = rec('OEE improvement with AHP in manufacturing', 'Kaya', 2020, '10.1/a');
  const b = rec('OEE improvement with AHP in automotive manufacturing', 'Kaya', 2020, '10.1/b');
  const { S } = sources({ crossrefBibliographic: () => [a, b] });
  const r = await make(S).resolve('Kaya, A. (2020). OEE improvement with AHP manufacturing. Journal X.');
  assert.equal(r.status, 'candidates');
});

test('yil 1 farkli (on baski / dergi yili) tam kunye hala bulunuyor', async () => {
  const { S } = sources({ crossrefBibliographic: () => [VASWANI] });
  const r = await make(S).resolve('Vaswani, A., Shazeer, N., & Polosukhin, I. (2018). Attention is all you need. Advances in Neural Information Processing Systems.');
  assert.equal(r.status, 'found');
});

test('serbest metin: yazar taninmadiysa yili tutmayan kayit "bulundu" sayilmiyor', async () => {
  const blog = { ...rec('5分で分かる! 有名論文ナナメ読み：Ashish Vaswani et al. : Attention Is All You Need', '中沢', 2018, null), source: 'openalex' };
  const { S } = sources({ openAlexSearch: () => [blog] });
  const r = await make(S).resolve('attention is all you need vaswani 2017');
  assert.equal(r.status, 'candidates');
});
