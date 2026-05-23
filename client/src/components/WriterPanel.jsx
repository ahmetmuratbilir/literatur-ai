import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  BookMarked,
  BookOpen,
  Check,
  Copy,
  Download,
  FileDown,
  FileText,
  Languages,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Monitor,
  PanelRight,
  PanelRightOpen,
  PenLine,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

const MotionDiv = motion.div;

const OUTPUT_TYPES = [
  { value: 'literature-review', label: 'Literatür İncelemesi', icon: BookOpen, desc: 'Kaynakları sentezleyen akademik inceleme' },
  { value: 'introduction', label: 'Giriş', icon: FileText, desc: 'Makale girişi ve arka plan' },
  { value: 'methodology', label: 'Yöntem', icon: PenLine, desc: 'Araştırma yönteminin akademik anlatımı' },
  { value: 'results', label: 'Bulgular', icon: Sparkles, desc: 'Bulgular ve veri odaklı metin' },
  { value: 'discussion', label: 'Tartışma', icon: MessageSquare, desc: 'Bulguları literatürle tartışan bölüm' },
  { value: 'conclusion', label: 'Sonuç', icon: Lightbulb, desc: 'Çıkarımlar ve gelecek önerileri' },
];

const TONE_OPTIONS = [
  { value: 'akademik', label: 'Akademik' },
  { value: 'sade', label: 'Daha Sade' },
  { value: 'tez', label: 'Tez Dili' },
  { value: 'makale', label: 'Makale Dili' },
];

const LENGTH_OPTIONS = [
  { value: 'kisa', label: 'Kısa' },
  { value: 'orta', label: 'Orta' },
  { value: 'uzun', label: 'Uzun' },
];

const BIBLIOGRAPHY_OPTIONS = [
  { value: 'APA 7', label: 'APA 7' },
  { value: 'IEEE', label: 'IEEE' },
  { value: 'MLA', label: 'MLA' },
  { value: 'Chicago', label: 'Chicago' },
];

const STAGE_LABELS = {
  citationReport: 'Atıf ve Kaynakça',
  qualityReport: 'Yazım Kalitesi',
  gateReport: 'Çıkış Kontrolü',
};

const LOADING_PHASES = [
  { label: 'Makaleler analiz ediliyor', icon: Layers },
  { label: 'Akademik bağlam kuruluyor', icon: BookMarked },
  { label: 'Metin üretimi başladı', icon: Sparkles },
  { label: 'Atıf ve kalite kontrolleri hazırlanıyor', icon: ShieldCheck },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatInline(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(\d+(?:,\s*\d+)*)\]/g, '<span class="writer-cite">[$1]</span>');
}

function renderMarkdown(text) {
  if (!text) return '';
  const html = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p class="writer-p">${paragraph.map(formatInline).join('<br>')}</p>`);
    paragraph = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      html.push(`<h3 class="writer-h3">${formatInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      html.push(`<h2 class="writer-h2">${formatInline(line.slice(3))}</h2>`);
      continue;
    }
    paragraph.push(line);
  }

  flushParagraph();
  return html.join('');
}

function normalizePostcheck(postcheck) {
  if (!postcheck || postcheck.version !== 'v1') return null;
  return postcheck;
}

function countWarnings(postcheck) {
  if (!postcheck) return 0;
  return ['citationReport', 'qualityReport', 'gateReport'].reduce((total, key) => {
    const findings = postcheck[key]?.findings;
    return total + (Array.isArray(findings) ? findings.length : 0);
  }, 0);
}

function severityLabel(severity) {
  if (severity === 'high') return 'Yüksek';
  if (severity === 'medium') return 'Orta';
  return 'Düşük';
}

function statusLabel(status) {
  if (status === 'failed') return 'Kontrol hatası';
  if (status === 'warn') return 'Uyarı var';
  return 'Temiz';
}

