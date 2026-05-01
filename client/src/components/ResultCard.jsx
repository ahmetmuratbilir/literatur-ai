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

  const author = item.creator || item.authors || 'Bilinmeyen Yazar';

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '1rem',
        alignItems: 'start',
        padding: '1.25rem'
      }}
    >
      <div
        title={`Sıra #${rank}`}
        style={{
          background: rank <= 3 ? 'var(--brand-primary)' : 'var(--slate-100)',
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--fs-sm)',
          fontWeight: '600',
          color: rank <= 3 ? 'white' : 'var(--slate-600)',
          flexShrink: 0,
        }}
      >
        {rank}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--fs-lg)',
              fontWeight: '600',
              color: 'var(--text-main)',
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
              flex: 1,
              minWidth: 0
            }}
          >
            {item.title}
          </h3>
          <div
            title={`AHP skoru: %${scorePercent}`}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              background: badgeBg,
              color: badgeColor,
              border: `1px solid ${badgeColor}33`,
              fontSize: 'var(--fs-xs)',
              fontWeight: '700'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: 'currentColor' }} />
            %{scorePercent}
          </div>
        </div>

        <div
          style={{
            margin: '0 0 0.875rem 0',
            color: 'var(--text-muted)',
            fontSize: 'var(--fs-sm)',
            display: 'flex',
            gap: '0.875rem',
            flexWrap: 'wrap',
            fontWeight: '500',
            alignItems: 'center'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <UserIcon size={13} color="var(--slate-400)" /> {author}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calendar size={13} color="var(--slate-400)" /> {item.year}
          </span>
          {item.publicationName && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
              <FileText size={13} color="var(--slate-400)" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>{item.publicationName}</span>
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Quote size={13} color="var(--slate-400)" /> {item.citedBy || 0} atıf
          </span>
        </div>

        <p
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            margin: 0,
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: '2',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.description || 'Bu makale için özet bilgisi bulunmuyor.'}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.875rem' }}>
            {item.description && item.description.length > 160 && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-primary)',
                  fontWeight: '500',
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                  fontFamily: 'inherit'
                }}
              >
                {expanded ? <><ChevronUp size={14} /> Daha az</> : <><ChevronDown size={14} /> Özeti gör</>}
              </button>
            )}

            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', fontWeight: '500', fontSize: 'var(--fs-sm)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ExternalLink size={14} /> Makaleye git
              </a>
            )}
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFavorite(item); }}
              className={`icon-btn ${isFavorited ? 'is-active' : ''}`}
              title={isFavorited ? 'Favorilerde' : 'Favorilere ekle'}
              style={{
                color: isFavorited ? '#d97706' : 'var(--text-muted)',
                background: isFavorited ? 'rgba(245, 158, 11, 0.1)' : 'transparent'
              }}
            >
              <Star size={16} fill={isFavorited ? '#f59e0b' : 'none'} color={isFavorited ? '#f59e0b' : 'currentColor'} />
            </button>

            <button
              type="button"
              onClick={() => setShowSaveMenu(!showSaveMenu)}
              disabled={isSaved}
              className={`icon-btn ${isSaved ? 'is-active' : ''}`}
              title={isSaved ? 'Kaydedildi' : 'Koleksiyona kaydet'}
              style={{
                color: isSaved ? '#059669' : 'var(--text-muted)',
                background: isSaved ? '#ecfdf5' : 'transparent',
                cursor: isSaved ? 'default' : 'pointer'
              }}
            >
              {isSaved ? <CheckCircle2 size={16} /> : <Bookmark size={16} />}
            </button>

            <AnimatePresence>
              {showSaveMenu && !isSaved && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: '8px',
                    width: '220px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 20,
                    padding: '6px',
                  }}
                >
                  <p style={{ margin: '6px 8px 4px 8px', fontSize: 'var(--fs-xs)', fontWeight: '600', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Koleksiyon seç</p>
                  {collections.length === 0 ? (
                    <p style={{ margin: '8px', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Henüz koleksiyon yok.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {collections.map(col => (
                        <button
                          key={col._id}
                          onClick={() => { onSaveToCollection(col._id, item); setIsSaved(true); setShowSaveMenu(false); }}
                          style={{ textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-sm)', fontWeight: '500', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--slate-100)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <FolderHeart size={14} color="var(--brand-primary)" /> {col.name}
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
    </MotionDiv>
  );
};

export default ResultCard;
