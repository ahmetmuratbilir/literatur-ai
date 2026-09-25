import test from 'node:test';
import assert from 'node:assert/strict';

import { cosineSimilarity } from '../services/embeddingService.js';

test('esit boyutlu vektorlerde dogru benzerlik hesaplar', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosineSimilarity([1, 1], [1, 0]) - Math.SQRT1_2) < 1e-12);
});

test('sifir vektor NaN degil 0 doner', () => {
  assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
});

test('boyut uyusmazligi NaN uretmez', () => {
  // Cache'te eski bir modelden kalmis kisa vektor bu durumu olusturuyordu.
  const score = cosineSimilarity([1, 2, 3, 4], [1, 2]);

  assert.equal(Number.isNaN(score), false, 'NaN sort karsilastirmasini bozar');
  assert.equal(score, 0);
});

test('gecersiz girdi NaN uretmez', () => {
  assert.equal(cosineSimilarity(null, [1, 2]), 0);
  assert.equal(cosineSimilarity([1, 2], undefined), 0);
});

test('boyut uyusmazligi siralamayi bozmaz', () => {
  const query = [1, 0, 0, 0];
  const chunks = [
    { id: 'zayif', embedding: [0.1, 0.9, 0, 0] },
    { id: 'bozuk-boyut', embedding: [1, 0] },
    { id: 'guclu', embedding: [1, 0, 0, 0] },
  ];

  const scored = chunks
    .map((c) => ({ ...c, score: cosineSimilarity(query, c.embedding) }))
    .sort((a, b) => b.score - a.score);

  assert.equal(scored.every((c) => Number.isFinite(c.score)), true);
  assert.equal(scored[0].id, 'guclu', 'en benzer chunk basta olmali');
  assert.equal(scored[scored.length - 1].id, 'bozuk-boyut');
});
