// Sinyal sözlüğü (WO-016, 1. kademe): paragrafın hangi yapıyı taşıdığına
// dair ipuçları. Bedava ve belirlenimci; tek başına şablon seçmez, grafın
// şekliyle birlikte kullanılır (fit.js). Türkçe kalıplar `fold` sonrası
// (ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c, küçük harf) karşılaştırılır.
// İki dilde aynı kategoriler (kullanıcı kararı 17.10.2026).

import { CITATION, fold } from '../components/workspace/claimDetection.js';

export const CATEGORIES = ['order', 'cycle', 'cause', 'direction', 'contrast', 'classify', 'time', 'number', 'citation'];

const YEAR = /\b(1[5-9]|20)\d{2}\b/g;
// "%" harf değildir: ardından \b aranırsa "42%," eşleşmez. Bu yüzden % ayrı dalda.
const NUMBER = /%\s?\d|\b\d+(?:[.,]\d+)?\s?(?:%|(?:kg|g|m|cm|mm|km|s|sn|dk|saat|°c|k|mw|kw|w|pa|kpa|mpa|bar)\b)/g;
const LIST_MARKER = /^\s*(?:\d+[.)]|[-•*])\s+/;

const TR = {
  order: [/^(?:ilk olarak|ilk once|once|ardindan|daha sonra|sonra|son olarak|nihayet)\b/, /\b(?:asama|adim)/],
  cycle: [/\b(?:yeniden|tekrar|geri don|dongu|cevrim)/],
  cause: [/\b(?:bagli|bagimli|etkile|neden ol|yol ac|dolayi|etken|sonucunda|kaynaklan)/],
  // "artis" "artist"i, "yuksel" ise "yuksek"i yakalamasın: artis(?!t); yuksel ≠ yuksek.
  direction: [/\b(?:artir|artar|artis(?!t)|artan|azal|yuksel|dusur|duser|dusen|dustu|zayiflat|guclendir)/],
  contrast: [/\b(?:ancak|buna karsin|buna karsilik|oysa|bununla birlikte|aksine|halbuki)\b/],
  classify: [/\b(?:turleri|cesitleri|alt boyut|siniflandir|kategori)/, /\b(?:iki|uc|dort|bes)\w*\s+(?:\w+\s+)?(?:ayril|grupta|kategoride|boyutta)/],
  time: [/\b(?:yuzyil|donem)/],
};

const EN = {
  order: [/^(?:first(?:ly)?|then|next|subsequently|finally|lastly|second(?:ly)?)\b/, /\b(?:step|stage|phase)s?\b/],
  // Kelime sonu şart: "loophole", "against" yakalanmasın.
  cycle: [/\b(?:cycles?|loops?|again|returns? to|repeat(?:s|ed|ing)?|recur(?:s|red|ring|rent|rence)?)\b/],
  cause: [/\b(?:because|causes?|caused|leads? to|results? in|depends? on|due to|factors?|affects?|affected)\b/],
  // "raisin", "lowercase" yakalanmasın: rais- ve lower yalnız fiil çekimleriyle.
  direction: [/\b(?:increas|decreas|reduc|rais(?:e|es|ed|ing)\b|lower(?:s|ed|ing)?\b|weaken|strengthen)/],
  contrast: [/\b(?:however|whereas|in contrast|although|nevertheless|conversely)\b/],
  classify: [/\b(?:types of|kinds of|classified|categor|divided into|subtypes?)/],
  time: [/\b(?:century|decade|era)\b/],
};

/**
 * "ise" Türkçede her zaman karşıtlık değildir: "Sonuç ise anlamlıdır" bir
 * odaklamadır. Karşıtlık sayılması için aynı cümlede "-ken" ile kurulmuş bir
 * karşı yan cümle aranır ("A artarken B ise azalır").
 */
const TR_ISE_CONTRAST = /\w+ken\b.*\bise\b/;

/** Tek cümlenin sinyalleri: kategori → sayı. */
export function sentenceSignals(text, lang = 'tr') {
  const raw = String(text || '');
  const s = lang === 'tr' ? fold(raw).trim() : raw.toLowerCase().trim();
  const dict = lang === 'tr' ? TR : EN;
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const [cat, patterns] of Object.entries(dict)) {
    if (patterns.some((re) => re.test(s))) out[cat] = 1;
  }
  if (lang === 'tr' && TR_ISE_CONTRAST.test(s)) out.contrast = 1;
  if (LIST_MARKER.test(raw)) out.order = 1;
  out.time += (raw.match(YEAR) || []).length;
  out.number = (s.match(NUMBER) || []).length;
  out.citation = CITATION.test(raw) ? 1 : 0;
  return out;
}

/** Paragraf profili: her kategoride sinyal taşıyan cümle (yıl ve sayıda adet) toplamı. */
export function profileOf(sentences, lang = 'tr') {
  const total = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const s of sentences) {
    const sig = sentenceSignals(s.text, lang);
    for (const c of CATEGORIES) total[c] += sig[c];
  }
  return total;
}
