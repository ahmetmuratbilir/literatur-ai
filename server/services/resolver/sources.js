import { XMLParser } from 'fast-xml-parser';
import { fetchWithTimeout } from '../../utils/http.js';
import { parseRetraction } from '../retraction.js';
import { stripHtml } from './validate.js';

/**
 * Makale çözümleyici — kaynak adaptörleri. Hepsi aynı kanonik kayıt
 * biçimini döndürür:
 *   { source, title, authors: [{family, given, literal, orcid}], year, venue,
 *     volume, issue, pages, publisher, type, doi, arxiv_id, pmid, pmcid,
 *     openalex_id, landing_url, issn, in_doaj, oa_url, retraction, score }
 *
 * Her çağrı ctx.trace'e { layer, source, status, ms, cost_usd } yazar.
 * Ölçülen (1 Eki 2026): OpenAlex tekil kayıt 0 $, arama 0,001 $ (yanıt
 * başlığı x-ratelimit-cost-usd); arXiv DataCite DOI'si doi.org'dan CSL
 * döndürüyor; Crossref alternative-id filtresi ScienceDirect PII'sini çözüyor.
 */

const contactEmail = (env = process.env) => {
  const mail = env.CONTACT_EMAIL || env.OPENALEX_MAIL || env.UNPAYWALL_EMAIL || '';
  return /example\.(com|org|net)$/i.test(mail) ? '' : mail;
};
const userAgent = (env) => `LiteraturAI/0.1${contactEmail(env) ? ` (mailto:${contactEmail(env)})` : ''}`;
const cleanDoi = (doi) => String(doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase() || null;
const first = (v) => (Array.isArray(v) ? v[0] : v) || null;
const toYear = (dateParts) => {
  const y = Number(first(first(dateParts?.['date-parts'])));
  return Number.isFinite(y) && y > 0 ? y : null;
};
const splitName = (display) => {
  const words = String(display || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { family: words[0] || '', given: '' };
  return { family: words[words.length - 1], given: words.slice(0, -1).join(' ') };
};

/**
 * Tek bir HTTP isteği: hız sınırı + yeniden deneme + trace.
 * @returns {Promise<{ok, status, data, entry}>}
 */
export async function request(ctx, { source, limitKey = source, url, headers = {}, as = 'json', timeoutMs = 10000, redirect = 'follow', retries = 3, retryBaseMs = 800 }) {
  const entry = { layer: ctx.layer ?? 0, source, status: 'miss', ms: 0, cost_usd: 0 };
  ctx.trace.push(entry);
  const t0 = Date.now();
  try {
    const res = await ctx.schedule(limitKey, () => ctx.retry(() => ctx.fetchImpl(url, { headers: { 'User-Agent': userAgent(ctx.env), ...headers }, redirect }, timeoutMs), { retries, baseMs: retryBaseMs }));
    entry.ms = Date.now() - t0;
    const cost = Number.parseFloat(res.headers?.get?.('x-ratelimit-cost-usd'));
    if (Number.isFinite(cost)) entry.cost_usd = cost;
    if (!res.ok) {
      entry.status = res.status === 404 ? 'miss' : 'error';
      entry.http = res.status;
      return { ok: false, status: res.status, data: null, entry };
    }
    const data = as === 'text' ? await res.text() : await res.json();
    if (res.url) entry.finalUrl = res.url;
    return { ok: true, status: res.status, data, entry, finalUrl: res.url || url };
  } catch (error) {
    entry.ms = Date.now() - t0;
    entry.status = 'error';
    entry.error = error?.name === 'AbortError' ? 'timeout' : String(error?.message || error).slice(0, 120);
    return { ok: false, status: 0, data: null, entry };
  }
}

// request() ag hatasini ya da 404 disi HTTP hatasini 'error' isaretliyor; burada
// ezilmemeli. Eziliyordu: gecici bir hata 'miss' olup "makale yok" sayiliyor,
// pipeline.resolve() de onu 24 saat onbellege yaziyordu (yalnizca 'error'
// iceren olumsuz sonuclari atliyor).
const hit = (r, n) => { if (r.entry.status !== 'error') r.entry.status = n > 0 ? 'hit' : 'miss'; };

// --- Eşleyiciler ----------------------------------------------------------

// Yayıncı kayıtlarında soyad eki bazen ada yapışıyor: Crossref'te
// {given: "Sebastiano Di", family: "Luozzo"}. Gerçek soyad "Di Luozzo";
// APA da eki soyadla yazar. Ad birden çok sözcükse ve eki ile bitiyorsa taşı.
const PARTICLES = new Set(['di', 'de', 'da', 'del', 'della', 'van', 'von', 'der', 'den', 'du', 'dos', 'das', 'le', 'la', 'el', 'al', 'ten', 'ter']);
export function fixParticle(author) {
  const words = String(author.given || '').trim().split(/\s+/);
  if (words.length < 2 || !author.family) return author;
  const tail = words[words.length - 1];
  if (!PARTICLES.has(tail.toLowerCase())) return author;
  return { ...author, given: words.slice(0, -1).join(' '), family: `${tail} ${author.family}` };
}

export function fromCsl(item, source = 'crossref') {
  if (!item) return null;
  const doi = cleanDoi(item.DOI);
  return {
    source,
    title: stripHtml(first(item.title)),
    authors: (item.author || []).map((a) => fixParticle({
      family: a.family || '', given: a.given || '', literal: a.name || a.literal || '',
      orcid: a.ORCID ? String(a.ORCID).replace(/^https?:\/\/orcid\.org\//, '') : null,
    })).filter((a) => a.family || a.literal),
    year: toYear(item.issued) || toYear(item['published-print']) || toYear(item['published-online']) || toYear(item.published),
    venue: stripHtml(first(item['container-title'])) || null,
    volume: item.volume ? String(item.volume) : null,
    issue: item.issue ? String(item.issue) : null,
    pages: item.page ? String(item.page).replace('–', '-') : (item['article-number'] ? String(item['article-number']) : null),
    publisher: item.publisher || null,
    type: item.type || null,
    doi,
    arxiv_id: null,
    pmid: null,
    pmcid: null,
    openalex_id: null,
    landing_url: doi ? `https://doi.org/${doi}` : (item.URL || null),
    issn: item.ISSN || [],
    in_doaj: null,
    oa_url: null,
    retraction: Array.isArray(item['updated-by']) ? parseRetraction(item) : null,
    score: typeof item.score === 'number' ? item.score : null,
  };
}

export function fromOpenAlex(w) {
  if (!w) return null;
  const loc = w.primary_location || {};
  const b = w.biblio || {};
  return {
    source: 'openalex',
    title: stripHtml(w.title || w.display_name),
    // OpenAlex yapılandırılmış soyad vermiyor; kanonik kayıt mümkünse
    // Crossref'ten alınır (pipeline), bu yalnızca eşleştirme için.
    authors: (w.authorships || []).map((a) => ({ ...splitName(a.author?.display_name || a.raw_author_name), orcid: a.author?.orcid ? String(a.author.orcid).replace(/^https?:\/\/orcid\.org\//, '') : null })),
    year: w.publication_year || null,
    venue: loc.source?.display_name || null,
    volume: b.volume || null,
    issue: b.issue || null,
    pages: b.first_page ? (b.last_page && b.last_page !== b.first_page ? `${b.first_page}-${b.last_page}` : b.first_page) : null,
    publisher: loc.source?.host_organization_name || null,
    type: w.type || null,
    doi: cleanDoi(w.doi),
    arxiv_id: null,
    pmid: w.ids?.pmid ? String(w.ids.pmid).replace(/\D/g, '') : null,
    pmcid: w.ids?.pmcid ? String(w.ids.pmcid).split('/').pop() : null,
    openalex_id: w.id ? String(w.id).split('/').pop() : null,
    landing_url: loc.landing_page_url || (w.doi || null),
    issn: loc.source?.issn || [],
    in_doaj: typeof loc.source?.is_in_doaj === 'boolean' ? loc.source.is_in_doaj : null,
    oa_url: w.open_access?.oa_url || null,
    retraction: w.is_retracted ? { status: 'retracted', notices: [] } : null,
    score: null,
  };
}

export function fromS2(p) {
  if (!p) return null;
  const ext = p.externalIds || {};
  return {
    source: 's2',
    title: stripHtml(p.title),
    authors: (p.authors || []).map((a) => ({ ...splitName(a.name), orcid: null })),
    year: p.year || null,
    venue: p.venue || null,
    volume: null, issue: null, pages: null, publisher: null, type: null,
    doi: cleanDoi(ext.DOI),
    arxiv_id: ext.ArXiv || null,
    pmid: ext.PubMed ? String(ext.PubMed) : null,
    pmcid: ext.PubMedCentral ? `PMC${ext.PubMedCentral}` : null,
    openalex_id: null,
    landing_url: p.url || null,
    issn: [], in_doaj: null,
    oa_url: p.openAccessPdf?.url || null,
    retraction: null,
    score: typeof p.matchScore === 'number' ? p.matchScore : null,
  };
}

export function fromEuropePmc(r) {
  if (!r) return null;
  const ji = r.journalInfo || {};
  return {
    source: 'europepmc',
    title: stripHtml(r.title).replace(/\.$/, ''),
    authors: (r.authorList?.author || []).map((a) => ({ family: a.lastName || '', given: a.firstName || '', literal: a.collectiveName || '', orcid: a.authorId?.type === 'ORCID' ? a.authorId.value : null })).filter((a) => a.family || a.literal),
    year: Number(r.pubYear) || null,
    venue: ji.journal?.title || r.journalTitle || null,
    volume: ji.volume || null,
    issue: ji.issue || null,
    pages: r.pageInfo || null,
    publisher: null,
    type: r.pubType || null,
    doi: cleanDoi(r.doi),
    arxiv_id: null,
    pmid: r.pmid || null,
    pmcid: r.pmcid || null,
    openalex_id: null,
    landing_url: r.doi ? `https://doi.org/${cleanDoi(r.doi)}` : (r.pmid ? `https://europepmc.org/article/MED/${r.pmid}` : null),
    issn: [], in_doaj: null, oa_url: null, retraction: null, score: null,
  };
}

// --- Tekil sorgular (Katman 0) -------------------------------------------

const CROSSREF_SELECT = 'DOI,title,author,issued,published,published-print,published-online,container-title,volume,issue,page,article-number,type,publisher,score,ISSN,URL,updated-by';
const mailParam = (env) => (contactEmail(env) ? `&mailto=${encodeURIComponent(contactEmail(env))}` : '');

export async function crossrefWork(ctx, doi) {
  const r = await request(ctx, { source: 'crossref', url: `https://api.crossref.org/works/${encodeURIComponent(doi)}?${mailParam(ctx.env).slice(1)}` });
  hit(r, r.ok ? 1 : 0);
  return r.ok ? fromCsl(r.data?.message, 'crossref') : null;
}

/** DataCite vb. (Crossref'te olmayan DOI): doi.org içerik anlaşması. */
export async function doiOrgCsl(ctx, doi) {
  const r = await request(ctx, { source: 'doi.org', limitKey: 'doiorg', url: `https://doi.org/${encodeURI(doi)}`, headers: { Accept: 'application/vnd.citationstyles.csl+json' } });
  const ok = r.ok && r.data && r.data.title;
  hit(r, ok ? 1 : 0);
  return ok ? fromCsl(r.data, 'doi.org') : null;
}

export async function openAlexWork(ctx, doi) {
  const key = ctx.env.OPENALEX_API_KEY ? `&api_key=${encodeURIComponent(ctx.env.OPENALEX_API_KEY)}` : '';
  const r = await request(ctx, { source: 'openalex', url: `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?${mailParam(ctx.env).slice(1)}${key}` });
  hit(r, r.ok ? 1 : 0);
  return r.ok ? fromOpenAlex(r.data) : null;
}

export async function crossrefByPii(ctx, pii) {
  const r = await request(ctx, { source: 'crossref', limitKey: 'crossref-list', url: `https://api.crossref.org/works?filter=alternative-id:${encodeURIComponent(pii)}&rows=2&select=${CROSSREF_SELECT}${mailParam(ctx.env)}` });
  const items = r.ok ? r.data?.message?.items || [] : [];
  hit(r, items.length);
  return items.length === 1 ? fromCsl(items[0], 'crossref') : null;
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

/** arXiv: önce DataCite DOI'si (tek çağrı, CSL), olmazsa arXiv API. */
export async function arxivWork(ctx, id) {
  const viaDoi = await doiOrgCsl(ctx, `10.48550/arxiv.${id}`);
  if (viaDoi) return { ...viaDoi, source: 'arxiv', arxiv_id: id, landing_url: `https://arxiv.org/abs/${id}` };
  const r = await request(ctx, { source: 'arxiv', url: `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, as: 'text' });
  const entry = r.ok ? xml.parse(r.data)?.feed?.entry : null;
  const e = Array.isArray(entry) ? entry[0] : entry;
  hit(r, e?.title ? 1 : 0);
  if (!e?.title) return null;
  const authors = (Array.isArray(e.author) ? e.author : [e.author]).filter(Boolean).map((a) => splitName(a.name));
  return {
    source: 'arxiv', title: stripHtml(e.title), authors, year: Number(String(e.published || '').slice(0, 4)) || null,
    venue: 'arXiv', volume: null, issue: null, pages: null, publisher: 'arXiv', type: 'preprint',
    doi: cleanDoi(e['arxiv:doi']?.['#text'] || e['arxiv:doi']) || `10.48550/arxiv.${id}`,
    arxiv_id: id, pmid: null, pmcid: null, openalex_id: null, landing_url: `https://arxiv.org/abs/${id}`,
    issn: [], in_doaj: null, oa_url: `https://arxiv.org/pdf/${id}`, retraction: null, score: null,
  };
}

export async function europePmcById(ctx, { pmid, pmcid }) {
  const query = pmid ? `EXT_ID:${pmid} AND SRC:MED` : `PMCID:${pmcid}`;
  const r = await request(ctx, { source: 'europepmc', url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core&pageSize=1` });
  const item = r.ok ? r.data?.resultList?.result?.[0] : null;
  hit(r, item ? 1 : 0);
  return item ? fromEuropePmc(item) : null;
}

// --- Aramalar (Katman 1) --------------------------------------------------

// Crossref aynı makalenin hakem raporlarını ayrı kayıt olarak tutuyor
// ("Author response for …", DOI'si …/v2/response1). Neredeyse aynı başlıkla
// geldikleri için gerçek makaleyi "belirsiz" gösteriyorlardı.
const NON_WORK_TYPES = new Set(['peer-review', 'component', 'grant', 'database', 'dataset']);
const isSubRecord = (item) => NON_WORK_TYPES.has(item?.type)
  || /\/v\d+\/(review|decision|response|reply)\d*$/i.test(item?.DOI || '')
  || /^(review for|decision letter for|author response for|reply to reviewers)/i.test(first(item?.title) || '');

/** Crossref query.bibliographic: ham kaynakça satırı için en güçlü, ücretsiz. */
export async function crossrefBibliographic(ctx, text, rows = 5) {
  const r = await request(ctx, { source: 'crossref', limitKey: 'crossref-list', url: `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(text.slice(0, 600))}&rows=${rows}&select=${CROSSREF_SELECT}${mailParam(ctx.env)}` });
  const items = (r.ok ? r.data?.message?.items || [] : []).filter((i) => !isSubRecord(i));
  hit(r, items.length);
  return items.map((i) => fromCsl(i, 'crossref'));
}

/** OpenAlex arama: ücretli (0,001 $); yalnız ücretsizler sonuç vermezse. */
export async function openAlexSearch(ctx, title, rows = 5) {
  const key = ctx.env.OPENALEX_API_KEY ? `&api_key=${encodeURIComponent(ctx.env.OPENALEX_API_KEY)}` : '';
  const r = await request(ctx, { source: 'openalex', url: `https://api.openalex.org/works?search=${encodeURIComponent(title.slice(0, 300))}&per-page=${rows}${mailParam(ctx.env)}${key}` });
  const items = r.ok ? r.data?.results || [] : [];
  if (r.ok && typeof r.data?.meta?.cost_usd === 'number') r.entry.cost_usd = r.data.meta.cost_usd;
  hit(r, items.length);
  return items.map(fromOpenAlex);
}

/** Semantic Scholar başlık eşleştirme; 404 = eşleşme yok. */
export async function s2Match(ctx, title) {
  const key = ctx.env.SEMANTIC_SCHOLAR_API_KEY || ctx.env.S2_API_KEY;
  const r = await request(ctx, {
    source: 's2',
    url: `https://api.semanticscholar.org/graph/v1/paper/search/match?query=${encodeURIComponent(title.slice(0, 300))}&fields=title,authors,year,venue,externalIds,url,openAccessPdf`,
    headers: key ? { 'x-api-key': key } : {},
    // İsteğe bağlı kaynak: 429'da uzun bekleme çözümlemeyi 7-8 sn uzatıyordu.
    retries: 1,
    retryBaseMs: 400,
  });
  const item = r.ok ? r.data?.data?.[0] : null;
  hit(r, item ? 1 : 0);
  return item ? [fromS2(item)] : [];
}

export async function europePmcSearch(ctx, title, rows = 5) {
  const q = `TITLE:"${title.replace(/"/g, ' ').slice(0, 250)}"`;
  const r = await request(ctx, { source: 'europepmc', url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&resultType=core&pageSize=${rows}` });
  const items = r.ok ? r.data?.resultList?.result || [] : [];
  hit(r, items.length);
  return items.map(fromEuropePmc);
}

// --- URL alt akışı ----------------------------------------------------------

const decodeEntities = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Sayfadaki <meta> etiketleri ve JSON-LD ScholarlyArticle. */
export function parsePageMeta(html) {
  const meta = {};
  for (const tag of String(html || '').match(/<meta\s[^>]*>/gi) || []) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? '');
    const name = (attrs.name || attrs.property || '').toLowerCase();
    if (!name || attrs.content == null) continue;
    (meta[name] ||= []).push(attrs.content.trim());
  }
  const pick = (...names) => names.map((n) => meta[n]?.[0]).find(Boolean) || null;
  let doi = pick('citation_doi', 'dc.identifier', 'prism.doi', 'bepress_citation_doi', 'dc.identifier.doi');
  let title = pick('citation_title', 'dc.title', 'og:title');
  let authors = meta.citation_author || meta['dc.creator'] || [];
  let date = pick('citation_publication_date', 'citation_date', 'citation_online_date', 'dc.date', 'prism.publicationdate');
  const venue = pick('citation_journal_title', 'prism.publicationname', 'citation_conference_title');

  for (const block of String(html || '').match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
    try {
      const json = JSON.parse(block.replace(/^<script[^>]*>|<\/script>$/gi, ''));
      const nodes = [].concat(json['@graph'] || json);
      const art = nodes.find((n) => /ScholarlyArticle|Article/i.test([].concat(n?.['@type'] || []).join(' ')));
      if (!art) continue;
      title ||= art.headline || art.name || null;
      if (!doi) {
        const ids = [].concat(art.identifier || [], art.sameAs || [], art['@id'] || []).map((x) => (typeof x === 'string' ? x : x?.value || x?.['@id'] || ''));
        doi = ids.find((x) => /10\.\d{4,9}\//.test(x)) || null;
      }
      if (!authors.length && art.author) authors = [].concat(art.author).map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean);
      date ||= art.datePublished || null;
    } catch { /* bozuk JSON-LD */ }
  }
  const doiMatch = doi ? String(doi).match(/10\.\d{4,9}\/\S+/) : null;
  return {
    doi: doiMatch ? cleanDoi(doiMatch[0]) : null,
    title: title ? stripHtml(title) : null,
    authors,
    year: date ? Number(String(date).match(/\d{4}/)?.[0]) || null : null,
    venue,
    pdf: pick('citation_pdf_url'),
  };
}

export async function fetchPageMeta(ctx, url) {
  const r = await request(ctx, { source: 'web', url, as: 'text', headers: { Accept: 'text/html,application/xhtml+xml' } });
  if (!r.ok) return { ok: false, status: r.status, finalUrl: null };
  const meta = parsePageMeta(r.data);
  hit(r, meta.doi || meta.title ? 1 : 0);
  return { ok: true, status: r.status, finalUrl: r.finalUrl, ...meta };
}

/** Wayback Machine: erişilemeyen URL'nin en yakın arşiv kopyası. */
export async function waybackUrl(ctx, url) {
  const r = await request(ctx, { source: 'wayback', url: `https://archive.org/wayback/available?url=${encodeURIComponent(url)}` });
  const snap = r.ok ? r.data?.archived_snapshots?.closest : null;
  hit(r, snap?.available ? 1 : 0);
  return snap?.available ? snap.url : null;
}
