import crypto from 'node:crypto';

/**
 * Kullanıcının API anahtarını şifreler (WO-023). AES-256-GCM, Node `crypto`
 * (yeni bağımlılık yok). Ana anahtar `KEY_ENCRYPTION_KEY` ortam değişkeni;
 * herhangi bir uzunlukta gizli dizgeden SHA-256 ile 32 bayt türetilir.
 * Her kayıtta rastgele 12 baytlık IV; doğrulama etiketi saklanır, bozuk ya da
 * başka ana anahtarla yazılmış kayıt çözülmez (hata fırlatır).
 *
 * Bu modül anahtarı hiçbir yere yazmaz ve loglamaz.
 */

function masterKey(secret = process.env.KEY_ENCRYPTION_KEY) {
  if (typeof secret !== 'string' || secret.trim().length < 16) return null;
  return crypto.createHash('sha256').update(secret.trim(), 'utf8').digest();
}

/** Şifreleme bu sunucuda kullanılabilir mi (ana anahtar tanımlı ve yeterince uzun). */
export function vaultReady(secret) {
  return masterKey(secret) !== null;
}

/** @returns {{ cipher: string, iv: string, tag: string }} base64 alanlar */
export function sealKey(plain, secret) {
  const key = masterKey(secret);
  if (!key) throw new Error('KEY_ENCRYPTION_KEY tanımlı değil');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const cipher = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return { cipher: cipher.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') };
}

/** Şifreli kaydı çözer; etiket tutmazsa hata fırlatır. */
export function openKey({ cipher, iv, tag }, secret) {
  const key = masterKey(secret);
  if (!key) throw new Error('KEY_ENCRYPTION_KEY tanımlı değil');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(cipher, 'base64')), d.final()]).toString('utf8');
}

/** Arayüzde gösterilecek tek parça: son 4 karakter. */
export function lastFour(plain) {
  const s = String(plain || '');
  return s.length >= 8 ? s.slice(-4) : '';
}
