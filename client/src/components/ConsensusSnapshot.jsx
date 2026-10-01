import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
const MotionDiv = motion.div;
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function ConsensusSnapshot({ topic, papers = [], apiUrl = '' }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const handleGenerateConsensus = async () => {
    if (!topic || papers.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const endpoint = `${apiUrl || 'http://localhost:3000'}/api/consensus`;
      const res = await axios.post(endpoint, {
        topic,
        papers: papers.slice(0, 8)
      });

      if (res.data?.snapshot) {
        setSnapshot(res.data.snapshot);
      }
    } catch (err) {
      console.error('Consensus error', err);
      setError('Literatür konsensüsü oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  if (!snapshot && !loading) {
    return (
      <div style={{
        marginBottom: '1rem',
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.06) 100%)',
        border: '1px dashed rgba(99,102,241,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="var(--brand-primary)" />
          <div>
            <h4 style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: '700', color: 'var(--text-main)' }}>
              Akademik Konsensüs & Yönetici Özeti
            </h4>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
              Listelenen ilk 6 makalenin ortak bilimsel sonucunu ve araştırma boşluğunu tek tıkla çıkarın.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateConsensus}
          style={{
            padding: '7px 14px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: '600',
            background: 'var(--brand-primary)',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Sparkles size={13} /> Konsensüsü Çıkar
        </button>

        {error && (
          <div style={{ width: '100%', color: '#dc2626', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        marginBottom: '1rem',
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        background: '#ffffff',
        border: '1px solid rgba(99,102,241,0.2)',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px'
      }}>
        <Loader2 size={18} className="animate-spin" color="var(--brand-primary)" />
        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
          En yüksek AHP skorlu makalelerin bilimsel konsensüsü sentezleniyor...
        </span>
      </div>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginBottom: '1.25rem',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(99,102,241,0.25)',
        boxShadow: '0 8px 24px -8px rgba(99,102,241,0.12)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '12px 16px',
          background: 'rgba(99,102,241,0.05)',
          borderBottom: expanded ? '1px solid rgba(99,102,241,0.15)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--brand-primary)" />
          <h4 style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: '700', color: 'var(--text-main)' }}>
            Literatür Konsensüsü & Yönetici Özeti
          </h4>
          <span style={{
            background: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0',
            fontSize: '10px',
            fontWeight: '800',
            padding: '1px 8px',
            borderRadius: '999px'
          }}>
            %{snapshot.consensusScore || 85} Fikir Birliği
          </span>
        </div>

        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <MotionDiv
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ padding: '16px' }}
          >
            {/* Temel Çıkarım */}
            <p style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-main)',
              lineHeight: 1.6,
              marginBottom: '12px'
            }}>
              {snapshot.consensusSummary}
            </p>

            {/* 3 Ana Madde */}
            {snapshot.keyTakeaways?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                {snapshot.keyTakeaways.map((point, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ color: 'var(--text-main)' }}>{point}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Araştırma Boşluğu */}
            {snapshot.researchGap && (
              <div style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '11px',
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={14} color="#d97706" style={{ flexShrink: 0 }} />
                <span><strong>Öne Çıkan Literatür Boşluğu:</strong> {snapshot.researchGap}</span>
              </div>
            )}
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}
