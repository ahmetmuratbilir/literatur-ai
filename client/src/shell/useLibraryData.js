import { useCallback, useEffect, useState } from 'react';

// Sunucudaki favoriler koleksiyonunun adı (veri anahtarı). HistorySidebar ile aynı.
const FAVORITES = 'Favoriler';

/**
 * Geçmiş, favoriler ve kayıtlı AI analizleri. Eski kenar çubuğunun
 * (`HistorySidebar`) kendi içinde yaptığı okumanın aynısı; kabukta bu veri
 * Alanım ve Kaynaklar modüllerine dağılıyor (WO-010 envanteri).
 *
 * Aynı `refreshHistory` / `refreshCollections` / `refreshAnalyses`
 * olaylarını dinler: arama, favori ve analiz kodu değişmeden çalışır.
 */
export function useLibraryData({ deviceId, apiUrl, getToken }) {
  const [history, setHistory] = useState([]);
  const [collections, setCollections] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [failed, setFailed] = useState(false);

  const fetchJson = useCallback(async (path, setter) => {
    if (!deviceId) return;
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setter(await res.json());
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      // Sunucu ya da veritabanı yok: liste boş kalır, arayüz bunu söyler.
      setFailed(true);
    }
  }, [deviceId, apiUrl, getToken]);

  const fetchHistory = useCallback(() => fetchJson('/api/history', setHistory), [fetchJson]);
  const fetchCollections = useCallback(() => fetchJson('/api/collections', setCollections), [fetchJson]);
  const fetchAnalyses = useCallback(() => fetchJson('/api/analyses', setAnalyses), [fetchJson]);

  useEffect(() => {
    fetchHistory();
    fetchCollections();
    fetchAnalyses();
    window.addEventListener('refreshHistory', fetchHistory);
    window.addEventListener('refreshCollections', fetchCollections);
    window.addEventListener('refreshAnalyses', fetchAnalyses);
    return () => {
      window.removeEventListener('refreshHistory', fetchHistory);
      window.removeEventListener('refreshCollections', fetchCollections);
      window.removeEventListener('refreshAnalyses', fetchAnalyses);
    };
  }, [fetchHistory, fetchCollections, fetchAnalyses]);

  const favorites = (Array.isArray(collections) ? collections : []).find((c) => c.name === FAVORITES) || null;

  const removeFavorite = useCallback(async (paperId) => {
    if (!favorites) return;
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/collections/${favorites._id}/papers/${paperId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } finally {
      window.dispatchEvent(new CustomEvent('refreshCollections'));
    }
  }, [favorites, apiUrl, getToken]);

  return {
    history: Array.isArray(history) ? history : [],
    analyses: Array.isArray(analyses) ? analyses : [],
    favorites: favorites?.papers || [],
    removeFavorite,
    failed,
  };
}
