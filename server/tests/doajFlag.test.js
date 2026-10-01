import test from 'node:test';
import assert from 'node:assert/strict';

import { deduplicateResults, normalizeSearchResult } from '../services/searchRankingService.js';
import { calculateAHP } from '../services/ahp.js';

const TITLE = 'Passive safety systems in small modular reactors: a review';

test('DOAJ kaynakli kayit tanimi geregi isInDoaj=true', () => {
  assert.equal(normalizeSearchResult({ title: TITLE, source: 'DOAJ' }).isInDoaj, true);
});

test('bilgisi olmayan kaynak null birakir, false DEGIL', () => {
  // "listede degil" ile "bilmiyoruz" ayri seyler.
  assert.equal(normalizeSearchResult({ title: TITLE, source: 'Crossref' }).isInDoaj, null);
});

test('birlestirmede true, false in ustune yazilir; tersi olmaz', () => {
  const [a] = deduplicateResults([
    normalizeSearchResult({ title: TITLE, doi: '10.1/x', source: 'OpenAlex', isInDoaj: false }),
    normalizeSearchResult({ title: TITLE, doi: '10.1/x', source: 'DOAJ' }),
  ]);
  assert.equal(a.isInDoaj, true);

  const [b] = deduplicateResults([
    normalizeSearchResult({ title: TITLE, doi: '10.1/y', source: 'DOAJ' }),
    normalizeSearchResult({ title: TITLE, doi: '10.1/y', source: 'OpenAlex', isInDoaj: false }),
  ]);
  assert.equal(b.isInDoaj, true, 'sonra gelen false, onceki true yu silmemeli');
});

test('bilinmeyen durum false ile doldurulur', () => {
  const [c] = deduplicateResults([
    normalizeSearchResult({ title: TITLE, doi: '10.1/z', source: 'Crossref' }),
    normalizeSearchResult({ title: TITLE, doi: '10.1/z', source: 'OpenAlex', isInDoaj: false, issnL: '0029-5493' }),
  ]);
  assert.equal(c.isInDoaj, false);
  assert.equal(c.issnL, '0029-5493');
});

test('DOAJ uyeligi AHP skorunu DEGISTIRMEZ (kapali erisimli saygin dergiler cezalandirilmaz)', async () => {
  const common = { keyCount: 10, expandedSimilarity: 0.5, citedBy: 50, publicationYear: 2020, yearConfidence: 'high', doi: '10.1/q' };
  const [x] = await calculateAHP([{ ...common, id: 'a', isInDoaj: true }]);
  const [y] = await calculateAHP([{ ...common, id: 'b', isInDoaj: false }]);
  assert.equal(x.totalPoint, y.totalPoint);
});
