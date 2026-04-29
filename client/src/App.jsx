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
  AlertCircle,
  X,
  Zap,
  WifiOff,
  Sparkles,
  Activity,
} from 'lucide-react';

const renderBooleanChips = (queryText) => {
  // Simple parser to turn AND/OR and quotes into chips
  const parts = queryText.split(/(AND|OR|\(|\))/).filter(Boolean);
  return parts.map((part, idx) => {
    const trimmed = part.trim();
    if (!trimmed) return <span key={idx}> </span>;
    if (trimmed === 'AND') return <span key={idx} style={{ color: '#4f46e5', fontWeight: '800', margin: '0 4px', fontSize: '0.8rem' }}>AND</span>;
    if (trimmed === 'OR') return <span key={idx} style={{ color: '#0ea5e9', fontWeight: '800', margin: '0 4px', fontSize: '0.8rem' }}>OR</span>;
    if (trimmed === '(' || trimmed === ')') return <span key={idx} style={{ color: '#94a3b8', fontWeight: '700', fontSize: '1.1rem' }}>{trimmed}</span>;
    
    // It's a term
    return (
      <span key={idx} style={{
        background: '#f1f5f9',
        color: '#334155',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.85rem',
        fontWeight: '500',
        display: 'inline-block',
        margin: '2px 0'
      }}>
        {trimmed}
      </span>
    );
  });
};
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';
import ResultCard from './components/ResultCard';
import GlobalStats from './components/GlobalStats';
import InfiniteTicker from './components/InfiniteTicker';

const MotionDiv = motion.div;

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const LOADING_MESSAGES = [
  'Scopus, OpenAlex ve CORE veritabanlarına bağlanılıyor...',
  'Akademik veriler paralel olarak çekiliyor...',
  'Kaynaklar birleştiriliyor, tekrarlar temizleniyor...',
  'AHP skorlaması hesaplanıyor...',
  'Literatür haritası çıkarılıyor...',
  'Sonuçlar hazırlanıyor...',
];

const COPYRIGHT_NOTICE =
  '© LiteratureAI. Bu rapor akademik araştırma amacıyla oluşturulmuştur. Kaynak belirtilerek kullanılabilir.';

const formatScore = (value) => {
  const numeric = Number(value) || 0;
  return Math.round(numeric * 100);
};

