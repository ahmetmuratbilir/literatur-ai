import axios from 'axios';

/**
 * Lens.org API Service
 * Documentation: https://docs.api.lens.org/
 * Requires API Token (LENS_API_KEY)
 */
export const searchLens = async (query, count = 10) => {
  const apiKey = process.env.LENS_API_KEY;
  
  if (!apiKey) {
    // API Key yoksa sessizce boş dön, sistemi bozma
    return { results: [], totalFound: 0 };
  }

  try {
    // Lens.org Scholarly Search API
    const response = await axios.post('https://api.lens.org/scholarly/search', {
      query: {
        match: {
          all: query
        }
      },
      size: count,
      sort: [{ relevance: 'desc' }]
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 6000
    });

    if (!response.data || !response.data.data) {
      return { results: [], totalFound: 0 };
    }

    const totalFound = response.data.total || 0;

    const results = response.data.data.map(item => {
      // Author handling
      const authors = item.authors 
        ? item.authors.map(a => a.full_name).join(', ') 
        : 'Unknown Authors';

      // DOI handling
      const doi = item.external_ids?.find(id => id.type === 'doi')?.value || '';

      const yearNum = parseInt(item.year_published, 10) || 2024;
      return {
        id: `lens-${item.lens_id}`,
        title: item.title || 'Untitled Work',
        creator: authors,
        authors: authors,
        publicationName: item.source?.title || 'Lens.org Indexed',
        year: yearNum,
        doi: doi,
        url: `https://www.lens.org/lens/scholar/article/${item.lens_id}`,
        citedBy: item.scholarly_citations_count || 0,
        description: item.abstract ? item.abstract.substring(0, 500) : '',
        source: 'Lens.org',
        keyCount: 0
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('Lens.org API Error:', error.response?.data || error.message);
    return { results: [], totalFound: 0 };
  }
};
