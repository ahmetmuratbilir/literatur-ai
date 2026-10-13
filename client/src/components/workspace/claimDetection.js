// Cümle sınıflandırma — yalnızca 1. kademe (tasarim-yonu.md §6).
//
// Yönerge üç kademe tanımlıyor: yerel kural → küçük sınıflandırıcı → LLM.
// Burada SADECE 1. kademe var: bedava, belirlenimci, model çağrısı yok.
// 2. kademe sunucuda yerel bir model gerektiriyor (bugün yok), 3. kademe
// bütçelenmemiş. Bu yüzden kalan cümleler "değerlendirilmedi" kalır ve
// arayüz bunu açıkça yazar — eksik sessizce gizlenmez (CLAUDE.md 2.8).

/** Metin içi atıf işareti: (Yılmaz, 2021), (Chen & Wang, 2021), [14] */
const CITATION = /\([^)]*\b(1[5-9]|20)\d{2}\b[^)]*\)|\[\d+(?:\s*[,-]\s*\d+)*\]/;

// Bölüm geçişi ve kendi çalışmasını anlatan kalıplar: kaynak gerektirmez.
const TRANSITION = new RegExp([
  '^bu (bölümde|çalışmada|tezde|makalede|kısımda|başlık altında)',
  '^(ilk|son) olarak',
  '^(aşağıda|yukarıda|izleyen|takip eden)',
  '^(şekil|tablo|çizelge|denklem|ek)\\s*\\d',
  '^(bkz|örneğin|ayrıca bkz)',
  '^in this (section|study|paper|chapter)',
  '^(figure|table|equation)\\s*\\d',
].join('|'), 'i');

export const MARK = {
  cited: 'cited',
  uncited: 'uncited',
  notClaim: 'notClaim',
};

/** Tek bir cümleyi 1. kademe kurallarıyla sınıflandırır. */
export function classifySentence(text) {
  const s = String(text || '').trim();
  const words = s.split(/\s+/).filter(Boolean);

  if (s.length < 2) return { mark: MARK.notClaim, reason: 'empty' };
  if (CITATION.test(s)) return { mark: MARK.cited, reason: 'citation' };
  if (s.endsWith('?')) return { mark: MARK.notClaim, reason: 'question' };
  // Kısa cümle genelde başlık, etiket veya bağlaç; iddia taşımaz.
  if (words.length < 5) return { mark: MARK.notClaim, reason: 'short' };
  if (TRANSITION.test(s)) return { mark: MARK.notClaim, reason: 'transition' };

  // Kalanlar: iddia olabilir de olmayabilir de. 1. kademe karar veremez.
  return { mark: MARK.uncited, reason: 'undetermined' };
}

/** Bir blok metnini cümlelere böler; ayırıcıyı cümleyle birlikte tutar. */
export function splitSentences(text) {
  const out = [];
  const re = /[^.!?…]+(?:[.!?…]+["')\]]*|$)/gu;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    const raw = m[0];
    if (raw.trim()) out.push({ text: raw, start: m.index, end: m.index + raw.length });
  }
  return out;
}

/**
 * Bölüm özeti (§6). Yüzde üretmez — "%69 kanıtlı" tek sayıya inince
 * kullanıcı o sayıyı yükseltmeye çalışır (§14, §20 yanlış metrik uyarısı).
 */
export function summarize(sentences) {
  const counts = { total: sentences.length, cited: 0, uncited: 0, notClaim: 0 };
  for (const s of sentences) counts[s.mark] += 1;
  return counts;
}
