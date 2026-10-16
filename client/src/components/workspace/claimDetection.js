// Cümle sınıflandırma — yalnızca 1. kademe (tasarim-yonu.md §6).
//
// Yönerge üç kademe tanımlıyor: yerel kural → küçük sınıflandırıcı → LLM.
// Burada SADECE 1. kademe var: bedava, belirlenimci, model çağrısı yok.
// 2. kademe sunucuda yerel bir model gerektiriyor (bugün yok), 3. kademe
// bütçelenmemiş. Bu yüzden kalan cümleler "değerlendirilmedi" kalır ve
// arayüz bunu açıkça yazar — eksik sessizce gizlenmez (CLAUDE.md 2.8).

/** Metin içi atıf işareti: (Yılmaz, 2021), (Chen & Wang, 2021), [14] */
export const CITATION = /\([^)]*\b(1[5-9]|20)\d{2}\b[^)]*\)|\[\d+(?:\s*[,-]\s*\d+)*\]/;

// Türkçe harfler sadeleştirilir: kullanıcı "bölümde" de yazabilir "bolumde"
// de. Aynı tutarsızlık ORCID aramasında da çıkmıştı (CLAUDE.md 3.10).
const TR_FOLD = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
export const fold = (s) => String(s).replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TR_FOLD[c]).toLocaleLowerCase('en');

// Bölüm geçişi ve kendi çalışmasını anlatan kalıplar: kaynak gerektirmez.
// Kalıplar sadeleştirilmiş yazılır, girdi de sadeleştirilerek karşılaştırılır.
const TRANSITION = new RegExp([
  '^bu (bolumde|calismada|tezde|makalede|kisimda|baslik altinda)',
  '^(ilk|son) olarak',
  '^(asagida|yukarida|izleyen|takip eden)',
  '^(sekil|tablo|cizelge|denklem|ek)\\s*\\d',
  '^(bkz|ornegin|ayrica bkz)',
  '^in this (section|study|paper|chapter)',
  '^(figure|table|equation)\\s*\\d',
].join('|'));

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
  // Geçiş kontrolü uzunluktan önce: "Şekil 2 akışı göstermektedir" dört
  // kelimedir, ama kullanıcıya "kısa" değil "şekil göndermesi" demek gerekir.
  if (TRANSITION.test(fold(s))) return { mark: MARK.notClaim, reason: 'transition' };
  // Kısa cümle genelde başlık, etiket veya bağlaç; iddia taşımaz.
  if (words.length < 5) return { mark: MARK.notClaim, reason: 'short' };

  // Kalanlar: iddia olabilir de olmayabilir de. 1. kademe karar veremez.
  return { mark: MARK.uncited, reason: 'undetermined' };
}

/**
 * Kullanıcı düzeltmesinin anahtarı. Karar cümle METNİNE bağlanır, belgedeki
 * bir düğüme değil: contentEditable'da Enter blok özniteliklerini yeni
 * paragrafa kopyalar ve "iddia değil" kararı yazılmamış cümleye yapışırdı.
 * Metin değişirse anahtar değişir ve karar düşer — sınıflandırıcıya dönmek
 * güvenli taraftır (§5: en tehlikeli hata, iddiayı "iddia değil" saymak).
 */
export function sentenceKey(text) {
  return fold(String(text || '')).replace(/\s+/g, ' ').trim();
}

export const OVERRIDE = { claim: 'claim', notClaim: 'notClaim' };

/**
 * Kullanıcının kararı sınıflandırıcıyı ezer (§5). "Bu bir iddia" denen
 * cümlede atıf işareti varsa 'cited' kalır; yoksa 'uncited' olur — iddiaysa
 * kaynak bekliyordur.
 */
export function applyOverride(base, override) {
  if (override === OVERRIDE.notClaim) return { mark: MARK.notClaim, reason: 'userNotClaim' };
  if (override === OVERRIDE.claim) {
    return base.mark === MARK.cited ? base : { mark: MARK.uncited, reason: 'userClaim' };
  }
  return base;
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
