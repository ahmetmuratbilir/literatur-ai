import axios from 'axios';

/**
 * OpenCitations Index API (COCI)
 * Purpose: Citation count verification using /citation-count/ endpoint
 */
export const enrichWithCitations = async (results) => {
  const topResults = results.slice(0, 20); // Test i\u00e7in say\u0131y\u0131 20'ye d\u00fc\u015f\u00fcrd\u00fcm
  const papersWithDoi = topResults.filter(r => r.doi && r.doi.length > 0);
  
  if (papersWithDoi.length === 0) {
    console.log("OpenCitations: DOI'si olan makale bulunamadı, atlanıyor.");
    return results;
  }

  console.log(`OpenCitations: ${papersWithDoi.length} makale i\u00e7in do\u011frulama ba\u015flat\u0131l\u0131yor...`);

  const citationPromises = papersWithDoi.map(async (paper, index) => {
    try {
      const start = Date.now();
      const response = await axios.get(`https://opencitations.net/index/coci/api/v1/citation-count/doi:${paper.doi}`, {
        timeout: 4000 
      });
      const duration = Date.now() - start;

      if (response.data && response.data.length > 0) {
        const count = parseInt(response.data[0].count || 0);
        console.log(`  [${index+1}] DOI:${paper.doi} -> ${count} at\u0131f (${duration}ms)`);
        if (count > 0) {
          paper.citationCount = Math.max(paper.citationCount || 0, count);
          paper.openCitationVerified = true;
        }
      } else {
        console.log(`  [${index+1}] DOI:${paper.doi} -> Veri yok (${duration}ms)`);
      }
    } catch (error) {
      console.log(`  [${index+1}] DOI:${paper.doi} -> HATA: ${error.message}`);
    }
  });

  await Promise.allSettled(citationPromises);
  console.log('OpenCitations: Do\u011frulama tamamland\u0131.');
  return results;
};
