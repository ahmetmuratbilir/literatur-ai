import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Citation.js'in ESM ve CommonJS kopyaları ayrı örnekler: eklenti CommonJS
// kopyasına kaydoluyor. İkisi de aynı yoldan yüklenmeli.
const require = createRequire(import.meta.url);
const { Cite, plugins } = require('@citation-js/core');
require('@citation-js/plugin-csl');

/**
 * Kaynakça: Citation.js + resmî CSL stilleri (assets/csl, CC BY-SA 3.0,
 * github.com/citation-style-language/styles).
 *
 * Eski sürüm satırı elle birleştiriyordu: yazarlar "Ismaila Temitayo Sanusi"
 * diye olduğu gibi yazılıyor (APA: "Sanusi, I. T."), cilt/sayı/sayfa hiç
 * yoktu. Şimdi DOI'li makalenin tam künyesi doi.org'dan (Crossref/DataCite
 * içerik anlaşması, CSL-JSON) alınıyor; DOI yoksa elimizdeki alanlardan
 * künye kuruluyor. Eksik alan uydurulmuyor.
 */

const CSL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'csl');

// Kullanıcıya gösterilen biçim adı -> CSL şablonu
const STYLE_FILES = {
  'APA 7': 'apa',
  IEEE: 'ieee',
  MLA: 'modern-language-association',
  Chicago: 'chicago-notes-bibliography',
};

// Chicago 18, cilt/sayı/sayfası olmayan DOI'li makaleye "ahead of print"
// yazıyor. Bizde bu alanların yokluğu makalenin baskı öncesi olduğunu değil,
// künyenin alınamadığını gösterir; yanıltıcı ifadeyi boş bırakıyoruz.
const STYLE_PATCHES = {
  'chicago-notes-bibliography': (xml) => xml.replace(
    '<term name="advance-online-publication">ahead of print</term>',
    '<term name="advance-online-publication"></term>'
  ),
};

const templates = plugins.config.get('@csl').styles;
for (const file of new Set(Object.values(STYLE_FILES))) {
  const name = `la-${file}`;
  if (templates.has(name)) continue;
  const xml = fs.readFileSync(path.join(CSL_DIR, `${file}.csl`), 'utf8');
  templates.add(name, STYLE_PATCHES[file] ? STYLE_PATCHES[file](xml) : xml);
}

const templateFor = (format) => `la-${STYLE_FILES[format] || STYLE_FILES['APA 7']}`;

const clean = (value) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  return !text || lower === 'undefined' || lower === 'null' || lower === 'mevcut degil' ? '' : text;
};

export const normalizeDoi = (doi) => clean(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase();

// --- Yazar ayrıştırma (DOI'siz makaleler için) ---------------------------

const TURKISH_RE = /[çğıöşüÇĞİÖŞÜ]/u;
const INITIALS_RE = /^([A-ZÇĞİÖŞÜ]\.?\s?-?)+$/u;
const NON_PERSON_RE = /^(bilinmeyen|bilinmiyor|unknown|anonymous|n\/a)/i;

/**
 * "Ada Lovelace, Alan M. Turing" ya da "Lovelace, A., Turing, A. M." biçimini
 * CSL yazarlarına çevirir. Tek kelimelik ad (kurum) literal kalır.
 */
export function parseAuthors(authors) {
  const parts = clean(authors).split(/\s*;\s*|\s*,\s*|\s+and\s+|\s*&\s*/).filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].replace(/\s+et al\.?$/i, '');
    if (!part || NON_PERSON_RE.test(part)) continue;
    // "Soyad, A. B." : sonraki parça yalnızca baş harfse ikisi tek kişidir
    const next = parts[i + 1];
    if (next && INITIALS_RE.test(next) && !INITIALS_RE.test(part)) {
      out.push({ family: part, given: next });
      i++;
      continue;
    }
    const words = part.split(' ');
    if (words.length === 1) out.push({ literal: part });
    else out.push({ family: words[words.length - 1], given: words.slice(0, -1).join(' ') });
  }
  return out;
}

