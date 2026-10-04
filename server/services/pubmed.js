import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * PubMed (NCBI Entrez E-utilities) Arama Servisi
 * %100 Ücretsiz - 36M+ tıp, klinik ve sağlık araştırması
 */
export async function searchPubMed(query, count = 10) {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }

  try {
    const term = encodeURIComponent(String(query).trim());
    
    // 1. ESearch ile PMID (PubMed ID) listesini çekiyoruz
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${term}&retmode=json&retmax=${Math.min(count, 20)}`;
    const searchRes = await axios.get(searchUrl, { timeout: 5000 });
    
    const idList = searchRes.data?.esearchresult?.idlist || [];
    const totalFound = parseInt(searchRes.data?.esearchresult?.count || '0', 10);
    
    if (idList.length === 0) {
      return { results: [], totalFound: 0 };
    }

    // 2. ESummary ile makale başlığı, yazarlar, yıl ve dergi bilgilerini alıyoruz
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
    const summaryRes = await axios.get(summaryUrl, { timeout: 5000 });
    const resultObj = summaryRes.data?.result || {};

    const results = idList.map((id) => {
      const item = resultObj[id];
      if (!item) return null;

      const articleIds = Array.isArray(item.articleids) ? item.articleids : [];
      const doiObj = articleIds.find((a) => a.idtype === 'doi');
      const doi = doiObj ? doiObj.value : '';

      let year = null;
      if (item.pubdate) {
        const match = String(item.pubdate).match(/\b(19|20)\d{2}\b/);
        if (match) year = parseInt(match[0], 10);
      }

      const authors = Array.isArray(item.authors)
        ? item.authors.map((a) => a.name).filter(Boolean).join(', ')
        : '';

      return {
        id: `pubmed-${id}`,
        title: item.title ? String(item.title).replace(/<[^>]*>/g, '').trim() : 'PubMed Araştırması',
        authors: authors || 'Belirtilmemiş',
        journal: item.source || item.fulljournalname || 'PubMed / NCBI',
        year: year || new Date().getFullYear(),
        doi: doi || '',
        url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        abstract: item.sorttitle || item.title || '',
        source: 'PubMed',
        citedBy: 0,
        isOpenAccess: true
      };
    }).filter(Boolean);

    return { results, totalFound };
  } catch (error) {
    logger.warn({ error: error.message, query }, '[PubMed] Arama sırasında hata oluştu, atlandı');
    return { results: [], totalFound: 0 };
  }
}
