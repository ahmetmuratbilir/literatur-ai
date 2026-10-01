import axios from 'axios';
import { normalizePublicationDate } from '../utils/dateNormalization.js';

/**
 * DOAJ (Directory of Open Access Journals) API Service
 * Documentation: https://doaj.org/api/docs
 * Rate Limit: 2 requests per second.
 */
export const searchDOAJ = async (query, count = 10) => {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }
  try {
    console.log(`[DOAJ] İstek: q="${String(query).slice(0, 80)}" pageSize=${count}`);
    const response = await axios.get(`https://doaj.org/api/search/articles/${encodeURIComponent(query)}`, {
      params: {
        pageSize: Math.min(count, 100),
        page: 1
      },
      timeout: 6000
    });

    if (!response.data || !response.data.results) {
      console.warn('[DOAJ] Yanıtta results alanı yok');
      return { results: [], totalFound: 0 };
    }

    const totalFound = response.data.total || 0;
    console.log(`[DOAJ] Toplam havuz: ${Number(totalFound).toLocaleString()}. Çekilen: ${response.data.results.length}`);

    const results = response.data.results.map(item => {
      const bib = item.bibjson || {};
      
      // Author handling
      const authors = bib.author 
        ? bib.author.map(a => a.name).join(', ') 
        : 'Unknown Authors';

      // DOI and URL handling
      const identifiers = bib.identifier || [];
      const doiObj = identifiers.find(i => i.type === 'doi');
      const doi = doiObj ? doiObj.id : '';

      const links = bib.link || [];
      const fullTextLink = links.find(l => l.type === 'fulltext')?.url || (links[0] ? links[0].url : '');

      // Yil yoksa UYDURMA: onceki surum `|| 2024` yaziyordu. Yayin tarihi
      // bibjson.year/month'tan normalize ediliyor (diger adaptorlerle ayni yol).
      const month = bib.month ? String(bib.month).padStart(2, '0') : null;
      const dateMetadata = normalizePublicationDate({
        publication_date: bib.year ? (month ? `${bib.year}-${month}` : String(bib.year)) : null,
        created_date: item.created_date,
        last_updated: item.last_updated,
      }, 'DOAJ');
      return {
        id: `doaj-${item.id}`,
        title: bib.title || 'Untitled Paper',
        creator: authors,
        authors: authors,
        publicationName: bib.journal ? bib.journal.title : 'DOAJ Indexed Journal',
        ...dateMetadata,
        year: dateMetadata.publicationYear ?? null,
        doi: doi,
        url: fullTextLink || (doi ? `https://doi.org/${doi}` : ''),
        citedBy: 0,
        description: bib.abstract ? bib.abstract.substring(0, 500) : '',
        source: 'DOAJ',
        keyCount: 0
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('DOAJ API Hatası:', error.message);
    throw error;
  }
};
