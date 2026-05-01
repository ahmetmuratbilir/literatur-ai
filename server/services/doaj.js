import axios from 'axios';

/**
 * DOAJ (Directory of Open Access Journals) API Service
 * Documentation: https://doaj.org/api/docs
 * Rate Limit: 2 requests per second.
 */
export const searchDOAJ = async (query, count = 10) => {
  try {
    // DOAJ uses Elasticsearch syntax. /search/articles/{query}
    const response = await axios.get(`https://doaj.org/api/search/articles/${encodeURIComponent(query)}`, {
      params: {
        pageSize: count,
        page: 1
      },
      timeout: 8000
    });

    if (!response.data || !response.data.results) {
      return { results: [], totalFound: 0 };
    }

    const totalFound = response.data.total || 0;

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

      return {
        id: `doaj-${item.id}`,
        title: bib.title || 'Untitled Paper',
        authors: authors,
        publicationName: bib.journal ? bib.journal.title : 'DOAJ Indexed Journal',
        year: bib.year ? bib.year.toString() : (bib.month ? bib.month.toString() : 'N/A'),
        doi: doi,
        url: fullTextLink,
        description: bib.abstract ? bib.abstract.substring(0, 500) : 'No abstract available.',
        source: 'DOAJ',
        relevanceScore: 0.95 // DOAJ is peer-reviewed and high quality
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('DOAJ API Error:', error.message);
    return { results: [], totalFound: 0 };
  }
};
