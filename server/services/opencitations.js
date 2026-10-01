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
export const enrichWithCitations = async (results) => {
  const topResults = results.slice(0, 20); // 30 yerine 20 - daha hızlı
  const papersWithDoi = topResults.filter(r =>
    r.doi && r.doi.length > 0 && (!r.citedBy || parseInt(r.citedBy) === 0)
  );

  if (papersWithDoi.length === 0) {
    console.log("OpenCitations: DOI'si olan makale bulunamadı, atlanıyor.");
    return results;
  }

  console.log(`OpenCitations: ${papersWithDoi.length} makale için doğrulama başlatılıyor...`);

  const BATCH_SIZE = 5;
  for (let i = 0; i < papersWithDoi.length; i += BATCH_SIZE) {
    const batch = papersWithDoi.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async (paper, bIdx) => {
      const idx = i + bIdx + 1;
      try {
        const start = Date.now();
        const response = await axios.get(
          `${OPENCITATIONS_BASE}/citation-count/doi:${encodeURIComponent(paper.doi)}`,
          { timeout: 3000 }
        );
        const duration = Date.now() - start;
        if (response.data && response.data.length > 0) {
          const count = parseInt(response.data[0].count || 0);
          console.log(`  [${idx}] DOI:${paper.doi} -> ${count} atıf (${duration}ms)`);
          if (count > 0) {
            paper.citationCount = Math.max(paper.citationCount || 0, count);
            // AHP atif puani `citedbyCount || citedBy` okuyor. Onceki surum
            // yalnizca `citationCount` yaziyordu: OpenCitations'in buldugu atif
            // sayisi HICBIR ZAMAN atif puanina yansimiyordu (yalnizca
            // guvenilirlige +0.2). Bu blok zaten yalnizca citedBy = 0 olan
            // makaleler icin calisiyor, yani baska bir kaynagin degerini ezmez.
            const current = Number.parseInt(paper.citedBy ?? paper.citedbyCount, 10) || 0;
            if (count > current) {
              paper.citedBy = count;
              paper.citedbyCount = count;
            }
            paper.openCitationVerified = true;
          }
        }
      } catch (error) {
        console.log(`  [${idx}] DOI:${paper.doi} -> HATA: ${error.message}`);
      }
    }));
    if (i + BATCH_SIZE < papersWithDoi.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log('OpenCitations: Doğrulama tamamlandı.');
  return results;
};
