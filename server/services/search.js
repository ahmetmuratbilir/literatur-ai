import { searchLiterature } from './elsevier.js';
import { searchOpenAlex } from './openalex.js';
import { searchCore } from './core.js';
import { searchCrossref } from './crossref.js';
import { searchSemanticScholar } from './semanticscholar.js';
import { searchArXiv } from './arxiv.js';
import { searchDOAJ } from './doaj.js';
import { searchEuropePMC } from './europepmc.js';
import { searchOpenAIRE } from './openaire.js';
import { searchDataCite } from './datacite.js';
import { searchPubMed } from './pubmed.js';
import { sourceBreaker } from './sourceBreaker.js';
import { findOpenAccessCopy } from './unpaywall.js';
import { enrichWithCitations } from './opencitations.js';

import { recordSearch } from './sourceZeroTracker.js';
import { calculateAHP, getWeightingMethodology } from './ahp.js';
import { rankWithFirstPageRetractions } from './rankingPipeline.js';
import { normalizeAndClean } from '../utils/dataUtils.js';
import { enrichPaperRanking } from './journalRankingService.js';
import { batchTranslateAcademic } from '../utils/translation.js';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizeSearchResult,
  deduplicateResults,
  calculateRelevanceScore,
  selectFinalResults,
  toTokenSet,
  STOPWORDS,
  relevanceGate,
  requiredMatches
} from './searchRankingService.js';
import { buildSourceQueries, scoringInput, forTurkishSources } from './sourceQuery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * AHP'nin keyword ve similarity kriterleri için skor üretir.
 *
 * Token kümesi üzerinden çalışır: önceki alt-dize karşılaştırması ("act"
 * token'ı "reactor" içinde eşleşiyordu) keyCount'u sistematik olarak şişirip
 * AHP'nin %20 ağırlıklı keyword kriterini bozuyordu.
 */
function computeKeywordScores(item, queryTokens, clauseTokens = null) {
  const titleTokens = toTokenSet(item.title);
  const descTokens = toTokenSet(item.abstract || item.description);

  let keyCount = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) keyCount += 3;
    if (descTokens.has(token)) keyCount += 1;
  }

  const querySet = new Set(queryTokens);
  let intersection = 0;
  for (const token of querySet) {
    if (titleTokens.has(token)) intersection++;
  }
  const expandedSimilarity = querySet.size > 0 ? intersection / querySet.size : 0;

  // Alaka esigi icin: kac farkli sorgu kelimesi baslik VEYA ozette geciyor.
  let queryMatched = 0;
  for (const token of querySet) {
    if (titleTokens.has(token) || descTokens.has(token)) queryMatched++;
  }

  // Sorgunun AND yapisi: her gruptan en az bir alternatif karsilanmali.
  // Alternatif, kelimelerinin yeterincesi (requiredMatches) geciyorsa karsilanir.
  let clausesSatisfied;
  if (Array.isArray(clauseTokens) && clauseTokens.length > 0) {
    const has = (t) => titleTokens.has(t) || descTokens.has(t);
    clausesSatisfied = clauseTokens.every((alternatives) =>
      alternatives.some((alt) => alt.filter(has).length >= requiredMatches(alt.length))
    );
  }

  return { keyCount, expandedSimilarity, queryMatched, queryTokenCount: querySet.size, clausesSatisfied };
}

/**
 * Kaynak hatasini siniflandirir. Test edilebilir olmasi icin modul seviyesinde.
 */
export function classifySourceError(reason) {
  const msg = (reason?.message || '').toLowerCase();
  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('auth') ||
    msg.includes('unauthorized') ||
    msg.includes('yetkisiz') ||
    msg.includes('invalid api key') ||
    // Scopus'un gercek metni: "The provided apiKey is invalid." (bosluksuz)
    msg.includes('apikey') ||
    msg.includes('api_key') ||
    msg.includes('insttoken') ||
    msg.includes('credential') ||
    msg.includes('access')
  ) return 'CREDENTIAL_ACCESS';
  if (reason?.name === 'AbortError' || msg.includes('timeout') || msg.includes('zaman aşımı')) return 'TIMEOUT';
  if (msg.includes('429') || msg.includes('406') || msg.includes('quota') || msg.includes('kota') || msg.includes('limit')) return 'QUOTA';
  return 'ERROR';
}

