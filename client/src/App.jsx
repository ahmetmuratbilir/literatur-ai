import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
const MotionDiv = motion.div;
const MotionH1 = motion.h1;

import {
  BarChart2,
  Loader2,
  Search,
  SearchX,
  Tag,
  User,
  Download,
  Settings,
  AlertCircle,
  X,
  Zap,
  WifiOff,
  Sparkles,
  Sun,
  FileText,
  Cpu,
  Trophy,
  FileSearch,
  ChevronDown,
  Filter,
  Check,
  Bookmark,
  Activity,
  Star,
  Layers,
  CheckCircle2,
  Share2,
  MessageCircle,
  Linkedin,
  Link2,
  Copy,
  Mail,
  Moon,
  GraduationCap,
  Building2,
  Microscope,
  Users,
  Library,
  ShieldCheck
} from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/clerk-react';
const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  AlignmentType
} from 'docx';
import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';
import ResultCard from './components/ResultCard';
import GlobalStats from './components/GlobalStats';
import InfiniteTicker from './components/InfiniteTicker';
import HistorySidebar from './components/HistorySidebar';

const LOADING_MESSAGES = [
  'Dünyanın en büyük 7 akademik kaynağına güvenli bağlantı kuruluyor...',
  'Scopus, OpenAlex, CORE ve Crossref veri havuzları taranıyor...',
  'OpenCitations ile atıf verileri çapraz kontrolden geçiriliyor...',
  '810 Milyondan fazla kayıt arasında konu eşleşmesi yapılıyor...',
  'AHP algoritması ile en yüksek kaliteli yayınlar önceliklendiriliyor...',
  'Sizin için en güncel ve alakalı literatür listesi hazırlanıyor...',
];

const COPYRIGHT_NOTICE = '© LiteratureAI. Akademik Literatür Analiz ve AHP Skorlama Sistemi.';

const FEATURE_HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'AI sorgu geni\u015fletme',
    text: 'T\u00fcrk\u00e7e konunuz \u0130ngilizce Boolean sorguya \u00e7evrilir; 5 alternatif \u00f6neri sunulur.'
  },
  {
    icon: BarChart2,
    title: 'AHP skorlama',
    text: 'Alaka, at\u0131f ve g\u00fcncellik a\u011f\u0131rl\u0131klar\u0131yla her makale 0-100 aras\u0131 puanlan\u0131r.'
  },
  {
    icon: Download,
    title: 'Tek t\u0131k d\u0131\u015fa aktar\u0131m',
    text: 'Sonu\u00e7lar\u0131 PDF, Word veya Excel olarak haz\u0131r rapor halinde indirin.'
  }
];

const USER_TIERS = [
  {
    icon: Users,
    title: 'Akademisyenler',
    text: 'Literatür taramasını saniyeler içinde tamamlayın.'
  },
  {
    icon: Building2,
    title: 'Kurumlar',
    text: 'Üniversite kütüphanenizi akıllı asistanla güçlendirin.'
  },
  {
    icon: Microscope,
    title: 'Araştırmacılar',
    text: 'Yüzbinlerce döküman içinden doğru veriyi bulun.'
  },
  {
    icon: GraduationCap,
    title: 'Öğrenciler',
    text: 'Araştırma ödevlerinizi doğru kaynaklarla tamamlayın.'
  }
];

