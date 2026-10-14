// Destek rozeti ve pasaj vurgusu — DOM'a dokunmaz, test edilebilir.
//
// tasarim-yonu.md §6: kanıt sınıfı renk + ŞEKİL + metinle birlikte taşınır;
// renk tek başına anlam taşımaz (kırmızı–yeşil renk körlüğü). Renkler CSS'te.

export const SUPPORT_SHAPES = {
  supports: '●',
  partial: '◐',
  irrelevant: '○',
  contradicts: '▲',
  none: '◌',
};

/** Rozetin sınıfı: doğrulama sonuç vermediyse "none" — "destekliyor" sayılmaz. */
export function supportLabel(support) {
  return support && SUPPORT_SHAPES[support.label] && support.label !== 'none' ? support.label : 'none';
}

/** Cümle belgeye "Cümleyi metne ekle" ile mi, uyarıyla mı girer. */
export function isSettled(support) {
  return supportLabel(support) === 'supports' && Boolean(support.spanVerified);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Modelin dayandığı parçanın pasajdaki yeri [başlangıç, bitiş]. Sunucu
 * parçayı zaten birebir doğruladı; burada yalnız boşluk ve büyük/küçük harf
 * farkını aşarak gösterilecek aralık bulunur. Bulunamazsa null.
 */
export function locateSpan(passage, span) {
  const words = String(span || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length || !passage) return null;
  const re = new RegExp(words.map(escapeRe).join('\\s+'), 'iu');
  const m = re.exec(passage);
  return m ? [m.index, m.index + m[0].length] : null;
}

const REFUSALS = {
  no_other_point: 'refusedNoOther',
  too_similar: 'refusedSimilar',
  identical: 'refusedSimilar',
  too_close: 'refusedTooClose',
  drifted: 'refusedDrifted',
  number_not_in_passage: 'refusedNumber',
  too_long: 'refusedCheck',
};

/** Sunucunun ret sebebini kullanıcıya gösterilecek metnin anahtarına çevirir. */
export function refusalKey(reason) {
  const r = String(reason || '');
  if (REFUSALS[r]) return `workspace.${REFUSALS[r]}`;
  if (r.startsWith('citation:')) return 'workspace.refusedCheck';
  return 'workspace.refused';
}
