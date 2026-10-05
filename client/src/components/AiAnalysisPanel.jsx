import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Target, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

const MotionDiv = motion.div;

/** Eski kayıtlarda (etiket yokken) Boolean sorgudan okunabilir bir başlık çıkarır. */
function readableLabel(query) {
  if (query.label) return query.label;
  return String(query.text || '')
    .replace(/[()"]/g, ' ')
    .replace(/\b(AND|OR|NOT)\b/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/^( ·)+|( ·)+$/g, '')
    .trim();
}

/**
 * "AI ile geliştir" sonucu: niyet, anahtar kavram bulutu ve arama yaklaşımları.
 *
 * Boolean sorgu kullanıcıya gösterilmez; yaklaşım seçilince arama arka
 * planda o sorguyla yapılır (onPick). Kavram bulutunda büyüklük önemi
 * gösterir: 3 = konunun çekirdeği, 1 = yakın / geniş terim.
 */
const AiAnalysisPanel = forwardRef(({ analysis, onPick }, ref) => {
  const { t, lang } = useI18n();
  const keywords = Array.isArray(analysis.keywords) ? analysis.keywords : [];
  const queries = Array.isArray(analysis.queries) ? analysis.queries : [];
  // Yaklaşım kartındaki terimler İngilizce arama terimi; kullanıcıya bulutta
  // gördüğü dildeki karşılığıyla gösterilir.
  const labelOf = new Map(keywords.map((k) => [String(k.term).toLowerCase(), k.label]));
  const displayTerm = (term) => labelOf.get(String(term).toLowerCase()) || term;

  return (
    <MotionDiv
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ui-panel ai-panel"
    >
      <div className="ai-panel__head">
        <span className="ai-panel__icon" aria-hidden="true"><Sparkles size={16} /></span>
        <h3 className="ai-panel__title">{t('ai.title')}</h3>
      </div>

      {analysis.intent && (
        <p className="ai-panel__intent">
          <Target size={15} aria-hidden="true" />
          <span><strong>{t('ai.goal')}</strong> {analysis.intent}</span>
        </p>
      )}

      {keywords.length > 0 && (
        <section className="ai-panel__section" aria-labelledby="ai-keywords-label">
          <h4 id="ai-keywords-label" className="ui-section-label">{t('ai.keywords')}</h4>
          <ul className="ai-cloud">
            {keywords.map((k) => (
              <li
                key={k.term}
                className={`ai-cloud__term ai-cloud__term--w${k.weight}`}
                // Türkçe arayüzde aramada kullanılan İngilizce terim ipucunda görünür.
                title={lang !== 'en' && k.term !== k.label ? `${t('ai.searchedAs')}: ${k.term}` : undefined}
              >
                {k.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {queries.length > 0 && (
        <section className="ai-panel__section" aria-labelledby="ai-approaches-label">
          <h4 id="ai-approaches-label" className="ui-section-label">{t('ai.suggested')}</h4>
          <p className="ui-hint ai-panel__hint">{t('ai.pickHint')}</p>
          <div className="ai-approaches">
            {queries.map((q, i) => (
              <button key={`${i}-${q.text}`} type="button" className="ai-approach" onClick={() => onPick(q)}>
                <span className="ai-approach__top">
                  <span className="ai-approach__label">{readableLabel(q)}</span>
                  <span className="ui-chip ui-chip--brand" title={t('ai.matchTitle')}>{t('ai.match', { n: q.relevanceScore })}</span>
                </span>
                {q.focus && <span className="ai-approach__focus">{q.focus}</span>}
                {Array.isArray(q.keywords) && q.keywords.length > 0 && (
                  <span className="ai-approach__terms">
                    {q.keywords.slice(0, 4).map((term) => <span key={term} className="ui-chip">{displayTerm(term)}</span>)}
                  </span>
                )}
                <span className="ai-approach__go">{t('ai.searchThis')} <ArrowRight size={14} aria-hidden="true" /></span>
              </button>
            ))}
          </div>
        </section>
      )}
    </MotionDiv>
  );
});

AiAnalysisPanel.displayName = 'AiAnalysisPanel';

export default AiAnalysisPanel;
