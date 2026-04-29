import { motion } from 'framer-motion';
import { BarChart, Database, Zap, AlertTriangle } from 'lucide-react';

const MotionDiv = motion.div;

const GlobalStats = ({ totalFound, analyzed, quota, totalFromAPIs, sourceBreakdown, failedSources = [] }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  const isNested = quota && quota.scopus;
  const scopusQuota   = isNested ? quota.scopus   : quota;
  const openalexQuota = isNested ? quota.openalex : null;
  const coreQuota     = isNested ? quota.core     : null;

  // Kaynak bazlı toplam havuz sayıları
  const scopusTotal   = totalFromAPIs?.scopus   ?? null;
  const openalexTotal = totalFromAPIs?.openalex ?? null;
  const coreTotal     = totalFromAPIs?.core     ?? null;

  // Kaynak bazlı çekilen adet
  const scopusFetched   = sourceBreakdown?.scopus   ?? null;
  const openalexFetched = sourceBreakdown?.openalex ?? null;
  const coreFetched     = sourceBreakdown?.core     ?? null;

  const fmt = (n) => (n != null ? Number(n).toLocaleString('tr-TR') : '—');

  const stats = [
    // ── Scopus ──────────────────────────────────────────────────────
    {
      label: 'SCOPUS',
      value: scopusTotal != null ? `${fmt(scopusTotal)} makale` : 'Bilinmiyor',
      subLine: scopusFetched != null ? `Analiz için çekildi: ${fmt(scopusFetched)}` : '',
      icon: <Database size={22} />,
      color: failedSources.includes('Scopus') ? '#dc2626' : '#4f46e5',
      failed: failedSources.includes('Scopus'),
      quotaLine:
        scopusQuota?.remaining !== undefined
          ? `Kota: ${Number(scopusQuota.remaining).toLocaleString()} / ${Number(scopusQuota.limit || 20000).toLocaleString()}`
          : '',
      resetLine:
        scopusQuota?.reset && scopusQuota.reset !== 'Bilinmiyor'
          ? `Sıfırlanma: ${scopusQuota.reset}`
          : '',
      progress: scopusQuota?.limit
        ? (Number(scopusQuota.remaining) / Number(scopusQuota.limit)) * 100
        : 0,
    },
    // ── OpenAlex ────────────────────────────────────────────────────
    {
      label: 'OPENALEX',
      value: openalexTotal != null ? `${fmt(openalexTotal)} makale` : 'Ücretsiz Havuz',
      subLine: openalexFetched != null ? `Analiz için çekildi: ${fmt(openalexFetched)}` : '',
      icon: <Database size={22} />,
      color: failedSources.includes('OpenAlex') ? '#dc2626' : '#0ea5e9',
      failed: failedSources.includes('OpenAlex'),
      quotaLine: openalexQuota?.remaining !== undefined
        ? `Kota: ${Number(openalexQuota.remaining).toLocaleString()} / ${Number(openalexQuota.limit || 1000).toLocaleString()}`
        : '',
      resetLine: openalexQuota?.reset && openalexQuota.reset !== 'Bilinmiyor'
        ? `Sıfırlanma: ${openalexQuota.reset}` : '',
      progress: openalexQuota?.limit
        ? (Number(openalexQuota.remaining) / Number(openalexQuota.limit)) * 100
        : 100,
    },
    // ── CORE ────────────────────────────────────────────────────────
    {
      label: 'CORE',
      value: coreTotal != null ? `${fmt(coreTotal)} makale` : 'Bilinmiyor',
      subLine: coreFetched != null ? `Analiz için çekildi: ${fmt(coreFetched)}` : '',
      icon: <Database size={22} />,
      color: failedSources.includes('CORE') ? '#dc2626' : '#8b5cf6',
      failed: failedSources.includes('CORE'),
      quotaLine: coreQuota?.remaining !== undefined
        ? `Kota: ${Number(coreQuota.remaining).toLocaleString()} / ${Number(coreQuota.limit || 5000).toLocaleString()}`
        : 'Günlük 5.000 İstek',
      resetLine: coreQuota?.reset && coreQuota.reset !== 'Bilinmiyor'
        ? `Sıfırlanma: ${coreQuota.reset}` : '',
      progress: coreQuota?.limit
        ? (Number(coreQuota.remaining) / Number(coreQuota.limit)) * 100
        : 100,
    },
    // ── AHP Sonucu ──────────────────────────────────────────────────
    {
      label: 'AHP ANALİZİ',
      value: `${fmt(analyzed)} analiz`,
      subLine: `En iyi ${fmt(totalFound)} benzersiz kayıt`,
      icon: <BarChart size={22} />,
      color: '#059669',
      failed: false,
      quotaLine: '',
      resetLine: '',
      progress: 0,
    },
  ];

  return (
    <>
      {failedSources.length > 0 && (
        <MotionDiv
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.9rem 1.25rem',
            borderRadius: '12px',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#92400e',
          }}
        >
          <AlertTriangle size={18} color="#f59e0b" />
          <span>
            <strong>{failedSources.join(', ')}</strong> kaynağından veri alınamadı. Diğer kaynaklardan gelen sonuçlar gösteriliyor.
          </span>
        </MotionDiv>
      )}

      <MotionDiv variants={containerVariants} initial="hidden" animate="show" className="stats-grid">
        {stats.map((stat, index) => (
          <MotionDiv
            key={index}
            variants={itemVariants}
            className="stat-card"
            style={{
              padding: '1.25rem',
              border: stat.failed ? '1.5px solid #fca5a5' : undefined,
              opacity: stat.failed ? 0.7 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div
                className="stat-icon"
                style={{
                  background: `${stat.color}18`,
                  color: stat.color,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  display: 'flex',
                  flexShrink: 0,
                }}
              >
                {stat.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  color: stat.failed ? '#dc2626' : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  {stat.label} {stat.failed && '⚠ Hata'}
                </p>
                <h3 style={{
                  margin: '0.2rem 0 0 0',
                  fontSize: '1.15rem',
                  fontWeight: '900',
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {stat.value}
                </h3>
                {stat.subLine && (
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: stat.color, fontWeight: '700' }}>
                    {stat.subLine}
                  </p>
                )}
                {stat.quotaLine && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    {stat.quotaLine}
                  </p>
                )}
                {stat.resetLine && (
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.65rem', color: 'var(--text-light)', fontWeight: '600' }}>
                    {stat.resetLine}
                  </p>
                )}
                {stat.progress > 0 && (
                  <div style={{ marginTop: '0.5rem', width: '100%' }}>
                    <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(stat.progress, 100)}%` }}
                        style={{ height: '100%', background: stat.color, borderRadius: '3px' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </MotionDiv>
        ))}
      </MotionDiv>
    </>
  );
};

export default GlobalStats;
