import { currentAiConnection } from '../services/aiContext.js';

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

const ENV_KEYS = {
  deepseek: 'DEEPSEEK_API_KEY', gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY',
  // Yalnız kullanıcının kendi anahtarıyla (WO-027); platform sırasında yoklar.
  openai: 'OPENAI_API_KEY', moonshot: 'MOONSHOT_API_KEY', anthropic: 'ANTHROPIC_API_KEY',
};

/**
 * Kullanıcı anahtarıyla açılan ek sağlayıcılar (WO-027). Hepsi OpenAI uyumlu
 * sohbet ucundan çağrılır; desteklemedikleri parametreler `drop` ile atılır.
 * Model kimlikleri ortam değişkeniyle değişir (sağlayıcı ad değiştirirse 404 →
 * arayüz "model" der). Kaynak: sağlayıcı belgeleri, 2026-10-19 okundu.
 *  - anthropic: OpenAI uyumlu uç; sıcaklık < 1 reddediliyor, response_format yok
 *    sayılıyor (JSON istemde zaten isteniyor). Anthropic bu ucu "üretime hazır
 *    değil" diye niteliyor; arayüzde "deneme" etiketi.
 *  - moonshot (Kimi): sıcaklık sabit; düşünme kapatılır.
 *  - openai: akıl yürüten modellerde sıcaklık desteği belgede doğrulanmadı; atılır.
 */
const EXTRA = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: () => readEnv('OPENAI_MODEL', 'gpt-6-luna'), body: {}, drop: ['temperature'] },
  moonshot: { url: 'https://api.moonshot.ai/v1/chat/completions', model: () => readEnv('MOONSHOT_MODEL', 'kimi-k2.6'), body: { thinking: { type: 'disabled' } }, drop: ['temperature'] },
  anthropic: { url: 'https://api.anthropic.com/v1/chat/completions', model: (profile) => (profile === 'quality' ? readEnv('ANTHROPIC_MODEL_QUALITY', 'claude-sonnet-5-5') : readEnv('ANTHROPIC_MODEL', 'claude-haiku-5-5')), body: {}, drop: ['temperature', 'response_format'] },
};

/**
 * Sohbet isteği gövdesi: çağrının alanları + sağlayıcıya özgü alanlar, sağlayıcının
 * desteklemediği alanlar çıkarılmış. Bütün yapay zekâ çağrıları buradan geçer.
 */
export function chatBody(provider, base) {
  const body = { ...base, ...(provider?.body || {}) };
  for (const key of provider?.drop || []) delete body[key];
  return body;
}

/**
 * Sağlayıcının anahtarı (WO-023). Kullanıcının etkin bağlantısı varsa yalnız
 * onun sağlayıcısının anahtarı döner, diğerleri için null: kullanıcının
 * anahtarı hata verirse bizim anahtarımıza sessizce geçilmez.
 */
export function keyFor(provider, env = process.env) {
  const conn = env === process.env ? currentAiConnection() : null;
  // Okunamayan kullanıcı anahtarı: hiçbir anahtar yok (platforma düşülmez).
  if (conn) return conn.provider === provider && !conn.unreadable ? conn.key : null;
  return env[ENV_KEYS[provider]] || null;
}

/** Anahtarın kaynağı: kullanıcının kendi anahtarı mı, Literatür AI'nınki mi. */
function keySourceOf(provider) {
  const conn = currentAiConnection();
  return conn && conn.provider === provider ? 'user' : 'platform';
}

/** Sağlayıcının anahtarı tanımlı mı. */
export function isProviderConfigured(provider, env = process.env) {
  const conn = env === process.env ? currentAiConnection() : null;
  if (conn) return conn.provider === provider && !conn.unreadable;
  if (provider === 'deepseek') return Boolean(env.DEEPSEEK_API_KEY);
  if (provider === 'gemini') return Boolean(env.GEMINI_API_KEY);
  if (provider === 'groq') return Boolean(env.GROQ_API_KEY);
  return Boolean(ENV_KEYS[provider] && env[ENV_KEYS[provider]]);
}

/**
 * Sırayla denenecek, anahtarı gerçekten tanımlı olan sağlayıcılar.
 */
export function getActiveProviders(env = process.env) {
  const conn = env === process.env ? currentAiConnection() : null;
  if (conn) return conn.unreadable ? [] : [conn.provider];
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
        key: keyFor('groq'),
        keySource: keySourceOf('groq'),
        model: getGroqModel(),
        body: {},
      };
    }
    if (provider === 'deepseek') {
      return {
        name: 'deepseek',
        url: `${DEEPSEEK_BASE_URL}/chat/completions`,
        key: keyFor('deepseek'),
        keySource: keySourceOf('deepseek'),
        model: getDeepseekModel(profile),
        body: { thinking: { type: 'disabled' } },
      };
    }
    // Gemini ve ek sağlayıcılar platform sırasında yok; kullanıcı kendi
    // anahtarını bağladıysa OpenAI uyumlu ucuyla kullanılır (WO-023, WO-027).
    if (currentAiConnection()) {
      const config = chatProviderConfig(provider, { profile });
      if (config) return config;
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
    return { name, url: 'https://api.groq.com/openai/v1/chat/completions', key: keyFor('groq'), keySource: keySourceOf('groq'), model: getGroqModel(), body: { reasoning_effort: 'low' } };
  }
  if (name === 'deepseek') {
    return { name, url: `${DEEPSEEK_BASE_URL}/chat/completions`, key: keyFor('deepseek'), keySource: keySourceOf('deepseek'), model: getDeepseekModel(profile), body: { thinking: { type: 'disabled' } } };
  }
  if (name === 'gemini') {
    return { name, url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: keyFor('gemini'), keySource: keySourceOf('gemini'), model: getGeminiModel(), body: { reasoning_effort: 'none' } };
  }
  const extra = EXTRA[name];
  if (extra) {
    return { name, url: extra.url, key: keyFor(name), keySource: keySourceOf(name), model: extra.model(profile), body: extra.body, drop: extra.drop };
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
