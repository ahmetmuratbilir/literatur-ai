import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  FileText,
  User as UserIcon,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Quote,
  Star,
  Bookmark,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { getYearDisplay } from '../utils/yearDisplay.js';

const MotionDiv = motion.div;

const ResultCard = ({ item, rank, onFavorite, isFavorited, collections, onSaveToCollection, isSelected, onToggleSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const [showCollMenu, setShowCollMenu] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [favFeedback, setFavFeedback] = useState(null); // 'added' | 'removed' | 'error'
  const [collFeedback, setCollFeedback] = useState(null); // { collId, status: 'saving'|'saved'|'error' }
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const collMenuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!item) return null;

  const renderRankingBadge = () => {
    const q = item.quartile;
    const type = item.sourceType;

    let text = null;
    let bg = '';
    let color = '';
    let border = '';

    if (type === 'Preprint') {
      text = 'Preprint';
      bg = '#fff1f2';
      color = '#be123c';
      border = '1px solid #fecdd3';
    } else if (type === 'Conference') {
      text = 'Conference';
      bg = '#f5f3ff';
      color = '#6d28d9';
      border = '1px solid #ddd6fe';
    } else if (q === 'Q1') {
      text = 'Q1';
      bg = '#ecfdf5';
      color = '#047857';
      border = '1px solid #a7f3d0';
    } else if (q === 'Q2') {
      text = 'Q2';
      bg = '#eff6ff';
      color = '#1d4ed8';
      border = '1px solid #bfdbfe';
    } else if (q === 'Q3') {
      text = 'Q3';
      bg = '#fffbeb';
      color = '#b45309';
      border = '1px solid #fde68a';
    } else if (q === 'Q4') {
      text = 'Q4';
      bg = '#f8fafc';
      color = '#475569';
      border = '1px solid #e2e8f0';
    }

    if (!text) return null;

    return (
      <div
        title={item.sjr ? `SJR: ${item.sjr}` : `${text} Yayın Seviyesi`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: '999px',
          background: bg,
          color: color,
          border: border,
          fontSize: '10px',
          fontWeight: '800',
          letterSpacing: '0.02em',
          flexShrink: 0
        }}
      >
        {text}
        {item.sjr ? ` (SJR: ${item.sjr.toFixed(2)})` : ''}
      </div>
    );
  };

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
  const teaserText = typeof item.teaserTR === 'string' ? item.teaserTR.trim() : '';
  const sourceSummary = typeof item.description === 'string' ? item.description.trim() : '';
  const summaryPreview = teaserText || sourceSummary || 'Bu makale icin ozet bilgisi bulunmuyor.';
  const hasExtraSourceSummary = Boolean(teaserText && sourceSummary && sourceSummary !== teaserText);
  const canExpandSummary = hasExtraSourceSummary || summaryPreview.length > 180;
  const yearDisplay = getYearDisplay(item);

  // Koleksiyon menüsü dışarı tıklanınca kapansın
  useEffect(() => {
    if (!showCollMenu) return;
    const handleClickOutside = (e) => {
      if (collMenuRef.current && !collMenuRef.current.contains(e.target)) {
        setShowCollMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCollMenu]);

  // Favori feedback temizle
  useEffect(() => {
    if (!favFeedback) return;
    const t = setTimeout(() => setFavFeedback(null), 2000);
    return () => clearTimeout(t);
  }, [favFeedback]);

  const handleFavClick = async (e) => {
    e.stopPropagation();
    if (favLoading) return;
    setFavLoading(true);
    try {
      await onFavorite(item);
      setFavFeedback(isFavorited ? 'removed' : 'added');
    } catch {
      setFavFeedback('error');
    } finally {
      setFavLoading(false);
    }
  };

  const handleCollSave = async (e, collId) => {
    e.stopPropagation();
    setCollFeedback({ collId, status: 'saving' });
    try {
      await onSaveToCollection(collId, item);
      setCollFeedback({ collId, status: 'saved' });
      setTimeout(() => {
        setCollFeedback(null);
        setShowCollMenu(false);
      }, 1200);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Kaydedilemedi';
      setCollFeedback({ collId, status: 'error', msg });
      setTimeout(() => setCollFeedback(null), 2500);
    }
  };

  const favColor = isFavorited ? '#f59e0b' : 'currentColor';
  const favBg = isFavorited ? 'rgba(245, 158, 11, 0.1)' : 'transparent';
  const favBorder = isFavorited ? '1px solid rgba(217, 119, 6, 0.2)' : '1px solid transparent';

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card ${isSelected ? 'selected-card' : ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr',
        gap: '1rem',
        alignItems: 'start',
        padding: isMobile ? '1rem' : '1.25rem',
        background: isSelected ? '#f8fafc' : 'white',
        border: isSelected ? '2px solid #818cf8' : '1px solid var(--border-light)',
        boxShadow: isSelected ? '0 4px 12px rgba(79,70,229,0.08)' : 'var(--shadow-sm)'
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem', flexDirection: isMobile ? 'column' : 'row' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, alignSelf: isMobile ? 'flex-start' : 'center', marginTop: isMobile ? '6px' : '0' }}>
            {isSelected && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px', borderRadius: '999px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white', fontSize: '0.65rem', fontWeight: '800',
                letterSpacing: '0.05em'
              }}>
                <Check size={10} strokeWidth={4} /> YAZARDA
              </div>
            )}
            {renderRankingBadge()}
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
          <span
            title={yearDisplay.title}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flexWrap: 'wrap' }}
          >
            <Calendar size={13} color="var(--slate-400)" />
            <span style={{ whiteSpace: 'nowrap' }}>{yearDisplay.label}</span>
            {yearDisplay.showWarning && (
              <span
                title={yearDisplay.title}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: '#fffbeb',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  fontSize: '10px',
                  fontWeight: '700',
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap'
                }}
              >
                Yıl doğrulanamadı
              </span>
            )}
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
          {teaserText ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontStyle: 'italic', color: 'var(--text-main)' }}>{teaserText}</div>
              <div style={{ fontSize: '9px', fontWeight: '600', color: '#10b981', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }}></span>
                Yapay Zeka Çevirisi
              </div>
              {expanded && hasExtraSourceSummary && (
                <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--border-light)', fontStyle: 'normal', color: 'var(--text-muted)' }}>
                  {sourceSummary}
                </div>
              )}
            </div>
          ) : (
            sourceSummary || 'Bu makale icin ozet bilgisi bulunmuyor.'
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.875rem' }}>
            {/* Kaynağa Ekle Butonu */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '8px',
                background: isSelected ? 'var(--brand-primary)' : 'transparent',
                color: isSelected ? 'white' : 'var(--brand-primary)',
                border: isSelected ? '1px solid var(--brand-primary)' : '1px solid rgba(79,70,229,0.3)',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700',
                transition: 'all 0.2s', fontFamily: 'inherit'
              }}
            >
              {isSelected ? <Check size={14} strokeWidth={3} /> : <span style={{ fontSize: '1.2rem', lineHeight: 0.5 }}>+</span>}
              {isSelected ? 'Kaynak Eklendi' : 'Kaynağa Ekle'}
            </button>
            {canExpandSummary && (
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

            {/* Koleksiyon Kaydetme Geri Bildirimi */}
            {collFeedback && collFeedback.status === 'error' && (
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <AlertCircle size={11} /> {collFeedback.msg}
              </span>
            )}
            {collFeedback && collFeedback.status === 'saved' && (
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Check size={11} /> Kaydedildi!
              </span>
            )}

            {/* Koleksiyona Kaydet Dropdown */}
            <div style={{ position: 'relative' }} ref={collMenuRef}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowCollMenu(prev => !prev); }}
                className="icon-btn"
                title={
                  collections && collections.filter(c => c.name !== 'Favoriler').length > 0
                    ? 'Koleksiyona kaydet'
                    : 'Koleksiyon oluşturmak için sol paneli açın'
                }
                style={{
                  color: showCollMenu ? 'var(--brand-primary)' : 'var(--text-muted)',
                  background: showCollMenu ? 'var(--brand-primary-soft)' : 'transparent',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: showCollMenu ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Bookmark size={18} fill={showCollMenu ? 'var(--brand-primary)' : 'none'} />
              </button>

              {showCollMenu && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '110%',
                    right: 0,
                    background: 'white',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 20,
                    minWidth: '200px',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  {collections && collections.filter(c => c.name !== 'Favoriler').length > 0 ? (
                    collections.filter(c => c.name !== 'Favoriler').map(col => {
                      const isSaving = collFeedback?.collId === col._id && collFeedback?.status === 'saving';
                      const isSaved = collFeedback?.collId === col._id && collFeedback?.status === 'saved';
                      return (
                        <button
                          key={col._id}
                          type="button"
                          disabled={isSaving}
                          onClick={(e) => handleCollSave(e, col._id)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: isSaved ? 'rgba(16,185,129,0.08)' : 'none',
                            border: 'none',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                            fontSize: 'var(--fs-sm)',
                            color: isSaved ? '#059669' : 'var(--text-main)',
                            borderRadius: '6px',
                            fontFamily: 'inherit',
                            fontWeight: '500',
                            transition: 'background 0.12s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseOver={e => { if (!isSaving && !isSaved) e.currentTarget.style.background = 'var(--slate-100)'; }}
                          onMouseOut={e => { if (!isSaving && !isSaved) e.currentTarget.style.background = 'none'; }}
                        >
                          {isSaving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                          {isSaved && <Check size={13} style={{ flexShrink: 0 }} />}
                          {!isSaving && !isSaved && <Bookmark size={13} style={{ flexShrink: 0, opacity: 0.5 }} />}
                          <span>{col.name}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
                      Sol panelden önce<br/>bir koleksiyon oluşturun.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Favori Butonu */}
            <button
              type="button"
              onClick={handleFavClick}
              disabled={favLoading}
              className={`icon-btn ${isFavorited ? 'is-active' : ''}`}
              title={
                favFeedback === 'error' ? 'Favori işlemi başarısız' :
                favFeedback === 'added' ? 'Favorilere eklendi!' :
                favFeedback === 'removed' ? 'Favorilerden çıkarıldı' :
                isFavorited ? 'Favorilerden çıkar' : 'Favorilere ekle'
              }
              style={{
                color: favFeedback === 'error' ? '#dc2626' : favFeedback ? '#10b981' : (isFavorited ? '#f59e0b' : 'var(--text-muted)'),
                background: favFeedback === 'error' ? 'rgba(220,38,38,0.08)' : favFeedback ? 'rgba(16,185,129,0.08)' : favBg,
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: favFeedback === 'error' ? '1px solid rgba(220,38,38,0.2)' : favFeedback ? '1px solid rgba(16,185,129,0.2)' : favBorder,
                cursor: favLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {favLoading ? (
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              ) : favFeedback === 'error' ? (
                <AlertCircle size={18} />
              ) : favFeedback ? (
                <Check size={18} strokeWidth={3} />
              ) : (
                <Star size={18} fill={isFavorited ? favColor : 'none'} color={isFavorited ? favColor : 'currentColor'} />
              )}
            </button>
          </div>
        </div>
      </div>
    </MotionDiv>
  );
};

export default ResultCard;
