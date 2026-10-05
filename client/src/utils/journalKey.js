/**
 * Aynı derginin farklı yazımlarını ("The Lancet" / "Lancet, The" / "Energies
 * (Basel)") tek anahtarda toplar. Dergi dağılımı ve dergiye göre süzme bunu
 * ortak kullanır; iki yerde ayrı yazılırsa sayılar listeyle tutmaz.
 */
export const journalKey = (name) => String(name ?? '')
  .toLowerCase()
  .replace(/^the\s+|,\s*the$/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

/**
 * Alan gerçek bir yayın yeri (dergi, konferans, kitap) mi?
 *
 * Bazı adaptörler dergi alanına arşiv/platform adı yazıyor: arXiv "ArXiv
 * Pre-print", OpenAIRE "OSTI OAI (…)" gibi. Bunlar bir yayın yeri değil,
 * kaydın bulunduğu depo; dağılımda sayılırsa listeyi yanıltıcı yapar.
 */
const PLACEHOLDER = /^(n\/a|bilinmeyen|unknown|preprint|null|undefined)\b/i;
const REPOSITORY = /\b(arxiv|biorxiv|medrxiv|chemrxiv|ssrn|zenodo|osti|researchgate|figshare|hal|dspace|repositor|preprint server|oai)\b/i;

export const isRealJournal = (name) => {
  const text = String(name ?? '').trim();
  if (!text || PLACEHOLDER.test(text)) return false;
  return !REPOSITORY.test(text);
};
