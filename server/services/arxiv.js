import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

/**
 * ArXiv API Service
 * Documentation: https://info.arxiv.org/help/api/index.html
 * Rate Limit: Max 1 request per 3 seconds.
 */
export const searchArXiv = async (query, count = 10) => {
  try {
    // ArXiv search URL construction
    const response = await axios.get('http://export.arxiv.org/api/query', {
      params: {
        search_query: `all:${query}`,
        start: 0,
        max_results: count,
        sortBy: 'relevance',
        sortOrder: 'descending'
      },
      timeout: 10000
    });

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

      return {
        id: `arxiv-${entry.id.split('/').pop()}`,
        title: entry.title ? entry.title.replace(/\n/g, ' ').trim() : 'Untitled Paper',
        authors: authorList,
        publicationName: 'ArXiv Pre-print',
        year: entry.published ? new Date(entry.published).getFullYear().toString() : 'N/A',
        doi: entry['arxiv:doi'] || '',
        url: abstractLink,
        pdfUrl: pdfLink,
        description: entry.summary ? entry.summary.replace(/\n/g, ' ').trim().substring(0, 500) : 'No abstract available.',
        source: 'ArXiv',
        relevanceScore: 0.8 // Pre-prints are valuable but slightly lower weight than peer-reviewed
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('ArXiv API Error:', error.message);
    return { results: [], totalFound: 0 };
  }
};
