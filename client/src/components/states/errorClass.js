/**
 * İstek hatasını kullanıcıya söylenecek sınıfa çevirir (WO-021, etkileşim
 * planı §5.1). Saf modül: axios hatası ya da benzeri nesne alır.
 *
 * Her sınıfın mesajı üç şeyi söyler: ne oldu, bir şey kaybedildi mi, ne
 * yapılacak. "Bir hata oluştu" tek başına kullanılmaz (§5.2).
 */

export const ERROR_KINDS = ['cancelled', 'offline', 'network', 'timeout', 'auth', 'rate', 'sources', 'unavailable', 'server', 'request'];

/**
 * @param {any} err axios hatası
 * @param {{ online?: boolean }} env tarayıcı durumu (navigator.onLine)
 * @returns {{ kind: string, retryAfter?: number, failedSources?: Array<{name:string}>, message?: string, status?: number }}
 */
export function classifyError(err, { online = true } = {}) {
  if (!err) return { kind: 'server' };
  if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.name === 'AbortError') return { kind: 'cancelled' };
  const res = err.response;
  if (!res) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || /timeout/i.test(err.message || '')) return { kind: 'timeout' };
    return { kind: online ? 'network' : 'offline' };
  }
  const status = Number(res.status) || 0;
  const data = res.data && typeof res.data === 'object' ? res.data : {};
  if (status === 401) return { kind: 'auth', status };
  if (status === 429) {
    const header = res.headers?.['retry-after'] ?? res.headers?.['Retry-After'];
    const seconds = Number(header);
    return { kind: 'rate', status, retryAfter: Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.round(seconds), 300) : 30 };
  }
  if (data.code === 'SOURCES_UNAVAILABLE') return { kind: 'sources', status, failedSources: Array.isArray(data.failedSources) ? data.failedSources : [] };
  if (status === 504) return { kind: 'timeout', status };
  if (status === 502 || status === 503) return { kind: 'unavailable', status };
  if (status >= 500) return { kind: 'server', status, message: typeof data.error === 'string' ? data.error : undefined };
  if (status >= 400) return { kind: 'request', status, message: typeof data.error === 'string' ? data.error : undefined };
  return { kind: 'server', status };
}

const SOURCE_LABELS = {
  SemanticScholar: 'Semantic Scholar', semanticscholar: 'Semantic Scholar', s2: 'Semantic Scholar',
  EuropePMC: 'Europe PMC', europepmc: 'Europe PMC', ArXiv: 'arXiv', arxiv: 'arXiv',
  openalex: 'OpenAlex', crossref: 'Crossref', core: 'CORE', doaj: 'DOAJ', pubmed: 'PubMed',
  openaire: 'OpenAIRE', datacite: 'DataCite', scopus: 'Scopus',
};

/** Kaynak kimliğinin okunur adı (sunucu `SemanticScholar`, `europepmc` … gönderir). */
export function sourceLabel(name) {
  return SOURCE_LABELS[name] || String(name || '');
}

/**
 * Gerçekten yanıt veren kaynaklar: sorgulananlardan yanıt vermeyenler çıkar.
 * Sunucunun `sourcesQueried` listesi düşen ve kesicinin atladığı kaynakları da
 * içeriyor; "taranan" ya da "yanıt veren N kaynak" diye onlar sayılmaz (2.8).
 */
export function answeredSources(sourcesQueried, failedSources) {
  const failed = new Set((failedSources || []).map((f) => sourceLabel(f?.name)));
  return [...new Set((sourcesQueried || []).map(sourceLabel).filter((name) => name && !failed.has(name)))];
}

/** Yanıt vermeyen kaynakların tekil, okunur adları. */
export function failedNames(failedSources) {
  return [...new Set((failedSources || []).map((f) => sourceLabel(f?.name)).filter(Boolean))];
}
