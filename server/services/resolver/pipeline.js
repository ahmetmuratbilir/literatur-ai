import { fetchWithTimeout } from '../../utils/http.js';
import { translateToEnglish } from '../../utils/translation.js';
import { findOpenAccessCopy } from '../unpaywall.js';
import { formatReference } from '../bibliography.js';
import { identify, parseCitation } from './parse.js';
import { scoreCandidate, decide, findDiscrepancies, titleSimilarity, matchSurname, fold, stripFiller, FOUND_THRESHOLD } from './validate.js';
import { createLimiter, withRetry } from './ratelimit.js';
import { createCache, cacheKey } from './cache.js';
import * as sources from './sources.js';

/**
 * Makale çözümleyici — şelale (ucuzdan pahalıya).
 *
 *   Katman 0: kimlik (DOI, arXiv, PMID/PMCID, PII) → tekil sorgu; URL → meta
 *             etiketleri → yoksa Wayback. Arama YAPILMAZ.
 *   Katman 1: Crossref query.bibliographic (ücretsiz) → Semantic Scholar +
 *             Europe PMC (paralel) → OpenAlex arama (0,001 $, son çare).
 *
 * Hiçbir adayın ilk sonucu doğrudan kabul edilmez: validate.scoreCandidate.
 * Eşleşme yoksa not_found döner; DOI/URL asla uydurulmaz.
 * Kapsam dışı (ilk sürüm): Zotero translation-server, GitHub/HF, web
 * araması, haberler.
 */

