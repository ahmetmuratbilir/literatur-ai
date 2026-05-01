import axios from 'axios';

/**
 * Semantic Scholar API Service
 * Documentation: https://api.semanticscholar.org/api-docs/graph#tag/Paper-Data/operation/get_graph_get_paper_search
 */
export const searchSemanticScholar = async (query, count = 10) => {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }
  try {
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    console.log(`[S2] İstek: q="${String(query).slice(0, 80)}" limit=${count} apiKey=${apiKey ? 'var' : 'yok'}`);

    const headers = {};
    if (apiKey) headers['x-api-key'] = apiKey;

    const response = await axios.get('https://api.semanticscholar.org/graph/v1/paper/search', {
      params: {
        query: query,
        limit: Math.min(count, 100),
        fields: 'title,authors,year,url,abstract,citationCount,venue,externalIds'
      },
      headers,
      timeout: 8000
    });

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
      const yearNum = parseInt(item.year, 10) || 2024;
      return {
        id: `s2-${item.paperId}`,
        title: item.title || 'Untitled Paper',
        creator: authors,
        authors: authors,
        publicationName: item.venue || 'N/A',
        year: yearNum,
        doi: doi,
        url: item.url || (doi ? `https://doi.org/${doi}` : ''),
        citedBy: item.citationCount || 0,
        citationCount: item.citationCount || 0,
        description: item.abstract ? item.abstract.substring(0, 500) : '',
        source: 'Semantic Scholar',
        keyCount: 0,
        relevanceScore: 0.9
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('Semantic Scholar API Error:', error.message);
    return { results: [], totalFound: 0 };
  }
};
