import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
const MotionDiv = motion.div;
const MotionH1 = motion.h1;

import {
  Loader2,
  Search,
  User,
  Download,
  Settings,
  AlertCircle,
  Zap,
  Sparkles,
  Activity,
  CheckCircle2,
  Share2,
  PenLine,
  BarChart2
} from 'lucide-react';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const LOADING_MESSAGES = [
  'Dünyanın en büyük 7 akademik kaynağına güvenli bağlantı kuruluyor...',
  'Scopus, OpenAlex, CORE ve Crossref veri havuzları taranıyor...',
  'OpenCitations ile atıf verileri çapraz kontrolden geçiriliyor...',
  '810 Milyondan fazla kayıt arasında konu eşleşmesi yapılıyor...',
  'AHP algoritması ile en yüksek kaliteli yayınlar önceliklendiriliyor...',
  'Sizin için en güncel ve alakalı literatür listesi hazırlanıyor...',
];

import ResultCard from './components/ResultCard';
import GlobalStats from './components/GlobalStats';
import InfiniteTicker from './components/InfiniteTicker';
import HistorySidebar from './components/HistorySidebar';
import WriterPanel from './components/WriterPanel';
import ShareModal from './components/ShareModal';
import LandingPage from './components/landing/LandingPage';
import { useWindowSize } from './hooks/useWindowSize';
import { useCollections } from './hooks/useCollections';
import { useShare } from './hooks/useShare';
import { useExport } from './hooks/useExport';

// FeatureHighlights component kept here since it's also used in SignedIn view
const FEATURE_HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'AI sorgu genişletme',
    text: 'Türkçe konunuz İngilizce Boolean sorguya çevrilir; 5 alternatif öneri sunulur.'
  },
  {
    icon: BarChart2,
    title: 'AHP skorlama',
    text: 'Alaka, atıf ve güncellik ağırlıklarıyla her makale 0-100 arası puanlanır.'
  },
  {
    icon: Download,
    title: 'Tek tık dışa aktarım',
    text: 'Sonuçları PDF, Word veya Excel olarak hazır rapor halinde indirin.'
  }
];

const FeatureHighlights = ({ theme }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1.5rem',
    marginTop: '3rem',
    width: '100%',
    maxWidth: '1100px'
  }}>
    {FEATURE_HIGHLIGHTS.map((feature, idx) => {
      const FeatureIcon = feature.icon;
      return (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + (idx * 0.05) }}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          style={{
            background: theme === 'light' ? 'white' : 'rgba(30, 41, 59, 0.4)',
            padding: '1.75rem',
            borderRadius: '20px',
            border: theme === 'light' ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
            boxShadow: theme === 'light' ? '0 4px 20px -10px rgba(0,0,0,0.05)' : '0 10px 30px -15px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.3s ease'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: theme === 'light' ? '#f0f4ff' : 'rgba(79, 70, 229, 0.1)',
            color: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem'
          }}>
            <FeatureIcon size={20} strokeWidth={2.5} />
          </div>
          <h3 style={{
            fontSize: '1.1rem',
            fontWeight: '700',
            marginBottom: '0.5rem',
            color: theme === 'light' ? '#0f172a' : '#f8fafc',
            letterSpacing: '-0.01em'
          }}>
            {feature.title}
          </h3>
          <p style={{
            fontSize: '0.9rem',
            lineHeight: '1.5',
            color: theme === 'light' ? '#64748b' : '#94a3b8'
          }}>
            {feature.text}
          </p>
        </motion.div>
      );
    })}
  </div>
);

