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
      padding: '12px',
      background: active ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
      border: 'none',
      borderRadius: '12px',
      color: active ? '#a5b4fc' : '#94a3b8',
      fontSize: '0.85rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      justifyContent: isOpen ? 'flex-start' : 'center',
      gap: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative'
    }}
    onMouseOver={(e) => { if(!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#f8fafc'; }}
    onMouseOut={(e) => { if(!active) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = active ? '#a5b4fc' : '#94a3b8'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#6366f1' : 'inherit' }}>
      {icon}
    </div>
    {isOpen && (
      <MotionDiv initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
        <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
        {badge && (
          <span style={{ fontSize: '0.65rem', background: '#312e81', color: '#a5b4fc', padding: '2px 6px', borderRadius: '10px', fontWeight: '800' }}>{badge}</span>
        )}
      </MotionDiv>
    )}
    {active && (
      <MotionDiv 
        layoutId="activeIndicator"
        style={{ position: 'absolute', left: 0, width: '3px', height: '18px', background: '#6366f1', borderRadius: '0 4px 4px 0' }} 
      />
    )}
  </button>
);

const HistorySidebar = ({ isOpen, setIsOpen, onSelectHistory, onDeleteHistoryEntry, onNewSearch, deviceId, apiUrl }) => {
  const [activeTab, setActiveTab] = useState('history'); // history, collections, analyses, favorites
  const [history, setHistory] = useState([]);
  const [collections, setCollections] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
          overflow: 'hidden',
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
          
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            style={{ 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none', 
              color: 'white', 
              width: '32px',
              height: '32px',
              borderRadius: '8px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <div style={{ padding: isOpen ? '0 16px 28px 16px' : '20px 12px 28px 12px' }}>
          <button 
            onClick={onNewSearch}
            style={{
              width: '100%',
              height: '50px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              border: 'none',
              borderRadius: '16px',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isOpen ? 'flex-start' : 'center',
              padding: isOpen ? '0 20px' : '0',
              gap: '12px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.6)',
              transition: 'all 0.3s ease'
            }}
          >
            <PlusCircle size={22} strokeWidth={2.5} /> 
            {isOpen && <MotionSpan initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Yeni Araştırma</MotionSpan>}
          </button>
        </div>

        <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SidebarItem 
            icon={<FolderHeart size={20} />} 
            label="Projeler" 
            isOpen={isOpen} 
            active={activeTab === 'collections'} 
            onClick={() => setActiveTab('collections')}
            badge={collections.length > 0 ? collections.length : null}
          />
          <SidebarItem 
            icon={<FileSearch size={20} />} 
            label="Analizler" 
            isOpen={isOpen} 
            active={activeTab === 'analyses'} 
            onClick={() => setActiveTab('analyses')} 
          />
          <SidebarItem 
            icon={<History size={20} />} 
            label="Geçmiş" 
            isOpen={isOpen} 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
          />
          <SidebarItem 
            icon={<Bookmark size={20} />} 
            label="Favoriler" 
            isOpen={isOpen} 
            active={activeTab === 'favorites'} 
            onClick={() => setActiveTab('favorites')} 
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isOpen ? '32px 16px' : '20px 0' }}>
          {isOpen && (
            <AnimatePresence mode="wait">
              {activeTab === 'history' && (
                <MotionDiv key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: '8px' }}>Son Aramalar</span>
                  {history.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>Henüz arama yapılmadı.</div>
                  ) : (
                    history.slice(0, 15).map(item => (
                      <div key={item._id} onClick={() => onSelectHistory(item)} style={{ padding: '12px', borderRadius: '10px', cursor: 'pointer', background: 'rgba(30, 41, 59, 0.4)', position: 'relative', transition: 'all 0.2s ease' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteHistoryEntry(item._id); }} 
                          style={{ 
                            position: 'absolute', 
                            top: '8px', 
                            right: '8px', 
                            background: 'transparent', 
                            border: 'none', 
                            color: '#f43f5e', 
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            zIndex: 10
                          }}
                          onMouseOver={(e) => { 
                            e.currentTarget.style.background = '#f43f5e'; 
                            e.currentTarget.style.color = '#ffffff'; 
                          }}
                          onMouseOut={(e) => { 
                            e.currentTarget.style.background = 'transparent'; 
                            e.currentTarget.style.color = '#f43f5e'; 
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#f1f5f9', paddingRight: '20px' }}>{item.mainTopic || item.aiQuery}</div>
                      </div>
                    ))
                  )}
                </MotionDiv>
              )}

              {activeTab === 'collections' && (
                <MotionDiv key="collections" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: '8px' }}>Projeler</span>
                  {collections.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>Henüz proje oluşturulmadı.</div>
                  ) : (
                    collections.map(col => (
                      <div key={col._id} style={{ padding: '14px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f1f5f9' }}>{col.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: '600' }}>{col.papers.length} Makale</div>
                      </div>
                    ))
                  )}
                </MotionDiv>
              )}

              {activeTab === 'analyses' && (
                <MotionDiv key="analyses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center', padding: '20px' }}>
                  <FileSearch size={32} color="#475569" style={{ margin: '0 auto' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#f1f5f9' }}>Akıllı Analizler</span>
                  <p style={{ fontSize: '0.7rem', color: '#475569' }}>AI tarafından oluşturulan literatür sentezleri burada görünecek. (Yakında)</p>
                </MotionDiv>
              )}

              {activeTab === 'favorites' && (
                <MotionDiv key="favorites" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center', padding: '20px' }}>
                  <Bookmark size={32} color="#475569" style={{ margin: '0 auto' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#f1f5f9' }}>Favori Makaleler</span>
                  <p style={{ fontSize: '0.7rem', color: '#475569' }}>Yıldızladığınız kritik makalelere buradan hızlıca ulaşabileceksiniz.</p>
                </MotionDiv>
              )}
            </AnimatePresence>
          )}
        </div>

        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
           <SidebarItem icon={<Settings size={18} />} label="Ayarlar" isOpen={isOpen} active={false} onClick={() => {}} />
           <SidebarItem icon={<HelpCircle size={18} />} label="Yardım" isOpen={isOpen} active={false} onClick={() => {}} />
        </div>

        {!isOpen && !isMobile && (
          <button onClick={() => setIsOpen(true)} style={{ position: 'absolute', top: '100px', left: '50%', transform: 'translateX(-50%)', background: 'none', border: 'none', color: '#475569' }}>
            <ChevronRight size={20} />
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
