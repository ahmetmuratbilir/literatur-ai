import React, { useState } from 'react';
import { motion } from 'framer-motion';
const MotionDiv = motion.div;
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  Bookmark, 
  Quote, 
  Calendar, 
  User, 
  FileText, 
  Sparkles,
  Award
} from 'lucide-react';
import { getYearDisplay } from '../utils/yearDisplay.js';

export default function PaperReaderDrawer({
  paper,
  onClose,
  isSelected,
  onToggleSelect,
  onFindSimilar
}) {
  const [copied, setCopied] = useState(false);

  if (!paper) return null;

  const author = paper.creator || (Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors) || 'Bilinmeyen Yazar';
  const yearDisplay = getYearDisplay(paper);
  const scorePercent = Math.round((paper.scores?.total || 0) * 100);

  const handleCopyBibtex = () => {
    const rawAuthor = paper.creator || (Array.isArray(paper.authors) ? paper.authors.join(' and ') : paper.authors) || 'Unknown';
    const cleanTitle = (paper.title || '').replace(/[{}]/g, '');
    const year = paper.year || paper.publishedDate?.substring(0, 4) || new Date().getFullYear();
    const key = (rawAuthor.split(' ')[0] || 'paper').replace(/[^a-zA-Z0-9]/g, '') + year;
    const journal = paper.publicationName || paper.source || 'Academic Publication';
    const doiPart = paper.doi ? `,\n  doi = {${paper.doi}}` : '';
    const urlPart = paper.url ? `,\n  url = {${paper.url}}` : '';
    const bibtex = `@article{${key.toLowerCase()},\n  author = {${rawAuthor}},\n  title = {${cleanTitle}},\n  journal = {${journal}},\n  year = {${year}}${doiPart}${urlPart}\n}`;

    navigator.clipboard.writeText(bibtex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(9, 13, 22, 0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={onClose}
    >
      <MotionDiv
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 240 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '100vh',
          background: '#ffffff',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: '#ffffff',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'var(--brand-primary)',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700'
            }}>
              AHP %{scorePercent}
            </span>
            {paper.quartile && (
              <span style={{
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700'
              }}>
                {paper.quartile}
              </span>
            )}
            {paper.source && (
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                color: 'var(--text-muted)',
                textTransform: 'uppercase'
              }}>
                {paper.source}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* İçerik */}
        <div style={{ padding: '1.5rem', flex: 1 }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '700',
            color: 'var(--text-main)',
            lineHeight: 1.4,
            marginBottom: '1rem'
          }}>
            {paper.title}
          </h2>

          {/* Meta Bilgiler */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '13px',
            color: 'var(--text-muted)',
            marginBottom: '1.5rem',
            paddingBottom: '1.25rem',
            borderBottom: '1px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} color="var(--brand-primary)" />
              <strong style={{ color: 'var(--text-main)' }}>Yazarlar:</strong> {author}
            </div>

            {paper.publicationName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} color="var(--brand-primary)" />
                <strong style={{ color: 'var(--text-main)' }}>Yayın:</strong> {paper.publicationName}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="var(--brand-primary)" />
                <strong style={{ color: 'var(--text-main)' }}>Yıl:</strong> {yearDisplay.label}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Quote size={14} color="var(--brand-primary)" />
                <strong style={{ color: 'var(--text-main)' }}>Toplam Atıf:</strong> {paper.citedBy || paper.citedbyCount || 0}
              </div>
            </div>

            {paper.doi && (
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                <strong>DOI:</strong> {paper.doi}
              </div>
            )}
          </div>

          {/* AHP Skor Analiz Kartı */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(99,102,241,0.06) 0%, rgba(99,102,241,0.02) 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--brand-primary)', marginBottom: '0.75rem' }}>
              <Award size={15} /> AHP Çok Kriterli Puan Dağılımı
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
              <div style={{ background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ color: 'var(--text-muted)' }}>🎯 Semantik Alaka:</div>
                <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                  %{Math.round((paper.scores?.keyword || paper.scores?.expandedSimilarity || 0.75) * 100)}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ color: 'var(--text-muted)' }}>📈 Atıf Gücü:</div>
                <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                  %{Math.round((paper.scores?.citationPerYear || 0.6) * 100)}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ color: 'var(--text-muted)' }}>🏛️ Dergi Prestiji:</div>
                <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                  {paper.quartile || 'Hakemli Yayın'}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ color: 'var(--text-muted)' }}>📅 Güncellik:</div>
                <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                  %{Math.round((paper.scores?.recency || 0.8) * 100)}
                </div>
              </div>
            </div>
          </div>

          {/* Özet (Abstract) */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.6rem' }}>
              Makale Özeti (Abstract)
            </h4>
            <div style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              lineHeight: 1.7,
              background: '#f8fafc',
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-light)'
            }}>
              {paper.teaserTR || paper.abstract || paper.description || 'Bu makale için özet metni bulunmuyor.'}
            </div>
          </div>
        </div>

        {/* Alt Sabit Aksiyon Barı */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-light)',
          background: '#ffffff',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={() => onToggleSelect(paper)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              border: isSelected ? '1px solid #10b981' : '1px solid var(--brand-primary)',
              background: isSelected ? 'rgba(16,185,129,0.1)' : 'var(--brand-primary)',
              color: isSelected ? '#059669' : '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Bookmark size={14} />
            {isSelected ? 'Yazar Panelinde Seçili ✓' : 'Yazar Paneline Ekle'}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onFindSimilar(paper);
            }}
            title="Bu makalenin başlığından benzer çalışmalar ara"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              border: '1px solid var(--border-light)',
              background: '#f8fafc',
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Search size={14} /> Benzerini Bul
          </button>

          <button
            type="button"
            onClick={handleCopyBibtex}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              border: '1px solid var(--border-light)',
              background: '#f8fafc',
              color: copied ? '#059669' : 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Kopyalandı' : 'BibTeX'}
          </button>

          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid var(--border-light)',
                background: '#f8fafc',
                color: 'var(--brand-primary)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ExternalLink size={14} /> Oku
            </a>
          )}
        </div>
      </MotionDiv>
    </div>
  );
}
