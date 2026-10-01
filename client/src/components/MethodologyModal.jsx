import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

/**
 * Sıralama metodolojisi künyesi — kullanıcı ve jüri için.
 *
 * Sayılar sunucudan geliyor (/api/ranking/profiles → methodology); burada elle
 * yazılmış ağırlık ya da CR yok. Metin kodun gerçekten yaptığını anlatmalı:
 * sabit bir metin kod değiştiğinde yalan söylemeye başlar.
 */
const th = { textAlign: 'left', padding: '6px 8px', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const td = { padding: '7px 8px', borderBottom: '1px solid var(--border-light)', verticalAlign: 'top', fontSize: 'var(--fs-sm)' };

const MethodologyModal = ({ apiUrl, onClose }) => {
  const { t, lang } = useI18n();
  const [info, setInfo] = useState(null);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef(null);
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const pct = (v) => `${(v * 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const num = (v, d = 4) => Number(v).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    fetch(`${apiUrl}/api/ranking/profiles`, { headers: { 'Accept-Language': lang } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo)
      .catch(() => setFailed(true));
    return () => window.removeEventListener('keydown', onKey);
  }, [apiUrl, onClose, lang]);

  const m = info?.methodology;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'grid', placeItems: 'center', padding: '16px' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-title"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(760px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)',
          borderRadius: 'var(--radius-lg)', padding: '20px 22px', display: 'grid', gap: '16px', lineHeight: 1.55, boxShadow: 'var(--shadow-lg)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
          <h2 id="methodology-title" style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>{t('method.title')}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('common.close')} className="ui-btn ui-btn--ghost ui-btn--icon">
            <X size={20} />
          </button>
        </div>

        {failed && <p style={{ margin: 0, color: 'var(--score-low)' }}>{t('method.failed')}</p>}
        {!m && !failed && <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('common.loading')}</p>}

        {m && (
          <>
            <p style={{ margin: 0 }}>
              {t('method.intro1')} <strong>{t('method.ahp')}</strong> {t('method.intro2')}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '520px' }}>
                <thead><tr><th style={th}>{t('method.colCriterion')}</th><th style={{ ...th, textAlign: 'right' }}>{t('method.colWeight')}</th><th style={th}>{t('method.colHow')}</th></tr></thead>
                <tbody>
                  {[...m.criteria].sort((a, b) => m.weights[b] - m.weights[a]).map((c) => (
                    <tr key={c}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{t(`criteria.${c}`)}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(m.weights[c])}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{t(`method.how.${c}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section style={{ display: 'grid', gap: '6px' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--fs-md)' }}>{t('method.methodTitle')}</h3>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '4px' }}>
                <li><strong>{t('method.scale')}</strong> {t('method.scaleText')} (a<sub>ji</sub> = 1 / a<sub>ij</sub>)</li>
                <li><strong>{t('method.weightsLabel')}</strong> {t('method.weightsText')}</li>
                <li><strong>{t('method.incompleteLabel')}</strong> {t('method.incompleteText')}</li>
                <li><strong>{t('method.crossLabel')}</strong> {t('method.crossText')}</li>
                <li>
                  <strong>{t('method.consistencyLabel')}</strong> λ<sub>max</sub> = {num(m.lambdaMax, 5)}, CI = {num(m.consistencyIndex, 5)},
                  RI = {num(m.randomIndex, 2)}, <strong>CR = {num(m.consistencyRatio)}</strong> (≤ {num(m.consistencyThreshold, 2)}).
                </li>
              </ul>
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{t('method.crCaveat')}</p>
            </section>

            <section style={{ display: 'grid', gap: '6px' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--fs-md)' }}>{t('method.profilesTitle')}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '620px' }}>
                  <thead>
                    <tr>
                      <th style={th}>{t('method.colProfile')}</th>
                      {m.criteria.map((c) => <th key={c} style={{ ...th, textAlign: 'right' }}>{t(`criteria.${c}`)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {info.profiles.map((p) => (
                      <tr key={p.id} style={{ opacity: p.available ? 1 : 0.6 }}>
                        <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.label}{!p.available && t('method.off')}</td>
                        {m.criteria.map((c) => (
                          <td key={c} style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(p.weights[c], 2)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={{ display: 'grid', gap: '6px' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--fs-md)' }}>{t('method.rulesTitle')}</h3>
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-main)' }}>{t('method.missingRule')}</strong> {t('method.missingText')} {t('method.capText')}
              </p>
            </section>

            <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              {t('method.references')} Saaty, T. L. (1980). <em>The Analytic Hierarchy Process</em>. McGraw-Hill. ·
              Harker, P. T. (1987). Incomplete pairwise comparisons in the analytic hierarchy process.
              <em> Mathematical Modelling</em>, 9(11), 837–848.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default MethodologyModal;
