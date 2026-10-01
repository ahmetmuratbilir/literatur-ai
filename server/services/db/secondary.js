import mongoose from 'mongoose';

/**
 * İkinci MongoDB (Atlas ücretsiz katman, 512 MB): gece yedeği + DergiPark
 * Türkçe dizini. Tanımlı değilse uygulama hiçbir şey olmamış gibi çalışır.
 *
 * Ana bağlantı (mongoose varsayılanı) ile karışmasın diye ayrı bir
 * `createConnection`; modeller bu bağlantıya açıkça bağlanmalı.
 */
export const SECONDARY_URI_KEYS = ['MONGODB_URI_2', 'MONGODB_BACKUP_URI'];
const RETRY_MS = 60 * 1000;

export function getSecondaryUri(env = process.env) {
  for (const key of SECONDARY_URI_KEYS) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return null;
}

/** Küme + veritabanı kimliği (kullanıcı/şifre olmadan); aynı yere yedek almayı yakalar. */
export function targetOf(uri) {
  try {
    const u = new URL(uri);
    return `${u.hostname.toLowerCase()}/${(u.pathname || '/').slice(1) || 'test'}`;
  } catch {
    return null;
  }
}

/** Hata mesajlarında bağlantı dizesi (şifre) görünmesin. */
export const maskUri = (text) => String(text || '').replace(/mongodb(\+srv)?:\/\/\S+/g, 'mongodb://<gizli>');

let connection = null;
let lastAttempt = 0;
let lastError = null;

/**
 * İkinci bağlantıyı döndürür (gerekirse açar). Tanımlı değilse ya da ana
 * veritabanıyla aynı yeri gösteriyorsa null.
 */
export function getSecondary(env = process.env) {
  const uri = getSecondaryUri(env);
  if (!uri) return null;
  const primary = env.MONGODB_URI?.trim();
  if (primary && targetOf(primary) && targetOf(primary) === targetOf(uri)) {
    lastError = 'İkinci veritabanı ana veritabanıyla aynı yeri gösteriyor; yedek alınmadı.';
    return null;
  }
  if (connection && connection.readyState !== 0) return connection;
  if (Date.now() - lastAttempt < RETRY_MS && connection) return connection;

  lastAttempt = Date.now();
  if (connection) connection.close().catch(() => {});
  connection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 3 });
  connection.on('connected', () => { lastError = null; console.log('[DB2] İkinci MongoDB bağlandı'); });
  connection.on('error', (err) => { lastError = maskUri(err?.message || err); console.error('[DB2] Bağlantı hatası:', lastError); });
  connection.asPromise().catch(() => { /* 'error' olayı kaydetti */ });
  return connection;
}

export const isSecondaryReady = () => connection?.readyState === 1;

export function secondaryStatus(env = process.env) {
  return {
    configured: Boolean(getSecondaryUri(env)),
    connected: isSecondaryReady(),
    readyState: connection?.readyState ?? null,
    error: lastError,
  };
}

/** Testler için. */
export function resetSecondary() {
  connection = null;
  lastAttempt = 0;
  lastError = null;
}
