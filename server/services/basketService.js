import { BASKET_LIMIT, BASKET_AUTHORS_MAX } from '../models/Basket.js';

/**
 * Kaynak sepeti için saf yardımcılar (veritabanına dokunmaz, test edilebilir).
 */

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** İstemciden gelen sonucu sepete yazılacak küçük kayda indirger. */
export function minimizeBasketPaper(paper = {}) {
  // Tüm yazarlar saklanır: kaynakça (APA 7) 20 yazara kadar hepsini ister.
  // Eskiden ilk 3 yazar / 150 karakter tutuluyordu ve kaynakça "..., & Step."
  // gibi yarım isimle bitiyordu. Prompt'a giden kısa liste writer route'ta kesiliyor.
  const authors = Array.isArray(paper.authors)
    ? paper.authors.join(', ')
    : (paper.creator || paper.authors);
  return {
    title: clip(paper.title, 200),
    authors: clip(authors, BASKET_AUTHORS_MAX),
    year: clip(String(paper.year ?? ''), 8),
    publicationName: clip(paper.publicationName, 150),
    volume: clip(String(paper.volume ?? ''), 30),
    issue: clip(String(paper.issue ?? ''), 30),
    pages: clip(String(paper.pages ?? ''), 30),
    citedBy: Math.max(0, Number(paper.citedBy) || 0),
    description: clip(paper.description, 600),
    doi: clip(paper.doi, 100),
    url: clip(paper.url, 300),
    source: clip(paper.source, 40)
  };
}

/** DOI varsa DOI, yoksa küçük harfli başlık: aynı makaleyi iki kez eklememek için. */
export function basketPaperKey(paper = {}) {
  const doi = clip(paper.doi, 100).toLowerCase();
  if (doi) return `doi:${doi}`;
  return `title:${clip(paper.title, 200).toLowerCase()}`;
}

/**
 * Sepete ekleme kararı. Sepet doluysa en eskiyi sessizce silmiyoruz:
 * kullanıcı kaynakçası için özellikle seçtiği makaleyi kaybetmemeli.
 * @returns {{ok: true, paper} | {ok: false, reason: 'invalid'|'duplicate'|'full'}}
 */
export function planBasketAdd(existingPapers = [], rawPaper) {
  const paper = minimizeBasketPaper(rawPaper);
  if (!paper.title && !paper.doi) return { ok: false, reason: 'invalid' };
  const key = basketPaperKey(paper);
  if (existingPapers.some((p) => basketPaperKey(p) === key)) return { ok: false, reason: 'duplicate' };
  if (existingPapers.length >= BASKET_LIMIT) return { ok: false, reason: 'full' };
  return { ok: true, paper };
}

/**
 * Kaldırılan koleksiyon özelliğinden sepete bir kerelik aktarım:
 * en son kaydedilenler önce, tekrarsız, en fazla BASKET_LIMIT.
 */
export function collectLegacyPapers(collections = []) {
  const all = collections
    .flatMap((c) => (Array.isArray(c.papers) ? c.papers : []))
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
  const seen = new Set();
  const out = [];
  for (const p of all) {
    const paper = minimizeBasketPaper(p);
    if (!paper.title && !paper.doi) continue;
    const key = basketPaperKey(paper);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...paper, addedAt: p.savedAt || new Date() });
    if (out.length >= BASKET_LIMIT) break;
  }
  return out;
}
