// Belge sayaçları: tamamen yerel, model çağrısı yok.

const CITATION = /\([^)]*\b\d{4}\b[^)]*\)|\[\d+(?:[,-]\s*\d+)*\]/;

/** Cümlelere böler. Kısaltma ve ondalık sayı yüzünden kaba bir ayırma. */
export function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=[^a-zçğıöşü])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/**
 * Kaynaksız cümle: içinde (Yazar, 2021) ya da [14] gibi bir atıf işareti
 * olmayan cümle. Tasarımdaki "14 cümlenin 3'ü kaynaksız" sayacının
 * metin tabanlı hali; iddia–kanıt bağı kurulunca çapalardan hesaplanacak.
 */
export function documentStats(text) {
  const clean = String(text || '').trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  const sentences = splitSentences(clean);
  const uncited = sentences.filter((s) => !CITATION.test(s));
  return {
    words,
    characters: clean.length,
    sentences: sentences.length,
    uncited: uncited.length,
    uncitedSamples: uncited.slice(0, 5),
    // Akademik okuma hızı için kaba bir değer: dakikada 200 kelime.
    readingMinutes: Math.max(1, Math.round(words / 200)),
  };
}
