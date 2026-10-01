import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
const MotionDiv = motion.div;

import {
  Loader2,
  Search,
  User,
  Download,
  Settings,
  AlertCircle,
  AlertTriangle,
  Zap,
  Sparkles,
  Activity,
  CheckCircle2,
  Share2,
  PenLine,
  BarChart2,
  ChevronDown,
  GraduationCap,
  ExternalLink,
  ListChecks
} from 'lucide-react';
import { AuthedOnly, AnonOnly, useAppAuth } from './auth/clerkBridge.js';
import { useAdmin } from './hooks/useAdmin';
import AdminPanel from './components/AdminPanel.jsx';
import { useI18n } from './i18n/context.js';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

import ResultCard from './components/ResultCard';
import RankingPanel from './components/RankingPanel';
import GlobalStats from './components/GlobalStats';
import HistorySidebar from './components/HistorySidebar';
import WriterPanel from './components/WriterPanel';
import ShareModal from './components/ShareModal';
import LandingPage from './components/landing/LandingPage';
import AppTopBar from './components/AppTopBar';
import ExportMenu from './components/ExportMenu';
import { useWindowSize } from './hooks/useWindowSize';
import { useCollections } from './hooks/useCollections';
import { useBasket } from './hooks/useBasket';
import { flyToBasket } from './utils/flyToBasket';
import Toasts from './components/Toasts';
import WriterDock from './components/WriterDock';
import CitationChecker from './components/CitationChecker';
import { useShare } from './hooks/useShare';
import { useExport } from './hooks/useExport';

const FEATURES = [
  { icon: Sparkles, title: 'features.aiTitle', text: 'features.aiText' },
  { icon: BarChart2, title: 'features.ahpTitle', text: 'features.ahpText' },
  { icon: Download, title: 'features.exportTitle', text: 'features.exportText' },
];

const FeatureHighlights = () => {
  const { t } = useI18n();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
      {FEATURES.map((feature) => {
        const FeatureIcon = feature.icon;
        return (
          <div key={feature.title} className="ui-panel" style={{ padding: 'var(--space-5)', boxShadow: 'none' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'grid', placeItems: 'center', marginBottom: 'var(--space-3)' }}>
              <FeatureIcon size={18} strokeWidth={2.25} />
            </div>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{t(feature.title)}</h3>
            <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.55, color: 'var(--text-muted)', margin: 0 }}>{t(feature.text)}</p>
          </div>
        );
      })}
    </div>
  );
};

const PAGE_SIZE = 25;
const RESULT_LIMIT = 100;

