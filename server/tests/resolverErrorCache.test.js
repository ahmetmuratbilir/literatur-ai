import test from 'node:test';
import assert from 'node:assert/strict';
import { createResolver } from '../services/resolver/pipeline.js';
import { createCache } from '../services/resolver/cache.js';

// Gercek kaynak kodu (sources.js), sahte ag. Diger cozumleyici testleri sahte
// kaynak kullandigi icin sources.js'teki hit() hatasi hic yakalanmiyordu:
// hit(), request()'in koydugu 'error' isaretini 'miss' ile eziyordu; gecici bir
// ag hatasi "makale yok" sayilip 24 saat onbellege yaziliyordu.
const resolverWith = (fetchImpl) => createResolver({
  fetchImpl,
  cache: createCache({ dbReady: () => false }),
  unpaywall: async () => ({ status: 'not_configured' }),
  translate: async () => null,
  env: {},
  retry: (fn) => fn(),
  schedule: (key, fn) => fn(),
});

test('ag hatasiyla bulunamayan DOI onbellege yazilmaz, sonraki istek yeniden dener', async () => {
  let calls = 0;
  const r = resolverWith(async () => { calls += 1; throw new TypeError('fetch failed'); });
  const first = await r.resolve('10.48550/arXiv.1706.03762');
  assert.equal(first.status, 'not_found');
  assert.ok(first.trace.some((t) => t.status === 'error'), 'ag hatasi izde error olarak kalmali');
  const before = calls;
  const second = await r.resolve('10.48550/arXiv.1706.03762');
  assert.equal(second.cached, false);
  assert.ok(calls > before, 'ikinci istek kaynaga yeniden gitmeli');
});

test('sunucu hatasi (503) da gecici sayilir, onbellege yazilmaz', async () => {
  const r = resolverWith(async () => new Response('busy', { status: 503 }));
  await r.resolve('10.1002/eng2.70162');
  const again = await r.resolve('10.1002/eng2.70162');
  assert.equal(again.cached, false);
});

test('gercekten olmayan DOI (404) onbellege yazilir', async () => {
  const r = resolverWith(async () => new Response('not found', { status: 404 }));
  const first = await r.resolve('10.9999/bu-yok-12345');
  assert.equal(first.status, 'not_found');
  const again = await r.resolve('10.9999/bu-yok-12345');
  assert.equal(again.cached, true);
});
