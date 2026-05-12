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
} from 'lucide-react';

const OUTPUT_TYPES = [
  { value: 'literature-review', label: 'Literatür Taraması', icon: BookOpen,      desc: 'Makaleleri sentezleyen akademik inceleme' },
  { value: 'introduction',      label: 'Giriş Bölümü',       icon: FileText,      desc: 'Makale girişi ve arka plan bilgisi' },
  { value: 'abstract',          label: 'Makale Özeti',        icon: BookMarked,    desc: 'Kısa ve yoğun akademik özet' },
  { value: 'discussion',        label: 'Tartışma',            icon: MessageSquare, desc: 'Bulguları kaynaklarla tartışan bölüm' },
  { value: 'conclusion',        label: 'Sonuç',               icon: Lightbulb,     desc: 'Çalışmanın çıkarımları ve önerileri' },
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

const WriterPanel = ({ papers = [], apiUrl, getToken, onClose }) => {
  const [outputType,    setOutputType]    = useState('literature-review');
  const [language,      setLanguage]      = useState('tr');
  const [prompt,        setPrompt]        = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [error,         setError]         = useState(null);
  const [copied,        setCopied]        = useState(false);
  const [showTypeMenu,  setShowTypeMenu]  = useState(false);
  const [phase,         setPhase]         = useState('idle');

  const abortRef    = useRef(null);
  const outputRef   = useRef(null);
  const typeMenuRef = useRef(null);

  const selectedType = OUTPUT_TYPES.find(t => t.value === outputType) || OUTPUT_TYPES[0];

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
        body: JSON.stringify({ papers, prompt: prompt.trim(), outputType, language }),
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
    }
  }, [papers, prompt, outputType, language, apiUrl, getToken, isGenerating]);

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

  const handleDownload = () => {
    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `literatureai_${outputType}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canGenerate = papers.length > 0 && prompt.trim().length >= 10 && !isGenerating;

  return (
    // Fixed sağ sidebar — tam sayfa yüksekliği, 420px genişlik
    <motion.div
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        borderLeft: '1px solid rgba(99,102,241,0.15)',
        boxShadow: '-8px 0 32px -8px rgba(15,23,42,0.14), -2px 0 8px -2px rgba(79,70,229,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div style={{
        padding: '1rem 1.25rem',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '6px',
            display: 'flex',
            backdropFilter: 'blur(4px)',
          }}>
            <PenLine size={16} color="white" />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: '0.92rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Yapay Zeka Yazar
            </div>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.72rem', fontWeight: 500 }}>
              {papers.length} makale · Atıflı metin üretici
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '7px',
            color: 'white',
            cursor: 'pointer',
            padding: '5px',
            display: 'flex',
            alignItems: 'center',
            transition: 'background 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
          onMouseOut={e  => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          title="Kapat"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Controls block */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Makale rozetleri */}
          {papers.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {papers.slice(0, 4).map((p, i) => (
                <span key={i} style={{
                  background: 'rgba(79,70,229,0.07)',
                  color: '#4f46e5',
                  border: '1px solid rgba(99,102,241,0.18)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  maxWidth: '160px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  [{i + 1}] {p.title || p.titleTR || 'Makale'}
                </span>
              ))}
              {papers.length > 4 && (
                <span style={{ fontSize: '0.68rem', color: '#64748b', padding: '2px 6px', fontWeight: 600 }}>
                  +{papers.length - 4} daha
                </span>
              )}
            </div>
          ) : (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: '8px', padding: '8px 12px',
              fontSize: '0.78rem', color: '#92400e', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '7px',
            }}>
              <AlertCircle size={13} />
              Henüz makale yüklenmedi.
            </div>
          )}

          {/* Output type + Language */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {/* Dropdown */}
            <div style={{ position: 'relative', flex: 1 }} ref={typeMenuRef}>
              <button
                onClick={() => setShowTypeMenu(p => !p)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '6px', padding: '8px 11px', border: '1.5px solid #e2e8f0',
                  borderRadius: '9px', background: 'white', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#4f46e5'}
                onBlur={e  => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <selectedType.icon size={13} color="#4f46e5" />
                  {selectedType.label}
                </span>
                <ChevronDown size={12} color="#94a3b8" style={{
                  transform: showTypeMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }} />
              </button>

              <AnimatePresence>
                {showTypeMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    style={{
                      position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                      background: 'white', border: '1px solid #e2e8f0',
                      borderRadius: '10px', boxShadow: '0 8px 20px -4px rgba(15,23,42,0.12)',
                      zIndex: 200, padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px',
                    }}
                  >
                    {OUTPUT_TYPES.map(type => (
                      <button
                        key={type.value}
                        onClick={() => { setOutputType(type.value); setShowTypeMenu(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 10px', border: 'none',
                          background: outputType === type.value ? 'rgba(79,70,229,0.07)' : 'none',
                          borderRadius: '7px', cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'inherit', width: '100%',
                          color: outputType === type.value ? '#4f46e5' : '#334155',
                        }}
                      >
                        <type.icon size={13} />
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{type.label}</div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>{type.desc}</div>
                        </div>
                        {outputType === type.value && <Check size={12} style={{ marginLeft: 'auto' }} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* TR / EN */}
            <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: '9px', overflow: 'hidden', flexShrink: 0 }}>
              {[{ val: 'tr', label: 'TR' }, { val: 'en', label: 'EN' }].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setLanguage(val)}
                  style={{
                    padding: '8px 12px', border: 'none',
                    background: language === val ? '#4f46e5' : 'white',
                    color:      language === val ? 'white' : '#64748b',
                    cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.76rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '4px',
                    transition: 'all 0.15s',
                  }}
                >
                  <Languages size={11} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div style={{ position: 'relative' }}>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`Örn: "YZ'nin kanser tanısındaki rolünü, seçili makalelerle detaylı literatür taraması yaz."`}
              rows={3}
              disabled={isGenerating}
              style={{
                width: '100%', padding: '10px 11px', border: '1.5px solid #e2e8f0',
                borderRadius: '9px', fontSize: '0.8rem', fontFamily: 'inherit',
                color: '#1e293b', resize: 'vertical', outline: 'none',
                transition: 'border-color 0.15s', boxSizing: 'border-box',
                opacity: isGenerating ? 0.6 : 1, minHeight: '72px',
                lineHeight: 1.55,
              }}
              onFocus={e => e.target.style.borderColor = '#4f46e5'}
              onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
            />
            <span style={{
              position: 'absolute', bottom: '8px', right: '10px',
              fontSize: '0.65rem',
              color: prompt.length < 10 ? '#dc2626' : '#94a3b8',
              fontWeight: 700,
            }}>
              {prompt.length}/10
            </span>
          </div>

          {/* Hata */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '8px', padding: '8px 12px',
                  fontSize: '0.78rem', color: '#b91c1c', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '7px',
                }}
              >
                <AlertCircle size={13} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isGenerating ? (
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                style={{
                  flex: 1, padding: '10px 16px',
                  background: canGenerate
                    ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                    : '#94a3b8',
                  color: 'white', border: 'none', borderRadius: '9px',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem',
                  cursor: canGenerate ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  boxShadow: canGenerate ? '0 4px 14px -4px rgba(79,70,229,0.4)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <Sparkles size={14} />
                {generatedText ? 'Yeniden Üret' : 'Atıflı Metin Üret'}
              </button>
            ) : (
              <button
                onClick={handleStop}
                style={{
                  flex: 1, padding: '10px 16px',
                  background: '#dc2626', color: 'white',
                  border: 'none', borderRadius: '9px',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                }}
              >
                <X size={14} /> Durdur
              </button>
            )}

            {generatedText && !isGenerating && (
              <>
                <button onClick={handleCopy} title={copied ? 'Kopyalandı!' : 'Kopyala'} style={{
                  padding: '10px 12px', border: '1.5px solid #e2e8f0',
                  background: copied ? '#ecfdf5' : 'white',
                  color: copied ? '#059669' : '#64748b',
                  borderRadius: '9px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '0.76rem', fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <button onClick={handleDownload} title="İndir" style={{
                  padding: '10px 12px', border: '1.5px solid #e2e8f0', background: 'white',
                  color: '#64748b', borderRadius: '9px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', transition: 'all 0.15s',
                }}>
                  <Download size={13} />
                </button>
                <button onClick={() => { setGeneratedText(''); setPhase('idle'); setError(null); }} title="Sıfırla" style={{
                  padding: '10px 12px', border: '1.5px solid #e2e8f0', background: 'white',
                  color: '#94a3b8', borderRadius: '9px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', transition: 'all 0.15s',
                }}>
                  <RefreshCw size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Output Area ─────────────────────────────────── */}
        <div ref={outputRef} style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', minHeight: 0 }}>

          {isGenerating && !generatedText && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '1rem', padding: '2.5rem 1rem', textAlign: 'center',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(79,70,229,0.1), rgba(124,58,237,0.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Loader2 size={20} color="#4f46e5" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#1e293b', fontSize: '0.88rem' }}>
                  Akademik metin üretiliyor...
                </p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.76rem', fontWeight: 500 }}>
                  {papers.length} makale analiz ediliyor
                </p>
              </div>
            </div>
          )}

          {generatedText && (
            <div>
              {isGenerating && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  marginBottom: '0.875rem', padding: '4px 10px',
                  background: 'rgba(79,70,229,0.06)', borderRadius: '999px', width: 'fit-content',
                }}>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%', background: '#4f46e5',
                    animation: 'pulse 1s ease-in-out infinite',
                  }} />
                  <span style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 700 }}>Yazıyor...</span>
                </div>
              )}

              <div
                className="writer-output"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedText) }}
                style={{ fontSize: '0.83rem', lineHeight: 1.72, color: '#1e293b' }}
              />
            </div>
          )}

          {!isGenerating && !generatedText && phase === 'idle' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '0.75rem', padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8',
            }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: 'rgba(79,70,229,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PenLine size={22} color="#c7d2fe" />
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.5 }}>
                Yönlendirme yaz ve<br />"Atıflı Metin Üret" butonuna bas
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        {phase === 'done' && (
          <div style={{
            padding: '0.625rem 1.25rem',
            borderTop: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>
              ✅ {papers.length} kaynak kullanıldı
            </span>
            <span style={{ fontSize: '0.65rem', color: '#cbd5e1', fontWeight: 500 }}>
              Groq · Llama 3.3 70B
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default WriterPanel;
