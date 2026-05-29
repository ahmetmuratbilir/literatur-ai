import { searchLiterature } from './elsevier.js';
import { searchOpenAlex } from './openalex.js';
import { searchCore } from './core.js';
import { searchCrossref } from './crossref.js';
import { searchSemanticScholar } from './semanticscholar.js';
import { searchArXiv } from './arxiv.js';
import { searchDOAJ } from './doaj.js';
import { enrichWithCitations } from './opencitations.js';
import { calculateAHP } from './ahp.js';
import { normalizeData } from '../utils/normalization.js';
import { normalizeAndClean } from '../utils/dataUtils.js';
import { enrichPaperRanking } from './journalRankingService.js';
import { batchTranslateAcademic } from '../utils/translation.js';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'natural';
import {
  normalizeSearchResult,
  deduplicateResults,
  calculateRelevanceScore,
  applyHardFilter,
  selectFinalResults
} from './searchRankingService.js';

const { WordTokenizer } = pkg;
const tokenizer = new WordTokenizer();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function recomputeKeyCount(item, queryTokens, fullQuery) {
  let keyCount = 0;
  const title = String(item.title || '').toLowerCase();
  const description = String(item.description || '').toLowerCase();

  // 1. Keyword Relevance (Exact matches)
  if (title) {
    const titleTokens = tokenizer.tokenize(title) || [];
    titleTokens.forEach(t => { if (queryTokens.includes(t)) keyCount += 3; });
  }
  if (description) {
    const descTokens = tokenizer.tokenize(description) || [];
    descTokens.forEach(t => { if (queryTokens.includes(t)) keyCount += 1; });
  }

  // 2. Expanded Query Similarity (Dice Coefficient)
  // fullQuery contains the expanded context from LLM
  const diceTitle = pkg.DiceCoefficient(fullQuery.toLowerCase(), title);
  const diceDesc = description ? pkg.DiceCoefficient(fullQuery.toLowerCase(), description) : 0;
  
  // Combine title (weight 0.7) and description (weight 0.3) for similarity
  const expandedSimilarity = (diceTitle * 0.7) + (diceDesc * 0.3);

  return { keyCount, expandedSimilarity };
}

