import { useEffect, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
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
  Activity,
  Star,
  Layers,
  CheckCircle2
} from 'lucide-react';

const MotionDiv = motion.div;
const MotionH1 = motion.h1;
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
import { v4 as uuidv4 } from 'uuid';
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
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const mobile = w < 768;
      setIsMobile(mobile);
      setIsTablet(w >= 768 && w < 1024);
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCompact = isMobile || isTablet;

  const fetchCollections = async (id) => {
    try {
      const response = await axios.get(`${defaultApiUrl}/api/collections?userId=${id}`);
      setCollections(response.data);
    } catch (err) {
      console.error('Failed to fetch collections', err);
    }
  };

  useEffect(() => {
    let id = localStorage.getItem('literature_ai_device_id');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('literature_ai_device_id', id);
    }
    setDeviceId(id);
    fetchCollections(id);
    
    const refreshCollections = () => fetchCollections(id);
    window.addEventListener('refreshCollections', refreshCollections);
    return () => window.removeEventListener('refreshCollections', refreshCollections);
  }, []);

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
      await axios.post(`${defaultApiUrl}/api/collections/${collectionId}/add`, {
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
      });
      window.dispatchEvent(new CustomEvent('refreshCollections'));
    } catch (err) {
      console.error('Kaydetme hatası:', err);
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
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: "LiteratureAI Akademik Raporu", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: `Konu: ${mainTopic}`, spacing: { before: 200, after: 200 } }),
          ...data.results.map(item => new Paragraph({
            children: [
              new Paragraph({ text: `${item.title} (${item.year})`, heading: HeadingLevel.HEADING_2 }),
              new Paragraph({ text: `Yazarlar: ${item.creator}` }),
              new Paragraph({ text: `Yayın: ${item.publicationName}` }),
              new Paragraph({ text: `DOI: ${item.doi}`, spacing: { after: 200 } }),
            ]
          }).children).flat()
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `LiteratureAI_Belge_${mainTopic || 'Arastirma'}.docx`);
  };

  const handleFavorite = async (paper) => {
    let favColl = collections.find(c => c.name === 'Favoriler');
    
    if (!favColl) {
      try {
        const res = await axios.post(`${defaultApiUrl}/api/collections`, {
          userId: deviceId,
          name: 'Favoriler'
        });
        favColl = res.data;
        setCollections(prev => [...prev, favColl]);
      } catch (err) {
        console.error('Failed to create Favoriler collection', err);
        return;
      }
    }

    try {
      await handleSaveToCollection(favColl._id, paper);
    } catch (err) {
      console.error('Failed to add to favorites', err);
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
      const response = await axios.post(`${defaultApiUrl}/api/analyze-query`, { topic: mainTopic.trim() });
      if (response.data?.intent) {
        setAiAnalysis(response.data);
        try {
          await axios.post(`${defaultApiUrl}/api/analyses`, {
            userId: deviceId,
            topic: mainTopic.trim(),
            explanation: response.data.explanation,
            queries: response.data.queries
          });
          window.dispatchEvent(new CustomEvent('refreshAnalyses'));
        } catch (analErr) {
          console.warn('Analysis save failed', analErr);
        }
      }
    } catch {
      setAiError('AI analizi başarısız oldu.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearch = async (e, directQuery = null) => {
    if (e) e.preventDefault();
    const query = directQuery || selectedAiQuery;
    if (!mainTopic.trim() && !query) return;

    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      const response = await axios.get(`${defaultApiUrl}/api/search`, {
        params: {
          mainTopic: mainTopic.trim(),
          count: count,
          aiQuery: query,
          keywords: JSON.stringify(keywords)
        }
      });
      setData(response.data);
      if (response.data.quota) setQuota(response.data.quota);
      
      await axios.post(`${defaultApiUrl}/api/history`, {
        userId: deviceId,
        mainTopic: mainTopic.trim(),
        authorName,
        keywords,
        aiQuery: query
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
      <InfiniteTicker />
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
          await axios.delete(`${defaultApiUrl}/api/history/entry/${id}`);
          window.dispatchEvent(new CustomEvent('refreshHistory'));
        }}
        onNewSearch={() => {
          setData(null);
          setMainTopic('');
          setAuthorName('');
          setKeywords([]);
          setAiAnalysis(null);
        }}
      />

      <main style={{
        marginLeft: isMobile ? '0px' : (sidebarOpen ? '280px' : '72px'),
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: isMobile ? '3.5rem 1rem 2rem' : (isTablet ? '3.5rem 1.5rem' : '4rem 2rem')
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          <header style={{ textAlign: 'center', marginBottom: isMobile ? '2rem' : '3rem' }}>
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

          <section className="glass-panel" style={{ padding: isMobile ? '1.25rem' : (isTablet ? '1.75rem' : '2rem'), marginBottom: isMobile ? '2rem' : '3rem' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)', fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>
                  Araştırma Konusu
                </label>
                <div className="input-wrapper" style={{ position: 'relative' }}>
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
                    placeholder="Örn: Yapay zeka destekli tıbbi görüntü analizi"
                    value={mainTopic}
                    onChange={(e) => setMainTopic(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={aiLoading}
                    className={isCompact ? '' : 'btn-secondary'}
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
                className="btn-ghost"
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 0',
                  margin: '-0.5rem 0 -0.25rem'
                }}
              >
                <Settings size={14} />
                {showAdvanced ? 'Gelişmiş seçenekleri gizle' : 'Gelişmiş seçenekler'}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', padding: '1.25rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)', fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>Yazar (opsiyonel)</label>
                        <div style={{ position: 'relative' }}>
                          <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} size={16} />
                          <input type="text" className="input" placeholder="Örn: John Doe" value={authorName} onChange={e => setAuthorName(e.target.value)} style={{ height: '44px', paddingLeft: '40px' }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)', fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>Anahtar Kelimeler</label>
                        <div style={{ position: 'relative' }}>
                          <Tag style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} size={16} />
                          <input 
                            type="text" 
                            className="input" 
                            placeholder="Virgülle ayırın..." 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                const val = e.target.value.trim().replace(',', '');
                                if (val && !keywords.includes(val)) {
                                  setKeywords([...keywords, val]);
                                  e.target.value = '';
                                }
                              }
                            }}
                            style={{ height: '44px', paddingLeft: '40px' }} 
                          />
                        </div>
                        {keywords.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                            {keywords.map((kw, idx) => (
                              <span key={idx} style={{ background: 'white', border: '1px solid var(--border-light)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-main)' }}>
                                {kw}
                                <X size={10} style={{ cursor: 'pointer' }} onClick={() => setKeywords(keywords.filter((_, i) => i !== idx))} />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)', fontSize: 'var(--fs-sm)', marginBottom: '0.5rem' }}>Makale sayısı</label>
                        <input type="number" className="input" value={count} onChange={e => setCount(e.target.value)} style={{ height: '44px', paddingLeft: '14px' }} min="10" max="100" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="btn"
                style={{
                  height: '52px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--fs-md)',
                  fontWeight: '600',
                  marginTop: '0.25rem',
                  width: '100%'
                }}
              >
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <Loader2 className="animate-spin" size={18} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: isMobile ? 'var(--fs-sm)' : 'var(--fs-md)' }}>{LOADING_MESSAGES[loadingStep]}</span>
                  </div>
                ) : (
                  <>
                    <Zap size={18} />
                    <span>Literatürü analiz et</span>
                  </>
                )}
              </button>



            </form>
          </section>

          {!loading && !data && !aiAnalysis && (
            <MotionDiv
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', marginBottom: isMobile ? '2rem' : '3rem' }}
            >
              {[
                { icon: <Sparkles size={18} />, title: 'AI sorgu genişletme', body: 'Türkçe konunuz İngilizce Boolean sorguya çevrilir; 5 alternatif öneri sunulur.' },
                { icon: <Activity size={18} />, title: 'AHP skorlama', body: 'Alaka, atıf ve güncellik ağırlıklarıyla her makale 0–100 arası puanlanır.' },
                { icon: <Download size={18} />, title: 'Tek tık dışa aktarım', body: 'Sonuçları PDF, Word veya Excel olarak hazır rapor halinde indirin.' }
              ].map((f, i) => (
                <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                    {f.icon}
                  </div>
                  <h3 style={{ margin: '0 0 0.375rem 0', fontSize: 'var(--fs-md)', fontWeight: '600', color: 'var(--text-main)' }}>{f.title}</h3>
                  <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.body}</p>
                </div>
              ))}
            </MotionDiv>
          )}

          <AnimatePresence>
            {aiAnalysis && (
              <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: isMobile ? '1.25rem' : '1.75rem', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
                    <span className="badge" style={{ background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', borderColor: '#dbe1ff' }}>
                      <Sparkles size={11} /> AI önerisi
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--fs-xl)', fontWeight: '600', color: 'var(--text-main)' }}>Sorgu önerileri</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: 'var(--fs-sm)', marginTop: 0, marginBottom: '1.25rem' }}>{aiAnalysis.explanation}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {aiAnalysis.queries?.map((q, i) => (
                      <button key={i} className="ai-query-btn" onClick={() => { setMainTopic(q.text); setSelectedAiQuery(q.text); handleSearch(null, q.text); setAiAnalysis(null); }}>
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
                  const isFavorited = collections.find(c => c.name === 'Favoriler')?.papers.some(p => p.title === item.title);
                  return (
                    <ResultCard 
                      key={idx} 
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
    </>
  );
}

export default App;
