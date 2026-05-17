import pkg from 'natural';
import { enrichPaperRanking } from './journalRankingService.js';
const { JaroWinklerDistance } = pkg;

export function normalizeSearchResult(result) {
  const normalized = {
    ...result,
    title: (result.title || '').trim(),
    abstract: (result.description || result.abstract || '').trim(),
    year: parseInt(result.year, 10) || null,
    sourceList: [result.source || 'Unknown']
  };
  return enrichPaperRanking(normalized);
}

export function deduplicateResults(results) {
  const uniqueMap = new Map();
  
  for (const item of results) {
    let key = null;
    
    // Check DOI
    if (item.doi && String(item.doi).trim().length > 5) {
      let doiStr = String(item.doi).trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
      key = `doi:${doiStr}`;
    }
    
    if (key && uniqueMap.has(key)) {
      // Merge sources
      const existing = uniqueMap.get(key);
      if (item.source && !existing.sourceList.includes(item.source)) {
        existing.sourceList.push(item.source);
      }
      continue;
    }

    // Check Title Similarity if no DOI key matched
    const titleClean = (item.title || '').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, '');
    if (titleClean.length > 10) {
      let foundSimilar = false;
      for (const [existingKey, existingItem] of uniqueMap.entries()) {
        const existingTitle = (existingItem.title || '').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, '');
        if (existingTitle.length > 10) {
          const similarity = JaroWinklerDistance(titleClean, existingTitle);
          if (similarity > 0.95) { // Highly similar
            if (item.source && !existingItem.sourceList.includes(item.source)) {
              existingItem.sourceList.push(item.source);
            }
            foundSimilar = true;
            break;
          }
        }
      }
      if (foundSimilar) continue;
      
      key = `title:${titleClean}`;
    } else {
      key = `id:${item.id || Math.random().toString()}`;
    }

    uniqueMap.set(key, item);
  }
  
  return Array.from(uniqueMap.values());
}

export function calculateRelevanceScore(result, userQuery, expandedQueries = []) {
  let score = 0;
  const title = (result.title || '').toLowerCase();
  const abstract = (result.abstract || '').toLowerCase();
  const query = (userQuery || '').toLowerCase();
  const tokens = query.split(/\s+/).filter(t => t.length > 2 && t !== 'or' && t !== 'and');

  // Title Match
  if (title.includes(query)) score += 3.0; // Exact phrase match in title
  else {
    let titleMatches = 0;
    for (const t of tokens) if (title.includes(t)) titleMatches++;
    if (tokens.length > 0) score += (titleMatches / tokens.length) * 2.0;
  }

  // Abstract Match
  if (abstract) {
    if (abstract.includes(query)) score += 1.5; // Exact phrase match
    let absMatches = 0;
    for (const t of tokens) if (abstract.includes(t)) absMatches++;
    if (tokens.length > 0) score += (absMatches / tokens.length) * 1.0;
    
    // Very short abstract penalty
    if (abstract.length < 100) score -= 0.5;
  } else {
    // No abstract penalty
    score -= 2.0;
  }

  // Expanded queries match
  if (expandedQueries.length > 0) {
    let expMatches = 0;
    for (const exp of expandedQueries) {
      const expLow = exp.toLowerCase();
      if (title.includes(expLow) || abstract.includes(expLow)) expMatches++;
    }
    score += (expMatches / expandedQueries.length) * 0.5;
  }

  // Year heuristics (slight advantage to newer, penalty to very old)
  if (result.year) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - result.year;
    if (age <= 3) score += 0.3;
    if (age > 15) score -= 0.5;
  }

  return Math.max(0, parseFloat(score.toFixed(3)));
}

export function applyHardFilter(results, minThreshold = 0.15) {
  // Tier 1: Normal threshold
  let filtered = results.filter(r => r.relevanceScore >= minThreshold);
  console.log(`[HardFilter] Tier1 (score >= ${minThreshold}): ${filtered.length}/${results.length}`);

  // Tier 2: Fallback - if less than 10 survive, lower threshold to 0.05
  if (filtered.length < 10 && results.length >= 5) {
    filtered = results.filter(r => r.relevanceScore >= 0.05);
    console.log(`[HardFilter] Tier2 fallback (score >= 0.05): ${filtered.length}`);
  }

  // Tier 3: Emergency - if still less than 5, take everything sorted by score
  if (filtered.length < 5 && results.length > 0) {
    filtered = [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);
    console.log(`[HardFilter] Tier3 EMERGENCY - taking all ${filtered.length} results (no filter)`);
  }

  const rejectedCount = results.length - filtered.length;
  const rejectedSamples = results
    .filter(r => !filtered.includes(r))
    .sort((a, b) => a.relevanceScore - b.relevanceScore)
    .slice(0, 5);

  return { filteredResults: filtered, rejectedCount, rejectedSamples };
}

export function selectFinalResults(results, limit = 25) {
  if (!results || results.length === 0) {
    console.log('[SelectFinal] WARN: Input results array is empty!');
    return { finalResults: [], sourceDistribution: {}, lowestScore: 0 };
  }

  // Sort by relevance score descending
  const sorted = [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);
  console.log(`[SelectFinal] Input: ${sorted.length} results, top score: ${sorted[0]?.relevanceScore}, limit: ${limit}`);

  const finalResults = [];
  const sourceCount = {};

  // Soft Source Diversity: max 60% from one source
  const maxPerSource = Math.max(1, Math.ceil(limit * 0.6));

  // First Pass: Fill with soft diversity
  const remaining = [];
  for (const item of sorted) {
    if (finalResults.length >= limit) break;
    const primarySource = (item.sourceList && item.sourceList[0]) || item.source || 'Unknown';
    sourceCount[primarySource] = sourceCount[primarySource] || 0;

    if (sourceCount[primarySource] < maxPerSource) {
      finalResults.push(item);
      sourceCount[primarySource]++;
    } else {
      remaining.push(item);
    }
  }

  // Second Pass: Fill remaining slots regardless of source
  for (const item of remaining) {
    if (finalResults.length >= limit) break;
    finalResults.push(item);
    const primarySource = (item.sourceList && item.sourceList[0]) || item.source || 'Unknown';
    sourceCount[primarySource] = (sourceCount[primarySource] || 0) + 1;
  }

  const lowestScore = finalResults.length > 0
    ? finalResults[finalResults.length - 1].relevanceScore
    : 0;

  console.log(`[SelectFinal] Output: ${finalResults.length} results`);
  console.log(`[SelectFinal] First 3: ${finalResults.slice(0,3).map(r => `"${(r.title||'').slice(0,35)}" (${r.relevanceScore})`).join(' | ')}`);

  return { finalResults, sourceDistribution: sourceCount, lowestScore };
}
