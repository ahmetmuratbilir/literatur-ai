// Kaynak değişimi denetimi (WO-016, kullanıcı düzeltmesi 17.10.2026).
//
// Yapı oluşturulduğu andaki paragrafın kopyasını ve hash'ini taşır. Paragraf
// sonradan değişirse şekil bozulmaz (kendi metniyle çizilir); bu modül yalnız
// durumu ve — mümkünse — yeni konumları söyler. Belgeyi değiştirmez.
//
// Konum takibi geçiş sıra numarasına değil DEĞİŞEN BÖLGEYE dayanır: etiketten
// önce aynı kelime eklenirse sıra numarası tek başına yanlış geçişi gösterir.

import { occurrenceAt, sentencesOf } from './schema.js';

/** Yalnız boşluk farkı "değişmedi" sayılsın diye: NFC + boşlukları tek boşluğa indir. */
export function normalizeParagraph(text) {
  return String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

export async function paragraphHash(text) {
  const bytes = new TextEncoder().encode(normalizeParagraph(text));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Yapının kaynağını mühürler (hash'i yazar). Yeni nesne döner. */
export async function sealSource(structure) {
  return { ...structure, source: { ...structure.source, hash: await paragraphHash(structure.source.text) } };
}

function countOf(hay, needle) {
  if (!needle) return 0;
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) n += 1;
  return n;
}

/** Eski ve yeni metnin ortak başı ve ortak sonu (üst üste binmeden). */
function commonEnds(a, b) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p += 1;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q += 1;
  return { p, q };
}

/**
 * Tek bir etiketin yeni metindeki yeri ya da null (kayboldu).
 * 1) Tamamen ortak baştaysa yeri aynı; tamamen ortak sondaysa uzunluk farkı kadar kayar.
 * 2) Değişen bölgeyle kesişiyorsa: metin eski cümlede de yeni (aynı sıradaki)
 *    cümlede de TAM BİR KEZ geçiyorsa oraya bağlanır; yoksa null.
 *    Birden çok geçiş varsa başka birini sessizce seçmez.
 */
function relocate(item, oldSentences, oldText, newText, newSentences, ends) {
  const os = oldSentences[item.sentence];
  if (!os) return null;
  const A = os.start + item.start;
  const B = os.start + item.end;
  let nA = null;
  if (B <= ends.p) nA = A;
  else if (A >= oldText.length - ends.q) nA = A + (newText.length - oldText.length);
  if (nA != null) {
    const ns = newSentences.find((s) => nA >= s.start && nA + item.text.length <= s.end);
    if (ns && newText.slice(nA, nA + item.text.length) === item.text) {
      const start = nA - ns.start;
      return { ...item, sentence: ns.i, start, end: start + item.text.length, occurrence: occurrenceAt(ns.text, item.text, start) };
    }
    return null;
  }
  const ns = newSentences[item.sentence];
  if (!ns || countOf(os.text, item.text) !== 1 || countOf(ns.text, item.text) !== 1) return null;
  const start = ns.text.indexOf(item.text);
  return { ...item, sentence: ns.i, start, end: start + item.text.length, occurrence: 0 };
}

/**
 * @param structure  oluşturulduğu andaki kaynağı taşıyan yapı (sealSource'tan geçmiş)
 * @param currentText  paragrafın şimdiki metni; paragraf silindiyse null
 * @returns {Promise<{status:'unchanged'|'relocated'|'changed'|'missing'|'detached',
 *   warn:boolean, lost:Array, structure:object}>}
 *   relocated'da `structure` yeni konumlarla ve yeni kaynakla güncellenmiş kopyadır;
 *   changed'de yapı olduğu gibi kalır (şekil saklanan metinle çizilmeye devam eder).
 */
export async function checkSource(structure, currentText) {
  const src = structure.source;
  if (src.detached) return { status: 'detached', warn: false, lost: [], structure };
  if (currentText == null) return { status: 'missing', warn: true, lost: [], structure };
  if (currentText === src.text) return { status: 'unchanged', warn: false, lost: [], structure };

  const sameHash = (await paragraphHash(currentText)) === (src.hash || (await paragraphHash(src.text)));
  const newSentences = sentencesOf(currentText);
  const ends = commonEnds(src.text, currentText);
  const lost = [];
  const move = (item) => {
    if (item.start == null || !item.text) return item; // etiketsiz kenar
    const r = relocate(item, structure.sentences, src.text, currentText, newSentences, ends);
    if (!r) lost.push({ id: item.id, text: item.text });
    return r || item;
  };
  const nodes = structure.nodes.map(move);
  const edges = structure.edges.map(move);
  if (lost.length) return { status: 'changed', warn: true, lost, structure };

  const updated = {
    ...structure,
    sentences: newSentences,
    nodes,
    edges,
    source: { ...src, text: currentText, hash: await paragraphHash(currentText) },
  };
  // Yalnız boşluk değiştiyse kullanıcıya söylenecek bir şey yok; konumlar yine güncellenir.
  return { status: sameHash ? 'unchanged' : 'relocated', warn: false, lost: [], structure: updated };
}
