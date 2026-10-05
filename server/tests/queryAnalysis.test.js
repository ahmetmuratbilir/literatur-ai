import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { analyzeAndExpandQuery, normalizeQueryAnalysis, tidyBooleanQuery, buildQueryAnalysisPrompt } from '../services/llm.js';

const GOOD = {
  intent: 'Pasif soğutma güvenliği literatürü',
  keywords: [{ label: 'pasif soğutma', term: 'passive cooling', weight: 3 }, { label: 'SMR', term: 'SMR', weight: 9 }, { label: 'x', term: 'passive cooling' }],
  queries: [
    { label: 'Genel bakış', focus: 'Geniş tarama', text: '("small modular reactor" OR SMR) AND "passive cooling"', keywords: ['SMR'], relevanceScore: 120 },
    { label: 'Bozuk', text: '("small modular reactor" OR SMR AND "passive cooling"' },
  ],
  explanation: 'Açıklama',
};

test('normalize: agirlik sinirlanir, tekrar eden terim atilir, bozuk sorgu elenir', () => {
  const r = normalizeQueryAnalysis(GOOD, 'tr');
  assert.equal(r.keywords.length, 2);
  assert.equal(r.keywords[1].weight, 3);
  assert.equal(r.queries.length, 1);
  assert.equal(r.queries[0].relevanceScore, 99);
  assert.equal(r.lang, 'tr');
});

test('normalize: etiketi olmayan eski bicim sorgu okunabilir baslik alir', () => {
  const r = normalizeQueryAnalysis({ queries: [{ text: '("deep learning" OR CNN) AND radiology' }] }, 'en');
  assert.equal(r.queries[0].label.includes('AND'), false);
  assert.match(r.queries[0].label, /deep learning/);
});

test('tidyBooleanQuery: parantezsiz OR/AND karisimi gruplanir, joker atilir', () => {
  assert.equal(tidyBooleanQuery('"small modular reactor" OR SMR AND "passive cooling" AND safety'), '("small modular reactor" OR SMR) AND "passive cooling" AND safety');
  assert.equal(tidyBooleanQuery('review* AND (model* OR simulation)'), 'review AND (model OR simulation)');
  assert.equal(tidyBooleanQuery('(a OR b) AND c'), '(a OR b) AND c');
});

test('prompt gorunen alanlarin dilini arayuz diline baglar', () => {
  assert.match(buildQueryAnalysisPrompt('en'), /MUST be in English, whatever language the topic/);
  assert.match(buildQueryAnalysisPrompt('tr'), /MUST be in Turkish/);
});

function fakeProvider(name, handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => handler(JSON.parse(body), res));
    });
    server.listen(0, () => resolve({ server, provider: { name, url: `http://127.0.0.1:${server.address().port}/v1/chat/completions`, key: 'k', model: 'm', body: {} } }));
  });
}
const reply = (res, content) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content } }] })); };

test('ilk saglayici kotadaysa ve ikincisi bozuk JSON donerse ucuncusu cevap verir', async () => {
  const a = await fakeProvider('groq', (_b, res) => { res.writeHead(429); res.end('rate limit'); });
  const b = await fakeProvider('deepseek', (_b, res) => reply(res, 'bu json degil'));
  let sentLang = null;
  const c = await fakeProvider('gemini', (body, res) => { sentLang = body.messages[1].content; reply(res, JSON.stringify(GOOD)); });
  try {
    const r = await analyzeAndExpandQuery('konu', { lang: 'en', providers: [a.provider, b.provider, c.provider] });
    assert.equal(r.provider, 'gemini');
    assert.equal(r.queries.length, 1);
    assert.match(sentLang, /in English/);
  } finally { [a, b, c].forEach((x) => x.server.close()); }
});

test('hepsi basarisizsa ALL_PROVIDERS_FAILED firlatir', async () => {
  const a = await fakeProvider('groq', (_b, res) => { res.writeHead(503); res.end('busy'); });
  try {
    await assert.rejects(analyzeAndExpandQuery('konu', { providers: [a.provider] }), (e) => e.code === 'ALL_PROVIDERS_FAILED');
  } finally { a.server.close(); }
});
