/**
 * dataUtils.js
 * Literatur AI - Veri normalleştirme yardımcı fonksiyonları
 * 
 * Scopus API'den gelen ham veriyi temizler, parse eder ve normalize eder.
 * Server tarafında API'den veri çekildikten sonra bu fonksiyondan geçirilmeli.
 */

// ─── Sabitler ────────────────────────────────────────────────────────────────

export const PUB_TYPE_LABELS = {
  fla: 'Makale',
  rev: 'Derleme',
  chp: 'Kitap Bölümü',
  crp: 'Düzeltme',
  sco: 'Kısa İletişim',
  ssu: 'Özel Bölüm',
};

export const SOURCE_TYPE_LABELS = {
  Journal: 'Dergi',
  'Reference Work': 'Ansiklopedi',
  EBook: 'E-Kitap',
};

// ─── Yardımcı parse fonksiyonları ────────────────────────────────────────────

/**
 * Scopus'tan string olarak gelen authors JSON'ını parse eder.
 * Başarısız olursa dc:creator'a fallback yapar.
 */
function parseAuthors(authorsRaw, dcCreator) {
  if (authorsRaw) {
    try {
      const parsed = typeof authorsRaw === 'string' ? JSON.parse(authorsRaw) : authorsRaw;
      const names = (parsed.author || []).map((a) => a['$']).filter(Boolean);
      if (names.length > 0) return names;
    } catch (_) {}
  }

  // Fallback: dc:creator
  if (Array.isArray(dcCreator)) {
    return dcCreator.map((a) => a['$']).filter(Boolean);
  }
  if (typeof dcCreator === 'string' && dcCreator) {
    return [dcCreator];
  }
  return [];
}

/**
 * Scopus'tan string olarak gelen link JSON'ını parse eder.
 * Başarısız olursa DOI linkine fallback yapar.
 */
function parseLink(linkRaw, doi) {
  if (linkRaw) {
    try {
      const parsed = typeof linkRaw === 'string' ? JSON.parse(linkRaw) : linkRaw;
      const href = parsed?.[0]?.['@href'];
      if (href) return href;
    } catch (_) {}
  }
  if (doi) return `https://doi.org/${doi}`;
  return null;
}

/**
 * prism:coverDate (ISO 8601) alanından güvenli yıl çıkarır.
 * prism:coverDisplayDate'in tutarsız formatını kullanmaz.
 */
function parseYear(coverDate) {
  if (!coverDate) return null;
  const yearStr = String(coverDate);
  if (yearStr.length < 4) return null;
  const year = parseInt(yearStr.slice(0, 4), 10);
  return isNaN(year) ? null : year;
}

/**
 * "Keyword1 | Keyword2 | Keyword3" formatını diziye çevirir.
 */
function parseKeywords(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.split('|').map((k) => k.trim()).filter(Boolean);
}

/**
 * Sayfa aralığından sayfa sayısı hesaplar.
 */
function calcPageCount(start, end) {
  const s = parseInt(start, 10);
  const e = parseInt(end, 10);
  if (isNaN(s) || isNaN(e) || e < s) return null;
  return e - s + 1;
}

// ─── Ana normalleştirme fonksiyonu ───────────────────────────────────────────

/**
 * Tek bir Scopus ham kaydını temiz ve tutarlı formata çevirir.
 * 
 * @param {Object} raw - Scopus API'den gelen ham kayıt
 * @returns {Object} Temizlenmiş kayıt
 */
export function normalizeRecord(raw) {
  const authors = parseAuthors(raw['authors'], raw['dc:creator']);
  const doi = raw['prism:doi'] || '';
  const link = parseLink(raw['link'], doi);
  const year = parseYear(raw['prism:coverDate']);
  const keywords = parseKeywords(raw['authkeywords']);
  const pageCount = calcPageCount(raw['prism:startingPage'], raw['prism:endingPage']);
  const pubType = raw['pubType'] || '';
  const sourceType = raw['prism:aggregationType'] || '';

  return {
    // Kimlik
    eid: raw['eid'] || '',
    doi,
    link,

    // İçerik
    title: raw['dc:title'] || '',
    authors,
    firstAuthor: authors[0] || '',
    description: raw['dc:description'] || raw['prism:teaser'] || '',
    teaser: raw['prism:teaser'] || '',
    keywords,

    // Yayın bilgisi
    publicationName: raw['prism:publicationName'] || '',
    year,
    volume: raw['prism:volume'] || null,
    issue: raw['prism:issueIdentifier'] || null,
    pageCount,
    issn: raw['prism:issn'] || null,
    isbn: raw['prism:isbn'] || null,
    availableOnlineDate: raw['available-online-date'] || null,

    // Tür (ham kod + Türkçe etiket)
    pubType,
    pubTypeLabel: PUB_TYPE_LABELS[pubType] || 'Bilinmiyor',
    sourceType,
    sourceTypeLabel: SOURCE_TYPE_LABELS[sourceType] || 'Bilinmiyor',

    // Erişim
    openAccess: raw['openaccessArticle'] === true || raw['openaccessArticle'] === "1",

    // Atıf Sayısı
    citedbyCount: raw['citedby-count'] ? parseInt(raw['citedby-count'], 10) : 0,
  };
}

