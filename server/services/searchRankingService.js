import pkg from 'natural';
import { enrichPaperRanking } from './journalRankingService.js';
import { mergeDateMetadata } from '../utils/dateNormalization.js';
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
  const existingCited = Number.parseInt(existing.citedBy ?? existing.citedbyCount, 10) || 0;
  const incomingCited = Number.parseInt(incoming.citedBy ?? incoming.citedbyCount, 10) || 0;
  if (incomingCited > existingCited) {
    existing.citedBy = incomingCited;
    existing.citedbyCount = incomingCited;
  }

  // Eksik kalan tanımlayıcıları tamamla (varsa üzerine yazma).
  for (const field of ['doi', 'url', 'publicationName', 'authors', 'pubType']) {
    if (!existing[field] && incoming[field]) {
      existing[field] = incoming[field];
    }
  }

  // Dergi sıralaması yalnızca bazı kaynaklarda çözülebiliyor.
  if (!existing.quartile && incoming.quartile) existing.quartile = incoming.quartile;
  if (!existing.sjr && incoming.sjr) existing.sjr = incoming.sjr;
  if (!existing.sourceType && incoming.sourceType) existing.sourceType = incoming.sourceType;

  if (!existing.openAccess && incoming.openAccess) existing.openAccess = incoming.openAccess;

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
    sourceList: [result.source || 'Unknown']
  };
  return enrichPaperRanking(normalized);
}

export function deduplicateResults(results) {
  const uniqueMap = new Map();

  // DOI ve başlık ayrı birer alias indeksinde tutuluyor. Önceki sürüm DOI
  // anahtarını hesaplayıp hemen ardından `title:` ile eziyordu; bu yüzden
  // DOI'li hiçbir kayıt `doi:` anahtarıyla saklanmıyor ve aynı DOI ikinci kez
  // geldiğinde bulunamıyordu. Aynı makale 4 kaynaktan gelip başlıkları birebir
  // aynı değilse listede 4 kez görünüyordu.
  const doiIndex = new Map();
  const titleEntries = [];

  for (const item of results) {
    const doi = normalizeDoi(item.doi);
    const titleClean = normalizeTitleForComparison(item.title);

    // 1. DOI kesin eşleşme
    if (doi && doiIndex.has(doi)) {
      mergeDuplicateResult(uniqueMap.get(doiIndex.get(doi)), item);
      continue;
    }

    // 2. Başlık benzerliği
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
        // Bu kayıt DOI taşıyorsa, aynı DOI'nin sonraki kopyaları da bulunabilsin.
        if (doi && !doiIndex.has(doi)) doiIndex.set(doi, matchedKey);
        continue;
      }
    }

    // 3. Yeni kayıt
    let key;
    if (doi) key = `doi:${doi}`;
    else if (titleClean.length > 10) key = `title:${titleClean}`;
    else key = `id:${item.id || `${uniqueMap.size}-${titleClean}`}`;

    uniqueMap.set(key, item);
    if (doi) doiIndex.set(doi, key);
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
      .normalize('NFKD')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 2)
  );
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
