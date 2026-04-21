/**
 * Balanced Academic AHP Scoring Logic
 * Focuses on Relevance (Keywords), Authority (Citations), and Recency (Year)
 */

/**
 * 1. Recency Score (Year) - Linear decay
 * 2024 = 1.0, 2014 = 0.6, 1999 and older = 0.0
 */
function calculateYearScore(year) {
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - year);
  // Each year of age reduces score by 0.04 (normalized to 0-1)
  const score = 1 - (age * 0.04);
  return Math.max(0, Math.min(1, score));
}

/**
 * 2. Authority Score (Citations) - Optimized Logarithmic scale
 * Now reaches 1.0 at 100-150 citations instead of 1000
 */
function calculateCitationScore(citedBy) {
  const citations = parseInt(citedBy, 10) || 0;
  if (citations <= 0) return 0;
  
  // Adjusted base: log10(100) = 2. So dividing by 2 makes 100 citations = 1.0 score.
  // This feels more "rewarding" for academic papers where 100+ is very good.
  const score = Math.log10(citations + 1) / 2;
  return Math.max(0, Math.min(1, score));
}

/**
 * 3. Relevance Score (KeyCount) - Optimized
 * Now reaches 1.0 at 5+ keyword hits instead of 10
 */
function calculateRelevanceScore(count) {
  const keyCount = parseInt(count, 10) || 0;
  if (keyCount <= 0) return 0;
  
  const score = keyCount / 5;
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculates AHP Scores for a dataset of articles
 * @param {Array} dataset - List of normalized articles
 * @param {Object} customWeights - Optional weights overrides
 */
export async function calculateAHP(dataset, customWeights = null) {
  // Balanced Academic Weights (Default)
  const weights = customWeights || {
    key: 0.40,      // Relevance
    citied: 0.40,   // Authority
    year: 0.20      // Recency
  };

  const processedData = dataset.map(item => {
    const sYear = calculateYearScore(item.year);
    const sKey = calculateRelevanceScore(item.keyCount);
    const sCited = calculateCitationScore(item.citedBy);

    const totalScore = (weights.year * sYear) +
                      (weights.key * sKey) +
                      (weights.citied * sCited);

    return {
      ...item,
      scores: {
        year: parseFloat(sYear.toFixed(3)),
        key: parseFloat(sKey.toFixed(3)),
        cited: parseFloat(sCited.toFixed(3)),
        total: parseFloat(totalScore.toFixed(5))
      },
      // Ensure totalPoint is available for sorting and UI
      totalPoint: parseFloat(totalScore.toFixed(5))
    };
  });

  // Sort descending by total score
  return processedData.sort((a, b) => b.totalPoint - a.totalPoint);
}
