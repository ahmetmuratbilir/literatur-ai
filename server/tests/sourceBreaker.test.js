import test from 'node:test';
import assert from 'node:assert/strict';

import { createBreaker, COOLDOWN_MS, TIMEOUTS_TO_OPEN } from '../services/sourceBreaker.js';
import { guarded, classifySourceError } from '../services/search.js';

test('kota hatasi kaynagi 10 dk kapatir, sure dolunca tek deneme istegi', () => {
  let t = 0;
  const b = createBreaker({ now: () => t });
  b.record('S2', 'QUOTA');
  assert.equal(b.check('S2').skip, true);
  t = COOLDOWN_MS.QUOTA + 1;
  const probe = b.check('S2');
  assert.equal(probe.skip, false);
  assert.equal(probe.probe, true);
  // deneme surerken ikinci istek atlanir
  assert.equal(b.check('S2').skip, true);
  b.record('S2', 'QUOTA'); // deneme de basarisiz -> yeniden kapanir
  assert.equal(b.check('S2').skip, true);
});

test('basari kesiciyi sifirlar', () => {
  let t = 0;
  const b = createBreaker({ now: () => t });
  b.record('CORE', 'CREDENTIAL_ACCESS');
  t = COOLDOWN_MS.CREDENTIAL_ACCESS + 1;
  b.check('CORE');
  b.record('CORE', null);
  assert.equal(b.check('CORE').skip, false);
  assert.deepEqual(b.snapshot(), {});
});

test('zaman asimi ancak art arda 3 kez olursa kapatir; genel hata kapatmaz', () => {
  const b = createBreaker({ now: () => 0 });
  for (let i = 1; i < TIMEOUTS_TO_OPEN; i++) { b.record('X', 'TIMEOUT'); assert.equal(b.check('X').skip, false); }
  b.record('X', 'TIMEOUT');
  assert.equal(b.check('X').skip, true);
  b.record('Y', 'ERROR');
  b.record('Y', 'ERROR');
  assert.equal(b.check('Y').skip, false);
});

test('guarded: kesici aciksa kaynak hic cagrilmiyor, hata turu korunuyor', async () => {
  const b = createBreaker({ now: () => 0 });
  let calls = 0;
  const failing = () => { calls++; return Promise.reject(new Error('Request failed with status code 429')); };
  await assert.rejects(guarded('S2', failing, b));
  assert.equal(calls, 1);
  const err = await guarded('S2', failing, b).catch((e) => e);
  assert.equal(calls, 1, 'ikinci aramada kaynak cagrilmamali');
  assert.equal(err.cooldown, true);
  assert.equal(classifySourceError(err), 'QUOTA');
});

test('guarded: basarili sonuc aynen donuyor', async () => {
  const b = createBreaker({ now: () => 0 });
  assert.deepEqual(await guarded('A', async () => ({ results: [1] }), b), { results: [1] });
});

test('anahtar reddi kesici mesajinda da CREDENTIAL_ACCESS olarak siniflaniyor', async () => {
  const b = createBreaker({ now: () => 0 });
  await guarded('CORE', () => Promise.reject(new Error('CORE API Hatası (401)')), b).catch(() => {});
  const err = await guarded('CORE', async () => ({}), b).catch((e) => e);
  assert.equal(classifySourceError(err), 'CREDENTIAL_ACCESS');
});
