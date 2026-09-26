import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBibliographySection } from '../services/aiService.js';

/**
 * Kaynakca artik modelden degil kodun kendisinden geliyor: kunye blogu
 * (dergi, DOI, URL) prompt'tan cikarildi ve model kaynakca yazmamaya
 * yonlendirildi. Bu, buildBibliographySection'i her uretilen belgenin
 * gorunur bir parcasi yapiyor, dolayisiyla dogrudan test ediliyor.
 */

const paper = (overrides) => ({
  ref: 1,
  id: 'p1',
  title: 'Derin ogrenme ile tani',
  authors: 'Smith, J.',
  year: 2023,
  journal: 'Journal of Medical AI',
  doi: '10.1000/abc',
  url: '',
  ...overrides,
});

test('IEEE numarasi makalenin kendi ref degerini kullaniyor', () => {
  // Model, chunk baglaminda gordugu [Kaynak N] numarasiyla atif yapiyor ve o
  // numara ref. Kaynakca konum numarasi kullansaydi, mukerrer bir kaynak
  // elendiginde metin ici [3] ile kaynakcadaki [3] farkli makaleyi gosterirdi.
  const papers = [
    paper({ ref: 1, id: 'a', title: 'Birinci' }),
    paper({ ref: 2, id: 'a', title: 'Birincinin kopyasi' }), // ayni id: elenecek
    paper({ ref: 3, id: 'c', title: 'Ucuncu' }),
  ];

  const section = buildBibliographySection(papers, 'IEEE');

  assert.match(section, /\[1\] .*Birinci/);
  assert.match(section, /\[3\] .*Ucuncu/);
  assert.equal(section.includes('Birincinin kopyasi'), false, 'mukerrer kaynak listelenmemeli');
  assert.equal(section.includes('[2]'), false, 'elenen kaynagin numarasi yeniden kullanilmamali');
});

test('APA 7 varsayilan bicim', () => {
  const section = buildBibliographySection([paper({})], 'APA 7');

  assert.match(section, /^## Kaynakça/);
  assert.match(section, /Smith, J\. \(2023\)\. Derin ogrenme ile tani\. Journal of Medical AI\./);
  assert.match(section, /https:\/\/doi\.org\/10\.1000\/abc/);
});

test('MLA ve Chicago bicimleri ayrisiyor', () => {
  const mla = buildBibliographySection([paper({})], 'MLA');
  const chicago = buildBibliographySection([paper({})], 'Chicago');

  assert.match(mla, /Journal of Medical AI, 2023\./);
  assert.match(chicago, /Journal of Medical AI 2023\./);
  assert.notEqual(mla, chicago);
});

test('eksik metadata uydurulmuyor, fallback metne dusuyor', () => {
  // Kunye blogu prompt'tan cikarildigi icin modelin uydurma ihtimali kalkti;
  // kodun da uydurmadigini burasi garanti ediyor.
  const section = buildBibliographySection(
    [paper({ authors: '', journal: '', year: '', doi: '', url: '' })],
    'APA 7'
  );

  assert.match(section, /Bilinmeyen Yazar/);
  assert.match(section, /n\.d\./);
  assert.match(section, /Bilinmeyen yayın/);
});

test('undefined ve null metinleri kaynakcaya sizmiyor', () => {
  const section = buildBibliographySection(
    [paper({ authors: 'undefined', journal: 'null', doi: undefined, url: undefined })],
    'APA 7'
  );

  assert.equal(/undefined|null/.test(section), false, section);
});

test('kaynak yoksa bos string doner, bos baslik eklenmez', () => {
  assert.equal(buildBibliographySection([], 'APA 7'), '');
});

test('DOI yoksa URL kullaniliyor', () => {
  const section = buildBibliographySection(
    [paper({ doi: '', url: 'https://example.org/makale' })],
    'APA 7'
  );

  assert.match(section, /https:\/\/example\.org\/makale/);
});
