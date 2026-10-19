import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * İstek bazında yapay zekâ bağlamı (WO-023). Giriş yapmış kullanıcının etkin
 * "kendi anahtarı" bağlantısı istek boyunca buradan okunur; model çağıran
 * kod anahtarı parametre olarak taşımaz (`config/aiModels.js` buradan alır).
 *
 * Kural: kullanıcının bağlantısı varsa o istekte YALNIZ onun sağlayıcısı
 * kullanılır; hata verirse bizim anahtarımıza sessizce geçilmez (tüzük 2.8,
 * maliyet). Hata yanıta `X-AI-Key-Status` başlığıyla yansır; arayüz
 * "kendi anahtarın çalışmadı" der.
 *
 * Bağlamdaki anahtar düz metindir ama yalnız bellekte ve yalnız bu istek
 * boyunca durur; hiçbir yere yazılmaz, loglanmaz.
 */

const store = new AsyncLocalStorage();

/** @param {{ connection: {provider:string, key:string}|null, res?: any, onFailure?: Function }} ctx */
export function runWithAiContext(ctx, fn) {
  return store.run(ctx, fn);
}

/** Etkin kullanıcı bağlantısı ya da null (varsayılan: Literatür AI anahtarları). */
export function currentAiConnection() {
  return store.getStore()?.connection || null;
}

/** Çağrının anahtar kaynağı: 'user' | 'platform'. Kullanım loguna girer (tüzük 3.9). */
export function currentKeySource() {
  return currentAiConnection() ? 'user' : 'platform';
}

/**
 * Sağlayıcı yanıtını not eder. Kullanıcı anahtarıyla 401/403 (geçersiz) ya da
 * 429 (kota) geldiyse yanıta başlık koyar ve bağlantının son durumunu
 * güncellemek için `onFailure`'ı çağırır.
 */
export function noteProviderResponse(provider, status) {
  const ctx = store.getStore();
  if (!ctx?.connection || provider?.keySource !== 'user') return;
  // 402: bakiye/kredi bitti (DeepSeek, OpenRouter, Anthropic billing_error) → kota;
  // 404: model bu hesaba açık değil → model.
  const kind = status === 401 || status === 403 ? 'invalid'
    : status === 429 || status === 402 ? 'quota'
      : status === 404 ? 'model' : null;
  if (!kind) return;
  ctx.failure = { provider: provider.name, kind };
  if (ctx.res && !ctx.res.headersSent) ctx.res.setHeader('X-AI-Key-Status', kind);
  try { ctx.onFailure?.(provider.name, kind); } catch { /* durum kaydı yanıtı bozmaz */ }
}
