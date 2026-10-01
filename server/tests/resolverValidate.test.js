import test from 'node:test';
import assert from 'node:assert/strict';

import { fold, ratio, tokenSetRatio, titleSimilarity, matchSurname, scoreCandidate, decide, findDiscrepancies } from '../services/resolver/validate.js';
import { parseCitation } from '../services/resolver/parse.js';

const DI_LUOZZO = {
  title: 'On the relationship between human factor and overall equipment effectiveness (OEE): An analysis through the adoption of analytic hierarchy process and ISO 22400',
  authors: [{ family: 'Di Luozzo', given: 'Sebastiano' }, { family: 'Starnoni', given: 'Francesca' }, { family: 'Schiraldi', given: 'Massimiliano M' }],
  year: 2023,
  venue: 'International Journal of Engineering Business Management',
  volume: '15',
  issue: null,
  pages: null,
};

test('Turkce katlama: I/İ, aksanlar, HTML', () => {
  assert.equal(fold('İSTANBUL Işık'), 'istanbul isik');
  assert.equal(fold('Eğitimde <i>yapay</i> zekâ'), 'egitimde yapay zeka');
  assert.equal(fold('Café-Müller'), 'cafe muller');
});

test('ratio ve token_set_ratio rapidfuzz ile ayni davranis', () => {
  assert.equal(ratio('abc', 'abc'), 100);
  assert.equal(Math.round(ratio('this is a test', 'this is a test!')), 97);
  // alt kume -> 100
  assert.equal(tokenSetRatio('energy data analytics OEE', 'Advanced energy data analytics to predict OEE'), 100);
  assert.ok(tokenSetRatio('quantum chicken farming', 'Attention is all you need') < 50);
});

test('cok kisa girdi tek basina "bulundu" olamaz', () => {
  assert.equal(titleSimilarity('OEE', 'OEE in the apparel industry'), 0.7);
});

test('soyad onek toleransi: Luozzo <-> Di Luozzo', () => {
  const m = matchSurname('Luozzo', DI_LUOZZO.authors);
  assert.equal(m.matched, true);
  assert.equal(m.exact, false);
  assert.equal(matchSurname('Koç', [{ family: 'KOC' }]).matched, true);
  assert.equal(matchSurname('Smith', DI_LUOZZO.authors).matched, false);
});

test('skor ve karar: dogru kayit found, yanlis kayit none', () => {
  const parsed = parseCitation('Luozzo, S. D. (2023). On the relationship between human factor and overall equipment effectiveness (OEE): An analysis through the adoption of analytic hierarchy process and ISO 22400. International Journal of Engineering Business Management.');
  const good = scoreCandidate(parsed, DI_LUOZZO);
  assert.ok(good.score >= 0.95, JSON.stringify(good));
  assert.equal(decide(good.score), 'found');
  const bad = scoreCandidate(parsed, { title: 'Attention is all you need', authors: [{ family: 'Vaswani' }], year: 2017 });
  assert.equal(decide(bad.score), 'none');
});

test('yazar ve yil yoksa agirlik basliga kalir', () => {
  const r = scoreCandidate({ title: 'Attention is all you need', authorCandidates: [], year: null }, { title: 'Attention Is All You Need', authors: [], year: 2017 });
  assert.equal(r.score, 1);
  assert.deepEqual(Object.keys(r.parts), ['title']);
});

test('yil farki 1 -> 0.7 (preprint/dergi)', () => {
  const r = scoreCandidate({ title: 'x y z w', authorCandidates: [], year: 2022 }, { title: 'x y z w', authors: [], year: 2023 });
  assert.equal(r.parts.year, 0.7);
});

test('fark raporu: soyad yazimi, eksik ortak yazarlar, eksik cilt', () => {
  const parsed = parseCitation('Luozzo, S. D. (2023). On the relationship between human factor and overall equipment effectiveness (OEE): An analysis through the adoption of analytic hierarchy process and ISO 22400. International Journal of Engineering Business Management.');
  const d = findDiscrepancies(parsed, DI_LUOZZO);
  const byNote = Object.fromEntries(d.map((x) => [x.note, x]));
  assert.equal(byNote.surname_spelling.canonical, 'Di Luozzo');
  assert.deepEqual(byNote.missing_coauthors.missing, ['Starnoni', 'Schiraldi']);
  assert.ok(d.some((x) => x.field === 'volume' && x.note === 'missing'));
  assert.equal(d.some((x) => x.field === 'year'), false);
});

test('serbest metinde fark raporu uretilmez', () => {
  assert.deepEqual(findDiscrepancies(parseCitation('Thiede 2023 energy analytics OEE'), DI_LUOZZO), []);
});