function App() {
  const { t } = useI18n();
  const [mainTopic, setMainTopic] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [keywords, setKeywords] = useState([]);
  // Sunucu siraladigi tum adaylari (en fazla 100) dondurur; kaynaklardan
  // cekilen miktar bundan bagimsiz (server SOURCE_FETCH_COUNT). Ekranda 25'er
  // acilir; "Daha fazla goster" yeni arama yapmaz.
  const count = RESULT_LIMIT;
  const [visible, setVisible] = useState({ data: null, n: PAGE_SIZE });
  const [moreLoading, setMoreLoading] = useState(false);
  // Ana ekran: literatür arama ya da kaynakça doğrulama
  const [mode, setMode] = useState('search');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
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
  // Siralama profili. Tarayicida hatirlanir (MongoDB baglaninca kullanici
  // profiline tasinacak). localStorage gizli pencerede atabilir; sessizce
  // varsayilana duser.
  const [profileId, setProfileId] = useState(() => {
    try { return window.localStorage.getItem('rankingProfile') || 'dengeli'; } catch { return 'dengeli'; }
  });
  const [lastSearchParams, setLastSearchParams] = useState(null);
  const [rerankLoading, setRerankLoading] = useState(false);
  // Gelismis moddan gelen ozel agirliklar. Doluysa profilin yerine gecer.
  const [customWeights, setCustomWeights] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('rankingCustomWeights') || 'null'); } catch { return null; }
  });
  // Metin degil bayrak: dil degisince uyari da yeni dilde gorunmeli.
  const [inconsistentRanking, setInconsistentRanking] = useState(false);
  const rankingParams = customWeights
    ? { weights: JSON.stringify(customWeights) }
    : { profileId };

  const { userId, isLoaded, getToken } = useAppAuth();
  const { isAdmin } = useAdmin({ getToken, userId });
  const [showAdmin, setShowAdmin] = useState(false);
  const { isMobile, isTablet, isCompact } = useWindowSize();
  const { setCollections, fetchCollections, handleFavorite, isPaperFavorited } = useCollections({ getToken, userId });
  // Kaynak sepeti: aramalar arasında kalır; yeni arama onu silmez.
  const basket = useBasket({ getToken, userId });
  // Sağ üst bildirimler (kaynak durumu, "liste dolu" vb.)
  const [toasts, setToasts] = useState([]);
  const dismissToast = useCallback((id) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((list) => [...list.slice(-2), { ...toast, id }]);
  }, []);
  // AI önerileri gelince sayfa onlara kaysın; kullanıcı birini seçecek.
  const aiPanelRef = useRef(null);
  const { shareLoading, shareUrl, showShareModal, setShowShareModal, copied, handleShare, copyToClipboard } = useShare({ getToken });
  const { exportPDF, exportExcel, exportDocx } = useExport();

  const loadingSteps = t('loading.steps');

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
          setError(t('search.sharedNotFound'));
        } finally {
          setLoading(false);
        }
      };
      fetchSharedData();
    }

    const refreshCollections = () => fetchCollections();
    window.addEventListener('refreshCollections', refreshCollections);
    return () => window.removeEventListener('refreshCollections', refreshCollections);
    // t bilerek bagimlilik degil: paylasim yalnizca acilista bir kez okunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setLoadingStep((prev) => prev + 1);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleToggleBasket = useCallback(async (paper, sourceEl) => {
    if (basket.has(paper)) {
      await basket.remove(paper);
      return;
    }
    if (basket.papers.length >= basket.limit) {
      pushToast({ tone: 'warn', title: t('basket.full', { n: basket.limit }) });
      return;
    }
    flyToBasket(sourceEl, paper.title || '');
    const result = await basket.add(paper);
    if (!result.ok && result.reason === 'full') pushToast({ tone: 'warn', title: t('basket.full', { n: basket.limit }) });
    else if (!result.ok && result.reason === 'error') pushToast({ tone: 'warn', title: t('basket.addFailed') });
  }, [basket, t, pushToast]);

  // Panel yükseklik animasyonuyla açılıyor; animasyon sürerken başlatılan
  // yumuşak kaydırma iptal oluyordu. Açılış bittikten sonra kaydır.
  useEffect(() => {
    if (!aiAnalysis) return undefined;
    const timer = setTimeout(() => aiPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => clearTimeout(timer);
  }, [aiAnalysis]);


  const handleAiSuggest = async () => {
    if (!mainTopic.trim()) {
      setAiError(t('search.aiNeedTopic'));
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
      setAiError(err.response?.data?.error || t('search.aiFailed'));
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * Profil degisince yalnizca YENIDEN SIRALAR. handleSearch'u cagirmiyoruz:
   * o fonksiyon AI analizini ve yazara secilmis makaleleri siliyor, gecmise
   * ikinci bir kayit ekliyor. Sunucu ayni sorguyu onbellekten bu profilin
   * agirliklariyla yeniden siraladigi icin istek hizli doner.
   */
  const rerank = async (nextRankingParams) => {
    if (!lastSearchParams || isShared) return;
    setRerankLoading(true);
    try {
      const token = await getToken();
      const response = await axios.get(`${defaultApiUrl}/api/search`, {
        params: { ...lastSearchParams, ...rankingParams, ...nextRankingParams },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || t('search.rerankFailed'));
    } finally {
      setRerankLoading(false);
    }
  };

  const handleProfileChange = async (nextProfileId) => {
    setProfileId(nextProfileId);
    setCustomWeights(null);
    setInconsistentRanking(false);
    try {
      window.localStorage.setItem('rankingProfile', nextProfileId);
      window.localStorage.removeItem('rankingCustomWeights');
    } catch { /* yok say */ }
    // Ozel agirlik temizlendigi icin weights parametresini de ez.
    await rerank({ profileId: nextProfileId, weights: undefined });
  };

  /** Unpaywall: DOI için yasal ücretsiz kopya (kart düğmesinden, arama sırasında değil). */
  const findFreePdf = async (doi) => {
    const token = await getToken();
    const { data: oa } = await axios.get(`${defaultApiUrl}/api/oa`, {
      params: { doi },
      headers: { Authorization: `Bearer ${token}` }
    });
    return oa;
  };

  const handleWeightsApply = async (weights, { inconsistent = false } = {}) => {
    setCustomWeights(weights);
    // Kullanici tutarsiz tercihlerle devam etmeyi secerse kilitlemiyoruz, ama
    // siralamanin bu sekilde uretildigini gizlemiyoruz.
    setInconsistentRanking(inconsistent);
    try { window.localStorage.setItem('rankingCustomWeights', JSON.stringify(weights)); } catch { /* yok say */ }
    await rerank({ weights: JSON.stringify(weights), profileId: undefined });
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
      setError(t('search.needInput'));
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    setAiAnalysis(null);
    setShowWriterPanel(false);

    try {
      const token = await getToken();
      const response = await axios.get(`${defaultApiUrl}/api/search`, {
        params: {
          mainTopic: trimmedTopic,
          authorName: trimmedAuthor,
          count: count,
          aiQuery: normalizedQuery,
          keywords: JSON.stringify(cleanKeywords),
          ...rankingParams
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
      setLastSearchParams({
        mainTopic: trimmedTopic,
        authorName: trimmedAuthor,
        count,
        aiQuery: normalizedQuery,
        keywords: JSON.stringify(cleanKeywords)
      });
    } catch (err) {
      setError(err.response?.data?.error || t('search.failed'));
      setLoading(false);
      return;
    }

    // Geçmişe kaydetme ayrı ele alınıyor. Önceki sürümde aynı try bloğundaydı:
    // veritabanı kapalıyken arama başarıyla dönüyor, sonuçlar ekranda duruyor
    // ama kullanıcı "Arama sırasında hata oluştu" uyarısı görüyordu.
    try {
      const token = await getToken();
      await axios.post(`${defaultApiUrl}/api/history`, {
        mainTopic: trimmedTopic,
        authorName: trimmedAuthor,
        keywords: cleanKeywords,
        aiQuery: normalizedQuery
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.dispatchEvent(new CustomEvent('refreshHistory'));
    } catch (historyErr) {
      // Arama sonucunu etkilemez; yalnızca geçmiş kaydı yapılamadı.
      console.warn('Arama geçmişe kaydedilemedi:', historyErr?.message);
    } finally {
      setLoading(false);
    }
  };

  const openWriter = () => setShowWriterPanel(true);

  // Gosterilen sonuc sayisi bu `data` icin; yeni arama ya da yeniden siralama 25'e doner.
  const shownCount = visible.data === data ? visible.n : PAGE_SIZE;

  const showMore = async () => {
    if (!data?.results) return;
    const next = Math.min(shownCount + PAGE_SIZE, data.results.length);
    const page = data.results.slice(shownCount, next);
    setVisible({ data, n: next });
    // Arama yalnizca ilk 25'i kontrol ediyor; acilan sayfayi simdi kontrol et.
    const dois = page.filter((r) => r.doi && !r.retraction).map((r) => r.doi);
    if (dois.length === 0) return;
    setMoreLoading(true);
    try {
      const token = await getToken();
      const res = await axios.post(`${defaultApiUrl}/api/retractions`, { dois }, { headers: { Authorization: `Bearer ${token}` } });
      const found = res.data?.results || {};
      const norm = (d) => String(d || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
      const updated = { ...data, results: data.results.map((r) => (found[norm(r.doi)] && !r.retraction ? { ...r, retraction: found[norm(r.doi)] } : r)) };
      setData(updated);
      setVisible({ data: updated, n: next });
    } catch (err) {
      console.warn('Retraction check failed', err);
    } finally {
      setMoreLoading(false);
    }
  };

  // YOK Tez programla sorgu kabul etmiyor (formu kendi betigiyle tamamliyor);
  // sorguyu panoya kopyalayip arama sayfasini yeni sekmede aciyoruz.
  const openYokTez = async () => {
    const query = (lastSearchParams?.mainTopic || mainTopic || '').trim();
    let copied = false;
    if (query) {
      try { await navigator.clipboard.writeText(query); copied = true; } catch { /* izin yok */ }
    }
    window.open('https://tez.yok.gov.tr/UlusalTezMerkezi/tarama.jsp', '_blank', 'noopener');
    pushToast({ tone: 'success', title: t('yok.opened'), text: copied ? t('yok.copied', { q: query }) : t('yok.typeIt') });
  };
  const rankingWarnings = [...(data?.ranking?.warnings || []), ...(inconsistentRanking ? [t('results.inconsistentNote')] : [])];

  // Yalnızca geliştirmede: Clerk kapalıyken tanıtım sayfası hiç görünmediği
  // için ?landing ile önizlenebilir.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('landing')) {
    return <LandingPage landingTheme={landingTheme} setLandingTheme={setLandingTheme} />;
  }

  return (
    <>
      <AnonOnly>
        <LandingPage
          landingTheme={landingTheme}
          activeLandingTab={activeLandingTab}
          setActiveLandingTab={setActiveLandingTab}
          setLandingTheme={setLandingTheme}
          isMobile={isMobile}
        />
      </AnonOnly>

      <AuthedOnly>
        {showAdmin && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('shell.systemStatus')}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAdmin(false); }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(3px)',
              overflowY: 'auto', padding: '24px 16px',
            }}
          >
            <div style={{
              maxWidth: '920px', margin: '0 auto', background: 'var(--bg-main)',
              borderRadius: 'var(--radius-lg)', padding: '22px 24px',
              boxShadow: 'var(--shadow-lg)',
            }}>
              <AdminPanel getToken={getToken} onClose={() => setShowAdmin(false)} />
            </div>
          </div>
        )}

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
          basket={basket}
          onOpenWriter={openWriter}
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
          transition: 'margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '100vh',
        }}>
          <AppTopBar
            isMobile={isMobile}
            onOpenMenu={() => setSidebarOpen(true)}
            isAdmin={isAdmin}
            onOpenSystem={() => setShowAdmin(true)}
          />

          <div className="query-workspace" style={{
            maxWidth: '1000px',
            margin: '0 auto',
            // Alt boşluk: seçim çubuğu sabit olduğu için son kartı örtmesin.
            padding: isMobile ? '1.25rem 1rem 6rem' : (isTablet ? '2rem 1.5rem 6rem' : '2.5rem 2rem 6rem'),
          }}>

            {!isShared && (
              <header className="ui-page-head">
                <h1 className="ui-page-head__logo">
                  <span className="ui-brand-mark ui-brand-mark--lg" aria-hidden="true"><Zap size={26} fill="currentColor" /></span>
                  {t('shell.brand')}
                </h1>
              </header>
            )}

            {!isShared && (
              <div className="ui-modes" role="tablist" aria-label={t('modes.label')}>
                <button type="button" role="tab" aria-selected={mode === 'search'} className="ui-modes__tab" onClick={() => setMode('search')}>
                  <Search size={15} /> {t('modes.search')}
                </button>
                <button type="button" role="tab" aria-selected={mode === 'verify'} className="ui-modes__tab" onClick={() => setMode('verify')}>
                  <ListChecks size={15} /> {t('modes.verify')}
                </button>
              </div>
            )}

            {mode === 'verify' && !isShared ? (
              <CitationChecker
                apiUrl={defaultApiUrl}
                getToken={getToken}
                basket={basket}
                onAdd={handleToggleBasket}
              />
            ) : (<>
            <section className="ui-panel query-panel" style={{ marginBottom: 'var(--space-6)' }}>
              {isShared ? (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--score-high-bg)', color: 'var(--score-high)', padding: '6px 14px', borderRadius: '999px', fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                    <CheckCircle2 size={16} /> {t('shared.viewing')}
                  </div>
                  <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, margin: '0 0 var(--space-4)' }}>{mainTopic}</h2>
                  <button type="button" onClick={() => { window.location.href = window.location.pathname; }} className="ui-btn ui-btn--primary ui-btn--lg">
                    <Zap size={18} /> {t('shared.startOwn')}
                  </button>
                </div>
              ) : (
                <form className="query-form" onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  <div>
                    <label htmlFor="topic-input" className="ui-field-label">{t('search.topicLabel')}</label>
                    <div className="input-wrapper query-input-shell" style={{ position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: '16px', top: isCompact ? '26px' : '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} size={18} />
                      <input
                        id="topic-input"
                        type="text"
                        className="input"
                        style={{
                          height: '52px',
                          paddingLeft: '46px',
                          paddingRight: isCompact ? '16px' : '170px',
                          fontSize: 'var(--fs-md)',
                          borderRadius: 'var(--radius-md)',
                          width: '100%'
                        }}
                        placeholder={t('search.topicPlaceholder')}
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
                        className="ui-btn ui-btn--outline"
                        style={isCompact
                          ? { width: '100%', marginTop: 'var(--space-2)', height: '42px', color: 'var(--brand-primary)' }
                          : { position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }}
                      >
                        {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {aiLoading ? t('search.aiAnalyzing') : t('search.aiImprove')}
                      </button>
                    </div>
                    {aiError && (
                      <div style={{ marginTop: 'var(--space-2)', color: 'var(--score-low)', fontSize: 'var(--fs-sm)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={14} /> {aiError}
                      </div>
                    )}
                    <p className="ui-hint" style={{ marginTop: 'var(--space-2)' }}>{t('search.sourcesLine')}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                    aria-expanded={showAdvanced}
                    style={{ alignSelf: 'flex-start', color: 'var(--brand-primary)', marginTop: '-8px' }}
                  >
                    <Settings size={13} />
                    {showAdvanced ? t('search.advancedHide') : t('search.advancedShow')}
                  </button>

                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 'var(--space-4)' }}>
                          <div>
                            <label htmlFor="author-input" className="ui-field-label">{t('search.authorLabel')}</label>
                            <div style={{ position: 'relative' }}>
                              <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} size={16} />
                              <input
                                id="author-input"
                                type="text"
                                className="input"
                                style={{ height: '44px', paddingLeft: '40px', fontSize: 'var(--fs-sm)', width: '100%' }}
                                placeholder={t('search.authorPlaceholder')}
                                value={authorName}
                                onChange={(e) => setAuthorName(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Sıralama tercihi ARAMADAN ÖNCE seçilir; varsayılan "Dengeli".
                      Sonuçlar geldikten sonra değiştirilirse mevcut sonuçlar
                      yeniden sıralanır. */}
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-5)' }}>
                    <RankingPanel
                      apiUrl={defaultApiUrl}
                      profileId={profileId}
                      customWeights={customWeights}
                      onProfile={handleProfileChange}
                      onCustom={handleWeightsApply}
                      disabled={rerankLoading || loading}
                      warnings={rankingWarnings}
                      hasResults={Boolean(data?.results?.length)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !canSubmitSearch}
                    className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                    {loading ? t('search.submitting') : t('search.submit')}
                  </button>
                </form>
              )}
            </section>

            {!data && !loading && !aiAnalysis && !error && <FeatureHighlights />}

            <AnimatePresence>
              {loading && (
                <MotionDiv
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="ui-panel"
                  style={{ padding: 'var(--space-8)', textAlign: 'center' }}
                  role="status"
                >
                  <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto var(--space-4)' }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--brand-primary-soft)' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }} />
                    <div style={{ position: 'absolute', inset: '9px', display: 'grid', placeItems: 'center', background: 'var(--brand-primary-soft)', borderRadius: '50%' }}>
                      <Activity size={24} color="var(--brand-primary)" />
                    </div>
                  </div>
                  <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: '0 0 var(--space-2)' }}>{t('loading.title')}</h3>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={loadingStep}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', fontWeight: 500, minHeight: '1.5em', margin: 0 }}
                    >
                      {loadingSteps[loadingStep % loadingSteps.length]}
                    </motion.p>
                  </AnimatePresence>
                </MotionDiv>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {aiAnalysis && !loading && (
                <MotionDiv
                  ref={aiPanelRef}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="ui-panel"
                  style={{ marginBottom: 'var(--space-6)', borderLeft: '4px solid var(--brand-primary)', scrollMarginTop: '16px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                    <Sparkles size={18} color="var(--brand-primary)" />
                    <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, margin: 0 }}>{t('ai.title')}</h3>
                  </div>

                  <div style={{ background: 'var(--slate-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-5)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--fs-sm)', lineHeight: 1.6, fontWeight: 500 }}>
                      <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{t('ai.goal')}</span> {aiAnalysis.intent}
                    </p>
                  </div>

                  <div>
                    <h4 className="ui-section-label" style={{ margin: '0 0 var(--space-3)' }}>{t('ai.suggested')}</h4>
                    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                      {aiAnalysis.queries.map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setSelectedAiQuery(q.text);
                            handleSearch(null, q.text);
                          }}
                          className="ai-query-card"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)',
                            textAlign: 'left', padding: '12px 16px', background: 'var(--bg-card)',
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer', width: '100%', fontFamily: 'inherit'
                          }}
                        >
                          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-main)', wordBreak: 'break-word' }}>{q.text}</span>
                          <span className="badge badge-info" style={{ flexShrink: 0 }}>%{q.relevanceScore}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </MotionDiv>
              )}
            </AnimatePresence>

            {data && (
              <div>
                {/* Sunucu hicbir kaynaga ulasamadiginda yerel ornek veri seti
                    donuyor (demoMode); kullanici bunu gercek sonuc sanmamali. */}
                {data.demoMode && (
                  <div role="status" className="ui-notice ui-notice--warn" style={{ marginBottom: 'var(--space-4)' }}>
                    <AlertTriangle size={18} />
                    <div><strong>{t('results.demoTitle')}</strong> {t('results.demoText')}</div>
                  </div>
                )}

                <GlobalStats
                  totalFound={data.totalFound}
                  analyzed={data.analyzedCount}
                />

                <div className="ui-toolbar export-actions">
                  <div className="ui-toolbar__meta" aria-live="polite">
                    {rerankLoading ? t('results.updating') : (
                      <>
                        <strong>{t('results.shown', { n: Math.min(shownCount, data.results.length), total: data.results.length })}</strong>
                        {data.relevance?.dropped > 0 && <> · {t('results.dropped', { n: data.relevance.dropped })}</>}
                      </>
                    )}
                  </div>
                  <div className="ui-toolbar__group">
                    {!isShared && (
                      <button type="button" className="ui-btn ui-btn--outline" onClick={openWriter} title={t('results.writerTitle')}>
                        <PenLine size={14} /> {t('results.writer')}
                      </button>
                    )}
                    <ExportMenu
                      onPdf={() => exportPDF(mainTopic)}
                      onCsv={() => exportExcel(data, mainTopic)}
                      onDocx={() => exportDocx(data, mainTopic)}
                    />
                    {!isShared && (
                      <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        onClick={() => handleShare({ data, mainTopic, aiAnalysis, authorName, keywords, count })}
                        disabled={shareLoading}
                      >
                        {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                        {shareLoading ? t('results.sharing') : t('results.share')}
                      </button>
                    )}
                  </div>
                </div>

                {data.relevance?.level === 'partial' && (
                  <div role="status" className="ui-notice ui-notice--warn" style={{ marginBottom: 'var(--space-3)' }}>
                    <AlertTriangle size={16} />
                    <div>{t('results.partial')}</div>
                  </div>
                )}

                <div id="results-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' }}>
                  {data.results.slice(0, shownCount).map((item, idx) => {
                    const isFavorited = isPaperFavorited(item);
                    const inBasket = basket.has(item);
                    return (
                      <ResultCard
                        key={item.doi || item.url || item.title || idx}
                        item={item}
                        rank={idx + 1}
                        appliedWeights={data.methodology?.appliedWeights}
                        oaEnabled={Boolean(data.features?.unpaywall)}
                        onFindPdf={findFreePdf}
                        onFavorite={handleFavorite}
                        isFavorited={isFavorited}
                        isSelected={inBasket}
                        onToggleSelect={(el) => handleToggleBasket(item, el)}
                      />
                    );
                  })}
                </div>

                {shownCount < data.results.length && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
                    <button type="button" className="ui-btn ui-btn--outline" onClick={showMore} disabled={moreLoading}>
                      {moreLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                      {t('results.showMore', { n: Math.min(PAGE_SIZE, data.results.length - shownCount), left: data.results.length - shownCount })}
                    </button>
                  </div>
                )}

                {!isShared && (
                  <div className="ui-yok">
                    <GraduationCap size={18} aria-hidden="true" />
                    <div>
                      <strong>{t('yok.title')}</strong>
                      <span>{t('yok.text')}</span>
                    </div>
                    <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={openYokTez}>
                      {t('yok.button')} <ExternalLink size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <MotionDiv initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="ui-notice ui-notice--error" style={{ marginTop: 'var(--space-6)' }}>
                <AlertCircle size={18} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>{t('search.failedTitle')}</strong>
                  {error}
                </div>
              </MotionDiv>
            )}
            </>)}

          </div>
        </main>

        {/* Seçim çubuğu: yalnızca seçim varken. Önceki "0 kaynak seçildi"
            çubuğu hiç seçim yokken de görünüyordu; yüzen "Yazar Modu" düğmesi
            ise kartların yer imi/yıldız düğmelerini örtüyordu. */}
        {/* Yazar modu: sağ kenarda, sayaçlı. "Makalene ekle" ile seçilen
            makaleler buraya uçar; tıklayınca yazar paneli sağdan açılır.
            Alt çubuk kaldırıldı: üret düğmesi orada zor bulunuyordu. */}
        <AnimatePresence>
          {(data || basket.papers.length > 0) && !showWriterPanel && (
            <WriterDock
              key="writer-dock"
              count={basket.papers.length}
              limit={basket.limit}
              onOpen={openWriter}
              onClear={() => {
                basket.clear();
                pushToast({ tone: 'success', title: t('writerDock.cleared') });
              }}
            />
          )}
        </AnimatePresence>
        <Toasts toasts={toasts} onDismiss={dismissToast} />
      </AuthedOnly>

      <AnimatePresence>
        {showWriterPanel && (
          <WriterPanel
            key="writer-panel"
            papers={basket.papers}
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
