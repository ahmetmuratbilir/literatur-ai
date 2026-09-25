import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { normalizePublicationDate } from '../utils/dateNormalization.js';

/**
 * ArXiv API Service
 * Documentation: https://info.arxiv.org/help/api/index.html
 * Rate Limit: Max 1 request per 3 seconds.
 */

function logDateNormalization(sourceName, dateMetadata) {
  const sourceField = dateMetadata.dateSource
    ? dateMetadata.dateSource.replace(`${sourceName} `, '')
    : 'unknown';
  const selectedYear = dateMetadata.publicationYear ?? dateMetadata.metadataYear ?? null;
  console.log(`[DATE] ${sourceName} → ${sourceField} → ${selectedYear ?? 'null'} (${dateMetadata.yearConfidence})`);
}

// Tek yeniden deneme. searchAll Promise.allSettled kullandigi icin bu bekleme
// ARAMANIN TAMAMINI geciktirir: olculen 3.5 sn'lik arama, uc denemeli bir
// backoff ile ~13 sn'ye cikardi. Tek deneme en fazla +3 sn ekler.
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 3000; // arXiv: istekler arasi en az 3 saniye
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * arXiv kota asiminda 429 degil 406 (Not Acceptable) donuyor.
 *
 * Belgelenmis sinir 3 saniyede 1 istektir; ard arda gelen isteklerde 406
 * aliniyor ve istek yeniden denenmedigi icin kaynak o arama icin tamamen
 * dusuyordu. Semantic Scholar'daki retry+backoff kalibinin aynisi.
 */
export function isThrottled(error) {
  const status = error?.response?.status;
  return status === 406 || status === 429 || status === 503;
}

export const searchArXiv = async (query, count = 10) => {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }
  try {
    console.log(`[ArXiv] İstek: q="${String(query).slice(0, 80)}" max=${count}`);

    let response;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await axios.get('https://export.arxiv.org/api/query', {
          params: {
            search_query: `all:${query}`,
            start: 0,
            max_results: count,
            sortBy: 'relevance',
            sortOrder: 'descending'
          },
          timeout: 6000
        });
        break; // Başarılıysa döngüden çık
      } catch (err) {
        const isLast = attempt === MAX_RETRIES;

        if (isThrottled(err) && !isLast) {
          const waitMs = BASE_DELAY_MS * attempt; // 3s, 6s
          console.warn(
            `[ArXiv] Kota asimi HTTP ${err.response?.status} (${attempt}/${MAX_RETRIES}). ${waitMs}ms bekleniyor...`
          );
          await sleep(waitMs);
          continue;
        }

        // Kota disi hatalar ve son deneme: cagirana bildir.
        if (isThrottled(err)) {
          const quotaError = new Error(`ArXiv kota asimi (HTTP ${err.response?.status})`);
          quotaError.name = 'ArXivQuotaError';
          throw quotaError;
        }
        throw err;
      }
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
    
    const jsonObj = parser.parse(response.data);
    
    if (!jsonObj.feed || !jsonObj.feed.entry) {
      return { results: [], totalFound: 0 };
    }

    // Handle single entry case (fast-xml-parser returns object if 1 entry, array if multiple)
    const entries = Array.isArray(jsonObj.feed.entry) 
      ? jsonObj.feed.entry 
      : [jsonObj.feed.entry];

    const totalFound = parseInt(jsonObj.feed['opensearch:totalResults'] || 0);
    console.log(`[ArXiv] Toplam havuz: ${Number(totalFound).toLocaleString()}. Çekilen: ${entries.length}`);

    const results = entries.map(entry => {
      // Authors handling
      let authorList = 'Unknown Authors';
      if (entry.author) {
        if (Array.isArray(entry.author)) {
          authorList = entry.author.map(a => a.name).join(', ');
        } else {
          authorList = entry.author.name || 'Unknown Author';
        }
      }

      // PDF link finding
      const links = Array.isArray(entry.link) ? entry.link : [entry.link];
      const pdfLink = links.find(l => l['@_title'] === 'pdf' || l['@_type'] === 'application/pdf')?.['@_href'] || '';
      const abstractLink = links.find(l => l['@_rel'] === 'alternate')?.['@_href'] || entry.id;

      const dateMetadata = normalizePublicationDate(entry, 'arXiv');
      logDateNormalization('arXiv', dateMetadata);

      return {
        id: `arxiv-${entry.id.split('/').pop()}`,
        title: entry.title ? entry.title.replace(/\n/g, ' ').trim() : 'Untitled Paper',
        creator: authorList,
        authors: authorList,
        publicationName: 'ArXiv Pre-print',
        year: dateMetadata.publicationYear ?? null,
        ...dateMetadata,
        doi: entry['arxiv:doi'] || '',
        url: abstractLink,
        pdfUrl: pdfLink,
        citedBy: 0,
        description: entry.summary ? entry.summary.replace(/\n/g, ' ').trim().substring(0, 500) : '',
        source: 'ArXiv',
        keyCount: 0
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('ArXiv API Hatası:', error.message);
    throw error;
  }
};
