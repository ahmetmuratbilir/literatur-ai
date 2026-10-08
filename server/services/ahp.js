import { PUB_TYPE_SCORES, SOURCE_TYPE_SCORES } from '../utils/dataUtils.js';
import { getAhpWeights, PAIRWISE_MATRIX, CRITERIA } from './ahpMatrix.js';
import { relevanceGate } from './searchRankingService.js';

/**
 * Advanced Academic AHP Scoring Logic (7 Criteria)
 *
 * Varsayilan agirliklar ahpMatrix.js'teki ikili karsilastirma matrisinin asal
 * ozvektorunden TURETILIR; burada elle yazilmaz. Guncel degerler (CR = 0.0006):
 *   1. Keyword Relevance         %20.93
 *   2. Expanded Query Similarity %10.47
 *   3. Citation Impact (FWCI) %21.66
 *   4. Publication Quality       %20.93
 *   5. Recency                   %10.47
 *   6. Reliability               %10.47
 *   7. Open Access               % 5.08
 * Kullanici profil veya ozel agirlik sectiyse bunlarin yerine
 * ahpProfiles.resolveRankingWeights() ciktisi uygulanir.
 */

/**
 * 1. Keyword Relevance Score (0-1)
 * Reaches 1.0 at 15+ weight points
 */
function calculateKeywordScore(keyCount) {
  const count = parseInt(keyCount, 10) || 0;
  if (count <= 0) return 0;
  return Math.min(1, count / 15);
}

/**
 * 2. Recency Score (Year)
 * 2024 = 1.0, -4% per year
 */
/**
 * EKSIK BILGI ILKESI (kullanici karari, 30 Eyl 2026): bir kriterin verisi
 * yoksa makale o kriterde 0 alir. Eksik bilgi avantaj saglamamali. Onceki
 * surumde eksik yil 0.5 (notr) sayiliyordu; bu ~12,5 yaslinda bir makaleye
 * denk geliyor ve 2007-2011 agirlikli bir havuzda TARIHSIZ bir makaleyi
 * "Guncel arastirmalar" profilinde 3. siraya cikariyordu (canlida olculdu).
 */
const MISSING_YEAR_ASSUMED_AGE = 25; // guncellik skorunun 0'a indigi yas (1 - 0.04 * 25)

function calculateRecencyScore(year) {
  const currentYear = new Date().getFullYear();
  if (!year) return 0; // Eksik bilgi ilkesi
  const age = Math.max(0, currentYear - year);
  const score = 1 - (age * 0.04);
  return Math.max(0, Math.min(1, score));
}

/**
 * 3. Atif etkisi.
 *
 * OpenAlex'in FWCI degeri varsa (alan, yil ve belge turune gore normalize
 * atif; 1 = alan ortalamasi) puan onun logaritmasidir: FWCI 1 -> 0.18,
 * 10 -> 0.61, 50+ -> 1. Ham atif tip gibi cok atif yapilan alanlari ve eski
 * makaleleri kayiriyordu.
 *
 * Neden yuzdelik degil: olculdu (1 Eki 2026, "passive cooling small modular
 * reactor"), aramada cikan makalelerin neredeyse hepsi alaninin ust %3-4'unde
 * (0.968-0.998). Yuzdelik puan olsaydi kriter en iyi adaylari ayiramazdi.
 * Yuzdelik yalnizca aciklamada ("alaninda en cok atif alan %1") kullaniliyor.
 *
 * FWCI yoksa (makale OpenAlex'te bulunamadi) yillik atifin logaritmasina
 * dusulur. "Eksik veri = 0" burada UYGULANMIYOR: atif sayisi biliniyor ve
 * yalnizca bir kaynakta olmamak makaleyi cezalandirmamali.
 */
const FWCI_FULL_SCORE = 50;

export function calculateCitationScore(item, year) {
  const fwci = item?.fwci;
  if (typeof fwci === 'number' && Number.isFinite(fwci) && fwci >= 0) {
    const score = Math.log10(fwci + 1) / Math.log10(FWCI_FULL_SCORE + 1);
    return { score: Math.max(0, Math.min(1, score)), basis: 'field' };
  }
  return { score: calculateCitationPerYearScore(item?.citedbyCount || item?.citedBy || 0, year), basis: 'perYear' };
}

/**
 * Yillik atif (logaritmik); alan yuzdeligi olmayan makaleler icin.
 */
