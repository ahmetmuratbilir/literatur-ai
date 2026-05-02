import { PUB_TYPE_SCORES, SOURCE_TYPE_SCORES } from '../utils/dataUtils.js';

/**
 * Balanced Academic AHP Scoring Logic
 * Focuses on Relevance (Keywords), Authority (Citations), Recency (Year), and Quality (PubType)
 */

/**
 * 1. Recency Score (Year) - Linear decay
 * 2024 = 1.0, 2014 = 0.6, 1999 and older = 0.0
 */
function calculateYearScore(year) {
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - year);
  const score = 1 - (age * 0.04);
  return Math.max(0, Math.min(1, score));
}

/**
 * 2. Authority Score (Citations) - Optimized Logarithmic scale
 * 100+ citations = 1.0 score
 */
function calculateCitationScore(citedBy) {
  const citations = parseInt(citedBy, 10) || 0;
  if (citations <= 0) return 0;
  const score = Math.log10(citations + 1) / 2;
  return Math.max(0, Math.min(1, score));
}

/**
 * 3. Relevance Score (KeyCount) - Optimized
 * Reaches 1.0 at 5+ keyword hits
 */
function calculateRelevanceScore(count) {
  const keyCount = parseInt(count, 10) || 0;
  if (keyCount <= 0) return 0;
  const score = keyCount / 5;
  return Math.max(0, Math.min(1, score));
}

/**
 * 4. Quality Score (Publication & Source Type)
 */
function calculateQualityScore(pubType, sourceType) {
  const pScore = PUB_TYPE_SCORES[pubType] || 0.4;
  const sScore = SOURCE_TYPE_SCORES[sourceType] || 0.5;
  // Blend both with a slight preference for publication type (article vs correction etc)
  return (pScore * 0.6) + (sScore * 0.4);
}

/**
 * Calculates AHP Scores for a dataset of articles
 */
export async function calculateAHP(dataset, customWeights = null) {
  // Enhanced Academic Weights
  const weights = customWeights || {
    key: 0.35,      // Relevance
    citied: 0.35,   // Authority
    year: 0.15,     // Recency
    quality: 0.15   // PubType/SourceType Quality
  };

  const processedData = dataset.map(item => {
    const sYear = calculateYearScore(item.year);
    const sKey = calculateRelevanceScore(item.keyCount || item.relevanceScore / 20); // Fallback for relevanceScore
    const sCited = calculateCitationScore(item.citedbyCount || item.citedBy);
    const sQuality = calculateQualityScore(item.pubType, item.sourceType);

    const totalScore = (weights.year * sYear) +
                       (weights.key * sKey) +
                       (weights.citied * sCited) +
                       (weights.quality * sQuality);

    return {
      ...item,
      scores: {
        year: parseFloat(sYear.toFixed(3)),
        key: parseFloat(sKey.toFixed(3)),
        cited: parseFloat(sCited.toFixed(3)),
        quality: parseFloat(sQuality.toFixed(3)),
        total: parseFloat(totalScore.toFixed(5))
      },
      totalPoint: parseFloat(totalScore.toFixed(5))
    };
  });

  return processedData.sort((a, b) => b.totalPoint - a.totalPoint);
}
