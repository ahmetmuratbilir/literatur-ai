import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAiConnectionsRouter, aiContextMiddleware } from '../routes/aiConnections.js';
import { memoryStore, invalidateConnection } from '../services/aiConnectionService.js';
import { runWithAiContext, noteProviderResponse, currentKeySource } from '../services/aiContext.js';
import { chatProvidersInOrder, getActiveProviders, resolveChatProvider } from '../config/aiModels.js';

const SECRET = 'test-master-secret-0123456789abcdef';
const GOOD = 'sk-good-SECRETVALUE-000111';
const BAD = 'sk-bad-SECRETVALUE-999888';
// Sahte sağlayıcı: model listesi isteğine anahtara göre yanıt verir.
const fakeFetch = async (url, init) => ({ ok: init.headers.Authorization === `Bearer ${GOOD}`, status: init.headers.Authorization === `Bearer ${GOOD}` ? 200 : 401 });

async function startApp({ enabled = true, store = memoryStore() } = {}) {
  const app = express();
  app.use(express.json());
  const getAuth = (req) => ({ userId: req.headers['x-user'] || null });
  app.use(aiContextMiddleware({ getAuth, getStore: () => store, enabled, runWithAiContext, secret: SECRET }));
  app.use('/api/ai-connections', createAiConnectionsRouter({ getAuth, getStore: () => store, enabled, fetchImpl: fakeFetch, secret: SECRET }));
  // Bağlamı gözlemleyen deneme ucu: aiModels'ın ne çözdüğünü döndürür.
  app.get('/api/probe', (req, res) => {
    const p = resolveChatProvider({ profile: 'fast' });
    res.json({ active: getActiveProviders(), provider: p?.name || null, keySource: p?.keySource || null, keyIsGood: p?.key === GOOD, others: chatProvidersInOrder(['groq', 'deepseek', 'gemini']).map((x) => x.name) });
  });
  app.get('/api/fail', (req, res) => { noteProviderResponse(resolveChatProvider({ profile: 'fast' }), 401); res.json({ ok: false }); });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, user = 'u1') => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : null, headers: res.headers };
  };
  return { call, close: () => new Promise((r) => server.close(r)), store };
}

test('anahtar kaydedilir, denenir, etkin olur; hiçbir yanıtta anahtar ya da şifreli alan yok', async () => {
  const logs = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  for (const k of Object.keys(orig)) console[k] = (...a) => logs.push(a.join(' '));
  const app = await startApp();
  try {
    const saved = await app.call('POST', '/api/ai-connections', { provider: 'deepseek', key: GOOD });
    assert.equal(saved.status, 200);
    assert.equal(saved.json.status, 'ok');
    assert.deepEqual(saved.json.connections, [{ provider: 'deepseek', last4: '0111', active: true, lastStatus: 'ok', lastCheckedAt: saved.json.connections[0].lastCheckedAt }]);
    const listed = await app.call('GET', '/api/ai-connections');
    for (const r of [saved, listed]) {
      assert.ok(!r.text.includes('SECRETVALUE'), 'yanıtta anahtar var');
      assert.ok(!/cipher|"iv"|"tag"/.test(r.text), 'yanıtta şifreli alan var');
    }
    assert.equal(listed.json.storage, 'memory');
  } finally {
    await app.close();
    Object.assign(console, orig);
  }
  assert.ok(!logs.join('\n').includes('SECRETVALUE'), 'logda anahtar var');
});

test('geçersiz anahtar kaydedilir ama etkin yapılmaz; durum "invalid"', async () => {
  const app = await startApp();
  try {
    const r = await app.call('POST', '/api/ai-connections', { provider: 'groq', key: BAD });
    assert.equal(r.json.status, 'invalid');
    assert.equal(r.json.connections[0].active, false);
  } finally { await app.close(); }
});

test('girdi denetimi, giriş zorunlu, kapalıyken 503 ve "enabled: false"', async () => {
  const on = await startApp();
  try {
    assert.equal((await on.call('POST', '/api/ai-connections', { provider: 'openai', key: GOOD })).status, 400);
    assert.equal((await on.call('POST', '/api/ai-connections', { provider: 'groq', key: 'kısa' })).status, 400);
    assert.equal((await on.call('GET', '/api/ai-connections', null, null)).status, 401);
  } finally { await on.close(); }
  const off = await startApp({ enabled: false });
  try {
    assert.equal((await off.call('GET', '/api/ai-connections')).json.enabled, false);
    assert.equal((await off.call('POST', '/api/ai-connections', { provider: 'groq', key: GOOD })).status, 503);
  } finally { await off.close(); }
});

test('etkin bağlantı varken istek kullanıcının anahtarıyla; diğer sağlayıcılara sessizce geçilmez', async () => {
  const saved = { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY, GROQ_API_KEY: process.env.GROQ_API_KEY, GEMINI_API_KEY: process.env.GEMINI_API_KEY };
  Object.assign(process.env, { DEEPSEEK_API_KEY: 'platform-deepseek', GROQ_API_KEY: 'platform-groq', GEMINI_API_KEY: 'platform-gemini' });
  const app = await startApp();
  try {
    const before = await app.call('GET', '/api/probe');
    assert.equal(before.json.keySource, 'platform');
    await app.call('POST', '/api/ai-connections', { provider: 'gemini', key: GOOD });
    invalidateConnection('u1');
    const after = await app.call('GET', '/api/probe');
    assert.deepEqual(after.json.active, ['gemini']);
    assert.equal(after.json.provider, 'gemini');
    assert.equal(after.json.keySource, 'user');
    assert.equal(after.json.keyIsGood, true);
    assert.deepEqual(after.json.others, ['gemini']);
    // Başka kullanıcı etkilenmez
    assert.equal((await app.call('GET', '/api/probe', null, 'u2')).json.keySource, 'platform');
    // Varsayılana dönünce platform
    await app.call('POST', '/api/ai-connections/default');
    assert.equal((await app.call('GET', '/api/probe')).json.keySource, 'platform');
  } finally {
    await app.close();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('kullanıcı anahtarı 401 verince yanıta X-AI-Key-Status, bağlantı durumu "invalid" olur', async () => {
  const app = await startApp();
  try {
    await app.call('POST', '/api/ai-connections', { provider: 'deepseek', key: GOOD });
    invalidateConnection('u1');
    const r = await app.call('GET', '/api/fail');
    assert.equal(r.headers.get('x-ai-key-status'), 'invalid');
    await new Promise((res) => setTimeout(res, 20));
    const listed = await app.call('GET', '/api/ai-connections');
    assert.equal(listed.json.connections[0].lastStatus, 'invalid');
  } finally { await app.close(); }
});

test('bağlam dışında anahtar kaynağı "platform"', () => {
  assert.equal(currentKeySource(), 'platform');
  runWithAiContext({ connection: { provider: 'groq', key: 'x' } }, () => assert.equal(currentKeySource(), 'user'));
});
