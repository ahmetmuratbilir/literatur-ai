import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { computeContributions, HAS_ZERO_REASON } from '../utils/rankBreakdown.js';
import { useI18n } from '../i18n/context.js';

/**
 * "Neden bu sırada?" — makalenin AHP skorunun kriter bazında dökümü.
 *
 * Katkı = uygulanan ağırlık × kriter skoru. İkisi de sunucudan geliyor
 * (item.scores ve methodology.appliedWeights); burada tahmin yapılmıyor.
 * Ağırlık kaynağı `appliedWeights`: kullanıcı profil seçtiyse matrisin
 * türettiği `weights`ten farklıdır.
 */
const RankBreakdown = ({ item, appliedWeights }) => {
  const { t, lang } = useI18n();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const [open, setOpen] = useState(false);
  const rows = computeContributions(item?.scores, appliedWeights);
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.contribution), 0.0001);
  const top = rows.slice(0, 4);
  const zeros = rows.filter((r) => r.score === 0 && r.weight > 0.02);
  const qBoost = item.scores?.qBoost || 0;
  const retracted = item.retraction?.status === 'retracted';
  // Atif puaninin hangi olcuyle hesaplandigi (sunucu: ahp.calculateCitationScore)
  const fwci = typeof item.fwci === 'number' ? item.fwci : null;
  const citationNote = item.citationBasis === 'field' && fwci != null
    ? [
        t('why.citeField', { x: fwci.toLocaleString(locale, { maximumFractionDigits: 1 }) }),
        item.topCitedPercent === 1 ? t('why.citeTop1') : item.topCitedPercent === 10 ? t('why.citeTop10') : null,
      ].filter(Boolean).join(' · ')
    : (item.citationBasis === 'perYear' ? t('why.citePerYear') : null);

  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="ui-btn ui-btn--ghost ui-btn--sm"
        style={{ paddingInline: '6px', marginLeft: '-6px' }}
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {t('why.toggle')}
      </button>

      {open && (
        <div style={{
          marginTop: '6px', padding: '10px 12px', display: 'grid', gap: '7px', maxWidth: '460px',
          border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-subtle)', fontSize: 'var(--fs-xs)',
        }}>
          {top.map((r) => (
            <div key={r.criterion} style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 128px) 1fr 48px', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-main)' }}>{t(`criteria.${r.criterion}`)}</span>
              <span style={{ height: '6px', background: 'var(--border-light)', borderRadius: '3px', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(r.contribution / max) * 100}%`, background: 'var(--brand-primary)' }} />
              </span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                +{r.contribution.toFixed(3)}
              </span>
            </div>
          ))}

          {citationNote && <div style={{ color: 'var(--text-muted)', lineHeight: 1.45 }}>{citationNote}</div>}
          {qBoost > 0 && <div style={{ color: 'var(--text-muted)' }}>{t('why.qBoost', { v: qBoost.toFixed(3) })}</div>}

          {(zeros.length > 0 || retracted) && (
            <div style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '6px', lineHeight: 1.45 }}>
              {retracted && <div>{t('why.retracted')}</div>}
              {zeros.map((z) => (
                <div key={z.criterion}>
                  {HAS_ZERO_REASON.has(z.criterion)
                    ? t('why.zeroWith', { label: t(`criteria.${z.criterion}`), reason: t(`why.reasons.${z.criterion}`) })
                    : t('why.zero', { label: t(`criteria.${z.criterion}`) })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RankBreakdown;