// ─── Toplu normalleştirme + temizlik ─────────────────────────────────────────

/**
 * Ham kayıt dizisini normalize eder, duplicate'leri temizler.
 * 
 * @param {Array} rawArray - Ham Scopus kayıtları
 * @returns {Array} Temiz kayıtlar
 */
export function normalizeAndClean(rawArray) {
  if (!Array.isArray(rawArray)) return [];

  const seenEids = new Set();
  const result = [];

  for (const raw of rawArray) {
    const normalized = normalizeRecord(raw);

    // EID bazlı duplicate temizleme
    if (normalized.eid && seenEids.has(normalized.eid)) continue;
    if (normalized.eid) seenEids.add(normalized.eid);

    result.push(normalized);
  }

  return result;
}

// ─── AHP Yardımcıları ────────────────────────────────────────────────────────

/**
 * Kullanıcı sorgusunu record'ın keyword'leriyle karşılaştırır.
 * 0-1 arası alaka skoru döner.
 * 
 * @param {string[]} keywords - Record'ın keyword listesi
 * @param {string} query - Kullanıcı arama sorgusu
 * @returns {number} 0-1 arası skor
 */
export function calcRelevanceScore(keywords, query) {
  if (!keywords || !keywords.length || !query) return 0;
  const q = query.toLowerCase();
  const matches = keywords.filter((kw) => q.includes(kw.toLowerCase()) || kw.toLowerCase().includes(q.split(' ')[0]));
  return matches.length / keywords.length;
}

/**
 * Yayın türüne göre kalite puanı (AHP kriteri).
 * Makale > Derleme > Kitap Bölümü > diğerleri
 */
export const PUB_TYPE_SCORES = {
  fla: 1.0,   // Journal Article - highest
  rev: 0.95,  // Review
  chp: 0.75,  // Book Chapter
  cnf: 0.70,  // Conference Paper
  sco: 0.65,  // Short Communication
  ssu: 0.60,  // Special Issue
  crp: 0.40,  // Correction
  pre: 0.30,  // Preprint
};

/**
 * Kaynaklar yayın tipini birbirinden çok farklı biçimlerde veriyor:
 * Scopus 'Article', OpenAlex 'article', Crossref 'journal-article',
 * Semantic Scholar 'JournalArticle'. PUB_TYPE_SCORES ise Scopus'un üç harfli
 * kodlarıyla yazılmış. Bu eşleme olmadan pubType her zaman tanımsız kalıyor ve
 * AHP'nin %18 ağırlıklı kalite kriteri sabit 0.4 fallback'ine düşüyor.
 */
const PUB_TYPE_ALIASES = {
  // Makale
  'fla': 'fla', 'article': 'fla', 'journal-article': 'fla', 'journalarticle': 'fla',
  'research-article': 'fla', 'article in press': 'fla',
  // Derleme
  'rev': 'rev', 'review': 'rev', 'reviewarticle': 'rev', 'review-article': 'rev',
  // Kitap bölümü
  'chp': 'chp', 'book-chapter': 'chp', 'bookchapter': 'chp', 'book chapter': 'chp',
  'booksection': 'chp', 'book-part': 'chp',
  // Konferans
  'cnf': 'cnf', 'proceedings-article': 'cnf', 'conference paper': 'cnf',
  'conferencepaper': 'cnf', 'conference-paper': 'cnf', 'proceedings': 'cnf',
  // Kısa iletişim
  'sco': 'sco', 'short survey': 'sco', 'letter': 'sco', 'note': 'sco',
  // Özel bölüm
  'ssu': 'ssu',
  // Düzeltme / editöryal
  'crp': 'crp', 'erratum': 'crp', 'correction': 'crp', 'editorial': 'crp',
  'errata': 'crp', 'retraction': 'crp',
  // Preprint
  'pre': 'pre', 'preprint': 'pre', 'posted-content': 'pre', 'submitted': 'pre',
};

/**
 * Herhangi bir kaynaktan gelen ham yayın tipini PUB_TYPE_SCORES koduna çevirir.
 * Eşleşme bulunamazsa null döner (çağıran taraf fallback uygular).
 */
export function normalizePublicationType(raw) {
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const key = String(value).toLowerCase().trim();
  return PUB_TYPE_ALIASES[key] || null;
}

/**
 * Kaynak türüne göre kalite puanı (AHP kriteri).
 */
export const SOURCE_TYPE_SCORES = {
  Journal: 1.0,
  Book: 0.8,
  'Book Series': 0.75,
  'Conference Proceeding': 0.7,
  // journalRankingService 'Conference' ve 'Preprint' uretiyor. Bu iki anahtar
  // tabloda yoktu, dolayisiyla ikisi de 0.5 fallback'ine dusuyor ve hakemli bir
  // konferans bildirisi ile hakemsiz bir preprint ayni kalite puanini aliyordu.
  Conference: 0.7,
  Preprint: 0.35,
  EBook: 0.65,
  'Reference Work': 0.6,
  'Report': 0.5,
  'Encyclopedia': 0.5
};