/** PDF şablonu için metin içeriğini güvenli biçimde kaçırır (innerHTML enjeksiyonunu önler). */
const escapeHtml = (unsafe) => {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

function App() {
  const [mainTopic, setMainTopic] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [count, setCount] = useState(25);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  /** 'offline' = ağ/sunucu yok; 'api' = HTTP hata cevabı; null = doğrulama vb. */
  const [errorType, setErrorType] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [quota, setQuota] = useState(null);
  const [sourceBreakdown, setSourceBreakdown] = useState(null);
  const [totalFromAPIs, setTotalFromAPIs] = useState(null);
  const [failedSources, setFailedSources] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [selectedAiQuery, setSelectedAiQuery] = useState('');

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

  useEffect(() => {
    if (data?.demoMode) {
      setShowBanner(true);
      const timer = setTimeout(() => setShowBanner(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const exportToCSV = () => {
    if (!data?.results?.length) return;

    const headers = ['Sıra', 'Başlık', 'Yıl', 'Atıf Sayısı', 'URL', 'AHP Skoru (%)'];
    const csvRows = [
      headers.join(';'),
      ...data.results.map((item, index) => {
        const title = (item.title || '').replace(/;/g, ',');
        return `${index + 1};"${title}";${item.year || ''};${item.citedBy || 0};"${item.url || ''}";${formatScore(item.scores?.total)}`;
      }),
      '',
      `"${COPYRIGHT_NOTICE}"`,
    ];

    const blob = new Blob([`\ufeff${csvRows.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    saveAs(blob, `literature_results_${new Date().getTime()}.csv`);
  };

  const exportToPDF = () => {
    if (!data?.results?.length) return;

    const element = document.createElement('div');
    element.style.background = 'white';
    element.style.color = '#0f172a';
    element.style.fontFamily = "'Outfit', 'Inter', sans-serif";

    element.innerHTML = `
      <div style="padding: 5px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #4f46e5; padding-bottom: 8px;">
          <div>
            <h1 style="color: #4f46e5; font-size: 20px; margin: 0;">LiteratureAI Araştırma Raporu</h1>
            <p style="color: #64748b; font-size: 10px; margin: 3px 0 0 0;">Konu: ${escapeHtml(mainTopic.trim() || 'Genel Arama')} | Tarih: ${new Date().toLocaleDateString('tr-TR')}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 9px; color: #94a3b8;">${new Date().toLocaleTimeString('tr-TR')}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
              <th style="padding: 6px 8px; text-align: left; width: 25px; color: #475569;">#</th>
              <th style="padding: 6px 8px; text-align: left; color: #475569;">Makale Başlığı ve Özet</th>
              <th style="padding: 6px 8px; text-align: left; width: 120px; color: #475569;">Yazar / Yıl</th>
              <th style="padding: 6px 8px; text-align: center; width: 50px; color: #475569;">Atıf</th>
              <th style="padding: 6px 8px; text-align: right; width: 70px; color: #475569;">AHP Skoru</th>
            </tr>
          </thead>
          <tbody>
            ${data.results
              .map(
                (item, index) => {
                  const descRaw = item.description ? String(item.description).slice(0, 160) : '';
                  const pubName = item.publicationName ? String(item.publicationName).slice(0, 30) : '';
                  return `
              <tr style="border-bottom: 1px solid #f1f5f9; page-break-inside: avoid;">
                <td style="padding: 6px 8px; font-weight: 800; color: #6366f1;">${index + 1}</td>
                <td style="padding: 6px 8px;">
                  <div style="font-weight: 700; color: #1e293b; margin-bottom: 2px; font-size: 9.5px;">${escapeHtml(item.title)}</div>
                  ${item.description ? `<div style="font-size: 8.5px; color: #64748b; line-height: 1.25;">${escapeHtml(descRaw)}...</div>` : ''}
                </td>
                <td style="padding: 6px 8px; color: #475569;">
                  <div style="font-weight: 600;">${escapeHtml(item.creator || 'Bilinmeyen')}</div>
                  <div style="font-size: 8.5px;">${item.year} | ${escapeHtml(pubName)}</div>
                </td>
                <td style="padding: 6px 8px; text-align: center; font-weight: 600; color: #475569;">${item.citedBy || 0}</td>
                <td style="padding: 6px 8px; text-align: right;">
                  <span style="background: #ecfdf5; color: #059669; padding: 2px 5px; border-radius: 4px; font-weight: 800; font-size: 8.5px;">
                    %${formatScore(item.scores?.total)}
                  </span>
                </td>
              </tr>
            `;
                },
              )
              .join('')}
          </tbody>
        </table>

        <div style="margin-top: 20px; text-align: center; font-size: 8.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
          ${COPYRIGHT_NOTICE}
        </div>
      </div>
    `;

    const opt = {
      margin: 8,
      filename: `literature_results_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    html2pdf().set(opt).from(element).save();
  };

  const exportToWord = async () => {
    if (!data?.results?.length) return;

    const tableRows = [
      new TableRow({
        children: ['Sıra', 'Başlık', 'Yıl', 'Atıf', 'AHP Skoru'].map((text) =>
          new TableCell({
            children: [new Paragraph({ text, bold: true })],
            shading: { fill: '4F46E5' },
          }),
        ),
      }),
    ];

    data.results.forEach((item, index) => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(index + 1))] }),
            new TableCell({ children: [new Paragraph(item.title || 'Başlıksız')] }),
            new TableCell({ children: [new Paragraph(String(item.year || '-'))] }),
            new TableCell({ children: [new Paragraph(String(item.citedBy || 0))] }),
            new TableCell({
              children: [new Paragraph(`%${formatScore(item.scores?.total)}`)],
            }),
          ],
        }),
      );
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'LiteratureAI Akademik Tarama Raporu',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: '' }),
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: COPYRIGHT_NOTICE,
              italics: true,
              alignment: AlignmentType.CENTER,
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `literature_results_${new Date().getTime()}.docx`);
  };

  const handleAiSuggest = async () => {
    if (!mainTopic.trim()) {
      setAiError('AI Analizi için lütfen önce "Ana Araştırma Konusu" giriniz.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    setSelectedAiQuery('');
    try {
      const validKeywords = keywords.filter((keyword) => keyword.trim() !== '');
      let fullContext = mainTopic.trim();
      if (validKeywords.length > 0) {
        fullContext += ` (Ek Anahtar Kelimeler: ${validKeywords.join(', ')})`;
      }
      const response = await axios.post(`${defaultApiUrl}/api/analyze-query`, { topic: fullContext });
      if (response.data?.intent) {
        setAiAnalysis(response.data);
      } else {
        setAiError('AI analiz sonucu alınamadı.');
      }
    } catch (err) {
      console.error('AI Suggestion Error:', err);
      setAiError(err.response?.data?.error || 'Yapay zeka analiz yaparken bir hata ile karşılaştı.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !keywords.includes(val)) {
        setKeywords([...keywords, val]);
        setTagInput('');
      }
    }
  };

  const removeKeyword = (kw) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleSearch = async (event, directAiQuery = null) => {
    if (event) event.preventDefault();
    
    const queryToUse = directAiQuery !== null ? directAiQuery : selectedAiQuery;

    if (!mainTopic.trim() && !authorName.trim() && !queryToUse) {
      setErrorType(null);
      setError('Lütfen en az bir ana konu veya yazar ismi giriniz.');
      return;
    }

    const validKeywords = keywords.filter((keyword) => keyword.trim() !== '');
    const normalizedCount = Math.min(500, Math.max(10, Number(count) || 25));

    setLoading(true);
    setError(null);
    setErrorType(null);
    setData(null);
    setSourceBreakdown(null);
    setTotalFromAPIs(null);
    setFailedSources([]);
    setAiError(null);

    try {
      const response = await axios.get(`${defaultApiUrl}/api/search`, {
        params: {
          mainTopic: mainTopic.trim(),
          authorName: authorName.trim(),
          keywords: JSON.stringify(validKeywords),
          count: normalizedCount,
          aiQuery: queryToUse,
        },
      });

      setData(response.data);
      if (response.data.quota) setQuota(response.data.quota);
      if (response.data.sourceBreakdown) setSourceBreakdown(response.data.sourceBreakdown);
      if (response.data.totalFromAPIs) setTotalFromAPIs(response.data.totalFromAPIs);
      setFailedSources(response.data.failedSources || []);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.demoMode) {
        setData(errorData);
        if (errorData.quota) setQuota(errorData.quota);
        return;
      }
      const noResponse = axios.isAxiosError(err) && !err.response;
      if (noResponse) {
        setErrorType('offline');
        setError(
          'Tarayıcı API adresine ulaşamadı. Sunucu çalışmıyor olabilir veya güvenlik duvarı isteği engelliyor.',
        );
      } else {
        setErrorType('api');
        setError(
          errorData?.error ||
            err.message ||
            'Sunucu bir hata döndürdü. Bir süre sonra tekrar deneyin.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <MotionDiv
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="glass-panel"
            style={{
              position: 'fixed',
              top: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              width: 'min(90%, 600px)',
              padding: '1.25rem',
              borderLeft: '6px solid var(--score-med)',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                background: 'var(--score-med-bg)',
                padding: '0.75rem',
                borderRadius: '12px',
              }}
            >
              <Zap size={24} color="var(--score-med)" />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, color: 'var(--score-med)', fontWeight: '800' }}>
                Demo Modu Aktif
              </h4>
              <p
                style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  fontWeight: '500',
                }}
              >
                API kotası dolduğu için sistem örnek veritabanı üzerinden sonuç üretiyor.
              </p>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="pill-btn"
              style={{ border: 'none', background: 'none' }}
            >
              <X size={20} />
            </button>
          </MotionDiv>
        )}
      </AnimatePresence>

      <InfiniteTicker />

      <main className="container">
        <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
          <MotionDiv initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <h1
            style={{
              fontSize: '3.5rem',
              marginBottom: '0.5rem',
              letterSpacing: '-0.04em',
              background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            LiteratureAI
          </h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '1.1rem' }}>
            Akademik Literatür Analiz ve AHP Skorlama Sistemi
          </p>
        </MotionDiv>
      </header>

      <section className="glass-panel" style={{ marginBottom: '4rem', position: 'relative', zIndex: (aiAnalysis || aiLoading) ? 50 : 1 }}>
        <AnimatePresence>
          {(aiLoading || aiAnalysis) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(4px)',
                zIndex: -1
              }}
              onClick={() => setAiAnalysis(null)}
            />
          )}
        </AnimatePresence>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', zIndex: 10 }}>
          <div className="hero-input-wrapper">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label
                style={{
                  display: 'block',
                  fontWeight: '800',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                }}
              >
                Ana Araştırma Konusu
              </label>
              <button
                type="button"
                onClick={handleAiSuggest}
                disabled={aiLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                  color: 'white',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: aiLoading ? 'not-allowed' : 'pointer',
                  opacity: aiLoading ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
                }}
              >
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiLoading ? 'AI Düşünüyor...' : 'AI ile Geliştir'}
              </button>
            </div>
            <div className="input-wrapper">
              <Search className="input-icon" size={24} />
              <input
                type="text"
                className="hero-input"
                placeholder="Örn: Yapay Zeka ve Etik Sorunları"
                value={mainTopic}
                onChange={(e) => setMainTopic(e.target.value)}
              />
            </div>
            
            <AnimatePresence>
              {aiError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: '0.75rem' }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#fffbeb',
                    borderLeft: '4px solid #f59e0b',
                    borderRadius: '0 8px 8px 0',
                    fontSize: '0.85rem',
                    color: '#92400e',
                    fontWeight: '500'
                  }}
                >
                  <AlertCircle size={18} color="#f59e0b" />
                  <span>{aiError}</span>
                </motion.div>
              )}
              {aiLoading && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: '1.5rem' }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '2rem',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div className="animate-spin" style={{ width: '24px', height: '24px', border: '3px solid #e2e8f0', borderTopColor: '#a855f7', borderRadius: '50%' }}></div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', animation: 'pulse 1.5s infinite' }}>Yapay Zeka Analiz Ediyor...</h3>
                  </div>
                  
                  {/* Skeleton bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ height: '20px', width: '80%', background: '#f1f5f9', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div>
                    <div style={{ height: '60px', width: '100%', background: '#f1f5f9', borderRadius: '8px', animation: 'pulse 1.5s infinite 0.2s' }}></div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                       <div style={{ height: '24px', width: '100px', background: '#f1f5f9', borderRadius: '12px', animation: 'pulse 1.5s infinite 0.4s' }}></div>
                       <div style={{ height: '24px', width: '120px', background: '#f1f5f9', borderRadius: '12px', animation: 'pulse 1.5s infinite 0.5s' }}></div>
                       <div style={{ height: '24px', width: '90px', background: '#f1f5f9', borderRadius: '12px', animation: 'pulse 1.5s infinite 0.6s' }}></div>
                    </div>
                  </div>
                </motion.div>
              )}
              {aiAnalysis && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: '1.5rem' }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '2rem',
                    overflow: 'hidden',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                    <div style={{ background: '#faf5ff', padding: '0.5rem', borderRadius: '8px' }}>
                      <Sparkles color="#a855f7" size={24} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '800' }}>AI Araştırma Analizi</h3>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>Araştırma Niyeti: <span style={{ fontWeight: '400' }}>{aiAnalysis.intent}</span></p>
                  </div>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>Açıklama: <span style={{ fontWeight: '400' }}>{aiAnalysis.explanation}</span></p>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>İlgili Konular:</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {aiAnalysis.relatedTopics?.map((topic, i) => (
                        <span key={i} style={{ backgroundColor: '#e0e7ff', color: '#4338ca', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>{topic}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: '2rem' }}>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={18} color="#4f46e5" /> Önerilen Gelişmiş Sorgular <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>(Aramayı başlatmak için tıklayın)</span>
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {aiAnalysis.queries?.map((queryObj, i) => {
                        const queryText = typeof queryObj === 'string' ? queryObj : queryObj.text;
                        const score = queryObj.relevanceScore || (90 - i * 2);
                        const isHigh = score >= 90;
                        
                        return (
                          <button
                            key={i}
                            type="button"
                            className={`ai-query-btn ${queryText === selectedAiQuery ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedAiQuery(queryText);
                              setMainTopic(queryText);
                              setKeywords([]);
                              setAiAnalysis(null);
                              handleSearch(null, queryText);
                            }}
                          >
                            <div style={{ flex: 1, paddingRight: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ lineHeight: '1.6' }}>
                                {renderBooleanChips(queryText)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isHigh ? '#ecfdf5' : '#f0fdfa', border: `1px solid ${isHigh ? '#10b981' : '#14b8a6'}`, borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: isHigh ? '#059669' : '#0d9488', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alaka</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: isHigh ? '#047857' : '#0f766e' }}>%{score}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem' }}
              >
                Yazar Adı (Opsiyonel)
              </label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  type="text"
                  className="input"
                  placeholder="Yazar ismi..."
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem' }}
              >
                Makale Sayısı
              </label>
              <input
                type="number"
                className="input"
                style={{ paddingLeft: '1.25rem' }}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                min="10"
                max="500"
              />
            </div>
          </div>

          <div>
            <label
              style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '700', fontSize: '0.85rem' }}
            >
              Filtreleme Etiketleri (Enter ile ekleyin)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <AnimatePresence>
                {keywords.map((kw) => (
                  <motion.span
                    key={kw}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: '#f1f5f9',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: '#4f46e5',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: '#94a3b8' }}
                    >
                      <X size={14} style={{ transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'} />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <div className="input-wrapper">
              <Tag className="input-icon" size={18} />
              <input
                type="text"
                className="input"
                placeholder="Örn: machine learning, ethics (Enter'a basın)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn">
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Loader2 className="animate-spin" size={24} />
                <span style={{ fontWeight: '800' }}>{LOADING_MESSAGES[loadingStep]}</span>
              </div>
            ) : (
              <>
                <Zap size={22} />
                <span style={{ fontWeight: '800' }}>ANALİZİ BAŞLAT</span>
              </>
            )}
          </button>
        </form>

        {error && (
          <MotionDiv
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`state-panel ${errorType === 'offline' ? 'state-panel--offline' : 'state-panel--error'}`}
          >
            <div className="state-panel__visual">
              {errorType === 'offline' ? <WifiOff size={28} strokeWidth={2.25} /> : <AlertCircle size={28} />}
            </div>
            <div>
              <h3 className="state-panel__title">
                {errorType === 'offline' ? 'Sunucuya ulaşılamıyor' : 'İstek başarısız'}
              </h3>
              <p className="state-panel__message">{error}</p>
              {errorType === 'offline' && (
                <>
                  <ul className="state-panel__steps">
                    <li>
                      Proje kökünde sunucuyu başlatın:{' '}
                      <code className="code-chip">cd server</code> ardından{' '}
                      <code className="code-chip">npm run dev</code>
                    </li>
                    <li>
                      Üretim veya farklı makinede adresi{' '}
                      <code className="code-chip">.env</code> içinde{' '}
                      <code className="code-chip">VITE_API_URL</code> ile ayarlayın.
                    </li>
                  </ul>
                </>
              )}
            </div>
          </MotionDiv>
        )}
      </section>

      {(data || quota) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
          <GlobalStats
            totalFound={data?.totalFound || 0}
            analyzed={data?.analyzedCount || 0}
            quota={quota}
            totalFromAPIs={totalFromAPIs}
            sourceBreakdown={sourceBreakdown}
            failedSources={failedSources}
          />

          {data && (
            <section>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  marginBottom: '2rem',
                  flexWrap: 'wrap',
                  gap: '1.5rem',
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '1.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <BarChart2 size={32} color="var(--brand-primary)" />
                    Sıralanmış Literatür Listesi
                  </h2>
                  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontWeight: '600' }}>
                    AHP algoritması ile en yüksek verimliliğe sahip makaleler sıralanmıştır.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }} className="export-actions">
                  <button
                    type="button"
                    onClick={exportToPDF}
                    className="pill-btn"
                    disabled={!data.results?.length}
                  >
                    <Download size={16} /> PDF İndir
                  </button>
                  <button
                    type="button"
                    onClick={exportToCSV}
                    className="pill-btn"
                    disabled={!data.results?.length}
                  >
                    <Download size={16} /> CSV Dışa Aktar
                  </button>
                  <button
                    type="button"
                    onClick={exportToWord}
                    className="pill-btn"
                    disabled={!data.results?.length}
                  >
                    <Download size={16} /> Word Kaydet
                  </button>
                </div>
              </div>

              {!data.results?.length ? (
                <MotionDiv
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="empty-results"
                >
                  <div className="empty-results__icon">
                    <SearchX size={28} strokeWidth={2} />
                  </div>
                  <h3>Sonuç listesi boş</h3>
                  <p>
                    Sunucu yanıt verdi ancak bu sorgu için sıralanacak kayıt bulunamadı. Anahtar kelimeleri
                    genişletmeyi veya sadece yazar adı ile denemeyi deneyin; API anahtarlarınızın tanımlı
                    olduğundan emin olun.
                  </p>
                </MotionDiv>
              ) : (
                <div className="grid">
                  <AnimatePresence>
                    {data.results.map((item, index) => (
                      <ResultCard key={item.id || index} item={item} rank={index + 1} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <footer
        style={{
          marginTop: '6rem',
          paddingBottom: '3rem',
          textAlign: 'center',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '2rem',
        }}
      >
        <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '600' }}>
          {COPYRIGHT_NOTICE}
        </p>
      </footer>
      </main>
    </>
  );
}

export default App;
