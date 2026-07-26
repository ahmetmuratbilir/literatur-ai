import axios from 'axios';
import { normalizePublicationDate } from '../utils/dateNormalization.js';

/**
 * Semantic Scholar API Service
 * Documentation: https://api.semanticscholar.org/api-docs/graph#tag/Paper-Data/operation/get_graph_get_paper_search
 *
 * Rate limiting: 429 hatası geldiğinde exponential backoff ile yeniden dener.
 * Max 3 deneme: 1s → 2s → 4s bekleme aralıkları.
 */

function logDateNormalization(sourceName, dateMetadata) {
  const sourceField = dateMetadata.dateSource
    ? dateMetadata.dateSource.replace(`${sourceName} `, '')
    : 'unknown';
  const selectedYear = dateMetadata.publicationYear ?? dateMetadata.metadataYear ?? null;
  console.log(`[DATE] ${sourceName} → ${sourceField} → ${selectedYear ?? 'null'} (${dateMetadata.yearConfidence})`);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const searchSemanticScholar = async (query, count = 10) => {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }
  try {
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    console.log(`[S2] İstek: q="${String(query).slice(0, 80)}" limit=${count} apiKey=${apiKey ? 'var' : 'yok'}`);

    const headers = {};
    if (apiKey) headers['x-api-key'] = apiKey;

    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000;
    let response;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await axios.get('https://api.semanticscholar.org/graph/v1/paper/search', {
          params: {
            query: query,
            limit: Math.min(count, 100),
            fields: 'title,authors,year,publicationDate,url,abstract,citationCount,venue,externalIds'
          },
          headers,
          timeout: 10000
        });
        break; // Başarılıysa döngüden çık
      } catch (err) {
        const is429 = err.response?.status === 429;
        const isLast = attempt === MAX_RETRIES;

        if (is429 && !isLast) {
          const waitMs = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          console.warn(`[S2] 429 Rate limit (${attempt}/${MAX_RETRIES}). ${waitMs}ms bekleniyor...`);
          await sleep(waitMs);
        } else {
          throw err; // 429 değilse veya son denemeyse fırlat
        }
      }
    }

    if (!response.data || !response.data.data) {
      console.warn('[S2] Yanıtta data alanı yok');
      return { results: [], totalFound: 0 };
    }

    const totalFound = response.data.total || 0;
    console.log(`[S2] Toplam havuz: ${Number(totalFound).toLocaleString()}. Çekilen: ${response.data.data.length}`);

    const results = response.data.data.map(item => {
      const authors = item.authors 
        ? item.authors.map(a => a.name).join(', ') 
        : 'Unknown Authors';

      const doi = item.externalIds?.DOI || '';
      const dateMetadata = normalizePublicationDate(item, 'SemanticScholar');
      logDateNormalization('SemanticScholar', dateMetadata);

      return {
        id: `s2-${item.paperId}`,
        title: item.title || 'Untitled Paper',
        creator: authors,
        authors: authors,
        publicationName: item.venue || 'N/A',
        year: dateMetadata.publicationYear ?? null,
        ...dateMetadata,
        doi: doi,
        url: item.url || (doi ? `https://doi.org/${doi}` : ''),
        citedBy: item.citationCount || 0,
        citationCount: item.citationCount || 0,
        description: item.abstract ? item.abstract.substring(0, 500) : '',
        source: 'Semantic Scholar',
        keyCount: 0
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('Semantic Scholar API Hatası:', error.message);
    throw error;
  }
};