/**
 * Scopus varsayilan olarak KAPALI.
 *
 * Anahtar Elsevier kaydinda bulunmuyor (olculen: Scopus ve ScienceDirect
 * uclarinin ikisi de 401 APIKEY_INVALID; kasitli bozuk bir anahtar ayni
 * hatayi veriyor). Aramayi yavaslatmiyor -- kaynaklar Promise.allSettled ile
 * paralel cagriliyor ve elsevier.js 401'de yeniden denemiyor -- ama her
 * aramada kullaniciya bir kimlik hatasi uyarisi gosteriyor ve bu gurultu
 * gercek arizalari maskeliyor. Ticari asamada SCOPUS_ENABLED=true yapilir.
 */
const isScopusEnabled = () => process.env.SCOPUS_ENABLED === 'true';

const SKIPPED = { results: [], totalFound: 0, skipped: true };

/**
 * Kaynagi devre kesiciden gecirerek cagirir (services/sourceBreaker.js).
 * Kesici aciksa kaynak CAGRILMAZ; reddetme mesaji ayni hata turunu tasir ki
 * classifySourceError ve arayuz durumu ayni kalsin. Sonuc kesiciye kaydedilir.
 */
export function guarded(name, fn, breaker = sourceBreaker) {
  const gate = breaker.check(name);
  if (gate.skip) {
    const err = new Error(`${name} gecici olarak atlandi (${gate.reason === 'QUOTA' ? 'quota' : gate.reason === 'TIMEOUT' ? 'timeout' : 'credential'})`);
    err.cooldown = true;
    return Promise.reject(err);
  }
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${name} timeout >${SOURCE_DEADLINE_MS}ms`)), SOURCE_DEADLINE_MS);
  });
  return Promise.race([Promise.resolve().then(fn), deadline])
    .then((value) => { breaker.record(name, null); return value; })
    .catch((error) => { breaker.record(name, classifySourceError(error)); throw error; })
    .finally(() => clearTimeout(timer));
}

// Tek bir yavas kaynak tum aramayi bekletmesin: kaynaklarin kendi zaman
// asimlari 6-10 sn ve S2 yeniden denemeleriyle daha da uzayabiliyordu.
// Yetismeyen kaynak TIMEOUT sayilir (art arda 3 kez -> kesici 2 dk).
export const SOURCE_DEADLINE_MS = 6500;

/** Arama sirasinda yasal PDF'i onceden aranan ilk sonuc sayisi ve toplam bekleme ust siniri. */
export const PREFETCH_PDF_COUNT = 8;
export const PREFETCH_PDF_BUDGET_MS = 2500;

/** Her kaynaktan istenen makale sayisi (gosterilen sayidan bagimsiz). */
export const SOURCE_FETCH_COUNT = 25;

/**
 * @param {object|null} rankingWeights  Kullanicinin profil/ozel agirliklari
 *   (ahpProfiles.resolveRankingWeights ciktisi). null = varsayilan.
 */
export async function searchAll(params, queryContext, scopusQuery, booleanQuery, queryPlan = null, rankingWeights = null, options = {}) {
  // Turkce ceviri istege bagli; varsayilan Ingilizce (kullanici karari).
  const translateEnabled = options.translate === true;
  const startTime = performance.now();

  const { count } = params;
  // Gosterilen (siralanip donen) makale sayisi. Kaynaklardan cekilen miktar
  // bundan BAGIMSIZ: SOURCE_FETCH_COUNT. Eskiden ikisi ayniydi; 100 sonuc
  // gostermek her kaynaktan 100 istemek demekti.
  const displayCount = count || 25;
  const sourceParams = { ...params, count: SOURCE_FETCH_COUNT };

  // Kaynak basina sorgu. Plan yoksa (eski cagrilar, testler) onceki davranisa
  // duseriz; boylece bu degisiklik mevcut cagiranlari bozmuyor.
  const plan = queryPlan && Array.isArray(queryPlan.phrases) && queryPlan.phrases.length > 0
    ? queryPlan
    : null;
  const sq = plan ? buildSourceQueries(plan) : null;

  const doajQuery = sq?.doaj || queryContext;
  const s2Query = sq?.semanticScholar || queryContext;
  const crossrefQuery = sq?.crossref || queryContext;
  const openAlexQuery = sq?.openAlex || booleanQuery;
  // Sorgu Turkce yazildiysa: Turkce eserler ozgun metinle ayrica aranir
  // (OpenAlex language:tr). Ingilizce sorguda null -> ek istek yok.
  const turkishQuery = plan ? forTurkishSources(plan) : null;
  const turkishCount = SOURCE_FETCH_COUNT;
  // arXiv'e Turkce gondermek olculmus bicimde anlamsiz (salt Turkce sorgu 0
  // sonuc, karisik sorguda Turkce terimler havuzu hic degistirmiyor). Ingilizce
  // ifade yoksa kaynak atlanir; hata olarak raporlanmaz.
  const arxivQuery = sq ? sq.arxiv : queryContext;

  if (sq) {
    console.log('[SourceQuery] DOAJ :', doajQuery || '(bos)');
    console.log('[SourceQuery] arXiv:', arxivQuery || '(Ingilizce ifade yok, atlaniyor)');
    console.log('[SourceQuery] S2   :', s2Query || '(bos)');
  }

  const [scopusResult, openAlexResult, coreResult, crossrefResult, s2Result, arxivResult, doajResult, europePmcResult, turkishResult, openAireResult, dataCiteResult, pubmedResult] = await Promise.allSettled([
    isScopusEnabled()
      ? guarded('Scopus', () => searchLiterature(scopusQuery, SOURCE_FETCH_COUNT, null, queryContext))
      : Promise.resolve(SKIPPED),
    guarded('OpenAlex', () => searchOpenAlex(queryContext, sourceParams, openAlexQuery)),
    guarded('CORE', () => searchCore(queryContext, sourceParams, openAlexQuery)),
    guarded('Crossref', () => searchCrossref(crossrefQuery, SOURCE_FETCH_COUNT)),
    guarded('SemanticScholar', () => searchSemanticScholar(s2Query, SOURCE_FETCH_COUNT)),
    arxivQuery ? guarded('ArXiv', () => searchArXiv(arxivQuery, SOURCE_FETCH_COUNT, { fielded: true })) : Promise.resolve(SKIPPED),
    guarded('DOAJ', () => searchDOAJ(doajQuery, SOURCE_FETCH_COUNT)),
    // Europe PMC OpenAlex ile ayni boolean sorgu dilini anliyor.
    guarded('EuropePMC', () => searchEuropePMC(openAlexQuery, SOURCE_FETCH_COUNT)),
    turkishQuery
      ? guarded('OpenAlex', () => searchOpenAlex(turkishQuery, { count: turkishCount }, turkishQuery, { filter: 'language:tr' }))
      : Promise.resolve(SKIPPED),
    // Anahtarsiz, resmi API'ler (1 Eki 2026 eklendi): OpenAIRE kurumsal
    // arsivler ve tezler; DataCite tezler, Zenodo, arsiv kayitlari (yalniz baslikta).
    guarded('OpenAIRE', () => searchOpenAIRE(crossrefQuery, SOURCE_FETCH_COUNT)),
    guarded('DataCite', () => searchDataCite(crossrefQuery, SOURCE_FETCH_COUNT)),
    // PubMed duz metin sorgusu bekliyor; Crossref'e giden sade ifade uygun.
    guarded('PubMed', () => searchPubMed(crossrefQuery, SOURCE_FETCH_COUNT))
  ]);

  const categorizeError = classifySourceError;


  let allResults = [];
  let scopusQuota = null;
  let openAlexQuota = null;
  let coreQuota = null;
  const failedSources = [];

  const sourceBreakdown = { scopus: 0, openalex: 0, core: 0, crossref: 0, s2: 0, arxiv: 0, doaj: 0, europepmc: 0, pubmed: 0, openaire: 0, datacite: 0 };
  const totalFromAPIs   = { scopus: 0, openalex: 0, core: 0, crossref: 0, s2: 0, arxiv: 0, doaj: 0, europepmc: 0, pubmed: 0, openaire: 0, datacite: 0 };

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

  // --- OpenAlex (Turkce eserler, ozgun sorgu) ---
  // Ayri kaynak sayilmiyor: sonuclar OpenAlex olarak siralamaya girer;
  // ayni eser iki aramada da donerse sonraki tekillestirme birlestirir.
  if (turkishQuery) {
    if (turkishResult.status === 'fulfilled' && turkishResult.value?.results?.length) {
      const trResults = turkishResult.value.results.map(r => ({ ...r, source: 'OpenAlex', language: 'tr' }));
      allResults = [...allResults, ...trResults];
      sourceBreakdown.openalex += trResults.length;
      console.log(`[OpenAlex TR] "${turkishQuery}" -> ${trResults.length} Turkce eser`);
    } else if (turkishResult.status === 'rejected') {
      // Ek arama; basarisizligi ana OpenAlex sonucunu dusurmesin.
      console.warn('[OpenAlex TR] basarisiz:', turkishResult.reason?.message);
    }
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

  // --- PubMed ---
  if (pubmedResult.status === 'fulfilled' && pubmedResult.value) {
    const val = pubmedResult.value;
    if (val.results?.length) {
      allResults = [...allResults, ...val.results];
      sourceBreakdown.pubmed = val.results.length;
    }
    totalFromAPIs.pubmed = val.totalFound || 0;
  } else {
    console.error('PubMed isteği başarısız oldu:', pubmedResult.reason?.message);
    failedSources.push({ name: 'PubMed', type: categorizeError(pubmedResult.reason), message: pubmedResult.reason?.message });
  }
  // --- Europe PMC ---
  if (europePmcResult.status === 'fulfilled' && europePmcResult.value) {
    const val = europePmcResult.value;
    if (val.results?.length) {
      allResults = [...allResults, ...val.results];
      sourceBreakdown.europepmc = val.results.length;
    }
    totalFromAPIs.europepmc = val.totalFound || 0;
  } else {
    console.error('Europe PMC isteği başarısız oldu:', europePmcResult.reason?.message);
    failedSources.push({ name: 'EuropePMC', type: categorizeError(europePmcResult.reason), message: europePmcResult.reason?.message });
  }

  // --- OpenAIRE + DataCite ---
  for (const [key, name, result] of [['openaire', 'OpenAIRE', openAireResult], ['datacite', 'DataCite', dataCiteResult]]) {
    if (result.status === 'fulfilled' && result.value) {
      const val = result.value;
      if (val.results?.length) {
        allResults = [...allResults, ...val.results];
        sourceBreakdown[key] = val.results.length;
      }
      totalFromAPIs[key] = val.totalFound || 0;
    } else {
      console.error(`${name} isteği başarısız oldu:`, result.reason?.message);
      failedSources.push({ name, type: categorizeError(result.reason), message: result.reason?.message });
    }
  }

  // --- Sessiz sifir tespiti ---
  //
  // Bir kaynak hata FIRLATMADAN 0 sonuc dondurdugunde failedSources'a girmiyor
  // ve logda hicbir iz birakmiyordu. DOAJ tam olarak boyle bir ay boyunca
  // 0 dondurdu: HTTP 200, `total: 0`, hata yok, kimse gormedi.
  //
  // Buradaki kayit yapilandirilmis: kaynak, sorgunun ilk 80 karakteri, havuz
  // buyuklugu. Havuz > 0 iken cekilen = 0 ise sorun sorguda degil
  // normalizasyondadir; havuz da 0 ise sorgu hic eslesmiyor demektir. Bu ayrim
  // teshiste en cok zaman kazandiran sey.
  const sentQueries = {
    openalex: openAlexQuery, core: openAlexQuery, crossref: crossrefQuery,
    s2: s2Query, arxiv: arxivQuery, doaj: doajQuery, scopus: scopusQuery, europepmc: openAlexQuery,
    openaire: crossrefQuery, datacite: crossrefQuery, pubmed: crossrefQuery,
  };
  const zeroResultSources = [];
  for (const [key, fetched] of Object.entries(sourceBreakdown)) {
    if (fetched > 0) continue;
    if (failedSources.some((f) => f.name.toLowerCase().replace(/\s/g, '') === key.replace('s2', 'semanticscholar'))) continue;
    if (key === 'scopus' && !isScopusEnabled()) continue;
    if (key === 'arxiv' && !arxivQuery) continue;

    const pool = totalFromAPIs[key] || 0;
    zeroResultSources.push({ source: key, pool });
    console.warn(JSON.stringify({
      event: 'SOURCE_ZERO',
      source: key,
      pool,
      query: String(sentQueries[key] ?? '').slice(0, 80),
      // Havuz doluysa kayitlar normalizasyonda dusuyor, sorguda degil.
      hint: pool > 0 ? 'havuz dolu ama hic kayit normalize edilemedi' : 'sorgu hic eslesmedi',
    }));
  }

  // Tek aramalik sifir gurultu olabilir; ardisik sifir arizadir.
  recordSearch(sourceBreakdown, {
    zeroSources: zeroResultSources.map((z) => z.source),
    queries: sentQueries,
  });

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
       const rankedData = await calculateAHP(enrichedCleanData, rankingWeights);
       const finalResults = translateEnabled
         ? await batchTranslateAcademic(rankedData.slice(0, displayCount))
         : rankedData.slice(0, displayCount);

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

  // Skorlama INGILIZCE metinden. Onceki surum `mainTopic + queryContext`
  // kullaniyordu: Turkce konu iki kez giriyor (queryContext zaten iceriyor),
  // Turkce token'lar Ingilizce basliklarla hic eslesmiyor, benzerlik oraninin
  // paydasini sisiriyor ve tam ifade bonusu hic tetiklenmiyordu.
  const scoring = plan ? scoringInput(plan) : null;
  const cleanQuery = scoring?.text || `${params.mainTopic || ''} ${queryContext || ''}`.trim();
  // Sorgu token'lari da makale metinleriyle ayni sekilde normalize edilmeli;
  // aksi halde "reactor," gibi noktalamali bir token hicbir zaman eslesmez.
  const BOOLEAN_NOISE = new Set(['or', 'and', 'not', 'title', 'key', 'abs']);
  const queryTokens = [...toTokenSet(cleanQuery)].filter((t) => !BOOLEAN_NOISE.has(t) && !STOPWORDS.has(t));

  const expandedQueries = scoring
    ? scoring.phrases
    : (queryContext ? queryContext.split(' ').filter(x => x.length > 2) : []);

  const clauseTokens = scoring?.clauses?.map((alternatives) =>
    alternatives
      .map((alt) => [...toTokenSet(alt)].filter((t) => !BOOLEAN_NOISE.has(t) && !STOPWORDS.has(t)))
      .filter((alt) => alt.length > 0)
  ).filter((alternatives) => alternatives.length > 0) || null;

  uniqueResults.forEach(r => {
    const { keyCount, expandedSimilarity, queryMatched, queryTokenCount, clausesSatisfied } =
      computeKeywordScores(r, queryTokens, clauseTokens);
    r.keyCount = keyCount;
    r.expandedSimilarity = expandedSimilarity;
    r.queryMatched = queryMatched;
    r.queryTokenCount = queryTokenCount;
    if (typeof clausesSatisfied === 'boolean') r.clausesSatisfied = clausesSatisfied;

    // relevanceScore (ranking için)
    r.relevanceScore = calculateRelevanceScore(r, cleanQuery, expandedQueries);
  });

  // Konu disi sonuclari havuz SECILMEDEN once ele: 25 slot konu ici
  // makalelerle dolsun. (calculateAHP ayni esigi onbellekten gelen havuzda
  // da uyguluyor.)
  const gate = relevanceGate(uniqueResults);
  console.log(`[Ranking] Alaka esigi: ${gate.level}, elenen ${gate.dropped}, kalan ${gate.items.length}`);

  console.log(`[Ranking] 3. Scoring tamamlandı. Örnek scores:`,
    uniqueResults.slice(0, 3).map(r => `"${(r.title||'').slice(0,30)}" keyCount=${r.keyCount} relScore=${r.relevanceScore}`)
  );

  // 4. Ranking pipeline çıktısını AHP'ye ver (hard filter YOK - AHP filtreler)
  // selectFinalResults sadece soft diversity + limit uygular
  const { finalResults: rankedFinalResults, sourceDistribution, lowestScore } = selectFinalResults(gate.items, displayCount);
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
  // Geri cekme kontrolu artik siralamadan SONRA ve yalnizca ilk sayfa icin
  // (rankWithFirstPageRetractions); sonraki sayfalar acildikca kontrol edilir.
  const enrichedResults = await enrichWithCitations(rankedFinalResults);
  const enrichEnd = performance.now();
  console.log(`OpenCitations Doğrulama Süresi: ${((enrichEnd - enrichStart) / 1000).toFixed(2)} sn`);
  const openCitationVerifiedCount = enrichedResults.filter(r => r.openCitationVerified).length;

  // AHP + ceviri artik rankingPipeline'da: ayni fonksiyon onbellek isabetinde
  // de calisiyor, boylece canli arama ile onbellekten gelen sonuc ayni
  // agirliklarla ayni siralamayi uretir.
  console.log(`${rankedFinalResults.length} öğe için AHP skorları hesaplanıyor...`);
  const { results: rankedResults, translations, retractionSummary } = await rankWithFirstPageRetractions(enrichedResults, {
    weights: rankingWeights,
    displayCount,
    translateEnabled,
  });
  console.log(`AHP + çeviri tamamlandı. (${rankedResults.length} sonuç)`);
  console.log(`[ResponseDebug] First 3 titles:`, rankedResults.slice(0,3).map(r => `"${(r?.titleTR || r?.title || '').slice(0,40)}"`));

  let finalResults = rankedResults;
  // Ultimate fallback: if still empty, use raw enriched results
  if ((!finalResults || finalResults.length === 0) && enrichedResults?.length > 0) {
    console.log('[SearchResponseFallback] AHP results also empty, using raw enriched results');
    finalResults = enrichedResults.slice(0, displayCount);
  }

  // Ilk sonuclar icin yasal PDF'i onceden bul: kullanici en ustteki makalelerde
  // dugmeye basmadan PDF'i gorur. Unpaywall istekleri paralel, onbellekli ve
  // gunluk kotali (unpaywall.js); toplam bekleme ust sinirla kesilir, gec kalan
  // makale icin kartta "Ucretsiz PDF bul" dugmesi kalir.
  if (Array.isArray(finalResults) && finalResults.length > 0) {
    const lookups = finalResults.slice(0, PREFETCH_PDF_COUNT)
      .filter((p) => p.doi && !p.pdfUrl)
      .map(async (p) => {
        const res = await findOpenAccessCopy(p.doi);
        if (res.status === 'ok' && res.result?.pdfUrl) {
          p.pdfUrl = res.result.pdfUrl;
          p.openAccess = true;
        }
      });
    await Promise.race([
      Promise.allSettled(lookups),
      new Promise((resolve) => setTimeout(resolve, PREFETCH_PDF_BUDGET_MS)),
    ]);
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
    // Hata vermeyen ama sonuc dondurmeyen kaynaklar. failedSources'dan ayri
    // tutuluyor: "erisemedik" ile "erisildik ama bos dondu" ayri arizalardir
    // ve ikincisi neredeyse her zaman bizim sorgumuzun hatasidir.
    zeroResultSources,
    // full: sorgu kelimelerinin yeterincesi geciyor; partial: tam eslesen yok,
    // en az bir kelimesi gecenler gosteriliyor; none: esik uygulanamadi.
    relevance: { level: gate.level, dropped: gate.dropped },
    translation: { enabled: translateEnabled },
    sourceBreakdown,
    totalFromAPIs,
    opencitations: { verified: openCitationVerifiedCount || 0 },
    retraction: {
      retracted: retractionSummary.retracted,
      concern: retractionSummary.concern,
      checked: retractionSummary.checked,
      // Kontrol basarisizsa arayuz "geri cekme kontrolu yapilamadi" diyebilsin;
      // sessizce "hic geri cekilmis yok" gibi gorunmesin.
      failed: retractionSummary.errors.length > 0,
    },
    methodology: getWeightingMethodology(rankingWeights),
    // Onbellek icin: AHP ONCESI havuz ve ceviriler. index.js bunu istemciye
    // gondermeden once cikarir; onbellek isabetinde siralama bundan uretilir.
    _cache: { pool: enrichedResults, translations },
    quota: {
        scopus:   { limit: scopusQuota?.limit,   remaining: scopusQuota?.remaining,   reset: formatResetDate(scopusQuota)   },
        openalex: { limit: openAlexQuota?.limit, remaining: openAlexQuota?.remaining, reset: formatResetDate(openAlexQuota) },
        core:     { limit: coreQuota?.limit,     remaining: coreQuota?.remaining,     reset: formatResetDate(coreQuota)     },
        crossref: { limit: 'Sınırsız', remaining: 'Sınırsız', reset: 'N/A' },
        s2:       { limit: '60/dk', remaining: '60/dk', reset: 'N/A' },
        arxiv:    { limit: '20/dk', remaining: '20/dk', reset: 'N/A' },
        doaj:     { limit: '120/dk', remaining: '120/dk', reset: 'N/A' },
        europepmc: { limit: '~10/sn (IP)', remaining: 'N/A', reset: 'N/A' },
        opencitations: { verified: openCitationVerifiedCount || 0 }
    }
  };

  return responseData;
}
