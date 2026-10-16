import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertOctagon, AlertTriangle, BookMarked, Download, Eye, FileText, Info, Library, ListTree, LocateFixed, Printer, RefreshCw,
} from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import { citedDois, countBySeverity, runAudit, SEVERITY } from '../audit/audit.js';
import { toBibTeX, toRIS, downloadText } from '../utils/citationExport.js';
import { PAGE_SIZES } from '../components/workspace/pageSetup.js';
import './audit.css';

const MAX_DOIS = 25;
const SEVERITY_ICON = { critical: AlertOctagon, warning: AlertTriangle, info: Info };

/**
 * Denetim ve Teslim (WO-010 Aşama 2, Stitch ekranı 6).
 *
 * Tasarımdaki "Genel hazırlık skoru %94", "YÖK ve İTÜ kriterlerine göre",
 * PDF/A ve Turnitin yerine yalnız elimizdeki kontroller ve gerçekten
 * üretebildiğimiz dosyalar var (tüzük 2.8). Kurallar `audit/audit.js`'te.
 */
export default function Audit({
  active, snapshot, basket, apiUrl, getToken,
  onReveal, onRevealSection, onPreview, onPrint, onExportWord, onOpenBibliography, onOpenSources,
}) {
  const { t, lang } = useI18n();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const fmt = (n) => Number(n || 0).toLocaleString(locale);
  const [filter, setFilter] = useState('all');
  // `key`: cevabın hangi isteğe ait olduğu. Yükleniyor durumu buradan türer.
  const [retraction, setRetraction] = useState({ byDoi: null, failed: false, key: '' });
  const [scanTick, setScanTick] = useState(0);

  // Geri çekme durumu her açılışta ve "Yeniden tara"da canlı sorulur
  // (CLAUDE.md 3.4: önbelleğe alınmaz). Cevap gelmeyen kaynak bilinmiyor sayılır.
  const doiKey = snapshot ? citedDois(snapshot).slice(0, MAX_DOIS).join('|') : '';
  const requestKey = `${doiKey}#${scanTick}`;
  const retractionLoading = Boolean(active && doiKey && retraction.key !== requestKey);
  useEffect(() => {
    if (!active || !doiKey) return undefined;
    const controller = new AbortController();
    (async () => {
      try {
        const token = await getToken();
        const { data } = await axios.post(`${apiUrl}/api/retractions`, { dois: doiKey.split('|') }, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        setRetraction({ byDoi: data?.results || {}, failed: Boolean(data?.failed), key: requestKey });
      } catch (err) {
        if (axios.isCancel(err)) return;
        setRetraction({ byDoi: null, failed: true, key: requestKey });
      }
    })();
    return () => controller.abort();
  }, [active, doiKey, requestKey, apiUrl, getToken]);

  const items = useMemo(
    () => runAudit(snapshot, { retractions: retraction.byDoi, retractionFailed: retraction.failed }),
    [snapshot, retraction],
  );
  const counts = countBySeverity(items);
  const shown = filter === 'all' ? items : items.filter((i) => i.severity === filter);

  const stamp = new Date().toISOString().slice(0, 10);
  const exportBasket = (format) => {
    const papers = basket.papers;
    if (!papers.length) return;
    if (format === 'bib') downloadText(`literatur-ai_kaynakca_${stamp}.bib`, toBibTeX(papers), 'application/x-bibtex');
    else downloadText(`literatur-ai_kaynakca_${stamp}.ris`, toRIS(papers), 'application/x-research-info-systems');
  };

  /** Maddenin hedefine götüren düğme: cümle, bölüm, kaynakça ya da sepet. */
  const actionFor = (item) => {
    const target = item.target;
    if (target?.kind === 'sentence') {
      return (
        <button type="button" className="la-btn" onClick={() => onReveal(target.key)} data-action="audit-reveal">
          <LocateFixed size={14} /> {t('audit.action.reveal')}
        </button>
      );
    }
    if (target?.kind === 'section') {
      return (
        <button type="button" className="la-btn" onClick={() => onRevealSection(target.index)} data-action="audit-section">
          <ListTree size={14} /> {t('audit.action.section')}
        </button>
      );
    }
    if (target?.kind === 'bib') {
      return (
        <button type="button" className="la-btn" onClick={onOpenBibliography} data-action="audit-bib">
          <BookMarked size={14} /> {t('audit.action.bib')}
        </button>
      );
    }
    if (target?.kind === 'sources') {
      return (
        <button type="button" className="la-btn" onClick={onOpenSources} data-action="audit-sources">
          <Library size={14} /> {t('audit.action.sources')}
        </button>
      );
    }
    return null;
  };

  const setup = snapshot?.setup;
  const loadingDoc = !snapshot;

  return (
    <div className="la-page la-page--wide">
      <div className="la-page-head">
        <div>
          <h1>{t('audit.title')}</h1>
          <p>{t('audit.lead')}</p>
        </div>
        <div className="au-summary" aria-live="polite">
          {loadingDoc ? (
            <span className="la-note">{t('audit.loading')}</span>
          ) : (
            SEVERITY.map((s) => (
              <span key={s} className={`au-count au-count--${s}`} data-severity={s}>
                {t(`audit.count.${s}`, { n: fmt(counts[s]) })}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="au-grid">
        <section className="la-card" aria-label={t('audit.listTitle')}>
          <div className="la-card__head">
            <div className="au-filters" role="tablist" aria-label={t('audit.filter')}>
              {['all', ...SEVERITY].map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  data-action={`audit-filter-${f}`}
                >
                  {t(`audit.filterLabel.${f}`)} <em>{fmt(f === 'all' ? items.length : counts[f])}</em>
                </button>
              ))}
            </div>
            <button type="button" className="la-btn" onClick={() => setScanTick((n) => n + 1)} data-action="audit-rescan" title={t('audit.rescanHint')}>
              <RefreshCw size={14} /> {t('audit.rescan')}
            </button>
          </div>

          {loadingDoc ? (
            <p className="la-empty">{t('audit.loading')}</p>
          ) : shown.length === 0 ? (
            <p className="la-empty">{items.length === 0 ? t('audit.clean') : t('audit.noneInFilter')}</p>
          ) : (
            <ul className="au-list">
              {shown.map((item) => {
                const Icon = SEVERITY_ICON[item.severity];
                return (
                  <li key={item.id} className={`au-item au-item--${item.severity}`} data-rule={item.rule}>
                    <span className={`au-badge au-badge--${item.severity}`}>
                      <Icon size={12} /> {t(`audit.severity.${item.severity}`)}
                    </span>
                    <div className="au-item__main">
                      <strong>{t(`audit.rule.${item.rule}.title`, { ...item.params, n: fmt(item.params?.n) })}</strong>
                      {item.excerpt && <blockquote>{item.excerpt}</blockquote>}
                      <small>{t(`audit.rule.${item.rule}.hint`, { ...item.params, target: fmt(item.params?.target) })}</small>
                      {item.rule === 'uncitedSources' && item.params.titles?.length > 0 && (
                        <ul className="au-titles">{item.params.titles.slice(0, 6).map((title) => <li key={title}>{title}</li>)}</ul>
                      )}
                    </div>
                    <div className="au-item__act">{actionFor(item)}</div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="la-note au-limits">{t('audit.limits')}</p>
        </section>

        <aside className="au-side">
          <section className="la-card" aria-label={t('audit.export.title')}>
            <div className="la-card__head"><h2>{t('audit.export.title')}</h2></div>
            <div className="au-export">
              <button type="button" className="la-btn la-btn--primary" onClick={onExportWord} disabled={loadingDoc} data-action="audit-export-word">
                <FileText size={15} /> {t('audit.export.word')}
              </button>
              <button type="button" className="la-btn" onClick={onPrint} disabled={loadingDoc} data-action="audit-print">
                <Printer size={15} /> {t('audit.export.print')}
              </button>
              <button type="button" className="la-btn" onClick={onPreview} disabled={loadingDoc} data-action="audit-preview">
                <Eye size={15} /> {t('audit.export.preview')}
              </button>
              <div className="au-export__row">
                <button type="button" className="la-btn" onClick={() => exportBasket('bib')} disabled={!basket.papers.length} data-action="audit-bibtex">
                  <Download size={14} /> BibTeX
                </button>
                <button type="button" className="la-btn" onClick={() => exportBasket('ris')} disabled={!basket.papers.length} data-action="audit-ris">
                  <Download size={14} /> RIS
                </button>
              </div>
              <p className="la-note">{t('audit.export.note')}</p>
            </div>
          </section>

          {setup && (
            <section className="la-card" aria-label={t('audit.layout.title')}>
              <div className="la-card__head"><h2>{t('audit.layout.title')}</h2></div>
              <dl className="au-layout">
                <dt>{t('audit.layout.page')}</dt>
                <dd>{PAGE_SIZES[setup.size]?.label || setup.size}{setup.landscape ? ` · ${t('workspace.landscape')}` : ''}</dd>
                <dt>{t('audit.layout.margins')}</dt>
                <dd>{t(`workspace.margin.${setup.margin}`)}</dd>
                <dt>{t('audit.layout.font')}</dt>
                <dd>{setup.font} · {setup.fontSize} pt</dd>
              </dl>
              <p className="la-note au-limits">{t('audit.layout.note')}</p>
            </section>
          )}

          {retractionLoading && <p className="la-note">{t('audit.retractionChecking')}</p>}
        </aside>
      </div>
    </div>
  );
}
