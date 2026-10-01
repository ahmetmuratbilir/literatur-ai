import test from 'node:test';
import assert from 'node:assert/strict';

import { identify, extractDoi, extractArxiv, parseCitation, parseApaAuthors } from '../services/resolver/parse.js';

test('DOI: URL oneki, sondaki yol parcasi ve noktalama temizleniyor', () => {
  assert.equal(extractDoi('https://onlinelibrary.wiley.com/doi/full/10.1002/eng2.70162'), '10.1002/eng2.70162');
  assert.equal(extractDoi('https://doi.org/10.1000/XYZ.'), '10.1000/xyz');
  assert.equal(extractDoi('see (doi:10.1016/j.procir.2023.02.074).'), '10.1016/j.procir.2023.02.074');
  assert.equal(extractDoi('https://x.org/doi/10.1002/abc.123/pdf'), '10.1002/abc.123');
  // Parantez DOI'nin parcasiysa korunur
  assert.equal(extractDoi('10.1002/(SICI)1097-4571(199806)49:8<693::AID-ASI4>3.0.CO;2-0'), '10.1002/(sici)1097-4571(199806)49:8<693::aid-asi4>3.0.co;2-0');
  assert.equal(extractDoi('baslik 2023 dergi'), null);
});

test('arXiv yalnizca baglam varsa: kaynakca sayilari yanlis eslesmiyor', () => {
  assert.equal(extractArxiv('https://arxiv.org/abs/1706.03762v5'), '1706.03762');
  assert.equal(extractArxiv('1706.03762'), '1706.03762');
  assert.equal(extractArxiv('https://huggingface.co/papers/2106.09685'), '2106.09685');
  assert.equal(extractArxiv('Journal 2019, 1234.56789 sayfa'), null);
  assert.equal(extractArxiv('arXiv:hep-th/9901001'), 'hep-th/9901001');
});

test('URL turleri: PII, GitHub', () => {
  const sd = identify('https://www.sciencedirect.com/science/article/pii/S2212827123000641');
  assert.equal(sd.pii, 'S2212827123000641');
  assert.equal(sd.doi, null);
  assert.ok(identify('https://github.com/user/repo').github);
  assert.equal(identify('PMID: 12345678').pmid, '12345678');
  assert.equal(identify('ISBN 978-3-16-148410-0').isbn, '9783161484100');
});

test('APA yazar blogu soyadlarina ayriliyor (onekli soyad dahil)', () => {
  assert.deepEqual(parseApaAuthors('Di Luozzo, S., Starnoni, M., & Schiraldi, M. M.'), ['Di Luozzo', 'Starnoni', 'Schiraldi']);
  assert.deepEqual(parseApaAuthors('Koç, B.'), ['Koç']);
});

test('APA satiri: yazar, yil, baslik, dergi, cilt, sayi, sayfa', () => {
  const c = parseCitation('Smith, J., & Doe, A. B. (2020). Deep learning for X. Journal of Y, 12(3), 45–67. https://doi.org/10.1000/xyz.');
  assert.equal(c.style, 'apa');
  assert.deepEqual(c.authors, ['Smith', 'Doe']);
  assert.equal(c.year, 2020);
  assert.equal(c.title, 'Deep learning for X');
  assert.equal(c.venue, 'Journal of Y');
  assert.equal(c.volume, '12');
  assert.equal(c.issue, '3');
  assert.equal(c.pages, '45-67');
});

test('IEEE satiri: tirnakli baslik', () => {
  const c = parseCitation('A. Vaswani, N. Shazeer, and N. Parmar, "Attention is all you need," in Proc. NeurIPS, vol. 30, pp. 5998-6008, 2017.');
  assert.equal(c.title, 'Attention is all you need');
  assert.deepEqual(c.authors, ['Vaswani', 'Shazeer', 'Parmar']);
  assert.equal(c.year, 2017);
  assert.equal(c.pages, '5998-6008');
});

test('serbest metin: yildan onceki buyuk harfli sozcukler yazar adayi, kisaltmalar degil', () => {
  const c = parseCitation('Thiede 2023 advanced energy data analytics predict OEE');
  assert.equal(c.structured, false);
  assert.deepEqual(c.authorCandidates, ['Thiede']);
  assert.equal(c.year, 2023);
  assert.equal(c.title, 'advanced energy data analytics predict OEE');
  const t = parseCitation('OEE insan faktörü AHP makalesi');
  assert.deepEqual(t.authorCandidates, []);
  assert.equal(t.year, null);
});
