import pkg from 'natural';
import { enrichPaperRanking } from './journalRankingService.js';
import { mergeDateMetadata } from '../utils/dateNormalization.js';
import { normalizePublicationType } from '../utils/dataUtils.js';
const { JaroWinklerDistance } = pkg;

function isTrustedYearConfidence(confidence) {
  return confidence === 'high' || confidence === 'medium';
}

function resolvePublicationYear(result) {
  if (!isTrustedYearConfidence(result?.yearConfidence)) return null;

  const year = Number.parseInt(result.publicationYear, 10);
  return Number.isInteger(year) ? year : null;
}

function applyDateMetadata(target, dateMetadata) {
  target.publicationYear = dateMetadata.publicationYear;
  target.publicationDate = dateMetadata.publicationDate;
  target.metadataYear = dateMetadata.metadataYear;
  target.metadataDate = dateMetadata.metadataDate;
  target.dateSource = dateMetadata.dateSource;
  target.yearConfidence = dateMetadata.yearConfidence;
  target.year = dateMetadata.publicationYear ?? null;
  return target;
}

function extractAltId(item) {
  if (!item) return null;
  if (item.pmid) return `pmid:${String(item.pmid).trim().toLowerCase()}`;
  if (item.pubmedId) return `pmid:${String(item.pubmedId).trim().toLowerCase()}`;
  if (item.arxivId) return `arxiv:${String(item.arxivId).trim().toLowerCase().replace(/^arxiv:\s*/i, '')}`;
  if (item.corpusId) return `corpus:${String(item.corpusId).trim()}`;
  if (item.id && typeof item.id === 'string' && (item.id.startsWith('W') || item.id.startsWith('https://openalex.org/W'))) {
    const oId = item.id.replace('https://openalex.org/', '');
    return `openalex:${oId}`;
  }
  return null;
}

/**
 * Aynı makalenin iki kaydını birleştirir.
 *
 * Kaynaklar birbirini tamamlar: Crossref genelde abstract vermez ama DOI'si
 * kesindir, OpenAlex abstract ve atıf sayısı taşır, arXiv tam metin linki verir.
 * Bu yüzden "ilk gelen kazanır" yerine alan bazında en zengin değeri alıyoruz.
 */
function mergeDuplicateResult(existing, incoming) {
  if (incoming.source && !existing.sourceList.includes(incoming.source)) {
    existing.sourceList.push(incoming.source);
  }

  const mergedDateMetadata = mergeDateMetadata(existing, incoming);
  applyDateMetadata(existing, mergedDateMetadata);

  // Daha uzun özet daha fazla bilgi taşır; boş abstract sıralamada -2.0 ceza alıyor.
  const existingAbstract = String(existing.abstract || '');
  const incomingAbstract = String(incoming.abstract || incoming.description || '');
  if (incomingAbstract.length > existingAbstract.length) {
    existing.abstract = incomingAbstract;
    existing.description = incomingAbstract;
  }

  // Atıf sayısında kaynaklar ciddi şekilde ayrışır; en yükseği en güncel olanıdır.
  const existingCited = Number.parseInt(existing.citedBy ?? existing.citedbyCount ?? existing.citationCount, 10) || 0;
  const incomingCited = Number.parseInt(incoming.citedBy ?? incoming.citedbyCount ?? incoming.citationCount, 10) || 0;
  if (incomingCited > existingCited) {
    existing.citedBy = incomingCited;
    existing.citedbyCount = incomingCited;
    existing.citationCount = incomingCited;
  }

  // Eksik kalan tanımlayıcıları ve alternatif ID'leri tamamla (varsa üzerine yazma).
  for (const field of ['doi', 'url', 'publicationName', 'authors', 'pubType', 'pmid', 'pmcid', 'arxivId', 'corpusId', 'pdfUrl', 'downloadUrl', 'volume', 'issue', 'pages']) {
    if (!existing[field] && incoming[field]) {
      existing[field] = incoming[field];
    }
  }

  // Alana gore normalize atif yalnizca OpenAlex'te var; OpenAlex kopyasi
  // listede ikinci gelse de deger kaybolmamali.
  for (const field of ['citationPercentile', 'topCitedPercent', 'fwci']) {
    if (existing[field] == null && incoming[field] != null) existing[field] = incoming[field];
  }

  // Dergi sıralaması yalnızca bazı kaynaklarda çözülebiliyor.
  if (!existing.quartile && incoming.quartile) existing.quartile = incoming.quartile;
  if (!existing.sjr && incoming.sjr) existing.sjr = incoming.sjr;
  if (!existing.sourceType && incoming.sourceType) existing.sourceType = incoming.sourceType;

  if (!existing.openAccess && incoming.openAccess) existing.openAccess = incoming.openAccess;
  if (incoming.isOpenAccess) existing.openAccess = true;

  // DOAJ: herhangi bir kaynak "listede" diyorsa listede. "Listede degil"
  // yalnizca bilinmeyenin yerine gecer, "listede"nin ustune yazamaz.
  if (incoming.isInDoaj === true) existing.isInDoaj = true;
  else if (existing.isInDoaj == null && incoming.isInDoaj === false) existing.isInDoaj = false;
  if (!existing.issnL && incoming.issnL) existing.issnL = incoming.issnL;

  // Geri cekme: en agir durum kazanir. Bir kaynak "geri cekildi" diyorsa
  // digerinin sessiz kalmasi bunu iptal etmez.
  const severity = { retracted: 3, concern: 2, none: 1, unknown: 0 };
  const rank = (r) => severity[r?.status] ?? -1;
  if (rank(incoming.retraction) > rank(existing.retraction)) existing.retraction = incoming.retraction;

  return existing;
}

