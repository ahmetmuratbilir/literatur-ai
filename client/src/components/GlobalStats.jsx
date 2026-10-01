import { Database, Activity } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

/**
 * Arama özeti: kaynaklarda bulunan toplam makale ve AHP ile sıralanan aday.
 * Kaynak başına durum rozetleri kaldırıldı; kaynak durumu artık arama
 * bittiğinde bildirim olarak gösteriliyor (SourceToast).
 */
const Metric = ({ icon, iconBg, iconColor, label, value, hint }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
    <div style={{ background: iconBg, color: iconColor, width: '34px', height: '34px', borderRadius: '10px', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }} title={hint}>{value}</p>
    </div>
  </div>
);

const GlobalStats = ({ totalFound, analyzed }) => {
  const { t, lang } = useI18n();
  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');

  return (
    <div className="ui-panel" style={{ padding: 'var(--space-4) var(--space-5)', marginBottom: 'var(--space-4)', boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <Metric icon={<Database size={17} />} iconBg="var(--brand-primary-soft)" iconColor="var(--brand-primary)"
          label={t('stats.found')} value={t('stats.papers', { n: fmt(totalFound) })} hint={t('stats.foundHint')} />
        <Metric icon={<Activity size={17} />} iconBg="var(--score-high-bg)" iconColor="var(--score-high)"
          label={t('stats.ranked')} value={t('stats.papers', { n: fmt(analyzed) })} />
      </div>
    </div>
  );
};

export default GlobalStats;
