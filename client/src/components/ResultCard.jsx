import { motion } from 'framer-motion';
import { Calendar, Users, FileText, ExternalLink, Award } from 'lucide-react';

const ResultCard = ({ item, rank }) => {
    // Determine badge color based on score
    const score = item.scores?.total || 0;
    let badgeColor = 'var(--score-low)';
    let badgeBg = '#fef2f2';
    
    if (score >= 80) {
        badgeColor = 'var(--score-high)';
        badgeBg = '#ecfdf5';
    } else if (score >= 50) {
        badgeColor = 'var(--score-med)';
        badgeBg = '#fffbeb';
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card"
            style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.5rem', alignItems: 'center' }}
        >
            {/* Rank Badge */}
            <div style={{
                background: rank <= 3 ? 'linear-gradient(135deg, #f59e0b, #b45309)' : '#f1f5f9',
                width: '45px',
                height: '45px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: '800',
                color: rank <= 3 ? 'white' : 'var(--text-secondary)',
                boxShadow: rank <= 3 ? '0 4px 10px rgba(245, 158, 11, 0.3)' : 'none'
            }}>
                #{rank}
            </div>

            {/* Content */}
            <div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {item.title}
                </h3>
                <div style={{ margin: '0 0 0.75rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontWeight: '500' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> {item.creator || 'Unknown Author'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> {item.year}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={14} /> {item.publicationName}</span>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, opacity: 0.8 }}>
                    {item.description ? item.description.substring(0, 160) + '...' : 'No description available for this article.'}
                </p>
            </div>

            {/* Score Badge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '90px' }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: badgeBg,
                    border: `3px solid ${badgeColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: '800',
                    color: badgeColor,
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    {score}
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    AHP Score
                </span>
            </div>
        </motion.div>
    );
};

export default ResultCard;
