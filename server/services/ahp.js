
/**
 * Balanced Academic AHP Scoring Logic
 * Focuses on Relevance (Keywords), Authority (Citations), and Recency (Year)
 */

// 1. Recency Score (Year) - Linear decay
// 2024 = 1.0, 2014 = 0.6, 1999 and older = 0.0
function scoreYear(year) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    const score = 1 - (age * 0.04);
    return Math.max(0, Math.min(1, score));
}

// 2. Authority Score (Citations) - Logarithmic scale
// Distinguishes well between 0, 10, 100, and 1000+ citations
function scoreCitation(citedBy) {
    if (!citedBy || citedBy <= 0) return 0;
    // Logarithmic scale base 10
    // log10(1000) = 3, so we divide by 3 to normalize to 0-1 range (capping at 1000)
    const score = Math.log10(citedBy + 1) / 3; 
    return Math.max(0, Math.min(1, score));
}

// 3. Relevance Score (KeyCount) - Normalized
// 0 keys = 0.0, 10+ keys = 1.0
function scoreKeyCount(count) {
    if (!count || count <= 0) return 0;
    const score = count / 10;
    return Math.max(0, Math.min(1, score));
}

/**
 * Calculates AHP Scores for a dataset of articles
 * @param {Array} dataset - List of normalized articles
 * @param {Object} customWeights - Optional weights overrides
 */
export async function calculateAHP(dataset, customWeights = null) {
    // Balanced Academic Weights
    const weights = customWeights || {
        key: 0.45,      // Relevance (Most important for matching search)
        citied: 0.35,   // Authority (Trustworthiness)
        year: 0.20      // Recency (Up-to-date)
    };

    dataset.forEach(item => {
        // Calculate normalized scores (all 0-1)
        const sYear = scoreYear(item.year);
        const sKey = scoreKeyCount(item.keyCount);
        const sCited = scoreCitation(item.citedBy);

        // Apply AHP formula
        const totalScore = (weights.year * sYear) +
                          (weights.key * sKey) +
                          (weights.citied * sCited);

        item.scores = {
            year: parseFloat(sYear.toFixed(3)),
            key: parseFloat(sKey.toFixed(3)),
            cited: parseFloat(sCited.toFixed(3)),
            total: parseFloat(totalScore.toFixed(5))
        };
        
        // Map total score back to the top level for UI sorting
        item.totalPoint = item.scores.total;
    });

    // Sort descending by total score
    return dataset.sort((a, b) => b.totalPoint - a.totalPoint);
}
