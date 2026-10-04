import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * Europe PMC REST API - 44M+ yaşam bilimleri, biyomedikal ve tam metin açık erişim yayını
 * %100 Ücretsiz
 */
export async function searchEuropePmc(query, count = 10) {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }

  try {
    const url = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
    const response = await axios.get(url, {
      params: {
        query: String(query).trim(),
        format: 'json',
        pageSize: Math.min(count, 20),
        resultType: 'core'
      },
      timeout: 5000
    });

    const data = response.data?.resultList?.result || [];
    const totalFound = parseInt(response.data?.hitCount || '0', 10);

    const results = data.map((item) => {
      const title = item.title ? String(item.title).replace(/<[^>]*>/g, '').trim() : 'Europe PMC Yayını';
      const year = item.pubYear ? parseInt(item.pubYear, 10) : null;
      const doi = item.doi || '';
      const authors = item.authorString || 'Belirtilmemiş';
      const isOpenAccess = item.isOpenAccess === 'Y';
      const pdfUrl = item.fullTextUrlList?.fullTextUrl?.find((u) => u.documentStyle === 'pdf')?.url || '';

      return {
        id: `epmc-${item.id || doi || Math.random().toString(36).slice(2, 8)}`,
        title,
        authors,
        journal: item.journalTitle || 'Europe PMC',
        year: year || new Date().getFullYear(),
        doi,
        url: doi ? `https://doi.org/${doi}` : (pdfUrl || `https://europepmc.org/article/MED/${item.id}`),
        abstract: item.abstractText ? String(item.abstractText).replace(/<[^>]*>/g, '').trim() : '',
        source: 'Europe PMC',
        citedBy: item.citedByCount ? parseInt(item.citedByCount, 10) : 0,
        isOpenAccess,
        pdfUrl: pdfUrl || undefined
      };
    });

    return { results, totalFound };
  } catch (error) {
    logger.warn({ error: error.message, query }, '[Europe PMC] Arama hatası, atlandı');
    return { results: [], totalFound: 0 };
  }
}
