import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { fold } from './validate.js';

/**
 * Çözümleme önbelleği: bellekte LRU + MongoDB (TTL indeksli).
 * Aynı girdi ikinci kez gelirse hiçbir dış API çağrılmaz.
 *
 * Süreler: bulunan kayıt 7 gün (açık erişim bağlantısı ve geri çekilme
 * durumu sonuçla birlikte saklandığı için görev tanımındaki 30 gün değil,
 * bu ikisinin 7 günü uygulanıyor), not_found 24 saat.
 * SQLite yerine Mongo: Render'da disk her yayında siliniyor.
 */
export const TTL_MS = {
  found: 7 * 24 * 3600 * 1000,
  candidates: 7 * 24 * 3600 * 1000,
  not_found: 24 * 3600 * 1000,
};

const MEMORY_MAX = 1000;

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, maxlength: 200 },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
}, { minimize: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ResolverCache = mongoose.models.ResolverCache || mongoose.model('ResolverCache', schema);

/** Girdi anahtarı: kimlik varsa kimlik, yoksa katlanmış metnin özeti. */
export function cacheKey(identified) {
  if (identified.doi) return `v1:doi:${identified.doi}`;
  if (identified.arxiv) return `v1:arxiv:${identified.arxiv}`;
  if (identified.pmid) return `v1:pmid:${identified.pmid}`;
  if (identified.pmcid) return `v1:pmcid:${identified.pmcid}`;
  if (identified.pii) return `v1:pii:${identified.pii}`;
  const basis = identified.url ? identified.url.toLowerCase() : fold(identified.text);
  return `v1:${identified.url ? 'url' : 'text'}:${crypto.createHash('sha256').update(basis).digest('hex')}`;
}

export function createCache({ model = ResolverCache, now = () => Date.now(), dbReady = () => mongoose.connection.readyState === 1 } = {}) {
  const memory = new Map();

  const remember = (key, value, expiresAt) => {
    memory.delete(key);
    if (memory.size >= MEMORY_MAX) memory.delete(memory.keys().next().value);
    memory.set(key, { value, expiresAt });
  };

  return {
    async get(key) {
      const m = memory.get(key);
      if (m && m.expiresAt > now()) return m.value;
      if (m) memory.delete(key);
      if (!dbReady()) return null;
      try {
        const doc = await model.findOne({ key, expiresAt: { $gt: new Date(now()) } }).lean();
        if (!doc) return null;
        remember(key, doc.value, new Date(doc.expiresAt).getTime());
        return doc.value;
      } catch {
        return null;
      }
    },
    async set(key, value, status) {
      const ttl = TTL_MS[status] || TTL_MS.not_found;
      const expiresAt = now() + ttl;
      remember(key, value, expiresAt);
      if (!dbReady()) return;
      try {
        await model.updateOne({ key }, { $set: { value, expiresAt: new Date(expiresAt) } }, { upsert: true });
      } catch (error) {
        console.warn('[Resolver] Önbelleğe yazılamadı:', error?.message || error);
      }
    },
    size: () => memory.size,
  };
}
