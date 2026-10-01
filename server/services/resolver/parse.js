/**
 * Makale çözümleyici — Katman 0: girdi tanıma ve kaynakça satırı ayrıştırma.
 * Yerel, dış çağrı yok.
 *
 * Ayrıştırılan alanlar YALNIZCA arama ve doğrulama içindir; sonuç olarak
 * kullanılmaz. Kanonik kayıt her zaman bir indeksten (Crossref, OpenAlex…) gelir.
 */

const TRAILING_PUNCT = /[.,;:)\]}>'"’”]+$/;

/** trim + Unicode NFC + boşluk sıkıştırma; URL ise güvenli decode. */
export function normalizeInput(raw) {
  let text = String(raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (/^https?:\/\//i.test(text)) {
    try { text = decodeURI(text); } catch { /* bozuk kodlama: olduğu gibi */ }
    text = text.replace(/%2F/gi, '/');
  }
  return text;
}

/**
 * DOI'yi metin içinden çıkarır. URL'de /doi/full/…, /doi/abs/… önekleri
 * doğal olarak atlanır; sondaki /pdf, /full gibi yol parçaları ve noktalama
 * temizlenir. Kapanmamış parantez korunur: 10.1002/(SICI)… DOI'lerinde parantez
 * DOI'nin parçasıdır.
 */
export function extractDoi(text) {
  const m = String(text || '').match(/10\.\d{4,9}\/[-._;()/:a-z0-9<>[\]]+/i);
  if (!m) return null;
  let doi = m[0];
  doi = doi.replace(/\/(full|abstract|abs|pdf|epdf|pdfdirect|html|references|figures|suppl)(\/.*)?$/i, '');
  while (TRAILING_PUNCT.test(doi)) {
    const last = doi.slice(-1);
    if (last === ')' && (doi.match(/\(/g) || []).length >= (doi.match(/\)/g) || []).length) break;
    doi = doi.slice(0, -1);
  }
  return doi.toLowerCase();
}

/**
 * arXiv kimliği. Yeni biçim (1706.03762) yalnızca bağlam varsa kabul edilir:
 * "arxiv" geçiyorsa, huggingface.co/papers bağlantısıysa ya da girdi
 * yalnızca kimlikse. Kaynakça satırındaki sayfa/cilt sayıları yanlışlıkla
 * arXiv sanılmasın.
 */
export function extractArxiv(text) {
  const s = String(text || '');
  const context = /arxiv|huggingface\.co\/papers/i.test(s);
  const bare = /^\s*(arxiv:)?\s*\d{4}\.\d{4,5}(v\d+)?\s*$/i.test(s);
  if (context || bare) {
    const modern = s.match(/(\d{4}\.\d{4,5})(v\d+)?/);
    if (modern) return modern[1];
  }
  if (context) {
    const legacy = s.match(/\b([a-z-]+(?:\.[a-z]{2})?\/\d{7})(v\d+)?\b/i);
    if (legacy) return legacy[1].toLowerCase();
  }
  return null;
}

export function extractPmid(text) {
  const s = String(text || '');
  const tagged = s.match(/PMID:?\s*(\d{1,8})\b/i);
  if (tagged) return tagged[1];
  const url = s.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,8})/i);
  return url ? url[1] : null;
}

export function extractPmcid(text) {
  const m = String(text || '').match(/\bPMC\d{4,9}\b/i);
  return m ? m[0].toUpperCase() : null;
}

export function extractIsbn(text) {
  const m = String(text || '').match(/\bISBN(?:-1[03])?:?\s*([0-9Xx][0-9Xx -]{8,16}[0-9Xx])\b/);
  if (!m) return null;
  const digits = m[1].replace(/[^0-9Xx]/g, '').toUpperCase();
  return digits.length === 10 || digits.length === 13 ? digits : null;
}

