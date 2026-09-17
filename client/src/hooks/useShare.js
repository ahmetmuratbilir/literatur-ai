import { useState } from 'react';
import axios from 'axios';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useShare({ getToken }) {
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async ({ data, mainTopic, aiAnalysis, authorName, keywords, count }) => {
    if (!data || !data.results.length) return;
    setShareLoading(true);
    try {
      const token = await getToken();
      // Trim results to 15 items and remove heavy fields to stay well under 1MB limit
      const safeResults = data.results.slice(0, 15).map(r => ({
        title: r.title?.slice(0, 200),
        titleTR: r.titleTR?.slice(0, 200),
        authors: r.authors,
        year: r.year,
        source: r.source,
        doi: r.doi,
        url: r.url,
        citedBy: r.citedBy || r.citedbyCount,
        publicationName: r.publicationName,
        scores: r.scores,
        totalPoint: r.totalPoint,
        confidence: r.confidence,
        explanation: r.explanation,
        description: r.description?.slice(0, 300),
        teaserTR: r.teaserTR?.slice(0, 300)
      }));
      const res = await axios.post(`${defaultApiUrl}/api/share`, {
        mainTopic,
        results: safeResults,
        aiAnalysis,
        originalParams: { authorName, keywords, count }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fullUrl = res.data.url || `${window.location.origin}${window.location.pathname}?s=${res.data.shareId}`;
      setShareUrl(fullUrl);
      setShowShareModal(true);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Paylaşım linki oluşturulamadı.';
      alert(msg);
    } finally {
      setShareLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareModal(false);
      }, 1200);
    } catch {
      console.error('Kopyalama hatası');
    }
  };

  return {
    shareLoading,
    shareUrl,
    showShareModal,
    setShowShareModal,
    copied,
    handleShare,
    copyToClipboard
  };
}
