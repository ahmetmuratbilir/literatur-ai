import { useState } from 'react';
import axios from 'axios';
import { Search, BookOpen, BarChart2, Loader2, User, Tag, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ResultCard from './components/ResultCard';
import GlobalStats from './components/GlobalStats';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, WidthType } from 'docx';
import { saveAs } from 'file-saver';

function App() {
  const [mainTopic, setMainTopic] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [keywords, setKeywords] = useState(['', '', '']);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [language, setLanguage] = useState('');

  const COPYRIGHT_NOTICE = "© Bazı hakları saklıdır. Bu çalışma, orijinal yazar ve kaynağın belirtilmesi koşuluyla, yalnızca akademik araştırma amaçlarına, dağıtıma ve herhangi bir ortamda çoğaltmaya izin vermektedir.";

  const exportToCSV = () => {
    if (!data || !data.results) return;
    const headers = ['Rank', 'Title', 'Year', 'Cited By', 'URL', 'AHP Score'];
    const csvContent = [
      headers.join(','),
      ...data.results.map((item, i) => `"${i+1}","${item.title ? item.title.replace(/"/g, '""') : ''}",${item.year},${item.citedBy},"${item.url || ''}",${item.scores?.total || 0}`),
      "",
      `"${COPYRIGHT_NOTICE}"`
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "literature_results.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (!data || !data.results) return;
    const doc = new jsPDF();
    doc.setFont("helvetica");
    doc.text("Literature AI Search Results", 14, 20);

    const tableData = data.results.map((item, i) => [
      i + 1,
      item.title || "No Title",
      item.year,
      item.citedBy,
      item.scores?.total || 0
    ]);

    autoTable(doc, {
      head: [['Rank', 'Title', 'Year', 'Citations', 'AHP Score']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      columnStyles: { 1: { cellWidth: 100 } },
      didDrawPage: (dataArg) => {
        doc.setFontSize(7);
        doc.text(COPYRIGHT_NOTICE, 14, doc.internal.pageSize.height - 10);
      }
    });

    doc.save("literature_results.pdf");
  };

  const exportToWord = async () => {
    if (!data || !data.results) return;

    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "Rank", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Title", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Year", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Citations", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "AHP Score", bold: true })] }),
        ],
      }),
    ];

    data.results.forEach((item, i) => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(i + 1))] }),
            new TableCell({ children: [new Paragraph(item.title || "No Title")] }),
            new TableCell({ children: [new Paragraph(String(item.year))] }),
            new TableCell({ children: [new Paragraph(String(item.citedBy))] }),
            new TableCell({ children: [new Paragraph(String(item.scores?.total || 0))] }),
          ],
        })
      );
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "Literature AI Search Results",
              heading: HeadingLevel.HEADING_1,
            }),
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              text: COPYRIGHT_NOTICE,
              italics: true,
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "literature_results.docx");
  };

  const [quota, setQuota] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!mainTopic.trim() && !authorName.trim() && !keywords.some(k => k.trim() !== '')) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const validKeywords = keywords.filter(k => k.trim() !== '');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await axios.get(`${API_URL}/api/search`, {
        params: { 
          mainTopic: mainTopic.trim(),
          authorName: authorName.trim(),
          keywords: JSON.stringify(validKeywords),
          count: count || 10 
        }
      });
      setData(response.data);
      if (response.data.quota) setQuota(response.data.quota);
    } catch (err) {
      const errorData = err.response?.data;
      setError(errorData?.error || 'Failed to fetch results. Ensure backend is running.');
      if (errorData?.quota) setQuota(errorData.quota);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {/* ... header ... */}
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <BookOpen size={40} color="#3b82f6" />
            Literature<span style={{ color: '#3b82f6' }}>AI</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            AI-Powered Research Assistant • Powered by
            <img src="https://upload.wikimedia.org/wikipedia/commons/2/26/Scopus_logo.svg" alt="Scopus" style={{ height: '20px' }} />
          </p>
        </motion.div>
      </header>

      <div className="glass-panel" style={{ maxWidth: '900px', margin: '0 auto 3rem auto' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Hero Search Section */}
          <div className="hero-input-wrapper">
            <label style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '0.75rem' }}>
              Ana Konu veya Makale Adı
            </label>
            <div className="input-wrapper">
              <Search className="input-icon" size={24} />
              <input
                type="text"
                className="hero-input"
                placeholder="Örn: Artificial Intelligence in Healthcare"
                value={mainTopic}
                onChange={(e) => setMainTopic(e.target.value)}
              />
            </div>
          </div>

          {/* Secondary Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Yazar Adı</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  type="text"
                  className="input"
                  placeholder="Yazar adı (Opsiyonel)"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Makale Sayısı</label>
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
          
          <div style={{ width: '100%' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>Filtreleme Anahtar Kelimeleri</label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {keywords.map((kw, idx) => (
                <div key={idx} className="input-wrapper" style={{ flex: '1', minWidth: '150px' }}>
                  <Tag className="input-icon" size={16} />
                  <input
                    type="text"
                    className="input"
                    placeholder={`Etiket ${idx + 1}`}
                    value={kw}
                    onChange={(e) => {
                      const newKws = [...keywords];
                      newKws[idx] = e.target.value;
                      setKeywords(newKws);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <button type="submit" disabled={loading} className="btn">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Araştırma Başlatıldı...</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 'normal' }}>
                    Tahmini {Math.ceil((count / 25) * 1.5) + 1} saniye içinde sonuçlanacak
                  </span>
                </div>
              ) : (
                <>
                  <Search size={20} />
                  <span>Akıllı Literatür Taraması Yap</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ 
              marginTop: '1.5rem', 
              padding: '1.25rem', 
              background: '#fff1f2', 
              border: '1px solid #fecaca', 
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#991b1b'
            }}
          >
            <div style={{ background: '#f87171', color: 'white', padding: '0.4rem', borderRadius: '50%', display: 'flex' }}>
              <Loader2 size={16} />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
              {error.includes('Kotanız') ? (
                <>
                  <strong>Erişim Sınırı:</strong> {error.split('Yenilenme:')[0]} 
                  <span style={{ display: 'block', fontSize: '0.85rem', opacity: 0.8 }}>
                    Yenilenme Tarihi: {error.split('Yenilenme:')[1] || 'Sistem tarafından belirleniyor'}
                  </span>
                </>
              ) : error}
            </div>
          </motion.div>
        )}
      </div>

      {(data || quota) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          <GlobalStats 
            totalFound={data?.totalFound || 0} 
            analyzed={data?.analyzedCount || 0} 
            quota={quota} 
          />

          {data && (
            <div className="grid">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1rem 0', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                  <BarChart2 color="var(--accent)" /> En İyi Eşleşen Makaleler (AHP Skorlaması)
                </h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={exportToPDF} className="pill-btn" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5' }}>
                    <FileText size={16} /> PDF
                  </button>
                  <button onClick={exportToCSV} className="pill-btn" style={{ background: '#ecfdf5', color: '#10b981', border: '1px solid #6ee7b7' }}>
                    <BarChart2 size={16} /> Excel
                  </button>
                  <button onClick={exportToWord} className="pill-btn" style={{ background: '#eff6ff', color: '#3b82f6', border: '1px solid #93c5fd' }}>
                    <BookOpen size={16} /> Word
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {data.results && data.results.map((item, index) => (
                  <ResultCard key={item.id} item={item} rank={index + 1} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
  );
}

export default App;