const MAX_CANDIDATES = 5;
const UNPAYWALL_TIMEOUT_MS = 3000;
// En iki aday bu kadar yakınsa girdi belirsizdir: "bulundu" denmez.
const AMBIGUITY_GAP = 0.05;
// Aday olmak için başlık en az bu kadar benzemeli: yalnızca yıl ya da yazar
// tutan ilgisiz makale ("Robust Optimization of … Poultry Farming", 2024)
// eşiği geçiyordu.
const MIN_TITLE_SIM = 0.6;
// Kaynakça satırındaki yıl 1'den fazla farklı ve ilk yazar adayın ilk iki
// yazarından biri değilse aday, benzer başlıklı BAŞKA bir makaledir: uydurma
// "Kumar, Zhang & Patel (2022) Machine learning applications in sustainable
// supply chain management" satırına "Sharma, Kamble, … Kumar (2020)"
// öneriliyordu (Kumar 4. yazar). Böyle aday gösterilmez.
// İlk yazar adayın yazarları arasında HİÇ yoksa ve başlık birebir değilse de
// başka makaledir (yıl tutsa bile): uydurma "Johnson & Lee (2020) Deep
// reinforcement learning for autonomous urban traffic signal control: A
// comprehensive survey" satırına "Rasheed ve ark. (2020) Deep Reinforcement
// Learning for Traffic Signal Control: A Review" öneriliyordu. Başlık birebir
// tutuyorsa aday kalır: soyadı yazımı/çevirisi farklı gerçek makale olabilir.
// Yalnız yapılandırılmış satırda: serbest metindeki yazar adayları tahmin.
const EXACT_TITLE = 0.97;
const contradicts = (c, parsed) => {
  if (!parsed?.structured) return false;
  const lead = parsed.authorCandidates?.[0];
  if (!lead) return false;
  if (c.parts?.author === 0 && (c.parts?.title ?? 0) < EXACT_TITLE) return true;
  return c.parts?.year === 0 && !matchSurname(lead, (c.record?.authors || []).slice(0, 2)).matched;
};
const eligible = (ranked, parsed) => ranked.filter((c) => (c.parts?.title ?? 1) >= MIN_TITLE_SIM && !contradicts(c, parsed));
// Ucuz kaynakta durmak için aday yalnızca eşiği geçmemeli: verilen yıl tam
// tutmalı, yazar çelişmemeli. Crossref'te "Attention Is All You Need" başlıklı
// beş adet 2025 kopyası (10.65215/…) 0,85 alıp aramayı kesiyor, asıl 2017
// makalesini bulacak Semantic Scholar'a hiç sorulmuyordu; "… vaswani 2017"
// serbest metninde de 2018 tarihli bir Japonca özet yazısında duruluyordu.
const strong = (c) => Boolean(c) && c.score >= FOUND_THRESHOLD && (c.parts?.year ?? 1) === 1 && c.parts?.author !== 0;
// Başlık, yıl ve ilk yazar aynıysa aynı eser (farklı DOI'li yayıncı/arşiv kaydı).
const firstFamily = (r) => fold(r?.authors?.[0]?.family || r?.authors?.[0]?.literal || '');
const sameWork = (a, b) => Boolean(a && b) && fold(a.title) === fold(b.title) && a.year === b.year && firstFamily(a) === firstFamily(b);
const DOI_IN_TEXT_RE =/(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/\S+/gi;

/**
 * Kaynakça satırındaki DOI başka bir makaleyi mi gösteriyor? Başlık çok
 * farklıysa ya da ilk yazar tutmuyor ve başlık da birebir değilse evet.
 * Yazar karşılaştırılmıyordu: LeCun'un "Deep learning" künyesindeki DQN
 * makalesinin DOI'si (Mnih ve ark.) "bulundu" sayılıyordu.
 */
function doiPointsElsewhere(parsed, record) {
  if (!parsed.structured || !parsed.title || !record?.title) return false;
  const sim = titleSimilarity(parsed.title, record.title, { structured: true });
  const firstAuthor = parsed.authorCandidates?.[0];
  const authorOk = !firstAuthor || !(record.authors || []).length || matchSurname(firstAuthor, record.authors).matched;
  return sim < 0.5 || (!authorOk && sim < 0.9);
}
const TURKISH_RE = /[çğıöşüÇĞİÖŞÜ]|\b(ve|ile|bir|makalesi|üzerine|etkisi)\b/i;
const BIOMED_RE = /\b(patient|clinical|cancer|tumou?r|disease|therapy|cell|protein|gene|genom|drug|covid|infection|hospital|medic|surgery|hasta|klinik|kanser|tedavi|hastal)/i;

const CROSSREF_TO_CSL_TYPE = {
  'journal-article': 'article-journal',
  'proceedings-article': 'paper-conference',
  'posted-content': 'article',
  'book-chapter': 'chapter',
  book: 'book',
  'edited-book': 'book',
  monograph: 'book',
  dissertation: 'thesis',
  'report': 'report',
  preprint: 'article',
  article: 'article-journal',
};

export function recordToCsl(r) {
  return {
    id: 'ref-1',
    type: CROSSREF_TO_CSL_TYPE[r.type] || (r.arxiv_id ? 'article' : 'article-journal'),
    title: r.title,
    author: (r.authors || []).map((a) => (a.family ? { family: a.family, given: a.given || undefined } : { literal: a.literal })),
    ...(r.year ? { issued: { 'date-parts': [[r.year]] } } : {}),
    ...(r.venue ? { 'container-title': r.venue } : {}),
    ...(r.volume ? { volume: r.volume } : {}),
    ...(r.issue ? { issue: r.issue } : {}),
    ...(r.pages ? { page: r.pages } : {}),
    ...(r.publisher ? { publisher: r.publisher } : {}),
    ...(r.doi ? { DOI: r.doi } : (r.landing_url ? { URL: r.landing_url } : {})),
  };
}

/** Çıktı şemasındaki `match` nesnesi. */
function toMatch(r, extra = {}) {
  let apa7 = null;
  try { apa7 = formatReference({ ref: 1, csl: recordToCsl(r), title: r.title }, 'APA 7'); } catch { /* biçimlenemedi */ }
  return {
    doi: r.doi || null,
    arxiv_id: r.arxiv_id || null,
    pmid: r.pmid || null,
    openalex_id: r.openalex_id || null,
    title: r.title,
    authors: (r.authors || []).map((a) => ({ family: a.family || a.literal || '', given: a.given || '', orcid: a.orcid || null })),
    year: r.year || null,
    venue: r.venue || null,
    volume: r.volume || null,
    issue: r.issue || null,
    pages: r.pages || null,
    publisher: r.publisher || null,
    type: r.type || null,
    landing_url: r.landing_url || (r.doi ? `https://doi.org/${r.doi}` : null),
    oa_pdf_url: r.oa_url || null,
    oa_status: null,
    in_doaj: r.in_doaj ?? null,
    retracted: r.retraction?.status === 'retracted',
    retraction_status: r.retraction?.status || 'unknown',
    github_repos: [],
    hf_paper_url: null,
    apa7,
    source: r.source,
    ...extra,
  };
}

/** Eksik alanları ikinci kayıttan tamamla (birincinin değerleri korunur). */
function mergeRecords(primary, secondary) {
  if (!secondary) return primary;
  const out = { ...primary };
  for (const [k, v] of Object.entries(secondary)) {
    if (out[k] == null || (Array.isArray(out[k]) && out[k].length === 0) || out[k] === '') out[k] = v;
  }
  return out;
}

const recordKey = (r) => (r.doi ? `doi:${r.doi}` : `t:${fold(r.title)}`);

export function createResolver(deps = {}) {
  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || fetchWithTimeout;
  const schedule = deps.schedule || createLimiter();
  const retry = deps.retry || ((fn, opts) => withRetry(fn, opts));
  const cache = deps.cache || createCache();
  const unpaywall = deps.unpaywall || ((doi) => findOpenAccessCopy(doi, { env }));
  // Çeviri yalnızca ARAMA sorgusu içindir; sonuç her zaman indeksten gelir.
  const translate = deps.translate || (async (text) => (await translateToEnglish(text))?.text || null);
  const S = deps.sources || sources;
  const unpaywallTimeoutMs = deps.unpaywallTimeoutMs ?? UNPAYWALL_TIMEOUT_MS;

  const makeCtx = () => ({ trace: [], env, fetchImpl, schedule, retry, layer: 0 });

  /** Kimlikle tekil sorgu (Katman 0). */
  async function byIdentifier(ctx, id) {
    if (id.doi) return (await S.crossrefWork(ctx, id.doi)) || (await S.doiOrgCsl(ctx, id.doi));
    if (id.arxiv) return S.arxivWork(ctx, id.arxiv);
    if (id.pmid || id.pmcid) return S.europePmcById(ctx, { pmid: id.pmid, pmcid: id.pmcid });
    if (id.pii) return S.crossrefByPii(ctx, id.pii);
    return null;
  }

  /** Aday listesini puanlar, tekilleştirir, en iyiye göre sıralar. */
  function scoreAll(parsed, records, pool) {
    for (const r of records.filter(Boolean)) {
      if (!r.title) continue;
      const { score, parts } = scoreCandidate(parsed, r);
      const key = recordKey(r);
      const prev = pool.get(key);
      if (!prev || score > prev.score) pool.set(key, { record: prev ? mergeRecords(r, prev.record) : r, score, parts });
    }
    return [...pool.values()].sort((a, b) => b.score - a.score);
  }

  /** Katman 1: akademik indekslerde arama, ucuzdan pahalıya. */
  async function search(ctx, parsed, rawText) {
    ctx.layer = 1;
    const pool = new Map();
    // Serbest metinde dolgu sözcükler ("… makalesi", "article") aramayı bozuyor.
    const query = parsed.structured ? (rawText || parsed.title || '') : stripFiller(rawText || parsed.title || '');
    const title = parsed.structured ? (parsed.title || rawText || '') : stripFiller(parsed.title || rawText || '');
    let ranked = scoreAll(parsed, await S.crossrefBibliographic(ctx, query), pool);
    if (strong(ranked[0])) return ranked;

    const parallel = [S.s2Match(ctx, title)];
    if (BIOMED_RE.test(query)) parallel.push(S.europePmcSearch(ctx, title));
    for (const recs of await Promise.all(parallel)) ranked = scoreAll(parsed, recs, pool);
    if (strong(ranked[0])) return ranked;

    ranked = scoreAll(parsed, await S.openAlexSearch(ctx, title), pool);
    return ranked;
  }

  /**
   * Karar: eşik + belirsizlik.
   * - Serbest metinde yazar da yıl da yoksa kanıt yalnız başlıktır: "bulundu"
   *   için 0,95 gerekir.
   * - İlk iki aday birbirine çok yakınsa ("OEE AHP makalesi") belirsizdir.
   * - Çeviriyle bulunan sonuç en fazla "adaylar"dır.
   * - Kaynakçadaki yıl ile 1'den fazla farklıysa en fazla "adaylar"dır:
   *   başlık + yazar tutsa da başka baskı/kopya olabilir (10.65215/… 2025).
   */
  function decideRanked(rankedAll, parsed, { translated = false } = {}) {
    const ranked = eligible(rankedAll, parsed);
    const top = ranked[0];
    if (!top) return 'none';
    let decision = decide(top.score);
    if (decision !== 'found') return decision;
    const titleOnly = !parsed.structured && !(parsed.authorCandidates || []).length && !parsed.year;
    if (translated) return 'candidates';
    if (parsed.structured && top.parts?.year === 0) return 'candidates';
    // Serbest metinde yazar tanınmadıysa kanıt başlık + yıldır; yıl tam
    // tutmalı. "attention is all you need vaswani 2017" 2018 tarihli bir
    // Japonca özet yazısını (başlığında "Vaswani" geçiyor) "bulundu" sayıyordu.
    if (!parsed.structured && parsed.year && !(parsed.authorCandidates || []).length && top.parts?.year !== 1) return 'candidates';
    if (titleOnly && top.score < 0.95) return 'candidates';
    // Aynı eserin ikinci DOI'si rakip değildir: Fornell & Larcker (1981)
    // Crossref'te hem SAGE (10.1177/…) hem JSTOR (10.2307/…) DOI'siyle var,
    // ikisi de 1,0 alıyor ve gerçek künye "belirsiz" sayılıyordu. Başlığı
    // birebir tutan aday, birebir tutmayan rakip yüzünden de belirsiz olmaz
    // (aynı yazarların "… : Algebra and Statistics" makalesi 0,957 alıyor).
    const rival = ranked.slice(1).find((c) => !sameWork(top.record, c.record));
    const exact = (c) => fold(c.record.title) === fold(parsed.title || '');
    if (rival && rival.score >= FOUND_THRESHOLD && top.score - rival.score < AMBIGUITY_GAP && !(exact(top) && !exact(rival))) return 'candidates';
    return decision;
  }

  /** Bulunan kayıt: künyeyi DOI üzerinden Crossref'ten al, sonra zenginleştir. */
  async function canonicalize(ctx, record) {
    let r = record;
    if (r.doi && !['crossref', 'doi.org', 'arxiv'].includes(r.source)) {
      const canon = (await S.crossrefWork(ctx, r.doi)) || (await S.doiOrgCsl(ctx, r.doi));
      if (canon) r = mergeRecords({ ...canon, source: canon.source }, r);
    }
    const tasks = [];
    if (r.doi && !r.openalex_id && !r.doi.startsWith('10.48550/')) {
      tasks.push(S.openAlexWork(ctx, r.doi).then((oa) => {
        if (!oa) return;
        r = { ...r, openalex_id: oa.openalex_id, in_doaj: r.in_doaj ?? oa.in_doaj, oa_url: r.oa_url || oa.oa_url, pmid: r.pmid || oa.pmid, retraction: r.retraction || oa.retraction };
      }));
    }
    let oaStatus = null;
    if (r.doi && !r.doi.startsWith('10.48550/')) {
      // Unpaywall API'si zaman zaman hiç yanıt vermiyor (1 Eki 2026: bağlantı
      // kuruluyor, yanıt 20 sn'de gelmiyor). Çözümlemeyi bekletmesin; açık
      // erişim bağlantısı OpenAlex'ten de geliyor.
      const t0 = Date.now();
      const timeout = new Promise((resolve) => setTimeout(() => resolve({ status: 'timeout' }), unpaywallTimeoutMs));
      tasks.push(Promise.race([Promise.resolve(unpaywall(r.doi)), timeout]).then((u) => {
        const st = u?.status === 'ok' ? 'hit' : (u?.status === 'not_configured' ? 'skipped' : (u?.status === 'not_found' ? 'miss' : 'error'));
        ctx.trace.push({ layer: ctx.layer, source: 'unpaywall', status: st, ms: Date.now() - t0, cost_usd: 0, ...(u?.status === 'timeout' ? { error: 'timeout' } : {}) });
        if (u?.status === 'ok') {
          oaStatus = u.result.oaStatus;
          if (u.result.pdfUrl || u.result.landingUrl) r = { ...r, oa_url: u.result.pdfUrl || u.result.landingUrl };
        }
      }).catch(() => {}));
    }
    await Promise.all(tasks);
    return { record: r, oaStatus };
  }

  async function resolveUncached(input) {
    const ctx = makeCtx();
    const id = identify(input);
    let parsed = id.url ? { title: null, authorCandidates: [], year: null, structured: false } : parseCitation(input);

    // --- Katman 0: kimlik ---
    let direct = await byIdentifier(ctx, id);

    // --- Katman 0: URL alt akışı ---
    if (!direct && id.url && !id.github) {
      let page = await S.fetchPageMeta(ctx, id.url);
      if (!page.ok || (!page.doi && !page.title)) {
        const archived = await S.waybackUrl(ctx, id.url);
        if (archived) page = await S.fetchPageMeta(ctx, archived);
      }
      if (page.ok && page.doi) direct = await byIdentifier(ctx, { doi: page.doi });
      if (!direct && page.ok && page.title) {
        parsed = { title: page.title, authorCandidates: (page.authors || []).slice(0, 1).map((a) => String(a).split(',')[0].trim().split(' ').pop()), year: page.year, structured: false };
      }
    }
    if (id.github) ctx.trace.push({ layer: 2, source: 'github', status: 'skipped', ms: 0, cost_usd: 0 });

    let status;
    let best;
    let candidates = [];
    let confidence = 0;
    let doiMismatch = null;

    if (direct && doiPointsElsewhere(parsed, direct)) {
      // Kaynakça satırındaki DOI başka makaleyi gösteriyor (yazım hatası ya da
      // uydurma). "Bulundu" denmez: künye DOI'siz aranır, bulunan makale ve
      // DOI'nin gösterdiği makale birlikte aday olarak sunulur.
      status = 'candidates';
      doiMismatch = direct;
      const withoutDoi = String(id.text || parsed.raw || '').replace(DOI_IN_TEXT_RE, ' ').trim();
      const ranked = eligible(await search(ctx, parsed, withoutDoi), parsed)
        .filter((c) => c.score >= 0.5 && recordKey(c.record) !== recordKey(direct));
      const self = scoreCandidate(parsed, direct).score;
      // Arayüz ilk 3 adayı gösteriyor: DOI'nin makalesi de görünsün diye 2 + 1.
      candidates = [...ranked.slice(0, 2), { record: direct, score: self }];
      confidence = ranked[0]?.score ?? self;
    } else if (direct) {
      // Kimlik yetkili kaynak.
      best = direct;
      confidence = 1;
      status = 'found';
    } else if (parsed.title) {
      let ranked = await search(ctx, parsed, id.url ? null : id.text);
      let decision = decideRanked(ranked, parsed);
      // Türkçe girdi uluslararası indekste bulunamadıysa İngilizce çeviriyle
      // bir kez daha ara (DergiPark yerel dizini gelene kadar en etkili yol).
      // "Bulundu" değilse çevir: Türkçe aday çıksa bile çoğu yalnızca ortak
      // sözcük tutuyor ("… Tanrı Faktörü"); iki aday listesi birleştirilir.
      if (decision !== 'found' && !id.url && TURKISH_RE.test(id.text)) {
        const english = await translate(id.text).catch(() => null);
        ctx.trace.push({ layer: 1, source: 'translate', status: english ? 'hit' : 'error', ms: 0, cost_usd: 0 });
        if (english && fold(english) !== fold(id.text)) {
          const parsedEn = { ...parseCitation(english), structured: false };
          const rankedEn = await search(ctx, parsedEn, english);
          const decisionEn = decideRanked(rankedEn, parsedEn, { translated: true });
          if (decisionEn !== 'none') {
            const merged = new Map();
            for (const c of [...eligible(rankedEn, parsedEn), ...eligible(ranked, parsed)]) {
              const k = recordKey(c.record);
              if (!merged.has(k) || merged.get(k).score < c.score) merged.set(k, c);
            }
            ranked = [...merged.values()].sort((a, b) => b.score - a.score);
            decision = 'candidates';
          }
        }
      }
      ranked = eligible(ranked, parsed);
      const top = ranked[0];
      if (decision === 'found') {
        status = 'found'; best = top.record; confidence = top.score;
      } else if (decision === 'candidates') {
        status = 'candidates'; confidence = top.score;
        candidates = ranked.filter((c) => c.score >= 0.5).slice(0, MAX_CANDIDATES);
      } else {
        status = 'not_found';
      }
    } else {
      status = 'not_found';
    }

    let match = null;
    let discrepancies = [];
    if (best) {
      ctx.layer = Math.max(ctx.layer, 0);
      const { record, oaStatus } = await canonicalize(ctx, best);
      match = toMatch(record, { oa_status: oaStatus });
      discrepancies = findDiscrepancies(parsed, record);
    }
    if (doiMismatch) {
      discrepancies = [{ field: 'doi', input: doiMismatch.doi || '', canonical: doiMismatch.title, note: 'doi_points_elsewhere' }];
    }

    return {
      status,
      confidence: Math.round(confidence * 1000) / 1000,
      match: status === 'found' ? match : null,
      candidates: status === 'candidates'
        ? candidates.map((c) => (c.record ? { ...toMatch(c.record), score: c.score } : c))
        : [],
      discrepancies,
      trace: ctx.trace,
      cost_usd: Math.round(ctx.trace.reduce((s, t) => s + (t.cost_usd || 0), 0) * 10000) / 10000,
      cached: false,
    };
  }

  return {
    /** Tek girdi. Aynı girdi önbellekteyse hiçbir dış çağrı yapılmaz. */
    async resolve(input) {
      const text = String(input ?? '').trim();
      if (!text) return { status: 'not_found', confidence: 0, match: null, candidates: [], discrepancies: [], trace: [], cost_usd: 0, cached: false, error: 'empty_input' };
      const key = cacheKey(identify(text));
      const hit = await cache.get(key);
      if (hit) return { ...hit, trace: [], cost_usd: 0, cached: true };
      const result = await resolveUncached(text);
      const hadError = result.trace.some((t) => t.status === 'error');
      // Ağ hatası yüzünden bulunamadıysa olumsuz sonucu önbelleğe yazma.
      if (!(result.status === 'not_found' && hadError)) await cache.set(key, { ...result, trace: [] }, result.status);
      return result;
    },
  };
}
