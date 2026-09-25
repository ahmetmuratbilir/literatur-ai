import test from 'node:test';
import assert from 'node:assert/strict';

import { searchSimilarChunksWithAtlas } from '../services/embeddingService.js';
import { createChunksFromArticles, buildContextFromChunks } from '../services/ragService.js';

test('Atlas vector search kapsam filtresi olmadan cagrilirsa reddeder', async () => {
  const queryVector = new Array(8).fill(0.1);

  await assert.rejects(
    () => searchSimilarChunksWithAtlas(queryVector, 12),
    /kapsam filtresi olmadan/i,
    'filtresiz cagri sessizce tum koleksiyonu taramamali'
  );

  await assert.rejects(
    () => searchSimilarChunksWithAtlas(queryVector, 12, []),
    /kapsam filtresi olmadan/i,
    'bos hash listesi de filtresiz sayilmali'
  );
});

test('chunk uretimi makalenin ref degerini sourceIndex olarak tasir', () => {
  const articles = [
    { ref: 1, title: 'Reaktor sogutma', abstract: 'Ilk cumle. Ikinci cumle. Ucuncu cumle.' },
    { ref: 2, title: 'Nukleer guvenlik', abstract: 'Baska bir cumle. Devami burada.' },
  ];

  const chunks = createChunksFromArticles(articles);

  assert.ok(chunks.length > 0);
  const refs = new Set(chunks.map((chunk) => chunk.sourceIndex));
  assert.deepEqual([...refs].sort(), [1, 2]);
});

test('kapsam disi chunk elendiginde baglamda yabanci kaynak kalmaz', () => {
  // Atlas'tan donen tipik bir sonuc: sourceIndex String, baska bir istekten gelmis.
  const retrieved = [
    { sourceIndex: '1', title: 'Secilen makale', authors: 'Doe', year: '2024', chunkText: 'Alakali metin.' },
    { sourceIndex: '97', title: 'Baska kullanicinin makalesi', authors: 'Roe', year: '2019', chunkText: 'Sizinti.' },
  ];

  const allowedRefs = new Set([1].map(String));
  const scoped = retrieved.filter((chunk) => allowedRefs.has(String(chunk.sourceIndex)));

  assert.equal(scoped.length, 1);

  const context = buildContextFromChunks(scoped, 12);
  assert.match(context, /Secilen makale/);
  assert.equal(context.includes('Baska kullanicinin makalesi'), false);
  assert.equal(context.includes('Kaynak 97'), false);
});

test('baglam satirlari yazar alanini undefined olarak basmaz', () => {
  const chunks = [
    { sourceIndex: 1, title: 'Baslik', authors: 'Doe, J.', year: '2024', chunkText: 'Metin.' },
  ];

  const context = buildContextFromChunks(chunks, 12);

  assert.match(context, /\[Kaynak 1\] Doe, J\. \(2024\)/);
  assert.equal(context.includes('undefined'), false);
});
