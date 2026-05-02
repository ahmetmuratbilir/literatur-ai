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
import { batchTranslateTeasers } from '../utils/translation.js';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'natural';
import SearchCache from '../models/SearchCache.js';

const { WordTokenizer } = pkg;
const tokenizer = new WordTokenizer();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function recomputeKeyCount(item, queryTokens) {
  let keyCount = 0;
  if (item.title) {
    const titleTokens = tokenizer.tokenize(String(item.title).toLowerCase()) || [];
    titleTokens.forEach(t => { if (queryTokens.includes(t)) keyCount += 3; });
  }
  if (item.description) {
    const descTokens = tokenizer.tokenize(String(item.description).toLowerCase()) || [];
    descTokens.forEach(t => { if (queryTokens.includes(t)) keyCount += 1; });
  }
  return keyCount;
}

export async function searchAll(params, queryContext, scopusQuery, booleanQuery) {
  const startTime = performance.now();
  console.log(`\n--- Yeni Arama Başlatıldı: "${queryContext}" ---`);
  
  // --- Önbellek Kontrolü (Smart Cache) ---
  try {
    const cached = await SearchCache.findOne({ query: queryContext });
    if (cached) {
      console.log(`[Cache] Önbellek bulundu: "${queryContext}". Hızlı yükleme yapılıyor...`);
      cached.searchCount += 1;
      await cached.save();
      
      const endTime = performance.now();
      return {
        ...cached.toObject(),
        searchTime: ((endTime - startTime) / 1000).toFixed(2),
        isCached: true
      };
    }
  } catch (cacheError) {
    console.error('[Cache] Hata:', cacheError.message);
  }

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
    console.error('Scopus isteği başarısız oldu:', scopusResult.reason);
    failedSources.push('Scopus');
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
    console.error('OpenAlex isteği başarısız oldu:', openAlexResult.reason);
    failedSources.push('OpenAlex');
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
    console.error('CORE isteği başarısız oldu:', coreResult.reason);
    failedSources.push('CORE');
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
    console.error('Crossref isteği başarısız oldu:', crossrefResult.reason);
    failedSources.push('Crossref');
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
    console.error('Semantic Scholar isteği başarısız oldu:', s2Result.reason);
    failedSources.push('SemanticScholar');
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
    console.error('ArXiv isteği başarısız oldu:', arxivResult.reason);
    failedSources.push('ArXiv');
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
    console.error('DOAJ isteği başarısız oldu:', doajResult.reason);
    failedSources.push('DOAJ');
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
       
       // dataUtils.js kullanarak veriyi temizle ve normalize et
       const cleanData = normalizeAndClean(exData).map(r => ({ ...r, source: 'Demo Havuzu' }));
       const rankedData = await calculateAHP(cleanData, null);
       
       // İlk 25 için Türkçe çeviri
       const finalResults = await batchTranslateTeasers(rankedData.slice(0, displayCount));

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

  const uniqueResultsMap = new Map();
  for (const item of allResults) {
      let key = '';
      if (item.doi && String(item.doi).trim().length > 5) {
          let doiStr = String(item.doi).trim().toLowerCase();
          doiStr = doiStr.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
          key = `doi:${doiStr}`;
      } else {
          const url = item.url != null ? String(item.url).trim() : '';
          const titleSlug = (item.title || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/\p{M}/gu, '')
            .replace(/[^\p{L}\p{N}]+/gu, '');
          const urlIsValid = url.startsWith('http') && url.length > 10;
          key = urlIsValid ? url : (titleSlug || String(item.id ?? '').trim());
      }

      if (key && !uniqueResultsMap.has(key)) {
          uniqueResultsMap.set(key, item);
      }
  }
  
  const uniqueCleanData = Array.from(uniqueResultsMap.values());

  const queryTokens = (tokenizer.tokenize(String(queryContext || '').toLowerCase()) || [])
    .filter(t => t && t.length > 2 && t !== 'or' && t !== 'and');
  if (queryTokens.length > 0) {
    for (const item of uniqueCleanData) {
      if (!item.keyCount || item.keyCount === 0) {
        item.keyCount = recomputeKeyCount(item, queryTokens);
      }
    }
  }

  const totalFoundBeforeAHP = uniqueCleanData.length;

  console.log('OpenCitations ile benzersiz kayıtlar doğrulanıyor...');
  const enrichStart = performance.now();
  const enrichedResults = await enrichWithCitations(uniqueCleanData);
  const enrichEnd = performance.now();
  console.log(`OpenCitations Doğrulama Süresi: ${((enrichEnd - enrichStart) / 1000).toFixed(2)} sn`);
  const openCitationVerifiedCount = enrichedResults.filter(r => r.openCitationVerified).length;

  console.log(`${totalFoundBeforeAHP} benzersiz öğe için AHP skorları hesaplanıyor...`);
  const rankedData = await calculateAHP(enrichedResults, null);
  console.log('AHP tamamlandı.');

  // --- Otomatik Türkçe Çeviri (Top 25) ---
  console.log('Top 25 sonuç için Türkçe özetler hazırlanıyor...');
  const finalResults = await batchTranslateTeasers(rankedData.slice(0, 25));
  console.log('Çeviri tamamlandı.');

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
    results: finalResults,
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

  try {
    const newCache = new SearchCache({
      query: queryContext,
      results: responseData.results,
      totalFound: responseData.totalFound,
      analyzedCount: responseData.analyzedCount,
      sourceBreakdown: responseData.sourceBreakdown,
      totalFromAPIs: responseData.totalFromAPIs
    });
    await newCache.save();
    console.log(`[Cache] Yeni arama önbelleğe kaydedildi: "${queryContext}"`);
  } catch (saveError) {
    console.warn('[Cache] Kayıt hatası:', saveError.message);
  }

  return responseData;
}
