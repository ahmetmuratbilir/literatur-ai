import test from 'node:test';
import assert from 'node:assert/strict';

import { rankWithFirstPageRetractions } from '../services/rankingPipeline.js';

const paper = (i, extra = {}) => ({
  title: `Paper ${i}`,
  doi: `10.1/p${i}`,
  keyCount: 15 - (i % 15),
  citedBy: 100 - i,
  publicationYear: 2020,
  yearConfidence: 'high',
  ...extra,
});

test('yalnizca ilk sayfa kontrol ediliyor', async () => {
  const pool = Array.from({ length: 60 }, (_, i) => paper(i));
  const seen = [];
  const annotate = async (items) => {
    seen.push(...items.map((x) => x.doi));
    for (const x of items) x.retraction = { status: 'none', notices: [] };
    return { retracted: 0, concern: 0, checked: items.length, errors: [] };
  };
  const out = await rankWithFirstPageRetractions(pool, { displayCount: 60 }, { annotate, pageSize: 25 });
  assert.ok(out.results.length > 25, String(out.results.length)); // AHP kendi alaka esigini uyguluyor
  assert.equal(seen.length, 25);
  assert.equal(out.retractionSummary.checked, 25);
  // Durum havuza da yaziliyor (onbellege gecsin)
  assert.equal(pool.filter((p) => p.retraction).length, 25);
});

test('ilk sayfada geri cekilmis makale yeniden siralamayla asagi iner', async () => {
  const pool = Array.from({ length: 40 }, (_, i) => paper(i));
  const annotate = async (items) => {
    for (const x of items) x.retraction = { status: x.doi === '10.1/p0' ? 'retracted' : 'none', notices: [] };
    return { retracted: 1, concern: 0, checked: items.length, errors: [] };
  };
  const before = await rankWithFirstPageRetractions(pool.map((p) => ({ ...p })), { displayCount: 40 }, { annotate: async () => ({ retracted: 0, concern: 0, checked: 0, errors: [] }) });
  const topBefore = before.results.findIndex((r) => r.doi === '10.1/p0');
  const out = await rankWithFirstPageRetractions(pool, { displayCount: 40 }, { annotate });
  const topAfter = out.results.findIndex((r) => r.doi === '10.1/p0');
  assert.ok(topAfter > topBefore, `once ${topBefore}, sonra ${topAfter}`);
  assert.equal(out.results[topAfter].retraction.status, 'retracted');
});

test('DOI yoksa kontrol yapilmiyor', async () => {
  let called = false;
  const out = await rankWithFirstPageRetractions([paper(1, { doi: '' })], { displayCount: 5 }, { annotate: async () => { called = true; return {}; } });
  assert.equal(called, false);
  assert.equal(out.results.length, 1);
});
