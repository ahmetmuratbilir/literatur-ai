import { motion } from 'framer-motion';
import { Activity, BarChart, Database, Zap } from 'lucide-react';

const MotionDiv = motion.div;

const GlobalStats = ({ totalFound, analyzed, quota }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  const stats = [
    {
      label: 'Bulunan Makale',
      value: totalFound?.toLocaleString() || '0',
      icon: <Database size={24} />,
      color: 'var(--brand-primary)',
    },
    {
      label: 'Analiz Edilen',
      value: analyzed?.toLocaleString() || '0',
      icon: <BarChart size={24} />,
      color: 'var(--brand-secondary)',
    },
    {
      label: 'API KALAN KOTA',
      value:
        quota?.remaining !== undefined
          ? `${quota.remaining.toLocaleString()} / ${quota.limit?.toLocaleString() || '20.000'}`
          : 'Veri bekleniyor...',
      icon: <Zap size={24} />,
      color:
        quota?.remaining === undefined
          ? '#64748b'
          : Number.parseInt(quota.remaining, 10) > 100
            ? '#059669'
            : '#dc2626',
      progress: quota?.limit ? (quota.remaining / quota.limit) * 100 : 0,
    },
    {
      label: 'Sıfırlanma Tarihi',
      value: quota?.reset && quota.reset !== 'Bilinmiyor' ? quota.reset.split(',')[0] : 'Bekleniyor...',
      icon: <Activity size={24} />,
      color: '#6366f1',
      subValue: quota?.reset?.includes(',') ? quota.reset.split(',')[1] : 'Güncellenecek',
    },
  ];

  return (
    <MotionDiv variants={containerVariants} initial="hidden" animate="show" className="stats-grid">
      {stats.map((stat, index) => (
        <MotionDiv key={index} variants={itemVariants} className="stat-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              className="stat-icon"
              style={{
                background: `${stat.color}15`,
                color: stat.color,
                padding: '0.75rem',
                borderRadius: '12px',
                display: 'flex',
              }}
            >
              {stat.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {stat.label}
              </p>
              <h3
                style={{
                  margin: '0.15rem 0 0 0',
                  fontSize: stat.label.includes('API') ? '1.15rem' : '1.4rem',
                  fontWeight: '900',
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {stat.value}
              </h3>
              {stat.subValue && (
                <p
                  style={{
                    margin: '0.15rem 0 0 0',
                    fontSize: '0.7rem',
                    color: 'var(--text-light)',
                    fontWeight: '600',
                  }}
                >
                  {stat.subValue}
                </p>
              )}
              {stat.progress !== undefined && (
                <div style={{ marginTop: '0.5rem', width: '100%' }}>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.progress}%` }}
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
  );
};

export default GlobalStats;