function normalizeDoi(value) {
  if (!value) return '';
  const raw = String(value).trim().toLowerCase();
  if (raw.length <= 5) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

function normalizeTitleForComparison(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Jaro-Winkler karşılaştırmasını atlamanın güvenli olduğu durum.
 *
 * Jaro üst sınırı J <= (r + 2) / 3 (r = kısa/uzun uzunluk oranı). Winkler ön ek
 * bonusu en fazla JW = 0.6*J + 0.4 verir. r < 0.7 için JW < 0.95 olduğundan,
 * bu oranın altındaki çiftler eşik değerini hiçbir zaman geçemez ve hesaplama
 * yapılmadan elenebilir. O(n^2) taramada en büyük kazanç buradan geliyor.
 */
function cannotReachSimilarityThreshold(lengthA, lengthB) {
  const shorter = Math.min(lengthA, lengthB);
  const longer = Math.max(lengthA, lengthB);
  if (longer === 0) return true;
  return shorter / longer < 0.7;
}

// Bu üç kaynakta yer alan her kayıt tanımı gereği açık erişimdir; kaynaklar
// ayrıca bir bayrak dönmediği için türetmek zorundayız.
const ALWAYS_OPEN_ACCESS_SOURCES = new Set(['DOAJ', 'ArXiv', 'CORE']);

// Bazı kaynaklar tek tip içerik barındırdığı için ham tip alanı vermez:
// DOAJ yalnızca hakemli dergi makalesi, arXiv yalnızca preprint indeksler.
const SOURCE_DEFAULT_PUB_TYPE = {
  DOAJ: 'fla',
  ArXiv: 'pre',
};

function resolveOpenAccess(result) {
  if (typeof result.openAccess === 'boolean') return result.openAccess;
  if (result.openAccess === '1' || result.openAccess === 1) return true;
  if (result.isOpenAccess === true) return true;
  return ALWAYS_OPEN_ACCESS_SOURCES.has(result.source);
}

export function normalizeSearchResult(result) {
  const normalizedDateMetadata = {
    publicationYear: result.publicationYear ?? null,
    publicationDate: result.publicationDate ?? null,
    metadataYear: result.metadataYear ?? null,
    metadataDate: result.metadataDate ?? null,
    dateSource: result.dateSource ?? null,
    yearConfidence: result.yearConfidence || 'low'
  };

  const normalized = {
    ...result,
    title: (result.title || '').trim(),
    abstract: (result.description || result.abstract || '').trim(),
    year: resolvePublicationYear(normalizedDateMetadata),
    ...normalizedDateMetadata,
    // AHP'nin kalite (%18) ve açık erişim (%5) kriterleri bu iki alana bakıyor.
    pubType: normalizePublicationType(
      result.pubType || result.type || result.subtypeDescription || result.publicationTypes
    ) || SOURCE_DEFAULT_PUB_TYPE[result.source] || null,
    openAccess: resolveOpenAccess(result),
    // DOAJ'dan gelen kayit tanimi geregi DOAJ dergisindedir. Diger kaynaklar
    // bilmiyorsa null: "listede degil" ile "bilmiyoruz" ayri seyler.
    isInDoaj: typeof result.isInDoaj === 'boolean'
      ? result.isInDoaj
      : (result.source === 'DOAJ' ? true : null),
    sourceList: [result.source || 'Unknown']
  };

  return enrichPaperRanking(normalized);
}

export function deduplicateResults(results) {
  const uniqueMap = new Map();

  const doiIndex = new Map();
  const altIdIndex = new Map();
  const titleEntries = [];

  for (const item of results) {
    const doi = normalizeDoi(item.doi);
    const altId = extractAltId(item);
    const titleClean = normalizeTitleForComparison(item.title);

    // 1. DOI kesin eşleşme
    if (doi && doiIndex.has(doi)) {
      mergeDuplicateResult(uniqueMap.get(doiIndex.get(doi)), item);
      continue;
    }

    // 2. Alternatif ID kesin eşleşme (PMID, arXiv ID, CorpusID, OpenAlex)
    if (altId && altIdIndex.has(altId)) {
      const matchedKey = altIdIndex.get(altId);
      mergeDuplicateResult(uniqueMap.get(matchedKey), item);
      if (doi && !doiIndex.has(doi)) doiIndex.set(doi, matchedKey);
      continue;
    }

    // 3. Başlık benzerliği (Fuzzy Fallback: Jaro-Winkler > 0.95)
    if (titleClean.length > 10) {
      let matchedKey = null;
      for (const entry of titleEntries) {
        if (cannotReachSimilarityThreshold(titleClean.length, entry.titleClean.length)) continue;
        if (JaroWinklerDistance(titleClean, entry.titleClean) > 0.95) {
          matchedKey = entry.key;
          break;
        }
      }

      if (matchedKey) {
        mergeDuplicateResult(uniqueMap.get(matchedKey), item);
        // Bu kayıt DOI veya altId taşıyorsa indeksleri güncelle
        if (doi && !doiIndex.has(doi)) doiIndex.set(doi, matchedKey);
        if (altId && !altIdIndex.has(altId)) altIdIndex.set(altId, matchedKey);
        continue;
      }
    }

    // 4. Yeni kayıt
    let key;
    if (doi) key = `doi:${doi}`;
    else if (altId) key = `alt:${altId}`;
    else if (titleClean.length > 10) key = `title:${titleClean}`;
    else key = `id:${item.id || `${uniqueMap.size}-${titleClean}`}`;

    uniqueMap.set(key, item);
    if (doi) doiIndex.set(doi, key);
    if (altId) altIdIndex.set(altId, key);
    if (titleClean.length > 10) titleEntries.push({ titleClean, key });
  }

  return Array.from(uniqueMap.values());
}

/**
 * Metni karşılaştırma için token kümesine çevirir.
 * `includes()` ile yapılan alt-dize eşleşmesi "act" sorgusunu "reactor" ve
 * "reaction" içinde de eşleştirip skorları şişiriyordu.
 */
export function toTokenSet(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      // NFKD 'ü'yu 'u' + birlesik isarete ayiriyor; isaret harf sayilmadigi
      // icin onceki surum "nükleer"i "nu" + "kleer" diye BOLUYORDU. Isaretleri
      // silmek kelimeyi butun tutar: "nükleer" -> "nukleer".
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 2)
  );
}

