import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PenLine,
  Sparkles,
  X,
  Copy,
  Download,
  Check,
  AlertCircle,
  Loader2,
  BookOpen,
  ChevronDown,
  FileText,
  BookMarked,
  MessageSquare,
  Lightbulb,
  Languages,
  RefreshCw,
  PanelRightOpen,
  PanelRight,
  Monitor,
  FileDown,
  Database,
  Layers,
  ShieldCheck,
  Activity,
  ChevronUp
} from 'lucide-react';

const OUTPUT_TYPES = [
  { value: 'literature-review', label: 'Literatür İncelemesi', icon: BookOpen,      desc: 'Makaleleri sentezleyen akademik inceleme' },
  { value: 'introduction',      label: 'Giriş',              icon: FileText,      desc: 'Makale girişi ve arka plan bilgisi' },
  { value: 'methodology',       label: 'Yöntem',             icon: PenLine,       desc: 'Araştırmanın metodolojisi' },
  { value: 'results',           label: 'Bulgular',           icon: Sparkles,      desc: 'Araştırma sonuçları ve veriler' },
  { value: 'discussion',        label: 'Tartışma',           icon: MessageSquare, desc: 'Bulguları kaynaklarla tartışan bölüm' },
  { value: 'conclusion',        label: 'Sonuç',              icon: Lightbulb,     desc: 'Çalışmanın çıkarımları ve önerileri' },
];

const TONE_OPTIONS = [
  { value: 'akademik', label: 'Akademik' },
  { value: 'sade',     label: 'Daha Sade' },
  { value: 'tez',      label: 'Tez Dili' },
  { value: 'makale',   label: 'Makale Dili' },
];

const LENGTH_OPTIONS = [
  { value: 'kisa', label: 'Kısa' },
  { value: 'orta', label: 'Orta' },
  { value: 'uzun', label: 'Uzun' },
];

const BIBLIOGRAPHY_OPTIONS = [
  { value: 'APA 7', label: 'APA 7' },
  { value: 'IEEE',  label: 'IEEE' },
  { value: 'MLA',   label: 'MLA' },
  { value: 'Chicago', label: 'Chicago' },
];

// Basit Markdown → HTML (atıf rozetleri dahil)
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^## (.+)$/gm, '<h2 class="writer-h2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="writer-h3">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(\d+(?:,\s*\d+)*)\]/g, '<span class="writer-cite">[$1]</span>')
    .replace(/\n\n/g, '</p><p class="writer-p">')
    .replace(/\n/g, '<br>');
}

