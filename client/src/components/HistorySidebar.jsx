import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
const MotionAside = motion.aside;
const MotionDiv = motion.div;
const MotionSpan = motion.span;
import {
  History, Trash2, PlusCircle, FolderHeart, Plus, Zap, ShieldCheck, Settings,
  HelpCircle, Star, ChevronRight, ChevronLeft, Menu, FileSearch, Bookmark
} from 'lucide-react';
import { UserButton, useAuth, useUser } from '@clerk/clerk-react';

const SidebarItem = ({ icon, label, isOpen, active, onClick, badge }) => (
  <button
    onClick={onClick}
    style={{ width: '100%', padding: '8px 10px', background: active ? 'rgba(99, 102, 241, 0.16)' : 'transparent', border: 'none', borderRadius: '10px', color: active ? '#e0e7ff' : '#94a3b8', fontSize: '0.8125rem', fontWeight: active ? '600' : '500', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', gap: '10px', cursor: 'pointer', transition: 'background 0.15s ease, color 0.15s ease', position: 'relative', height: '36px' }}
    onMouseOver={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e2e8f0'; } }}
    onMouseOut={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '20px', color: active ? '#a5b4fc' : 'inherit' }}>{icon}</div>
    {isOpen && <span style={{ fontSize: '0.875rem', fontWeight: '600', whiteSpace: 'nowrap' }}>{label}</span>}
    {isOpen && badge && (
      <span style={{ position: 'absolute', right: '12px', background: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '999px', fontWeight: '700' }}>{badge}</span>
    )}
    {active && (
      <motion.div layoutId="sidebar-active-indicator" style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px', background: '#6366f1', borderRadius: '0 4px 4px 0' }} />
    )}
  </button>
);

const HistorySidebar = ({ isOpen, setIsOpen, deviceId, apiUrl, onSelectHistory, onDeleteHistoryEntry, onNewSearch }) => {
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('history');
  const [collections, setCollections] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [expandedCollectionIds, setExpandedCollectionIds] = useState(new Set());
  const [showNewCollForm, setShowNewCollForm] = useState(false);
  const [newCollName, setNewCollName] = useState('');
  const [creatingColl, setCreatingColl] = useState(false);
  const [collError, setCollError] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const { user } = useUser();
  const { getToken } = useAuth();

  const toggleCollection = (id) => {
    setExpandedCollectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const removePaper = async (collectionId, paperId) => {
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/collections/${collectionId}/papers/${paperId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      window.dispatchEvent(new CustomEvent('refreshCollections'));
    } catch (e) { console.error('Paper remove failed', e); }
  };

  const removeCollection = async (collectionId) => {
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/collections/${collectionId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      window.dispatchEvent(new CustomEvent('refreshCollections'));
    } catch (e) { console.error('Collection delete failed', e); }
  };

  const createCollection = async () => {
    const trimmed = newCollName.trim();
    if (!trimmed) return;
    setCreatingColl(true);
    setCollError('');
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (!res.ok) {
        setCollError(data.error || 'Koleksiyon oluşturulamadı.');
      } else {
        setNewCollName('');
        setShowNewCollForm(false);
        window.dispatchEvent(new CustomEvent('refreshCollections'));
      }
    } catch (e) {
      setCollError('Bağlantı hatası.');
    } finally {
      setCreatingColl(false);
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
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/history`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } catch (e) { console.error('History fetch error:', e); }
  }, [deviceId, apiUrl, getToken]);

  const fetchCollections = useCallback(async () => {
    if (!deviceId) return;
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/collections`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setCollections(await res.json());
    } catch (e) { console.error('Collections fetch error:', e); }
  }, [deviceId, apiUrl, getToken]);

  const fetchAnalyses = useCallback(async () => {
    if (!deviceId) return;
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/analyses`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setAnalyses(await res.json());
    } catch (e) { console.error('Analyses fetch error:', e); }
  }, [deviceId, apiUrl, getToken]);

  useEffect(() => {
    const init = async () => { await fetchHistory(); await fetchCollections(); await fetchAnalyses(); };
    init();
    const onHistory = () => fetchHistory();
    const onCollections = () => fetchCollections();
    const onAnalyses = () => fetchAnalyses();
    window.addEventListener('refreshHistory', onHistory);
    window.addEventListener('refreshCollections', onCollections);
    window.addEventListener('refreshAnalyses', onAnalyses);
    return () => {
      window.removeEventListener('refreshHistory', onHistory);
      window.removeEventListener('refreshCollections', onCollections);
      window.removeEventListener('refreshAnalyses', onAnalyses);
    };
  }, [fetchHistory, fetchCollections, fetchAnalyses]);

  const emptyBox = (msg) => (
    <div style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)' }}>{msg}</div>
  );

  return (
    <>
      <AnimatePresence>
        {isMobile && isOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 85 }} />
        )}
      </AnimatePresence>

      <MotionAside
        initial={false}
        animate={{ width: isOpen ? '280px' : (isMobile ? '0px' : '72px'), x: (isMobile && !isOpen) ? -280 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        style={{ position: 'fixed', left: 0, top: 0, bottom: 0, background: '#0f172a', color: '#f8fafc', zIndex: 90, overflow: 'visible', display: 'flex', flexDirection: 'column', boxShadow: isOpen ? '10px 0 30px -10px rgba(0,0,0,0.5)' : 'none', willChange: 'width', borderRight: '1px solid rgba(255,255,255,0.05)', paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Header */}
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

        {/* New Search Button */}
        <div style={{ padding: isOpen ? '0 12px 16px 12px' : '12px 12px 16px 12px' }}>
          <button onClick={onNewSearch} style={{ width: '100%', height: '40px', background: '#6366f1', border: 'none', borderRadius: '10px', color: 'white', fontSize: '0.8125rem', fontWeight: '600', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', padding: isOpen ? '0 14px' : '0', gap: '10px', cursor: 'pointer', transition: 'background 0.15s ease' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#4f46e5'} onMouseOut={(e) => e.currentTarget.style.background = '#6366f1'}>
            <PlusCircle size={16} strokeWidth={2} />
            {isOpen && <MotionSpan initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Yeni araştırma</MotionSpan>}
          </button>
        </div>

        {/* Nav Items */}
        <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SidebarItem icon={<Star size={18} />} label="Favoriler" isOpen={isOpen} active={activeTab === 'favorites'} onClick={() => setActiveTab('favorites')} badge={(() => { const fav = collections.find(c => c.name === 'Favoriler'); return fav?.papers?.length > 0 ? fav.papers.length : null; })()} />
          <SidebarItem icon={<History size={18} />} label="Geçmiş" isOpen={isOpen} active={activeTab === 'history'} onClick={() => setActiveTab('history')} badge={history.length > 0 ? history.length : null} />
          <SidebarItem icon={<FileSearch size={18} />} label="Analizler" isOpen={isOpen} active={activeTab === 'analyses'} onClick={() => setActiveTab('analyses')} badge={analyses.length > 0 ? analyses.length : null} />
          <SidebarItem icon={<FolderHeart size={18} />} label="Koleksiyonlar" isOpen={isOpen} active={activeTab === 'collections'} onClick={() => setActiveTab('collections')} badge={(() => { const n = collections.filter(c => c.name !== 'Favoriler').length; return n > 0 ? n : null; })()} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isOpen ? '24px 16px' : '20px 0' }}>
          {isOpen && (
            <AnimatePresence mode="wait">

              {/* History Tab */}
              {activeTab === 'history' && (
                <MotionDiv key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '6px' }}>Son Aramalar</span>
                  {history.length === 0 ? emptyBox('Henüz arama yapılmadı. İlk aramanız burada listelenecek.') : (
                    history.slice(0, 40).map(item => {
                      const displayTitle = item.mainTopic || item.aiQuery || (Array.isArray(item.keywords) && item.keywords.length > 0 ? item.keywords.join(', ') : 'İsimsiz Arama');
                      return (
                        <div key={item._id} onClick={() => onSelectHistory(item)} className="history-item-card-dark"
                          style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: 'transparent', border: '1px solid transparent', position: 'relative', transition: 'background 0.15s ease, border-color 0.15s ease' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                        >
                          <button className="delete-btn-dark" onClick={(e) => { e.stopPropagation(); onDeleteHistoryEntry(item._id); }}
                            style={{ position: 'absolute', top: '6px', right: '6px', background: 'transparent', border: 'none', color: '#64748b', width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s ease, background 0.15s ease, color 0.15s ease', zIndex: 10 }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.12)'; e.currentTarget.style.color = '#fb7185'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                          ><Trash2 size={12} /></button>
                          <div style={{ fontSize: '0.8125rem', fontWeight: '500', color: '#cbd5e1', paddingRight: '24px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</div>
                        </div>
                      );
                    })
                  )}
                </MotionDiv>
              )}

              {/* Collections Tab */}
              {activeTab === 'collections' && (
                <MotionDiv key="collections" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Koleksiyonlar</span>
                    <button type="button" onClick={() => { setShowNewCollForm(p => !p); setCollError(''); setNewCollName(''); }} style={{ background: 'rgba(99,102,241,0.12)', border: 'none', color: '#a5b4fc', borderRadius: '6px', padding: '3px 8px', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Plus size={11} /> Yeni
                    </button>
                  </div>

                  {showNewCollForm && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <input
                        autoFocus
                        type="text"
                        value={newCollName}
                        onChange={e => { setNewCollName(e.target.value); setCollError(''); }}
                        onKeyDown={e => e.key === 'Enter' && createCollection()}
                        placeholder="Koleksiyon adı..."
                        maxLength={60}
                        style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#f8fafc', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                      {collError && <span style={{ fontSize: '0.65rem', color: '#fb7185' }}>{collError}</span>}
                      <button type="button" disabled={creatingColl || !newCollName.trim()} onClick={createCollection}
                        style={{ background: '#6366f1', border: 'none', color: 'white', borderRadius: '6px', padding: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', opacity: (!newCollName.trim() || creatingColl) ? 0.5 : 1 }}>
                        {creatingColl ? 'Oluşturuluyor...' : 'Oluştur'}
                      </button>
                    </div>
                  )}

                  {collections.filter(c => c.name !== 'Favoriler').length === 0 ? emptyBox('Henüz koleksiyon yok. "Yeni" butonuyla oluşturun.') : (
                    collections.filter(c => c.name !== 'Favoriler').map(col => {
                      const expanded = expandedCollectionIds.has(col._id);
                      return (
                        <div key={col._id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <button type="button" onClick={() => toggleCollection(col._id)} style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontFamily: 'inherit', textAlign: 'left' }}>
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
                              {col.papers.length === 0 ? <span style={{ fontSize: '0.7rem', color: '#64748b', padding: '6px 8px' }}>Henüz makale yok.</span> : col.papers.map((p) => (
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

              {/* Analyses Tab */}
              {activeTab === 'analyses' && (
                <MotionDiv key="analyses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '6px' }}>AI Analizleri</span>
                  {analyses.length === 0 ? emptyBox('"AI ile geliştir" butonuna basınca analizler burada birikir.') : (
                    analyses.slice(0, 30).map(a => (
                      <div key={a._id} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.topic}</div>
                        {a.explanation && <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '6px' }}>{a.explanation}</div>}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(a.queries || []).slice(0, 3).map((q, qi) => (
                            <span key={qi} style={{ fontSize: '0.6rem', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>%{q.relevanceScore}</span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </MotionDiv>
              )}

              {/* Favorites Tab */}
              {activeTab === 'favorites' && (() => {
                const fav = collections.find(c => c.name === 'Favoriler');
                const papers = fav?.papers || [];
                return (
                  <MotionDiv key="favorites" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '6px' }}>Favoriler</span>
                    {papers.length === 0 ? emptyBox('Yıldızladığınız makaleler burada listelenir.') : (
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

        {/* Bottom Section */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SidebarItem icon={<Settings size={16} />} label="Ayarlar" isOpen={isOpen} active={false} onClick={() => {}} />
          <SidebarItem icon={<HelpCircle size={16} />} label="Yardım" isOpen={isOpen} active={false} onClick={() => {}} />
          {user && (
            <div style={{ marginTop: '12px', padding: isOpen ? '12px 8px' : '8px 0', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', gap: '12px', overflow: 'hidden' }}>
              <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: '36px', height: '36px', border: '2px solid rgba(99, 102, 241, 0.3)', boxShadow: '0 8px 18px -10px rgba(99, 102, 241, 0.8)' } } }} />
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.fullName}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '500', color: '#94a3b8' }}>Free Plan</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toggle Button */}
        {!isMobile && (
          <button onClick={() => setIsOpen(!isOpen)}
            style={{ position: 'absolute', top: '50%', right: '-14px', transform: 'translateY(-50%)', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 100, boxShadow: '4px 0 10px rgba(0,0,0,0.3)', outline: 'none' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)'; e.currentTarget.style.borderColor = '#818cf8'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
          >
            {isOpen ? <ChevronLeft size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />}
          </button>
        )}
      </MotionAside>

      {isMobile && !isOpen && (
        <button onClick={() => setIsOpen(true)} style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 80, background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
          <History size={24} />
        </button>
      )}
    </>
  );
};

export default HistorySidebar;
