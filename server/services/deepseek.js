/**
 * DeepSeek istemcisi.
 *
 * API'si OpenAI sohbet formatıyla uyumlu, bu yüzden istek gövdesi Groq ile
 * neredeyse aynı. Ayrı bir SDK gerekmiyor.
 *
 * Önbellek notu: DeepSeek ön-ek bazlı önbellek kullanıyor ve isabet eden girdi
 * token'ı belirgin biçimde ucuz. Bu yüzden çağıranlar sabit talimatları
 * prompt'un BAŞINA, değişken içeriği SONUNA koymalı. En büyük çağıran olan
 * writer akışı bunu writerPrompt.js'teki iki parçalı yapıyla uyguluyor; yeni
 * bir çağrı yeri eklerken aynı düzen izlenmeli.
 *
 * İsabet oranı her yanıtta loglanıyor (utils/aiUsage.js). Bir prompt
 * düzenlemesinden sonra [AI-USAGE] satırındaki oran düştüyse, düzenleme sabit
 * ön eki bölmüştür.
 */
import { fetch } from 'undici';
import { DEEPSEEK_BASE_URL, getDeepseekModel } from '../config/aiModels.js';
import { logAiUsage } from '../utils/aiUsage.js';

const DEFAULT_TIMEOUT_MS = 180000;

/**
 * DeepSeek V4 modelleri varsayılan olarak düşünme (thinking) modunda çalışır.
 * Bu modda akış önce `reasoning_content` gönderir — modelin kendi kendine
 * düşünmesi — ve `content` null gelir. Gerçek cevap ancak düşünme bitince
 * başlar.
 *
 * Düşünme çıktısı kullanıcıya gösterilmez: o metin cevabın kendisi değil.
 *
 * Düşünme varsayılan olarak KAPALI. Ölçüm sonucu: akademik metin üretiminde
 * v4-pro 72 saniye akıl yürütüp token bütçesinin tamamını tüketti ve hiç metin
 * üretmedi; düşünmenin tetiklenmediği aynı istek ise 748 token'lık, atıfları
 * doğru bir metni sorunsuz döndürdü. Akışlı bir arayüzde kullanıcının bir
 * dakikadan uzun boş ekrana bakması ayrıca kabul edilemez.
 *
 * DEEPSEEK_THINKING=true ile açılabilir; o durumda maxTokens'ın akıl yürütmeyi
 * de karşılayacak kadar yüksek olması gerekir.
 */
function thinkingConfigFor(profile) {
  const enabled = process.env.DEEPSEEK_THINKING === 'true' && profile === 'quality';
  return enabled ? undefined : { type: 'disabled' };
}

function requireKey() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || !key.trim()) {
    throw new Error('DEEPSEEK_API_KEY tanımlı değil.');
  }
  return key.trim();
}

async function postChatCompletions(body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    const error = new Error(`DeepSeek API hatası (HTTP ${response.status}): ${detail}`);
    error.status = response.status;
    throw error;
  }

  return response;
}

/**
 * Tek seferlik tamamlama. Çeviri ve sorgu analizi gibi kısa işler için.
 *
 * @returns {Promise<string>} modelin ürettiği metin
 */
export async function completeWithDeepseek({
  system,
  user,
  profile = 'fast',
  temperature = 0.3,
  maxTokens = 2000,
}) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const thinking = thinkingConfigFor(profile);
  const response = await postChatCompletions({
    model: getDeepseekModel(profile),
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
    ...(thinking ? { thinking } : {}),
  });

  const payload = await response.json();
  logAiUsage(`deepseek/${profile}`, payload?.usage);
  const text = payload?.choices?.[0]?.message?.content;

  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('DeepSeek boş yanıt döndürdü.');
  }
  return text;
}

/**
 * Akışlı üretim. Her metin parçası için onToken çağrılır.
 *
 * @returns {Promise<string>} birikmiş tam metin
 */
export async function streamWithDeepseek({
  system,
  user,
  profile = 'quality',
  temperature = 0.4,
  // Düşünme modunda akıl yürütme de bu bütçeden harcanır, bu yüzden
  // üretilecek metnin birkaç katı veriliyor.
  maxTokens = 8000,
  onToken,
  onReasoningStart,
  shouldStop,
}) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const thinking = thinkingConfigFor(profile);
  const response = await postChatCompletions({
    model: getDeepseekModel(profile),
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
    // Akista usage varsayilan olarak hic gelmez; bu bayrak olmadan writer
    // akisinin onbellek isabet orani olculemez.
    stream_options: { include_usage: true },
    ...(thinking ? { thinking } : {}),
  });

  if (!response.body) {
    throw new Error('DeepSeek yanıt gövdesi okunamıyor.');
  }

  let full = '';
  let buffer = '';
  let reasoningAnnounced = false;
  // usage yalnizca en son SSE olayinda gelir; o olayda choices bos olur.
  let usage = null;

  for await (const chunk of response.body) {
    if (typeof shouldStop === 'function' && shouldStop()) break;

    buffer += Buffer.from(chunk).toString('utf8');

    // SSE olaylari satir satir gelir; yarim kalan son satiri tamponda birakiyoruz.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;

      try {
        const event = JSON.parse(data);
        if (event?.usage) usage = event.usage;

        const delta = event?.choices?.[0]?.delta;
        if (!delta) continue;

        // Dusunme ciktisi kullaniciya gitmez; yalnizca "dusunuyor" bilgisini
        // bir kez yukari bildiriyoruz ki arayuz sessiz beklemesin.
        if (delta.reasoning_content) {
          if (!reasoningAnnounced) {
            reasoningAnnounced = true;
            if (typeof onReasoningStart === 'function') onReasoningStart();
          }
          continue;
        }

        if (delta.content) {
          full += delta.content;
          if (typeof onToken === 'function') onToken(delta.content);
        }
      } catch {
        // Parcali JSON: bir sonraki chunk ile tamamlanacak.
      }
    }
  }

  logAiUsage(`deepseek/${profile} (stream)`, usage);

  if (!full.trim()) {
    throw new Error('DeepSeek boş yanıt döndürdü.');
  }
  return full;
}
