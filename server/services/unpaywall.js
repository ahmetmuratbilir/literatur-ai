import { fetchWithTimeout } from '../utils/http.js';

/**
 * Unpaywall — DOI verildiginde makalenin YASAL, ucretsiz okunabilir kopyasi
 * nerede. Urun karsiligi: makale kartinda "Ucretsiz PDF" dugmesi.
 *
 * ERISIM: anahtar yok, e-posta ZORUNLU. Olculen (30 Eyl 2026): sablon adres
 * (research-contact@example.com) HTTP 422 "Please use your own email address"
 * ile reddediliyor. Bu yuzden UNPAYWALL_EMAIL (veya CONTACT_EMAIL) gercek bir
 * adresle doldurulmadikca ozellik KAPALI kalir ve arayuz dugmeyi gostermez;
 * calismayan bir dugme gostermek yaniltici olur.
 *
 * NEDEN ARAMA SIRASINDA DEGIL: tek DOI = tek istek, toplu uc yok. 25 makale
 * icin 25 istek aramayi yavaslatir. Kullanici dugmeye bastiginda sorulur.
 *
 * Limit: belgelenen gunde 100.000; guvenli calisma gunde 70.000.
 *
 * Lisans/kural: PDF kendi sunucumuzda BARINDIRILMAZ, yalnizca yonlendirilir.
 * Surum (yayinci / kabul edilmis yazar surumu) kullaniciya soylenir: atif
 * yapilabilirlik acisindan fark eder.
 */
const DAILY_SAFE_LIMIT = 70000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 5000;

const cache = new Map(); // doi -> { value, expiresAt }
let dayKey = '';
let dayCount = 0;

const PLACEHOLDER = /example\.(com|org|net)$|your[_-]|_here$/i;

export function getUnpaywallEmail(env = process.env) {
  const email = String(env.UNPAYWALL_EMAIL || env.CONTACT_EMAIL || '').trim();
  if (!email || !email.includes('@') || PLACEHOLDER.test(email)) return null;
  return email;
}

export const isUnpaywallConfigured = (env = process.env) => Boolean(getUnpaywallEmail(env));

function normalizeDoi(doi) {
  return String(doi || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:/, '');
}

const VERSION_LABELS = {
  publishedVersion: 'yayıncı sürümü',
  acceptedVersion: 'kabul edilmiş yazar sürümü (hakem sonrası)',
  submittedVersion: 'gönderilmiş sürüm (hakem öncesi)',
};

/** Ham Unpaywall yanitini sadelestirir. Saf fonksiyon. */
export function parseUnpaywall(data) {
  const best = data?.best_oa_location || null;
  return {
    isOa: Boolean(data?.is_oa),
    oaStatus: data?.oa_status || null,
    pdfUrl: best?.url_for_pdf || null,
    landingUrl: best?.url_for_landing_page || best?.url || null,
    version: best?.version || null,
    versionLabel: VERSION_LABELS[best?.version] || null,
    hostType: best?.host_type || null, // publisher | repository
    license: best?.license || null,
  };
}

function remember(doi, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(doi, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * @returns {Promise<{status: 'ok'|'not_found'|'not_configured'|'quota'|'error', result?: object, message?: string}>}
 */
export async function findOpenAccessCopy(doiInput, { fetchImpl = fetchWithTimeout, env = process.env } = {}) {
  const doi = normalizeDoi(doiInput);
  if (doi.length < 6 || !doi.startsWith('10.')) return { status: 'error', message: 'Geçerli bir DOI değil.' };

  const email = getUnpaywallEmail(env);
  if (!email) return { status: 'not_configured', message: 'UNPAYWALL_EMAIL tanımlı değil.' };

  const hit = cache.get(doi);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) { dayKey = today; dayCount = 0; }
  if (dayCount >= DAILY_SAFE_LIMIT) return { status: 'quota', message: 'Günlük güvenli istek sınırına ulaşıldı.' };
  dayCount++;

  try {
    const response = await fetchImpl(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`,
      { headers: { 'User-Agent': `LiteratureAI/1.0 (mailto:${email})` } },
      8000
    );
    if (response.status === 404) {
      const value = { status: 'not_found' };
      remember(doi, value); // olumsuz sonuc da onbellege: ayni DOI'yi tekrar sorma
      return value;
    }
    if (!response.ok) {
      return { status: 'error', message: `Unpaywall HTTP ${response.status}` };
    }
    const value = { status: 'ok', result: parseUnpaywall(await response.json()) };
    remember(doi, value);
    return value;
  } catch (error) {
    return { status: 'error', message: error?.name === 'AbortError' ? 'zaman aşımı' : String(error?.message || error) };
  }
}

/** Testler icin. */
export function resetUnpaywallState() {
  cache.clear();
  dayKey = '';
  dayCount = 0;
}
