import axios from 'axios';
import { normalizePublicationDate } from '../utils/dateNormalization.js';

/**
 * Crossref API Service
 * Documentation: https://api.crossref.org/swagger-ui/index.html
 */
function logDateNormalization(sourceName, dateMetadata) {
  const sourceField = dateMetadata.dateSource
    ? dateMetadata.dateSource.replace(`${sourceName} `, '')
    : 'unknown';
  const selectedYear = dateMetadata.publicationYear ?? dateMetadata.metadataYear ?? null;
  const confidenceText = dateMetadata.publicationYear
    ? dateMetadata.yearConfidence
    : `${dateMetadata.yearConfidence}${dateMetadata.metadataYear ? ' metadata only' : ''}`;
  console.log(`[DATE] ${sourceName} → ${sourceField} → ${selectedYear ?? 'null'} (${confidenceText})`);
}

export const searchCrossref = async (query, count = 10) => {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }
  try {
    const mailto = process.env.CONTACT_EMAIL || 'support@literature-ai.com';
    console.log(`[Crossref] İstek: q="${String(query).slice(0, 80)}" rows=${count}`);

    const response = await axios.get('https://api.crossref.org/works', {
      params: {
        query: query,
        rows: count,
        select: 'DOI,title,author,published,published-print,published-online,issued,created,deposited,indexed,container-title,abstract,type,is-referenced-by-count',
        sort: 'relevance'
      },
      headers: {
        'User-Agent': `LiteratureAI/1.0 (mailto:${mailto})`
      },
      timeout: 6000
    });

    if (!response.data || !response.data.message || !response.data.message.items) {
      console.warn('[Crossref] Yanıtta items alanı yok');
      return { results: [], totalFound: 0 };
    }

    const totalFound = response.data.message['total-results'] || 0;
    console.log(`[Crossref] Toplam havuz: ${Number(totalFound).toLocaleString()}. Çekilen: ${response.data.message.items.length}`);

    const results = response.data.message.items.map(item => {
      const authors = item.author 
        ? item.author.map(a => `${a.given || ''} ${a.family || ''}`.trim()).join(', ') 
        : 'Unknown Authors';

      const title = item.title && item.title[0] ? item.title[0] : 'Untitled Paper';

      const dateMetadata = normalizePublicationDate(item, 'Crossref');
      logDateNormalization('Crossref', dateMetadata);

      return {
        id: `crossref-${item.DOI}`,
        title: title,
        creator: authors,
        authors: authors,
        publicationName: item['container-title'] ? item['container-title'][0] : 'N/A',
        year: dateMetadata.publicationYear ?? null,
        ...dateMetadata,
        doi: item.DOI,
        url: item.DOI ? `https://doi.org/${item.DOI}` : '',
        citedBy: parseInt(item['is-referenced-by-count'], 10) || 0,
        description: item.abstract ? item.abstract.replace(/<[^>]*>?/gm, '').substring(0, 500) : '',
        source: 'Crossref',
        keyCount: 0
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('Crossref API Hatası:', error.message);
    throw error;
  }
};
