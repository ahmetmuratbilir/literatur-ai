import axios from 'axios';
import { normalizePublicationDate } from '../utils/dateNormalization.js';

/**
 * PubMed (NCBI Entrez E-utilities) — tip, klinik ve saglik arastirmasi.
 * Anahtarsiz: IP basina 3 istek/sn; arama basina 2 istek (ESearch + ESummary).
 *
 * Europe PMC de PubMed kayitlarini iceriyor; ayni makale iki kaynaktan gelirse
 * PMID uzerinden tekillestirilir (searchRankingService.extractAltId).
 *
 * ESummary OZET dondurmuyor ve acik erisim durumunu bildirmiyor. Bu yuzden
 * ozet bos birakilir (baslik tekrarlanirsa alaka puani sisiyor) ve openAccess
 * yalnizca PMC kopyasi varsa true olur.
 */
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

function stripTags(text) {
  return String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Ham ESummary kaydini ortak makale bicimine cevirir. Saf fonksiyon (test icin). */
export function mapPubMedSummary(id, item) {
  const articleIds = Array.isArray(item.articleids) ? item.articleids : [];
  const idOf = (type) => articleIds.find((a) => a.idtype === type)?.value || '';
  const doi = idOf('doi');
  const pmcid = idOf('pmc');

  const yearMatch = String(item.pubdate || item.sortpubdate || '').match(/\b(19|20)\d{2}\b/);
  const dateMetadata = normalizePublicationDate({ pubYear: yearMatch ? yearMatch[0] : null }, 'PubMed');

  const authors = Array.isArray(item.authors)
    ? item.authors.map((a) => a.name).filter(Boolean).join(', ')
    : '';

  return {
    id: `pubmed-${id}`,
    title: stripTags(item.title).replace(/\.$/, '') || 'Untitled Paper',
    creator: authors || 'Unknown Authors',
    authors: authors || 'Unknown Authors',
    publicationName: item.fulljournalname || item.source || 'N/A',
    ...dateMetadata,
    year: dateMetadata.publicationYear ?? null,
    doi,
    volume: item.volume || null,
    issue: item.issue || null,
    pages: item.pages || null,
    pmid: String(id),
    pmcid: pmcid || null,
    url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    citedBy: 0,
    description: '',
    source: 'PubMed',
    type: Array.isArray(item.pubtype) ? (item.pubtype.find((t) => /journal article|review/i.test(t)) || item.pubtype[0] || null) : null,
    openAccess: Boolean(pmcid),
    keyCount: 0,
  };
}

export async function searchPubMed(query, count = 25) {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }
  console.log(`[PubMed] İstek: q="${String(query).slice(0, 80)}" retmax=${count}`);

  const search = await axios.get(`${EUTILS}/esearch.fcgi`, {
    params: { db: 'pubmed', term: String(query).trim(), retmode: 'json', retmax: Math.min(count, 50) },
    timeout: 6000,
  });
  const idList = search.data?.esearchresult?.idlist || [];
  const totalFound = Number.parseInt(search.data?.esearchresult?.count, 10) || 0;
  if (idList.length === 0) return { results: [], totalFound };

  const summary = await axios.get(`${EUTILS}/esummary.fcgi`, {
    params: { db: 'pubmed', id: idList.join(','), retmode: 'json' },
    timeout: 6000,
  });
  const byId = summary.data?.result || {};
  const results = idList
    .filter((id) => byId[id] && !byId[id].error)
    .map((id) => mapPubMedSummary(id, byId[id]));

  console.log(`[PubMed] Toplam havuz: ${totalFound.toLocaleString()}. Çekilen: ${results.length}`);
  return { results, totalFound };
}
