import { createRequire } from 'node:module';

// bibliography.js ile aynı gerekçe: eklentiler Citation.js'in CommonJS
// kopyasına kaydoluyor, ikisi de aynı yoldan yüklenmeli.
const require = createRequire(import.meta.url);
const { Cite } = require('@citation-js/core');
require('@citation-js/plugin-bibtex');
require('@citation-js/plugin-ris');

/**
 * Zotero / Mendeley / EndNote dışa aktarmasını (.bib, .ris) sepete eklenebilir
 * kayıtlara çevirir. Model çağrısı yok: alanlar yalnız dosyadan gelir
 * (CLAUDE.md 3.1). Eksik alan uydurulmaz, `null` değil boş dize kalır çünkü
 * sepet kaydı (minimizeBasketPaper) dizeyle çalışır.
 *
 * Dosyadaki künye kullanıcının yöneticisinden geliyor, doğrulanmış bir
 * metadata kaydı değil: DOI'li kayıtların künyesi kaynakça üretilirken
 * doi.org'dan tazelenir (bibliography.js enrichPapersWithCsl).
 */

export const MAX_IMPORT_ENTRIES = 200;
// express.json gövdeyi 1 MB'da kesiyor (index.js); buradaki tavan ondan küçük
// olsun ki kullanıcı anlaşılır bir hata görsün, gövde ayrıştırıcısının
// genel hatasını değil.
export const MAX_INPUT_BYTES = 768 * 1024;

const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Dosya biçimini içeriğinden anlar. Uzantıya güvenmiyoruz: Zotero "Better
 * BibTeX" çıktısını .txt diye kaydedebiliyor.
 * @returns {'bibtex'|'ris'|null}
 */
export function detectFormat(text) {
  const head = String(text || '').slice(0, 4000);
  // RIS: "TY  - JOUR" (iki boşluk standart, bazı araçlar tek boşluk yazıyor)
  if (/^\s*TY\s{1,2}-\s*\S/m.test(head)) return 'ris';
  if (/^\s*@\s*[A-Za-z]+\s*[{(]/m.test(head)) return 'bibtex';
  return null;
}

/** CSL yazar dizisini sepetin beklediği tek dizeye çevirir. */
function authorLine(authors) {
  if (!Array.isArray(authors)) return '';
  return authors
    .map((a) => {
      if (a?.literal) return clip(a.literal, 120);
      const family = clip(a?.family, 80);
      const given = clip(a?.given, 80);
      if (family && given) return `${family}, ${given}`;
      return family || given;
    })
    .filter(Boolean)
    .join('; ');
}

/** CSL `issued` alanından yıl. Bulunamazsa boş. */
function issuedYear(item) {
  const parts = item?.issued?.['date-parts'];
  const fromParts = Array.isArray(parts) && Array.isArray(parts[0]) ? parts[0][0] : null;
  const raw = fromParts ?? item?.issued?.literal ?? item?.issued?.raw;
  const year = Number.parseInt(String(raw ?? '').match(/\d{4}/)?.[0] ?? '', 10);
  return Number.isFinite(year) && year > 0 && year < 2200 ? String(year) : '';
}

const normalizeDoi = (value) => clip(value, 200)
  .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
  .replace(/^doi:\s*/i, '')
  .toLowerCase()
  .slice(0, 100);

/** Kaydın DOI'si `note`/`url` alanına gömülmüş olabilir (Zotero bazen oraya yazıyor). */
function findDoi(item) {
  const direct = normalizeDoi(item?.DOI);
  if (direct) return direct;
  const haystack = `${item?.note ?? ''} ${item?.URL ?? ''}`;
  const match = haystack.match(/10\.\d{4,9}\/[^\s"'<>,;]+/);
  return match ? normalizeDoi(match[0]) : '';
}

/** Tek CSL kaydını sepet alanlarına indirir. */
function toEntry(item, index) {
  const doi = findDoi(item);
  const title = clip(item?.title, 300);
  return {
    // İstemcinin seçim listesinde satır kimliği; sepete gitmez.
    id: `imp-${index}`,
    title,
    creator: authorLine(item?.author),
    year: issuedYear(item),
    publicationName: clip(item?.['container-title'] || item?.['collection-title'], 150),
    volume: clip(item?.volume, 30),
    issue: clip(item?.issue, 30),
    pages: clip(item?.page, 30),
    doi,
    // DOI varsa kalıcı adres ondan kurulur; dosyadaki geçici bağlantıdan iyi.
    url: doi ? `https://doi.org/${doi}` : clip(item?.URL, 300),
    // Sepetteki `description` pasaj olarak kullanılıyor: özet varsa aktarılır.
    description: clip(item?.abstract, 600),
    type: clip(item?.type, 40),
  };
}

/**
 * .bib / .ris metnini kayıtlara çevirir.
 *
 * Biçim yalnızca içerikten okunur, dosya uzantısından değil. Citation.js'e
 * biçim zorlanamıyor (`forceType` RIS'te "No synchronous parser found" veriyor)
 * ve kütüphane de aynı işaretlere baktığı için uzantı ipucunun pratik bir
 * karşılığı yok: `detectFormat` anlamıyorsa kütüphane de anlamıyor.
 *
 * @param {string} text dosya içeriği
 * @returns {Promise<{format: 'bibtex'|'ris', entries: Array<object>, total: number, skipped: number}>}
 * @throws {Error} `code` alanı: EMPTY, TOO_LARGE, UNKNOWN_FORMAT, UNPARSABLE
 */
export async function parseReferences(text) {
  const raw = String(text || '');
  if (!raw.trim()) throw Object.assign(new Error('Dosya boş.'), { code: 'EMPTY' });
  if (Buffer.byteLength(raw, 'utf8') > MAX_INPUT_BYTES) {
    throw Object.assign(new Error('Dosya çok büyük.'), { code: 'TOO_LARGE' });
  }

  const detected = detectFormat(raw);
  if (!detected) {
    throw Object.assign(new Error('Dosya BibTeX (.bib) veya RIS (.ris) değil.'), { code: 'UNKNOWN_FORMAT' });
  }

  let items;
  try {
    // RIS ayrıştırıcısı eşzamansız: `new Cite(text)` bazı girdilerde "No
    // synchronous parser found for @ris/text" veriyor. Cite.async ikisini de
    // karşılar.
    items = (await Cite.async(raw)).data;
  } catch (error) {
    throw Object.assign(new Error('Dosya okunamadı.'), { code: 'UNPARSABLE', cause: error });
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('Dosyada kayıt bulunamadı.'), { code: 'UNPARSABLE' });
  }

  // Başlıksız kayıt sepette tanınmaz (kimliği başlık ya da DOI): sayısı
  // söylenir, sessizce düşürülmez (CLAUDE.md 2.8).
  const named = items.map(toEntry).filter((e) => e.title || e.doi);
  const seen = new Set();
  const entries = [];
  for (const entry of named) {
    const key = entry.doi ? `doi:${entry.doi}` : `title:${entry.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
    if (entries.length >= MAX_IMPORT_ENTRIES) break;
  }

  return {
    format: detected,
    entries,
    total: items.length,
    skipped: items.length - entries.length,
  };
}
