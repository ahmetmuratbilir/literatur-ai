import test from 'node:test';
import assert from 'node:assert/strict';

import { checkRetractions, resetRetractionCache } from '../services/retraction.js';
import { guarded, SOURCE_DEADLINE_MS } from '../services/search.js';
import { createBreaker } from '../services/sourceBreaker.js';

test('geri cekilme paketleri eszamanli gidiyor ve DOI basina onbellekte', async () => {
  resetRetractionCache();
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++; inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 30));
    inFlight--;
    const dois = decodeURIComponent(new URL(url).searchParams.get('filter')).split(',').map((x) => x.replace('doi:', ''));
    return { ok: true, json: async () => ({ message: { items: dois.map((d) => ({ DOI: d })) } }) };
  };
  const dois = Array.from({ length: 60 }, (_, i) => `10.1/r${i}`);
  const first = await checkRetractions(dois, { fetchImpl });
  assert.equal(calls, 3); // 20'lik 3 paket
  assert.ok(maxInFlight >= 2, `es zamanli: ${maxInFlight}`);
  assert.equal(first.byDoi.size, 60);
  const second = await checkRetractions(dois, { fetchImpl });
  assert.equal(calls, 3, 'ikinci sorguda istek atilmamali');
  assert.equal(second.byDoi.get('10.1/r5').status, 'none');
});

test('yavas kaynak ortak sure tavaninda kesiliyor ve TIMEOUT sayiliyor', { timeout: SOURCE_DEADLINE_MS + 3000 }, async () => {
  const b = createBreaker({ now: () => 0 });
  const t0 = Date.now();
  const err = await guarded('Slow', () => new Promise(() => {}), b).catch((e) => e);
  assert.ok(Date.now() - t0 < SOURCE_DEADLINE_MS + 500);
  assert.match(err.message, /timeout/);
});
