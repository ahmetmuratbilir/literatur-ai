/**
 * Araştırma ↔ yazar modu adresleri (WO-011 Faz 1). Saf modül.
 *
 * Araştırma modu adres taşımaz (ana sayfa). Yazar modu `#/yazar`; geri tuşu
 * araştırmaya döner. WO-010 kabuğunun adresleri kırık kalmasın diye yeni
 * yerlerine çevrilir.
 */

export const WRITER_HASH = '#/yazar';

/**
 * @returns {{ mode: 'research'|'writer', panel: 'check'|null,
 *   sidebarTab: 'works'|'basket'|'favorites'|null, researchMode: 'author'|null,
 *   legacy: boolean }}
 */
export function parseModeHash(hash) {
  const path = String(hash || '').replace(/^#\/?/, '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  const base = { mode: 'research', panel: null, sidebarTab: null, researchMode: null, legacy: false };
  switch (path) {
    case 'yazar': return { ...base, mode: 'writer' };
    case 'yazar/kontrol': return { ...base, mode: 'writer', panel: 'check' };
    // WO-010 kabuğunun adresleri
    case 'yazim': return { ...base, mode: 'writer', legacy: true };
    case 'denetim': return { ...base, mode: 'writer', panel: 'check', legacy: true };
    case 'alanim': return { ...base, sidebarTab: 'works', legacy: true };
    case 'kaynaklar/sepet': return { ...base, sidebarTab: 'basket', legacy: true };
    case 'kaynaklar/favoriler': return { ...base, sidebarTab: 'favorites', legacy: true };
    case 'kaynaklar/arastirmaci': return { ...base, researchMode: 'author', legacy: true };
    case 'kaynaklar':
    case 'kaynaklar/ara': return { ...base, legacy: true };
    default: return base;
  }
}

/** Ayrıştırılmış adresin düzgün hali: araştırma için boş. */
export function canonicalHash(route) {
  if (route?.mode !== 'writer') return '';
  return route.panel === 'check' ? `${WRITER_HASH}/kontrol` : WRITER_HASH;
}