const WriterPanel = ({ papers = [], apiUrl, getToken, onClose, size = 'default', setSize }) => {
  const [isMobile,      setIsMobile]      = useState(window.innerWidth <= 768);
  const [outputType,    setOutputType]    = useState('literature-review');
  const [tone,          setTone]          = useState('akademik');
  const [length,        setLength]        = useState('orta');
  const [language,      setLanguage]      = useState('tr');
  const [prompt,        setPrompt]        = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [error,         setError]         = useState(null);
  const [copied,        setCopied]        = useState(false);
  const [showTypeMenu,  setShowTypeMenu]  = useState(false);
  const [showPapers,    setShowPapers]    = useState(false);
  const [phase,         setPhase]         = useState('idle');
  const [cooldown,      setCooldown]      = useState(0);
  const [loadingStep,   setLoadingStep]   = useState(0);
  const [bibliographyFormat, setBibliographyFormat] = useState('APA 7');

  const abortRef    = useRef(null);
  const outputRef   = useRef(null);
  const typeMenuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const selectedType = OUTPUT_TYPES.find(t => t.value === outputType) || OUTPUT_TYPES[0];

  const LOADING_PHASES = [
    { label: 'Makaleler analiz ediliyor...', icon: Layers },
    { label: 'Vektör eşleşmeleri hazırlanıyor...', icon: Database },
    { label: 'Akademik metin kurgulanıyor...', icon: Sparkles },
    { label: 'Kaynaklar metne yerleştiriliyor...', icon: ShieldCheck }
  ];

  // Dynamic loading steps
  useEffect(() => {
    let interval;
    if (isGenerating && !generatedText) {
      interval = setInterval(() => {
        setLoadingStep(s => (s + 1) % LOADING_PHASES.length);
      }, 2500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generatedText]);

  // Dışarı tıkla — type menüsünü kapat
  useEffect(() => {
    if (!showTypeMenu) return;
    const handler = (e) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target)) {
        setShowTypeMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTypeMenu]);

  // Üretim sırasında otomatik scroll
  useEffect(() => {
    if (generatedText && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [generatedText]);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    if (papers.length === 0) { setError('Lütfen önce en az bir makale seçin.'); return; }
    if (!prompt.trim() || prompt.trim().length < 10) { setError('Yönlendirme metni en az 10 karakter olmalıdır.'); return; }

    setError(null);
    setGeneratedText('');
    setIsGenerating(true);
    setPhase('generating');

    try {
      const token = await getToken();
      const response = await fetch(`${apiUrl}/api/writer/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ papers, prompt: prompt.trim(), outputType, tone, length, language, bibliographyFormat }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      abortRef.current = reader;
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.error) throw new Error(json.error);
            if (json.token) { accumulated += json.token; setGeneratedText(accumulated); }
            if (json.done) break;
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') throw parseErr;
          }
        }
      }
      setPhase('done');
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Metin üretimi başarısız oldu.');
      setPhase('error');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
      setCooldown(5);
    }
  }, [papers, prompt, outputType, tone, length, language, bibliographyFormat, apiUrl, getToken, isGenerating]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(c => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleStop = () => {
    if (abortRef.current) { try { abortRef.current.cancel(); } catch {} }
    setIsGenerating(false);
    setPhase(generatedText ? 'done' : 'idle');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setError('Kopyalama başarısız.'); }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `literatureai_${outputType}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = async () => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const lines = generatedText.split('\n');
      const docChildren = [];

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('### ')) {
          docChildren.push(new Paragraph({
            text: trimmed.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          }));
        } else if (trimmed.startsWith('## ')) {
          docChildren.push(new Paragraph({
            text: trimmed.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }));
        } else if (trimmed.startsWith('# ')) {
          docChildren.push(new Paragraph({
            text: trimmed.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }));
        } else {
          docChildren.push(new Paragraph({
            children: [new TextRun(trimmed)],
            spacing: { before: 100, after: 100 },
          }));
        }
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: docChildren,
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `literatureai_${outputType}_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('DOCX Export error', e);
      setError('DOCX İndirme başarısız oldu.');
    }
  };

  const canGenerate = papers.length > 0 && prompt.trim().length >= 10 && !isGenerating && cooldown === 0;

  return (
    <motion.div
      initial={{ x: isMobile ? '100vw' : (size === 'default' ? 420 : (size === 'half' ? '50vw' : '100vw')), opacity: 0 }}
      animate={{ 
        x: 0, 
        opacity: 1,
        width: isMobile ? '100vw' : (size === 'default' ? '420px' : (size === 'half' ? '50vw' : '100vw'))
      }}
      exit={{ x: isMobile ? '100vw' : (size === 'default' ? 420 : (size === 'half' ? '50vw' : '100vw')), opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        borderLeft: '1px solid rgba(99,102,241,0.15)',
        boxShadow: '-8px 0 32px -8px rgba(15,23,42,0.14), -2px 0 8px -2px rgba(79,70,229,0.08)',
        overflow: 'hidden',
        maxWidth: '100vw'
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div style={{
        padding: '1.25rem 1.5rem',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '10px',
            padding: '8px',
            display: 'flex',
            backdropFilter: 'blur(8px)',
          }}>
            <PenLine size={18} color="white" />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Yapay Zeka Yazar
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', fontWeight: 500 }}>
              Akademik RAG Workspace
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', padding: '3px' }}>
            <button onClick={() => setSize('default')} title="Kenar Çubuğu" style={{ background: size === 'default' ? 'rgba(255,255,255,0.2)' : 'transparent', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}><PanelRight size={14} /></button>
            <button onClick={() => setSize('half')} title="Yarım Ekran" style={{ background: size === 'half' ? 'rgba(255,255,255,0.2)' : 'transparent', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}><PanelRightOpen size={14} /></button>
            <button onClick={() => setSize('full')} title="Tam Ekran" style={{ background: size === 'full' ? 'rgba(255,255,255,0.2)' : 'transparent', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}><Monitor size={14} /></button>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}><X size={18} /></button>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#fcfdfe' }}>

        {/* Configuration Block */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Paper Context Summary */}
          <div style={{
            background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px',
            padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(79,70,229,0.08)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookMarked size={14} />
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                Seçilen Kaynaklar ({papers.length})
              </div>
            </div>
            {papers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '38px' }}>
                {papers.slice(0, 3).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || p.titleTR}</span>
                  </div>
                ))}
                {papers.length > 3 && (
                  <div style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 700, paddingLeft: '10px' }}>
                    + {papers.length - 3} makale daha
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '38px' }}>
                Henüz kaynak seçilmedi. Sol taraftaki sonuçlardan ekleyin.
              </div>
            )}
          </div>

          {/* Core Settings Row */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ position: 'relative', flex: 1 }} ref={typeMenuRef}>
              <button
                onClick={() => setShowTypeMenu(p => !p)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', border: '1.5px solid #e2e8f0',
                  borderRadius: '12px', background: 'white', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 700, color: '#1e293b',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <selectedType.icon size={15} color="#4f46e5" />
                  {selectedType.label}
                </span>
                <ChevronDown size={14} color="#94a3b8" style={{ transform: showTypeMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>

              <AnimatePresence>
                {showTypeMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{
                      position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                      background: 'white', border: '1.5px solid #e2e8f0',
                      borderRadius: '14px', boxShadow: '0 15px 30px -10px rgba(15,23,42,0.18)',
                      zIndex: 200, padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px'
                    }}
                  >
                    {OUTPUT_TYPES.map(type => (
                      <button
                        key={type.value}
                        onClick={() => { setOutputType(type.value); setShowTypeMenu(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px', border: 'none',
                          background: outputType === type.value ? 'rgba(79,70,229,0.06)' : 'transparent',
                          borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                          color: outputType === type.value ? '#4f46e5' : '#475569',
                          transition: 'all 0.2s'
                        }}
                      >
                        <type.icon size={15} />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>{type.label}</div>
                          <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>{type.desc}</div>
                        </div>
                        {outputType === type.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: 'white' }}>
              {[{ val: 'tr', label: 'TR' }, { val: 'en', label: 'EN' }].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setLanguage(val)}
                  style={{
                    padding: '10px 14px', border: 'none',
                    background: language === val ? '#4f46e5' : 'transparent',
                    color:      language === val ? 'white' : '#64748b',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800,
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: 'white', fontSize: '0.85rem', fontWeight: 700, color: '#334155', outline: 'none' }}>
              {TONE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label} Dili</option>)}
            </select>
            <select value={length} onChange={(e) => setLength(e.target.value)} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: 'white', fontSize: '0.85rem', fontWeight: 700, color: '#334155', outline: 'none' }}>
              {LENGTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label.charAt(0).toUpperCase() + opt.label.slice(1)} Metin</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <select value={bibliographyFormat} onChange={(e) => setBibliographyFormat(e.target.value)} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: 'white', fontSize: '0.85rem', fontWeight: 700, color: '#334155', outline: 'none' }}>
              {BIBLIOGRAPHY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>Kaynakça: {opt.label}</option>)}
            </select>
          </div>

          {/* Editor Workspace Area */}
          <div style={{ 
            position: 'relative', 
            background: '#f8fafc', 
            borderRadius: '16px', 
            padding: '4px',
            border: '1.5px solid #e2e8f0',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`Örn: "Bu makaleleri sentezleyerek, yapay zekanın sağlık sektöründeki etik etkilerini akademik dille analiz et..."`}
              rows={4}
              disabled={isGenerating}
              style={{
                width: '100%', padding: '16px', border: 'none',
                background: 'transparent', fontSize: '0.92rem', fontFamily: 'inherit',
                color: '#1e293b', resize: 'none', outline: 'none',
                lineHeight: 1.6, boxSizing: 'border-box'
              }}
            />
            <div style={{
              position: 'absolute', bottom: '12px', right: '16px',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#cbd5e1' }}>
                {prompt.length} karakter
              </span>
            </div>
          </div>

          {/* Status Indicators Dashboard */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '6px', 
            padding: '2px' 
          }}>
            {[
              { label: 'Atlas Vector Search', active: true, icon: Database },
              { label: 'RAG Pipeline', active: true, icon: Activity },
              { label: 'Academic Citation', active: true, icon: ShieldCheck },
              { label: 'Cloud Cache', active: true, icon: RefreshCw }
            ].map((stat, i) => (
              <div key={i} style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', 
                padding: '6px 8px', background: '#f8fafc', border: '1px solid #f1f5f9', 
                borderRadius: '8px' 
              }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: stat.active ? '#10b981' : '#cbd5e1', opacity: 0.7 }} />
                <stat.icon size={10} color="#cbd5e1" />
                <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#94a3b8' }}>{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Action Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.5rem' }}>
            {papers.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: '#9a3412', background: '#ffedd5', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <AlertCircle size={14} /> Metin üretmek için en az 1 makale seçin.
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {!isGenerating ? (
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  style={{
                    flex: 1, padding: '14px 20px',
                    background: canGenerate
                      ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                      : '#e2e8f0',
                    color: canGenerate ? 'white' : '#94a3b8', 
                    border: 'none', borderRadius: '14px',
                    fontWeight: 800, fontSize: '0.95rem',
                    cursor: canGenerate ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    boxShadow: canGenerate ? '0 8px 20px -6px rgba(79,70,229,0.5)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative', overflow: 'hidden'
                  }}
                >
                  <Sparkles size={18} />
                  {cooldown > 0 ? `Bekleyin (${cooldown}s)` : (generatedText ? 'Yeniden Üret' : 'Atıflı Metin Üret')}
                  {canGenerate && <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)', skewX: '-20deg' }} />}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  style={{
                    flex: 1, padding: '14px 20px',
                    background: '#fef2f2', color: '#dc2626',
                    border: '1.5px solid #fecaca', borderRadius: '14px',
                    fontWeight: 800, fontSize: '0.95rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  }}
                >
                  <X size={18} /> Üretimi Durdur
                </button>
              )}
            </div>
          </div>

          {/* Error Message - Softer style */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{
                  background: '#fff7ed', border: '1.5px solid #ffedd5',
                  borderRadius: '12px', padding: '12px 16px',
                  fontSize: '0.82rem', color: '#9a3412', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '10px',
                  boxShadow: '0 4px 12px rgba(251,146,60,0.1)'
                }}
              >
                <AlertCircle size={16} color="#f97316" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {generatedText && !isGenerating && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <button onClick={handleCopy} title="Kopyala" style={{ padding: '10px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: copied ? '#10b981' : '#64748b', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button onClick={handleDownloadDocx} title="Word Olarak İndir" style={{ padding: '10px', background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '10px', color: '#0284c7', cursor: 'pointer', display: 'flex', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                DOCX
              </button>
              <button onClick={handleDownloadTxt} title="TXT İndir" style={{ padding: '10px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#64748b', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                <Download size={16} />
              </button>
              <button onClick={() => { setGeneratedText(''); setPhase('idle'); setError(null); }} title="Sıfırla" style={{ padding: '10px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                <RefreshCw size={16} />
              </button>
            </div>
          )}
        </div>

        {/* ── Output Workspace ─────────────────────────────── */}
        <div ref={outputRef} style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '1.5rem', 
          minHeight: 0, 
          background: 'white',
          borderTop: '1px solid #f1f5f9'
        }}>

          {isGenerating && !generatedText && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '1.5rem', padding: '4rem 1rem', textAlign: 'center',
            }}>
              <div style={{ position: 'relative' }}>
                <Loader2 size={42} color="#4f46e5" style={{ animation: 'spin 2s linear infinite', opacity: 0.2 }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <selectedType.icon size={20} color="#4f46e5" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <motion.p 
                  key={loadingStep}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '1rem', letterSpacing: '-0.01em' }}
                >
                  {LOADING_PHASES[loadingStep].label}
                </motion.p>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                  Bu işlem seçilen {papers.length} makale için derinlemesine analiz içerir.
                </p>
              </div>
              
              {/* Simple progress bar */}
              <div style={{ width: '200px', height: '4px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 10, repeat: Infinity }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }}
                />
              </div>
            </div>
          )}

          {generatedText && (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              {isGenerating && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '1.25rem', padding: '6px 12px',
                  background: 'rgba(79,70,229,0.06)', borderRadius: '10px', width: 'fit-content',
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4f46e5', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <span style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 800 }}>Yazılıyor...</span>
                </div>
              )}

              {/* Output Actions Header */}
              {!isGenerating && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <button
                    onClick={handleCopy}
                    style={{
                      padding: '8px 14px', background: copied ? '#10b981' : 'white',
                      color: copied ? 'white' : '#4f46e5', border: copied ? '1px solid #059669' : '1px solid #c7d2fe',
                      borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '0.8rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(79,70,229,0.1)',
                      transition: 'all 0.2s', zIndex: 10
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Kopyalandı' : 'Metni Kopyala'}
                  </button>
                </div>
              )}

              <div
                className="writer-output"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedText) }}
                style={{ fontSize: '1.05rem', lineHeight: 1.85, color: '#1e293b' }}
              />
            </div>
          )}

          {!isGenerating && !generatedText && phase === 'idle' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '1.25rem', padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8',
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '20px',
                background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9'
              }}>
                <PenLine size={28} color="#e2e8f0" />
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 800, color: '#cbd5e1' }}>
                  Çalışma Alanı Hazır
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.6 }}>
                  Lütfen yukarıdan üretim ayarlarını seçin ve<br />analiz için bir yönlendirme girin.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Stats ──────────────────────────────────────── */}
        <div style={{
          padding: '0.75rem 1.5rem',
          borderTop: '1px solid #f1f5f9',
          background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={12} color="#10b981" />
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>
              AI Engine: Llama 3.3 (70B)
            </span>
          </div>
          <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>
            LiteratureAI v1.2.0 Production
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default WriterPanel;
