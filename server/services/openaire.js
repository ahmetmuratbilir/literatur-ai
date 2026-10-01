import axios from 'axios';
import { normalizePublicationDate } from '../utils/dateNormalization.js';

/**
 * OpenAIRE Graph API — Avrupa açık bilim kümesi: dergiler, kurumsal arşivler
 * (Türk üniversite arşivleri dahil), tezler, preprint'ler. Anahtar gerekmez.
 *
 * Ölçülen (1 Eki 2026): "overall equipment effectiveness" → 7.405 kayıt,
 * ~0,9 sn; anahtarsız sınır başlığı x-ratelimit-limit=7199 (saatlik).
 * Belge: https://graph.openaire.eu/docs/apis/graph-api/
 *
 * Kayıt zengin: DOI, dergi + cilt/sayı/sayfa, erişim hakkı, atıf sayısı, dil.
 * Lisans: metadata CC-BY; tam metin bağlantısı verilir, PDF barındırılmaz.
 */
const BASE = 'https://api.openaire.eu/graph/v1/researchProducts';

const stripTags = (text) => String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** OpenAIRE örnek türü → ortak tür adı (normalizePublicationType'ın tanıdıkları). */
const TYPE_MAP = {
  article: 'journal-article',
  'review': 'review',
  'conference object': 'proceedings-article',
  preprint: 'preprint',
  'part of book or chapter of book': 'book-chapter',
  book: 'book',
};

/** Ham OpenAIRE kaydını ortak makale biçimine çevirir. Saf fonksiyon (test için). */
export function mapOpenAireResult(r) {
  const instance = (r.instances || [])[0] || {};
  const doi = (r.pids || instance.pids || []).find((p) => p?.scheme === 'doi')?.value || '';
  const dateMetadata = normalizePublicationDate({ publicationDate: r.publicationDate || instance.publicationDate || null }, 'OpenAIRE');
  const authors = (r.authors || []).map((a) => a.fullName || [a.name, a.surname].filter(Boolean).join(' ')).filter(Boolean);
  const rawType = String(instance.type || '').toLowerCase();
  const url = (instance.urls || []).find(Boolean) || (doi ? `https://doi.org/${doi}` : '');
  const accessLabel = String(r.bestAccessRight?.label || '').toUpperCase();
  return {
    id: `openaire-${r.id}`,
    title: stripTags(r.mainTitle) || 'Untitled Paper',
    creator: authors.length ? authors.slice(0, 10).join(', ') : 'Unknown Authors',
    authors: authors.length ? authors.slice(0, 10).join(', ') : 'Unknown Authors',
    publicationName: r.container?.name || r.publisher || 'N/A',
    ...dateMetadata,
    year: dateMetadata.publicationYear ?? null,
    doi,
    url,
    citedBy: Number(r.indicators?.citationImpact?.citationCount) || 0,
    description: stripTags((r.descriptions || [])[0]).substring(0, 500),
    source: 'OpenAIRE',
    type: TYPE_MAP[rawType] || (/thesis/.test(rawType) ? 'thesis' : rawType || null),
    sourceType: /thesis/.test(rawType) ? 'Thesis' : (rawType === 'preprint' ? 'Preprint' : undefined),
    openAccess: accessLabel === 'OPEN' || accessLabel === 'OPEN SOURCE',
    language: r.language?.code || null,
    keyCount: 0,
  };
}

export async function searchOpenAIRE(query, count = 25) {
  if (!query || !String(query).trim()) return { results: [], totalFound: 0 };
  console.log(`[OpenAIRE] İstek: q="${String(query).slice(0, 80)}" pageSize=${count}`);
  const response = await axios.get(BASE, {
    params: { search: String(query).slice(0, 300), pageSize: Math.min(count, 100), type: 'publication' },
    headers: { 'User-Agent': 'LiteraturAI/1.0' },
    timeout: 8000,
  });
  const list = response.data?.results;
  if (!Array.isArray(list)) return { results: [], totalFound: 0 };
  const totalFound = Number(response.data.header?.numFound) || 0;
  console.log(`[OpenAIRE] Toplam havuz: ${totalFound.toLocaleString()}. Çekilen: ${list.length}`);
  return { results: list.map(mapOpenAireResult), totalFound };
}
