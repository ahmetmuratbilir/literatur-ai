import { motion } from 'framer-motion';
import { Database, Activity } from 'lucide-react';

const StatBox = ({ label, value, icon: Icon, color }) => (
    <div className="stat-card" style={{ flex: 1 }}>
        <div className="stat-icon" style={{ color: color, background: `${color}15` }}>
            <Icon size={24} />
        </div>
        <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>{value}</div>
        </div>
    </div>
);

const GlobalStats = ({ totalFound, analyzed }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}
        >
            <StatBox label="Total Articles Found" value={totalFound} icon={Database} color="#4f46e5" />
            <StatBox label="Articles Analyzed & Ranked" value={analyzed} icon={Activity} color="#10b981" />
        </motion.div>
    );
};

export default GlobalStats;
