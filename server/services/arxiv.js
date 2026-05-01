import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

/**
 * ArXiv API Service
 * Documentation: https://info.arxiv.org/help/api/index.html
 * Rate Limit: Max 1 request per 3 seconds.
 */
export const searchArXiv = async (query, count = 10) => {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }
  try {
    console.log(`[ArXiv] İstek: q="${String(query).slice(0, 80)}" max=${count}`);
    const response = await axios.get('https://export.arxiv.org/api/query', {
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

      const yearNum = entry.published ? new Date(entry.published).getFullYear() : 2024;
      return {
        id: `arxiv-${entry.id.split('/').pop()}`,
        title: entry.title ? entry.title.replace(/\n/g, ' ').trim() : 'Untitled Paper',
        creator: authorList,
        authors: authorList,
        publicationName: 'ArXiv Pre-print',
        year: yearNum,
        doi: entry['arxiv:doi'] || '',
        url: abstractLink,
        pdfUrl: pdfLink,
        citedBy: 0,
        description: entry.summary ? entry.summary.replace(/\n/g, ' ').trim().substring(0, 500) : '',
        source: 'ArXiv',
        keyCount: 0,
        relevanceScore: 0.8
      };
    });

    return { results, totalFound };
  } catch (error) {
    console.error('ArXiv API Error:', error.message);
    return { results: [], totalFound: 0 };
  }
};
