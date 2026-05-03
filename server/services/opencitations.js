import axios from 'axios';

/**
 * OpenCitations Index API (COCI)
 * Batch processing: 5 per batch, 200ms between batches
 */
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
          `https://opencitations.net/index/coci/api/v1/citation-count/doi:${paper.doi}`,
          { timeout: 3000 }
        );
        const duration = Date.now() - start;
        if (response.data && response.data.length > 0) {
          const count = parseInt(response.data[0].count || 0);
          console.log(`  [${idx}] DOI:${paper.doi} -> ${count} atıf (${duration}ms)`);
          if (count > 0) {
            paper.citationCount = Math.max(paper.citationCount || 0, count);
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