const LANDING_STATS = [
  { value: '810M+', label: 'Akademik Kaynak' },
  { value: '1.2B+', label: 'Atıf Verisi' },
  { value: '60.000+', label: 'Bireysel Araştırmacı' }
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
  const [collections, setCollections] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
  const [isCompact, setIsCompact] = useState(window.innerWidth < 640);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isShared, setIsShared] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeLandingTab, setActiveLandingTab] = useState(null);
  const [landingTheme, setLandingTheme] = useState('light');
  const canSubmitSearch = Boolean(
    mainTopic.trim() ||
    authorName.trim() ||
    selectedAiQuery.trim() ||
    keywords.length > 0
  );


  const { userId, isLoaded, getToken } = useAuth();
  const fetchCollections = useCallback(async () => {
    if (!userId) return;

    try {
      const token = await getToken();
      const response = await axios.get(`${defaultApiUrl}/api/collections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCollections(response.data);
    } catch (err) {
      console.error('Failed to fetch collections', err);
    }
  }, [getToken, userId]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const mobile = w < 768;
      setIsMobile(mobile);
      setIsTablet(w >= 768 && w < 1024);
      setIsCompact(w < 640);
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isLoaded && userId) {
      setDeviceId(userId);
      fetchCollections();
    } else if (isLoaded) {
      setDeviceId('');
      setCollections([]);
    }
  }, [fetchCollections, userId, isLoaded]);

  useEffect(() => {
    // --- Paylaşılan İçerik Kontrolü ---
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

  const handleSaveToCollection = async (collectionId, paper) => {
    try {
      const token = await getToken();
      const response = await axios.post(`${defaultApiUrl}/api/collections/${collectionId}/add`, {
        paper: {
          title: paper.title,
          year: String(paper.year),
          authors: paper.creator || 'Bilinmeyen',
          url: paper.url,
          doi: paper.doi,
          publicationName: paper.publicationName,
          citedBy: paper.citedBy,
          description: paper.description
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.dispatchEvent(new CustomEvent('refreshCollections'));
      return response.data;
    } catch (err) {
      console.error('Kaydetme hatası:', err);
      throw err;
    }
  };

  const exportPDF = () => {
    const element = document.getElementById('results-container');
    const opt = {
      margin: [10, 10],
      filename: `LiteratureAI_Rapor_${mainTopic || 'Arastirma'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const exportExcel = () => {
    const headers = ['Başlık', 'Yıl', 'Yazar', 'Yayın', 'DOI', 'Atıf', 'URL'];
    const rows = data.results.map(item => [
      item.title,
      item.year,
      item.creator,
      item.publicationName,
      item.doi,
      item.citedBy,
      item.url
    ]);
    
    let csvContent = "\uFEFF"; 
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `LiteratureAI_Veri_${mainTopic || 'Arastirma'}.csv`);
  };

  const exportDocx = async () => {
    const docChildren = [
      new Paragraph({ text: 'LiteratureAI Akademik Raporu', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Konu: ${mainTopic}`, spacing: { before: 200, after: 200 } }),
    ];
    data.results.forEach(item => {
      docChildren.push(
        new Paragraph({ text: `${item.title || 'İsimsiz'} (${item.year || '-'})`, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: `Yazarlar: ${item.creator || 'Bilinmeyen'}` }),
        new Paragraph({ text: `Yayın: ${item.publicationName || '-'}` }),
        new Paragraph({ text: `DOI: ${item.doi || '-'}`, spacing: { after: 200 } }),
      );
    });
    const doc = new Document({ sections: [{ properties: {}, children: docChildren }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `LiteratureAI_Belge_${mainTopic || 'Arastirma'}.docx`);
  };

  const getPaperIdentity = useCallback((paper) => {
    const doi = typeof paper?.doi === 'string' ? paper.doi.trim().toLowerCase() : '';
    if (doi) return `doi:${doi}`;
    const title = typeof paper?.title === 'string' ? paper.title.trim().toLowerCase() : '';
    return `title:${title}`;
  }, []);

  const findFavoriteMatch = useCallback((paper) => {
    const favoriteCollection = collections.find((collection) => collection.name === 'Favoriler');
    if (!favoriteCollection) {
      return { favoriteCollection: null, matchedPaper: null };
    }

    const identity = getPaperIdentity(paper);
    const matchedPaper = favoriteCollection.papers?.find((savedPaper) => (
      getPaperIdentity(savedPaper) === identity
    )) || null;

    return { favoriteCollection, matchedPaper };
  }, [collections, getPaperIdentity]);

  const isPaperFavorited = useCallback((paper) => {
    const { matchedPaper } = findFavoriteMatch(paper);
    return Boolean(matchedPaper);
  }, [findFavoriteMatch]);

  const handleFavorite = async (paper) => {
    if (!userId) return;
    const token = await getToken();
    let { favoriteCollection, matchedPaper } = findFavoriteMatch(paper);

    if (!favoriteCollection) {
      try {
        const res = await axios.post(`${defaultApiUrl}/api/collections`, {
          name: 'Favoriler'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        favoriteCollection = res.data;
        setCollections((prev) => [...prev, favoriteCollection]);
      } catch (err) {
        console.error('Failed to create Favoriler collection', err);
        return;
      }
    }

    try {
      if (matchedPaper?._id) {
        await axios.delete(`${defaultApiUrl}/api/collections/${favoriteCollection._id}/papers/${matchedPaper._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        window.dispatchEvent(new CustomEvent('refreshCollections'));
        return;
      }

      await handleSaveToCollection(favoriteCollection._id, paper);
    } catch (err) {
      console.error('Failed to update favorites', err);
      setError(err.response?.data?.error || 'Favori islemi sirasinda hata olustu.');
    }
  };

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

  const handleShare = async () => {
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

  return (
    <>
      <SignedOut>
        <div className="landing-page" style={{ 
          minHeight: '100vh', 
          background: landingTheme === 'light' ? '#f8fafc' : '#0f172a',
          color: landingTheme === 'light' ? '#0f172a' : '#f8fafc',
          overflowX: 'hidden',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {/* Custom Clerk Styling to make it larger and premium */}
          <style>{`
            .cl-modalBackdrop {
              backdrop-filter: blur(8px) !important;
              background-color: rgba(0, 0, 0, 0.4) !important;
            }
          `}</style>
          {/* Landing Info Modals */}
          <AnimatePresence>
            {activeLandingTab && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setActiveLandingTab(null)}
                  style={{ position: 'absolute', inset: 0, background: landingTheme === 'light' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)' }} 
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  style={{
                    position: 'relative', width: '100%', maxWidth: '600px', 
                    background: landingTheme === 'light' ? 'white' : '#1e293b', 
                    borderRadius: '32px',
                    padding: '3rem', 
                    boxShadow: '0 30px 60px -12px rgba(0,0,0,0.25)', 
                    border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                    color: landingTheme === 'light' ? '#0f172a' : '#f8fafc'
                  }}
                >
                  <button onClick={() => setActiveLandingTab(null)} style={{ position: 'absolute', right: '24px', top: '24px', background: landingTheme === 'light' ? '#f1f5f9' : '#334155', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}><X size={18} /></button>
                  
                  {activeLandingTab === 'features' && (
                    <div>
                      <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: landingTheme === 'light' ? '#eef2ff' : 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}><Zap size={28} /></div>
                      <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Platform Özellikleri</h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ padding: '1rem', borderRadius: '16px', background: landingTheme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontWeight: '700', marginBottom: '4px' }}>AHP Tabanlı Akıllı Sıralama</div>
                          <div style={{ fontSize: '0.9rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Makaleleri sadece anahtar kelimeye göre değil; atıf sayısı, güncellik ve alaka düzeyine göre puanlarız.</div>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: '16px', background: landingTheme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontWeight: '700', marginBottom: '4px' }}>AI Literatür Sentezi</div>
                          <div style={{ fontSize: '0.9rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Llama 3.1 desteğiyle onlarca makaleyi saniyeler içinde okuyup size akademik bir özet sunarız.</div>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: '16px', background: landingTheme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontWeight: '700', marginBottom: '4px' }}>Çapraz Kaynak Taraması</div>
                          <div style={{ fontSize: '0.9rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Scopus, OpenAlex ve Crossref dahil 7 farklı dev veri tabanını aynı anda tararız.</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeLandingTab === 'how-it-works' && (
                    <div>
                      <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: landingTheme === 'light' ? '#f0fdf4' : 'rgba(22, 163, 74, 0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}><Cpu size={28} /></div>
                      <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Sistem Nasıl Çalışır?</h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: '800' }}>1</div>
                          <div>
                            <div style={{ fontWeight: '700' }}>Akıllı Sorgu Analizi</div>
                            <div style={{ fontSize: '0.85rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Girdiğiniz konu yapay zeka tarafından analiz edilir ve en geniş sonuç için akademik terimlere dönüştürülür.</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: '800' }}>2</div>
                          <div>
                            <div style={{ fontWeight: '700' }}>Veri Madenciliği ve Filtreleme</div>
                            <div style={{ fontSize: '0.85rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Milyonlarca kayıt taranır, DOI doğrulamaları yapılır ve mükerrer sonuçlar temizlenir.</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: '800' }}>3</div>
                          <div>
                            <div style={{ fontWeight: '700' }}>AHP Puanlama ve Sunum</div>
                            <div style={{ fontSize: '0.85rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Matematiksel ağırlıklandırma ile en değerli yayınlar en üste çıkarılarak önünüze getirilir.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeLandingTab === 'resources' && (
                    <div>
                      <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: landingTheme === 'light' ? '#fff7ed' : 'rgba(234, 88, 12, 0.1)', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}><FileSearch size={28} /></div>
                      <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Veri Kaynaklarımız</h2>
                      <p style={{ color: landingTheme === 'light' ? '#64748b' : '#94a3b8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>Literatur AI, dünyanın en saygın ve geniş kapsamlı akademik veri sağlayıcılarıyla tam entegre çalışır:</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {['Scopus (Elsevier)', 'OpenAlex (Full Open)', 'CORE UK', 'Crossref (DOI)', 'Semantic Scholar', 'ArXiv (Pre-print)', 'DOAJ (Open Access)'].map(src => (
                          <div key={src} style={{ padding: '12px', border: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600', color: landingTheme === 'light' ? '#475569' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ea580c' }}></div>
                            {src}
                          </div>
                        ))}
                      </div>
                      <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>* Toplamda 810 milyondan fazla metaveri ve tam metin kaydına erişim sağlanmaktadır.</p>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          {/* Header */}
          <nav className="landing-nav" style={{ background: landingTheme === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.8)', borderBottom: landingTheme === 'light' ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'linear-gradient(135deg, #4f46e5, #a855f7)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={22} color="white" fill="white" />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>Literatur AI</span>
            </div>
            
            <div className="nav-links nav-links-center">
              <button onClick={() => setActiveLandingTab('features')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', letterSpacing: '0.01em', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Özellikler</button>
              <button onClick={() => setActiveLandingTab('how-it-works')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', letterSpacing: '0.01em', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Nasıl Çalışır?</button>
              <button onClick={() => setActiveLandingTab('resources')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', letterSpacing: '0.01em', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Kaynaklar</button>
            </div>

            <div className="nav-links auth-btns nav-links-auth">
              <button 
                onClick={() => setLandingTheme(landingTheme === 'light' ? 'dark' : 'light')}
                style={{ background: 'transparent', border: 'none', padding: '10px', cursor: 'pointer', color: landingTheme === 'light' ? '#64748b' : '#94a3b8', transition: 'transform 0.3s ease' }}
              >
                {landingTheme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <SignInButton mode="modal">
                <button style={{ background: 'transparent', border: 'none', fontWeight: '700', color: landingTheme === 'light' ? '#1e293b' : '#f8fafc', cursor: 'pointer', fontSize: '0.9rem' }}>Giriş Yap</button>
              </SignInButton>
              <SignInButton mode="modal">
                <button style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}>Ücretsiz Başlayın</button>
              </SignInButton>
            </div>
          </nav>

          {/* Hero Section */}
          <div style={{ 
            padding: '160px 2rem 100px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            textAlign: 'center' 
          }}>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="hero-badge"
              style={{ background: landingTheme === 'light' ? '#f5f3ff' : 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}
            >
              <Sparkles size={14} />
              <span>AI destekli akademik arama & AHP sıralama</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontSize: 'min(4rem, 10vw)', fontWeight: '900', maxWidth: '900px', lineHeight: '1.1', marginBottom: '1.5rem', letterSpacing: '-0.04em', color: landingTheme === 'light' ? '#0f172a' : '#ffffff' }}
            >
              En iyi akademik makaleleri <span style={{ color: '#6366f1' }}>saniyeler</span> içinde bulun.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ color: landingTheme === 'light' ? '#64748b' : '#94a3b8', fontSize: '1.15rem', maxWidth: '600px', marginBottom: '3rem', lineHeight: '1.6' }}
            >
              810 milyondan fazla akademik yayını tarayın, analiz edin ve en kaliteli kaynaklara ulaşın.
            </motion.p>

            {/* Mock Search Bar */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              style={{ 
                width: '100%', 
                maxWidth: '720px', 
                background: landingTheme === 'light' ? 'white' : '#1e293b', 
                padding: '8px', 
                borderRadius: '20px', 
                display: 'flex', 
                alignItems: 'center', 
                boxShadow: landingTheme === 'light' ? '0 20px 50px -12px rgba(0,0,0,0.1)' : '0 20px 50px -12px rgba(0,0,0,0.5)',
                border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                marginBottom: '1.5rem'
              }}
            >
              <div style={{ padding: '0 15px', color: '#94a3b8' }}><Search size={22} /></div>
              <input 
                readOnly 
                placeholder="Araştırmak istediğiniz konuyu yazın..." 
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1.1rem', color: landingTheme === 'light' ? '#1e293b' : '#f8fafc', background: 'transparent' }}
              />
              <div style={{ padding: '6px 12px', background: landingTheme === 'light' ? '#f1f5f9' : '#334155', borderRadius: '8px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700', marginRight: '10px' }}>⌘ K</div>
              <SignInButton mode="modal">
                <button style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '14px', fontWeight: '700', cursor: 'pointer', fontSize: '1rem' }}>Ara</button>
              </SignInButton>
            </motion.div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', alignSelf: 'center' }}>Örnek aramalar:</span>
              {['transportation models', 'sustainable cities', 'AI in healthcare', 'supply chain optimization', 'renewable energy'].map(tag => (
                <button key={tag} style={{ background: landingTheme === 'light' ? 'white' : 'rgba(255,255,255,0.05)', border: landingTheme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: '99px', color: landingTheme === 'light' ? '#475569' : '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>{tag}</button>
              ))}
            </div>

            {/* User Tiers Section */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
              gap: '1.5rem', 
              marginTop: '4rem',
              width: '100%',
              maxWidth: '1200px'
            }}>
              {USER_TIERS.map((tier, idx) => {
                const TierIcon = tier.icon;
                return (
                  <motion.div 
                    key={tier.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + (idx * 0.1) }}
                    whileHover={{ y: -8, boxShadow: landingTheme === 'light' ? '0 20px 40px -15px rgba(0,0,0,0.1)' : '0 20px 40px -15px rgba(0,0,0,0.4)' }}
                    style={{
                      background: landingTheme === 'light' ? 'white' : 'rgba(30, 41, 59, 0.4)',
                      padding: '2rem',
                      borderRadius: '24px',
                      border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      backdropFilter: 'blur(12px)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: landingTheme === 'light' ? '#f5f3ff' : 'rgba(99, 102, 241, 0.1)',
                      color: '#6366f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1.5rem'
                    }}>
                      <TierIcon size={28} />
                    </div>
                    <h3 style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: '800', 
                      marginBottom: '0.75rem',
                      color: landingTheme === 'light' ? '#0f172a' : '#f8fafc'
                    }}>
                      {tier.title}
                    </h3>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      lineHeight: '1.6',
                      color: landingTheme === 'light' ? '#64748b' : '#94a3b8'
                    }}>
                      {tier.text}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Stats Section */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '4rem', 
              marginTop: '5rem',
              padding: '4rem 2rem',
              width: '100%',
              maxWidth: '900px',
              borderTop: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)'
            }}>
              {LANDING_STATS.map((stat, idx) => (
                <motion.div 
                  key={stat.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 + (idx * 0.2) }}
                  style={{ textAlign: 'center', flex: 1 }}
                >
                  <div style={{ 
                    fontSize: '3.5rem', 
                    fontWeight: '900', 
                    color: landingTheme === 'light' ? '#0f172a' : '#ffffff',
                    letterSpacing: '-0.02em',
                    lineHeight: '1'
                  }}>
                    {stat.value}
                  </div>
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: '700', 
                    color: '#6366f1',
                    marginTop: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Features */}
            <div className="feature-grid">
              <div className="feature-item" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(255,255,255,0.05)' }}>
                <div className="feature-icon-wrapper" style={{ background: landingTheme === 'light' ? '#f5f3ff' : 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}><Library size={24} /></div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>7 Dev Kaynak</div>
                  <div style={{ fontSize: '0.8rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>En Büyük Veri Tabanları</div>
                </div>
              </div>
              <div className="feature-item" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(255,255,255,0.05)' }}>
                <div className="feature-icon-wrapper" style={{ background: landingTheme === 'light' ? '#eff6ff' : 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}><Cpu size={24} /></div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>AI Destekli</div>
                  <div style={{ fontSize: '0.8rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Akıllı Analiz</div>
                </div>
              </div>
              <div className="feature-item" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(255,255,255,0.05)' }}>
                <div className="feature-icon-wrapper" style={{ background: landingTheme === 'light' ? '#f0fdf4' : 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}><Trophy size={24} /></div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>AHP Sıralama</div>
                  <div style={{ fontSize: '0.8rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>En Doğru Sonuçlar</div>
                </div>
              </div>
              <div className="feature-item" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(255,255,255,0.05)' }}>
                <div className="feature-icon-wrapper" style={{ background: landingTheme === 'light' ? '#fffbeb' : 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}><Zap size={24} /></div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>Hızlı & Etkili</div>
                  <div style={{ fontSize: '0.8rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Saniyeler İçinde</div>
                </div>
              </div>
            </div>

            {/* Mock Results Preview */}
            <div className="mock-results-card" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ padding: '20px 30px', borderBottom: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ color: '#4f46e5' }}><FileSearch size={22} /></div>
                  <span style={{ fontWeight: '700', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>Arama Sonuçları</span>
                  <span style={{ padding: '4px 12px', background: landingTheme === 'light' ? '#f1f5f9' : '#334155', borderRadius: '8px', fontSize: '0.8rem', color: '#64748b' }}>transportation models in urban areas</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ padding: '8px 16px', background: landingTheme === 'light' ? '#f8fafc' : '#334155', border: landingTheme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', color: landingTheme === 'light' ? '#475569' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>Sırala: AHP Skor <ChevronDown size={14} /></div>
                  <div style={{ padding: '8px 16px', background: landingTheme === 'light' ? '#f8fafc' : '#334155', border: landingTheme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', color: landingTheme === 'light' ? '#475569' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}><Download size={14} /> Dışa Aktar</div>
                </div>
              </div>

              <div style={{ display: 'flex' }}>
                {/* Mock Filter Sidebar */}
                <div style={{ width: '220px', padding: '30px', borderRight: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: '800', marginBottom: '15px', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}><Filter size={14} /> Filtreler</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Yayın Yılı</div>
                    <div style={{ height: '4px', background: 'linear-gradient(to right, #4f46e5 80%, #e2e8f0 80%)', borderRadius: '2px', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '0', top: '-6px', width: '16px', height: '16px', background: landingTheme === 'light' ? 'white' : '#1e293b', border: '3px solid #4f46e5', borderRadius: '50%' }}></div>
                      <div style={{ position: 'absolute', right: '15%', top: '-6px', width: '16px', height: '16px', background: landingTheme === 'light' ? 'white' : '#1e293b', border: '3px solid #4f46e5', borderRadius: '50%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Kaynak</div>
                    {['OpenAlex', 'CORE', 'Crossref', 'Scopus'].map(k => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: landingTheme === 'light' ? '#475569' : '#cbd5e1' }}>
                        <div style={{ width: '16px', height: '16px', background: '#4f46e5', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="white" /></div>
                        {k}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mock List */}
                <div style={{ flex: 1, padding: '30px' }}>
                  {[
                    { title: 'A comprehensive review of urban transportation models', authors: 'Z. Liu, Y. He, X. Zhang', source: 'OpenAlex', score: 0.87, cited: 152, color: landingTheme === 'light' ? '#f5f3ff' : 'rgba(124, 58, 237, 0.1)' },
                    { title: 'Sustainable urban mobility: modeling and optimization', authors: 'M. Behrisch, L. Bieker', source: 'CORE', score: 0.79, cited: 98, color: landingTheme === 'light' ? '#fffbeb' : 'rgba(217, 119, 6, 0.1)' },
                    { title: 'Agent-based models in urban transportation planning', authors: 'J. Barceló, P. Picornell', source: 'Crossref', score: 0.71, cited: 84, color: landingTheme === 'light' ? '#f0fdf4' : 'rgba(22, 163, 74, 0.1)' }
                  ].map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: i===0 ? (landingTheme === 'light' ? 'rgba(79,70,229,0.02)' : 'rgba(79,70,229,0.05)') : 'transparent', border: i===0 ? '1px solid rgba(79,70,229,0.1)' : '1px solid transparent', borderRadius: '16px', marginBottom: '10px' }}>
                      <div style={{ width: '40px', height: '40px', background: m.color, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}><FileText size={20} /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '4px', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>{m.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{m.authors}</div>
                      </div>
                      <div style={{ width: '100px', fontSize: '0.8rem', fontWeight: '700', color: '#4f46e5' }}>{m.source}</div>
                      <div style={{ width: '150px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#4f46e5', marginBottom: '4px' }}>{m.score}</div>
                        <div style={{ height: '6px', background: landingTheme === 'light' ? '#e2e8f0' : '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${m.score*100}%`, height: '100%', background: '#4f46e5' }}></div>
                        </div>
                      </div>
                      <div style={{ width: '60px', textAlign: 'right', fontWeight: '700', fontSize: '0.9rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>{m.cited}</div>
                      <div style={{ color: '#cbd5e1' }}><Bookmark size={18} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Comparison Section - Card Grid Version */}
            <div style={{ width: '100%', maxWidth: '1100px', marginTop: '100px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '800', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc', marginBottom: '1rem' }}>
                Neden Literatur AI?
              </h2>
              <p style={{ fontSize: '1.1rem', color: '#64748b', marginBottom: '3rem' }}>
                Bilimsel bütünlük ve akademik etik çerçevesinde teknolojik farkımız.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2rem', padding: '0 1rem' }}>
                {[
                  { k: 'Referans Güvenilirliği', l: 'Doğrulanmış Bilimsel Yayınlar', s: 'Halüsinasyon (Uydurma Veri) Riski', icon: <ShieldCheck size={24} /> },
                  { k: 'Bibliyografik Hassasiyet', l: 'Akademik Format Uyumluluğu', s: 'Standart Dışı veya Hatalı Atıf', icon: <FileText size={24} /> },
                  { k: 'Kapsanan Literatür', l: 'Milyonlarca İndeksli Yayın', s: 'Genel İnternet ve Web İçeriği', icon: <Library size={24} /> },
                  { k: 'Veri Güncelliği', l: 'Gerçek Zamanlı Literatür Erişimi', s: 'Kısıtlı Eğitim Seti', icon: <Zap size={24} /> }
                ].map((row, idx) => (
                  <MotionDiv
                    key={idx}
                    whileHover={{ y: -5 }}
                    className="glass-panel"
                    style={{ 
                      padding: '2rem', 
                      textAlign: 'left', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '1.5rem',
                      background: landingTheme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid ' + (landingTheme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)')
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: '#4f46e5' }}>{row.icon}</div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>{row.k}</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ 
                        padding: '1rem 1.25rem', 
                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)', 
                        borderRadius: '12px', 
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                      }}>
                        <Check size={20} strokeWidth={3} />
                        <div style={{ fontSize: '0.95rem', fontWeight: '700' }}>{row.l}</div>
                      </div>

                      <div style={{ 
                        padding: '1rem 1.25rem', 
                        background: landingTheme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.03)', 
                        borderRadius: '12px', 
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        border: '1px dashed ' + (landingTheme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.1)')
                      }}>
                        <X size={20} color="#f43f5e" style={{ opacity: 0.6 }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: '500', fontStyle: 'italic' }}>{row.s}</div>
                      </div>
                    </div>
                  </MotionDiv>
                ))}
              </div>
            </div>

            {/* Brand logos & Social Proof */}
            <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '80px', paddingBottom: '60px' }}>
              <div style={{ display: 'flex', gap: '3rem', opacity: landingTheme === 'light' ? 0.5 : 0.8 }}>
                {['OpenAlex', 'CORE', 'Crossref', 'Scopus'].map(b => (
                  <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '1rem', color: landingTheme === 'light' ? '#1e293b' : '#cbd5e1' }}>
                    <div style={{ width: '20px', height: '20px', background: landingTheme === 'light' ? '#cbd5e1' : '#334155', borderRadius: '4px' }}></div>
                    {b}
                  </div>
                ))}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: landingTheme === 'light' ? 'white' : '#1e293b', padding: '12px 24px', borderRadius: '99px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: landingTheme === 'light' ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', marginLeft: '10px' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', background: landingTheme === 'light' ? '#e2e8f0' : '#334155', border: '2px solid ' + (landingTheme === 'light' ? 'white' : '#1e293b'), marginLeft: '-10px' }}></div>
                  ))}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>60.000+ araştırmacı</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Literatur AI kullanıyor</div>
                </div>
                <div style={{ color: '#4f46e5', marginLeft: '10px' }}><Zap size={18} /></div>
              </div>
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <InfiniteTicker />
        
        {/* --- Share Modal --- */}
        <AnimatePresence>
          {showShareModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowShareModal(false)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)' }} 
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '440px',
                  background: '#1e293b',
                  borderRadius: '24px',
                  padding: '2.5rem 1.5rem',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  textAlign: 'center',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <button 
                  onClick={() => setShowShareModal(false)}
                  style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #4f46e5, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                    <Share2 size={28} color="white" />
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>Araştırmayı Paylaş</h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    Bu çalışmayı meslektaşlarınızla paylaşarak literatür tarama sürecini hızlandırın.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '2rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <button 
                      onClick={copyToClipboard}
                      className="share-circle-btn"
                      style={{ 
                        width: '64px', height: '64px', borderRadius: '50%', background: copied ? '#10b981' : 'white', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: copied ? 'scale(1.05)' : 'scale(1)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}
                    >
                      {copied ? <CheckCircle2 size={24} color="white" strokeWidth={3} /> : <Link2 size={24} color="#1e293b" strokeWidth={2.5} />}
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: copied ? '#10b981' : 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.02em' }}>
                      {copied ? 'Kopyalandı!' : 'Bağlantı'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <a 
                      href={`https://wa.me/?text=${encodeURIComponent('Harika bir akademik araştırma buldum: \n\n' + shareUrl)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="share-circle-btn"
                      style={{ 
                        width: '64px', height: '64px', borderRadius: '50%', background: '#25D366', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                        color: 'white', transition: 'all 0.3s ease', textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </a>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.02em' }}>WhatsApp</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <a 
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="share-circle-btn"
                      style={{ 
                        width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                        color: 'white', transition: 'all 0.3s ease', textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    >
                      <Linkedin size={22} strokeWidth={2.5} fill="currentColor" />
                    </a>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.02em' }}>LinkedIn</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <a
                      href={`mailto:?subject=${encodeURIComponent('LiteratureAI Araştırma Paylaşımı')}&body=${encodeURIComponent('Merhaba,\n\nBu akademik araştırmayı seninle paylaşmak istedim:\n\n' + shareUrl)}`}
                      className="share-circle-btn"
                      style={{
                        width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                        color: 'white', transition: 'all 0.3s ease', textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    >
                      <Mail size={22} strokeWidth={2.5} />
                    </a>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.02em' }}>E-posta</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
                
                <div className="export-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: '500' }}>
                      {data.results.length} makale listeleniyor
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {!isShared && (
                      <button onClick={handleShare} disabled={shareLoading} className="btn" style={{ background: 'var(--brand-primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                        {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                        {shareLoading ? 'Link hazırlanıyor...' : 'Araştırmayı Paylaş'}
                      </button>
                    )}
                    <button onClick={exportPDF} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                      <Download size={14} /> PDF
                    </button>
                    <button onClick={exportExcel} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                      <Download size={14} /> CSV
                    </button>
                    <button onClick={exportDocx} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                      <Download size={14} /> DOCX
                    </button>
                  </div>
                </div>

                <div id="results-container" style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                  {data.results.map((item, idx) => {
                    const isFavorited = isPaperFavorited(item);
                    return (
                      <ResultCard 
                        key={item.doi || item.url || item.title || idx} 
                        item={item} 
                        rank={idx + 1} 
                        collections={collections} 
                        onSaveToCollection={handleSaveToCollection} 
                        onFavorite={handleFavorite}
                        isFavorited={isFavorited}
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
    </>
  );
}

export default App;