function App() {
  const [mainTopic, setMainTopic] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [count, setCount] = useState(25);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [selectedAiQuery, setSelectedAiQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isShared, setIsShared] = useState(false);
  const [activeLandingTab, setActiveLandingTab] = useState(null);
  const [landingTheme, setLandingTheme] = useState('light');
  const [showWriterPanel, setShowWriterPanel] = useState(false);
  const [writerSize, setWriterSize] = useState('default');
  const [selectedPapers, setSelectedPapers] = useState([]);

  const { userId, isLoaded, getToken } = useAuth();
  const { isMobile, isTablet, isCompact } = useWindowSize();
  const { collections, setCollections, fetchCollections, handleSaveToCollection, handleFavorite, isPaperFavorited } = useCollections({ getToken, userId });
  const { shareLoading, shareUrl, showShareModal, setShowShareModal, copied, handleShare, copyToClipboard } = useShare({ getToken });
  const { exportPDF, exportExcel, exportDocx } = useExport();

  const canSubmitSearch = Boolean(
    mainTopic.trim() ||
    authorName.trim() ||
    selectedAiQuery.trim() ||
    keywords.length > 0
  );

  // Auth effect
  useEffect(() => {
    if (isLoaded && userId) {
      setDeviceId(userId);
      fetchCollections();
    } else if (isLoaded) {
      setDeviceId('');
      setCollections([]);
    }
  }, [fetchCollections, userId, isLoaded, setCollections]);

  // Shared content + refreshCollections listener
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

  // Resize: close sidebar on mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

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

  const handleTogglePaper = useCallback((paper) => {
    setSelectedPapers(prev => {
      const exists = prev.find(p => (p.doi && p.doi === paper.doi) || (p.url && p.url === paper.url) || p.title === paper.title);
      if (exists) return prev.filter(p => p !== exists);
      return [...prev, paper];
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (data?.results) setSelectedPapers([...data.results]);
  }, [data]);

  const handleClearSelection = useCallback(() => {
    setSelectedPapers([]);
  }, []);

  const handleAiSuggest = async () => {
    if (!mainTopic.trim()) {
      setAiError('Lütfen önce bir konu giriniz.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const token = await getToken();
      const response = await axios.post(`${defaultApiUrl}/api/analyze-query`, { topic: mainTopic.trim() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data?.intent) {
        setAiAnalysis(response.data);
        try {
          await axios.post(`${defaultApiUrl}/api/analyses`, {
            topic: mainTopic.trim(),
            explanation: response.data.explanation,
            queries: response.data.queries
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          window.dispatchEvent(new CustomEvent('refreshAnalyses'));
        } catch (analErr) {
          console.warn('Analysis save failed', analErr);
        }
      }
    } catch (err) {
      console.error('AI analyze error:', err);
      const msg = err.response?.data?.error || 'AI analizi başarısız oldu.';
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearch = async (e, directQuery = null) => {
    if (e) e.preventDefault();
    const query = directQuery || selectedAiQuery;
    const trimmedTopic = mainTopic.trim();
    const trimmedAuthor = authorName.trim();
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
    setShowWriterPanel(false);
    setSelectedPapers([]);

    try {
      const token = await getToken();
      const response = await axios.get(`${defaultApiUrl}/api/search`, {
        params: {
          mainTopic: trimmedTopic,
          authorName: trimmedAuthor,
          count: count,
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
  };

  return (
    <>
      <SignedOut>
        <LandingPage
          landingTheme={landingTheme}
          activeLandingTab={activeLandingTab}
          setActiveLandingTab={setActiveLandingTab}
          setLandingTheme={setLandingTheme}
          isMobile={isMobile}
        />
      </SignedOut>

      <SignedIn>
        <InfiniteTicker />

        {/* Share Modal */}
        <ShareModal
          show={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareUrl={shareUrl}
          copied={copied}
          onCopy={copyToClipboard}
        />

        <HistorySidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          deviceId={deviceId}
          apiUrl={defaultApiUrl}
          onSelectHistory={(item) => {
            setMainTopic(item.mainTopic || '');
            setAuthorName(item.authorName || '');
            setKeywords(item.keywords || []);
            handleSearch(null, item.aiQuery);
          }}
          onDeleteHistoryEntry={async (id) => {
            const token = await getToken();
            await axios.delete(`${defaultApiUrl}/api/history/entry/${id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            window.dispatchEvent(new CustomEvent('refreshHistory'));
          }}
          onNewSearch={() => {
            setData(null);
            setMainTopic('');
            setAuthorName('');
            setKeywords([]);
            setAiAnalysis(null);
            setIsShared(false);
            setError(null);
          }}
        />

        <main className="app-main" style={{
          marginLeft: isMobile ? '0px' : (sidebarOpen ? '280px' : '72px'),
          marginRight: (!isMobile && showWriterPanel)
            ? (writerSize === 'default' ? '420px' : (writerSize === 'half' ? '50vw' : '100vw'))
            : '0px',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: isMobile ? '3.5rem 1rem 2rem' : (isTablet ? '3.5rem 1.5rem' : '4rem 2rem')
        }}>
          <div className="query-workspace" style={{ maxWidth: '1000px', margin: '0 auto' }}>

            <header className="query-hero" style={{ textAlign: 'center', marginBottom: isMobile ? '2rem' : '3rem' }}>
              <MotionDiv
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', fontSize: 'var(--fs-xs)', fontWeight: '600', marginBottom: '1.25rem', letterSpacing: '0.02em' }}
              >
                <Sparkles size={12} /> 7 akademik veri kaynağı, 810M+ makale
              </MotionDiv>
              <MotionH1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                style={{ fontSize: isMobile ? '2.5rem' : (isTablet ? '3.5rem' : '4.5rem'), fontWeight: '800', letterSpacing: '-0.04em', color: 'var(--text-main)', margin: '0 0 0.75rem 0', lineHeight: 1.1 }}
              >
                <span style={{ background: 'linear-gradient(135deg, #4f46e5, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Literatur</span> AI
              </MotionH1>
            </header>

            <section className="glass-panel query-panel" style={{ padding: isMobile ? '1.25rem' : (isTablet ? '1.75rem' : '2rem'), marginBottom: isMobile ? '2rem' : '3rem' }}>
              {isShared ? (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '8px 16px', borderRadius: '99px', fontSize: 'var(--fs-sm)', fontWeight: '600', marginBottom: '1rem' }}>
                    <CheckCircle2 size={16} /> Paylaşılan Araştırma Görüntüleniyor
                  </div>
                  <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 1rem 0' }}>{mainTopic}</h2>
                  <button
                    onClick={() => { window.location.href = window.location.pathname; }}
                    className="btn"
                    style={{ height: '44px', width: 'auto', padding: '0 24px', margin: '0 auto' }}
                  >
                    <Zap size={18} /> Kendi Literatür Taramamı Başlat
                  </button>
                </div>
              ) : (
                <form className="query-form" onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)', fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>
                      Araştırma Konusu
                    </label>
                    <div className="input-wrapper query-input-shell" style={{ position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: '16px', top: isCompact ? '24px' : '50%', transform: isCompact ? 'none' : 'translateY(-50%)', color: 'var(--slate-400)' }} size={18} />
                      <input
                        type="text"
                        className="input"
                        style={{
                          height: '52px',
                          paddingLeft: '46px',
                          paddingRight: isCompact ? '16px' : '210px',
                          fontSize: 'var(--fs-md)',
                          borderRadius: 'var(--radius-md)',
                          width: '100%'
                        }}
                        placeholder="Örn: AI in drug discovery, author:Smith, year:2023"
                        value={mainTopic}
                        onChange={(e) => setMainTopic(e.target.value)}
                        inputMode="search"
                        enterKeyHint="search"
                        autoCorrect="off"
                        autoCapitalize="none"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={handleAiSuggest}
                        disabled={aiLoading}
                        className={isCompact ? 'query-ai-button' : 'btn-secondary query-ai-button'}
                        style={{
                          position: isCompact ? 'static' : 'absolute',
                          marginTop: isCompact ? '0.5rem' : '0',
                          right: '8px',
                          top: '50%',
                          transform: isCompact ? 'none' : 'translateY(-50%)',
                          background: isCompact ? 'var(--brand-primary-soft)' : '#ffffff',
                          border: isCompact ? '1px solid #dbe1ff' : '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 14px',
                          color: 'var(--brand-primary)',
                          fontSize: 'var(--fs-sm)',
                          fontWeight: '600',
                          fontFamily: 'inherit',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: aiLoading ? 'not-allowed' : 'pointer',
                          transition: 'background 0.15s ease, border-color 0.15s ease',
                          width: isCompact ? '100%' : 'auto',
                          height: isCompact ? '44px' : '36px'
                        }}
                      >
                        {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {aiLoading ? 'Analiz ediliyor…' : 'AI ile geliştir'}
                      </button>
                    </div>
                    {aiError && (
                      <div style={{ marginTop: '0.625rem', color: '#b91c1c', fontSize: 'var(--fs-sm)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={14} /> {aiError}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="btn-ghost query-advanced-toggle"
                    style={{
                      alignSelf: 'flex-start',
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--brand-primary)',
                      fontWeight: '600',
                      padding: '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {showAdvanced ? 'Gelişmiş seçenekleri gizle' : 'Gelişmiş arama seçenekleri'}
                    <motion.span animate={{ rotate: showAdvanced ? 180 : 0 }}>
                      <Settings size={12} />
                    </motion.span>
                  </button>

                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem', paddingTop: '0.5rem' }}>
                          <div>
                            <label style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)', fontSize: 'var(--fs-xs)', marginBottom: '0.5rem' }}>Yazar Adı</label>
                            <div style={{ position: 'relative' }}>
                              <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} size={16} />
                              <input
                                type="text"
                                className="input"
                                style={{ height: '44px', paddingLeft: '40px', fontSize: 'var(--fs-sm)', width: '100%' }}
                                placeholder="Örn: John Doe"
                                value={authorName}
                                onChange={(e) => setAuthorName(e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)', fontSize: 'var(--fs-xs)', marginBottom: '0.5rem' }}>Maksimum Sonuç</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <input
                                type="range"
                                min="10"
                                max="100"
                                step="5"
                                value={count}
                                onChange={(e) => setCount(parseInt(e.target.value))}
                                style={{ flex: 1, accentColor: 'var(--brand-primary)' }}
                              />
                              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: '700', color: 'var(--brand-primary)', minWidth: '32px' }}>{count}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading || !canSubmitSearch}
                    className="btn query-submit-button"
                    style={{ height: '52px', marginTop: '0.5rem', width: '100%', fontSize: 'var(--fs-md)' }}
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    {loading ? 'Literatür Taranıyor...' : 'Araştırmayı Başlat'}
                  </button>
                </form>
              )}
            </section>

            {!data && !loading && !aiAnalysis && !error && (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '0 2rem' }}>
                <FeatureHighlights theme={landingTheme} />
              </div>
            )}

            <AnimatePresence>
              {loading && (
                <MotionDiv
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-panel"
                  style={{ padding: '2.5rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.9)' }}
                >
                  <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 1.5rem' }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--brand-primary-soft)' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }} />
                    <div style={{ position: 'absolute', inset: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--brand-primary-soft)', borderRadius: '50%' }}>
                      <Activity size={32} color="var(--brand-primary)" />
                    </div>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.75rem' }}>Tarama Sürüyor...</h3>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={loadingStep}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', fontWeight: '500', minHeight: '1.5em' }}
                    >
                      {LOADING_MESSAGES[loadingStep]}
                    </motion.p>
                  </AnimatePresence>
                </MotionDiv>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {aiAnalysis && !loading && (
                <MotionDiv
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="glass-panel"
                  style={{ marginBottom: '2rem', padding: isMobile ? '1.25rem' : '1.5rem', borderLeft: '4px solid var(--brand-primary)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <Sparkles size={18} color="var(--brand-primary)" />
                    <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: '700', color: 'var(--text-main)' }}>AI Araştırma Analizi</h3>
                  </div>

                  <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                    <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-main)', lineHeight: 1.6, fontWeight: '500' }}>
                      <span style={{ color: 'var(--brand-primary)', fontWeight: '700' }}>Hedef:</span> {aiAnalysis.intent}
                    </p>
                  </div>

                  <div>
                    <h4 style={{ fontSize: 'var(--fs-xs)', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Önerilen Akademik Sorgular</h4>
                    <div style={{ display: 'grid', gap: '0.625rem' }}>
                      {aiAnalysis.queries.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedAiQuery(q.text);
                            handleSearch(null, q.text);
                          }}
                          className="ai-query-card"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            textAlign: 'left',
                            padding: '12px 16px',
                            background: 'white',
                            border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            width: '100%',
                            fontFamily: 'inherit'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '1rem' }}>
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: '500', color: 'var(--text-main)', wordBreak: 'break-word', textAlign: 'left' }}>{q.text}</span>
                            <span className="badge badge-info" style={{ flexShrink: 0 }}>%{q.relevanceScore}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </MotionDiv>
              )}
            </AnimatePresence>

            {data && (
              <div style={{ marginTop: '2rem' }}>
                <GlobalStats
                  totalFound={data.totalFound}
                  analyzed={data.analyzedCount}
                  quota={quota}
                  sourceBreakdown={data.sourceBreakdown}
                  totalFromAPIs={data.totalFromAPIs}
                  failedSources={data.failedSources}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: '600', color: 'var(--slate-600)', fontSize: 'var(--fs-sm)' }}>
                    <span style={{ color: 'var(--brand-primary)', fontWeight: '700' }}>{selectedPapers.length}</span> kaynak seçildi
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleSelectAll} style={{ padding: '4px 10px', background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: '600', color: 'var(--slate-600)' }}>
                      Tümünü seç
                    </button>
                    <button onClick={handleClearSelection} style={{ padding: '4px 10px', background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: '600', color: 'var(--slate-600)' }}>
                      Temizle
                    </button>
                  </div>
                </div>

                <div className="export-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: '500' }}>
                      {data.results.length} makale listeleniyor
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {!isShared && (
                      <button onClick={() => handleShare({ data, mainTopic, aiAnalysis, authorName, keywords, count })} disabled={shareLoading} className="btn" style={{ background: 'var(--brand-primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                        {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                        {shareLoading ? 'Link hazırlanıyor...' : 'Araştırmayı Paylaş'}
                      </button>
                    )}
                    <button onClick={() => exportPDF(mainTopic)} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                      <Download size={14} /> PDF
                    </button>
                    <button onClick={() => exportExcel(data, mainTopic)} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                      <Download size={14} /> CSV
                    </button>
                    <button onClick={() => exportDocx(data, mainTopic)} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                      <Download size={14} /> DOCX
                    </button>
                  </div>
                </div>

                <div id="results-container" style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                  {data.results.map((item, idx) => {
                    const isFavorited = isPaperFavorited(item);
                    const isSelected = selectedPapers.some(p => (p.doi && p.doi === item.doi) || (p.url && p.url === item.url) || p.title === item.title);
                    return (
                      <ResultCard
                        key={item.doi || item.url || item.title || idx}
                        item={item}
                        rank={idx + 1}
                        collections={collections}
                        onSaveToCollection={handleSaveToCollection}
                        onFavorite={handleFavorite}
                        isFavorited={isFavorited}
                        isSelected={isSelected}
                        onToggleSelect={() => handleTogglePaper(item)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <MotionDiv initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', marginTop: '1.5rem' }}>
                <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ margin: '0 0 2px 0', color: '#991b1b', fontWeight: '600', fontSize: 'var(--fs-sm)' }}>Arama tamamlanamadı</p>
                  <p style={{ margin: 0, color: '#b91c1c', fontWeight: '500', fontSize: 'var(--fs-sm)' }}>{error}</p>
                </div>
              </MotionDiv>
            )}

          </div>
        </main>
      </SignedIn>

      {/* Writer Panel Float Button */}
      <AnimatePresence>
        {data?.results?.length > 0 && (
          <motion.button
            key="writer-float"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{
              opacity: writerSize === 'full' && showWriterPanel ? 0 : 1,
              y: 0, scale: 1,
              right: showWriterPanel ? (writerSize === 'default' ? 440 : (writerSize === 'half' ? 'calc(50vw + 20px)' : 0)) : 32,
            }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="writer-float-btn"
            onClick={() => {
              setShowWriterPanel(prev => !prev);
            }}
            title={showWriterPanel ? 'Yazar Modunu Kapat' : 'Atıflı akademik metin üret'}
          >
            <PenLine size={16} />
            {showWriterPanel ? 'Kapat' : 'Yazar Modu'}
            {!showWriterPanel && (
              <span style={{
                background: 'rgba(255,255,255,0.25)',
                borderRadius: '999px',
                padding: '1px 8px',
                fontSize: '0.72rem',
                fontWeight: 800,
              }}>
                {selectedPapers.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Writer Panel Sidebar */}
      <AnimatePresence>
        {showWriterPanel && (
          <WriterPanel
            key="writer-panel"
            papers={selectedPapers}
            apiUrl={defaultApiUrl}
            getToken={getToken}
            onClose={() => setShowWriterPanel(false)}
            size={writerSize}
            setSize={setWriterSize}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
