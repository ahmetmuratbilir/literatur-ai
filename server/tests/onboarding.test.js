import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

process.env.NODE_ENV = 'test';

const { createOnboardingRouter } = await import('../routes/onboarding.js');
const { ONBOARDING_OPTIONS, MAX_PURPOSES } = await import('../config/onboarding.js');

function serve({ profile = null, noDb = false, store = async () => true } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/ob', createOnboardingRouter({
    getUserId: () => 'u1',
    load: async () => (noDb ? undefined : profile),
    store,
  }));
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}
const url = (s) => `http://127.0.0.1:${s.address().port}/ob`;
const post = (s, body) => fetch(url(s), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const close = (s) => new Promise((r) => s.close(r));

test('yeni kullanıcıya sorulur; cevaplayan ya da atlayana bir daha sorulmaz', async (t) => {
  const fresh = await serve({ profile: null });
  const answered = await serve({ profile: { onboarding: { answeredAt: new Date() } } });
  const skipped = await serve({ profile: { onboarding: { skippedAt: new Date() } } });
  t.after(() => Promise.all([fresh, answered, skipped].map(close)));
  assert.deepEqual(await (await fetch(url(fresh))).json(), { needed: true });
  assert.deepEqual(await (await fetch(url(answered))).json(), { needed: false });
  assert.deepEqual(await (await fetch(url(skipped))).json(), { needed: false });
});

test('veritabanı yoksa sorulmaz: cevap saklanamaz, her girişte yeniden sorulurdu', async (t) => {
  const s = await serve({ noDb: true });
  t.after(() => close(s));
  assert.deepEqual(await (await fetch(url(s))).json(), { needed: false });
});

test('yalnız sabit seçenekler kabul edilir; serbest metin saklanmaz', async (t) => {
  let stored;
  const s = await serve({ store: async (id, o) => { stored = o; return true; } });
  t.after(() => close(s));
  assert.equal((await post(s, { role: 'astronot', purpose: ['tez'] })).status, 400);
  assert.equal((await post(s, { role: 'doktora', purpose: [] })).status, 400);
  assert.equal((await post(s, { role: 'doktora', purpose: ONBOARDING_OPTIONS.purpose.slice(0, MAX_PURPOSES + 1) })).status, 400);
  const ok = await post(s, { role: 'doktora', purpose: ['tez', 'tez', 'serbest yazı'], source: 'hoca-arkadas', note: 'gizli bilgi' });
  assert.equal(ok.status, 200);
  assert.deepEqual(stored.purpose, ['tez']);
  assert.equal(stored.role, 'doktora');
  assert.equal(stored.source, 'hoca-arkadas');
  assert.equal('note' in stored, false);
  assert.ok(stored.answeredAt instanceof Date);
});

test('atlamak kaydedilir; saklanamazsa 503', async (t) => {
  let stored;
  const ok = await serve({ store: async (id, o) => { stored = o; return true; } });
  const down = await serve({ store: async () => false });
  t.after(() => Promise.all([ok, down].map(close)));
  assert.equal((await post(ok, { skip: true })).status, 200);
  assert.ok(stored.skippedAt instanceof Date);
  assert.equal((await post(down, { skip: true })).status, 503);
});