/** ScienceDirect/Elsevier PII (URL yolunda DOI olmayan Elsevier sayfaları). */
export function extractPii(text) {
  const m = String(text || '').match(/\/pii\/(S?[0-9X]{16,17})/i);
  return m ? m[1].toUpperCase() : null;
}

export const isUrl = (text) => /^https?:\/\/\S+$/i.test(String(text || '').trim());

/** Girdinin türü ve içindeki kimlikler. */
export function identify(raw) {
  const text = normalizeInput(raw);
  const url = isUrl(text) ? text : null;
  return {
    text,
    url,
    doi: extractDoi(text),
    arxiv: extractArxiv(text),
    pmid: extractPmid(text),
    pmcid: extractPmcid(text),
    isbn: extractIsbn(text),
    pii: url ? extractPii(text) : null,
    github: url && /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(url) ? url : null,
  };
}

// --- Kaynakça satırı ayrıştırma ------------------------------------------

const UPPER = 'A-ZÇĞİÖŞÜÂÎÛÄËÏÖÜÉÈÁÀÓÒÚÙÑ';
const INITIALS = new RegExp(`^(?:[${UPPER}]\\.?\\s?-?){1,4}\\.?$`, 'u');
const YEAR_RE = /\b(19[5-9]\d|20[0-4]\d)\b/;

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const stripEnd = (s) => clean(s).replace(/[.,;:\s]+$/, '');

/**
 * APA yazar bloğu: "Di Luozzo, S., Starnoni, M., & Schiraldi, M. M." →
 * soyadları. "Soyad, A. B." çiftleri; kurum adları tek parça kalır.
 */
export function parseApaAuthors(block) {
  const parts = clean(block).replace(/\s*&\s*|\s+and\s+|\s+ve\s+/gi, ', ').split(/\s*,\s*/).filter(Boolean);
  const surnames = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].replace(/\.\.\.|…/g, '').trim();
    if (!part || /^et al\.?$|^vd\.?$/i.test(part)) continue;
    if (INITIALS.test(part)) continue; // önceki soyadın baş harfleri
    surnames.push(part);
  }
  return surnames;
}

/** IEEE yazar bloğu: "A. B. Smith, C. Doe, and D. Roe" → soyadları (son kelime). */
export function parseIeeeAuthors(block) {
  return clean(block)
    .replace(/\s+and\s+|\s*&\s*/gi, ', ')
    .split(/\s*,\s*/)
    .map((p) => p.replace(/\bet al\.?/i, '').trim())
    .filter((p) => p && !INITIALS.test(p))
    .map((p) => p.split(' ').filter((w) => !INITIALS.test(w)).join(' ') || p)
    .filter(Boolean);
}

/** Cilt(sayı), sayfa: "International J., 15(3), 120–135" */
function parseVenueTail(rest) {
  const out = { venue: null, volume: null, issue: null, pages: null };
  const text = stripEnd(String(rest || '').replace(/https?:\/\/\S+/g, '').replace(/\bdoi:\s*\S+/i, ''));
  if (!text) return out;
  const vol = text.match(/,\s*(?:vol\.\s*)?(\d{1,4})\s*(?:\((\d{1,4}[-–]?\d{0,4})\)|,\s*no\.\s*(\d{1,4}))?/i);
  const pages = text.match(/(?:pp?\.\s*)?\b(\d{1,6}\s*[-–]\s*\d{1,6}|e?\d{5,7})\b\s*$/i);
  out.venue = stripEnd(text.split(/,\s*(?:vol\.\s*)?\d/i)[0]) || null;
  if (vol) { out.volume = vol[1]; out.issue = vol[2] || vol[3] || null; }
  if (pages && pages[1] !== out.volume) out.pages = pages[1].replace(/\s+/g, '').replace('–', '-');
  return out;
}

