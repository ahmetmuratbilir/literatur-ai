import React, { useMemo } from 'react';
import { TrendingUp, BarChart2 } from 'lucide-react';

export default function PublicationTimeline({ results = [], selectedYear, onSelectYear }) {
  const { yearCounts, maxCount, years } = useMemo(() => {
    const counts = {};
    results.forEach(r => {
      const y = parseInt(r.year, 10);
      if (y && y > 1980 && y <= new Date().getFullYear()) {
        counts[y] = (counts[y] || 0) + 1;
      }
    });

    const sortedYears = Object.keys(counts)
      .map(Number)
      .sort((a, b) => a - b);

    // Son 10 yılı gösterelim
    const recentYears = sortedYears.slice(-10);
    const max = Math.max(...recentYears.map(y => counts[y] || 0), 1);

    return {
      yearCounts: counts,
      maxCount: max,
      years: recentYears
    };
  }, [results]);

  if (years.length <= 1) return null;

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      padding: '1rem 1.25rem',
      marginBottom: '1rem',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', padding: '5px', borderRadius: '6px' }}>
            <BarChart2 size={16} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: '700', color: 'var(--text-main)' }}>
              Yıllara Göre Yayın Dağılımı & Trend
            </h4>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
              Yıla tıklayarak yalnızca o dönemin çalışmalarını filtreleyin.
            </p>
          </div>
        </div>

        {selectedYear && (
          <button
            type="button"
            onClick={() => onSelectYear(null)}
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: '600',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            Filtreyi Temizle ({selectedYear}) ✕
          </button>
        )}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        height: '68px',
        paddingTop: '8px',
        overflowX: 'auto'
      }}>
        {years.map(y => {
          const count = yearCounts[y] || 0;
          const heightPct = Math.max(15, Math.round((count / maxCount) * 100));
          const isSelected = selectedYear === y;

          return (
            <button
              key={y}
              type="button"
              onClick={() => onSelectYear(isSelected ? null : y)}
              title={`${y}: ${count} Makale (Filtrelemek için tıkla)`}
              style={{
                flex: 1,
                minWidth: '38px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <span style={{ fontSize: '9px', fontWeight: '700', color: isSelected ? 'var(--brand-primary)' : 'var(--text-muted)', marginBottom: '3px' }}>
                {count}
              </span>
              <div
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  borderRadius: '4px 4px 0 0',
                  background: isSelected 
                    ? 'linear-gradient(180deg, #4f46e5 0%, #6366f1 100%)' 
                    : 'linear-gradient(180deg, rgba(99,102,241,0.3) 0%, rgba(99,102,241,0.15) 100%)',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 8px rgba(99,102,241,0.4)' : 'none'
                }}
              />
              <span style={{
                fontSize: '10px',
                fontWeight: isSelected ? '800' : '600',
                color: isSelected ? 'var(--brand-primary)' : 'var(--text-muted)',
                marginTop: '4px'
              }}>
                {y}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