const WriterPanel = ({ papers = [], apiUrl, getToken, onClose, size = 'default', setSize }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [view, setView] = useState('settings');
  const [outputType, setOutputType] = useState('literature-review');
  const [tone, setTone] = useState('akademik');
  const [length, setLength] = useState('orta');
  const [language, setLanguage] = useState('tr');
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [bibliographyFormat, setBibliographyFormat] = useState('APA 7');
  const [postcheck, setPostcheck] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [doneEventCount, setDoneEventCount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [lastCompletedAt, setLastCompletedAt] = useState(null);

  const abortRef = useRef(null);
  const outputRef = useRef(null);

  const selectedType = OUTPUT_TYPES.find((type) => type.value === outputType) || OUTPUT_TYPES[0];
  const SelectedTypeIcon = selectedType.icon;
  const warningCount = countWarnings(postcheck);
  const canGenerate = papers.length > 0 && prompt.trim().length >= 10 && !isGenerating && cooldown === 0;
  const showDocument = view === 'document';
  const shellWidth = isMobile
    ? '100vw'
    : showDocument
      ? '100vw'
      : size === 'default'
        ? '420px'
        : size === 'half'
          ? '50vw'
          : '100vw';
  const shellStartX = isMobile
    ? '100vw'
    : showDocument
      ? '100vw'
      : size === 'default'
        ? 420
        : size === 'half'
          ? '50vw'
          : '100vw';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let interval;
    if (isGenerating && !generatedText) {
      interval = setInterval(() => {
        setLoadingStep((step) => (step + 1) % LOADING_PHASES.length);
      }, 2200);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generatedText]);

  useEffect(() => {
    if (showDocument && generatedText && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [generatedText, showDocument]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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

    let streamedText = '';
    setView('document');
    setReportOpen(false);
    setError(null);
    setGeneratedText('');
    setPostcheck(null);
    setRequestId(null);
    setDoneEventCount(0);
    setIsGenerating(true);

    try {
      const token = await getToken();
      const response = await fetch(`${apiUrl}/api/writer/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          papers,
          prompt: prompt.trim(),
          outputType,
          tone,
          length,
          language,
          bibliographyFormat,
        }),
      });

      const responseRequestId = response.headers.get('x-request-id');
      if (responseRequestId) setRequestId(responseRequestId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }
      if (!response.body) throw new Error('Stream cevabı alınamadı.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      abortRef.current = reader;

      let buffer = '';
      let localDoneCount = 0;

      const handlePayload = (payload) => {
        if (payload.error) throw new Error(payload.error);
        if (payload.token) {
          streamedText += payload.token;
          setGeneratedText(streamedText);
        }
        if (payload.done) {
          localDoneCount += 1;
          setDoneEventCount(localDoneCount);
          const safePostcheck = normalizePostcheck(payload.postcheck);
          if (safePostcheck) setPostcheck(safePostcheck);
        }
      };

      const flushEvents = (raw, isFinal = false) => {
        buffer += raw;
        const blocks = buffer.split('\n\n');
        buffer = isFinal ? '' : blocks.pop() ?? '';
        const completeBlocks = isFinal ? blocks.filter(Boolean) : blocks;

        for (const block of completeBlocks) {
          const dataLine = block
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          handlePayload(JSON.parse(dataLine.slice(6)));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        flushEvents(decoder.decode(value, { stream: true }));
      }
      flushEvents(decoder.decode(), true);

      setLastCompletedAt(new Date());
      if (localDoneCount === 0) {
        setError('Üretim tamamlandı ancak done eventi alınamadı.');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Metin üretimi başarısız oldu.');
      if (!streamedText) setView('settings');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
      setCooldown(5);
    }
  }, [papers, prompt, outputType, tone, length, language, bibliographyFormat, apiUrl, getToken, isGenerating]);

  const handleStop = () => {
    if (abortRef.current) {
      try {
        abortRef.current.cancel();
      } catch {
        // Reader cancellation can fail if the stream already closed.
      }
    }
    setIsGenerating(false);
    if (!generatedText) setView('settings');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Kopyalama başarısız.');
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `literatureai_${outputType}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = async () => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const children = generatedText.split('\n').reduce((items, line) => {
        const trimmed = line.trim();
        if (!trimmed) return items;
        if (trimmed.startsWith('### ')) {
          items.push(new Paragraph({ text: trimmed.slice(4), heading: HeadingLevel.HEADING_3 }));
        } else if (trimmed.startsWith('## ')) {
          items.push(new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2 }));
        } else {
          items.push(new Paragraph({ children: [new TextRun(trimmed)] }));
        }
        return items;
      }, []);

      const doc = new Document({ sections: [{ properties: {}, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `literatureai_${outputType}_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('DOCX export error', err);
      setError('DOCX indirme başarısız oldu.');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const margin = 48;
      const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const lines = pdf.splitTextToSize(generatedText, pageWidth);
      let y = margin;
      pdf.setFont('times', 'normal');
      pdf.setFontSize(11);
      lines.forEach((line) => {
        if (y > 780) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += 17;
      });
      pdf.save(`literatureai_${outputType}_${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF export error', err);
      setError('PDF indirme başarısız oldu.');
    }
  };

  const renderSettingsStage = () => (
    <section className="writer-setup-stage" aria-label="Yazım ayarları">
      <div className="writer-setup-card">
        <div className="writer-setup-hero">
          <span className="writer-setup-icon"><Settings size={22} /></span>
          <div>
            <p>Yazım Ayarları</p>
            <h2>Önce isteği netleştir, sonra metni rahatça oku.</h2>
            <small>{papers.length} kaynak seçili · {bibliographyFormat} · {language.toUpperCase()}</small>
          </div>
        </div>

        {error && (
          <div className="writer-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="writer-source-strip">
          <div className="writer-card-title">
            <BookMarked size={16} />
            Seçilen Kaynaklar
            <span>{papers.length}</span>
          </div>
          <div className="writer-source-list">
            {papers.length > 0 ? papers.slice(0, 4).map((paper, index) => (
              <div key={`${paper.doi || paper.url || paper.title || index}`} className="writer-source-row">
                <span>{index + 1}</span>
                <p>{paper.title || paper.titleTR || 'Başlıksız kaynak'}</p>
              </div>
            )) : (
              <p className="writer-muted">Metin üretmek için önce arama sonuçlarından kaynak seçin.</p>
            )}
          </div>
          {papers.length > 4 && <div className="writer-more-sources">+{papers.length - 4} kaynak daha</div>}
        </div>

        <form className="writer-settings-form" onSubmit={(event) => {
          event.preventDefault();
          handleGenerate();
        }}>
          <div className="writer-field-grid">
            <label>
              <span className="writer-label">Metin türü</span>
              <select className="writer-field" value={outputType} onChange={(event) => setOutputType(event.target.value)} disabled={isGenerating}>
                {OUTPUT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <small>{selectedType.desc}</small>
            </label>

            <label>
              <span className="writer-label">Kaynakça stili</span>
              <select className="writer-field" value={bibliographyFormat} onChange={(event) => setBibliographyFormat(event.target.value)} disabled={isGenerating}>
                {BIBLIOGRAPHY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span className="writer-label">Ton</span>
              <select className="writer-field" value={tone} onChange={(event) => setTone(event.target.value)} disabled={isGenerating}>
                {TONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span className="writer-label">Uzunluk</span>
              <select className="writer-field" value={length} onChange={(event) => setLength(event.target.value)} disabled={isGenerating}>
                {LENGTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <div className="writer-language-row">
            <span className="writer-label">Dil</span>
            <div className="writer-segment">
              <button type="button" className={language === 'tr' ? 'active' : ''} onClick={() => setLanguage('tr')} disabled={isGenerating}>
                <Languages size={14} /> TR
              </button>
              <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} disabled={isGenerating}>
                EN
              </button>
            </div>
          </div>

          <label className="writer-prompt-block">
            <span className="writer-label">Konu ve yönlendirme</span>
            <textarea
              className="writer-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={isGenerating}
              placeholder="Örn: Bu makaleleri sentezleyerek yapay zekanın sağlık alanındaki etik etkilerini akademik dille tartış."
            />
            <span className="writer-char-count">{prompt.length} karakter</span>
          </label>

          <div className="writer-setup-footer">
            <div className="writer-run-state">
              <div><ShieldCheck size={15} /> Akademik kontrol aktif</div>
              <div><Activity size={15} /> Gate modu: warn only</div>
              {lastCompletedAt && <div>Son üretim: {lastCompletedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>}
            </div>

            <div className="writer-setup-actions">
              {generatedText && !isGenerating && (
                <button type="button" className="writer-secondary-action" onClick={() => setView('document')}>
                  Sonucu Göster
                </button>
              )}
              {!isGenerating ? (
                <button type="submit" className="writer-primary-action" disabled={!canGenerate}>
                  <Sparkles size={17} />
                  {cooldown > 0 ? `Bekleyin (${cooldown}s)` : (generatedText ? 'Yeniden Oluştur' : 'Oluştur')}
                </button>
              ) : (
                <button type="button" className="writer-stop-action" onClick={handleStop}>
                  <X size={17} /> Üretimi Durdur
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </section>
  );

  const renderReportPanel = () => {
    const safePostcheck = normalizePostcheck(postcheck);
    const stages = [
      ['citationReport', safePostcheck?.citationReport],
      ['qualityReport', safePostcheck?.qualityReport],
      ['gateReport', safePostcheck?.gateReport],
    ];

    return (
      <section className="writer-report-card">
        <div className="writer-report-header">
          <div>
            <p>Akademik Kontrol</p>
            <h3>{safePostcheck ? statusLabel(safePostcheck.status) : 'Rapor bekleniyor'}</h3>
          </div>
          <button type="button" onClick={() => setReportOpen(false)} title="Raporu gizle">
            <X size={16} />
          </button>
        </div>

        {!safePostcheck ? (
          <div className="writer-report-empty">
            <ShieldCheck size={28} />
            <strong>Henüz rapor oluşturulmadı</strong>
            <span>Metin üretimi tamamlandığında atıf, kalite ve gate sonuçları burada görünür.</span>
          </div>
        ) : (
          <>
            <div className="writer-report-summary">
              <div>
                <span>Durum</span>
                <strong className={`writer-status writer-status--${safePostcheck.status}`}>{statusLabel(safePostcheck.status)}</strong>
              </div>
              <div>
                <span>Max severity</span>
                <strong className={`writer-severity writer-severity--${safePostcheck.severity}`}>{severityLabel(safePostcheck.severity)}</strong>
              </div>
              <div>
                <span>Warning</span>
                <strong>{warningCount}</strong>
              </div>
              <div>
                <span>Done</span>
                <strong>{doneEventCount}</strong>
              </div>
            </div>

            {requestId && (
              <div className="writer-request-id">
                <span>requestId</span>
                <code>{requestId}</code>
              </div>
            )}

            <div className="writer-stage-list">
              {stages.map(([key, report]) => (
                <article key={key} className="writer-stage-card">
                  <div className="writer-stage-title">
                    <strong>{STAGE_LABELS[key]}</strong>
                    <span className={`writer-status writer-status--${report?.status || 'ok'}`}>
                      {statusLabel(report?.status || 'ok')}
                    </span>
                  </div>
                  <div className="writer-stage-meta">
                    <span>{report?.durationMs ?? 0}ms</span>
                    <span>{severityLabel(report?.severity || 'low')}</span>
                  </div>
                  {Array.isArray(report?.findings) && report.findings.length > 0 ? (
                    <div className="writer-finding-list">
                      {report.findings.map((finding, index) => (
                        <div key={`${finding.code || key}-${index}`} className={`writer-finding writer-finding--${finding.severity || 'low'}`}>
                          <strong>{finding.code || 'UYARI'}</strong>
                          <p>{finding.message || 'Kontrol uyarısı oluştu.'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="writer-stage-clean">Bu bölümde uyarı yok.</p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    );
  };

  const renderDocumentStage = () => (
    <section className="writer-document-stage" aria-label="Oluşturulan metin">
      <div className="writer-document-modal">
        <div className="writer-document-head">
          <div className="writer-document-meta">
            <span><SelectedTypeIcon size={16} /> {selectedType.label}</span>
            <small>{papers.length} kaynak · {bibliographyFormat} · {language.toUpperCase()}</small>
          </div>

          <div className="writer-document-actions">
            <button type="button" onClick={handleCopy} disabled={!generatedText} title="Kopyala">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
            </button>
            <button type="button" onClick={handleDownloadDocx} disabled={!generatedText} title="DOCX indir">
              <FileDown size={16} />
              <span>DOCX</span>
            </button>
            <button type="button" onClick={handleDownloadPdf} disabled={!generatedText} title="PDF indir">
              <Download size={16} />
              <span>PDF</span>
            </button>
            <button type="button" onClick={handleDownloadTxt} disabled={!generatedText} title="TXT indir">
              <Download size={16} />
              <span>TXT</span>
            </button>
            {!isGenerating ? (
              <button type="button" onClick={handleGenerate} disabled={!canGenerate} title="Yeniden üret">
                <RefreshCw size={16} />
                <span>Yeniden Üret</span>
              </button>
            ) : (
              <button type="button" className="writer-danger-button" onClick={handleStop} title="Üretimi durdur">
                <X size={16} />
                <span>Durdur</span>
              </button>
            )}
            <button
              type="button"
              className={reportOpen ? 'active' : ''}
              onClick={() => setReportOpen((value) => !value)}
              title="Akademik kontrol raporu"
            >
              <ShieldCheck size={16} />
              <span>Akademik Kontrol Raporu</span>
            </button>
            <button
              type="button"
              className="writer-document-close"
              onClick={onClose}
              title="Ana ekrana dön"
              aria-label="Yazar modunu kapat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="writer-error writer-error--document">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div ref={outputRef} className="writer-document-scroll">
          {isGenerating && !generatedText && (
            <div className="writer-loading-state">
              {(() => {
                const LoadingIcon = LOADING_PHASES[loadingStep].icon;
                return <LoadingIcon size={28} />;
              })()}
              <Loader2 size={42} className="writer-spinner" />
              <strong>{LOADING_PHASES[loadingStep].label}</strong>
              <span>{papers.length} kaynak üzerinden akademik metin hazırlanıyor.</span>
            </div>
          )}

          {generatedText && (
            <article className="writer-document-paper">
              {isGenerating && (
                <div className="writer-writing-badge">
                  <span />
                  Yazılıyor
                </div>
              )}
              <div className="writer-output" dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedText) }} />
            </article>
          )}

          {!isGenerating && !generatedText && (
            <div className="writer-empty-editor">
              <PenLine size={34} />
              <strong>Henüz metin yok</strong>
              <span>Ayarları kontrol edip yeniden oluşturmayı deneyin.</span>
            </div>
          )}
        </div>

        <div className="writer-document-footer">
          <button type="button" className="writer-secondary-action" onClick={() => setView('settings')}>
            Ayarları Düzenle
          </button>
          <div>
            {postcheck ? (
              <span>
                Postcheck v1 · {statusLabel(postcheck.status)} · {warningCount} uyarı
              </span>
            ) : (
              <span>{isGenerating ? 'Kontrol üretimden sonra çalışacak.' : 'Henüz rapor oluşturulmadı.'}</span>
            )}
            {requestId && <code>{requestId}</code>}
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <MotionDiv
      className={`writer-shell writer-shell--${size} ${showDocument ? 'writer-shell--document' : 'writer-shell--setup'}`}
      initial={{ x: shellStartX, opacity: 0 }}
      animate={{ x: 0, opacity: 1, width: shellWidth }}
      exit={{ x: shellStartX, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
    >
      <div className="writer-backdrop" />

      <header className="writer-topbar">
        <div className="writer-title">
          <span><PenLine size={18} /></span>
          <div>
            <strong>Yapay Zeka Yazar</strong>
            <small>{showDocument ? 'Belge önizleme' : 'Yazım ayarları'}</small>
          </div>
        </div>

        <div className="writer-mode-title">
          {showDocument ? <FileText size={15} /> : <Settings size={15} />}
          <span>{showDocument ? 'Floating document preview' : selectedType.label}</span>
        </div>

        <div className="writer-window-actions">
          <button type="button" className={size === 'default' ? 'active' : ''} onClick={() => setSize('default')} title="Kenar panel">
            <PanelRight size={15} />
          </button>
          <button type="button" className={size === 'half' ? 'active' : ''} onClick={() => setSize('half')} title="Yarım ekran">
            <PanelRightOpen size={15} />
          </button>
          <button type="button" className={size === 'full' ? 'active' : ''} onClick={() => setSize('full')} title="Tam ekran">
            <Monitor size={15} />
          </button>
          <button type="button" onClick={onClose} title="Kapat">
            <X size={17} />
          </button>
        </div>
      </header>

      <main className={`writer-flow ${showDocument ? 'writer-flow--document' : 'writer-flow--settings'}`}>
        {showDocument ? renderDocumentStage() : renderSettingsStage()}
      </main>

      <AnimatePresence>
        {showDocument && reportOpen && (
          <MotionDiv
            className={`writer-report-drawer ${isMobile ? 'writer-report-drawer--mobile' : ''}`}
            initial={isMobile ? { y: '100%' } : { x: 380 }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: 380 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          >
            {renderReportPanel()}
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
};

export default WriterPanel;
