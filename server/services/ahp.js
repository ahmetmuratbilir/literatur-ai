
// Utilities for scoring
function scoreYear(year) {
    if (year <= 2000) return 0.15;
    if (year <= 2010) return 0.20;
    if (year <= 2020) return 0.25;
    return 0.40; // > 2020
}

function scoreKeyCount(count) {
    if (count === 0) return 0;
    if (count <= 2) return 0.1;
    if (count <= 4) return 0.2;
    if (count === 5) return 0.3;
    return 0.4;
}

function scoreCitation(citedBy) {
    if (citedBy === 0) return 0;
    if (citedBy <= 100) return 0.02;
    if (citedBy <= 500) return 0.03;
    if (citedBy <= 6000) return 0.08;
    if (citedBy <= 12000) return 0.12;
    if (citedBy <= 17000) return 0.14;
    // ... logic compressed for simplicity
    if (citedBy > 22000) return 0.25;
    return 0.20;
}

export async function calculateAHP(dataset, customWeights = null) {
    // AHP Weights
    const weights = customWeights || {
        year: 0.12,
        key: 0.32,
        citied: 0.56
    };

    dataset.forEach(item => {
        const sYear = scoreYear(item.year);
        const sKey = scoreKeyCount(item.keyCount);
        const sCited = scoreCitation(item.citedBy);

        const totalScore = (weights.year * sYear) +
            (weights.key * sKey) +
            (weights.citied * sCited);

        item.scores = {
            year: sYear,
            key: sKey,
            cited: sCited,
            total: parseFloat(totalScore.toFixed(5))
        };
    });

    // Sort descending by total score
    return dataset.sort((a, b) => b.scores.total - a.scores.total);
}

