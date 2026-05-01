import axios from 'axios';

/**
 * Semantic Scholar API Service
 * Documentation: https://api.semanticscholar.org/api-docs/graph#tag/Paper-Data/operation/get_graph_get_paper_search
 */
export const searchSemanticScholar = async (query, count = 10) => {
  try {
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    
    const response = await axios.get('https://api.semanticscholar.org/graph/v1/paper/search', {
      params: {
        query: query,
        limit: count,
        fields: 'title,authors,year,url,abstract,citationCount,venue,externalIds'
      },
      headers: {
        'x-api-key': apiKey
      },
      timeout: 8000
    });

    if (!response.data || !response.data.data) {
      return { results: [], totalFound: 0 };
    }

    const totalFound = response.data.total || 0;

    const results = response.data.data.map(item => {
      const authors = item.authors 
        ? item.authors.map(a => a.name).join(', ') 
        : 'Unknown Authors';

      return {
        id: `s2-${item.paperId}`,
        title: item.title || 'Untitled Paper',
        authors: authors,
        publicationName: item.venue || 'N/A',
        year: (item.year || 'N/A').toString(),
        doi: item.externalIds?.DOI || '',
        url: item.url || '',
        description: item.abstract ? item.abstract.substring(0, 500) : 'No abstract available.',
        source: 'Semantic Scholar',
        citationCount: item.citationCount || 0,
        relevanceScore: 0.9 // Higher weight for Semantic Scholar usually means quality
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('Semantic Scholar API Error:', error.message);
    return { results: [], totalFound: 0 };
  }
};
