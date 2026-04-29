import { searchLiterature } from './elsevier.js';
import { searchOpenAlex } from './openalex.js';
import { searchCore } from './core.js';
import { calculateAHP } from './ahp.js';
import { normalizeData } from '../utils/normalization.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function searchAll(params, queryContext, scopusQuery, booleanQuery) {
  const { count } = params;
  const displayCount = count || 25;

  // Her API'den kullanıcının istediği kadar çek (25 gibi).
  // Toplam sayıları (224k) API'nin döndürdüğü meta'dan okuyacağız, hepsini çekmiyoruz.
  const [scopusResult, openAlexResult, coreResult] = await Promise.allSettled([
    searchLiterature(scopusQuery, displayCount, null, queryContext),
    searchOpenAlex(queryContext, params, booleanQuery),
    searchCore(queryContext, params, booleanQuery)
  ]);

  let allResults = [];
  let scopusQuota = null;
  let openAlexQuota = null;
  let coreQuota = null;
  const failedSources = [];

  // Her kaynak i\u00e7in: ka\u00e7 sonu\u00e7 \u00e7ektik + API'nin ger\u00e7ek toplam\u0131
  const sourceBreakdown = { scopus: 0, openalex: 0, core: 0 };
  const totalFromAPIs   = { scopus: 0, openalex: 0, core: 0 };

  // --- Scopus ---
  if (scopusResult.status === 'fulfilled' && scopusResult.value) {
    const val = scopusResult.value;
    if (val.results?.length) {
      allResults = [...allResults, ...val.results];
      sourceBreakdown.scopus = val.results.length;
    }
    totalFromAPIs.scopus = val.totalFound || 0; // 224.000 gibi
    if (val.quotaInfo) scopusQuota = val.quotaInfo;
  } else {
    console.error('Scopus iste\u011fi ba\u015far\u0131s\u0131z oldu:', scopusResult.reason);
    failedSources.push('Scopus');
  }

  // --- OpenAlex ---
  if (openAlexResult.status === 'fulfilled' && openAlexResult.value) {
    const val = openAlexResult.value;
    if (val.results?.length) {
      allResults = [...allResults, ...val.results];
      sourceBreakdown.openalex = val.results.length;
    }
    totalFromAPIs.openalex = val.totalFound || 0;
    if (val.quotaInfo) openAlexQuota = val.quotaInfo;
  } else {
    console.error('OpenAlex iste\u011fi ba\u015far\u0131s\u0131z oldu:', openAlexResult.reason);
    failedSources.push('OpenAlex');
  }

  // --- CORE ---
  if (coreResult.status === 'fulfilled' && coreResult.value) {
    const val = coreResult.value;
    if (val.results?.length) {
      allResults = [...allResults, ...val.results];
      sourceBreakdown.core = val.results.length;
    }
    totalFromAPIs.core = val.totalFound || 0;
    if (val.quotaInfo) coreQuota = val.quotaInfo;
  } else {
    console.error('CORE iste\u011fi ba\u015far\u0131s\u0131z oldu:', coreResult.reason);
    failedSources.push('CORE');
  }

  console.log(`Kaynak da\u011f\u0131l\u0131m\u0131: Scopus=${sourceBreakdown.scopus}, OpenAlex=${sourceBreakdown.openalex}, CORE=${sourceBreakdown.core}`);
  console.log(`API toplam havuzlar\u0131: Scopus=${totalFromAPIs.scopus.toLocaleString()}, OpenAlex=${totalFromAPIs.openalex.toLocaleString()}, CORE=${totalFromAPIs.core.toLocaleString()}`);

  // E\u011fer hepsi \u00e7\u00f6kt\u00fcyse Demo moduna ge\u00e7
  if (allResults.length === 0) {
     console.log('--- KOTA DOLU VEYA API HATASI: DEMO MODUNA GE\u00c7\u0130L\u0130YOR ---');
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
         throw new Error('Demo verisi bo\u015f veya ge\u00e7ersiz formatta.');
       }

       console.log(`Demo modu aktif: ${exData.length} yerel kay\u0131t y\u00fcklendi.`);
       
       const cleanData = await normalizeData(exData, queryContext);
       const rankedData = await calculateAHP(cleanData, null);

       return {
         totalFound: exData.length,
         analyzedCount: rankedData.length,
         results: rankedData.slice(0, displayCount),
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
       console.error('Demo verisi y\u00fcklenirken hata:', fileError);
       throw new Error('Hi\u00e7bir kaynaktan veri al\u0131namad\u0131 ve demo verisi y\u00fcklenemedi.');
     }
  }

  // Sonuçları birleştirirken mükerrer kayıtları temizle (Deduplication)
  const uniqueResultsMap = new Map();
  for (const item of allResults) {
      let key = '';
      if (item.doi && String(item.doi).trim().length > 5) {
          // Eğer DOI varsa kesinlikle benzersiz anahtar olarak onu kullan
          let doiStr = String(item.doi).trim().toLowerCase();
          // doi.org/ kısmını temizleyip sadece ham DOI'yi alabiliriz (opsiyonel ama güvenli)
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
  const totalFoundBeforeAHP = uniqueCleanData.length;

  console.log(`${totalFoundBeforeAHP} benzersiz \u00f6\u011fe i\u00e7in AHP skorlar\u0131 hesaplan\u0131yor...`);
  const rankedData = await calculateAHP(uniqueCleanData, null);
  console.log('AHP tamamland\u0131.');

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

  return {
    totalFound: totalFoundBeforeAHP,          // unique after dedup
    analyzedCount: rankedData.length,
    results: rankedData.slice(0, displayCount),
    sourceBreakdown,   // her kaynaktan ka\u00e7 kay\u0131t \u00e7ekildi
    totalFromAPIs,     // her API'nin ger\u00e7ek toplam havuzu (224k gibi)
    failedSources,     // hata veren kaynaklar
    quota: {
        scopus:   { limit: scopusQuota?.limit,   remaining: scopusQuota?.remaining,   reset: formatResetDate(scopusQuota)   },
        openalex: { limit: openAlexQuota?.limit, remaining: openAlexQuota?.remaining, reset: formatResetDate(openAlexQuota) },
        core:     { limit: coreQuota?.limit,     remaining: coreQuota?.remaining,     reset: formatResetDate(coreQuota)     }
    }
  };
}

