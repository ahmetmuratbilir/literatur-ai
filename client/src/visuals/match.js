// Bir adayın cümlede nerede geçtiğini bulur (WO-016). Model çıktısının
// doğrulamasında (WO-C) yedek olarak kullanılır; kural kademesi parçaları
// zaten cümleden kestiği için buna ihtiyaç duymaz.
//
// Dönen konum her zaman cümledeki ASIL biçimdir: model "neden" yazsa da
// gösterilecek olan cümledeki "nedenleri"dir.

import { fold } from '../components/workspace/claimDetection.js';

const WORD = /[\p{L}\p{N}]+/gu;
const VOWELS = 'aeiou'; // fold sonrası: ı→i, ö→o, ü→u
const isVowel = (c) => VOWELS.includes(c);

// Kısa köklerde (< 4 harf) önek ancak kalan parça bu kapalı listedeyse sayılır:
// hal ve iyelik ekleri, kaynaştırmalı biçimleriyle (fold sonrası yazılmış).
// Liste dar tutuldu: "ön"→"önem", "kat"→"katkı", "ara"→"araç" eşleşmesin.
const SHORT_ROOT_SUFFIXES = new Set([
  'i', 'u', 'a', 'e',
  'yi', 'yu', 'ya', 'ye',
  'si', 'su',
  'nin', 'nun', 'in', 'un',
  'da', 'de', 'ta', 'te', 'dan', 'den', 'tan', 'ten',
  'lar', 'ler', 'lari', 'leri',
]);

// Ünsüz yumuşaması (fold sonrası ç→c ve ğ→g olduğu için ç/c ve k/ğ farkı
// zaten kalkıyor; kalanlar p→b, t→d, k→g).
const SOFTEN = { p: 'b', t: 'd', k: 'g' };

/** Aday kelimenin denenecek kök biçimleri: en fazla iki kural art arda. */
function stems(word) {
  const out = new Set([word]);
  const soften = (w) => (SOFTEN[w.at(-1)] ? w.slice(0, -1) + SOFTEN[w.at(-1)] : null);
  // Ünlü düşmesi: ünsüz–ünlü–ünsüz ile biten kelimede son ünlü düşer (fikir → fikr-).
  const drop = (w) => (w.length >= 3 && !isVowel(w.at(-1)) && isVowel(w.at(-2)) && !isVowel(w.at(-3)) ? w.slice(0, -2) + w.at(-1) : null);
  // İkizleşme: son ünsüz ikilenir (hak → hakk-).
  const double = (w) => (!isVowel(w.at(-1)) ? w + w.at(-1) : null);
  for (const v of [soften(word), drop(word), double(word)]) if (v) out.add(v);
  const ds = drop(word) && soften(drop(word)); // kayıp → kayb-
  const sd = soften(word) && double(soften(word)); // ret → redd-
  if (ds) out.add(ds);
  if (sd) out.add(sd);
  return [...out];
}

function trWordMatch(cand, tok) {
  if (cand === tok) return true;
  for (const stem of stems(cand)) {
    if (!tok.startsWith(stem)) continue;
    const rest = tok.slice(stem.length);
    if (rest === '') return true;
    if (cand.length >= 4) return true;
    if (SHORT_ROOT_SUFFIXES.has(rest)) return true;
  }
  return false;
}

function enWordMatch(cand, tok) {
  if (cand === tok) return true;
  const forms = [cand + 's', cand + 'es', cand + 'ed', cand + 'd', cand + 'ing'];
  if (cand.endsWith('e')) forms.push(cand.slice(0, -1) + 'ing');
  return forms.includes(tok);
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * `needle`ın `hay` içinde kelime sınırlarında başlayıp biten ilk geçişi.
 * Sınır şartı olmasa "kan" adayı önce gelen "kanat"ın içine bağlanırdı.
 */
function indexAtWordBoundary(hay, needle) {
  let i = hay.indexOf(needle);
  while (i !== -1) {
    const before = i === 0 ? '' : hay[i - 1];
    const after = hay[i + needle.length] || '';
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return i;
    i = hay.indexOf(needle, i + 1);
  }
  return -1;
}

function words(text) {
  return [...String(text).matchAll(WORD)].map((m) => ({ w: m[0], start: m.index, end: m.index + m[0].length }));
}

/**
 * @returns {{start:number, end:number, mode:'exact'|'fold'|'tolerant'} | null}
 * `start/end` cümledeki asıl biçimin konumu. Birden çok yerde geçiyorsa ilki.
 * exact/fold yalnız kelime sınırında kabul edilir; ekli biçim tolerant'a düşer.
 */
export function matchSpan(sentence, candidate, lang = 'tr') {
  const s = String(sentence || '');
  const c = String(candidate || '').trim();
  if (!s || !c) return null;

  const exact = indexAtWordBoundary(s, c);
  if (exact !== -1) return { start: exact, end: exact + c.length, mode: 'exact' };

  const norm = (t) => (lang === 'tr' ? fold(t) : t.toLowerCase());
  const fs = norm(s);
  // fold harf başına tek harf üretiyorsa konumlar asıl metinle bire bir örtüşür;
  // örtüşmüyorsa bu adım atlanır, kelime kelime eşleştirme konumu kendisi bulur.
  if (fs.length === s.length) {
    const i = indexAtWordBoundary(fs, norm(c));
    if (i !== -1) return { start: i, end: i + c.length, mode: 'fold' };
  }

  const toks = words(s).map((t) => ({ ...t, n: norm(t.w) }));
  const cands = words(c).map((t) => norm(t.w));
  if (!cands.length) return null;
  const same = lang === 'tr' ? trWordMatch : enWordMatch;
  for (let i = 0; i + cands.length <= toks.length; i += 1) {
    if (cands.every((cw, j) => same(cw, toks[i + j].n))) {
      return { start: toks[i].start, end: toks[i + cands.length - 1].end, mode: 'tolerant' };
    }
  }
  return null;
}
