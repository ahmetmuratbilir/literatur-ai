import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyOutcome, queriedSources } from '../services/search.js';

const SKIP = { results: [], skipped: true };

test('atlanan kaynak sorgulanmış sayılmaz; aynı ad bir kez', () => {
  const ok = { status: 'fulfilled', value: { results: [] } };
  const bad = { status: 'rejected', reason: new Error('x') };
  const skipped = { status: 'fulfilled', value: SKIP };
  assert.deepEqual(
    queriedSources([['Scopus', skipped], ['OpenAlex', ok], ['Crossref', bad], ['OpenAlex', ok], ['ArXiv', skipped]], SKIP),
    ['OpenAlex', 'Crossref'],
  );
});

test('sonuç varsa normal akış', () => {
  assert.equal(emptyOutcome({ resultCount: 3, sourcesQueried: ['OpenAlex'], failedSources: [{ name: 'OpenAlex' }], production: true }), 'results');
});

test('kaynaklar yanıt verdi ama eşleşme yok: dürüst boş sonuç (örnek veri değil)', () => {
  for (const production of [true, false]) {
    assert.equal(emptyOutcome({ resultCount: 0, sourcesQueried: ['OpenAlex', 'Crossref'], failedSources: [], production }), 'empty');
    assert.equal(emptyOutcome({ resultCount: 0, sourcesQueried: ['OpenAlex', 'Crossref'], failedSources: [{ name: 'Crossref' }], production }), 'empty');
  }
});

test('sorgulanan her kaynak düştü: canlıda açık hata, geliştirmede işaretli örnek veri', () => {
  const args = { resultCount: 0, sourcesQueried: ['OpenAlex', 'Crossref'], failedSources: [{ name: 'OpenAlex' }, { name: 'Crossref' }] };
  assert.equal(emptyOutcome({ ...args, production: true }), 'unavailable');
  assert.equal(emptyOutcome({ ...args, production: false }), 'demo');
});

test('hiç kaynak sorgulanmadıysa (hepsi atlandı) boş sonuç, örnek veri değil', () => {
  assert.equal(emptyOutcome({ resultCount: 0, sourcesQueried: [], failedSources: [], production: false }), 'empty');
});
