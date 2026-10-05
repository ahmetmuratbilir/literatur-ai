/**
 * Yapay zekâ sağlayıcıları ve model adları.
 *
 * Model adları koda gömülüydü ve sağlayıcı modeli kaldırınca sistem sessizce
 * bozuldu: Groq, geçerli bir anahtarla 404 "model does not exist" döndürdü,
 * çeviri ve yedek üretim çalışmayı bıraktı, kullanıcıya hiçbir şey görünmedi.
 * Sağlayıcılar model kataloglarını haber vermeden değiştirdiği için bunlar
 * yapılandırma değeri.
 */

// Groq katalogdan Llama'yi kaldirdi; gpt-oss-120b ucretsiz katmandaki
// en yetenekli genel amacli model.
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
// gemini-2.5-flash 5 Eki 2026'da yeni anahtarlara kapandı (HTTP 404 "no longer
// available to new users"). 3.8-flash ölçülen en hızlı açık model (~3 sn).
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

// DeepSeek 24 Temmuz 2026'da deepseek-chat ve deepseek-reasoner adlarini
// emekliye ayirdi. Guncel adlar bunlar.
const DEFAULT_DEEPSEEK_FAST = 'deepseek-flash';
// Her iki profil de flash. Pro ~4 kat pahali ($1.32/$3.96 vs $0.30/$1.20 per 1M)
// ve olculen kalite farki bu is icin bunu hakli cikarmadi.
// Pro'ya donmek icin: DEEPSEEK_MODEL_QUALITY=deepseek-v4-pro
//
// Varsayilan da degistirildi cunku yalnizca .env'e yazmak, degiskenin
// ayarlanmadigi bir ortamda (ornegin Render) sessizce pahali modele
// dusmek demekti — bu oturumda defalarca gordugumuz yapilandirma sapmasi.
const DEFAULT_DEEPSEEK_QUALITY = 'deepseek-flash';

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

const KNOWN_PROVIDERS = ['deepseek', 'gemini', 'groq'];

function readEnv(name, fallback) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function getGroqModel() {
  return readEnv('GROQ_MODEL', DEFAULT_GROQ_MODEL);
}

export function getGeminiModel() {
  return readEnv('GEMINI_MODEL', DEFAULT_GEMINI_MODEL);
}

/**
 * DeepSeek'te iki iş profili var:
 *  - fast    : çeviri ve sorgu analizi. Hacim yüksek, iş basit, gecikme
 *              kullanıcıya doğrudan yansıyor.
 *  - quality : akademik metin üretimi. Hacim düşük, kaynağa sadakat kritik.
 */
export function getDeepseekModel(profile = 'fast') {
  return profile === 'quality'
    ? readEnv('DEEPSEEK_MODEL_QUALITY', DEFAULT_DEEPSEEK_QUALITY)
    : readEnv('DEEPSEEK_MODEL_FAST', DEFAULT_DEEPSEEK_FAST);
}

/**
 * Sağlayıcı sırası. İlki birincil, kalanlar sırayla yedek.
 *
 * Bir sağlayıcıyı kapatmak için listeden çıkarmak yeterli — kodu silmeye
 * gerek yok, geri almak da tek kelime.
 */
export function getProviderOrder() {
  const raw = process.env.AI_PROVIDERS;
  if (typeof raw !== 'string' || !raw.trim()) return [...KNOWN_PROVIDERS];

  const requested = raw
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => KNOWN_PROVIDERS.includes(name));

  // Tamamen gecersiz bir liste yazilmissa sistemi susturmak yerine
  // varsayilana donuyoruz.
  return requested.length > 0 ? requested : [...KNOWN_PROVIDERS];
}

/** Sağlayıcının anahtarı tanımlı mı. */
export function isProviderConfigured(provider, env = process.env) {
  if (provider === 'deepseek') return Boolean(env.DEEPSEEK_API_KEY);
  if (provider === 'gemini') return Boolean(env.GEMINI_API_KEY);
  if (provider === 'groq') return Boolean(env.GROQ_API_KEY);
  return false;
}

/**
 * Sırayla denenecek, anahtarı gerçekten tanımlı olan sağlayıcılar.
 */
export function getActiveProviders(env = process.env) {
  return getProviderOrder().filter((provider) => isProviderConfigured(provider, env));
}

/**
 * OpenAI sohbet formatını konuşan ilk aktif sağlayıcı.
 *
 * DeepSeek ve Groq aynı istek gövdesini kabul ediyor, bu yüzden çağıran
 * tarafın hangi sağlayıcıda olduğunu bilmesi gerekmiyor. Gemini farklı bir
 * format kullandığı için bu çözümleyicide yer almaz; onu kullanan tek yer
 * writer akışı ve orada ayrıca ele alınıyor.
 *
 * @returns {{name, url, key, model} | null}
 */
export function resolveChatProvider({ profile = 'fast', preferProvider = null } = {}) {
  const active = getActiveProviders();
  const orderedProviders = preferProvider && active.includes(preferProvider)
    ? [preferProvider, ...active.filter(p => p !== preferProvider)]
    : active;

  for (const provider of orderedProviders) {
    if (provider === 'groq') {
      return {
        name: 'groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model: getGroqModel(),
        body: {},
      };
    }
    if (provider === 'deepseek') {
      return {
        name: 'deepseek',
        url: `${DEEPSEEK_BASE_URL}/chat/completions`,
        key: process.env.DEEPSEEK_API_KEY,
        model: getDeepseekModel(profile),
        body: { thinking: { type: 'disabled' } },
      };
    }
  }
  return null;
}

/**
 * Tek bir sağlayıcının OpenAI sohbet formatındaki yapılandırması.
 * Gemini'nin de OpenAI uyumlu bir ucu var; kısa JSON çağrıları için yeterli.
 */
export function chatProviderConfig(name, { profile = 'fast' } = {}) {
  if (!isProviderConfigured(name)) return null;
  if (name === 'groq') {
    // gpt-oss akıl yürüten bir model; varsayılan düzeyde kısa bir JSON için
    // ~2000 token düşünüp 13 sn sürüyordu.
    return { name, url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: getGroqModel(), body: { reasoning_effort: 'low' } };
  }
  if (name === 'deepseek') {
    return { name, url: `${DEEPSEEK_BASE_URL}/chat/completions`, key: process.env.DEEPSEEK_API_KEY, model: getDeepseekModel(profile), body: { thinking: { type: 'disabled' } } };
  }
  if (name === 'gemini') {
    return { name, url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: process.env.GEMINI_API_KEY, model: getGeminiModel(), body: { reasoning_effort: 'none' } };
  }
  return null;
}

/**
 * Sırayla denenecek sağlayıcılar (anahtarı olanlar). Biri kotaya takılır,
 * zaman aşımına uğrar ya da geçersiz yanıt verirse çağıran sıradakine geçer.
 */
export function chatProvidersInOrder(order, options = {}) {
  return order.map((name) => chatProviderConfig(name, options)).filter(Boolean);
}

export {
  DEFAULT_GROQ_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_DEEPSEEK_FAST,
  DEFAULT_DEEPSEEK_QUALITY,
  KNOWN_PROVIDERS,
};
