/**
 * AHP katkı dökümü: katkı = uygulanan ağırlık × kriter skoru.
 * Etiketler sözlükten gelir (criteria.*); burada yalnızca hesap var.
 * RankBreakdown.jsx bileşenden ayrı tutuluyor (fast refresh + test).
 */
export const CRITERIA_ORDER = ['citation', 'keyword', 'quality', 'similarity', 'recency', 'reliability', 'oa'];

/** Skoru 0 olduğunda "neden" açıklaması olan kriterler (verinin gerçekten eksik olabildikleri). */
export const HAS_ZERO_REASON = new Set(['citation', 'recency', 'quality', 'oa', 'reliability']);

export function computeContributions(scores, weights) {
  if (!scores || !weights) return [];
  return CRITERIA_ORDER
    .filter((c) => typeof scores[c] === 'number' && typeof weights[c] === 'number')
    .map((c) => ({ criterion: c, score: scores[c], weight: weights[c], contribution: scores[c] * weights[c] }))
    .sort((a, b) => b.contribution - a.contribution);
}
