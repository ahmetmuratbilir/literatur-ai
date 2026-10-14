import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
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
  ListChecks,
  UserRound,
  X
} from 'lucide-react';
import { AuthedOnly, AnonOnly, useAppAuth, useAppUser } from './auth/clerkBridge.js';
import { useAdmin } from './hooks/useAdmin';
import AdminPanel from './components/AdminPanel.jsx';
import { useI18n } from './i18n/context.js';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

import ResultCard from './components/ResultCard';
import AuthorPicker from './components/AuthorPicker.jsx';
import GlobalStats from './components/GlobalStats';
import HistorySidebar from './components/HistorySidebar';
import WriterPanel from './components/WriterPanel';
import ShareModal from './components/ShareModal';
import LandingPage from './components/landing/LandingPage';
import AppTopBar from './components/AppTopBar';
import ExportMenu from './components/ExportMenu';
import PublicationTimeline from './components/PublicationTimeline.jsx';
import PaperReaderDrawer from './components/PaperReaderDrawer.jsx';
import ConsensusSnapshot from './components/ConsensusSnapshot.jsx';
import { useWindowSize } from './hooks/useWindowSize';
import { useCollections } from './hooks/useCollections';
import { useBasket } from './hooks/useBasket';
import { flyToBasket } from './utils/flyToBasket';
import Toasts from './components/Toasts';
import WriterDock from './components/WriterDock';
import CitationChecker from './components/CitationChecker';
import AuthorPanel from './components/AuthorPanel';
// Çalışma alanı editörüyle birlikte geliyor; sekmeye ilk girişte yüklenir,
// sonra bağlı kalır (belge ve ayarlar kaybolmasın).
const Workspace = lazy(() => import('./components/workspace/Workspace'));
import { mergeAuthorPage, applyRetractions } from './utils/authorResults';
import AiAnalysisPanel from './components/AiAnalysisPanel';
import { useShare } from './hooks/useShare';
import { useExport } from './hooks/useExport';
import { useDrafts } from './components/workspace/useDrafts.js';
import { TEMPLATES, templateHtml } from './components/workspace/templates.js';
import { WRITER_HASH, canonicalHash, parseModeHash } from './modeRoutes.js';
// Biçim seçici yalnız yazar modunda, taslak oluştururken gerekiyor.
const FormatPicker = lazy(() => import('./components/workspace/FormatPicker.jsx'));

// "Kaynakçanı doğrula" sekmesi şimdilik kapalı (9 Eki 2026, ürün kararı).
// Doğruluk düzeltmeleri yerinde (8 Eki 2026, 24 kaynaklık denetimde 24/24);
// açmak için true yap. Sunucu (/api/resolve) ve CitationChecker duruyor.
const VERIFY_MODE_ENABLED = false;
// Yazar araması 8 Eki 2026'da yavaş olduğu için kapatılmıştı; eserler artık
// 200'lük sayfalarla geliyor (ilk yanıt ~3 sn). Sorun çıkarsa false yap.
const AUTHOR_MODE_ENABLED = true;
// Yazar paneli (CLAUDE.md WO-002): yazar araması arama kartından çıkıp kendi
// sekmesine taşınır. false iken yazar araması eskisi gibi arama kartında.
const AUTHOR_PANEL_ENABLED = true;
// Çalışma alanı (WO-003): araştırma ve yazım tek ekranda — şerit araç çubuğu,
// cetvel, sayfa ayarlı belge ve sağ panel. Henüz model çağrısı yok.
const WORKSPACE_ENABLED = true;
// Eski "AI Yazar" paneli kapalı (13 Eki 2026, ürün kararı): literatür bölümünü
// yapay zekâya yazdırmak kapsam dışı (CLAUDE.md 2.2). Yerine çalışma alanı
// açılıyor; üretim yalnız tek pasajdan tek cümle olarak, kullanıcı tıklayınca.
// Kod ve /api/writer/generate yerinde; bayrak true yapılırsa geri gelir.
const AI_WRITER_PANEL_ENABLED = false;
// WO-010'un uygulama kabuğu (ray, sekmeler, Alanım/Kaynaklar/Denetim sayfaları)
// kullanıcı kararıyla kaldırıldı (15.10.2026, WO-011): araştırma modu eski
// düzeninde, yeni tasarım yalnız yazar modunda. Eski adresler modeRoutes.js'te
// yeni yerlerine çevriliyor.

const RESULT_FILTERS = ['all', 'relevant', 'q1q2', 'recent', 'openaccess', 'highcitations'];

/** Konuya yakınlık: sorgu terimlerinin başlık/özette geçmesi (relevanceScore), eşitlikte başlık benzerliği. */
const topicCloseness = (item) => [Number(item.relevanceScore) || 0, Number(item.sSim ?? item.expandedSimilarity) || 0];

