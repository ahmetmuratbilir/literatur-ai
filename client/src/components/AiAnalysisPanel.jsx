import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

const MotionDiv = motion.div;

/** Yaklaşımın kavramları; eski kayıtlarda (kavram listesi yokken) Boolean sorgudan çıkarılır. */
function conceptsOf(query) {
  if (Array.isArray(query.keywords) && query.keywords.length > 0) return query.keywords;
  return String(query.text || '')
    .split(/\b(?:AND|OR|NOT)\b/)
    .map((part) => part.replace(/[()"]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * "AI ile geliştir" sonucu: hedef cümlesi ve satır satır arama yaklaşımları.
 *
 * Her satır bir yaklaşım; Boolean sorgu yerine kapsadığı kavramlar etiket
 * olarak görünür. Satıra tıklanınca arama arka planda o yaklaşımın Boolean
 * sorgusuyla yapılır (onPick); konu kutusu değişmez. Konunun çekirdek
 * kavramları (ağırlık 3) vurgulu etiketle gösterilir.
 */
const AiAnalysisPanel = forwardRef(({ analysis, onPick }, ref) => {
  const { t } = useI18n();
  const queries = Array.isArray(analysis.queries) ? analysis.queries : [];
  const coreConcepts = new Set(
    (Array.isArray(analysis.keywords) ? analysis.keywords : [])
      .filter((k) => k.weight >= 3)
      .flatMap((k) => [String(k.label).toLowerCase(), String(k.term).toLowerCase()])
  );

  return (
    <MotionDiv
      ref={ref}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="ui-panel ai-panel"
    >
      <div className="ai-panel__head">
        <Sparkles size={18} color="var(--brand-primary)" aria-hidden="true" />
        <h3 className="ai-panel__title">{t('ai.title')}</h3>
      </div>

      {analysis.intent && (
        <p className="ai-panel__intent">
          <span className="ai-panel__goal">{t('ai.goal')}</span> {analysis.intent}
        </p>
      )}

      <h4 className="ui-section-label ai-panel__label">{t('ai.suggested')}</h4>
      <div className="ai-rows">
        {queries.map((q, i) => (
          <button
            key={`${i}-${q.text}`}
            type="button"
            className="ai-row"
            onClick={() => onPick(q)}
            title={q.focus || q.label || undefined}
          >
            <span className="ai-row__concepts">
              {conceptsOf(q).map((c) => (
                <span key={c} className={`ai-row__concept${coreConcepts.has(String(c).toLowerCase()) ? ' ai-row__concept--core' : ''}`}>{c}</span>
              ))}
            </span>
            <span className="badge badge-info ai-row__score">%{q.relevanceScore}</span>
          </button>
        ))}
      </div>
    </MotionDiv>
  );
});

AiAnalysisPanel.displayName = 'AiAnalysisPanel';

export default AiAnalysisPanel;