function calculateCitationPerYearScore(citedBy, year) {
  const citations = parseInt(citedBy, 10) || 0;
  if (citations <= 0) return 0;

  // Yil yoksa yillik atif hesaplanamaz, ama atif SAYISI biliniyor: onu yok
  // saymak gercek bir bilgiyi atmak olur. Makale, guncellik kriterinin 0
  // verdigi yasta kabul edilir; iki kriter AYNI varsayimi kullanir ve eksik
  // yil hicbir kriterde avantaj saglamaz. Onceki surum atif sayisindan
  // bagimsiz olarak sabit 0.5 donuyordu.
  const currentYear = new Date().getFullYear();
  const age = year ? Math.max(0, currentYear - year) : MISSING_YEAR_ASSUMED_AGE;
  const cpy = citations / (age + 1);
  
  // Log scale: 20+ citations per year = 1.0
  const score = Math.log10(cpy + 1) / Math.log10(21);
  return Math.max(0, Math.min(1, score));
}

/**
 * 4. Publication Quality Score
 */
/** DOI'siz ama dogrulanabilir kimligi (PMID, arXiv, S2 CorpusID, OpenAlex W...) olan kayit mi. */
function hasAlternativeId(item) {
  return Boolean(item.arxivId || item.pmid || item.pubmedId || item.corpusId || (item.id && String(item.id).startsWith('W')));
}

function citationCountOf(item) {
  return Number.parseInt(item.citedbyCount || item.citedBy || item.citationCount, 10) || 0;
}

function calculateQualityScore(pubType, sourceType, hasDoi, hasAltId = false, citationCount = 0) {
  // Eksik bilgi ilkesi: yayin/kaynak turu bilinmiyorsa o alt puan 0.
  // (Onceki surum 0.4 / 0.5 notr degerler veriyordu.)
  const pScore = PUB_TYPE_SCORES[pubType] ?? 0;
  const sScore = SOURCE_TYPE_SCORES[sourceType] ?? 0;
  let score = (pScore * 0.6) + (sScore * 0.4);
  
  if (hasDoi || hasAltId || citationCount >= 20) score += 0.05; // Bonus for DOI, verified AltId or high citations
  return Math.max(0, Math.min(1, score));
}

/**
 * 5. Reliability Score
 */
