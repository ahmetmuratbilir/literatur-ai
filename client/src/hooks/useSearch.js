import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const LOADING_MESSAGES = [
  'Dünyanın en büyük 7 akademik kaynağına güvenli bağlantı kuruluyor...',
  'Scopus, OpenAlex, CORE ve Crossref veri havuzları taranıyor...',
  'OpenCitations ile atıf verileri çapraz kontrolden geçiriliyor...',
  '810 Milyondan fazla kayıt arasında konu eşleşmesi yapılıyor...',
  'AHP algoritması ile en yüksek kaliteli yayınlar önceliklendiriliyor...',
  'Sizin için en güncel ve alakalı literatür listesi hazırlanıyor...',
];

export function useSearch({ getToken, fetchCollections }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isShared, setIsShared] = useState(false);
  const [mainTopic, setMainTopic] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);

  // Loading messages interval
  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Shared content effect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('s');
    if (sharedId) {
      const fetchSharedData = async () => {
        setLoading(true);
        setLoadingStep(0);
        try {
          const res = await axios.get(`${defaultApiUrl}/api/share/${sharedId}`);
          setData({ results: res.data.results, totalFound: res.data.results.length, analyzedCount: res.data.results.length });
          setMainTopic(res.data.mainTopic);
          if (res.data.aiAnalysis) setAiAnalysis(res.data.aiAnalysis);
          setIsShared(true);
        } catch {
          setError('Paylaşılan araştırma bulunamadı veya süresi dolmuş.');
        } finally {
          setLoading(false);
        }
      };
      fetchSharedData();
    }

    const refreshCollections = () => fetchCollections();
    window.addEventListener('refreshCollections', refreshCollections);
    return () => window.removeEventListener('refreshCollections', refreshCollections);
  }, [fetchCollections]);

  const handleSearch = useCallback(async (e, directQuery, { selectedAiQuery, mainTopic: topicArg, authorName, keywords, count, setShowWriterPanel, setSelectedPapers } = {}) => {
    if (e) e.preventDefault();
    const query = directQuery || selectedAiQuery || '';
    const trimmedTopic = (topicArg || '').trim();
    const trimmedAuthor = (authorName || '').trim();
    const normalizedQuery = typeof query === 'string' ? query.trim() : '';
    const cleanKeywords = Array.isArray(keywords)
      ? keywords.map((k) => String(k).trim()).filter(Boolean)
      : [];
    const hasKeywords = cleanKeywords.length > 0;

    if (!trimmedTopic && !normalizedQuery && !trimmedAuthor && !hasKeywords) {
      setError('Arama için en az bir alan doldurun (konu, yazar, AI sorgusu veya anahtar kelime).');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    setAiAnalysis(null);
    if (setShowWriterPanel) setShowWriterPanel(false);
    if (setSelectedPapers) setSelectedPapers([]);

    try {
      const token = await getToken();
      const response = await axios.get(`${defaultApiUrl}/api/search`, {
        params: {
          mainTopic: trimmedTopic,
          authorName: trimmedAuthor,
          count: count || 25,
          aiQuery: normalizedQuery,
          keywords: JSON.stringify(cleanKeywords)
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
      if (response.data.quota) setQuota(response.data.quota);

      await axios.post(`${defaultApiUrl}/api/history`, {
        mainTopic: trimmedTopic,
        authorName: trimmedAuthor,
        keywords: cleanKeywords,
        aiQuery: normalizedQuery
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.dispatchEvent(new CustomEvent('refreshHistory'));
    } catch (err) {
      setError(err.response?.data?.error || 'Arama sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  return {
    loading,
    data,
    setData,
    error,
    setError,
    quota,
    loadingStep,
    isShared,
    setIsShared,
    handleSearch,
    mainTopic,
    setMainTopic,
    aiAnalysis,
    setAiAnalysis,
    LOADING_MESSAGES
  };
}