/** Elimizdeki alanlardan CSL-JSON. */
export function paperToCsl(paper, id) {
  const item = { id, type: 'article-journal', title: clean(paper.title) || 'Untitled' };
  // CSL, dili belirtilmemiş başlığı İngilizce sayıp büyük harf kuralı uygular;
  // Türkçe başlık özgün yazımıyla kalmalı.
  if (TURKISH_RE.test(item.title)) item.language = 'tr';
  const authors = parseAuthors(paper.authors);
  if (authors.length) item.author = authors;
  const year = Number.parseInt(clean(paper.year), 10);
  if (Number.isFinite(year) && year > 0) item.issued = { 'date-parts': [[year]] };
  const journal = clean(paper.journal);
  if (journal && !/^bilinmeyen/i.test(journal)) item['container-title'] = journal;
  const doi = normalizeDoi(paper.doi);
  if (doi) item.DOI = doi;
  else if (clean(paper.url)) item.URL = clean(paper.url);
  return item;
}

// --- doi.org künye önbelleği -------------------------------------------

const DOI_CACHE_MAX = 500;
const doiCache = new Map();
const remember = (doi, value) => {
  if (doiCache.size >= DOI_CACHE_MAX) doiCache.delete(doiCache.keys().next().value);
  doiCache.set(doi, value);
};

async function fetchCslByDoi(doi, { timeoutMs, fetchImpl }) {
  if (doiCache.has(doi)) return doiCache.get(doi);
  try {
    const res = await fetchImpl(`https://doi.org/${encodeURIComponent(doi).replace(/%2F/g, '/')}`, {
      headers: { Accept: 'application/vnd.citationstyles.csl+json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      // 404 kalıcı: tekrar sorma. Diğer hatalar geçici olabilir.
      if (res.status === 404) remember(doi, null);
      return null;
    }
    const data = await res.json();
    const csl = data && typeof data === 'object' && data.title ? data : null;
    remember(doi, csl);
    return csl;
  } catch {
    return null;
  }
}

// Kaynakçada gerekmeyen, bazen çok büyük alanlar (atıf listesi vb.)
const DROP_FIELDS = ['source', 'reference', 'abstract', 'license', 'link', 'funder', 'assertion', 'relation', 'content-domain', 'indexed', 'deposited', 'created', 'score'];

/**
 * DOI'li makalelere tam künyeyi ekler (paper.csl). Üretimden önce bir kez
 * çağrılır; buildBibliographySection eşzamanlı kalabilsin diye.
 * Süre dolarsa ya da DOI çözülmezse makale kendi alanlarıyla biçimlenir.
 */
export async function enrichPapersWithCsl(papers, { timeoutMs = 3500, fetchImpl = globalThis.fetch } = {}) {
  await Promise.all((papers || []).map(async (paper) => {
    const doi = normalizeDoi(paper.doi);
    if (!doi || paper.csl) return;
    const csl = await fetchCslByDoi(doi, { timeoutMs, fetchImpl });
    if (!csl) return;
    const slim = { ...csl };
    for (const field of DROP_FIELDS) delete slim[field];
    paper.csl = slim;
  }));
  return papers;
}

// --- Biçimlendirme -------------------------------------------------------

const stripHtml = (text) => String(text || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#38;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

/** Tek bir makalenin kaynakça satırı (düz metin). */
export function formatReference(paper, format) {
  const base = paperToCsl(paper, `ref-${paper.ref ?? 'x'}`);
  const item = paper.csl ? { ...paper.csl, id: base.id } : base;
  // CSL-JSON'da DOI yoksa bile elimizdeki DOI'yi kaybetme
  if (!item.DOI && base.DOI) item.DOI = base.DOI;
  if (!item.DOI && !item.URL && base.URL) item.URL = base.URL;
  if (!item.language && base.language) item.language = base.language;
  try {
    const out = new Cite(item).format('bibliography', { format: 'text', template: templateFor(format), lang: 'en-US' });
    const text = stripHtml(out);
    // IEEE: numara makalenin kendi ref değeri (metin içi [n] ile eşleşmeli)
    return format === 'IEEE' && paper.ref != null ? text.replace(/^\[\d+\]/, `[${paper.ref}]`) : text;
  } catch {
    return null;
  }
}

export { STYLE_FILES };
