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
import { useI18n } from '../i18n/context.js';

const MotionDiv = motion.div;

// `value` sunucuya giden protokol değeridir, değişmez; etiketler sözlükten gelir.
const OUTPUT_TYPES = [
  { value: 'literature-review', icon: BookOpen },
  { value: 'introduction', icon: FileText },
  { value: 'methodology', icon: PenLine },
  { value: 'results', icon: Sparkles },
  { value: 'discussion', icon: MessageSquare },
  { value: 'conclusion', icon: Lightbulb },
];

const TONE_OPTIONS = ['akademik', 'sade', 'tez', 'makale'];
const LENGTH_OPTIONS = ['kisa', 'orta', 'uzun'];

const BIBLIOGRAPHY_OPTIONS = [
  { value: 'APA 7', label: 'APA 7' },
  { value: 'IEEE', label: 'IEEE' },
  { value: 'MLA', label: 'MLA' },
  { value: 'Chicago', label: 'Chicago' },
];

const LOADING_PHASES = [
  { key: 'analyzing', icon: Layers },
  { key: 'context', icon: BookMarked },
  { key: 'writing', icon: Sparkles },
  { key: 'checks', icon: ShieldCheck },
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

const severityKey = (severity) => (severity === 'high' || severity === 'medium' ? severity : 'low');
const statusKey = (status) => (status === 'failed' || status === 'warn' ? status : 'clean');

const WriterPanel = ({ papers = [], apiUrl, getToken, onClose, size = 'default', setSize }) => {
  const { t, lang } = useI18n();
  const severityLabel = (s) => t(`writer.severity.${severityKey(s)}`);
  const statusLabel = (s) => t(`writer.status.${statusKey(s)}`);
  const typeLabel = (v) => t(`writer.types.${v}.label`);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [view, setView] = useState('settings');
  const [outputType, setOutputType] = useState('literature-review');
  const [tone, setTone] = useState('akademik');
  const [length, setLength] = useState('orta');
  // Üretim dili arayüz dilinden başlar; kullanıcı panelde değiştirebilir.
  const [language, setLanguage] = useState(lang);
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
  const [, setDoneEventCount] = useState(0);
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
      setError(t('writer.errNoPapers'));
      return;
    }
    if (!prompt.trim() || prompt.trim().length < 10) {
      setError(t('writer.errPromptShort'));
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
      if (!response.body) throw new Error(t('writer.errNoStream'));

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
        setError(t('writer.errNoDone'));
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || t('writer.errGenerate'));
      if (!streamedText) setView('settings');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
      setCooldown(5);
    }
  }, [papers, prompt, outputType, tone, length, language, bibliographyFormat, apiUrl, getToken, isGenerating, t]);

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
      setError(t('writer.errCopy'));
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `literatur-ai_${outputType}_${Date.now()}.txt`;
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
      a.download = `literatur-ai_${outputType}_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('DOCX export error', err);
      setError(t('writer.errDocx'));
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const margin = 48;
      const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const fullPageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Akademik Başlık Alanı
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(30, 41, 59);
      pdf.text('LITERATURAI ACADEMIC SYNTHESIS REPORT', margin, 52);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      const metaLine = `Tarih: ${new Date().toLocaleDateString('tr-TR')} | Format: ${bibliographyFormat} | Kaynak: ${papers.length} Makale | Mod: AHP Doğrulamalı`;
      pdf.text(metaLine, margin, 68);

      // Üst Çizgi
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(1);
      pdf.line(margin, 76, fullPageWidth - margin, 76);

      // Metin Alanı
      const lines = pdf.splitTextToSize(generatedText, pageWidth);
      let y = 100;
      pdf.setFont('times', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);

      let pageNum = 1;
      lines.forEach((line) => {
        if (y > pageHeight - 60) {
          // Alt Bilgi
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(8);
          pdf.setTextColor(148, 163, 184);
          pdf.text(`LiteraturAI • Sayfa ${pageNum}`, margin, pageHeight - 30);

          pdf.addPage();
          pageNum++;
          y = 52;
          pdf.setFont('times', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(15, 23, 42);
        }
        pdf.text(line, margin, y);
        y += 16;
      });

      // Son sayfa alt bilgi
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`LiteraturAI • Sayfa ${pageNum}`, margin, pageHeight - 30);

      pdf.save(`literatur-ai_${outputType}_${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF export error', err);
      setError(t('writer.errPdf'));
    }
  };

  const renderSettingsStage = () => (
    <section className="writer-setup-stage" aria-label={t('writer.settings')}>
      <div className="writer-setup-card">
        <div className="writer-setup-hero">
          <span className="writer-setup-icon"><Settings size={22} /></span>
          <div>
            <p>{t('writer.settings')}</p>
            <h2>{t('writer.settingsHeadline')}</h2>
            <small>{t('writer.selectedMeta', { n: papers.length, style: bibliographyFormat, lang: language.toUpperCase() })}</small>
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
            {t('writer.selectedSources')}
            <span>{papers.length}</span>
          </div>
          <div className="writer-source-list">
            {papers.length > 0 ? papers.slice(0, 4).map((paper, index) => (
              <div key={`${paper.doi || paper.url || paper.title || index}`} className="writer-source-row">
                <span>{index + 1}</span>
                <p>{paper.title || paper.titleTR || t('writer.untitledSource')}</p>
              </div>
            )) : (
              <p className="writer-muted">{t('writer.noSourcesHint')}</p>
            )}
          </div>
          {papers.length > 4 && <div className="writer-more-sources">{t('writer.moreSources', { n: papers.length - 4 })}</div>}
        </div>

        <form className="writer-settings-form" onSubmit={(event) => {
          event.preventDefault();
          handleGenerate();
        }}>
          <div className="writer-field-grid">
            <label>
              <span className="writer-label">{t('writer.textType')}</span>
              <select className="writer-field" value={outputType} onChange={(event) => setOutputType(event.target.value)} disabled={isGenerating}>
                {OUTPUT_TYPES.map((type) => <option key={type.value} value={type.value}>{typeLabel(type.value)}</option>)}
              </select>
              <small>{t(`writer.types.${selectedType.value}.desc`)}</small>
            </label>

            <label>
              <span className="writer-label">{t('writer.bibStyle')}</span>
              <select className="writer-field" value={bibliographyFormat} onChange={(event) => setBibliographyFormat(event.target.value)} disabled={isGenerating}>
                {BIBLIOGRAPHY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span className="writer-label">{t('writer.tone')}</span>
              <select className="writer-field" value={tone} onChange={(event) => setTone(event.target.value)} disabled={isGenerating}>
                {TONE_OPTIONS.map((value) => <option key={value} value={value}>{t(`writer.tones.${value}`)}</option>)}
              </select>
            </label>

            <label>
              <span className="writer-label">{t('writer.length')}</span>
              <select className="writer-field" value={length} onChange={(event) => setLength(event.target.value)} disabled={isGenerating}>
                {LENGTH_OPTIONS.map((value) => <option key={value} value={value}>{t(`writer.lengths.${value}`)}</option>)}
              </select>
            </label>
          </div>

          <div className="writer-language-row">
            <span className="writer-label">{t('writer.outputLanguage')}</span>
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
            <span className="writer-label">{t('writer.prompt')}</span>
            <textarea
              className="writer-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={isGenerating}
              placeholder={t('writer.promptPlaceholder')}
            />
            <span className="writer-char-count">{t('writer.chars', { n: prompt.length })}</span>
            {/* Buton 10 karakterin altında kapalı; nedenini burada söyle. */}
            {prompt.trim().length < 10 && (
              <span className="writer-prompt-hint" role="status">
                {t('writer.promptHint')}
              </span>
            )}
          </label>

          <div className="writer-setup-footer">
            <div className="writer-run-state">
              <div><ShieldCheck size={15} /> {t('writer.checksOn')}</div>
              {lastCompletedAt && <div><Activity size={15} /> {t('writer.lastRun', { time: lastCompletedAt.toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) })}</div>}
            </div>

            <div className="writer-setup-actions">
              {generatedText && !isGenerating && (
                <button type="button" className="writer-secondary-action" onClick={() => setView('document')}>
                  {t('writer.showResult')}
                </button>
              )}
              {!isGenerating ? (
                <button type="submit" className="writer-primary-action" disabled={!canGenerate}>
                  <Sparkles size={17} />
                  {cooldown > 0 ? t('writer.wait', { n: cooldown }) : (generatedText ? t('writer.regenerate') : t('writer.generate'))}
                </button>
              ) : (
                <button type="button" className="writer-stop-action" onClick={handleStop}>
                  <X size={17} /> {t('writer.stop')}
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
            <p>{t('writer.check')}</p>
            <h3>{safePostcheck ? statusLabel(safePostcheck.status) : t('writer.reportPending')}</h3>
          </div>
          <button type="button" onClick={() => setReportOpen(false)} title={t('writer.hideReport')} aria-label={t('writer.hideReport')}>
            <X size={16} />
          </button>
        </div>

        {!safePostcheck ? (
          <div className="writer-report-empty">
            <ShieldCheck size={28} />
            <strong>{t('writer.noReport')}</strong>
            <span>{t('writer.noReportText')}</span>
          </div>
        ) : (
          <>
            <div className="writer-report-summary">
              <div>
                <span>{t('writer.statusLabel')}</span>
                <strong className={`writer-status writer-status--${safePostcheck.status}`}>{statusLabel(safePostcheck.status)}</strong>
              </div>
              <div>
                <span>{t('writer.severityLabel')}</span>
                <strong className={`writer-severity writer-severity--${safePostcheck.severity}`}>{severityLabel(safePostcheck.severity)}</strong>
              </div>
              <div>
                <span>{t('writer.warningsLabel')}</span>
                <strong>{warningCount}</strong>
              </div>
            </div>

            {requestId && (
              <div className="writer-request-id">
                <span>{t('writer.supportRef')}</span>
                <code>{requestId}</code>
              </div>
            )}

            <div className="writer-stage-list">
              {stages.map(([key, report]) => (
                <article key={key} className="writer-stage-card">
                  <div className="writer-stage-title">
                    <strong>{t(`writer.stages.${key}`)}</strong>
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
                          <strong>{finding.code || t('writer.warningCode')}</strong>
                          <p>{finding.message || t('writer.warningDefault')}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="writer-stage-clean">{t('writer.stageClean')}</p>
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
    <section className="writer-document-stage" aria-label={t('writer.generatedText')}>
      <div className="writer-document-modal">
        <div className="writer-document-head">
          <div className="writer-document-meta">
            <span><SelectedTypeIcon size={16} /> {typeLabel(selectedType.value)}</span>
            <small>{t('writer.docMeta', { n: papers.length, style: bibliographyFormat, lang: language.toUpperCase() })}</small>
          </div>

          <div className="writer-document-actions">
            <button type="button" onClick={handleCopy} disabled={!generatedText} title={t('writer.copy')}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? t('writer.copied') : t('writer.copy')}</span>
            </button>
            <button type="button" onClick={handleDownloadDocx} disabled={!generatedText} title={t('writer.download', { f: 'DOCX' })}>
              <FileDown size={16} />
              <span>DOCX</span>
            </button>
            <button type="button" onClick={handleDownloadPdf} disabled={!generatedText} title={t('writer.download', { f: 'PDF' })}>
              <Download size={16} />
              <span>PDF</span>
            </button>
            <button type="button" onClick={handleDownloadTxt} disabled={!generatedText} title={t('writer.download', { f: 'TXT' })}>
              <Download size={16} />
              <span>TXT</span>
            </button>
            {!isGenerating ? (
              <button type="button" onClick={handleGenerate} disabled={!canGenerate} title={t('writer.regenerate')}>
                <RefreshCw size={16} />
                <span>{t('writer.regenerate')}</span>
              </button>
            ) : (
              <button type="button" className="writer-danger-button" onClick={handleStop} title={t('writer.stop')}>
                <X size={16} />
                <span>{t('writer.stopShort')}</span>
              </button>
            )}
            <button
              type="button"
              className={reportOpen ? 'active' : ''}
              onClick={() => setReportOpen((value) => !value)}
              title={t('writer.report')}
            >
              <ShieldCheck size={16} />
              <span>{t('writer.report')}</span>
            </button>
            <button
              type="button"
              className="writer-document-close"
              onClick={onClose}
              title={t('writer.backToResults')}
              aria-label={t('writer.close')}
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
              <strong>{t(`writer.phases.${LOADING_PHASES[loadingStep].key}`)}</strong>
              <span>{t('writer.preparing', { n: papers.length })}</span>
            </div>
          )}

          {generatedText && (
            <article className="writer-document-paper">
              {isGenerating && (
                <div className="writer-writing-badge">
                  <span />
                  {t('writer.writing')}
                </div>
              )}
              <div className="writer-output" dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedText) }} />
            </article>
          )}

          {!isGenerating && !generatedText && (
            <div className="writer-empty-editor">
              <PenLine size={34} />
              <strong>{t('writer.noText')}</strong>
              <span>{t('writer.noTextHint')}</span>
            </div>
          )}
        </div>

        <div className="writer-document-footer">
          <button type="button" className="writer-secondary-action" onClick={() => setView('settings')}>
            {t('writer.editSettings')}
          </button>
          <div>
            {postcheck ? (
              <span>
                {t('writer.footerStatus', { status: statusLabel(postcheck.status), n: warningCount })}
              </span>
            ) : (
              <span>{isGenerating ? t('writer.checkAfter') : t('writer.noReport')}</span>
            )}
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
            <strong>{t('writer.title')}</strong>
            <small>{showDocument ? t('writer.preview') : t('writer.settings')}</small>
          </div>
        </div>

        <div className="writer-mode-title">
          {showDocument ? <FileText size={15} /> : <Settings size={15} />}
          <span>{showDocument ? t('writer.preview') : typeLabel(selectedType.value)}</span>
        </div>

        <div className="writer-window-actions">
          <button type="button" className={size === 'default' ? 'active' : ''} onClick={() => setSize('default')} title={t('writer.sizeSide')} aria-label={t('writer.sizeSide')}>
            <PanelRight size={15} />
          </button>
          <button type="button" className={size === 'half' ? 'active' : ''} onClick={() => setSize('half')} title={t('writer.sizeHalf')} aria-label={t('writer.sizeHalf')}>
            <PanelRightOpen size={15} />
          </button>
          <button type="button" className={size === 'full' ? 'active' : ''} onClick={() => setSize('full')} title={t('writer.sizeFull')} aria-label={t('writer.sizeFull')}>
            <Monitor size={15} />
          </button>
          <button type="button" onClick={onClose} title={t('common.close')} aria-label={t('common.close')}>
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
