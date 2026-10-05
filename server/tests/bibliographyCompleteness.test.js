import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAuthors, paperToCsl, formatReference, enrichPapersWithCsl } from '../services/bibliography.js';
import { minimizeBasketPaper } from '../services/basketService.js';

/**
 * Kaynakcada eksik isim / cilt / sayfa sikayetinin uc nedeni vardi:
 * sepet ve yazar route'u yazarlari 3 kisi / 150 karakterde kesiyordu,
 * DOI'siz makalede cilt-sayi-sayfa hic yazilmiyordu ve doi.org istekleri
 * ayni anda gonderildigi icin Crossref bir kismini 429 ile reddediyordu.
 */

test('PubMed / Europe PMC "Soyad ABC" bicimi dogru ayristirilir', () => {
  assert.deepEqual(parseAuthors('Harwani N, Kleinhenz ALW, de la Fuente J'), [
    { family: 'Harwani', given: 'N.' },
    { family: 'Kleinhenz', given: 'A. L. W.' },
    { family: 'de la Fuente', given: 'J.' },
  ]);
});

test('"Ad Soyad" ve "Soyad, A." bicimleri bozulmaz', () => {
  assert.deepEqual(parseAuthors('Ada Lovelace, Alan M. Turing'), [
    { family: 'Lovelace', given: 'Ada' },
    { family: 'Turing', given: 'Alan M.' },
  ]);
  assert.deepEqual(parseAuthors('Lovelace, A., Turing, A. M.'), [
    { family: 'Lovelace', given: 'A.' },
    { family: 'Turing', given: 'A. M.' },
  ]);
});

test('DOI olmayan makalede cilt, sayi ve sayfa kaynakcaya girer', () => {
  const paper = { ref: 1, title: 'A study', authors: 'Ada Lovelace', year: 2020, journal: 'Journal of Tests', volume: '12', issue: '3', pages: '45-67', url: 'https://example.org/a' };
  const csl = paperToCsl(paper, 'x');
  assert.equal(csl.volume, '12');
  assert.equal(csl.issue, '3');
  assert.equal(csl.page, '45-67');
  const line = formatReference(paper, 'APA 7');
  assert.match(line, /Journal of Tests, 12\(3\), 45.67/);
});

test('kaynagin yer tutucusu ("Not Available") kunyeye girmez', () => {
  const line = formatReference({ ref: 1, title: 'X', authors: 'Ada Lovelace', year: 2025, journal: 'Climate Services', volume: '39', pages: 'Not Available' }, 'APA 7');
  assert.doesNotMatch(line, /Not Available/);
  assert.match(line, /Climate Services, 39\./);
});

test('kaynakca prompt icin kisaltilmis listeyi degil tam listeyi kullanir', () => {
  const full = Array.from({ length: 12 }, (_, i) => `Given${i} Family${i}`).join(', ');
  const paper = { ref: 1, title: 'Many authors', authors: full.slice(0, 40), authorsFull: full, year: 2021, journal: 'J' };
  const csl = paperToCsl(paper, 'x');
  assert.equal(csl.author.length, 12);
  assert.equal(csl.author[11].family, 'Family11');
});

test('sepet tum yazarlari ve kunye alanlarini saklar', () => {
  const authors = Array.from({ length: 25 }, (_, i) => `Author Number${i}`);
  const p = minimizeBasketPaper({ title: 'T', authors, volume: 7, issue: '2', pages: '1-9' });
  assert.equal(p.authors.split(', ').length, 25);
  assert.equal(p.volume, '7');
  assert.equal(p.issue, '2');
  assert.equal(p.pages, '1-9');
});

test('doi.org istekleri sinirli eszamanlilikla ve iletisim adresiyle gider', async () => {
  let active = 0;
  let peak = 0;
  const agents = new Set();
  const fetchImpl = async (url, opts) => {
    active++; peak = Math.max(peak, active);
    agents.add(opts.headers['User-Agent']);
    await new Promise((r) => setTimeout(r, 15));
    active--;
    const doi = decodeURIComponent(url.split('doi.org/')[1]);
    return { ok: true, status: 200, json: async () => ({ title: `T ${doi}`, volume: '1' }) };
  };
  const papers = Array.from({ length: 12 }, (_, i) => ({ doi: `10.1000/conc-${i}` }));
  await enrichPapersWithCsl(papers, { fetchImpl, concurrency: 3 });
  assert.ok(peak <= 3, `ayni anda ${peak} istek`);
  assert.equal(papers.filter((p) => p.csl).length, 12);
  assert.ok([...agents].every((a) => /mailto:/.test(a)));
});

test('sure dolunca kalan makaleler beklenmez', async () => {
  const fetchImpl = async () => { await new Promise((r) => setTimeout(r, 40)); return { ok: true, status: 200, json: async () => ({ title: 'x' }) }; };
  const papers = Array.from({ length: 20 }, (_, i) => ({ doi: `10.1000/slow-${i}` }));
  const t0 = Date.now();
  await enrichPapersWithCsl(papers, { fetchImpl, concurrency: 2, budgetMs: 100 });
  assert.ok(Date.now() - t0 < 400);
  assert.ok(papers.filter((p) => p.csl).length < 20);
});
