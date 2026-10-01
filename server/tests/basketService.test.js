import test from 'node:test';
import assert from 'node:assert/strict';
import { BASKET_LIMIT } from '../models/Basket.js';
import { minimizeBasketPaper, basketPaperKey, planBasketAdd, collectLegacyPapers } from '../services/basketService.js';

test('basket paper keeps writer fields and clips long abstracts', () => {
  const p = minimizeBasketPaper({ title: ' T ', creator: 'A B', year: 2020, description: 'x'.repeat(900), doi: '10.1/X' });
  assert.equal(p.title, 'T');
  assert.equal(p.authors, 'A B');
  assert.equal(p.year, '2020');
  assert.equal(p.description.length, 600);
});

test('basket key prefers DOI and ignores case', () => {
  assert.equal(basketPaperKey({ doi: '10.1/AbC', title: 'x' }), 'doi:10.1/abc');
  assert.equal(basketPaperKey({ title: 'Hello' }), 'title:hello');
});

test('basket add rejects duplicates, empty papers and a full basket', () => {
  assert.equal(planBasketAdd([], {}).reason, 'invalid');
  assert.equal(planBasketAdd([{ doi: '10.1/a' }], { doi: '10.1/A', title: 'y' }).reason, 'duplicate');
  const full = Array.from({ length: BASKET_LIMIT }, (_, i) => ({ title: `p${i}` }));
  assert.equal(planBasketAdd(full, { title: 'new' }).reason, 'full');
  assert.equal(planBasketAdd([], { title: 'ok' }).ok, true);
});

test('legacy collections migrate newest first, deduplicated, capped', () => {
  const papers = Array.from({ length: 40 }, (_, i) => ({ title: `p${i}`, savedAt: new Date(2020, 0, i + 1) }));
  const out = collectLegacyPapers([{ papers: papers.slice(0, 20) }, { papers: [...papers.slice(20), { title: 'P39' }] }]);
  assert.equal(out.length, BASKET_LIMIT);
  assert.equal(out[0].title, 'p39');
  assert.equal(new Set(out.map((p) => p.title.toLowerCase())).size, BASKET_LIMIT);
});
