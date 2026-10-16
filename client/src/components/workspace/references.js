// Kaynakça tutarlılığı — DOM'a dokunmaz, test edilebilir.
//
// Metindeki yazar–yıl atıflarını sepetteki kaynaklarla eşleştirir:
// hangi kaynağa atıf var (kaynakçaya girer), hangisine yok (girmez), hangi
// atıfın sepette karşılığı yok (kaynakçada eksik kalır). Sayısal atıf ([14])
// bu sürümde eşleştirilmez; arayüz bunu söyler.
//
// Eşleştirme soyadı + yıl ile yapılır. Aynı yazarın aynı yıl iki çalışması
// (2020a / 2020b) ilk kaynağa bağlanır — bilinen sınır.
import { firstSurname } from './citation.js';
import { fold } from './claimDetection.js';

const YEAR = '(?:1[5-9]|20)\\d{2}';
// Parantez içindeki "bkz.", "ör." gibi ön ekler ve "(Haziran 2020)" gibi
// tarihlerdeki ay adları soyadı sayılmaz.
const LEADS = new Set([
  'bkz', 'bakiniz', 'or', 'orn', 'ornegin', 'ayrica', 'see', 'eg', 'cf', 'also',
  'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
]);

/** Kaynakça başlığı mı: "Kaynakça", "Kaynaklar", "References", "Bibliography". */
export function isReferencesHeading(text) {
  const t = fold(String(text || '')).replace(/[^a-z ]/g, '').trim();
  return ['kaynakca', 'kaynaklar', 'kullanilan kaynaklar', 'references', 'bibliography', 'reference list'].includes(t);
}

/**
 * Metindeki yazar–yıl atıfları: { raw, surname, year, at }.
 * Parantez içi: "(Yılmaz, 2020; Demir vd., 2019)". Anlatı: "Yılmaz (2020)",
 * "Yılmaz ve Demir (2020)", "Yılmaz vd. (2020)".
 */
export function findCitations(text) {
  const s = String(text || '');
  const out = [];

  const paren = new RegExp(`\\(([^()]*\\b${YEAR}[a-z]?[^()]*)\\)`, 'g');
  for (let m = paren.exec(s); m; m = paren.exec(s)) {
    for (const part of m[1].split(';')) {
      const year = part.match(new RegExp(`\\b(${YEAR})[a-z]?\\b`));
      if (!year) continue;
      const words = part.match(/\p{L}[\p{L}'’-]*/gu) || [];
      const surname = words.find((w) => !LEADS.has(fold(w).replace(/[^a-z]/g, '')) && /^\p{Lu}/u.test(w));
      // Soyadı olmayan parça ("(2020)") anlatı atıfının yılıdır; aşağıda yakalanır.
      if (!surname) continue;
      out.push({ raw: part.trim(), surname, year: year[1], at: m.index });
    }
  }

  const narrative = new RegExp(
    `(\\p{Lu}[\\p{L}'’-]+)(?:\\s+(?:ve|and|&)\\s+\\p{Lu}[\\p{L}'’-]+|\\s+(?:vd\\.|et al\\.))?\\s+\\((${YEAR})[a-z]?\\)`,
    'gu',
  );
  for (let m = narrative.exec(s); m; m = narrative.exec(s)) {
    out.push({ raw: m[0], surname: m[1], year: m[2], at: m.index });
  }

  return out.sort((a, b) => a.at - b.at);
}

const keyOf = (surname, year) => `${fold(surname)}|${String(year || '').slice(0, 4)}`;

/**
 * Metin ile sepeti karşılaştırır.
 * cited: atıf yapılan kaynakların sepetteki sırası, metindeki ilk geçişe göre
 *        (IEEE numarası bu sırayla verilir).
 * uncited: sepette olup metinde atıfı olmayanlar.
 * orphans: metinde olup sepette karşılığı bulunmayan atıflar.
 */
export function matchSources(text, papers) {
  const list = papers || [];
  const keys = list.map((p) => keyOf(firstSurname(p), p?.year));
  const firstAt = new Map();
  const orphans = [];

  for (const c of findCitations(text)) {
    const index = keys.indexOf(keyOf(c.surname, c.year));
    if (index < 0) orphans.push(c.raw);
    else if (!firstAt.has(index)) firstAt.set(index, c.at);
  }

  const cited = [...firstAt.entries()].sort((a, b) => a[1] - b[1]).map(([i]) => i);
  const uncited = list.map((_, i) => i).filter((i) => !firstAt.has(i));
  return { cited, uncited, orphans: [...new Set(orphans)] };
}