/**
 * Anlam tasimayan Ingilizce baglac/edatlar. Alan terimleri ("analysis",
 * "model") BILEREK listede yok: bir konunun parcasi olabilirler.
 */
export const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'using', 'via', 'its', 'are', 'was', 'were',
  'this', 'that', 'their', 'than', 'between', 'within', 'over', 'under', 'about', 'based', 'not',
]);

/** n sorgu kelimesinden en az kacinin makalede gecmesi gerekir. */
export function requiredMatches(n) {
  if (n <= 1) return n;
  return Math.max(2, Math.ceil(n / 2));
}

/**
 * Alaka esigi: sorgu kelimelerinin yeterince azi baslik+ozette gecmeyen
 * makaleler elenir.
 *
 * NEDEN: "En cok atif alanlar" profilinde canlida konu disi bir makale 2.
 * siraya cikti ("Global Linear Instability", 733 atif, akiskanlar dinamigi;
 * sorgu "nuclear reactor safety"). Kullanici karari: konu disi sonuc istenmiyor,
 * sayi yerine isabet. Eski filtre (sKey >= 0.15 || sSim >= 0.20) 5'ten az
 * makale gecerse TUM filtreyi kaldiriyordu, yani tam da az sonuclu aramalarda
 * konu disi sonuclari iceri aliyordu.
 *
 * Tam eslesen hic yoksa sayfa bos kalmasin diye en az bir kelimesi gecenler
 * gosterilir ve `level: 'partial'` olarak isaretlenir; hic kelimesi gecmeyen
 * hicbir zaman gosterilmez.
 *
 * @returns {{items: Array, level: 'full'|'partial'|'none', dropped: number}}
 */
