import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runWithAiContext } from '../services/aiContext.js';
import { chatBody, keyFor, resolveChatProvider } from '../config/aiModels.js';

/**
 * WO-027 — "Kullanıcı kendi anahtarını girdiyse BÜTÜN yapay zekâ işleri onunla."
 * Güvence mimaride: anahtar yalnız `keyFor` (config/aiModels.js) üzerinden
 * okunur; o da istek bağlamındaki kullanıcı anahtarını önce verir. Bu test,
 * başka bir dosyanın platform anahtarını doğrudan okumasını yakalar.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY_READ = /process\.env\.(DEEPSEEK|GEMINI|GROQ|OPENAI|MOONSHOT|ANTHROPIC)_API_KEY/g;
// İzinli: kapının kendisi; anahtar sağlığı yönetici yoklaması (platform anahtarını
// bilerek dener); index.js yalnız "yapılandırıldı mı" bilgisini gösterir, çağrı yapmaz.
const ALLOWED = new Set(['config/aiModels.js', 'services/keyHealthService.js', 'index.js']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'tests', 'scratch', 'coverage', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('platform yapay zekâ anahtarı yalnız kapıdan okunur (keyFor)', () => {
  const offenders = [];
  for (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (ALLOWED.has(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const hits = text.match(KEY_READ);
    if (hits) offenders.push(`${rel}: ${[...new Set(hits)].join(', ')}`);
  }
  assert.deepEqual(offenders, [], `kapıyı atlayan anahtar okuması:\n${offenders.join('\n')}`);
});

test('index.js platform anahtarını yalnız "yapılandırıldı mı" için okur', () => {
  const text = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
  for (const line of text.split('\n').filter((l) => KEY_READ.test(l))) {
    KEY_READ.lastIndex = 0;
    assert.match(line, /has\(process\.env\.\w+_API_KEY\)/, `beklenmeyen okuma: ${line.trim()}`);
  }
});

test('kullanıcı bağlamında her sağlayıcı için anahtar kullanıcınındır; platform anahtarı görünmez', () => {
  const saved = { ...process.env };
  Object.assign(process.env, { DEEPSEEK_API_KEY: 'PLATFORM-DS', GEMINI_API_KEY: 'PLATFORM-GM', GROQ_API_KEY: 'PLATFORM-GQ' });
  try {
    for (const provider of ['deepseek', 'gemini', 'groq', 'openai', 'moonshot', 'anthropic']) {
      runWithAiContext({ connection: { provider, key: `USER-${provider}` } }, () => {
        assert.equal(keyFor(provider), `USER-${provider}`);
        for (const other of ['deepseek', 'gemini', 'groq'].filter((p) => p !== provider)) assert.equal(keyFor(other), null, `${provider} bağlıyken ${other} platform anahtarı`);
        const chosen = resolveChatProvider({ profile: 'fast' });
        assert.equal(chosen?.name, provider);
        assert.equal(chosen?.key, `USER-${provider}`);
        assert.equal(chosen?.keySource, 'user');
      });
    }
  } finally {
    for (const k of ['DEEPSEEK_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
});

test('chatBody sağlayıcının desteklemediği alanları atar (Claude: sıcaklık, JSON modu)', () => {
  runWithAiContext({ connection: { provider: 'anthropic', key: 'USER' } }, () => {
    const p = resolveChatProvider({ profile: 'fast' });
    const body = chatBody(p, { model: p.model, temperature: 0.2, response_format: { type: 'json_object' }, max_tokens: 100 });
    assert.equal('temperature' in body, false);
    assert.equal('response_format' in body, false);
    assert.equal(body.max_tokens, 100);
  });
  runWithAiContext({ connection: { provider: 'deepseek', key: 'USER' } }, () => {
    const p = resolveChatProvider({ profile: 'fast' });
    const body = chatBody(p, { temperature: 0.2 });
    assert.equal(body.temperature, 0.2);
    assert.deepEqual(body.thinking, { type: 'disabled' });
  });
});

test('depo geçici hata verirse son bilinen kullanıcı bağlantısı kullanılır (platforma düşülmez)', async () => {
  const { activeConnection, invalidateConnection } = await import('../services/aiConnectionService.js');
  const { sealKey } = await import('../services/keyVault.js');
  const SECRET = 'test-master-secret-0123456789abcdef';
  const row = { provider: 'openai', ...sealKey('sk-USER-openai-123456', SECRET) };
  let fail = false;
  const store = { active: async () => { if (fail) throw new Error('mongo kesildi'); return row; } };
  invalidateConnection('u-stale');
  const first = await activeConnection(store, 'u-stale', { now: 0, secret: SECRET });
  assert.equal(first.provider, 'openai');
  fail = true;
  const later = await activeConnection(store, 'u-stale', { now: 10 * 60 * 1000, secret: SECRET });
  assert.equal(later?.provider, 'openai', 'süresi geçmiş kayıt hata anında kullanılmalı');
  invalidateConnection('u-stale');
  await assert.rejects(activeConnection(store, 'u-stale', { now: 0, secret: SECRET }), /mongo kesildi/);
});

test('sorgu analizi kullanıcının sağlayıcısıyla (OpenAI/Kimi/Claude da)', async () => {
  const { analyzeAndExpandQuery } = await import('../services/llm.js');
  const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = await import('undici');
  const previous = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  const seen = [];
  const content = JSON.stringify({ intent: 'x', keywords: [{ label: 'a', term: 'a', weight: 3 }], queries: [{ label: 'A', text: 'a AND b', keywords: ['a'] }], explanation: '' });
  agent.get('https://api.openai.com').intercept({ path: '/v1/chat/completions', method: 'POST' }).reply((opts) => {
    seen.push(opts.headers.authorization || opts.headers.Authorization);
    return { statusCode: 200, data: { choices: [{ message: { content } }], usage: {} } };
  });
  try {
    await runWithAiContext({ connection: { provider: 'openai', key: 'USER-openai' } }, () => analyzeAndExpandQuery('konu', { lang: 'tr' }));
    assert.deepEqual(seen, ['Bearer USER-openai']);
  } finally {
    setGlobalDispatcher(previous);
    await agent.close();
  }
});