/**
 * Sonuç listesindeki hızlı filtreler. 'relevant' süzmez, listeyi AHP puanı
 * yerine arama konusuna yakınlığa göre yeniden sıralar; diğerleri süzer ve
 * AHP sırasını korur.
 */
function filterResults(results, filter, year) {
  const currentYear = new Date().getFullYear();
  if (filter === 'relevant') {
    return results
      .filter((item) => !year || Number.parseInt(item.year, 10) === year)
      .slice()
      .sort((a, b) => {
        const [ra, sa] = topicCloseness(a);
        const [rb, sb] = topicCloseness(b);
        return rb - ra || sb - sa;
      });
  }
  return results.filter((item) => {
    const itemYear = Number.parseInt(item.year, 10);
    if (year && itemYear !== year) return false;
    if (filter === 'q1q2') return item.quartile === 'Q1' || item.quartile === 'Q2';
    if (filter === 'recent') return Boolean(itemYear) && currentYear - itemYear <= 3;
    if (filter === 'openaccess') return Boolean(item.openAccess || item.isOpenAccess);
    if (filter === 'highcitations') return (Number.parseInt(item.citedBy || item.citedbyCount, 10) || 0) >= 10;
    return true;
  });
}

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
  const { t, lang } = useI18n();
  const [mainTopic, setMainTopic] = useState('');
  // Yazar araması arayüzden kaldırıldı (5 Eki 2026); sunucu parametresi boş gider.
  // Geçmişten açılan eski bir aramanın yazarı da geri yüklenmez: görünmeyen bir filtre olurdu.
  // Arama türü: konu ya da yazar. Yazar modunda kişi listeden seçilir; arama
  // adıyla değil OpenAlex kimliğiyle yapılır (aynı adda çok sayıda yazar var).
  const [searchMode, setSearchMode] = useState('topic');
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const activeAuthor = searchMode === 'author' ? selectedAuthor : null;
  const authorName = activeAuthor?.name || '';
  const [keywords, setKeywords] = useState([]);
  // Sunucu siraladigi tum adaylari (en fazla 100) dondurur; kaynaklardan
  // cekilen miktar bundan bagimsiz (server SOURCE_FETCH_COUNT). Ekranda 25'er
  // acilir; "Daha fazla goster" yeni arama yapmaz.
  const count = RESULT_LIMIT;
  const [visible, setVisible] = useState({ data: null, n: PAGE_SIZE });
  const [moreLoading, setMoreLoading] = useState(false);
  // Ana ekran: literatür arama ya da kaynakça doğrulama
  const [mode, setMode] = useState('search');
  const currentMode = mode;
  // Taslaklar (WO-011 Faz 1): Çalışmalarım listesi ve yazar modundaki belge.
  const drafts = useDrafts();
  // Biçim seçici açık mı (yeni taslak ya da hiç taslak yokken yazar modu).
  const [creatingDraft, setCreatingDraft] = useState(false);
  // Belgeye verilen komutlar (kaydet, dışa aktar …) ve yazar moduna girişte
  // geçmişe kayıt eklenip eklenmediği (çıkışta geri tuşuyla aynı yol).
  const workspaceApi = useRef(null);
  const pushedWriter = useRef(false);
  // Geçmişten açılan yazar araması için panele iletilen istek.
  const [authorPanelRequest, setAuthorPanelRequest] = useState(null);
  // Çalışma alanı bir kez açıldıktan sonra bağlı kalır: mod değişince
  // belge silinmesin, ama hiç açılmadıysa paketi de yüklenmesin.
  const workspaceOpened = useRef(false);
  if (mode === 'workspace') workspaceOpened.current = true;
  // Çalışma alanı tam ekran açılır; çıkınca kullanıcı geldiği ekrana döner.
  const modeBeforeWorkspace = useRef('search');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isShared, setIsShared] = useState(false);
  const [activeLandingTab, setActiveLandingTab] = useState(null);
  const [landingTheme, setLandingTheme] = useState('light');
  const [showWriterPanel, setShowWriterPanel] = useState(false);
  const [lastSearchParams, setLastSearchParams] = useState(null);
  // Siralama herkes icin "Dengeli". Kullanicinin profil/agirlik secebildigi panel
  // kaldirildi; tarayicida eskiden kalmis bir tercih (rankingProfile,
  // rankingCustomWeights) artik okunmuyor, yoksa degistirilemeyen gizli bir
  // agirlik olarak her aramaya uygulanirdi.
  const rankingParams = { profileId: 'dengeli' };

  const { userId, isLoaded, getToken } = useAppAuth();
  const { user, isSignedIn } = useAppUser();
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
  const { exportPDF, exportExcel, exportDocx, exportBibTeX, exportRIS } = useExport();
  const [resultFilter, setResultFilter] = useState('all');
  const [selectedYear, setSelectedYear] = useState(null);
  const [activeReaderPaper, setActiveReaderPaper] = useState(null);

  // Clerk ile oturum açıldığında kullanıcıyı senkronize et ve gerekirse hoş geldin e-postası tetikle
  useEffect(() => {
    if (!isSignedIn || !user?.id) return;
    const syncStorageKey = `welcome_synced_${user.id}`;
    if (sessionStorage.getItem(syncStorageKey)) return;

    const name = user.fullName || user.firstName || 'Araştırmacı';

    getToken().then((token) => {
      if (!token) return;
      axios.post(`${defaultApiUrl}/api/auth/sync-user`, {
        name,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      }).then((res) => {
        sessionStorage.setItem(syncStorageKey, 'true');
        if (res.data?.welcomeEmailSent) {
          console.log('[AuthSync] Hoş geldin e-postası tetiklendi:', res.data.email);
        }
      }).catch((err) => {
        console.warn('[AuthSync] Senkronizasyon uyarısı:', err?.response?.data || err.message);
      });
    }).catch(() => {});
  }, [isSignedIn, user, getToken]);


  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;

      // Cmd+K / Ctrl+K veya input dışındayken '/' -> Arama kutusuna odaklan.
      // Kabukta arama başka bir modüldeyse önce oraya gidilir.
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (!isInput && e.key === '/')) {
        e.preventDefault();
        focusSearchRef.current?.();
      }

      // Cmd+J / Ctrl+J -> Yazar Panelini aç/kapat
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (AI_WRITER_PANEL_ENABLED) setShowWriterPanel(prev => !prev);
      }

      // Esc -> Modalları / Çekmeceleri kapat
      if (e.key === 'Escape') {
        setActiveReaderPaper(null);
        setShowShareModal(false);
        // Yazı yazarken (istek kutusu vb.) ESC paneli kapatmasın: istek ve metin kaybolur.
        if (!isInput) setShowWriterPanel(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowShareModal]);

  // Arama kutusuna odaklanma (Ctrl+K, "/"). Yazar modunda kısayol çalışmaz:
  // belgede yazarken arama kutusuna atlamak yazılanı bölerdi.
  const focusSearchRef = useRef(null);
  useEffect(() => {
    focusSearchRef.current = () => {
      if (mode === 'workspace') return;
      const input = document.getElementById('topic-input');
      if (input) {
        input.focus();
        input.select();
      }
    };
  });

  // --- Mod adresi (WO-011 Faz 1) ---------------------------------------
  // Yazar modu #/yazar; araştırma adressiz. Geri/ileri tuşu ve doğrudan açılan
  // adres buradan moda çevrilir. WO-010'un eski adresleri düzgün hale getirilir.
  useEffect(() => {
    const apply = () => {
      const route = parseModeHash(window.location.hash);
      if (route.legacy || (window.location.hash && !canonicalHash(route) && route.mode === 'research')) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${canonicalHash(route)}`);
      }
      if (route.mode === 'writer') {
        setMode((m) => {
          if (m !== 'workspace') modeBeforeWorkspace.current = m;
          return 'workspace';
        });
        return;
      }
      pushedWriter.current = false;
      setMode((m) => {
        if (route.researchMode === 'author') return 'author';
        return m === 'workspace' ? modeBeforeWorkspace.current : m;
      });
      if (route.sidebarTab) {
        setSidebarOpen(true);
        window.dispatchEvent(new CustomEvent('openSidebarTab', { detail: route.sidebarTab }));
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);



  const loadingSteps = t('loading.steps');

  // Yazar modunda konu isteğe bağlı ama kişi seçilmiş olmalı.
  const canSubmitSearch = searchMode === 'author'
    ? Boolean(selectedAuthor)
    : Boolean(mainTopic.trim() || keywords.length > 0);

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

  // Loading messages interval (akıcı ve dengeli geçiş)
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
      // lang: niyet ve kavramlar arayüz dilinde gelir; arama sorguları her zaman İngilizce.
      const response = await axios.post(`${defaultApiUrl}/api/analyze-query`, { topic: mainTopic.trim(), lang }, {
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

  /** Unpaywall: DOI için yasal ücretsiz kopya (kart düğmesinden, arama sırasında değil). */
  const findFreePdf = async (doi) => {
    const token = await getToken();
    const { data: oa } = await axios.get(`${defaultApiUrl}/api/oa`, {
      params: { doi },
      headers: { Authorization: `Bearer ${token}` }
    });
    return oa;
  };

  /**
   * @param directQuery   Konuyu değiştirerek ara ("Benzerini bul").
   * @param aiQueryOverride Yalnızca bu aramada kullanılacak AI Boolean sorgusu.
   *   Konu kutusuna yazılmaz ve state'te tutulmaz: önceki sürüm seçilen sorguyu
   *   kutuya yazıyor ve saklıyordu, sonraki elle aramalar da onu gönderiyordu.
   * @param authorOverride undefined: ekrandaki yazar seçimi; null: yazarsız;
   *   { id, name }: o yazar (geçmişten açılan arama, state henüz güncellenmemişken).
   */
  const handleSearch = async (e, directQuery = null, aiQueryOverride = null, authorOverride = undefined) => {
    if (e) e.preventDefault();
    // null: ekrandaki konu. Metin (boş dâhil): o konu. Geçmişten açılışta konu
    // açıkça geçiriliyor; setMainTopic henüz yansımadığı için state eski konuyu
    // tutuyor olabilir.
    const activeTopic = directQuery !== null ? String(directQuery).trim() : mainTopic.trim();
    if (directQuery) {
      setMainTopic(directQuery);
    }
    // "Benzerini bul" bir konu araması: seçili yazara takılmasın.
    const author = authorOverride !== undefined ? authorOverride : (directQuery ? null : activeAuthor);
    if (directQuery && authorOverride === undefined && searchMode === 'author') setSearchMode('topic');
    if (authorOverride === undefined && directQuery === null && searchMode === 'author' && !author) {
      setError(t('search.authorNeedPick'));
      return;
    }
    const query = aiQueryOverride ?? '';
    const trimmedTopic = activeTopic;
    const trimmedAuthor = author?.name?.trim() || '';
    const authorId = author?.id || '';
    const normalizedQuery = typeof query === 'string' ? query.trim() : '';
    const cleanKeywords = Array.isArray(keywords)
      ? keywords.map((k) => String(k).trim()).filter(Boolean)
      : [];
    const hasKeywords = cleanKeywords.length > 0;

    if (!trimmedTopic && !normalizedQuery && !authorId && !hasKeywords) {
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
          authorId,
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
        authorId,
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
        authorId,
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

  /**
   * Yazar moduna geçer (WO-011): adres #/yazar olur, geçmişe kayıt eklenir;
   * tarayıcının geri tuşu araştırmaya döner. Taslak yoksa biçim seçici açılır.
   */
  const openWriter = () => {
    if (AI_WRITER_PANEL_ENABLED) { setShowWriterPanel(true); return; }
    if (mode === 'workspace') return;
    if (window.location.hash !== WRITER_HASH) {
      pushedWriter.current = true;
      window.location.hash = WRITER_HASH;
    } else {
      modeBeforeWorkspace.current = mode;
      setMode('workspace');
    }
  };

  /** "← Araştırma": belge kapanmaz; bekleyen kayıt yazılır, mod değişir. */
  const exitWriter = () => {
    workspaceApi.current?.flush?.();
    setCreatingDraft(false);
    if (pushedWriter.current) {
      pushedWriter.current = false;
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setMode(modeBeforeWorkspace.current === 'workspace' ? 'search' : modeBeforeWorkspace.current);
  };

  const switchMode = (next) => setMode(next);

  // --- Taslaklar (WO-011 Faz 1) ------------------------------------------
  /** Taslağı açar: önce açık belgenin bekleyen kaydı yazılır. */
  const openDraft = (id) => {
    workspaceApi.current?.flush?.();
    drafts.open(id);
    setCreatingDraft(false);
    openWriter();
  };

  /** Yeni taslak: yazar modunda biçim seçici açılır. */
  const startNewDraft = () => {
    workspaceApi.current?.flush?.();
    setCreatingDraft(true);
    openWriter();
  };

  /** Biçim seçildi: taslak şablonla oluşturulur ve açılır. */
  const createDraftFromFormat = ({ formatId, templateId, bibFormat, setup, title }) => {
    const template = TEMPLATES.find((x) => x.id === templateId);
    const id = drafts.create({
      title,
      format: formatId,
      setup,
      bibFormat,
      html: templateHtml(template, t),
      view: 'draft',
    });
    if (!id) {
      pushToast({ tone: 'warn', title: t('workspace.saveNone') });
      return;
    }
    setCreatingDraft(false);
  };

  const renameDraft = (id) => {
    const current = drafts.items.find((d) => d.id === id);
    const next = window.prompt(t('sidebar.renamePrompt'), current?.title || '');
    if (next === null) return;
    workspaceApi.current?.flush?.();
    if (!drafts.rename(id, next)) pushToast({ tone: 'warn', title: t('workspace.saveNone') });
  };

  const duplicateDraft = (id) => {
    workspaceApi.current?.flush?.();
    if (!drafts.duplicate(id, lang === 'tr' ? ' (kopya)' : ' (copy)')) pushToast({ tone: 'warn', title: t('workspace.saveNone') });
  };

  /** Silme onaylı; ardından bildirimde "Geri al" ile aynı yerine döner. */
  const deleteDraft = (id) => {
    const current = drafts.items.find((d) => d.id === id);
    const name = current?.title || t('workspace.untitled');
    if (!window.confirm(t('sidebar.deleteConfirm', { name }))) return;
    const snapshot = drafts.remove(id);
    if (!snapshot) return;
    pushToast({
      tone: 'success',
      title: t('sidebar.deleted'),
      text: name,
      action: { label: t('sidebar.undo'), onClick: () => drafts.restore(snapshot) },
      duration: 10000,
    });
  };

  /** Geçmişten bir arama (Çalışmalarım › Son aramalar). */
  const selectHistory = (item) => {
    // Yazar araması yazar panelinde açılır; konu kartına dokunmaz.
    if (AUTHOR_PANEL_ENABLED && item.authorId) {
      switchMode('author');
      setAuthorPanelRequest({ author: { id: item.authorId, name: item.authorName || '' }, topic: item.mainTopic || '', at: Date.now() });
      return;
    }
    if (mode === 'author') setMode('search');
    setMainTopic(item.mainTopic || '');
    setKeywords(item.keywords || []);
    // Yazar aramasıysa aynı kişiyle aç; değilse ekranda kalmış bir yazar seçimi
    // konu aramasına sızmasın. State güncellemesi gecikeceği için yazar
    // doğrudan geçiriliyor.
    // Yazar modu kapaliyken gecmisteki yazar aramalari konu aramasi olarak acilir.
    const author = AUTHOR_MODE_ENABLED && item.authorId ? { id: item.authorId, name: item.authorName || '' } : null;
    setSearchMode(author ? 'author' : 'topic');
    setSelectedAuthor(author);
    handleSearch(null, item.mainTopic || '', item.aiQuery || null, author);
  };

  const deleteHistoryEntry = async (id) => {
    const token = await getToken();
    await axios.delete(`${defaultApiUrl}/api/history/entry/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    window.dispatchEvent(new CustomEvent('refreshHistory'));
  };

  /** Sonuçları temizler; arama kutusu boşalır. Sepet ve geçmiş yerinde kalır. */
  const newSearch = () => {
    setData(null);
    setMainTopic('');
    setKeywords([]);
    setAiAnalysis(null);
    setIsShared(false);
    setError(null);
  };

  // Gosterilen sonuc sayisi bu `data` icin; yeni arama ya da yeniden siralama 25'e doner.
  const shownCount = visible.data === data ? visible.n : PAGE_SIZE;

  // Yazar aramasi 200'luk sayfalarla geliyor: yuklenenler bitince sonraki sayfa
  // istenir ve listenin sonuna eklenir (ayni eser iki sayfada gelirse bir kez).
  const authorHasMore = Boolean(data?.author?.hasMore && lastSearchParams?.authorId);
  const loadMoreAuthor = async () => {
    setMoreLoading(true);
    try {
      const token = await getToken();
      const res = await axios.get(`${defaultApiUrl}/api/search`, {
        params: { ...lastSearchParams, ...rankingParams, authorPage: (data.author.page || 1) + 1 },
        headers: { Authorization: `Bearer ${token}` },
      });
      const merged = mergeAuthorPage(data, res.data);
      setData(merged);
      setVisible({ data: merged, n: Math.min(shownCount + PAGE_SIZE, merged.results.length) });
    } catch (err) {
      pushToast({ tone: 'warn', title: err.response?.data?.error || t('search.failed') });
    } finally {
      setMoreLoading(false);
    }
  };

  const showMore = async () => {
    if (!data?.results) return;
    if (shownCount >= data.results.length && authorHasMore) return loadMoreAuthor();
    const next = Math.min(shownCount + PAGE_SIZE, data.results.length);
    const page = data.results.slice(shownCount, next);
    setVisible({ data, n: next });
    // Arama yalnizca ilk 25'i kontrol ediyor; acilan sayfayi simdi kontrol et.
    const dois = page.filter((r) => r.doi && !r.retraction).map((r) => r.doi);
    if (dois.length === 0) return;
    setMoreLoading(true);
    try {
      const found = await checkRetractions(dois);
      if (found) {
        const updated = applyRetractions(data, found);
        setData(updated);
        setVisible({ data: updated, n: next });
      }
    } finally {
      setMoreLoading(false);
    }
  };

  // Açılan sayfanın geri çekme kontrolü; konu araması ve yazar paneli ortak kullanır.
  // Hata aramayı bozmaz: null döner, kartlar işaretsiz kalır.
  const checkRetractions = async (dois) => {
    try {
      const token = await getToken();
      const res = await axios.post(`${defaultApiUrl}/api/retractions`, { dois }, { headers: { Authorization: `Bearer ${token}` } });
      return res.data?.results || {};
    } catch (err) {
      console.warn('Retraction check failed', err);
      return null;
    }
  };

  // Eser kartı: sepet, favori, PDF ve okuyucu bağlantılarıyla. Konu araması ve
  // yazar paneli aynı kartı çizer. "Benzerini bul" her zaman konu araması açar.
  const renderPaper = (item, idx, source) => (
    <ResultCard
      key={item.doi || item.url || item.title || idx}
      item={item}
      rank={idx + 1}
      appliedWeights={source.methodology?.appliedWeights}
      oaEnabled={Boolean(source.features?.unpaywall)}
      onFindPdf={findFreePdf}
      onFavorite={handleFavorite}
      isFavorited={isPaperFavorited(item)}
      isSelected={basket.has(item)}
      onToggleSelect={(el) => handleToggleBasket(item, el)}
      onOpenReader={setActiveReaderPaper}
      onFindSimilar={(paper) => { switchMode('search'); handleSearch(null, paper.title); }}
    />
  );

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

  // Sekme çubuğu hem arama kabında hem çalışma alanında çiziliyor; ikisi aynı
  // anda görünmüyor, seçili sekme tek `mode` durumundan geliyor.
  const modeTabs = (VERIFY_MODE_ENABLED || AUTHOR_PANEL_ENABLED) && !isShared ? (
    <div className="ui-modes" role="tablist" aria-label={t('modes.label')}>
      <button type="button" role="tab" aria-selected={mode === 'search'} className="ui-modes__tab" onClick={() => setMode('search')}>
        <Search size={15} /> {t('modes.search')}
      </button>
      {AUTHOR_PANEL_ENABLED && (
        <button type="button" role="tab" aria-selected={mode === 'author'} className="ui-modes__tab" onClick={() => setMode('author')}>
          <UserRound size={15} /> {t('modes.author')}
        </button>
      )}
      {VERIFY_MODE_ENABLED && (
        <button type="button" role="tab" aria-selected={mode === 'verify'} className="ui-modes__tab" onClick={() => setMode('verify')}>
          <ListChecks size={15} /> {t('modes.verify')}
        </button>
      )}
    </div>
  ) : null;

  // Arama içeriği ve Araştırmacı paneli iki düzende de aynı düğümden çizilir
  // (WO-010): durum burada; kabuk ve eski düzen yalnız nereye koyacağını seçer.
  const authorPanelNode = AUTHOR_PANEL_ENABLED && !isShared ? (
              <AuthorPanel
                apiUrl={defaultApiUrl}
                getToken={getToken}
                request={authorPanelRequest}
                renderPaper={renderPaper}
                checkRetractions={checkRetractions}
                hidden={currentMode !== 'author'}
              />
  ) : null;

  const searchContent = (
    <>
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
                  {AUTHOR_MODE_ENABLED && !AUTHOR_PANEL_ENABLED && (
                    <div className="ui-mode-tabs" role="tablist" aria-label={t('search.modeLabel')}>
                      <button type="button" role="tab" className="ui-mode-tab" aria-selected={searchMode === 'topic'} onClick={() => setSearchMode('topic')}>
                        <Search size={14} aria-hidden="true" /> {t('search.modeTopic')}
                      </button>
                      <button type="button" role="tab" className="ui-mode-tab" aria-selected={searchMode === 'author'} onClick={() => setSearchMode('author')}>
                        <UserRound size={14} aria-hidden="true" /> {t('search.modeAuthor')}
                      </button>
                    </div>
                  )}

                  {searchMode === 'author' && (
                    <AuthorPicker
                      apiUrl={defaultApiUrl}
                      getToken={getToken}
                      value={selectedAuthor}
                      onChange={setSelectedAuthor}
                      disabled={loading}
                    />
                  )}

                  <div>
                    <label htmlFor="topic-input" className="ui-field-label">{t(searchMode === 'author' ? 'search.authorTopicLabel' : 'search.topicLabel')}</label>
                    <div className="input-wrapper query-input-shell" style={{ position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: '16px', top: isCompact ? '26px' : '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} size={18} />
                      <input
                        id="topic-input"
                        type="text"
                        className="input"
                        style={{
                          height: '52px',
                          paddingLeft: '46px',
                          paddingRight: isCompact || searchMode === 'author' ? '16px' : '170px',
                          fontSize: 'var(--fs-md)',
                          borderRadius: 'var(--radius-md)',
                          width: '100%'
                        }}
                        placeholder={t(searchMode === 'author' ? 'search.authorTopicPlaceholder' : 'search.topicPlaceholder')}
                        value={mainTopic}
                        onChange={(e) => setMainTopic(e.target.value)}
                        inputMode="search"
                        enterKeyHint="search"
                        autoCorrect="off"
                        autoCapitalize="none"
                        autoComplete="off"
                      />
                      {/* AI geliştirme konu sorgusu kuruyor; yazar aramasında yeri yok. */}
                      {searchMode !== 'author' && (
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
                      )}
                    </div>
                    {searchMode === 'author' && <p className="ui-author-note" style={{ marginTop: 'var(--space-2)' }}>{t('search.authorNote')}</p>}
                    {aiError && (
                      <div style={{ marginTop: 'var(--space-2)', color: 'var(--score-low)', fontSize: 'var(--fs-sm)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={14} /> {aiError}
                      </div>
                    )}
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
                  initial={{ opacity: 0, y: 12 }}
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
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', fontWeight: 500, minHeight: '1.5em', margin: 0 }}
                    >
                      {loadingSteps[loadingStep % loadingSteps.length]}
                    </motion.p>
                  </AnimatePresence>

                  {/* 4 Aşamalı Süreç Göstergesi */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
                    gap: '8px',
                    maxWidth: '820px',
                    margin: '0 auto 1.5rem',
                    textAlign: 'left'
                  }}>
                    {[
                      { step: 1, title: 'AI & MeSH Çeviri', desc: 'Boolean Genişletme' },
                      { step: 2, title: '9 Açık Kaynak', desc: 'OpenAlex, Crossref, Europe PMC' },
                      { step: 3, title: 'AHP Matrisi', desc: 'SJR Q1-Q4 & Atıf Skoru' },
                      { step: 4, title: 'Unpaywall & PDF', desc: 'Açık Erişim Doğrulama' },
                    ].map((st, i) => {
                      const isActive = loadingStep >= i;
                      return (
                        <div
                          key={st.step}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(0,0,0,0.02)',
                            border: isActive ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(0,0,0,0.05)',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                            <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: isActive ? 'var(--brand-primary)' : '#cbd5e1', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '9px', fontWeight: '800' }}>{st.step}</span>
                            <span>{st.title}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', paddingLeft: '22px' }}>{st.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </MotionDiv>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {aiAnalysis && !loading && (
                <AiAnalysisPanel
                  ref={aiPanelRef}
                  analysis={aiAnalysis}
                  // Konu kutusu değişmez; seçilen yaklaşımın Boolean sorgusu yalnızca bu aramaya gider.
                  onPick={(q) => { setSearchMode('topic'); handleSearch(null, null, q.text, null); }}
                />
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
                    <strong>{t('results.shown', { n: Math.min(shownCount, data.results.length), total: data.results.length })}</strong>
                    {data.relevance?.dropped > 0 && <> · {t('results.dropped', { n: data.relevance.dropped })}</>}
                    {data.author && (
                      <> · {t(data.author.hasMore ? 'results.authorLoaded' : (data.author.capped ? 'results.authorCapped' : 'results.authorAll'), {
                        n: Number(data.results.length || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US'),
                        total: Number(data.author.total || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US'),
                      })}{data.author.partial && <> · {t('results.authorPartial')}</>}</>
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
                      onBibtex={() => exportBibTeX(data, mainTopic)}
                      onRis={() => exportRIS(data, mainTopic)}
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

                <ConsensusSnapshot
                  topic={mainTopic}
                  papers={data.results}
                  apiUrl={defaultApiUrl}
                />

                <PublicationTimeline
                  results={data.results}
                  selectedYear={selectedYear}
                  onSelectYear={setSelectedYear}
                />

                <div role="group" aria-label={t('results.filter.label')} style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center', margin: 'var(--space-3) 0' }}>
                  {RESULT_FILTERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`ui-chip${resultFilter === f ? ' ui-chip--brand' : ''}`}
                      style={{ cursor: 'pointer' }}
                      aria-pressed={resultFilter === f}
                      onClick={() => setResultFilter(f)}
                    >
                      {t(`results.filter.${f}`, { n: data.results.length })}
                    </button>
                  ))}
                  {selectedYear && (
                    <button
                      type="button"
                      className="ui-chip ui-chip--brand"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedYear(null)}
                      aria-label={t('results.filter.clearYear', { year: selectedYear })}
                    >
                      {selectedYear} <X size={12} />
                    </button>
                  )}
                </div>

                <div id="results-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' }}>
                  {filterResults(data.results, resultFilter, selectedYear).slice(0, shownCount).map((item, idx) => renderPaper(item, idx, data))}
                </div>

                {(shownCount < data.results.length || authorHasMore) && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
                    <button type="button" className="ui-btn ui-btn--outline" onClick={showMore} disabled={moreLoading}>
                      {moreLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                      {shownCount < data.results.length
                        ? t('results.showMore', { n: Math.min(PAGE_SIZE, data.results.length - shownCount), left: data.results.length - shownCount })
                        // Kalan, sayfa numarasindan: liste tekrar eden eserler ayiklanmis halde, kisa kalir.
                        : t('results.authorLoadMore', { n: Math.min(data.author.pageSize, Math.max(0, Math.min(data.author.total, data.author.max) - data.author.page * data.author.pageSize)) })}
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
    </>
  );

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
          onSelectHistory={selectHistory}
          onDeleteHistoryEntry={deleteHistoryEntry}
          basket={basket}
          onOpenWriter={openWriter}
          onNewSearch={newSearch}
          drafts={drafts.items}
          activeDraftId={drafts.index.activeId}
          onOpenDraft={openDraft}
          onNewDraft={startNewDraft}
          onRenameDraft={renameDraft}
          onDuplicateDraft={duplicateDraft}
          onDeleteDraft={deleteDraft}
        />

        <main className="app-main" style={{
          marginLeft: isMobile ? '0px' : (sidebarOpen ? '280px' : '72px'),
          marginRight: (!isMobile && AI_WRITER_PANEL_ENABLED && showWriterPanel)
            // AI Yazar ayarları 420px'lik panelde; sonuçlar yanında görünür kalır.
            ? '420px'
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

          {/* Tam ekran, ayrı bir yüzey: kenar çubuğu ve üst çubuk görünmez.
              Bileşen kendini document.body'ye çizer; burada yalnız bağlı kalır. */}
          {/* Her taslak kendi örneğinde açılır (key): taslak değişince belge yeniden okunur. */}
          {WORKSPACE_ENABLED && !isShared && workspaceOpened.current && drafts.active && (
            <Suspense fallback={null}>
              <Workspace
                key={drafts.active.id}
                draftId={drafts.active.id}
                basket={basket}
                apiUrl={defaultApiUrl}
                getToken={getToken}
                hidden={mode !== 'workspace' || creatingDraft}
                onExit={exitWriter}
                apiRef={workspaceApi}
                onSaved={drafts.refresh}
                onFindSources={exitWriter}
              />
            </Suspense>
          )}
          {/* Yazar modunda taslak yoksa ya da "Yeni taslak" seçildiyse: biçim seçimi. */}
          {WORKSPACE_ENABLED && !isShared && mode === 'workspace' && (creatingDraft || !drafts.active) && (
            <Suspense fallback={null}>
              <FormatPicker
                mode="create"
                onCancel={drafts.active ? () => setCreatingDraft(false) : exitWriter}
                onConfirm={createDraftFromFormat}
              />
            </Suspense>
          )}

          <div className="query-workspace" style={{
            display: WORKSPACE_ENABLED && mode === 'workspace' && !isShared ? 'none' : undefined,
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

            {modeTabs}

            {/* Panel sekme değişince silinmez, gizlenir: kendi listesini korur. */}
            {authorPanelNode}

            {AUTHOR_PANEL_ENABLED && mode === 'author' && !isShared ? null : VERIFY_MODE_ENABLED && mode === 'verify' && !isShared ? (
              <CitationChecker
                apiUrl={defaultApiUrl}
                getToken={getToken}
                basket={basket}
                onAdd={handleToggleBasket}
              />
            ) : searchContent}

          </div>
        </main>

        {/* Seçim çubuğu: yalnızca seçim varken. Önceki "0 kaynak seçildi"
            çubuğu hiç seçim yokken de görünüyordu; yüzen "Yazar Modu" düğmesi
            ise kartların yer imi/yıldız düğmelerini örtüyordu. */}
        {/* Yazar modu: sağ kenarda, sayaçlı. "Makalene ekle" ile seçilen
            makaleler buraya uçar; tıklayınca yazar paneli sağdan açılır.
            Alt çubuk kaldırıldı: üret düğmesi orada zor bulunuyordu. */}
        <AnimatePresence>
          {(data || basket.papers.length > 0 || drafts.active) && !showWriterPanel && mode !== 'workspace' && (
            <WriterDock
              key="writer-dock"
              count={basket.papers.length}
              limit={basket.limit}
              draftTitle={drafts.active ? (drafts.active.title || t('workspace.untitled')) : null}
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
        {AI_WRITER_PANEL_ENABLED && showWriterPanel && (
          <WriterPanel
            key="writer-panel"
            papers={basket.papers}
            apiUrl={defaultApiUrl}
            getToken={getToken}
            onClose={() => setShowWriterPanel(false)}
            onRemoveSource={(paper) => basket.remove(paper)}
            onEditSources={() => {
              // Kaynaklar sonuç kartlarındaki "Makalene ekle" ile seçiliyor; oraya götür.
              setShowWriterPanel(false);
              const target = document.getElementById('results-container') || document.getElementById('topic-input');
              target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              if (!document.getElementById('results-container')) target?.focus();
            }}
          />
        )}
      </AnimatePresence>

      {/* Slide-over Paper Reader Drawer */}
      <PaperReaderDrawer
        paper={activeReaderPaper}
        onClose={() => setActiveReaderPaper(null)}
        isSelected={activeReaderPaper ? basket.has(activeReaderPaper) : false}
        onToggleSelect={(paper) => handleToggleBasket(paper)}
        onFindSimilar={(paper) => {
          setActiveReaderPaper(null);
          setMainTopic(paper.title);
          handleSearch(null, paper.title);
        }}
      />
    </>
  );
}

export default App;
