import axios from 'axios';
import { normalizePublicationDate } from '../utils/dateNormalization.js';

/**
 * DataCite — DOI alan tezler, kurumsal arşiv kayıtları, Zenodo, veri setleri.
 * Anahtar gerekmez. Belge: https://support.datacite.org/docs/api-queries
 *
 * Arama YALNIZCA başlıkta: tüm alanlarda arama ilgisiz sonuç getiriyordu.
 * Ölçülen (1 Eki 2026), "overall equipment effectiveness":
 *   tüm alanlar → 388 kayıt, ilk 5'in hiçbiri konuyla ilgili değil;
 *   titles.title:(…) → 43 kayıt, ilk 5'i ilgili.
 * Yalnızca metin türü (resource-type-id=text): veri setleri literatür değil.
 */
const BASE = 'https://api.datacite.org/dois';

const stripTags = (text) => String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Elasticsearch sorgu sözdizimini bozan karakterleri temizler. */
export function titleQuery(query) {
  const words = String(query || '')
    .replace(/\b(AND|OR|NOT)\b/g, ' ')
    .replace(/[+\-=&|><!(){}[\]^"~*?:\\/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);
  return words.length ? `titles.title:(${words.join(' ')})` : '';
}

/** Ham DataCite kaydını ortak makale biçimine çevirir. Saf fonksiyon (test için). */
export function mapDataCiteResult(item) {
  const a = item?.attributes || {};
  const types = a.types || {};
  const resourceType = String(types.resourceType || '').trim().toLowerCase();
  const isThesis = /thesis|dissertation|tez/.test(resourceType) || types.citeproc === 'thesis';
  const isPreprint = /preprint/.test(resourceType);
  const dateMetadata = normalizePublicationDate({ publicationYear: a.publicationYear || null }, 'DataCite');
  const authors = (a.creators || []).map((c) => (c.givenName && c.familyName ? `${c.givenName} ${c.familyName}` : c.name)).filter(Boolean);
  const abstract = (a.descriptions || []).find((d) => d.descriptionType === 'Abstract') || (a.descriptions || [])[0];
  return {
    id: `datacite-${a.doi}`,
    title: stripTags(a.titles?.[0]?.title) || 'Untitled Paper',
    creator: authors.length ? authors.slice(0, 10).join(', ') : 'Unknown Authors',
    authors: authors.length ? authors.slice(0, 10).join(', ') : 'Unknown Authors',
    publicationName: a.container?.title || (typeof a.publisher === 'string' ? a.publisher : a.publisher?.name) || 'N/A',
    ...dateMetadata,
    year: dateMetadata.publicationYear ?? (Number(a.publicationYear) || null),
    doi: a.doi || '',
    url: a.url || (a.doi ? `https://doi.org/${a.doi}` : ''),
    citedBy: Number(a.citationCount) || 0,
    description: stripTags(abstract?.description).substring(0, 500),
    source: 'DataCite',
    type: isThesis ? 'thesis' : (isPreprint ? 'preprint' : (types.citeproc || null)),
    sourceType: isThesis ? 'Thesis' : (isPreprint ? 'Preprint' : undefined),
    openAccess: (a.rightsList || []).some((r) => /creativecommons|open/i.test(`${r.rightsUri || ''} ${r.rights || ''}`)),
    language: a.language || null,
    keyCount: 0,
  };
}

export async function searchDataCite(query, count = 25) {
  const q = titleQuery(query);
  if (!q) return { results: [], totalFound: 0 };
  console.log(`[DataCite] İstek: q="${q.slice(0, 80)}" size=${count}`);
  const response = await axios.get(BASE, {
    params: { query: q, 'page[size]': Math.min(count, 100), 'resource-type-id': 'text' },
    headers: { 'User-Agent': 'LiteraturAI/1.0' },
    timeout: 8000,
  });
  const list = response.data?.data;
  if (!Array.isArray(list)) return { results: [], totalFound: 0 };
  const totalFound = Number(response.data.meta?.total) || 0;
  console.log(`[DataCite] Toplam havuz: ${totalFound.toLocaleString()}. Çekilen: ${list.length}`);
  return { results: list.map(mapDataCiteResult), totalFound };
}
