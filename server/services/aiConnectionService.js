import { fetch } from 'undici';
import { AI_PROVIDERS } from '../models/AiConnection.js';
import { lastFour, openKey, sealKey } from './keyVault.js';

/**
 * Kullanıcının kendi yapay zekâ anahtarı (WO-023): depo, etkin bağlantı
 * önbelleği, anahtar denemesi.
 *
 * Depo arayüzü iki uygulamalı: MongoDB (`mongoStore`) ve yalnız geliştirmede,
 * veritabanı bağlı değilken bellek (`memoryStore`; sunucu yeniden başlayınca
 * kayıtlar gider, arayüz bunu söyler). Canlıda veritabanı yoksa özellik
 * kullanılamaz (uç 503 döner).
 */

export { AI_PROVIDERS };

/** MongoDB deposu (mongoose modeli üzerinden). */
export function mongoStore(Model) {
  return {
    kind: 'db',
    list: (userId) => Model.find({ userId }).lean(),
    get: (userId, provider) => Model.findOne({ userId, provider }).lean(),
    active: (userId) => Model.findOne({ userId, active: true }).lean(),
    upsert: (userId, provider, fields) => Model.updateOne({ userId, provider }, { $set: { ...fields, userId, provider } }, { upsert: true }),
    setActive: async (userId, provider) => {
      await Model.updateMany({ userId, active: true }, { $set: { active: false } });
      if (provider) await Model.updateOne({ userId, provider }, { $set: { active: true } });
    },
    remove: (userId, provider) => Model.deleteOne({ userId, provider }),
  };
}

/** Bellek deposu: yalnız geliştirme ve testler. */
export function memoryStore() {
  const rows = new Map(); // `${userId}:${provider}` → kayıt
  const id = (u, p) => `${u}:${p}`;
  const all = (userId) => [...rows.values()].filter((r) => r.userId === userId);
  return {
    kind: 'memory',
    list: async (userId) => all(userId).map((r) => ({ ...r })),
    get: async (userId, provider) => (rows.has(id(userId, provider)) ? { ...rows.get(id(userId, provider)) } : null),
    active: async (userId) => all(userId).find((r) => r.active) || null,
    upsert: async (userId, provider, fields) => {
      const prev = rows.get(id(userId, provider)) || { active: false, lastStatus: 'unknown', lastCheckedAt: null };
      rows.set(id(userId, provider), { ...prev, ...fields, userId, provider });
    },
    setActive: async (userId, provider) => {
      for (const r of all(userId)) r.active = r.provider === provider;
    },
    remove: async (userId, provider) => { rows.delete(id(userId, provider)); },
  };
}

// --- Etkin bağlantı önbelleği: her istekte veritabanına gitmemek için ---
const TTL_MS = 60_000;
const cache = new Map();

export function invalidateConnection(userId) {
  cache.delete(userId);
}

/** Kullanıcının etkin bağlantısı ({ provider, key }) ya da null. Çözülemeyen kayıt null. */
export async function activeConnection(store, userId, { now = Date.now(), secret } = {}) {
  const hit = cache.get(userId);
  if (hit && now - hit.at < TTL_MS) return hit.conn;
  const row = await store.active(userId);
  let conn = null;
  if (row) {
    // Çözülemeyen anahtar (ör. KEY_ENCRYPTION_KEY değişti) sessizce platform
    // anahtarına düşmez: bağlam "okunamadı" olarak işaretlenir, istek durur,
    // kullanıcıya söylenir (WO-027, tüzük 2.8).
    try { conn = { provider: row.provider, key: openKey(row, secret) }; } catch { conn = { provider: row.provider, key: null, unreadable: true }; }
  }
  cache.set(userId, { at: now, conn });
  return conn;
}

/** Arayüze giden tek görünüm: anahtar ya da şifreli alan YOK. */
export function publicView(row) {
  return {
    provider: row.provider,
    last4: row.last4 || '',
    active: Boolean(row.active),
    lastStatus: row.lastStatus || 'unknown',
    lastCheckedAt: row.lastCheckedAt || null,
  };
}

/** Girdi denetimi; sorun yoksa null. */
export function validateKeyInput(provider, key) {
  if (!AI_PROVIDERS.includes(provider)) return 'Bilinmeyen sağlayıcı.';
  if (typeof key !== 'string') return 'Anahtar gerekli.';
  const k = key.trim();
  if (k.length < 10 || k.length > 300) return 'Anahtar 10–300 karakter olmalı.';
  if (/\s/.test(k)) return 'Anahtarda boşluk olamaz.';
  return null;
}

const TEST_URLS = {
  deepseek: 'https://api.deepseek.com/models',
  groq: 'https://api.groq.com/openai/v1/models',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
};

/**
 * Anahtarı en küçük çağrıyla dener: model listesi (token harcamaz).
 * @returns {'ok'|'invalid'|'quota'|'error'}
 */
export async function testKey(provider, key, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(TEST_URLS[provider], { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
    if (res.ok) return 'ok';
    if (res.status === 401 || res.status === 403) return 'invalid';
    if (res.status === 429) return 'quota';
    return 'error';
  } catch {
    return 'error';
  }
}

/** Anahtarı şifreleyip kaydeder; deneme sonucu iyiyse etkin yapar. */
export async function saveConnection(store, userId, provider, key, { status, now = new Date(), secret } = {}) {
  const k = key.trim();
  const sealed = sealKey(k, secret);
  await store.upsert(userId, provider, { ...sealed, last4: lastFour(k), lastStatus: status, lastCheckedAt: now });
  if (status === 'ok') await store.setActive(userId, provider);
  invalidateConnection(userId);
}
