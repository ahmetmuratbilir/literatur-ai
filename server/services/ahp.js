import { PUB_TYPE_SCORES, SOURCE_TYPE_SCORES } from '../utils/dataUtils.js';

/**
 * Advanced Academic AHP Scoring Logic (7 Criteria)
 * 1. Keyword Relevance (%20)
 * 2. Expanded Query Similarity (%12)
 * 3. Citation Per Year (%23)
 * 4. Publication Quality (%18)
 * 5. Recency (%12)
 * 6. Reliability (%10)
 * 7. Open Access (%5)
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
function calculateRecencyScore(year) {
  const currentYear = new Date().getFullYear();
  if (!year) return 0.5; // Default for missing year
  const age = Math.max(0, currentYear - year);
  const score = 1 - (age * 0.04);
  return Math.max(0, Math.min(1, score));
}

/**
 * 3. Citation Per Year Score (Log-scaled)
 */
function calculateCitationPerYearScore(citedBy, year) {
  const citations = parseInt(citedBy, 10) || 0;
  if (citations <= 0) return 0;
  
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - (year || currentYear - 1));
  const cpy = citations / (age + 1);
  
  // Log scale: 20+ citations per year = 1.0
  const score = Math.log10(cpy + 1) / Math.log10(21);
  return Math.max(0, Math.min(1, score));
}

/**
 * 4. Publication Quality Score
 */
function calculateQualityScore(pubType, sourceType, hasDoi) {
  const pScore = PUB_TYPE_SCORES[pubType] || 0.4;
  const sScore = SOURCE_TYPE_SCORES[sourceType] || 0.5;
  let score = (pScore * 0.6) + (sScore * 0.4);
  
  if (hasDoi) score += 0.05; // Bonus for DOI
  return Math.max(0, Math.min(1, score));
}

/**
 * 5. Reliability Score
 */
function calculateReliabilityScore(item) {
  let score = 0.5; // Neutral start
  
  if (item.doi) score += 0.2;
  if (item.openCitationVerified) score += 0.2;
  if (['Scopus', 'OpenAlex', 'Semantic Scholar'].includes(item.source)) score += 0.1;
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Final AHP Calculation
 */
export async function calculateAHP(dataset, customWeights = null) {
  const DEFAULT_WEIGHTS = {
    keyword: 0.20,
    similarity: 0.12,
    citation: 0.23,
    quality: 0.18,
    recency: 0.12,
    reliability: 0.10,
    oa: 0.05
  };

  const processedData = dataset.map(item => {
    // 1. Calculate Individual Scores
    const sKey = calculateKeywordScore(item.keyCount);
    const sSim = item.expandedSimilarity || 0;
    const sCit = calculateCitationPerYearScore(item.citedbyCount || item.citedBy || 0, item.year);
    const sQuality = calculateQualityScore(item.pubType, item.sourceType, !!item.doi);
    const sRecency = calculateRecencyScore(item.year);
    const sRel = calculateReliabilityScore(item);
    const sOA = item.openAccess ? 1.0 : 0.0;

    // 2. Hard Filter
    // if (keywordScore < 0.15 && expandedSimilarity < 0.20) -> EXCLUDE
    if (sKey < 0.15 && sSim < 0.20) return null;

    // 3. Dynamic Normalization (Handle missing data)
    // In this implementation, we assume base scores are always calculable (with defaults if needed)
    // but we can adjust weights if certain critical data is completely missing.
    let currentWeights = { ...DEFAULT_WEIGHTS };
    
    // 4. Final Score Calculation
    let totalScore = (currentWeights.keyword * sKey) +
                     (currentWeights.similarity * sSim) +
                     (currentWeights.citation * sCit) +
                     (currentWeights.quality * sQuality) +
                     (currentWeights.recency * sRecency) +
                     (currentWeights.reliability * sRel) +
                     (currentWeights.oa * sOA);

    // 5. Soft Penalty
    // if citation low AND quality low -> -20%
    if (sCit < 0.1 && sQuality < 0.4) {
      totalScore *= 0.8;
    }

    // 6. Explanation Generation
    const explanation = [];
    if (sSim > 0.6) explanation.push("Güçlü konu uyumu (Semantic)");
    else if (sKey > 0.6) explanation.push("Yüksek anahtar kelime eşleşmesi");
    
    if (sCit > 0.5) explanation.push("Yıllık yüksek atıf yoğunluğu");
    if (sQuality > 0.8) explanation.push("Prestijli yayın kaynağı");
    if (sRecency > 0.9) explanation.push("Güncel çalışma (Son 2-3 yıl)");
    if (sRel > 0.8) explanation.push("Doğrulanmış güvenilir kaynak");
    if (sOA > 0) explanation.push("Açık erişim avantajı");

    // 7. Confidence Level
    let confidence = "HIGH";
    let dataPoints = 0;
    if (item.doi) dataPoints++;
    if (item.year) dataPoints++;
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
        total: parseFloat(totalScore.toFixed(5))
      },
      totalPoint: parseFloat(totalScore.toFixed(5)),
      confidence,
      explanation: explanation.slice(0, 3) // Max 3 explanations
    };
  }).filter(Boolean); // Remove filtered items

  return processedData.sort((a, b) => b.totalPoint - a.totalPoint);
}