function calculateReliabilityScore(item) {
  // Geri cekilmis bir makale baska hicbir sinyalle guvenilir sayilamaz.
  if (item.retraction?.status === 'retracted') return 0;

  let score = 0.5; // Neutral start

  if (item.doi) {
    score += 0.2;
  } else if (hasAlternativeId(item) || citationCountOf(item) >= 15 || item.openCitationVerified) {
    score += 0.15; // DOI'siz ama dogrulanmis alternatif kimlik veya yuksek etki
  }
  if (item.openCitationVerified) score += 0.1;
  if (['Scopus', 'OpenAlex', 'Semantic Scholar', 'PubMed', 'Europe PMC', 'CORE', 'ArXiv', 'DOAJ'].includes(item.source)) {
    score += 0.1;
  }
  // Endise bildirimi makaleyi gecersiz kilmaz ama guveni belirgin dusurur.
  if (item.retraction?.status === 'concern') score -= 0.3;
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Geri cekilmis makaleler listeden ATILMAZ, en alta iner ve uyarili gosterilir.
 * Akademisyenin bunu bilmesi gerekebilir: kaynakcasinda zaten atif yapmis
 * olabilir. Carpan 0.1: yuksek atifli geri cekilmis bir makale bile (Wakefield
 * 1998 binlerce atif aldi) gecerli sonuclarin ustune cikamamali.
 */
const RETRACTED_SCORE_MULTIPLIER = 0.1;

function calculateQuartileBoost(quartile, sourceType) {
  if (sourceType === 'Preprint') return 0.0;
  if (sourceType === 'Conference') return 0.02;
  
  if (quartile === 'Q1') return 0.08;
  if (quartile === 'Q2') return 0.05;
  if (quartile === 'Q3') return 0.03;
  if (quartile === 'Q4') return 0.01;
  
  return 0.0;
}

function isTrustedYearConfidence(confidence) {
  return confidence === 'high' || confidence === 'medium';
}

function resolveTrustedPublicationYear(item) {
  if (!isTrustedYearConfidence(item?.yearConfidence)) return null;

  const year = Number.parseInt(item.publicationYear, 10);
  if (!Number.isInteger(year)) return null;

  const maxYear = new Date().getFullYear() + 1;
  return year >= 1000 && year <= maxYear ? year : null;
}

/**
 * Final AHP Calculation
 */
/**
 * Kriter agirliklari artik elle yazilmis sabitler degil; ikili karsilastirma
 * matrisinin asal ozvektorunden turetiliyor (bkz. ahpMatrix.js).
 *
 * Turetilen degerler onceki sabitlere yakin (en buyuk sapma quality'de +0.029),
 * dolayisiyla siralama koklu bicimde degismiyor; degisen, agirliklarin
 * gerekcelendirilebilir ve tutarliligi olculebilir olmasi.
 */
export const DEFAULT_WEIGHTS = getAhpWeights().weights;

/**
 * Siralamanin yontem kunyesi. Akademik bir ciktida kullanilan agirliklandirma
 * yonteminin ve tutarlilik oraninin raporlanabilmesi icin.
 */
export function getWeightingMethodology(appliedWeights = null) {
  const { weights, lambdaMax, consistencyIndex, randomIndex, consistencyRatio, isConsistent } =
    getAhpWeights();

  return {
    method: 'AHP (Analytic Hierarchy Process)',
    reference: 'Saaty, T.L. (1980). The Analytic Hierarchy Process.',
    criteria: CRITERIA,
    pairwiseMatrix: PAIRWISE_MATRIX,
    // Matristen turetilen referans agirliklar. CR bunlar icindir.
    weights,
    // Bu siralamada GERCEKTEN uygulanan agirliklar. Kullanici profil veya ozel
    // agirlik sectiyse matrisinkinden farklidir ve "neden bu sirada"
    // aciklamasi bunlarla hesaplanmalidir.
    appliedWeights: resolveWeights(appliedWeights),
    appliedWeightsSource: appliedWeights ? 'user' : 'matrix',
    lambdaMax,
    consistencyIndex,
    randomIndex,
    consistencyRatio,
    isConsistent,
    consistencyThreshold: 0.1,
  };
}

/**
 * customWeights'i doğrular ve toplamı 1 olacak şekilde normalize eder.
 *
 * Önceki sürümde parametre imzada vardı ama gövdede hiç okunmuyordu; üç
 * çağrının üçü de null geçtiği için fark edilmemişti. Geçersiz veya eksik
 * girdide sessizce yanlış sıralama üretmek yerine varsayılana dönüyoruz.
 */
export function resolveWeights(customWeights) {
  if (!customWeights || typeof customWeights !== 'object') return { ...DEFAULT_WEIGHTS };

  const resolved = {};
  let sum = 0;

  for (const criterion of Object.keys(DEFAULT_WEIGHTS)) {
    const raw = Number(customWeights[criterion]);
    const value = Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_WEIGHTS[criterion];
    resolved[criterion] = value;
    sum += value;
  }

  if (sum <= 0) return { ...DEFAULT_WEIGHTS };

  // Ağırlıklar bir oran vektörüdür; toplamları 1 değilse skorlar
  // karşılaştırılamaz hale gelir.
  for (const criterion of Object.keys(resolved)) {
    resolved[criterion] /= sum;
  }

  return resolved;
}

/**
 * @param {{skipRelevanceGate?: boolean}} [options] skipRelevanceGate: yazar
 *   aramasinda konu suzmesini OpenAlex zaten yapti; burada tekrar baslik+ozet
 *   kelime esigi uygulamak ozeti olmayan eserleri dusuruyordu.
 */
export async function calculateAHP(dataset, customWeights = null, { skipRelevanceGate = false } = {}) {
  const weights = resolveWeights(customWeights);

  const processedData = dataset.map(item => {
    // 1. Calculate Individual Scores
    const trustedPublicationYear = resolveTrustedPublicationYear(item);
    const sKey = calculateKeywordScore(item.keyCount);
    const sSim = item.expandedSimilarity || 0;
    const citation = calculateCitationScore(item, trustedPublicationYear);
    const sCit = citation.score;
    const sQuality = calculateQualityScore(item.pubType, item.sourceType, !!item.doi, hasAlternativeId(item), citationCountOf(item));
    const sRecency = calculateRecencyScore(trustedPublicationYear);
    const sRel = calculateReliabilityScore(item);
    const sOA = item.openAccess ? 1.0 : 0.0;

    // 2. Final Score Calculation
    let totalScore = (weights.keyword * sKey) +
                     (weights.similarity * sSim) +
                     (weights.citation * sCit) +
                     (weights.quality * sQuality) +
                     (weights.recency * sRecency) +
                     (weights.reliability * sRel) +
                     (weights.oa * sOA);

    // 4. Quality Boost for Quartiles / SourceTypes
    const qBoost = calculateQuartileBoost(item.quartile, item.sourceType);
    totalScore = Math.min(1.0, totalScore + qBoost);

    // 5. Soft Penalty
    if (sCit < 0.1 && sQuality < 0.4) {
      totalScore *= 0.8;
    }

    const isRetracted = item.retraction?.status === 'retracted';
    if (isRetracted) totalScore *= RETRACTED_SCORE_MULTIPLIER;

    // 6. Explanation Generation
    const explanation = [];
    // Uyari her zaman ilk sirada: aciklama 3 madde ile kirpiliyor ve bu
    // bilgi kirpilan tarafta kalmamali.
    if (isRetracted) explanation.push('GERİ ÇEKİLDİ — bulgularına dayanmayın');
    else if (item.retraction?.status === 'concern') explanation.push('Endişe bildirimi yayımlanmış');
    if (item.quartile === 'Q1') explanation.push("Prestijli Q1 Yayını");
    else if (item.quartile === 'Q2') explanation.push("Nitelikli Q2 Yayını");
    else if (item.sourceType === 'Conference') explanation.push("Akademik Konferans Bildirisi");
    
    if (sSim > 0.6) explanation.push("Güçlü konu uyumu (Semantic)");
    else if (sKey > 0.6) explanation.push("Yüksek anahtar kelime eşleşmesi");
    
    if (item.topCitedPercent === 1) explanation.push("Alanında en çok atıf alan %1'de");
    else if (item.topCitedPercent === 10) explanation.push("Alanında en çok atıf alan %10'da");
    else if (sCit > 0.5) explanation.push(citation.basis === 'field' ? "Alanına göre yüksek atıf" : "Yıllık yüksek atıf yoğunluğu");
    if (sQuality > 0.8) explanation.push("Prestijli yayın kaynağı");
    if (sRecency > 0.9) explanation.push("Güncel çalışma (Son 2-3 yıl)");
    if (sRel > 0.8) explanation.push("Doğrulanmış güvenilir kaynak");
    if (sOA > 0) explanation.push("Açık erişim avantajı");

    // 7. Confidence Level
    let confidence = "HIGH";
    let dataPoints = 0;
    if (item.doi) dataPoints++;
    if (trustedPublicationYear) dataPoints++;
    if (item.citedbyCount > 0) dataPoints++;
    if (item.openCitationVerified) dataPoints++;
    
    if (dataPoints <= 1) confidence = "LOW";
    else if (dataPoints <= 2) confidence = "MEDIUM";

    return {
      ...item,
      scores: {
        keyword: parseFloat(sKey.toFixed(3)),
        similarity: parseFloat(sSim.toFixed(3)),
        citation: parseFloat(sCit.toFixed(3)),
        quality: parseFloat(sQuality.toFixed(3)),
        recency: parseFloat(sRecency.toFixed(3)),
        reliability: parseFloat(sRel.toFixed(3)),
        oa: parseFloat(sOA.toFixed(3)),
        qBoost: parseFloat(qBoost.toFixed(3)),
        total: parseFloat(totalScore.toFixed(5))
      },
      // Istemcideki "Neden bu sirada?" hangi atif olcusunun kullanildigini gosterir
      citationBasis: citation.basis,
      totalPoint: parseFloat(totalScore.toFixed(5)),
      confidence,
      explanation: explanation.slice(0, 3), // Max 3 explanations
      sKey,
      sSim
    };
  });

  // Esnek Filtreleme: Eğer en az 5 makale normal threshold'u geçiyorsa filtrele,
  // aksi takdirde kullanıcıya skorlu sonuçları göstermek için filtreyi kaldır.
  // Alaka esigi (searchRankingService.relevanceGate). Olculebilir veri yoksa
  // (or. demo verisi) eski filtreye duser. Eski filtre 5'ten az makale
  // gecerse filtreyi TAMAMEN kaldiriyordu; az sonuclu aramalarda konu disi
  // makaleler tam da bu yoldan giriyordu.
  if (skipRelevanceGate) return processedData.sort((a, b) => b.totalPoint - a.totalPoint);

  const gate = relevanceGate(processedData);
  let filtered;
  if (gate.level !== 'none') {
    filtered = gate.items;
    for (const item of filtered) item.matchLevel = gate.level;
  } else {
    filtered = processedData.filter(item => item.sKey >= 0.15 || item.sSim >= 0.20);
    if (filtered.length < 5) filtered = processedData;
  }

  return filtered.sort((a, b) => b.totalPoint - a.totalPoint);
}
