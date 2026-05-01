import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
const MotionAside = motion.aside;
const MotionDiv = motion.div;
const MotionSpan = motion.span;
import { 
  History, 
  Trash2, 
  PlusCircle, 
  FolderHeart, 
  Plus, 
  Zap, 
  ShieldCheck, 
  Settings, 
  HelpCircle, 
  Star,
  ChevronRight,
  ChevronLeft,
  Menu,
  FileSearch,
  Bookmark
} from 'lucide-react';

const SidebarItem = ({ icon, label, isOpen, active, onClick, badge }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      padding: '8px 10px',
      background: active ? 'rgba(99, 102, 241, 0.16)' : 'transparent',
      border: 'none',
      borderRadius: '10px',
      color: active ? '#e0e7ff' : '#94a3b8',
      fontSize: '0.8125rem',
      fontWeight: active ? '600' : '500',
      fontFamily: 'inherit',
      display: 'flex',
      alignItems: 'center',
      justifyContent: isOpen ? 'flex-start' : 'center',
      gap: '10px',
      cursor: 'pointer',
      transition: 'background 0.15s ease, color 0.15s ease',
      position: 'relative',
      height: '36px'
    }}
    onMouseOver={(e) => { if(!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e2e8f0'; } }}
    onMouseOut={(e) => { if(!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#a5b4fc' : 'inherit' }}>
      {icon}
    </div>
    {isOpen && (
      <MotionDiv initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
        <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
        {badge && (
          <span style={{ fontSize: '0.6875rem', background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe', padding: '1px 6px', borderRadius: '999px', fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>{badge}</span>
        )}
      </MotionDiv>
    )}
  </button>
);

const HistorySidebar = ({ isOpen, setIsOpen, onSelectHistory, onDeleteHistoryEntry, onNewSearch, deviceId, apiUrl }) => {
  const [activeTab, setActiveTab] = useState('history'); // history, collections, analyses, favorites
  const [history, setHistory] = useState([]);
  const [collections, setCollections] = useState([]);
  const [expandedCollectionIds, setExpandedCollectionIds] = useState(new Set());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const toggleCollection = (id) => {
    setExpandedCollectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const removePaper = async (collectionId, paperId) => {
    try {
      await fetch(`${apiUrl}/api/collections/${collectionId}/papers/${paperId}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('refreshCollections'));
    } catch (e) {
      console.error('Paper remove failed', e);
    }
  };

  const removeCollection = async (collectionId) => {
    try {
      await fetch(`${apiUrl}/api/collections/${collectionId}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('refreshCollections'));
    } catch (e) {
      console.error('Collection delete failed', e);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!deviceId) return;
    try {
      const response = await fetch(`${apiUrl}/api/history?userId=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('History fetch error:', error);
    }
  }, [deviceId, apiUrl]);

  const fetchCollections = useCallback(async () => {
    if (!deviceId) return;
    try {
      const response = await fetch(`${apiUrl}/api/collections?userId=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch (error) {
      console.error('Collections fetch error:', error);
    }
  }, [deviceId, apiUrl]);

  useEffect(() => {
    const init = async () => {
      await fetchHistory();
      await fetchCollections();
    };
    init();
    const refreshHistory = () => fetchHistory();
    const refreshCollections = () => fetchCollections();
    window.addEventListener('refreshHistory', refreshHistory);
    window.addEventListener('refreshCollections', refreshCollections);
    return () => {
      window.removeEventListener('refreshHistory', refreshHistory);
      window.removeEventListener('refreshCollections', refreshCollections);
    };
  }, [fetchHistory, fetchCollections]);

  return (
    <>
      <AnimatePresence>
        {isMobile && isOpen && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 85
            }}
          />
        )}
      </AnimatePresence>

      <MotionAside
        initial={false}
        animate={{ 
          width: isOpen ? '280px' : (isMobile ? '0px' : '72px'),
          x: (isMobile && !isOpen) ? -280 : 0
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#0f172a',
          color: '#f8fafc',
          zIndex: 90,
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isOpen ? '10px 0 30px -10px rgba(0,0,0,0.5)' : 'none',
          willChange: 'width',
          borderRight: '1px solid rgba(255,255,255,0.05)'
        }}
      >
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isOpen ? (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(99,102,241,0.4)' }}>
                <Zap size={18} color="white" fill="white" />
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '-0.04em', color: 'white' }}>LiteratureAI</span>
            </MotionDiv>
          ) : (
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="white" fill="white" />
            </div>
          )}
          
        </div>

        <div style={{ padding: isOpen ? '0 12px 16px 12px' : '12px 12px 16px 12px' }}>
          <button
            onClick={onNewSearch}
            style={{
              width: '100%',
              height: '40px',
              background: '#6366f1',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '0.8125rem',
              fontWeight: '600',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isOpen ? 'flex-start' : 'center',
              padding: isOpen ? '0 14px' : '0',
              gap: '10px',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#4f46e5'}
            onMouseOut={(e) => e.currentTarget.style.background = '#6366f1'}
          >
            <PlusCircle size={16} strokeWidth={2} />
            {isOpen && <MotionSpan initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Yeni araştırma</MotionSpan>}
          </button>
        </div>

        <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SidebarItem
            icon={<FolderHeart size={18} />}
            label="Projeler"
            isOpen={isOpen}
            active={activeTab === 'collections'}
            onClick={() => setActiveTab('collections')}
            badge={(() => { const n = collections.filter(c => c.name !== 'Favoriler').length; return n > 0 ? n : null; })()}
          />
          <SidebarItem
            icon={<FileSearch size={18} />}
            label="Analizler"
            isOpen={isOpen}
            active={activeTab === 'analyses'}
            onClick={() => setActiveTab('analyses')}
          />
          <SidebarItem
            icon={<History size={18} />}
            label="Geçmiş"
            isOpen={isOpen}
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            badge={history.length > 0 ? history.length : null}
          />
          <SidebarItem
            icon={<Bookmark size={18} />}
            label="Favoriler"
            isOpen={isOpen}
            active={activeTab === 'favorites'}
            onClick={() => setActiveTab('favorites')}
            badge={(() => { const fav = collections.find(c => c.name === 'Favoriler'); return fav?.papers?.length > 0 ? fav.papers.length : null; })()}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isOpen ? '32px 16px' : '20px 0' }}>
          {isOpen && (
            <AnimatePresence mode="wait">
              {activeTab === 'history' && (
                <MotionDiv key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '6px' }}>Son Aramalar</span>
                  {history.length === 0 ? (
                    <div style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)' }}>Henüz arama yapılmadı. İlk aramanız burada listelenecek.</div>
                  ) : (
                    history.slice(0, 15).map(item => (
                      <div
                        key={item._id}
                        onClick={() => onSelectHistory(item)}
                        className="history-item-card-dark"
                        style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: 'transparent', border: '1px solid transparent', position: 'relative', transition: 'background 0.15s ease, border-color 0.15s ease' }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        <button
                          className="delete-btn-dark"
                          onClick={(e) => { e.stopPropagation(); onDeleteHistoryEntry(item._id); }}
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            opacity: 0,
                            transition: 'opacity 0.15s ease, background 0.15s ease, color 0.15s ease',
                            zIndex: 10
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.12)'; e.currentTarget.style.color = '#fb7185'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                        >
                          <Trash2 size={12} />
                        </button>
                        <div style={{ fontSize: '0.8125rem', fontWeight: '500', color: '#cbd5e1', paddingRight: '24px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.mainTopic || item.aiQuery}</div>
                      </div>
                    ))
                  )}
                </MotionDiv>
              )}

              {activeTab === 'collections' && (
                <MotionDiv key="collections" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '6px' }}>Projeler</span>
                  {collections.filter(c => c.name !== 'Favoriler').length === 0 ? (
                    <div style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)' }}>Henüz proje yok. Bir makaleye “Koleksiyona kaydet” deyince burada görünür.</div>
                  ) : (
                    collections.filter(c => c.name !== 'Favoriler').map(col => {
                      const expanded = expandedCollectionIds.has(col._id);
                      return (
                        <div key={col._id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={() => toggleCollection(col._id)}
                            style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontFamily: 'inherit', textAlign: 'left' }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <FolderHeart size={14} color="#a5b4fc" style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '0.8125rem', fontWeight: '500', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.name}</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: '500' }}>{col.papers.length}</span>
                              <ChevronRight size={12} color="#64748b" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s ease' }} />
                            </span>
                          </button>
                          {expanded && (
                            <div style={{ padding: '4px 8px 10px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {col.papers.length === 0 ? (
                                <span style={{ fontSize: '0.7rem', color: '#64748b', padding: '6px 8px' }}>Henüz makale yok.</span>
                              ) : col.papers.map((p) => (
                                <div key={p._id} style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <a href={p.url || '#'} target={p.url ? '_blank' : undefined} rel="noopener noreferrer" style={{ fontSize: '0.7rem', color: '#cbd5e1', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{p.title || 'Başlıksız'}</a>
                                  <button type="button" onClick={() => removePaper(col._id, p._id)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', borderRadius: '4px', display: 'flex' }} title="Listeden çıkar"><Trash2 size={11} /></button>
                                </div>
                              ))}
                              <button type="button" onClick={() => removeCollection(col._id)} style={{ marginTop: '4px', background: 'transparent', border: '1px dashed rgba(244, 63, 94, 0.3)', color: '#fb7185', borderRadius: '6px', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>Koleksiyonu sil</button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </MotionDiv>
              )}

              {activeTab === 'analyses' && (
                <MotionDiv key="analyses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center', padding: '20px 12px' }}>
                  <FileSearch size={28} color="#475569" style={{ margin: '0 auto' }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#cbd5e1' }}>Akıllı Analizler</span>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', lineHeight: 1.5 }}>AI tarafından oluşturulan sorgu önerileri burada birikiyor. Ana ekrandan “AI ile geliştir”e basarak yenilerini ekleyebilirsiniz.</p>
                </MotionDiv>
              )}

              {activeTab === 'favorites' && (() => {
                const fav = collections.find(c => c.name === 'Favoriler');
                const papers = fav?.papers || [];
                return (
                  <MotionDiv key="favorites" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '6px' }}>Favoriler</span>
                    {papers.length === 0 ? (
                      <div style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)' }}>Yıldızladığınız makaleler burada listelenir.</div>
                    ) : (
                      papers.map((p) => (
                        <div key={p._id} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <a href={p.url || '#'} target={p.url ? '_blank' : undefined} rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#cbd5e1', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{p.title || 'Başlıksız'}</a>
                          <button type="button" onClick={() => removePaper(fav._id, p._id)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', borderRadius: '4px', display: 'flex' }} title="Favoriden çıkar"><Trash2 size={11} /></button>
                        </div>
                      ))
                    )}
                  </MotionDiv>
                );
              })()}
            </AnimatePresence>
          )}
        </div>

        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
           <SidebarItem icon={<Settings size={16} />} label="Ayarlar" isOpen={isOpen} active={false} onClick={() => {}} />
           <SidebarItem icon={<HelpCircle size={16} />} label="Yardım" isOpen={isOpen} active={false} onClick={() => {}} />
        </div>

        {!isMobile && (
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            style={{ 
              position: 'absolute', 
              top: '50%', 
              right: '-14px', 
              transform: 'translateY(-50%)', 
              background: '#0f172a', 
              border: '1px solid rgba(255,255,255,0.15)', 
              color: 'white',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 100,
              boxShadow: '4px 0 10px rgba(0,0,0,0.3)',
              outline: 'none'
            }}
            onMouseOver={(e) => { 
              e.currentTarget.style.background = '#6366f1'; 
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)'; 
              e.currentTarget.style.borderColor = '#818cf8';
            }}
            onMouseOut={(e) => { 
              e.currentTarget.style.background = '#0f172a'; 
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
            }}
          >
            {isOpen ? <ChevronLeft size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />}
          </button>
        )}
      </MotionAside>

      {isMobile && !isOpen && (
        <button 
          onClick={() => setIsOpen(true)} 
          style={{ 
            position: 'fixed', 
            top: '20px', 
            left: '20px', 
            zIndex: 80, 
            background: '#0f172a', 
            border: '1px solid rgba(255,255,255,0.1)', 
            color: 'white', 
            padding: '10px', 
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
          }}
        >
          <History size={24} />
        </button>
      )}
    </>
  );
};

export default HistorySidebar;
