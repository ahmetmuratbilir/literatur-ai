import { motion } from 'framer-motion';
const MotionDiv = motion.div;
import { BarChart, Database, Zap, AlertTriangle, ShieldCheck, Activity, Info } from 'lucide-react';

const GlobalStats = ({ totalFound, analyzed, quota, sourceBreakdown, failedSources = [] }) => {
  const scopusQuota = quota?.scopus || quota;

  const fmt = (n) => (n != null ? Number(n).toLocaleString('tr-TR') : '—');

  const sources = [
    { name: 'Scopus', color: '#4f46e5', status: failedSources.includes('Scopus') ? 'Hata' : 'Aktif', count: sourceBreakdown?.scopus },
    { name: 'OpenAlex', color: '#0ea5e9', status: 'Aktif', count: sourceBreakdown?.openalex },
    { name: 'CORE', color: '#8b5cf6', status: 'Aktif', count: sourceBreakdown?.core },
    { name: 'Crossref', color: '#f43f5e', status: 'Aktif', count: sourceBreakdown?.crossref },
    { name: 'ArXiv', color: '#10b981', status: 'Aktif', count: sourceBreakdown?.arxiv },
    { name: 'DOAJ', color: '#f59e0b', status: 'Aktif', count: sourceBreakdown?.doaj },
  ];

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* Üst Özet Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        padding: '1.25rem 2.5rem',
        borderRadius: '24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', gap: '3.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#eef2ff', color: '#4f46e5', padding: '10px', borderRadius: '12px' }}><Database size={22} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Literatür Havuzu</p>
              <h4 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#1e293b' }}>{fmt(totalFound)} Makale</h4>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#f0fdf4', color: '#10b981', padding: '10px', borderRadius: '12px' }}><Activity size={22} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AHP Analiz Durumu</p>
              <h4 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#1e293b' }}>{fmt(analyzed)} Kayıt Skorlandı</h4>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#fff7ed', color: '#f59e0b', padding: '10px', borderRadius: '12px' }}><Zap size={22} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sistem Bağlantısı</p>
              <h4 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#1e293b' }}>Kesintisiz / Aktif</h4>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {scopusQuota && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#eff6ff', borderRadius: '14px', border: '1px solid #dbeafe', marginRight: '10px' }}>
              <Info size={18} color="#3b82f6" />
              <div style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: '700' }}>
                Kota: {scopusQuota.remaining} / {scopusQuota.limit}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: '#f0fdf4', borderRadius: '14px', border: '1px solid #dcfce7' }}>
             <ShieldCheck size={20} color="#10b981" />
             <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#166534' }}>Güven Katmanı Aktif</span>
          </div>
        </div>
      </div>

      {/* Kaynak Durum Barı - DİKEY İSTİFLEME MODU */}
      <div style={{ 
        display: 'flex', 
        gap: '0.6rem',
        width: '100%'
      }}>
        {sources.map((src, i) => (
          <MotionDiv
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            style={{
              flex: 1,
              padding: '12px 8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column', // İsmi üste, sayıyı alta al
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              minHeight: '64px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: src.status === 'Hata' ? '#ef4444' : src.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569', whiteSpace: 'nowrap' }}>{src.name}</span>
            </div>
            
            {src.count != null ? (
              <span style={{ 
                fontSize: '0.85rem', 
                fontWeight: '900', 
                color: '#1e293b', 
                background: '#f8fafc', 
                padding: '2px 10px', 
                borderRadius: '8px',
                border: '1px solid #f1f5f9'
              }}>
                {fmt(src.count)} <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#64748b' }}>Kayıt</span>
              </span>
            ) : (
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8' }}>Bekleniyor...</span>
            )}
          </MotionDiv>
        ))}
      </div>
    </div>
  );
};

export default GlobalStats;
