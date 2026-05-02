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
  Star
} from 'lucide-react';

const MotionDiv = motion.div;

const ResultCard = ({ item, rank, onFavorite, isFavorited }) => {
  const [expanded, setExpanded] = useState(false);

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

  const author = item.creator || (Array.isArray(item.authors) ? item.authors.join(', ') : item.authors) || 'Bilinmeyen Yazar';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
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
          }}
        >
          {rank}
        </div>
        
        <div
          title="Toplam Atıf"
          style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            color: 'var(--brand-primary)',
            padding: '4px 0',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            minHeight: '38px',
            gap: '2px'
          }}
        >
          <Quote size={10} strokeWidth={3} />
          <span style={{ fontSize: '10px', fontWeight: '800', lineHeight: 1 }}>{item.citedBy || item.citedbyCount || 0}</span>
          <span style={{ fontSize: '8px', fontWeight: '600', opacity: 0.8, textTransform: 'uppercase' }}>Atıf</span>
        </div>
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
            {item.titleTR || item.title || 'İsimsiz Makale'}
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
          {item.source && (
            <span 
              style={{ 
                background: 'rgba(99, 102, 241, 0.1)', 
                color: 'var(--brand-primary)', 
                padding: '2px 8px', 
                borderRadius: '99px', 
                fontSize: '10px', 
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}
            >
              {item.source}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            margin: 0,
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: '2',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {item.teaserTR ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontStyle: 'italic', color: 'var(--text-main)' }}>{item.teaserTR}</div>
              <div style={{ fontSize: '9px', fontWeight: '600', color: '#10b981', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }}></span>
                Yapay Zeka Çevirisi
              </div>
            </div>
          ) : (
            item.description || 'Bu makale için özet bilgisi bulunmuyor.'
          )}
        </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFavorite(item); }}
              className={`icon-btn ${isFavorited ? 'is-active' : ''}`}
              title={isFavorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
              style={{
                color: isFavorited ? '#d97706' : 'var(--text-muted)',
                background: isFavorited ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isFavorited ? '1px solid rgba(217, 119, 6, 0.2)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Star size={18} fill={isFavorited ? '#f59e0b' : 'none'} color={isFavorited ? '#f59e0b' : 'currentColor'} />
            </button>
          </div>
        </div>
      </div>
    </MotionDiv>
  );
};

export default ResultCard;
