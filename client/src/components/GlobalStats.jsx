import { motion } from 'framer-motion';
const MotionDiv = motion.div;
import { Database, Zap, ShieldCheck, Activity, Info } from 'lucide-react';

const fmt = (num) => Number(num || 0).toLocaleString('tr-TR');

const Metric = ({ icon, iconBg, iconColor, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
    <div style={{ background: iconBg, color: iconColor, width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 'var(--fs-xs)', fontWeight: '500', color: 'var(--text-muted)' }}>{label}</p>
      <h4 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</h4>
    </div>
  </div>
);

const GlobalStats = ({ totalFound, analyzed, quota, totalFromAPIs, failedSources = [] }) => {
  const getSourceStatus = (sourceName) => {
    // Backend can return strings (legacy) or objects (new)
    const failure = failedSources.find(f => 
      f === sourceName || 
      (typeof f === 'object' && (f.name === sourceName || f.source === sourceName))
    );
    
    if (!failure) return { label: 'Aktif', type: 'SUCCESS' };
    if (typeof failure === 'string') return { label: 'Hata', type: 'ERROR' };
    
    switch (failure.type) {
      case 'TIMEOUT': return { label: 'Yavaş / Atlandı', type: 'TIMEOUT' };
      case 'QUOTA': return { label: 'Kota Dolu', type: 'QUOTA' };
      default: return { label: 'Hata', type: 'ERROR' };
    }
  };

  const sources = [
    { name: 'Scopus', color: '#4f46e5', id: 'Scopus', countKey: 'scopus' },
    { name: 'OpenAlex', color: '#0ea5e9', id: 'OpenAlex', countKey: 'openalex' },
    { name: 'CORE', color: '#8b5cf6', id: 'CORE', countKey: 'core' },
    { name: 'Crossref', color: '#f43f5e', id: 'Crossref', countKey: 'crossref' },
    { name: 'S. Scholar', color: '#0891b2', id: 'SemanticScholar', countKey: 's2' },
    { name: 'ArXiv', color: '#10b981', id: 'ArXiv', countKey: 'arxiv' },
    { name: 'DOAJ', color: '#f59e0b', id: 'DOAJ', countKey: 'doaj' },
  ].map(src => ({
    ...src,
    ...getSourceStatus(src.id),
    count: totalFromAPIs?.[src.countKey]
  }));

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Üst Özet Bar */}
      <div className="stats-summary-bar" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        background: 'var(--bg-card)',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-xs)',
        marginBottom: '0.75rem'
      }}>
        <div className="stats-summary-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', flex: '1 1 320px', minWidth: 0 }}>
          <Metric icon={<Database size={18} />} iconBg="var(--brand-primary-soft)" iconColor="var(--brand-primary)" label="Literatür havuzu" value={`${fmt(totalFound)} kayıt`} />
          <Metric icon={<Activity size={18} />} iconBg="#ecfdf5" iconColor="#059669" label="AHP skorlanan" value={fmt(analyzed)} />
          <Metric icon={<Zap size={18} />} iconBg="#fffbeb" iconColor="#d97706" label="Sistem durumu" value={failedSources.length > 0 ? 'Kısmi Aktif' : 'Tam Aktif'} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          {quota?.scopus && (
            <span className="badge badge-info">
              <Info size={11} />
              Scopus: {quota.scopus.remaining} / {quota.scopus.limit}
            </span>
          )}
          <span className="badge badge-success">
            <ShieldCheck size={11} />
            Güven katmanı
          </span>
        </div>
      </div>

      {/* Kaynak Durum Barı */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.5rem',
        width: '100%'
      }}>
        {sources.map((src, i) => {
          const isError = src.type === 'ERROR';
          const isTimeout = src.type === 'TIMEOUT';
          const isQuota = src.type === 'QUOTA';
          
          let dotColor = src.color;
          let borderColor = 'var(--border-light)';
          
          if (isError) {
              dotColor = '#ef4444';
              borderColor = '#fecaca';
          } else if (isTimeout) {
              dotColor = '#f59e0b';
              borderColor = '#fef3c7';
          } else if (isQuota) {
              dotColor = '#6366f1';
              borderColor = '#e0e7ff';
          }

          return (
            <MotionDiv
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              style={{
                padding: '10px 12px',
                background: 'var(--bg-card)',
                border: `1px solid ${borderColor}`,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minHeight: '60px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: dotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{src.name}</span>
                </span>
              </div>

              {src.count != null ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: '700', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{fmt(src.count)}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: '500', color: 'var(--text-muted)' }}>toplam</span>
                </div>
              ) : (
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: '500', color: isError || isTimeout || isQuota ? dotColor : 'var(--text-light)' }}>
                  {src.label}
                </span>
              )}
            </MotionDiv>
          );
        })}
      </div>
    </div>
  );
};

export default GlobalStats;