/** Başlık: ilk cümle sonu (baş harf noktaları değil). */
function splitTitle(rest) {
  const s = clean(rest);
  const re = /([.?!])\s+(?=[\p{Lu}\d"“])/gu;
  let m;
  while ((m = re.exec(s))) {
    const before = s.slice(0, m.index);
    const lastWord = before.split(' ').pop();
    if (m[1] === '.') {
      // Kisaltma ("e.g.", "vs.") ya da ardindan yine bas harf gelen bas harf
      // ("U. S. Army") cumle sonu degil. Tek basina "X." basligin sonu olabilir.
      if (/^(e\.g|i\.e|vs|cf|etc|no|vol|pp|st|dr|prof)$/i.test(lastWord.replace(/\.$/, ''))) continue;
      if (/^\p{Lu}$/u.test(lastWord) && /^\p{Lu}\./u.test(s.slice(m.index + 2))) continue;
    }
    return { title: stripEnd(s.slice(0, m.index + (m[1] === '.' ? 0 : 1))), rest: s.slice(m.index + 1).trim() };
  }
  return { title: stripEnd(s), rest: '' };
}

/**
 * Kaynakça satırını alanlarına ayırır. Biçim tanınmazsa (serbest metin)
 * `structured: false` döner: yıl ve büyük harfle başlayan sözcükler yazar
 * adayı olur, kalan metin başlık sayılır.
 */
export function parseCitation(raw) {
  const text = normalizeInput(raw);
  const empty = { raw: text, title: null, authors: [], authorCandidates: [], year: null, venue: null, volume: null, issue: null, pages: null, structured: false, style: 'free' };
  if (!text) return empty;

  // APA: Yazarlar (2023). Başlık. Dergi, 15(3), 1-10.
  const apa = text.match(/^(.+?)\s*\((\d{4})[a-z]?(?:,[^)]*)?\)\.?\s*(.+)$/u);
  if (apa && !/[“"]/.test(apa[1])) {
    const authors = parseApaAuthors(apa[1]);
    const { title, rest } = splitTitle(apa[3]);
    return { ...empty, ...parseVenueTail(rest), title, authors, authorCandidates: authors, year: Number(apa[2]), structured: true, style: 'apa' };
  }

  // IEEE / MLA / Chicago: … "Başlık," Dergi, cilt, …, 2022.
  const quoted = text.match(/^(.*?)[“"](.+?)[,.]?[”"]\s*(.*)$/u);
  if (quoted) {
    const authors = parseIeeeAuthors(quoted[1].replace(/^\[\d+\]\s*/, '').replace(/[.,]\s*$/, ''));
    const yearMatch = (quoted[3].match(new RegExp(YEAR_RE.source, 'g')) || []).pop();
    const tail = parseVenueTail(quoted[3].replace(new RegExp(`,?\\s*(?:[A-Z][a-z]{2}\\.?\\s*)?${yearMatch || 'X'}\\.?\\s*$`), ''));
    return { ...empty, ...tail, title: stripEnd(quoted[2]), authors, authorCandidates: authors, year: yearMatch ? Number(yearMatch) : null, structured: true, style: 'quoted' };
  }

  // Serbest metin: "Thiede 2023 advanced energy data analytics predict OEE"
  const y = text.match(YEAR_RE);
  const year = y ? Number(y[1]) : null;
  const words = text.replace(YEAR_RE, ' ').split(/\s+/).filter(Boolean);
  // Yalnızca ilk harfi büyük sözcükler yazar adayı; OEE, TPM gibi kısaltmalar değil.
  const before = y ? text.slice(0, y.index).split(/\s+/).filter(Boolean) : [];
  const isName = (w) => new RegExp(`^[${UPPER}][\\p{Ll}'’-]+$`, 'u').test(w);
  const authorCandidates = (before.length ? before : words.slice(0, 2)).filter(isName);
  const title = words.filter((w) => !authorCandidates.includes(w)).join(' ') || text;
  return { ...empty, title, authorCandidates, year };
}
