/**
 * Bölüm adresleri (WO-011 Faz 1, WO-017). Saf modül.
 *
 * Araştırma bölümü adres taşımaz (ana sayfa). Yaz bölümü `#/yaz`; geri tuşu
 * araştırmaya döner. Eski adresler kırık kalmasın diye yeni yerlerine
 * çevrilir: WO-011'in `#/yazar` adresi ("yazar modu" adı tüzük 2.13'e göre
 * kalktı) ve WO-010 kabuğunun adresleri.
 */

export const WRITER_HASH = '#/yaz';

/**
 * @returns {{ mode: 'research'|'writer', panel: 'check'|null,
 *   sidebarTab: 'works'|'basket'|'favorites'|null, researchMode: 'author'|null,
 *   legacy: boolean }}
 */
export function parseModeHash(hash) {
  const path = String(hash || '').replace(/^#\/?/, '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  const base = { mode: 'research', panel: null, sidebarTab: null, researchMode: null, legacy: false };
  switch (path) {
    case 'yaz': return { ...base, mode: 'writer' };
    case 'yaz/kontrol': return { ...base, mode: 'writer', panel: 'check' };
    // WO-011'in adresleri ("yazar modu")
    case 'yazar': return { ...base, mode: 'writer', legacy: true };
    case 'yazar/kontrol': return { ...base, mode: 'writer', panel: 'check', legacy: true };
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
