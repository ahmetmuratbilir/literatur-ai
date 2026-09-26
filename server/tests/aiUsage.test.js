import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeUsage } from '../utils/aiUsage.js';

/**
 * Her saglayici onbellek bilgisini baska bir alan adiyla veriyor. Yanlis alan
 * okundugunda telemetri sessizce "isabet yok" der ve prompt duzenlemeleri
 * korlemesine yapilir; bu yuzden dort sekil de teste bagli.
 */

test('DeepSeek: isabet ve iska alanlari dogrudan okunuyor', () => {
  const summary = summarizeUsage({
    prompt_tokens: 4120,
    completion_tokens: 812,
    prompt_cache_hit_tokens: 2944,
    prompt_cache_miss_tokens: 1176,
  });

  assert.equal(summary.cacheHitTokens, 2944);
  assert.equal(summary.cacheMissTokens, 1176);
  assert.equal(summary.completionTokens, 812);
  assert.ok(Math.abs(summary.hitRate - 2944 / 4120) < 1e-9);
});

test('OpenAI uyumlu: iska, toplam girdiden cikarilarak bulunuyor', () => {
  // Bu sekilde yalnizca isabet eden token bildiriliyor.
  const summary = summarizeUsage({
    prompt_tokens: 1000,
    completion_tokens: 100,
    prompt_tokens_details: { cached_tokens: 640 },
  });

  assert.equal(summary.cacheHitTokens, 640);
  assert.equal(summary.cacheMissTokens, 360);
});

test('Gemini: usageMetadata alan adlari taniniyor', () => {
  const summary = summarizeUsage({
    promptTokenCount: 4120,
    candidatesTokenCount: 800,
    cachedContentTokenCount: 2944,
  });

  assert.equal(summary.promptTokens, 4120);
  assert.equal(summary.completionTokens, 800);
  assert.equal(summary.cacheHitTokens, 2944);
});

test('onbellek bilgisi vermeyen saglayici sifir isabet olarak damgalanmiyor', () => {
  // Groq onbellek sunmuyor. Bunu "%0 isabet" diye raporlamak, gercekten
  // bozulmus bir DeepSeek isabetiyle ayni gorunurdu.
  const summary = summarizeUsage({ prompt_tokens: 4120, completion_tokens: 800 });

  assert.equal(summary.hitRate, null, 'bilgi yoklugu ile sifir isabet ayrilmali');
  assert.equal(summary.cacheMissTokens, 4120);
});

test('usage yoksa null doner, cagiran taraf patlamaz', () => {
  assert.equal(summarizeUsage(undefined), null);
  assert.equal(summarizeUsage(null), null);
  assert.equal(summarizeUsage('usage'), null);
});

test('sifir girdili yanit orani hesaplamaya calismiyor', () => {
  const summary = summarizeUsage({ prompt_tokens: 0, completion_tokens: 0, prompt_cache_hit_tokens: 0 });

  assert.equal(summary.hitRate, null, 'sifira bolme NaN uretmemeli');
});
