import { useEffect, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Activity,
  BarChart2,
  BookOpen,
  FileText,
  Loader2,
  Search,
  Tag,
  User,
  Download,
  AlertCircle,
  X,
  Zap,
} from 'lucide-react';
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
import html2canvas from 'html2canvas';
import ResultCard from './components/ResultCard';
import GlobalStats from './components/GlobalStats';

const MotionDiv = motion.div;

const LOADING_MESSAGES = [
  'Scopus veritabanına bağlanılıyor...',
  'Akademik veriler çekiliyor...',
  'Makaleler filtreleniyor...',
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

function App() {
  const [mainTopic, setMainTopic] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [keywords, setKeywords] = useState(['', '', '']);
  const [count, setCount] = useState(25);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [quota, setQuota] = useState(null);

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
      `"${COPYRIGHT_NOTICE}"`
    ];

    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `literature_results_${new Date().getTime()}.csv`);
  };


  const exportToPDF = async () => {
    if (!data?.results?.length) return;

    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '-9999px';
    exportContainer.style.top = '0';
    exportContainer.style.width = '800px';
    exportContainer.style.padding = '40px';
    exportContainer.style.background = 'white';
    exportContainer.style.fontFamily = "'Inter', sans-serif";

    exportContainer.innerHTML = `
      <div style="color: #4f46e5; font-size: 28px; font-weight: 800; margin-bottom: 8px;">LiteratureAI Araştırma Raporu</div>
      <div style="color: #64748b; font-size: 14px; font-weight: 600; margin-bottom: 30px;">
        Konu: ${mainTopic || 'Genel Arama'} | Tarih: ${new Date().toLocaleDateString('tr-TR')}
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #4f46e5; color: white; text-align: left;">
            <th style="padding: 12px; border: 1px solid #e2e8f0;">Sıra</th>
            <th style="padding: 12px; border: 1px solid #e2e8f0;">Makale Başlığı</th>
            <th style="padding: 12px; border: 1px solid #e2e8f0;">Yıl</th>
            <th style="padding: 12px; border: 1px solid #e2e8f0;">Atıf</th>
            <th style="padding: 12px; border: 1px solid #e2e8f0;">Skor</th>
          </tr>
        </thead>
        <tbody>
          ${data.results.map((item, index) => `
            <tr style="background: ${index % 2 === 0 ? '#f8fafc' : 'white'};">
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${index + 1}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;">${item.title || 'Başlıksız'}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${item.year || '-'}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${item.citedBy || 0}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 800; color: #4f46e5;">%${formatScore(item.scores?.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 30px; color: #94a3b8; font-size: 10px; text-align: center; font-style: italic;">
        ${COPYRIGHT_NOTICE}
      </div>
    `;

    document.body.appendChild(exportContainer);

    try {
      const canvas = await html2canvas(exportContainer, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`literature_results_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      document.body.removeChild(exportContainer);
    }
  };

  const exportToWord = async () => {
    if (!data?.results?.length) return;

    const tableRows = [
      new TableRow({
        children: ['Sıra', 'Başlık', 'Yıl', 'Atıf', 'AHP Skoru'].map(text => 
          new TableCell({ 
            children: [new Paragraph({ text, bold: true })],
            shading: { fill: '4F46E5' }
          })
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
            new TableCell({ children: [new Paragraph(`%${formatScore(item.scores?.total)}`)] }),
          ],
        })
      );
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'LiteratureAI Akademik Tarama Raporu',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
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
            alignment: AlignmentType.CENTER
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `literature_results_${new Date().getTime()}.docx`);
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    if (!mainTopic.trim() && !authorName.trim()) {
      setError('Lütfen en az bir ana konu veya yazar ismi giriniz.');
      return;
    }

    const validKeywords = keywords.filter((k) => k.trim() !== '');
    const normalizedCount = Math.min(500, Math.max(10, Number(count) || 25));

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await axios.get(`${apiUrl}/api/search`, {
        params: {
          mainTopic: mainTopic.trim(),
          authorName: authorName.trim(),
          keywords: JSON.stringify(validKeywords),
          count: normalizedCount,
        },
      });

      setData(response.data);
      if (response.data.quota) setQuota(response.data.quota);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.demoMode) {
        setData(errorData);
        if (errorData.quota) setQuota(errorData.quota);
        return;
      }
      setError(errorData?.error || 'Sonuçlar alınamadı. Sunucu bağlantısını kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
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
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ background: 'var(--score-med-bg)', padding: '0.75rem', borderRadius: '12px' }}>
              <Zap size={24} color="var(--score-med)" />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, color: 'var(--score-med)', fontWeight: '800' }}>Demo Modu Aktif</h4>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                API kotası dolduğu için sistem örnek veritabanı üzerinden sonuç üretiyor.
              </p>
            </div>
            <button onClick={() => setShowBanner(false)} className="pill-btn" style={{ border: 'none', background: 'none' }}>
              <X size={20} />
            </button>
          </MotionDiv>
        )}
      </AnimatePresence>

      <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
        <MotionDiv initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '0.5rem', letterSpacing: '-0.04em', background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LiteratureAI
          </h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '1.1rem' }}>
            Akademik Literatür Analiz ve AHP Skorlama Sistemi
          </p>
        </MotionDiv>
      </header>

      <section className="glass-panel" style={{ marginBottom: '4rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="hero-input-wrapper">
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '800', color: 'var(--text-main)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
              Ana Araştırma Konusu
            </label>
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem' }}>Yazar Adı (Opsiyonel)</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input type="text" className="input" placeholder="Yazar ismi..." value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem' }}>Makale Sayısı</label>
              <input type="number" className="input" style={{ paddingLeft: '1.25rem' }} value={count} onChange={(e) => setCount(e.target.value)} min="10" max="500" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '700', fontSize: '0.85rem' }}>Filtreleme Etiketleri</label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {keywords.map((k, i) => (
                <div key={i} className="input-wrapper" style={{ flex: 1, minWidth: '140px' }}>
                  <Tag className="input-icon" size={16} />
                  <input type="text" className="input" placeholder={`Etiket ${i+1}`} value={k} onChange={(e) => {
                    const nk = [...keywords]; nk[i] = e.target.value; setKeywords(nk);
                  }} />
                </div>
              ))}
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
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--score-low-bg)', border: '1px solid #fecaca', borderRadius: '12px', color: 'var(--score-low)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{error}</span>
          </MotionDiv>
        )}
      </section>

      {(data || quota) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
          <GlobalStats totalFound={data?.totalFound || 0} analyzed={data?.analyzedCount || 0} quota={quota} />

          {data && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <BarChart2 size={32} color="var(--brand-primary)" />
                    Sıralanmış Literatür Listesi
                  </h2>
                  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontWeight: '600' }}>
                    AHP algoritması ile en yüksek verimliliğe sahip makaleler sıralanmıştır.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={exportToPDF} className="pill-btn"><Download size={16} /> PDF İndir</button>
                  <button onClick={exportToCSV} className="pill-btn"><Download size={16} /> CSV Dışa Aktar</button>
                  <button onClick={exportToWord} className="pill-btn"><Download size={16} /> Word Kaydet</button>
                </div>
              </div>

              <div className="grid">
                <AnimatePresence>
                  {data.results?.map((item, index) => (
                    <ResultCard key={item.id || index} item={item} rank={index + 1} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}
        </div>
      )}

      <footer style={{ marginTop: '6rem', paddingBottom: '3rem', textAlign: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '2rem' }}>
        <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '600' }}>{COPYRIGHT_NOTICE}</p>
      </footer>
    </main>
  );
}

export default App;
