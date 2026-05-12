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
  { value: 'literature-review', label: 'Literatür Taraması', icon: BookOpen, desc: 'Makaleleri sentezleyen akademik inceleme' },
  { value: 'introduction',      label: 'Giriş Bölümü',       icon: FileText,  desc: 'Makale girişi ve arka plan bilgisi' },
  { value: 'abstract',          label: 'Makale Özeti',        icon: BookMarked, desc: 'Kısa ve yoğun akademik özet' },
  { value: 'discussion',        label: 'Tartışma',            icon: MessageSquare, desc: 'Bulguları kaynaklarla tartışan bölüm' },
  { value: 'conclusion',        label: 'Sonuç',               icon: Lightbulb, desc: 'Çalışmanın çıkarımları ve önerileri' },
];

// Basit Markdown → HTML dönüştürücü (atıf vurgulamalı)
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^## (.+)$/gm, '<h2 class="writer-h2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="writer-h3">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(\d+(?:,\s*\d+)*)\]/g, '<span class="writer-cite">[$1]</span>')
    .replace(/\n\n/g, '</p><p class="writer-p">')
    .replace(/\n/g, '<br>')
    .replace(/^(.)/gm, (m, c) => c !== '<' ? `<p class="writer-p">${m}` : m);
}

const WriterPanel = ({ papers = [], apiUrl, getToken, onClose }) => {
  const [outputType, setOutputType] = useState('literature-review');
  const [language, setLanguage]     = useState('tr');
  const [prompt, setPrompt]         = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating]   = useState(false);
  const [error, setError]           = useState(null);
  const [copied, setCopied]         = useState(false);
  const [showTypeMenu, setShowTypeMenu]   = useState(false);
  const [phase, setPhase]           = useState('idle'); // idle | generating | done | error

  const abortRef   = useRef(null);
  const outputRef  = useRef(null);
  const typeMenuRef = useRef(null);

  const selectedType = OUTPUT_TYPES.find(t => t.value === outputType) || OUTPUT_TYPES[0];

  // Dışarı tıklama — type menüsünü kapat
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

  // Üretim başladığında otomatik scroll
  useEffect(() => {
    if (generatedText && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [generatedText]);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    if (papers.length === 0) {
      setError('Lütfen önce en az bir makale seçin.');
      return;
    }
    if (!prompt.trim() || prompt.trim().length < 10) {
      setError('Yönlendirme metni en az 10 karakter olmalıdır.');
      return;
    }

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

      const reader = response.body.getReader();
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
            if (json.token) {
              accumulated += json.token;
              setGeneratedText(accumulated);
            }
            if (json.done) break;
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
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
    if (abortRef.current) {
      try { abortRef.current.cancel(); } catch {}
    }
    setIsGenerating(false);
    setPhase(generatedText ? 'done' : 'idle');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Kopyalama başarısız.');
    }
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

  const handleReset = () => {
    setGeneratedText('');
    setError(null);
    setPhase('idle');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9000,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      padding: '1rem',
      pointerEvents: 'none',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 24px 60px -12px rgba(15,23,42,0.22), 0 8px 24px -8px rgba(79,70,229,0.15)',
          border: '1px solid rgba(99,102,241,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'all',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          borderRadius: '20px 20px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              backdropFilter: 'blur(4px)',
            }}>
              <PenLine size={18} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Yapay Zeka Yazar
              </h2>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem', fontWeight: 500 }}>
                {papers.length} makale seçili · Atıflı akademik metin üretimi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Seçili Makaleler Özeti */}
          {papers.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {papers.slice(0, 5).map((p, i) => (
                <span key={i} style={{
                  background: 'rgba(79,70,229,0.07)',
                  color: '#4f46e5',
                  border: '1px solid rgba(99,102,241,0.2)',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  [{i + 1}] {p.title || p.titleTR || 'Makale'}
                </span>
              ))}
              {papers.length > 5 && (
                <span style={{ fontSize: '0.72rem', color: '#64748b', padding: '3px 8px', fontWeight: 600 }}>
                  +{papers.length - 5} daha
                </span>
              )}
            </div>
          ) : (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '0.82rem',
              color: '#92400e',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={14} />
              Henüz makale seçilmedi. Arama sonuçlarından makaleleri favorilere veya koleksiyona ekleyin, ardından buradan kullanın.
            </div>
          )}

          {/* Output Type + Language */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Output Type Dropdown */}
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }} ref={typeMenuRef}>
              <button
                onClick={() => setShowTypeMenu(p => !p)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '10px 14px',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '10px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#4f46e5'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <selectedType.icon size={15} color="#4f46e5" />
                  {selectedType.label}
                </span>
                <ChevronDown size={14} color="#94a3b8" style={{ transform: showTypeMenu ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
              </button>

              <AnimatePresence>
                {showTypeMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px -4px rgba(15,23,42,0.12)',
                      zIndex: 100,
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    {OUTPUT_TYPES.map(type => (
                      <button
                        key={type.value}
                        onClick={() => { setOutputType(type.value); setShowTypeMenu(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          border: 'none',
                          background: outputType === type.value ? 'rgba(79,70,229,0.07)' : 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          color: outputType === type.value ? '#4f46e5' : '#334155',
                          width: '100%',
                        }}
                      >
                        <type.icon size={14} />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{type.label}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>{type.desc}</div>
                        </div>
                        {outputType === type.value && <Check size={13} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language Toggle */}
            <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
              {[{ val: 'tr', label: '🇹🇷 TR' }, { val: 'en', label: '🇬🇧 EN' }].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setLanguage(val)}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    background: language === val ? '#4f46e5' : 'white',
                    color: language === val ? 'white' : '#64748b',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Languages size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Textarea */}
          <div style={{ position: 'relative' }}>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`Örn: "Yapay zekanın kanser tanısındaki rolünü, seçilen makaleleri kullanarak detaylı bir literatür taraması yaz."`}
              rows={3}
              disabled={isGenerating}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1.5px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                color: '#1e293b',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
                opacity: isGenerating ? 0.6 : 1,
                minHeight: '80px',
              }}
              onFocus={e => e.target.style.borderColor = '#4f46e5'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <span style={{
              position: 'absolute',
              bottom: '10px',
              right: '12px',
              fontSize: '0.7rem',
              color: prompt.length < 10 ? '#dc2626' : '#94a3b8',
              fontWeight: 600,
            }}>
              {prompt.length}/10
            </span>
          </div>

          {/* Hata Bildirimi */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  color: '#b91c1c',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate Button */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {!isGenerating ? (
              <button
                onClick={handleGenerate}
                disabled={papers.length === 0 || prompt.trim().length < 10}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: papers.length === 0 || prompt.trim().length < 10
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: papers.length === 0 || prompt.trim().length < 10 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: papers.length > 0 && prompt.trim().length >= 10
                    ? '0 4px 16px -4px rgba(79,70,229,0.4)'
                    : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <Sparkles size={16} />
                {generatedText ? 'Yeniden Üret' : 'Atıflı Metin Üret'}
              </button>
            ) : (
              <button
                onClick={handleStop}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <X size={16} /> Durdur
              </button>
            )}

            {generatedText && !isGenerating && (
              <>
                <button onClick={handleCopy} style={{
                  padding: '12px 16px',
                  border: '1.5px solid #e2e8f0',
                  background: copied ? '#ecfdf5' : 'white',
                  color: copied ? '#059669' : '#64748b',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Kopyalandı!' : 'Kopyala'}
                </button>
                <button onClick={handleDownload} style={{
                  padding: '12px 16px',
                  border: '1.5px solid #e2e8f0',
                  background: 'white',
                  color: '#64748b',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                }}>
                  <Download size={14} /> İndir
                </button>
                <button onClick={handleReset} style={{
                  padding: '12px',
                  border: '1.5px solid #e2e8f0',
                  background: 'white',
                  color: '#94a3b8',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <RefreshCw size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Output Area */}
        <div
          ref={outputRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: generatedText || isGenerating ? '1.5rem' : '0',
            minHeight: generatedText || isGenerating ? '200px' : '0',
            transition: 'min-height 0.3s ease',
          }}
        >
          {isGenerating && !generatedText && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              padding: '3rem 2rem',
              textAlign: 'center',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.12))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Loader2 size={24} color="#4f46e5" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>
                  Akademik metin üretiliyor...
                </p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem', fontWeight: 500 }}>
                  {papers.length} makale analiz ediliyor, atıflar oluşturuluyor
                </p>
              </div>
            </div>
          )}

          {(generatedText || (isGenerating && generatedText)) && (
            <div>
              {/* Üretiliyor göstergesi */}
              {isGenerating && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '1rem',
                  padding: '6px 12px',
                  background: 'rgba(79,70,229,0.06)',
                  borderRadius: '999px',
                  width: 'fit-content',
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#4f46e5',
                    animation: 'pulse 1s ease-in-out infinite',
                  }} />
                  <span style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 700 }}>
                    Yazıyor...
                  </span>
                </div>
              )}

              {/* Rendered Content */}
              <div
                className="writer-output"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedText) }}
                style={{
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  color: '#1e293b',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer bilgi */}
        {phase === 'done' && (
          <div style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
              ✅ Üretim tamamlandı · {papers.length} kaynak kullanıldı
            </span>
            <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 500 }}>
              Powered by Groq · Llama 3.3 70B
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default WriterPanel;
