import test from 'node:test';
import assert from 'node:assert/strict';

import { enrichWithCitations, resetOpenCitationsCache } from '../services/opencitations.js';

const papers = (n) => Array.from({ length: n }, (_, i) => ({ doi: `10.1/p${i}`, citedBy: 0 }));

test('yanit vermeyen OpenCitations aramayi butceden fazla bekletmiyor', async () => {
  resetOpenCitationsCache();
  const hanging = { get: (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) };
  const t0 = Date.now();
  const out = await enrichWithCitations(papers(12), { http: hanging, budgetMs: 150 });
  assert.ok(Date.now() - t0 < 1000, `${Date.now() - t0} ms`);
  assert.equal(out.length, 12);
  assert.equal(out.some((p) => p.openCitationVerified), false);
});

test('istekler paralel gidiyor ve sonuc 24 saat onbellekte', async () => {
  resetOpenCitationsCache();
  let calls = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const http = {
    get: async () => {
      calls++; inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return { data: [{ count: '7' }] };
    },
  };
  const first = await enrichWithCitations(papers(10), { http, budgetMs: 2000 });
  assert.equal(calls, 10);
  assert.ok(maxInFlight >= 5, `es zamanli: ${maxInFlight}`);
  assert.equal(first[0].citedBy, 7);
  assert.equal(first[0].openCitationVerified, true);
  const second = await enrichWithCitations(papers(10), { http, budgetMs: 2000 });
  assert.equal(calls, 10, 'ikinci aramada istek atilmamali');
  assert.equal(second[3].citedBy, 7);
});

test('atif sayisi olan makaleye dokunulmuyor', async () => {
  resetOpenCitationsCache();
  let calls = 0;
  await enrichWithCitations([{ doi: '10.1/x', citedBy: 50 }], { http: { get: async () => { calls++; return { data: [] }; } } });
  assert.equal(calls, 0);
});
