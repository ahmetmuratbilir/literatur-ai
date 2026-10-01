import test from 'node:test';
import assert from 'node:assert/strict';

import { createResolver } from '../services/resolver/pipeline.js';
import { createCache } from '../services/resolver/cache.js';
import { fixParticle } from '../services/resolver/sources.js';

/** Dış çağrı yapmayan sahte kaynaklar; her çağrıyı kaydeder. */
function fakeSources(overrides = {}) {
  const calls = [];
  const rec = (name, value) => async (ctx, ...args) => {
    calls.push(name);
    ctx.trace.push({ layer: ctx.layer, source: name, status: 'hit', ms: 1, cost_usd: name === 'openAlexSearch' ? 0.001 : 0 });
    return typeof value === 'function' ? value(...args) : value;
  };
  const S = {
    crossrefWork: rec('crossrefWork', null),
    doiOrgCsl: rec('doiOrgCsl', null),
    openAlexWork: rec('openAlexWork', null),
    crossrefByPii: rec('crossrefByPii', null),
    arxivWork: rec('arxivWork', null),
    europePmcById: rec('europePmcById', null),
    crossrefBibliographic: rec('crossrefBibliographic', []),
    openAlexSearch: rec('openAlexSearch', []),
    s2Match: rec('s2Match', []),
    europePmcSearch: rec('europePmcSearch', []),
    fetchPageMeta: rec('fetchPageMeta', { ok: false }),
    waybackUrl: rec('waybackUrl', null),
    ...overrides,
  };
  return { S, calls };
}

const KOC = {
  source: 'crossref', title: 'Achieving Sustainable Overall Equipment Effectiveness (OEE) in Apparel Industry With Lean and Digital Integration',
  authors: [{ family: 'Koç', given: 'Bahar' }, { family: 'Eryürük', given: 'Selin Hanife' }], year: 2025, venue: 'Engineering Reports',
  volume: '7', issue: '7', pages: 'e70162', doi: '10.1002/eng2.70162', type: 'journal-article', retraction: { status: 'none', notices: [] },
};

const make = (S, extra = {}) => createResolver({
  sources: S,
  cache: createCache({ dbReady: () => false }),
  unpaywall: async () => ({ status: 'not_configured' }),
  translate: async () => null,
  env: {},
  ...extra,
});

test('DOI girdisi: tekil sorgu, arama yok, APA uretiliyor', async () => {
  const { S, calls } = fakeSources({ crossrefWork: async (ctx) => { ctx.trace.push({ layer: 0, source: 'crossref', status: 'hit' }); return KOC; } });
  const r = await make(S).resolve('https://onlinelibrary.wiley.com/doi/full/10.1002/eng2.70162');
  assert.equal(r.status, 'found');
  assert.equal(r.match.doi, '10.1002/eng2.70162');
  assert.ok(!calls.includes('crossrefBibliographic') && !calls.includes('openAlexSearch'), calls.join(','));
  assert.match(r.match.apa7, /^Koç, B\., & Eryürük, S\. H\. \(2025\)\./);
});

test('ayni girdi ikinci kez: sifir dis cagri', async () => {
  const { S, calls } = fakeSources({ crossrefWork: async () => KOC });
  const resolver = make(S);
  await resolver.resolve('10.1002/eng2.70162');
  const before = calls.length;
  const again = await resolver.resolve('10.1002/eng2.70162');
  assert.equal(again.cached, true);
  assert.equal(calls.length, before);
  assert.deepEqual(again.trace, []);
});

test('kaynakca satiri: Crossref yeterliyse ucretli OpenAlex aramasi yapilmiyor; farklar raporlaniyor', async () => {
  const { S, calls } = fakeSources({ crossrefBibliographic: async () => [KOC], crossrefWork: async () => KOC });
  const r = await make(S).resolve('Koç, B. (2025). Achieving sustainable Overall Equipment Effectiveness (OEE) in apparel industry with lean and digital integration. Engineering Reports.');
  assert.equal(r.status, 'found');
  assert.ok(!calls.includes('openAlexSearch'));
  const notes = r.discrepancies.map((d) => `${d.field}/${d.note}`);
  assert.ok(notes.includes('authors/missing_coauthors'));
  assert.ok(notes.includes('volume/missing') && notes.includes('issue/missing'));
});

test('bulunamazsa not_found; DOI/URL uydurulmuyor; negatif sonuc onbellekte', async () => {
  const { S, calls } = fakeSources({ crossrefBibliographic: async () => [{ ...KOC, title: 'Something unrelated entirely', authors: [{ family: 'X' }], doi: '10.1/x' }] });
  const resolver = make(S);
  const r = await resolver.resolve('Kuantum tavuk yetistiriciliginde blokzincir tabanli OEE optimizasyonu 2024');
  assert.equal(r.status, 'not_found');
  assert.equal(r.match, null);
  assert.deepEqual(r.candidates, []);
  const n = calls.length;
  assert.equal((await resolver.resolve('Kuantum tavuk yetistiriciliginde blokzincir tabanli OEE optimizasyonu 2024')).cached, true);
  assert.equal(calls.length, n);
});

test('ag hatasiyla bulunamayan sonuc onbellege yazilmiyor', async () => {
  const { S } = fakeSources({ crossrefBibliographic: async (ctx) => { ctx.trace.push({ layer: 1, source: 'crossref', status: 'error' }); return []; } });
  const resolver = make(S);
  await resolver.resolve('some title that fails to load from anywhere today');
  assert.equal((await resolver.resolve('some title that fails to load from anywhere today')).cached, false);
});

test('iki aday cok yakinsa belirsiz: candidates', async () => {
  const a = { ...KOC, doi: '10.1/a', title: 'Machine learning for predictive maintenance in factories' };
  const b = { ...KOC, doi: '10.1/b', title: 'Machine learning for predictive maintenance in factories review' };
  const { S } = fakeSources({ crossrefBibliographic: async () => [a, b], openAlexSearch: async () => [] });
  const r = await make(S).resolve('machine learning predictive maintenance factories');
  assert.equal(r.status, 'candidates');
  assert.ok(r.candidates.length >= 2);
});

test('Unpaywall yanit vermese de cozumleme bekletilmiyor', async () => {
  const { S } = fakeSources({ crossrefWork: async () => KOC });
  const resolver = make(S, { unpaywall: () => new Promise(() => {}), unpaywallTimeoutMs: 50 });
  const t0 = Date.now();
  const r = await resolver.resolve('10.1002/eng2.70162');
  assert.equal(r.status, 'found');
  assert.ok(Date.now() - t0 < 1000);
  assert.ok(r.trace.some((t) => t.source === 'unpaywall' && t.error === 'timeout'));
});

test('soyad eki adda kalmissa soyada tasiniyor (Crossref: given "Sebastiano Di")', () => {
  assert.deepEqual(fixParticle({ given: 'Sebastiano Di', family: 'Luozzo' }), { given: 'Sebastiano', family: 'Di Luozzo' });
  assert.deepEqual(fixParticle({ given: 'Di', family: 'Luozzo' }), { given: 'Di', family: 'Luozzo' });
  assert.deepEqual(fixParticle({ given: 'Ludwig van', family: 'Beethoven' }), { given: 'Ludwig', family: 'van Beethoven' });
});
