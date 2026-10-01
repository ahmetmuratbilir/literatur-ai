import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
const MotionAside = motion.aside;
const MotionDiv = motion.div;
import {
  History, Trash2, PlusCircle, Zap, Star, ChevronRight, ChevronLeft, FileSearch, BookmarkCheck, PenLine, Download
} from 'lucide-react';
import { toBibTeX, toRIS, downloadText } from '../utils/citationExport.js';
import { AppUserButton, useAppAuth, useAppUser } from '../auth/clerkBridge.js';
import { useI18n } from '../i18n/context.js';

// Sunucudaki favoriler koleksiyonunun adı (veri anahtarı; kullanıcıya
// gösterilen etiket sözlükten gelir).
const FAVORITES = 'Favoriler';

const SidebarItem = ({ icon, label, isOpen, active, onClick, badge, basketTarget = false }) => (
  <button
    type="button"
    onClick={onClick}
    data-basket-target={basketTarget || undefined}
    title={isOpen ? undefined : label}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    style={{ width: '100%', padding: '8px 10px', background: active ? 'rgba(99, 102, 241, 0.16)' : 'transparent', border: 'none', borderRadius: '10px', color: active ? '#e0e7ff' : '#94a3b8', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', gap: '10px', cursor: 'pointer', transition: 'background 0.15s ease, color 0.15s ease', position: 'relative', height: '38px' }}
    onMouseOver={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e2e8f0'; } }}
    onMouseOut={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
  >
    <span style={{ display: 'grid', placeItems: 'center', minWidth: '20px', color: active ? '#a5b4fc' : 'inherit' }}>{icon}</span>
    {isOpen && <span style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>}
    {isOpen && badge && (
      <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: '0.68rem', padding: '1px 7px', borderRadius: '999px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{badge}</span>
    )}
    {active && (
      <motion.div layoutId="sidebar-active-indicator" style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px', background: '#6366f1', borderRadius: '0 4px 4px 0' }} />
    )}
  </button>
);

const sectionLabel = { fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '6px' };
const iconBtn = { background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', flexShrink: 0 };

const HistorySidebar = ({ isOpen, setIsOpen, deviceId, apiUrl, onSelectHistory, onDeleteHistoryEntry, onNewSearch, basket, onOpenWriter }) => {
  const { t } = useI18n();
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('history');
  const [collections, setCollections] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const { user } = useAppUser();
  const { getToken } = useAppAuth();

  // Mobilde bir seçim yapınca panel kapanmalı; aksi halde sonuç panelin
  // arkasında kalıyordu.
  const closeOnMobile = () => { if (isMobile) setIsOpen(false); };
  // Kapalı raydayken bir sekmeye basmak eskiden yalnızca sekmeyi değiştiriyor,
  // paneli açmıyordu: kullanıcı hiçbir şey görmüyordu.
  const openTab = (tab) => { setActiveTab(tab); if (!isOpen) setIsOpen(true); };

  const removePaper = async (collectionId, paperId) => {
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/collections/${collectionId}/papers/${paperId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      window.dispatchEvent(new CustomEvent('refreshCollections'));
    } catch (e) { console.error('Paper remove failed', e); }
  };

  // Alttaki sepet çubuğu bu olayla sepet sekmesini açar.
  useEffect(() => {
    const openBasket = () => { setActiveTab('basket'); setIsOpen(true); };
    window.addEventListener('openBasket', openBasket);
    return () => window.removeEventListener('openBasket', openBasket);
  }, [setIsOpen]);

  const exportBasket = (format) => {
    const papers = basket?.papers || [];
    if (!papers.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'bib') downloadText(`literatur-ai_kaynakca_${stamp}.bib`, toBibTeX(papers), 'application/x-bibtex');
    else downloadText(`literatur-ai_kaynakca_${stamp}.ris`, toRIS(papers), 'application/x-research-info-systems');
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchJson = useCallback(async (path, setter) => {
    if (!deviceId) return;
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setter(await res.json());
    } catch (e) { console.error(`${path} fetch error:`, e); }
  }, [deviceId, apiUrl, getToken]);

  const fetchHistory = useCallback(() => fetchJson('/api/history', setHistory), [fetchJson]);
  const fetchCollections = useCallback(() => fetchJson('/api/collections', setCollections), [fetchJson]);
  const fetchAnalyses = useCallback(() => fetchJson('/api/analyses', setAnalyses), [fetchJson]);

  useEffect(() => {
    const init = async () => { await fetchHistory(); await fetchCollections(); await fetchAnalyses(); };
    init();
    window.addEventListener('refreshHistory', fetchHistory);
    window.addEventListener('refreshCollections', fetchCollections);
    window.addEventListener('refreshAnalyses', fetchAnalyses);
    return () => {
      window.removeEventListener('refreshHistory', fetchHistory);
      window.removeEventListener('refreshCollections', fetchCollections);
      window.removeEventListener('refreshAnalyses', fetchAnalyses);
    };
  }, [fetchHistory, fetchCollections, fetchAnalyses]);

  const emptyBox = (msg) => (
    <div style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)' }}>{msg}</div>
  );

  const favorites = collections.find((c) => c.name === FAVORITES);
  const basketPapers = basket?.papers || [];
  const basketLimit = basket?.limit || 30;

  return (
    <>
      <AnimatePresence>
        {isMobile && isOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 85 }} />
        )}
      </AnimatePresence>

      <MotionAside
        initial={false}
        animate={{ width: isOpen ? '280px' : (isMobile ? '0px' : '72px'), x: (isMobile && !isOpen) ? -280 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        aria-label={t('sidebar.label')}
        style={{ position: 'fixed', left: 0, top: 0, bottom: 0, background: '#0f172a', color: '#f8fafc', zIndex: 90, overflow: 'visible', display: 'flex', flexDirection: 'column', boxShadow: isOpen ? '10px 0 30px -10px rgba(0,0,0,0.5)' : 'none', willChange: 'width', borderRight: '1px solid rgba(255,255,255,0.05)', paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Başlık */}
        <div style={{ height: '64px', padding: isOpen ? '0 20px' : '0', display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', width: '32px', height: '32px', borderRadius: '9px', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Zap size={17} color="white" fill="white" />
          </div>
          {isOpen && <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'white', whiteSpace: 'nowrap' }}>{t('shell.brand')}</span>}
        </div>

        {/* Yeni arama */}
        <div style={{ padding: '0 12px 16px' }}>
          <button type="button" onClick={() => { onNewSearch(); closeOnMobile(); }} title={isOpen ? undefined : t('sidebar.newSearch')} aria-label={t('sidebar.newSearch')}
            style={{ width: '100%', height: '40px', background: '#6366f1', border: 'none', borderRadius: '10px', color: 'white', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', padding: isOpen ? '0 14px' : '0', gap: '10px', cursor: 'pointer', transition: 'background 0.15s ease' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#4f46e5'; }} onMouseOut={(e) => { e.currentTarget.style.background = '#6366f1'; }}>
            <PlusCircle size={16} strokeWidth={2} />
            {isOpen && <span>{t('sidebar.newSearch')}</span>}
          </button>
        </div>

        {/* Sekmeler */}
        <nav style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SidebarItem icon={<History size={18} />} label={t('sidebar.history')} isOpen={isOpen} active={activeTab === 'history'} onClick={() => openTab('history')} badge={history.length || null} />
          <SidebarItem icon={<Star size={18} />} label={t('sidebar.favorites')} isOpen={isOpen} active={activeTab === 'favorites'} onClick={() => openTab('favorites')} badge={favorites?.papers?.length || null} />
          <SidebarItem icon={<BookmarkCheck size={18} />} label={t('basket.title')} isOpen={isOpen} active={activeTab === 'basket'} onClick={() => openTab('basket')} badge={basketPapers.length ? `${basketPapers.length}/${basketLimit}` : null} basketTarget />
          <SidebarItem icon={<FileSearch size={18} />} label={t('sidebar.analyses')} isOpen={isOpen} active={activeTab === 'analyses'} onClick={() => openTab('analyses')} badge={analyses.length || null} />
        </nav>

        {/* İçerik */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isOpen ? '20px 16px' : '20px 0' }}>
          {isOpen && (
            <AnimatePresence mode="wait">
              {activeTab === 'history' && (
                <MotionDiv key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ ...sectionLabel, marginBottom: '4px' }}>{t('sidebar.recent')}</span>
                  {history.length === 0 ? emptyBox(t('sidebar.historyEmpty')) : history.slice(0, 40).map((item) => {
                    const displayTitle = item.mainTopic || item.aiQuery || (Array.isArray(item.keywords) && item.keywords.length > 0 ? item.keywords.join(', ') : t('sidebar.untitledSearch'));
                    return (
                      <div key={item._id} className="history-item-card-dark"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px', transition: 'background 0.15s ease' }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <button type="button" onClick={() => { onSelectHistory(item); closeOnMobile(); }}
                          style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '9px 10px', background: 'transparent', border: 'none', color: '#cbd5e1', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayTitle}
                        </button>
                        {/* Dokunmatik ekranda üzerine gelme yok: silme düğmesi mobilde hep görünür. */}
                        <button type="button" className="delete-btn-dark" aria-label={t('sidebar.deleteEntry')} title={t('sidebar.deleteEntry')}
                          onClick={(e) => { e.stopPropagation(); onDeleteHistoryEntry(item._id); }}
                          style={{ ...iconBtn, opacity: isMobile ? 0.7 : 0 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </MotionDiv>
              )}

              {activeTab === 'basket' && (
                <MotionDiv key="basket" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={sectionLabel}>{t('basket.title')}</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{basketPapers.length}/{basketLimit}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.5, paddingLeft: '6px' }}>{t('basket.hint')}</p>

                  {basketPapers.length === 0 ? emptyBox(t('basket.empty')) : (
                    <>
                      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {basketPapers.map((p, i) => (
                          <li key={p._id || `${p.doi || p.title}-${i}`} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, minWidth: '16px', paddingTop: '2px', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <a href={p.url || (p.doi ? `https://doi.org/${p.doi}` : '#')} target="_blank" rel="noopener noreferrer"
                                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.75rem', color: '#e2e8f0', textDecoration: 'none', lineHeight: 1.35, fontWeight: 500 }}>
                                {p.title || t('sidebar.untitled')}
                              </a>
                              <span style={{ display: 'block', fontSize: '0.66rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {[String(p.authors || p.creator || '').split(',')[0], p.year].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                            <button type="button" onClick={() => basket.remove(p)} style={iconBtn} title={t('basket.remove')} aria-label={t('basket.remove')}><Trash2 size={12} /></button>
                          </li>
                        ))}
                      </ol>

                      <button type="button" onClick={() => { onOpenWriter?.(); closeOnMobile(); }}
                        style={{ height: '36px', background: '#6366f1', border: 'none', borderRadius: '8px', color: 'white', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <PenLine size={14} /> {t('basket.write')}
                      </button>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {[['bib', 'BibTeX'], ['ris', 'RIS']].map(([fmt, label]) => (
                          <button key={fmt} type="button" onClick={() => exportBasket(fmt)} title={t('basket.exportHint')}
                            style={{ height: '32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#cbd5e1', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            <Download size={12} /> {label}
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => basket.clear()}
                        style={{ background: 'transparent', border: '1px dashed rgba(244, 63, 94, 0.3)', color: '#fb7185', borderRadius: '6px', padding: '5px 8px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t('basket.clear')}
                      </button>
                    </>
                  )}
                  {basket?.offline && <span style={{ fontSize: '0.66rem', color: '#f59e0b', paddingLeft: '6px' }}>{t('basket.offline')}</span>}
                </MotionDiv>
              )}

              {activeTab === 'analyses' && (
                <MotionDiv key="analyses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={sectionLabel}>{t('sidebar.aiAnalyses')}</span>
                  {analyses.length === 0 ? emptyBox(t('sidebar.analysesEmpty')) : analyses.slice(0, 30).map((a) => (
                    <div key={a._id} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.topic}</div>
                      {a.explanation && <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '6px' }}>{a.explanation}</div>}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(a.queries || []).slice(0, 3).map((q, qi) => (
                          <span key={qi} style={{ fontSize: '0.62rem', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>%{q.relevanceScore}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </MotionDiv>
              )}

              {activeTab === 'favorites' && (
                <MotionDiv key="favorites" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={sectionLabel}>{t('sidebar.favorites')}</span>
                  {!favorites?.papers?.length ? emptyBox(t('sidebar.favoritesEmpty')) : favorites.papers.map((p) => (
                    <div key={p._id} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <a href={p.url || '#'} target={p.url ? '_blank' : undefined} rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#cbd5e1', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{p.title || t('sidebar.untitled')}</a>
                      <button type="button" onClick={() => removePaper(favorites._id, p._id)} style={iconBtn} title={t('sidebar.removeFavorite')} aria-label={t('sidebar.removeFavorite')}><Trash2 size={11} /></button>
                    </div>
                  ))}
                </MotionDiv>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Kullanıcı. "Ayarlar" ve "Yardım" öğeleri kaldırıldı: hiçbir şey
            yapmıyorlardı (onClick boştu). */}
        {user && (
          <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ padding: isOpen ? '10px 8px' : '6px 0', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', gap: '12px', overflow: 'hidden' }}>
              <AppUserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: '34px', height: '34px', border: '2px solid rgba(99, 102, 241, 0.3)' } } }} />
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.fullName}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8' }}>{t('sidebar.freePlan')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aç / kapat (masaüstü) */}
        {!isMobile && (
          <button type="button" onClick={() => setIsOpen(!isOpen)} aria-label={isOpen ? t('sidebar.collapse') : t('sidebar.expand')} title={isOpen ? t('sidebar.collapse') : t('sidebar.expand')}
            style={{ position: 'absolute', top: '50%', right: '-14px', transform: 'translateY(-50%)', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center', zIndex: 100, boxShadow: '4px 0 10px rgba(0,0,0,0.3)' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#6366f1'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#0f172a'; }}
          >
            {isOpen ? <ChevronLeft size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />}
          </button>
        )}
      </MotionAside>
    </>
  );
};

export default HistorySidebar;