export async function searchAll(params, queryContext, scopusQuery, booleanQuery) {
  const startTime = performance.now();

  const { count } = params;
  const displayCount = count || 25;

  const [scopusResult, openAlexResult, coreResult, crossrefResult, s2Result, arxivResult, doajResult] = await Promise.allSettled([
    searchLiterature(scopusQuery, displayCount, null, queryContext),
    searchOpenAlex(queryContext, params, booleanQuery),
    searchCore(queryContext, params, booleanQuery),
    searchCrossref(queryContext, displayCount),
    searchSemanticScholar(queryContext, displayCount),
    searchArXiv(queryContext, displayCount),
    searchDOAJ(queryContext, displayCount)
  ]);

  const categorizeError = (reason) => {
    const msg = (reason?.message || '').toLowerCase();
    if (
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('auth') ||
      msg.includes('unauthorized') ||
      msg.includes('yetkisiz') ||
      msg.includes('invalid api key') ||
      msg.includes('insttoken') ||
      msg.includes('credential') ||
      msg.includes('access')
    ) return 'CREDENTIAL_ACCESS';
    if (reason?.name === 'AbortError' || msg.includes('timeout') || msg.includes('zaman aşımı')) return 'TIMEOUT';
    if (msg.includes('429') || msg.includes('quota') || msg.includes('kota') || msg.includes('limit')) return 'QUOTA';
    return 'ERROR';
  };

  let allResults = [];
  let scopusQuota = null;
  let openAlexQuota = null;
  let coreQuota = null;
  const failedSources = [];

  const sourceBreakdown = { scopus: 0, openalex: 0, core: 0, crossref: 0, s2: 0, arxiv: 0, doaj: 0 };
  const totalFromAPIs   = { scopus: 0, openalex: 0, core: 0, crossref: 0, s2: 0, arxiv: 0, doaj: 0 };

  // --- Scopus ---
  if (scopusResult.status === 'fulfilled' && scopusResult.value) {
    const val = scopusResult.value;
    if (val.results?.length) {
      const resultsWithSource = val.results.map(r => ({ ...r, source: 'Scopus' }));
      allResults = [...allResults, ...resultsWithSource];
      sourceBreakdown.scopus = val.results.length;
    }
    totalFromAPIs.scopus = val.totalFound || 0;
    if (val.quotaInfo) scopusQuota = val.quotaInfo;
  } else {
    console.error('Scopus isteği başarısız oldu:', scopusResult.reason?.message);
    failedSources.push({ name: 'Scopus', type: categorizeError(scopusResult.reason), message: scopusResult.reason?.message });
  }

  // --- OpenAlex ---
  if (openAlexResult.status === 'fulfilled' && openAlexResult.value) {
    const val = openAlexResult.value;
    if (val.results?.length) {
      const resultsWithSource = val.results.map(r => ({ ...r, source: 'OpenAlex' }));
      allResults = [...allResults, ...resultsWithSource];
      sourceBreakdown.openalex = val.results.length;
    }
    totalFromAPIs.openalex = val.totalFound || 0;
    if (val.quotaInfo) openAlexQuota = val.quotaInfo;
  } else {
    console.error('OpenAlex isteği başarısız oldu:', openAlexResult.reason?.message);
    failedSources.push({ name: 'OpenAlex', type: categorizeError(openAlexResult.reason), message: openAlexResult.reason?.message });
  }

  // --- CORE ---
  if (coreResult.status === 'fulfilled' && coreResult.value) {
    const val = coreResult.value;
    if (val.results?.length) {
      const resultsWithSource = val.results.map(r => ({ ...r, source: 'CORE' }));
      allResults = [...allResults, ...resultsWithSource];
      sourceBreakdown.core = val.results.length;
    }
    totalFromAPIs.core = val.totalFound || 0;
    if (val.quotaInfo) coreQuota = val.quotaInfo;
  } else {
    console.error('CORE isteği başarısız oldu:', coreResult.reason?.message);
    failedSources.push({ name: 'CORE', type: categorizeError(coreResult.reason), message: coreResult.reason?.message });
  }

  // --- Crossref ---
  if (crossrefResult.status === 'fulfilled' && crossrefResult.value) {
    const val = crossrefResult.value;
    if (val.results?.length) {
      const resultsWithSource = val.results.map(r => ({ ...r, source: 'Crossref' }));
      allResults = [...allResults, ...resultsWithSource];
      sourceBreakdown.crossref = val.results.length;
    }
    totalFromAPIs.crossref = val.totalFound || 0; 
  } else {
    console.error('Crossref isteği başarısız oldu:', crossrefResult.reason?.message);
    failedSources.push({ name: 'Crossref', type: categorizeError(crossrefResult.reason), message: crossrefResult.reason?.message });
  }

  // --- Semantic Scholar ---
  if (s2Result.status === 'fulfilled' && s2Result.value) {
    const val = s2Result.value;
    if (val.results?.length) {
      const resultsWithSource = val.results.map(r => ({ ...r, source: 'Semantic Scholar' }));
      allResults = [...allResults, ...resultsWithSource];
      sourceBreakdown.s2 = val.results.length;
    }
    totalFromAPIs.s2 = val.totalFound || 0; 
  } else {
    console.error('Semantic Scholar isteği başarısız oldu:', s2Result.reason?.message);
    failedSources.push({ name: 'SemanticScholar', type: categorizeError(s2Result.reason), message: s2Result.reason?.message });
  }

  // --- ArXiv ---
  if (arxivResult.status === 'fulfilled' && arxivResult.value) {
    const val = arxivResult.value;
    if (val.results?.length) {
      const resultsWithSource = val.results.map(r => ({ ...r, source: 'ArXiv' }));
      allResults = [...allResults, ...resultsWithSource];
      sourceBreakdown.arxiv = val.results.length;
    }
    totalFromAPIs.arxiv = val.totalFound || 0; 
  } else {
    console.error('ArXiv isteği başarısız oldu:', arxivResult.reason?.message);
    failedSources.push({ name: 'ArXiv', type: categorizeError(arxivResult.reason), message: arxivResult.reason?.message });
  }

  // --- DOAJ ---
  if (doajResult.status === 'fulfilled' && doajResult.value) {
    const val = doajResult.value;
    if (val.results?.length) {
      const resultsWithSource = val.results.map(r => ({ ...r, source: 'DOAJ' }));
      allResults = [...allResults, ...resultsWithSource];
      sourceBreakdown.doaj = val.results.length;
    }
    totalFromAPIs.doaj = val.totalFound || 0; 
  } else {
    console.error('DOAJ isteği başarısız oldu:', doajResult.reason?.message);
    failedSources.push({ name: 'DOAJ', type: categorizeError(doajResult.reason), message: doajResult.reason?.message });
  }

  const apiFetchTime = performance.now();
  console.log(`API Çekim Süresi: ${((apiFetchTime - startTime) / 1000).toFixed(2)} sn`);

  if (allResults.length === 0) {
     console.log('--- KOTA DOLU VEYA API HATASI: DEMO MODUNA GEÇİLİYOR ---');
     try {
       const rootDir = path.join(__dirname, '../..');
       const primaryPath = path.join(rootDir, 'exdata.json');
       const fallbackPath = path.join(rootDir, 'exdata.sample.json');
       let rawExData;
       try {
         rawExData = await fs.readFile(primaryPath, 'utf-8');
       } catch (e1) {
         if (e1?.code === 'ENOENT') {
           rawExData = await fs.readFile(fallbackPath, 'utf-8');
         } else {
           throw e1;
         }
       }
       const exData = JSON.parse(rawExData);

       if (!Array.isArray(exData) || exData.length === 0) {
         throw new Error('Demo verisi boş veya geçersiz formatta.');
       }

       console.log(`Demo modu aktif: ${exData.length} yerel kayıt yüklendi.`);
       
       const cleanData = normalizeAndClean(exData).map(r => ({ ...r, source: 'Demo Havuzu' }));
       const enrichedCleanData = cleanData.map(enrichPaperRanking);
       const rankedData = await calculateAHP(enrichedCleanData, null);
       const finalResults = await batchTranslateAcademic(rankedData.slice(0, displayCount));

       return {
         totalFound: exData.length,
         analyzedCount: rankedData.length,
         results: finalResults,
         demoMode: true,
         failedSources,
         sourceBreakdown,
         totalFromAPIs,
         quota: { 
             scopus: scopusQuota || { limit: 20000, remaining: 0, reset: 'Bilinmiyor' },
             openalex: openAlexQuota || { limit: 1000, remaining: 0, reset: 'Bilinmiyor' },
             core: coreQuota || { limit: 5000, remaining: 0, reset: 'Bilinmiyor' }
         },
       };
     } catch (fileError) {
       console.error('Demo verisi yüklenirken hata:', fileError);
       throw new Error('Hiçbir kaynaktan veri alınamadı ve demo verisi yüklenemedi.');
     }
  }

  // ==========================================
  // RANKING PIPELINE: searchRankingService.js
  // ==========================================
  const rawPoolCount = allResults.length;
  console.log(`\n[Ranking] 1. Raw Pool Count: ${rawPoolCount}`);

  // 1. Normalize
  let normalizedResults = allResults.map(normalizeSearchResult);

  // FUTURE FILTERING ENGINE: Easily toggleable when filter controls are added to UI
  if (params.filters) {
    if (params.filters.onlyQ1Q2) {
      normalizedResults = normalizedResults.filter(r => r.quartile === 'Q1' || r.quartile === 'Q2');
      console.log(`[FutureFilter] Only Q1/Q2 applied: ${normalizedResults.length} remaining`);
    }
    if (params.filters.excludePreprints) {
      normalizedResults = normalizedResults.filter(r => r.sourceType !== 'Preprint');
      console.log(`[FutureFilter] Exclude Preprints applied: ${normalizedResults.length} remaining`);
    }
    if (params.filters.journalOnly) {
      normalizedResults = normalizedResults.filter(r => r.sourceType === 'Journal');
      console.log(`[FutureFilter] Journal Only applied: ${normalizedResults.length} remaining`);
    }
  }

  // 2. Deduplicate
  const uniqueResults = deduplicateResults(normalizedResults);
  const deduplicatedCount = uniqueResults.length;
  console.log(`[Ranking] 2. Deduplicate Sonrası: ${deduplicatedCount} (Elenen: ${rawPoolCount - deduplicatedCount})`);

  const cleanQuery = `${params.mainTopic || ''} ${queryContext || ''}`.trim();
  const queryTokens = cleanQuery.toLowerCase()
    .replace(/[()"]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && t !== 'or' && t !== 'and' && t !== 'title' && t !== 'key' && t !== 'abs');

  const expandedQueries = queryContext
    ? queryContext.split(' ').filter(x => x.length > 2)
    : [];

  uniqueResults.forEach(r => {
    const title = (r.title || '').toLowerCase();
    const desc  = (r.abstract || r.description || '').toLowerCase();

    // keyCount (AHP için)
    let keyCount = 0;
    for (const t of queryTokens) {
      if (title.includes(t)) keyCount += 3;
      if (desc.includes(t))  keyCount += 1;
    }
    r.keyCount = keyCount;

    // expandedSimilarity (AHP için)
    const titleTokens = new Set(title.split(/\s+/).filter(x => x.length > 2));
    const querySet    = new Set(queryTokens);
    const intersection = [...querySet].filter(x => titleTokens.has(x)).length;
    r.expandedSimilarity = querySet.size > 0 ? intersection / querySet.size : 0;

    // relevanceScore (ranking için)
    r.relevanceScore = calculateRelevanceScore(r, cleanQuery, expandedQueries);
  });

  console.log(`[Ranking] 3. Scoring tamamlandı. Örnek scores:`,
    uniqueResults.slice(0, 3).map(r => `"${(r.title||'').slice(0,30)}" keyCount=${r.keyCount} relScore=${r.relevanceScore}`)
  );

  // 4. Ranking pipeline çıktısını AHP'ye ver (hard filter YOK - AHP filtreler)
  // selectFinalResults sadece soft diversity + limit uygular
  const { finalResults: rankedFinalResults, sourceDistribution, lowestScore } = selectFinalResults(uniqueResults, displayCount);
  console.log(`[Ranking] 4. Ranking Sonrası: ${rankedFinalResults.length} (Limit: ${displayCount})`);
  console.log(`[Ranking] 5. Kaynak Dağılımı:`, sourceDistribution);
  console.log(`[Ranking] 6. En Düşük Relevance Score: ${lowestScore}\n`);

  // ==========================================
  // ENRICHMENT & AHP
  // ==========================================
  const totalFoundBeforeAHP = deduplicatedCount;
  console.log(`[AHP] ${rankedFinalResults.length} makale AHP pipeline'a giriyor...`);

  console.log('OpenCitations ile benzersiz kayıtlar doğrulanıyor...');
  const enrichStart = performance.now();
  const enrichedResults = await enrichWithCitations(rankedFinalResults);
  const enrichEnd = performance.now();
  console.log(`OpenCitations Doğrulama Süresi: ${((enrichEnd - enrichStart) / 1000).toFixed(2)} sn`);
  const openCitationVerifiedCount = enrichedResults.filter(r => r.openCitationVerified).length;

  console.log(`${rankedFinalResults.length} öğe için AHP skorları hesaplanıyor...`);
  const rankedData = await calculateAHP(enrichedResults, null);
  console.log('AHP tamamlandı.');

  // --- Otomatik Akademik Türkçe Çeviri (Top 25 Başlık + Top 10 Özet) ---
  console.log('Akademik Türkçe çeviriler hazırlanıyor...');
  const translatedResults = await batchTranslateAcademic(rankedData);
  console.log('Çeviri tamamlandı.');

  // ==========================================
  // RESPONSE DEBUG & SAFETY FALLBACK
  // ==========================================
  console.log(`[ResponseDebug] rankedData.length       = ${rankedData?.length}`);
  console.log(`[ResponseDebug] translatedResults.length = ${translatedResults?.length}`);
  console.log(`[ResponseDebug] First 3 titles:`, (translatedResults || []).slice(0,3).map(r => `"${(r?.titleTR || r?.title || '').slice(0,40)}"`));

  // Safe fallback: if translation returned empty but AHP results exist, use them directly
  let finalResults = translatedResults;
  if ((!finalResults || finalResults.length === 0) && rankedData?.length > 0) {
    console.log('[SearchResponseFallback] final results empty, using AHP scored results');
    finalResults = rankedData.slice(0, displayCount);
  }
  // Ultimate fallback: if still empty, use raw enriched results
  if ((!finalResults || finalResults.length === 0) && enrichedResults?.length > 0) {
    console.log('[SearchResponseFallback] AHP results also empty, using raw enriched results');
    finalResults = enrichedResults.slice(0, displayCount);
  }

  console.log(`[ResponseDebug] FINAL results.length going to frontend = ${finalResults?.length}`);

  const formatResetDate = (quotaObj) => {
      if (!quotaObj || !quotaObj.reset) return 'Bilinmiyor';
      let resetValue = Number.parseInt(quotaObj.reset, 10);
      if (isNaN(resetValue)) return 'Bilinmiyor';
      if (resetValue < 1000000) {
          const resetTime = new Date(Date.now() + resetValue * 1000);
          return resetTime.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
      const resetTime = resetValue < 10000000000 ? resetValue * 1000 : resetValue;
      return new Date(resetTime).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
  };

  const endTime = performance.now();
  const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`Toplam Arama Süresi: ${totalDuration} sn\n`);

  const totalPoolSum = Object.values(totalFromAPIs).reduce((a, b) => a + (b || 0), 0);
  const responseData = {
    totalFound: totalPoolSum,
    analyzedCount: totalFoundBeforeAHP,
    results: finalResults || [],
    searchTime: totalDuration,
    failedSources,
    sourceBreakdown,
    totalFromAPIs,
    opencitations: { verified: openCitationVerifiedCount || 0 },
    quota: {
        scopus:   { limit: scopusQuota?.limit,   remaining: scopusQuota?.remaining,   reset: formatResetDate(scopusQuota)   },
        openalex: { limit: openAlexQuota?.limit, remaining: openAlexQuota?.remaining, reset: formatResetDate(openAlexQuota) },
        core:     { limit: coreQuota?.limit,     remaining: coreQuota?.remaining,     reset: formatResetDate(coreQuota)     },
        crossref: { limit: 'Sınırsız', remaining: 'Sınırsız', reset: 'N/A' },
        s2:       { limit: '60/dk', remaining: '60/dk', reset: 'N/A' },
        arxiv:    { limit: '20/dk', remaining: '20/dk', reset: 'N/A' },
        doaj:     { limit: '120/dk', remaining: '120/dk', reset: 'N/A' },
        opencitations: { verified: openCitationVerifiedCount || 0 }
    }
  };

  return responseData;
}
