import { motion } from 'framer-motion';
import { Database, Activity } from 'lucide-react';

const StatBox = ({ label, value, icon: Icon, color, subValue }) => (
    <div className="stat-card" style={{ flex: 1, minWidth: '200px' }}>
        <div className="stat-icon" style={{ color: color, background: `${color}15` }}>
            <Icon size={24} />
        </div>
        <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: subValue ? '1.25rem' : '1.8rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.2' }}>{value}</div>
            {subValue && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{subValue}</div>}
        </div>
    </div>
);

const GlobalStats = ({ totalFound, analyzed, quota }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}
        >
            <StatBox label="Bulunan Makale" value={totalFound} icon={Database} color="#4f46e5" />
            <StatBox label="Analiz Edilen" value={analyzed} icon={Activity} color="#10b981" />
            {quota && (
                <>
                    <StatBox 
                        label="API Kalan Kota" 
                        value={`${quota.remaining} / ${quota.limit}`} 
                        icon={Activity} 
                        color="#f59e0b" 
                        subValue="Haftalık Toplam Kota"
                    />
                    <StatBox 
                        label="Kota Sıfırlanma" 
                        value={quota.reset} 
                        icon={Database} 
                        color="#3b82f6" 
                        subValue="Otomatik Yenilenme Tarihi"
                    />
                </>
            )}
        </motion.div>
    );
};

export default GlobalStats;
