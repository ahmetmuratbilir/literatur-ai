import { motion } from 'framer-motion';
const MotionDiv = motion.div;
import { Database, Zap, ShieldCheck, Activity, Info } from 'lucide-react';

const GlobalStats = ({ totalFound, analyzed, quota, sourceBreakdown, totalFromAPIs, failedSources = [] }) => {
  const scopusQuota = quota?.scopus || quota;

  const fmt = (n) => (n != null ? Number(n).toLocaleString('tr-TR') : '—');

  const failed = (n) => failedSources.includes(n) ? 'Hata' : 'Aktif';
  const sources = [
    { name: 'Scopus', color: '#4f46e5', status: failed('Scopus'), count: totalFromAPIs?.scopus },
    { name: 'OpenAlex', color: '#0ea5e9', status: failed('OpenAlex'), count: totalFromAPIs?.openalex },
    { name: 'CORE', color: '#8b5cf6', status: failed('CORE'), count: totalFromAPIs?.core },
    { name: 'Crossref', color: '#f43f5e', status: failed('Crossref'), count: totalFromAPIs?.crossref },
    { name: 'S. Scholar', color: '#0891b2', status: failed('SemanticScholar'), count: totalFromAPIs?.s2 },
    { name: 'ArXiv', color: '#10b981', status: failed('ArXiv'), count: totalFromAPIs?.arxiv },
    { name: 'DOAJ', color: '#f59e0b', status: failed('DOAJ'), count: totalFromAPIs?.doaj },
  ];

  const Metric = ({ icon, iconBg, iconColor, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
      <div style={{ background: iconBg, color: iconColor, width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--fs-xs)', fontWeight: '500', color: 'var(--text-muted)' }}>{label}</p>
        <h4 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</h4>
      </div>
    </div>
  );

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
          <Metric icon={<Zap size={18} />} iconBg="#fffbeb" iconColor="#d97706" label="Sistem durumu" value="Aktif" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          {scopusQuota && (
            <span className="badge badge-info">
              <Info size={11} />
              Kota: {scopusQuota.remaining} / {scopusQuota.limit}
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
          const isError = src.status === 'Hata';
          return (
            <MotionDiv
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              style={{
                padding: '10px 12px',
                background: 'var(--bg-card)',
                border: `1px solid ${isError ? '#fecaca' : 'var(--border-light)'}`,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minHeight: '60px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: isError ? '#ef4444' : src.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{src.name}</span>
                </span>
              </div>

              {src.count != null ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: '700', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{fmt(src.count)}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: '500', color: 'var(--text-muted)' }}>toplam</span>
                </div>
              ) : (
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: '500', color: 'var(--text-light)' }}>{isError ? 'Hata' : 'Bekleniyor…'}</span>
              )}
            </MotionDiv>
          );
        })}
      </div>
    </div>
  );
};

export default GlobalStats;
