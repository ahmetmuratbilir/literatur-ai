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
  'Dünyanın en büyük 8 akademik kaynağına güvenli bağlantı kuruluyor...',
  'Scopus, OpenAlex, CORE ve Crossref veri havuzları taranıyor...',
  'OpenCitations ile atıf verileri çapraz kontrolden geçiriliyor...',
  '800 Milyondan fazla kayıt arasında konu eşleşmesi yapılıyor...',
  'AHP algoritması ile en yüksek kaliteli yayınlar önceliklendiriliyor...',
  'Sizin için en güncel ve alakalı literatür listesi hazırlanıyor...',
];

const COPYRIGHT_NOTICE = '© LiteratureAI. Akademik Literatür Analiz ve AHP Skorlama Sistemi.';

function App() {
  const [mainTopic, setMainTopic] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [count, setCount] = useState(50);
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
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        marginLeft: (isMobile || !sidebarOpen) ? '0px' : '280px', 
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', 
        padding: isMobile ? '4rem 1rem' : '4rem 2rem' 
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          <header style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <MotionH1 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ fontSize: isMobile ? '2.5rem' : '4.5rem', fontWeight: '900', letterSpacing: '-0.05em', background: 'linear-gradient(135deg, #4f46e5, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem' }}
            >
              LiteratureAI
            </MotionH1>
            <p style={{ fontSize: isMobile ? '1rem' : '1.25rem', color: '#64748b', fontWeight: '600' }}>Profesyonel Akademik Literatür Analiz Merkezi</p>
          </header>

          <section className="glass-panel" style={{ padding: isMobile ? '1.5rem' : '3.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', borderRadius: '32px', marginBottom: '4rem' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontWeight: '800', color: '#1e293b', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>
                  Araştırma Konusu
                </label>
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={24} />
                  <input
                    type="text"
                    className="input"
                    style={{ 
                      height: '72px', 
                      paddingLeft: '64px', 
                      paddingRight: isMobile ? '64px' : '260px', 
                      fontSize: isMobile ? '1rem' : '1.2rem', 
                      borderRadius: '20px', 
                      border: '2px solid #e2e8f0', 
                      width: '100%', 
                      fontWeight: '500',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                    }}
                    placeholder="Konunuzu buraya yazın..."
                    value={mainTopic}
                    onChange={(e) => setMainTopic(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={aiLoading}
                    style={{
                      position: isMobile ? 'static' : 'absolute',
                      marginTop: isMobile ? '1rem' : '0',
                      right: '12px',
                      top: '50%',
                      transform: isMobile ? 'none' : 'translateY(-50%)',
                      background: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      borderRadius: '14px',
                      padding: '10px 20px',
                      color: '#6366f1',
                      fontSize: '0.9rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      width: isMobile ? '100%' : 'auto'
                    }}
                  >
                    {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {aiLoading ? 'Analiz Ediliyor...' : 'Konuyu Geliştir ✨'}
                  </button>
                </div>
                {aiError && (
                  <div style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} /> {aiError}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#6366f1', 
                    fontSize: '0.85rem', 
                    fontWeight: '800', 
                    cursor: 'pointer', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  <Settings size={14} />
                  {showAdvanced ? 'Gelişmiş Seçenekleri Gizle' : 'Gelişmiş Seçenekleri Göster'}
                </button>
              </div>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', marginBottom: '1.5rem' }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: '800', color: '#1e293b', fontSize: '0.8rem', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Yazar Adı (Opsiyonel)</label>
                        <div style={{ position: 'relative' }}>
                          <User style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                          <input type="text" className="input" placeholder="Örn: John Doe..." value={authorName} onChange={e => setAuthorName(e.target.value)} style={{ height: '52px', borderRadius: '12px', paddingLeft: '48px', width: '100%', fontSize: '0.9rem' }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: '800', color: '#1e293b', fontSize: '0.8rem', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Makale Sayısı</label>
                        <input type="number" className="input" value={count} onChange={e => setCount(e.target.value)} style={{ height: '52px', borderRadius: '12px', paddingLeft: '20px', width: '100%', fontSize: '0.9rem' }} min="10" max="100" />
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
                  height: '72px',
                  borderRadius: '24px',
                  fontSize: '1.25rem',
                  fontWeight: '900',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  boxShadow: '0 15px 35px -10px rgba(79, 70, 229, 0.6)',
                  marginTop: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <Loader2 className="animate-spin" size={isMobile ? 24 : 32} />
                    <span style={{ fontSize: isMobile ? '0.9rem' : '1.25rem' }}>{LOADING_MESSAGES[loadingStep]}</span>
                  </div>
                ) : (
                  <>
                    <Zap size={28} fill="white" />
                    <span>LİTERATÜRÜ ANALİZ ET</span>
                  </>
                )}
              </button>



              {!loading && !data && (
                <MotionDiv 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  style={{ marginTop: '3rem', textAlign: 'center' }}
                >
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Yapay Zeka Destekli Literatür Analiz Laboratuvarı
                  </p>
                </MotionDiv>
              )}
            </form>
          </section>

          <AnimatePresence>
            {aiAnalysis && (
              <MotionDiv initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ marginBottom: '4rem' }}>
                <div style={{ background: 'white', borderRadius: '32px', padding: '3rem', border: '1px solid #e2e8f0', boxShadow: '0 25px 40px -10px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '2rem' }}>
                    <Sparkles color="#a855f7" size={32} />
                    <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '900' }}>AI Analiz Raporu</h3>
                  </div>
                  <p style={{ color: '#475569', lineHeight: '1.7', fontSize: '1.1rem', marginBottom: '2.5rem' }}>{aiAnalysis.explanation}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <p style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.9rem', textTransform: 'uppercase' }}>Önerilen Gelişmiş Sorgular:</p>
                    {aiAnalysis.queries?.map((q, i) => (
                      <button key={i} onClick={() => { setMainTopic(q.text); setSelectedAiQuery(q.text); handleSearch(null, q.text); setAiAnalysis(null); }} style={{ textAlign: 'left', padding: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden' }} onMouseOver={e => e.currentTarget.style.borderColor = '#6366f1'}>
                        <div style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.5rem', color: '#1e293b' }}>{q.text}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={12} /> Alaka Skoru: %{q.relevanceScore}</div>
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
                failedSources={data.failedSources}
              />
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1.5rem' }}>
                <button onClick={exportPDF} style={{ padding: '10px 18px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={16} /> PDF İndir
                </button>
                <button onClick={exportExcel} style={{ padding: '10px 18px', background: '#f0fdf4', color: '#10b981', border: '1px solid #dcfce7', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={16} /> Excel (CSV)
                </button>
                <button onClick={exportDocx} style={{ padding: '10px 18px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #dbeafe', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={16} /> Word (DOCX)
                </button>
              </div>

              <div id="results-container" style={{ marginTop: '2rem', display: 'grid', gap: '1.5rem' }}>
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
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '20px', textAlign: 'center', marginTop: '2rem' }}>
              <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
              <p style={{ color: '#b91c1c', fontWeight: '700' }}>{error}</p>
            </MotionDiv>
          )}

        </div>
      </main>
    </>
  );
}

export default App;
