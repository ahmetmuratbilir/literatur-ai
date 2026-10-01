import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const BASKET_LIMIT = 30;

/** DOI varsa DOI, yoksa başlık: sunucudaki basketPaperKey ile aynı kural. */
export const basketKey = (paper) => {
  const doi = typeof paper?.doi === 'string' ? paper.doi.trim().toLowerCase() : '';
  if (doi) return `doi:${doi}`;
  return `title:${String(paper?.title || '').trim().toLowerCase()}`;
};

// Sunucuya giden alanlar; yazar modu ve kaynakça bunlarla çalışır.
const toBasketPaper = (p) => ({
  title: p.title,
  creator: p.creator || (Array.isArray(p.authors) ? p.authors.slice(0, 3).join(', ') : p.authors),
  year: p.year ?? '',
  publicationName: p.publicationName,
  citedBy: p.citedBy ?? p.citedbyCount,
  description: p.description,
  doi: p.doi,
  url: p.url,
  source: p.source,
});

const storageKey = (userId) => `basket:${userId}`;
const readLocal = (userId) => {
  try { return JSON.parse(window.localStorage.getItem(storageKey(userId)) || '[]'); } catch { return []; }
};
const writeLocal = (userId, papers) => {
  try { window.localStorage.setItem(storageKey(userId), JSON.stringify(papers)); } catch { /* yok say */ }
};

/**
 * Kaynak sepeti: aramalar arasında kalıcı makale listesi (en fazla 30).
 * Asıl kayıt MongoDB'de; tarayıcıdaki kopya yalnızca sayfa açılırken anında
 * göstermek ve veritabanı yokken (geliştirme) çalışabilmek için.
 */
export function useBasket({ getToken, userId }) {
  // Liste hangi kullanıcıya ait: kullanıcı değişince eski liste görünmesin.
  // Sunucu yanıtı gelene kadar tarayıcıdaki kopya gösterilir.
  const [state, setState] = useState({ owner: null, papers: [] });
  const [offline, setOffline] = useState(false);
  const papers = useMemo(
    () => (state.owner === userId ? state.papers : (userId ? readLocal(userId) : [])),
    [state, userId]
  );
  // Ardışık ekle/çıkar çağrıları en son listeyi görsün (render beklemeden).
  const papersRef = useRef(papers);
  useEffect(() => { papersRef.current = papers; }, [papers]);

  const apply = useCallback((next) => {
    papersRef.current = next;
    setState({ owner: userId, papers: next });
    if (userId) writeLocal(userId, next);
  }, [userId]);

  const authHeaders = useCallback(async () => ({ Authorization: `Bearer ${await getToken()}` }), [getToken]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${defaultApiUrl}/api/basket`, { headers: await authHeaders() });
        if (!cancelled) { apply(res.data.papers || []); setOffline(false); }
      } catch {
        if (!cancelled) setOffline(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, authHeaders, apply]);

  const has = useCallback((paper) => {
    const key = basketKey(paper);
    return papers.some((p) => basketKey(p) === key);
  }, [papers]);

  /** @returns {Promise<{ok: boolean, reason?: 'full'|'duplicate'|'error'}>} */
  const add = useCallback(async (paper) => {
    const current = papersRef.current;
    const key = basketKey(paper);
    if (current.some((p) => basketKey(p) === key)) return { ok: false, reason: 'duplicate' };
    if (current.length >= BASKET_LIMIT) return { ok: false, reason: 'full' };

    const draft = toBasketPaper(paper);
    const optimistic = { ...draft, authors: draft.creator, _local: true };
    apply([...current, optimistic]);
    try {
      const res = await axios.post(`${defaultApiUrl}/api/basket`, { paper: draft }, { headers: await authHeaders() });
      apply(res.data.papers || []);
      setOffline(false);
      return { ok: true };
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) return { ok: true };
      if (status === 400 || status === 401) {
        apply(papersRef.current.filter((p) => p !== optimistic));
        return { ok: false, reason: err?.response?.data?.code === 'FULL' ? 'full' : 'error' };
      }
      // Sunucu ya da veritabanı yok: makale yerel kopyada kalır.
      setOffline(true);
      return { ok: true };
    }
  }, [apply, authHeaders]);

  const remove = useCallback(async (paper) => {
    const key = basketKey(paper);
    const target = papersRef.current.find((p) => basketKey(p) === key);
    if (!target) return;
    apply(papersRef.current.filter((p) => p !== target));
    if (!target._id) return;
    try {
      const res = await axios.delete(`${defaultApiUrl}/api/basket/papers/${target._id}`, { headers: await authHeaders() });
      apply(res.data.papers || []);
    } catch {
      setOffline(true);
    }
  }, [apply, authHeaders]);

  const clear = useCallback(async () => {
    apply([]);
    try {
      await axios.delete(`${defaultApiUrl}/api/basket`, { headers: await authHeaders() });
    } catch {
      setOffline(true);
    }
  }, [apply, authHeaders]);

  return { papers, limit: BASKET_LIMIT, offline, has, add, remove, clear };
}
