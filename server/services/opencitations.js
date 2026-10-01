import axios from 'axios';

/**
 * OpenCitations Index API v2
 * Batch processing: 5 per batch, 200ms between batches
 *
 * Onceki surum COCI v1'i `doi:` onekiyle cagiriyordu ve bu kombinasyon
 * dort olasilikin tek gecersiz olani: v1 oneki KABUL ETMIYOR, v2 ZORUNLU
 * tutuyor. Sonuc: her cagri HTTP 400 donuyor, catch blogu yalnizca
 * logladigi icin hata sessiz kaliyor ve `openCitationVerified` hicbir
 * makalede true olmuyordu. Bu da AHP'nin guvenilirlik kriterini (%10.47)
 * her makalede 0.2 puan eksik hesaplatiyordu.
 *
 * Olculen (30 Eyl 2026, DOI 10.1038/nature12373):
 *   v1 + doi: onekli -> 400   |  v1 oneksiz -> 200 (1806)
 *   v2 + doi: onekli -> 200 (1806)  |  v2 oneksiz -> 400
 */
const OPENCITATIONS_BASE = 'https://opencitations.net/index/api/v2';
// Hiz (1 Eki 2026 olcumu): 5'li paketler SIRAYLA + paketler arasi 200 ms +
// istek basina 3 sn zaman asimi, 10 makale icin aramaya 4,16 sn ekliyordu
// (tum kaynaklar birlikte 4,65 sn). Simdi: en fazla 10 eszamanli istek,
// toplam 2,5 sn butce (yetismeyen istek iptal edilir; bu bir zenginlestirme,
// aramayi bekletmemeli) ve DOI basina 24 saatlik bellek onbellegi.
const CONCURRENCY = 10;
const BUDGET_MS = 2500;
const CACHE_TTL_MS = 24 * 3600 * 1000;
const CACHE_MAX = 5000;
const countCache = new Map(); // doi -> { count, expiresAt }

const cached = (doi) => {
  const hit = countCache.get(doi);
  if (hit && hit.expiresAt > Date.now()) return hit.count;
  if (hit) countCache.delete(doi);
  return undefined;
};
const remember = (doi, count) => {
  if (countCache.size >= CACHE_MAX) countCache.delete(countCache.keys().next().value);
  countCache.set(doi, { count, expiresAt: Date.now() + CACHE_TTL_MS });
};

function applyCount(paper, count) {
  if (!(count > 0)) return;
  paper.citationCount = Math.max(paper.citationCount || 0, count);
  // AHP atif puani `citedbyCount || citedBy` okuyor; bu blok yalnizca
  // citedBy = 0 olan makaleler icin calisiyor, baska kaynagin degerini ezmez.
  const current = Number.parseInt(paper.citedBy ?? paper.citedbyCount, 10) || 0;
  if (count > current) {
    paper.citedBy = count;
    paper.citedbyCount = count;
  }
  paper.openCitationVerified = true;
}

/** Testler icin. */
export function resetOpenCitationsCache() { countCache.clear(); }

export const enrichWithCitations = async (results, { http = axios, budgetMs = BUDGET_MS } = {}) => {
  const topResults = results.slice(0, 20);
  const papersWithDoi = topResults.filter(r =>
    r.doi && r.doi.length > 0 && (!r.citedBy || parseInt(r.citedBy) === 0)
  );

  if (papersWithDoi.length === 0) {
    console.log("OpenCitations: DOI'si olan makale bulunamadı, atlanıyor.");
    return results;
  }

  const pending = [];
  let fromCache = 0;
  for (const paper of papersWithDoi) {
    const hit = cached(paper.doi.toLowerCase());
    if (hit !== undefined) { applyCount(paper, hit); fromCache++; } else pending.push(paper);
  }
  console.log(`OpenCitations: ${papersWithDoi.length} makale (${fromCache} önbellekten), ${pending.length} istek...`);
  if (pending.length === 0) return results;

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), budgetMs);
  let next = 0;
  let timedOut = 0;
  const worker = async () => {
    while (next < pending.length && !controller.signal.aborted) {
      const paper = pending[next++];
      try {
        const response = await http.get(
          `${OPENCITATIONS_BASE}/citation-count/doi:${encodeURIComponent(paper.doi)}`,
          { timeout: budgetMs, signal: controller.signal }
        );
        const count = parseInt(response?.data?.[0]?.count || 0, 10) || 0;
        remember(paper.doi.toLowerCase(), count);
        applyCount(paper, count);
      } catch (error) {
        if (controller.signal.aborted) timedOut++;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  } finally {
    clearTimeout(deadline);
  }

  console.log(`OpenCitations: Doğrulama tamamlandı${timedOut ? ` (${timedOut} istek süre bütçesine yetişmedi)` : ''}.`);
  return results;
};
