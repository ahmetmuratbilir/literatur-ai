import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateCitationScore, calculateAHP } from '../services/ahp.js';
import { deduplicateResults, normalizeSearchResult } from '../services/searchRankingService.js';

test('FWCI varsa atif puani alana gore normalize (logaritmik)', () => {
  const avg = calculateCitationScore({ fwci: 1, citedBy: 5 }, 2020);
  assert.equal(avg.basis, 'field');
  assert.ok(Math.abs(avg.score - 0.176) < 0.01, `alan ortalamasi ~0.18, ${avg.score}`);
  assert.equal(calculateCitationScore({ fwci: 50 }, 2020).score, 1);
  assert.equal(calculateCitationScore({ fwci: 500 }, 2020).score, 1);
  assert.equal(calculateCitationScore({ fwci: 0 }, 2020).score, 0);
});

test('ayni ham atifta az atif yapilan alandaki makale one gecer', () => {
  // Iki makale 40 atif almis; biri alan ortalamasinin 8 kati, digeri 1,2 kati.
  const niche = calculateCitationScore({ citedBy: 40, fwci: 8 }, 2020).score;
  const crowded = calculateCitationScore({ citedBy: 40, fwci: 1.2 }, 2020).score;
  assert.ok(niche > crowded);
});

test('FWCI yoksa yillik atife dusulur, sifirlanmaz', () => {
  const r = calculateCitationScore({ citedBy: 113 }, 2011);
  assert.equal(r.basis, 'perYear');
  assert.ok(r.score > 0.5, `${r.score}`);
});

test('tekillestirme OpenAlex kopyasindaki normalize atifi koruyor', () => {
  const crossref = normalizeSearchResult({ title: 'Passive cooling of small modular reactors', doi: '10.1/x', source: 'Crossref', citedBy: 30 });
  const openalex = normalizeSearchResult({ title: 'Passive cooling of small modular reactors', doi: '10.1/X', source: 'OpenAlex', citedBy: 28, fwci: 11.4, citationPercentile: 0.977, topCitedPercent: 10 });
  const [merged] = deduplicateResults([crossref, openalex]);
  assert.equal(merged.fwci, 11.4);
  assert.equal(merged.citationPercentile, 0.977);
  assert.equal(merged.topCitedPercent, 10);
});

test('AHP sonucu atif olcusunu ve ust %1 aciklamasini tasiyor', async () => {
  const [item] = await calculateAHP([{ title: 't', keyCount: 10, citedBy: 50, fwci: 70, topCitedPercent: 1, publicationYear: 2016, yearConfidence: 'high', doi: '10.1/y' }]);
  assert.equal(item.citationBasis, 'field');
  assert.equal(item.scores.citation, 1);
  assert.ok(item.explanation.includes("Alanında en çok atıf alan %1'de"), JSON.stringify(item.explanation));
});
