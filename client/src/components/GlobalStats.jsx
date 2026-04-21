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
      label: 'Kalan API Kotası',
      value: quota?.remaining !== undefined ? quota.remaining.toLocaleString() : 'Veri bekleniyor...',
      icon: <Zap size={24} />,
      color: quota?.remaining === undefined ? '#64748b' : (parseInt(quota.remaining) > 100 ? '#059669' : '#dc2626'),
      subValue: quota?.limit ? `Limit: ${quota.limit.toLocaleString()}` : 'Bağlantı kuruluyor',
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
    <MotionDiv
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="stats-grid"
    >
      {stats.map((stat, index) => (
        <MotionDiv key={index} variants={itemVariants} className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              className="stat-icon"
              style={{
                background: `${stat.color}15`,
                color: stat.color,
                padding: '1rem',
                borderRadius: '16px',
                display: 'flex',
              }}
            >
              {stat.icon}
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em',
                }}
              >
                {stat.label}
              </p>
              <h3
                style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '1.5rem',
                  fontWeight: '900',
                  color: 'var(--text-main)',
                }}
              >
                {stat.value}
              </h3>
              {stat.subValue && (
                <p
                  style={{
                    margin: '0.25rem 0 0 0',
                    fontSize: '0.75rem',
                    color: 'var(--text-light)',
                    fontWeight: '600',
                  }}
                >
                  {stat.subValue}
                </p>
              )}
            </div>
          </div>
        </MotionDiv>
      ))}
    </MotionDiv>
  );
};

export default GlobalStats;
