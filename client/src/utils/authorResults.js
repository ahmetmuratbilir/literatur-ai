// Yazar eser listesi yardımcıları: konu araması (App) ve yazar paneli ortak kullanır.

/** Yazarın sonraki 200'lük sayfasını listeye ekler; iki sayfada gelen eser bir kez. */
export function mergeAuthorPage(data, next) {
  const key = (r) => String(r.doi || r.id || r.title || '').toLowerCase();
  const seen = new Set(data.results.map(key));
  const added = (next?.results || []).filter((r) => !seen.has(key(r)));
  return { ...data, results: [...data.results, ...added], author: next?.author || { ...data.author, hasMore: false } };
}

/** /api/retractions yanıtını listeye işler; zaten işaretli olana dokunmaz. */
export function applyRetractions(data, found) {
  const norm = (d) => String(d || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  return { ...data, results: data.results.map((r) => (found[norm(r.doi)] && !r.retraction ? { ...r, retraction: found[norm(r.doi)] } : r)) };
}