export function relevanceGate(items) {
  const list = items || [];
  const measurable = list.filter((i) => typeof i.queryTokenCount === 'number');
  if (measurable.length !== list.length || list.length === 0) {
    return { items: list, level: 'none', dropped: 0 };
  }
  // Sorgunun AND yapisi biliniyorsa (search.js clausesSatisfied) o kullanilir;
  // bilinmiyorsa toplam kelime sayisi kurali.
  const full = list.filter((i) => (typeof i.clausesSatisfied === 'boolean'
    ? i.clausesSatisfied
    : i.queryMatched >= requiredMatches(i.queryTokenCount)));
  if (full.length > 0) return { items: full, level: 'full', dropped: list.length - full.length };
  const partial = list.filter((i) => i.queryMatched > 0);
  return { items: partial, level: 'partial', dropped: list.length - partial.length };
}

export function calculateRelevanceScore(result, userQuery, expandedQueries = []) {
  let score = 0;
  const title = (result.title || '').toLowerCase();
  const abstract = (result.abstract || '').toLowerCase();
  const query = (userQuery || '').toLowerCase();
  const tokens = query.split(/\s+/).filter(t => t.length > 2 && t !== 'or' && t !== 'and');

  // Kelime eşleşmesi token sınırına saygı duymalı: alt-dize karşılaştırması
  // "act" sorgusunu "reactor"/"reaction" icinde de eşleştiriyordu.
  const titleTokens = toTokenSet(title);
  const abstractTokens = toTokenSet(abstract);

  // Title Match
  if (title.includes(query)) score += 3.0; // Exact phrase match in title
  else {
    let titleMatches = 0;
    for (const t of tokens) if (titleTokens.has(t)) titleMatches++;
    if (tokens.length > 0) score += (titleMatches / tokens.length) * 2.0;
  }

  // Abstract Match
  if (abstract) {
    if (abstract.includes(query)) score += 1.5; // Exact phrase match
    let absMatches = 0;
    for (const t of tokens) if (abstractTokens.has(t)) absMatches++;
    if (tokens.length > 0) score += (absMatches / tokens.length) * 1.0;
    
    // Very short abstract penalty
    if (abstract.length < 100) score -= 0.5;
  } else {
    // No abstract penalty
    score -= 2.0;
  }

  // Expanded queries match
  if (expandedQueries.length > 0) {
    let expMatches = 0;
    for (const exp of expandedQueries) {
      const expLow = exp.toLowerCase();
      if (title.includes(expLow) || abstract.includes(expLow)) expMatches++;
    }
    score += (expMatches / expandedQueries.length) * 0.5;
  }

  // Year heuristics (slight advantage to newer, penalty to very old)
  if (result.year) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - result.year;
    if (age <= 3) score += 0.3;
    if (age > 15) score -= 0.5;
  }

  return Math.max(0, parseFloat(score.toFixed(3)));
}

export function selectFinalResults(results, limit = 25) {
  if (!results || results.length === 0) {
    console.log('[SelectFinal] WARN: Input results array is empty!');
    return { finalResults: [], sourceDistribution: {}, lowestScore: 0 };
  }

  // Sort by relevance score descending
  const sorted = [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);
  console.log(`[SelectFinal] Input: ${sorted.length} results, top score: ${sorted[0]?.relevanceScore}, limit: ${limit}`);

  const finalResults = [];
  const sourceCount = {};

  // Soft Source Diversity: max 60% from one source
  const maxPerSource = Math.max(1, Math.ceil(limit * 0.6));

  // First Pass: Fill with soft diversity
  const remaining = [];
  for (const item of sorted) {
    if (finalResults.length >= limit) break;
    const primarySource = (item.sourceList && item.sourceList[0]) || item.source || 'Unknown';
    sourceCount[primarySource] = sourceCount[primarySource] || 0;

    if (sourceCount[primarySource] < maxPerSource) {
      finalResults.push(item);
      sourceCount[primarySource]++;
    } else {
      remaining.push(item);
    }
  }

  // Second Pass: Fill remaining slots regardless of source
  for (const item of remaining) {
    if (finalResults.length >= limit) break;
    finalResults.push(item);
    const primarySource = (item.sourceList && item.sourceList[0]) || item.source || 'Unknown';
    sourceCount[primarySource] = (sourceCount[primarySource] || 0) + 1;
  }

  const lowestScore = finalResults.length > 0
    ? finalResults[finalResults.length - 1].relevanceScore
    : 0;

  console.log(`[SelectFinal] Output: ${finalResults.length} results`);
  console.log(`[SelectFinal] First 3: ${finalResults.slice(0,3).map(r => `"${(r.title||'').slice(0,35)}" (${r.relevanceScore})`).join(' | ')}`);

  return { finalResults, sourceDistribution: sourceCount, lowestScore };
}
