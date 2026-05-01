import axios from 'axios';

/**
 * Crossref API Service
 * Documentation: https://api.crossref.org/swagger-ui/index.html
 */
export const searchCrossref = async (query, count = 10) => {
  try {
    const mailto = process.env.CONTACT_EMAIL || 'support@literature-ai.com';
    
    const response = await axios.get('https://api.crossref.org/works', {
      params: {
        query: query,
        rows: count,
        select: 'DOI,title,author,published,container-title,abstract,type',
        sort: 'relevance'
      },
      headers: {
        'User-Agent': `LiteratureAI/1.0 (mailto:${mailto})`
      },
      timeout: 8000
    });

    if (!response.data || !response.data.message || !response.data.message.items) {
      return { results: [], totalFound: 0 };
    }

    const totalFound = response.data.message['total-results'] || 0;

    const results = response.data.message.items.map(item => {
      const authors = item.author 
        ? item.author.map(a => `${a.given || ''} ${a.family || ''}`.trim()).join(', ') 
        : 'Unknown Authors';

      const title = item.title && item.title[0] ? item.title[0] : 'Untitled Paper';

      const year = item.published && item['published-print'] 
        ? item['published-print']['date-parts'][0][0] 
        : (item.published && item['published-online'] ? item['published-online']['date-parts'][0][0] : 'N/A');

      return {
        id: `crossref-${item.DOI}`,
        title: title,
        authors: authors,
        publicationName: item['container-title'] ? item['container-title'][0] : 'N/A',
        year: year.toString(),
        doi: item.DOI,
        description: item.abstract ? item.abstract.replace(/<[^>]*>?/gm, '').substring(0, 500) : 'No abstract available.',
        source: 'Crossref',
        relevanceScore: 0.85
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('Crossref API Error:', error.message);
    return { results: [], totalFound: 0 };
  }
};
