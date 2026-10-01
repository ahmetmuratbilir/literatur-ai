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

  // Resmi CSL stilleri (MLA 9, Chicago 18)
  assert.match(mla, /“Derin Ogrenme Ile Tani\.” Journal of Medical AI, 2023,/);
  assert.match(chicago, /“Derin Ogrenme Ile Tani\.” Journal of Medical AI, 2023\./);
  assert.notEqual(mla, chicago);
});

test('eksik metadata uydurulmuyor, fallback metne dusuyor', () => {
  // Kunye blogu prompt'tan cikarildigi icin modelin uydurma ihtimali kalkti;
  // kodun da uydurmadigini burasi garanti ediyor.
  const section = buildBibliographySection(
    [paper({ authors: '', journal: '', year: '', doi: '', url: '' })],
    'APA 7'
  );

  // APA: yazar yoksa baslik one gecer, tarih yoksa n.d.; yer tutucu
  // ("Bilinmeyen Yazar", "Bilinmeyen yayın") yazilmaz.
  assert.match(section, /Derin ogrenme ile tani\. \(n\.d\.\)\./);
  assert.equal(/Bilinmeyen/.test(section), false, section);
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

// --- Citation.js (services/bibliography.js) ---
import { parseAuthors, enrichPapersWithCsl, formatReference } from '../services/bibliography.js';

test('yazar adlari soyad + ad olarak ayristiriliyor', () => {
  assert.deepEqual(parseAuthors('Ada Lovelace, Alan M. Turing'), [
    { family: 'Lovelace', given: 'Ada' },
    { family: 'Turing', given: 'Alan M.' },
  ]);
  assert.deepEqual(parseAuthors('Smith, J., Doe, A. B.'), [
    { family: 'Smith', given: 'J.' },
    { family: 'Doe', given: 'A. B.' },
  ]);
  assert.deepEqual(parseAuthors('Bilinmeyen'), []);
});

test('APA 7: yazar soyad, bas harf ve & ile', () => {
  const ref = formatReference(paper({ authors: 'Ada Lovelace, Alan M. Turing', doi: '' }), 'APA 7');
  assert.match(ref, /^Lovelace, A\., & Turing, A\. M\. \(2023\)\./);
});

test('IEEE satiri makalenin kendi ref numarasini tasiyor', () => {
  const ref = formatReference(paper({ ref: 7 }), 'IEEE');
  assert.match(ref, /^\[7\] J\. Smith, “Derin ogrenme ile tani,”/);
});

test('Turkce baslik MLA buyuk harf kuraliyla bozulmuyor', () => {
  const ref = formatReference(paper({ title: 'Eğitimde yapay zekâ kullanımı' }), 'MLA');
  assert.match(ref, /“Eğitimde yapay zekâ kullanımı\.”/);
});

test('APA kaynakca yazar soyadina gore alfabetik, IEEE numara sirasinda', () => {
  const papers = [
    paper({ ref: 1, id: 'z', authors: 'Zeynep Arslan', title: 'Z makalesi' }),
    paper({ ref: 2, id: 'a', authors: 'Ali Ak', title: 'A makalesi' }),
  ];
  const apa = buildBibliographySection(papers, 'APA 7');
  assert.ok(apa.indexOf('Ak, A.') < apa.indexOf('Arslan, Z.'), apa);
  const ieee = buildBibliographySection(papers, 'IEEE');
  assert.ok(ieee.indexOf('[1]') < ieee.indexOf('[2]'), ieee);
});

test('DOI kunyesi doi.org yanitindan aliniyor (cilt, sayfa, tum yazarlar)', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push([url, opts.headers.Accept]);
    return { ok: true, status: 200, json: async () => ({
      type: 'article-journal', title: 'Real title', DOI: '10.9999/test-a',
      author: [{ family: 'Sanusi', given: 'Ismaila Temitayo' }, { family: 'Dixon', given: 'Raymond A.' }],
      'container-title': 'Computers and Education Open', volume: '3', page: '100083',
      issued: { 'date-parts': [[2022, 12]] }, source: 'Crossref', reference: [{ key: 'x' }],
    }) };
  };
  const papers = [paper({ doi: 'https://doi.org/10.9999/TEST-A', authors: 'I. Sanusi' })];
  await enrichPapersWithCsl(papers, { fetchImpl });
  assert.equal(calls[0][0], 'https://doi.org/10.9999/test-a');
  assert.equal(calls[0][1], 'application/vnd.citationstyles.csl+json');
  assert.equal(papers[0].csl.reference, undefined, 'buyuk alanlar atiliyor');
  const ref = formatReference(papers[0], 'APA 7');
  assert.match(ref, /^Sanusi, I\. T\., & Dixon, R\. A\. \(2022\)\. Real title\. Computers and Education Open, 3, 100083\./);
});

test('doi.org yanit vermezse makale kendi alanlariyla bicimleniyor', async () => {
  const fetchImpl = async () => { throw new Error('timeout'); };
  const papers = [paper({ doi: '10.9999/offline-b' })];
  await enrichPapersWithCsl(papers, { fetchImpl });
  assert.equal(papers[0].csl, undefined);
  assert.match(formatReference(papers[0], 'APA 7'), /^Smith, J\. \(2023\)\. Derin ogrenme ile tani\./);
});
