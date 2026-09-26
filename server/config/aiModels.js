/**
 * Yapay zekâ model adları.
 *
 * Model adları koda gömülüydü ve sağlayıcı modeli kaldırınca sistem sessizce
 * bozuldu: Groq, geçerli bir anahtarla 404 "model does not exist" döndürdü,
 * çeviri ve yedek üretim çalışmayı bıraktı, kullanıcıya hiçbir şey görünmedi.
 * Sağlayıcılar model kataloglarını haber vermeden değiştirdiği için bu bir
 * yapılandırma değeri olmalı.
 */

// Groq katalogdan Llama'yi kaldirdi; gpt-oss-120b ucretsiz katmandaki
// en yetenekli genel amacli model.
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function getGroqModel() {
  const configured = process.env.GROQ_MODEL;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : DEFAULT_GROQ_MODEL;
}

export function getGeminiModel() {
  const configured = process.env.GEMINI_MODEL;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : DEFAULT_GEMINI_MODEL;
}

export { DEFAULT_GROQ_MODEL, DEFAULT_GEMINI_MODEL };
