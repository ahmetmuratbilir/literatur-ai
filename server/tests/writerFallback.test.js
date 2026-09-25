import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveGeminiFallback } from '../services/aiService.js';

test('hic token gonderilmemisse Groq fallback yapilabilir', () => {
  // Gecersiz/iptal edilmis anahtar: SDK cagrisi akis baslamadan hata verir.
  const decision = resolveGeminiFallback({ tokensSent: 0 });

  assert.equal(decision.canFallback, true);
  assert.equal(decision.reason, 'no_output_yet');
});

test('akis basladiktan sonra Groq fallback yapilamaz', () => {
  // Kota akis ortasinda biter veya baglanti kopar.
  const decision = resolveGeminiFallback({ tokensSent: 1 });

  assert.equal(decision.canFallback, false);
  assert.equal(
    decision.reason,
    'stream_already_started',
    'iki saglayicinin ciktisi birlestirilmemeli'
  );
});

test('gonderilen token sayisi arttikca karar degismez', () => {
  for (const tokensSent of [1, 5, 500]) {
    assert.equal(resolveGeminiFallback({ tokensSent }).canFallback, false);
  }
});

test('SSE akisi saglayici basina tek meta olayi icerir', () => {
  // generateAcademicText'in istemciye yazdigi olay dizisini modelliyoruz.
  const events = [];
  const write = (event) => events.push(event);

  function simulateGeneration({ geminiTokens, geminiFailsAfterStream }) {
    let tokensSent = 0;

    for (let i = 0; i < geminiTokens; i++) {
      if (tokensSent === 0) write({ meta: { provider: 'gemini' } });
      tokensSent++;
      write({ token: `g${i}` });
    }

    if (geminiFailsAfterStream) {
      const { canFallback } = resolveGeminiFallback({ tokensSent });
      if (canFallback) {
        write({ meta: { provider: 'groq' } });
        write({ token: 'q0' });
      } else {
        write({ meta: { provider: 'gemini', truncated: true } });
        write({ warning: 'kesildi' });
      }
      write({ done: true });
    }
  }

  simulateGeneration({ geminiTokens: 3, geminiFailsAfterStream: true });

  const metaEvents = events.filter((e) => e.meta);
  const providers = new Set(metaEvents.map((e) => e.meta.provider));

  assert.equal(providers.size, 1, 'istemci tek bir saglayici gormeli');
  assert.equal(providers.has('groq'), false, 'yarim Gemini metnine Groq eklenmemeli');
  assert.equal(events.filter((e) => e.done).length, 1);
  assert.equal(events.some((e) => e.warning), true, 'kesinti kullaniciya bildirilmeli');
});

test('akis hic baslamadiysa Groq devreye girer', () => {
  const events = [];
  let tokensSent = 0;

  const { canFallback } = resolveGeminiFallback({ tokensSent });
  assert.equal(canFallback, true);

  events.push({ meta: { provider: 'groq' } });
  events.push({ token: 'q0' });
  events.push({ done: true });

  const providers = new Set(events.filter((e) => e.meta).map((e) => e.meta.provider));
  assert.deepEqual([...providers], ['groq']);
});
