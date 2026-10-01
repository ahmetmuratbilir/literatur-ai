import { useCallback, useEffect, useState } from 'react';
import MethodologyModal from './MethodologyModal.jsx';
import { useI18n } from '../i18n/context.js';

/**
 * Sıralama profili seçici.
 *
 * Kapalı profiller gizlenmiyor, sebebiyle birlikte silik gösteriliyor:
 * düğmeyi gizlemek kullanıcıya özelliğin var olmadığını söyler, sebebini
 * yazmak ne zaman geleceğini söyler. Profil listesi (adlar dahil) sunucudan
 * geliyor; tek kaynak ahpProfiles.js + serverI18n.js. Dil değişince yeniden
 * çekilir.
 */
const RankingProfiles = ({ apiUrl, value, onChange, disabled, warnings }) => {
  const { t, lang } = useI18n();
  const [profiles, setProfiles] = useState(null);
  const [showMethodology, setShowMethodology] = useState(false);
  // Sabit referans: MethodologyModal bunu useEffect bağımlılığı olarak kullanıyor.
  const closeMethodology = useCallback(() => setShowMethodology(false), []);

  useEffect(() => {
    let alive = true;
    fetch(`${apiUrl}/api/ranking/profiles`, { headers: { 'Accept-Language': lang } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && Array.isArray(d?.profiles)) setProfiles(d.profiles); })
      .catch(() => { /* Uç yoksa seçici görünmez; arama varsayılanla çalışır. */ });
    return () => { alive = false; };
  }, [apiUrl, lang]);

  if (!profiles) return null;

  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: 'var(--space-2)' }}>
        <div id="ranking-profile-label" className="ui-section-label">{t('ranking.label')}</div>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" style={{ color: 'var(--brand-primary)', height: '24px' }}
          onClick={() => setShowMethodology(true)}>
          {t('ranking.how')}
        </button>
      </div>
      {showMethodology && <MethodologyModal apiUrl={apiUrl} onClose={closeMethodology} />}
      <div
        role="radiogroup"
        aria-labelledby="ranking-profile-label"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(max(170px, calc((100% - 1rem) / 3)), 1fr))', gap: 'var(--space-2)' }}
      >
        {profiles.map((p) => {
          const selected = p.id === value;
          const unavailable = !p.available;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={unavailable || disabled}
              disabled={unavailable || disabled}
              onClick={() => !selected && onChange(p.id)}
              title={unavailable ? p.unavailableReason : p.description}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border-light)'}`,
                boxShadow: selected ? 'inset 0 0 0 1px var(--brand-primary)' : 'none',
                background: selected ? 'var(--brand-primary-soft)' : 'var(--bg-card)', color: 'var(--text-main)',
                cursor: unavailable || disabled ? 'not-allowed' : 'pointer',
                opacity: unavailable ? 0.55 : 1, fontFamily: 'inherit',
                display: 'grid', gap: '3px', alignContent: 'start',
                transition: 'border-color 0.15s ease, background 0.15s ease',
              }}
            >
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>{p.label}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                {unavailable ? p.unavailableReason : p.description}
              </span>
            </button>
          );
        })}
      </div>
      {Array.isArray(warnings) && warnings.length > 0 && (
        <div role="status" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--fs-xs)', color: 'var(--score-med)' }}>
          {warnings.join(' ')}
        </div>
      )}
    </div>
  );
};

export default RankingProfiles;
