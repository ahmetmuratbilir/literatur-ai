import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  FileText,
  User as UserIcon,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Quote,
  Bookmark,
  FolderHeart,
  CheckCircle2,
  Star
} from 'lucide-react';

const MotionDiv = motion.div;

const ResultCard = ({ item, rank, collections = [], onSaveToCollection, onFavorite, isFavorited }) => {
  const [expanded, setExpanded] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!item) return null;

  const score = item.scores?.total || 0;
  const scorePercent = Math.round(score * 100);

  let badgeColor = 'var(--score-low)';
  let badgeBg = 'var(--score-low-bg)';

  if (scorePercent >= 80) {
    badgeColor = 'var(--score-high)';
    badgeBg = 'var(--score-high-bg)';
  } else if (scorePercent >= 50) {
    badgeColor = 'var(--score-med)';
    badgeBg = 'var(--score-med-bg)';
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '1.25rem',
        alignItems: 'start',
        padding: '1.25rem'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
        <div
          style={{
            background: rank <= 3 ? 'linear-gradient(135deg, #6366f1, #4338ca)' : '#f1f5f9',
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            fontWeight: '800',
            color: rank <= 3 ? 'white' : '#64748b',
            boxShadow: rank <= 3 ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
          }}
        >
          {rank}
        </div>

        <div
          title="Atıf Sayısı"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: '0.7rem',
            fontWeight: '700',
            color: '#64748b',
            background: '#f8fafc',
            padding: '6px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          <Quote size={12} color="var(--brand-primary)" />
          {item.citedBy || 0}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            margin: '0 0 0.75rem 0',
            fontSize: '1.2rem',
            fontWeight: '800',
            color: 'var(--text-main)',
            lineHeight: '1.4',
            letterSpacing: '-0.01em',
          }}
        >
          {item.title}
        </h3>

        <div
          style={{
            margin: '0 0 1rem 0',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            fontWeight: '600',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserIcon size={16} color="var(--brand-primary)" /> {item.creator || 'Bilinmeyen Yazar'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="var(--brand-primary)" /> {item.year}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} color="var(--brand-primary)" /> {item.publicationName}
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <p
            style={{
              fontSize: '0.95rem',
              color: 'var(--text-muted)',
              lineHeight: '1.6',
              margin: 0,
              display: expanded ? 'block' : '-webkit-box',
              WebkitLineClamp: '3',
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.description || 'Bu makale için özet bilgisi bulunmuyor.'}
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem', alignItems: 'center' }}>
            {item.description && item.description.length > 200 && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-primary)',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                {expanded ? <><ChevronUp size={16} /> Daha az</> : <><ChevronDown size={16} /> Özeti gör</>}
              </button>
            )}

            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-secondary)', fontWeight: '700', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ExternalLink size={16} /> Makaleye Git
              </a>
            )}

            <div style={{ position: 'relative', display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowSaveMenu(!showSaveMenu)}
                disabled={isSaved}
                style={{
                  background: isSaved ? '#ecfdf5' : '#eef2ff',
                  border: `1px solid ${isSaved ? '#10b981' : '#4f46e5'}`,
                  color: isSaved ? '#059669' : '#4338ca',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  cursor: isSaved ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isSaved ? <><CheckCircle2 size={16} /> Kaydedildi</> : <><Bookmark size={16} /> Koleksiyona Kaydet</>}
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); onFavorite(item); }}
                style={{
                  background: isFavorited ? 'rgba(245, 158, 11, 0.1)' : '#f8fafc',
                  border: `1px solid ${isFavorited ? '#f59e0b' : '#e2e8f0'}`,
                  color: isFavorited ? '#d97706' : '#64748b',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <Star size={16} fill={isFavorited ? '#f59e0b' : 'none'} color={isFavorited ? '#f59e0b' : 'currentColor'} />
                {isFavorited ? 'Favorilerde' : 'Favorilere Ekle'}
              </button>

              <AnimatePresence>
                {showSaveMenu && !isSaved && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      marginBottom: '12px',
                      width: '200px',
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      boxShadow: '0 15px 30px -5px rgba(0,0,0,0.15)',
                      zIndex: 20,
                      padding: '8px',
                    }}
                  >
                    <p style={{ margin: '4px 8px 10px 8px', fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Koleksiyon Seç</p>
                    {collections.length === 0 ? (
                      <p style={{ margin: '8px', fontSize: '0.75rem', color: '#64748b' }}>Henüz koleksiyon yok.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {collections.map(col => (
                          <button
                            key={col._id}
                            onClick={() => { onSaveToCollection(col._id, item); setIsSaved(true); setShowSaveMenu(false); }}
                            style={{ textAlign: 'left', padding: '10px', background: 'none', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <FolderHeart size={14} color="#6366f1" /> {col.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.4rem',
          minWidth: '80px',
          padding: '0.6rem',
          background: '#f8fafc',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: badgeBg, border: `3.5px solid ${badgeColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '900', color: badgeColor, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
          %{scorePercent}
        </div>
        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AHP SKORU</span>
      </div>
    </MotionDiv>
  );
};

export default ResultCard;
