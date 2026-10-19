import mongoose from 'mongoose';

/**
 * Kullanıcının kendi yapay zekâ anahtarı (WO-023). Anahtar düz metin
 * saklanmaz: `cipher` + `iv` + `tag` (AES-256-GCM, services/keyVault.js).
 * Arayüze yalnız `provider`, `last4`, `active`, `lastStatus`, `lastCheckedAt`
 * gider. Kullanıcı başına sağlayıcı başına bir kayıt; en fazla biri etkin.
 */
// WO-027: openai, moonshot (Kimi), anthropic (Claude) eklendi; 'model' durumu (404)
// eklendi. Yalnız ekleme: var olan kayıtlar geçerli kalır, veri göçü yok.
export const AI_PROVIDERS = ['deepseek', 'gemini', 'groq', 'openai', 'moonshot', 'anthropic'];
export const AI_STATUSES = ['ok', 'invalid', 'quota', 'model', 'error', 'unknown'];

const AiConnectionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true, maxlength: 64 },
  provider: { type: String, required: true, enum: AI_PROVIDERS },
  cipher: { type: String, required: true, maxlength: 2048 },
  iv: { type: String, required: true, maxlength: 64 },
  tag: { type: String, required: true, maxlength: 64 },
  last4: { type: String, default: '', maxlength: 4 },
  active: { type: Boolean, default: false },
  lastStatus: { type: String, enum: AI_STATUSES, default: 'unknown' },
  lastCheckedAt: { type: Date, default: null },
}, { timestamps: true });

AiConnectionSchema.index({ userId: 1, provider: 1 }, { unique: true });

export default mongoose.model('AiConnection', AiConnectionSchema);
