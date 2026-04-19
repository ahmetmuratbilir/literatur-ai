import React from 'react';
import { Database, Search, Activity, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const GlobalStats = ({ totalFound, analyzed, quota }) => {
  // Kota yüzdesini hesapla
  const remaining = quota?.remaining !== undefined && quota.remaining !== "undefined" ? parseInt(quota.remaining) : 0;
  const limit = quota?.limit !== undefined && quota.limit !== "undefined" ? parseInt(quota.limit) : 20000;
  const percentage = limit > 0 ? (remaining / limit) * 100 : 0;

  const stats = [
    { 
      label: 'Bulunan Makale', 
      value: totalFound?.toLocaleString() || '0', 
      icon: <Database size={24} />, 
      color: '#6366f1',
      bg: '#eef2ff'
    },
    { 
      label: 'Analiz Edilen', 
      value: analyzed?.toLocaleString() || '0', 
      icon: <Search size={24} />, 
      color: '#8b5cf6',
      bg: '#f5f3ff'
    },
    { 
      label: 'API Kalan Kota', 
      value: quota?.remaining !== "undefined" ? `${remaining.toLocaleString()} / ${limit.toLocaleString()}` : '0 / 20.000', 
      icon: <Activity size={24} />, 
      color: '#f59e0b',
      bg: '#fffbeb',
      isQuota: true
    },
    { 
      label: 'Kota Yenilenme', 
      value: (quota?.reset && quota.reset !== "Bilinmiyor") ? quota.reset : 'Sistem Bekleniyor...', 
      icon: <Clock size={24} />, 
      color: '#10b981',
      bg: '#ecfdf5'
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1rem' }}>
      {stats.map((stat, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="stat-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ 
              background: stat.bg, 
              color: stat.color, 
              padding: '1.25rem', 
              borderRadius: '18px',
              display: 'flex'
            }}>
              {stat.icon}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {stat.label}
              </p>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {stat.value}
              </h3>
            </div>
          </div>
          
          {stat.isQuota && (
            <div style={{ marginTop: '0.25rem' }}>
              <div className="progress-bar-bg">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  className="progress-bar-fill"
                  style={{ 
                    background: percentage < 20 ? '#ef4444' : 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)' 
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Kapasite Durumu</span>
                <span style={{ fontSize: '0.75rem', color: stat.color, fontWeight: '800' }}>%{percentage.toFixed(1)}</span>
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default GlobalStats;
