import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, FileText, User as UserIcon, ExternalLink, ChevronDown, ChevronUp, Quote, Star, Check, AlertCircle, Loader2, AlertTriangle, BookOpen, BookmarkPlus, BookmarkCheck, Copy, Search } from 'lucide-react';
import { getYearDisplay } from '../utils/yearDisplay.js';
import { toBibTeX } from '../utils/citationExport.js';
import RankBreakdown from './RankBreakdown.jsx';
import { useI18n } from '../i18n/context.js';

const MotionDiv = motion.div;

const TIER_CHIP = { Q1: 'ui-chip--ok', Q2: 'ui-chip--brand', Q3: 'ui-chip--warn', Q4: '' };

const ResultCard = ({ item, rank, onFavorite, isFavorited, isSelected, onToggleSelect, appliedWeights, oaEnabled = false, onFindPdf, onOpenReader, onFindSimilar }) => {
  const { t, lang } = useI18n();
  // Unpaywall: 'idle' | 'loading' | { found, pdfUrl, landingUrl, version } | 'error'
  const [pdfState, setPdfState] = useState('idle');
  const [expanded, setExpanded] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [favFeedback, setFavFeedback] = useState(null); // 'added' | 'removed' | 'error'
  const [bibtexCopied, setBibtexCopied] = useState(false);

  // Favori geri bildirimini temizle
  useEffect(() => {
    if (!favFeedback) return;
    const timer = setTimeout(() => setFavFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, [favFeedback]);

  // TUM hook cagrilari bu satirin uzerinde kalmali. Bu erken donus daha once
  // iki useEffect'in ONUNDEYDI: item tanimsiz gelen tek bir kayit, o karti
  // eksik hook ile render ettiriyor ve React'in hook sirasini bozuyordu.
  if (!item) return null;

  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const scorePercent = Math.round((item.scores?.total || 0) * 100);
  const scoreClass = scorePercent >= 80 ? 'ui-score--high' : (scorePercent >= 50 ? 'ui-score--med' : 'ui-score--low');
  const citations = Number(item.citedBy || item.citedbyCount || 0);

  const author = item.creator || (Array.isArray(item.authors) ? item.authors.join(', ') : item.authors) || t('card.unknownAuthor');
  // Sonuç dili TR iken yalnızca başlık çevrilir; özet her zaman özgün dilde.
  const summary = typeof item.description === 'string' ? item.description.trim() : '';
  const canExpandSummary = summary.length > 180;
  const yearDisplay = getYearDisplay(item, t);
  const sources = Array.isArray(item.sourceList) && item.sourceList.length ? item.sourceList : (item.source ? [item.source] : []);

  const tier = (() => {
    if (item.sourceType === 'Preprint') return { text: t('card.preprint'), cls: 'ui-chip--rose' };
    if (item.sourceType === 'Conference') return { text: t('card.conference'), cls: 'ui-chip--violet' };
    if (TIER_CHIP[item.quartile] !== undefined) {
      return { text: `${item.quartile}${item.sjr ? ` · SJR ${Number(item.sjr).toFixed(2)}` : ''}`, cls: TIER_CHIP[item.quartile], title: t('card.tierTitle', { q: item.quartile }) };
    }
    return null;
  })();

  const handleFavClick = async (e) => {
    e.stopPropagation();
    if (favLoading) return;
    setFavLoading(true);
    try {
      await onFavorite(item);
      setFavFeedback(isFavorited ? 'removed' : 'added');
    } catch {
      setFavFeedback('error');
    } finally {
      setFavLoading(false);
    }
  };

  const favTitle = favFeedback === 'error' ? t('card.fav.failed')
    : favFeedback === 'added' ? t('card.fav.added')
      : favFeedback === 'removed' ? t('card.fav.removed')
        : isFavorited ? t('card.fav.remove') : t('card.fav.add');

  const retraction = item.retraction?.status === 'retracted' || item.retraction?.status === 'concern' ? item.retraction : null;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`ui-card${isSelected ? ' ui-card--selected' : ''}`}
    >
      <div className="ui-card__head">
        <span className={`ui-rank${rank <= 3 ? ' ui-rank--top' : ''}`} title={t('card.rank', { n: rank })}>{rank}</span>
        <h3 className="ui-card__title">{item.titleTR || item.title || t('card.untitled')}</h3>
        <span className={`ui-score ${scoreClass}`} title={t('card.score', { n: scorePercent })}>{t('card.scoreShort', { n: scorePercent })}</span>
      </div>

      {retraction && (() => {
        // Geri çekme bilgisi rozet değil şerit: küçük bir rozet bu kadar
        // önemli bir bilgi için fazla kolay gözden kaçar.
        const retracted = retraction.status === 'retracted';
        const notice = retraction.notices?.find((n) => n.type === (retracted ? 'retraction' : 'expression_of_concern')) || retraction.notices?.[0];
        const year = notice?.date ? notice.date.slice(0, 4) : null;
        return (
          <div role="alert" className={`ui-notice ${retracted ? 'ui-notice--error' : 'ui-notice--warn'}`} style={{ marginTop: 'var(--space-3)' }}>
            <AlertTriangle size={16} />
            <span>
              <strong>{retracted ? t('card.retractedTitle') : t('card.concernTitle')}</strong>
              {year ? ` (${year})` : ''}. {retracted ? t('card.retractedText') : t('card.concernText')}
              {notice?.doi && (
                <> <a href={`https://doi.org/${notice.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>{t('card.openNotice')}</a></>
              )}
            </span>
          </div>
        );
      })()}

      <div className="ui-meta">
        <span className="ui-meta__item" style={{ minWidth: 0, maxWidth: '100%' }}>
          <UserIcon size={13} /> <span className="ui-meta__ellipsis" style={{ maxWidth: 'min(360px, 100%)' }}>{author}</span>
        </span>
        <span className="ui-meta__item" title={yearDisplay.title}>
          <Calendar size={13} /> {yearDisplay.label}
          {yearDisplay.showWarning && <span className="ui-chip ui-chip--warn" style={{ marginLeft: '2px' }}>{t('card.year.unverified')}</span>}
        </span>
        {item.publicationName && (
          <span className="ui-meta__item" title={item.publicationName}>
            <BookOpen size={13} /> <span className="ui-meta__ellipsis">{item.publicationName}</span>
          </span>
        )}
        <span className="ui-meta__item" title={t('card.citationsTitle')}>
          <Quote size={13} /> {t('card.citations', { n: citations.toLocaleString(locale) })}
        </span>
      </div>

      {(tier || item.isInDoaj === true || sources.length > 0) && (
        <div className="ui-chips">
          {tier && <span className={`ui-chip ${tier.cls}`} title={tier.title}>{tier.text}</span>}
          {item.isInDoaj === true && (
            // Yalnızca metin: DOAJ adı/logosu yazılı izin olmadan rozet olarak
            // kullanılamaz. "DOAJ'da değil" demek yanıltıcı olur (kapalı
            // erişimli saygın dergiler de DOAJ'da yok), o yüzden yalnız olumlu.
            <span className="ui-chip ui-chip--ok" title={t('card.doajTitle')}><Check size={11} strokeWidth={3} /> {t('card.doaj')}</span>
          )}
          {sources.map((s) => <span key={s} className="ui-chip">{s}</span>)}
        </div>
      )}

      <p className={`ui-card__abstract${expanded ? '' : ' ui-card__abstract--clamp'}`}>
        {summary || t('card.noAbstract')}
      </p>

      <RankBreakdown item={item} appliedWeights={appliedWeights} />

      <div className="ui-card__foot">
        <div className="ui-card__actions">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect(e.currentTarget); }}
            className={`ui-btn ui-btn--sm ${isSelected ? 'ui-btn--primary' : 'ui-btn--outline'}`}
            aria-pressed={isSelected}
            title={isSelected ? t('card.removeFromBasket') : undefined}
          >
            {isSelected ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
            {isSelected ? t('card.added') : t('card.add')}
          </button>

          {canExpandSummary && (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? t('card.showLess') : t('card.showAbstract')}
            </button>
          )}

          {/* Arama sırasında bulunmuş yasal PDF (Europe PMC veya ilk sonuçlar için Unpaywall) */}
          {item.pdfUrl && (
            <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn--ghost ui-btn--sm ui-link-btn ui-link-btn--ok">
              <FileText size={14} /> {t('card.freePdf')}
            </a>
          )}

          {!item.pdfUrl && oaEnabled && item.doi && onFindPdf && (() => {
            if (pdfState && typeof pdfState === 'object') {
              if (!pdfState.found) {
                return <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', paddingInline: '6px' }}>{t('card.noFreeCopy')}</span>;
              }
              // PDF barındırılmaz; yalnızca yönlendirilir. Sürüm atıf açısından önemli.
              const version = pdfState.version ? t(`card.version.${pdfState.version}`) : null;
              return (
                <a href={pdfState.pdfUrl || pdfState.landingUrl} target="_blank" rel="noopener noreferrer"
                  className="ui-btn ui-btn--ghost ui-btn--sm ui-link-btn ui-link-btn--ok"
                  title={version ? t('card.thisCopy', { v: version }) : undefined}>
                  <FileText size={14} /> {pdfState.pdfUrl ? t('card.freePdf') : t('card.freeFulltext')}{version ? ` · ${version}` : ''}
                </a>
              );
            }
            return (
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm ui-link-btn--ok"
                disabled={pdfState === 'loading'}
                onClick={async () => {
                  setPdfState('loading');
                  try { setPdfState(await onFindPdf(item.doi)); } catch { setPdfState('error'); }
                }}
              >
                {pdfState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {pdfState === 'error' ? t('common.retry') : t('card.findPdf')}
              </button>
            );
          })()}

          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn--ghost ui-btn--sm ui-link-btn">
              <ExternalLink size={14} /> {t('card.open')}
            </a>
          )}

          {onOpenReader && (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => onOpenReader(item)}>
              <BookOpen size={14} /> {t('card.details')}
            </button>
          )}

          {onFindSimilar && (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => onFindSimilar(item)}>
              <Search size={14} /> {t('card.findSimilar')}
            </button>
          )}

          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            title={t('card.copyBibtexTitle')}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(toBibTeX([item]));
                setBibtexCopied(true);
                setTimeout(() => setBibtexCopied(false), 2000);
              } catch { /* pano izni yoksa sessizce geç */ }
            }}
          >
            {bibtexCopied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
            {bibtexCopied ? t('card.bibtexCopied') : 'BibTeX'}
          </button>
        </div>

        <div className="ui-card__actions">
          <button
            type="button"
            onClick={handleFavClick}
            disabled={favLoading}
            className="ui-btn ui-btn--ghost ui-icon-btn"
            aria-pressed={Boolean(isFavorited)}
            aria-label={favTitle}
            title={favTitle}
            style={favFeedback === 'error' ? { color: 'var(--score-low)' } : favFeedback ? { color: 'var(--score-high)' } : undefined}
          >
            {favLoading ? <Loader2 size={17} className="animate-spin" />
              : favFeedback === 'error' ? <AlertCircle size={17} />
                : favFeedback ? <Check size={17} strokeWidth={3} />
                  : <Star size={17} fill={isFavorited ? '#f59e0b' : 'none'} color={isFavorited ? '#f59e0b' : 'currentColor'} />}
          </button>
        </div>
      </div>
    </MotionDiv>
  );
};

export default ResultCard;
