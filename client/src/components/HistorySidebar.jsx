import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
const MotionAside = motion.aside;
const MotionDiv = motion.div;
import {
  Trash2, PlusCircle, Star, BookmarkCheck, PenLine, Download, FolderOpen, PanelLeftClose, PanelLeftOpen,
  FileText, Pencil, Copy, AlertTriangle, Search, KeyRound, LifeBuoy,
} from 'lucide-react';
import { toBibTeX, toRIS, downloadText } from '../utils/citationExport.js';
import { AppUserButton, useAppAuth, useAppUser } from '../auth/clerkBridge.js';
import { useI18n } from '../i18n/context.js';
import { readDraft } from './workspace/drafts.js';
import BrandMark from './ui/BrandMark.jsx';

// Sunucudaki favoriler koleksiyonunun adı (veri anahtarı; kullanıcıya
// gösterilen etiket sözlükten gelir).
const FAVORITES = 'Favoriler';

/**
 * Kenar çubuğu öğesi. `kind` görsel rolü belirler (WO-024): `nav` bölümler
 * (Araştırma, Yaz) — güçlü seçili hal ve sol çizgi; `tab` içerik sekmeleri —
 * sakin seçili hal; `util` hesap grubu (bağlantılar, yardım). Kapalı rayda
 * ipucu sağa açılır (TooltipLayer, `data-tip-side`).
 */
const SidebarItem = ({ icon, label, isOpen, active, onClick, badge, basketTarget = false, action, extra, kind = 'tab' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`sb-item sb-item--${kind}${active ? ' is-active' : ''}`}
    data-basket-target={basketTarget || undefined}
    data-action={action}
    title={isOpen ? undefined : (extra ? `${label} · ${extra}` : label)}
    data-tip-side={isOpen ? undefined : 'right'}
    aria-label={extra ? `${label} · ${extra}` : label}
    aria-current={active ? 'page' : undefined}
  >
    <span className="sb-item__icon">{icon}</span>
    {isOpen && <span className="sb-item__label">{label}</span>}
    {extra && <span className="sb-sr">{extra}</span>}
    {isOpen && badge && <span className="sb-item__badge">{badge}</span>}
    {active && kind === 'nav' && <motion.span layoutId="sidebar-active-indicator" className="sb-item__bar" />}
  </button>
);

/** Taslağın DOCX yedeği; yazar modu açılmadan, kayıtlı HTML'den üretilir. */
async function backupDraft(draft, fallbackTitle) {
  const data = readDraft(window.localStorage, draft.id);
  if (!data) return false;
  const root = document.createElement('div');
  root.innerHTML = data.html || '';
  const { exportDocx } = await import('./workspace/exportDocument.js');
  const setup = { size: 'a4', landscape: false, font: 'Times New Roman', fontSize: 12, ...(data.setup || {}) };
  await exportDocx({ root, setup, title: data.title || fallbackTitle });
  return true;
}

// Eski adresler ve dış çağrılar için sekme adları (WO-011).
const TAB_ALIASES = { works: 'works', history: 'works', analyses: 'works', basket: 'basket', favorites: 'favorites' };

const HistorySidebar = ({
  isOpen, setIsOpen, deviceId, apiUrl, onSelectHistory, onDeleteHistoryEntry, onNewSearch, basket, onOpenWriter,
  drafts = [], activeDraftId = null, onOpenDraft, onNewDraft, onRenameDraft, onDuplicateDraft, onDeleteDraft,
  // Tek panel kabuk (WO-017): rayın en üstünde bölümler; sidebar yazım yüzeyinin üstüne açılabilsin diye `raised`.
  section = 'research', onGoResearch, writeExtra = null, raised = false, onOpenAi, onOpenHelp,
}) => {
  const { t, lang } = useI18n();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('works');
  const [backupFailed, setBackupFailed] = useState(null);
  // Sepeti temizlemek iki adımlı: 30 makale tek yanlış tıklamayla gitmesin.
  const [clearArmed, setClearArmed] = useState(false);
  const clearTimer = useRef(null);
  useEffect(() => () => clearTimeout(clearTimer.current), []);
  const clearBasket = () => {
    clearTimeout(clearTimer.current);
    if (!clearArmed) {
      setClearArmed(true);
      clearTimer.current = setTimeout(() => setClearArmed(false), 3000);
      return;
    }
    setClearArmed(false);
    basket.clear();
  };
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
    // Eski adresler (#/alanim, #/kaynaklar/sepet …) bu olayla sekme açar.
    const openNamed = (e) => {
      const tab = TAB_ALIASES[e.detail];
      if (tab) { setActiveTab(tab); setIsOpen(true); }
    };
    window.addEventListener('openBasket', openBasket);
    window.addEventListener('openSidebarTab', openNamed);
    return () => {
      window.removeEventListener('openBasket', openBasket);
      window.removeEventListener('openSidebarTab', openNamed);
    };
  }, [setIsOpen]);

  const savedText = (when) => (when
    ? new Date(when).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—');

  const runBackup = async (draft) => {
    setBackupFailed(null);
    try {
      if (!(await backupDraft(draft, t('workspace.untitled')))) setBackupFailed(draft.id);
    } catch (e) {
      console.error('DOCX yedeği alınamadı', e);
      setBackupFailed(draft.id);
    }
  };

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
    // Üç istek birbirinden bağımsız: sırayla beklemek açılışı üç kat uzatıyordu.
    Promise.all([fetchHistory(), fetchCollections(), fetchAnalyses()]);
    window.addEventListener('refreshHistory', fetchHistory);
    window.addEventListener('refreshCollections', fetchCollections);
    window.addEventListener('refreshAnalyses', fetchAnalyses);
    return () => {
      window.removeEventListener('refreshHistory', fetchHistory);
      window.removeEventListener('refreshCollections', fetchCollections);
      window.removeEventListener('refreshAnalyses', fetchAnalyses);
    };
  }, [fetchHistory, fetchCollections, fetchAnalyses]);

  const emptyBox = (msg) => <div className="sb-empty">{msg}</div>;

  const favorites = collections.find((c) => c.name === FAVORITES);
  const basketPapers = basket?.papers || [];
  const basketLimit = basket?.limit || 30;
  const toggleLabel = isOpen ? t('sidebar.collapse') : t('sidebar.expand');

  return (
    <>
      <AnimatePresence>
        {isMobile && isOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="sb-scrim" style={{ zIndex: raised ? 'calc(var(--z-surface-over) - 1)' : 'calc(var(--z-rail) - 1)' }} />
        )}
      </AnimatePresence>

      <MotionAside
        initial={false}
        animate={{ width: isOpen ? '280px' : (isMobile ? '0px' : '72px'), x: (isMobile && !isOpen) ? -280 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        aria-label={t('sidebar.label')}
        className={`sb${isOpen ? ' is-open' : ''}`}
        style={{ zIndex: raised ? 'var(--z-surface-over)' : 'var(--z-rail)' }}
      >
        {/* Başlık: marka ve daralt/genişlet. Düğme eskiden kenarın ortasında
            yüzüyor, içeriğin üstüne biniyordu. */}
        <div className="sb-head">
          <BrandMark size={32} className="sb-head__mark" />
          {isOpen && <span className="sb-head__brand" translate="no">{t('shell.brand')}</span>}
          {!isMobile && isOpen && (
            <button type="button" className="sb-icon-btn sb-head__toggle" onClick={() => setIsOpen(false)} aria-label={toggleLabel} title={toggleLabel}>
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>
        {!isMobile && !isOpen && (
          <div className="sb-pad">
            <button type="button" className="sb-icon-btn sb-rail-toggle" onClick={() => setIsOpen(true)} aria-label={toggleLabel} title={toggleLabel} data-tip-side="right">
              <PanelLeftOpen size={18} />
            </button>
          </div>
        )}

        {/* Yeni arama */}
        <div className="sb-pad">
          <button type="button" className="sb-primary" onClick={() => { onNewSearch(); closeOnMobile(); }} title={isOpen ? undefined : t('sidebar.newSearch')} data-tip-side={isOpen ? undefined : 'right'} aria-label={t('sidebar.newSearch')}>
            <PlusCircle size={16} strokeWidth={2} />
            {isOpen && <span>{t('sidebar.newSearch')}</span>}
          </button>
        </div>

        {/* Bölümler (WO-017): Araştırma ilk sırada; Yaz aynı kabukta, ayrı mod değil. */}
        <nav aria-label={t('sidebar.sections')} className="sb-group">
          <SidebarItem kind="nav" icon={<Search size={18} />} label={t('sidebar.research')} isOpen={isOpen} active={section === 'research'} action="nav-research" onClick={() => { onGoResearch?.(); closeOnMobile(); }} />
          <SidebarItem kind="nav" icon={<PenLine size={18} />} label={t('sidebar.write')} isOpen={isOpen} active={section === 'write'} action="writer-dock" extra={writeExtra} onClick={() => { onOpenWriter?.(); closeOnMobile(); if (!isMobile) setIsOpen(false); }} />
        </nav>

        {/* İçerik sekmeleri */}
        <nav aria-label={t('sidebar.works')} className="sb-group sb-group--tabs">
          <SidebarItem icon={<FolderOpen size={18} />} label={t('sidebar.works')} isOpen={isOpen} active={activeTab === 'works'} onClick={() => openTab('works')} badge={drafts.length || null} />
          <SidebarItem icon={<Star size={18} />} label={t('sidebar.favorites')} isOpen={isOpen} active={activeTab === 'favorites'} onClick={() => openTab('favorites')} badge={favorites?.papers?.length || null} />
          <SidebarItem icon={<BookmarkCheck size={18} />} label={t('basket.title')} isOpen={isOpen} active={activeTab === 'basket'} onClick={() => openTab('basket')} badge={basketPapers.length ? `${basketPapers.length}/${basketLimit}` : null} basketTarget />
        </nav>

        {/* İçerik */}
        <div className={`sb-body${isOpen ? '' : ' is-rail'}`}>
          {isOpen && (
            <AnimatePresence mode="wait">
              {activeTab === 'works' && (
                <MotionDiv key="works" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="sb-stack" data-testid="sidebar-works">
                  <div className="sb-section-head">
                    <span className="sb-label">{t('sidebar.drafts')}</span>
                    <button type="button" className="sb-chip-btn" onClick={() => { onNewDraft?.(); closeOnMobile(); }} data-action="draft-new">
                      <PlusCircle size={13} /> {t('sidebar.newDraft')}
                    </button>
                  </div>
                  {drafts.length === 0 ? emptyBox(t('sidebar.noDrafts')) : drafts.map((d) => {
                    const current = d.id === activeDraftId;
                    const name = d.title || t('workspace.untitled');
                    return (
                      <div key={d.id} data-draft-id={d.id} className={`sb-draft${current ? ' is-current' : ''}`}>
                        <button type="button" className="sb-draft__open" onClick={() => { onOpenDraft?.(d.id); closeOnMobile(); }} data-action="draft-open" title={t('sidebar.openDraft')}>
                          <FileText size={14} className="sb-draft__icon" />
                          <span className="sb-draft__text">
                            <span className="sb-draft__name">
                              {name}{current && <small className="sb-draft__badge">· {t('sidebar.activeDraft')}</small>}
                            </span>
                            <span className="sb-meta">{t('sidebar.draftMeta', { n: (d.words || 0).toLocaleString(locale), when: savedText(d.savedAt) })}</span>
                            {d.section && <span className="sb-meta sb-ellipsis">{t('sidebar.draftSection', { name: d.section })}</span>}
                          </span>
                        </button>
                        <div role="group" aria-label={t('sidebar.draftActions')} className="sb-draft__actions">
                          <button type="button" className="sb-icon-btn" onClick={() => onRenameDraft?.(d.id)} title={t('sidebar.renameDraft')} aria-label={t('sidebar.renameDraft')} data-action="draft-rename"><Pencil size={14} /></button>
                          <button type="button" className="sb-icon-btn" onClick={() => onDuplicateDraft?.(d.id)} title={t('sidebar.duplicateDraft')} aria-label={t('sidebar.duplicateDraft')} data-action="draft-duplicate"><Copy size={14} /></button>
                          <button type="button" className="sb-icon-btn" onClick={() => runBackup(d)} title={t('sidebar.backup')} aria-label={t('sidebar.backup')} data-action="draft-backup"><Download size={14} /></button>
                          <button type="button" className="sb-icon-btn sb-icon-btn--danger" onClick={() => onDeleteDraft?.(d.id)} title={t('sidebar.deleteDraft')} aria-label={t('sidebar.deleteDraft')} data-action="draft-delete"><Trash2 size={14} /></button>
                        </div>
                        {backupFailed === d.id && <span role="alert" className="sb-error">{t('sidebar.backupFailed')}</span>}
                      </div>
                    );
                  })}
                  {drafts.length > 0 && (
                    <p data-testid="drafts-local-warn" className="sb-warn">
                      <AlertTriangle size={13} /> {t('sidebar.localWarn')}
                    </p>
                  )}

                  <span className="sb-label sb-label--gap">{t('sidebar.recent')}</span>
                  {history.length === 0 ? emptyBox(t('sidebar.historyEmpty')) : history.slice(0, 40).map((item) => {
                    const displayTitle = item.mainTopic || item.aiQuery || (Array.isArray(item.keywords) && item.keywords.length > 0 ? item.keywords.join(', ') : t('sidebar.untitledSearch'));
                    return (
                      <div key={item._id} className="sb-row">
                        <button type="button" className="sb-row__main" onClick={() => { onSelectHistory(item); closeOnMobile(); }}>
                          {displayTitle}
                        </button>
                        {/* Dokunmatik ekranda üzerine gelme yok: silme düğmesi mobilde hep görünür. */}
                        <button type="button" className="sb-icon-btn sb-row__reveal" aria-label={t('sidebar.deleteEntry')} title={t('sidebar.deleteEntry')}
                          onClick={(e) => { e.stopPropagation(); onDeleteHistoryEntry(item._id); }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}

                  <span className="sb-label sb-label--gap">{t('sidebar.aiAnalyses')}</span>
                  {analyses.length === 0 ? emptyBox(t('sidebar.analysesEmpty')) : analyses.slice(0, 30).map((a) => (
                    <div key={a._id} className="sb-card">
                      <div className="sb-card__title sb-ellipsis">{a.topic}</div>
                      {a.explanation && <div className="sb-meta sb-clamp2">{a.explanation}</div>}
                      {/* Eskiden her sorgunun model ürettiği "uygunluk" puanı %70–99
                          aralığında yüzde gibi gösteriliyordu (CLAUDE.md 2.8). */}
                      {(a.queries || []).length > 0 && <span className="sb-meta">{t('sidebar.queryCount', { n: a.queries.length })}</span>}
                    </div>
                  ))}
                </MotionDiv>
              )}

              {activeTab === 'basket' && (
                <MotionDiv key="basket" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="sb-stack">
                  <div className="sb-section-head">
                    <span className="sb-label">{t('basket.title')}</span>
                    <span className="sb-count">{basketPapers.length}/{basketLimit}</span>
                  </div>
                  <p className="sb-meta sb-hint">{t('basket.hint')}</p>

                  {basketPapers.length === 0 ? emptyBox(t('basket.empty')) : (
                    <>
                      <ol className="sb-list">
                        {basketPapers.map((p, i) => (
                          <li key={p._id || `${p.doi || p.title}-${i}`} className="sb-paper">
                            <span className="sb-paper__n">{i + 1}</span>
                            <div className="sb-paper__text">
                              <a href={p.url || (p.doi ? `https://doi.org/${p.doi}` : '#')} target="_blank" rel="noopener noreferrer" className="sb-paper__title">
                                {p.title || t('sidebar.untitled')}
                              </a>
                              <span className="sb-meta sb-ellipsis">
                                {[String(p.authors || p.creator || '').split(',')[0], p.year].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                            <button type="button" className="sb-icon-btn" onClick={() => basket.remove(p)} title={t('basket.remove')} aria-label={t('basket.remove')}><Trash2 size={13} /></button>
                          </li>
                        ))}
                      </ol>

                      <button type="button" className="sb-primary sb-primary--sm" onClick={() => { onOpenWriter?.(); closeOnMobile(); }}>
                        <PenLine size={14} /> {t('basket.write')}
                      </button>
                      <div className="sb-split">
                        {[['bib', 'BibTeX', 'basket-bibtex'], ['ris', 'RIS', 'basket-ris']].map(([fmt, label, action]) => (
                          <button key={fmt} type="button" className="sb-secondary" onClick={() => exportBasket(fmt)} title={t('basket.exportHint')} data-action={action}>
                            <Download size={13} /> {label}
                          </button>
                        ))}
                      </div>
                      <button type="button" className={`sb-danger-btn${clearArmed ? ' is-armed' : ''}`} onClick={clearBasket} data-action="basket-clear">
                        {clearArmed ? t('basket.clearConfirm') : t('basket.clear')}
                      </button>
                    </>
                  )}
                  {basket?.offline && <span className="sb-warn">{t('basket.offline')}</span>}
                </MotionDiv>
              )}

              {activeTab === 'favorites' && (
                <MotionDiv key="favorites" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="sb-stack">
                  <span className="sb-label">{t('sidebar.favorites')}</span>
                  {!favorites?.papers?.length ? emptyBox(t('sidebar.favoritesEmpty')) : favorites.papers.map((p) => (
                    <div key={p._id} className="sb-row">
                      <a href={p.url || '#'} target={p.url ? '_blank' : undefined} rel="noopener noreferrer" className="sb-row__main">{p.title || t('sidebar.untitled')}</a>
                      <button type="button" className="sb-icon-btn" onClick={() => removePaper(favorites._id, p._id)} title={t('sidebar.removeFavorite')} aria-label={t('sidebar.removeFavorite')}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </MotionDiv>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Hesap: ayarlar ve destek içerik sekmelerinin arasında değil, burada. */}
        <div className="sb-foot">
          <nav aria-label={t('sidebar.account')} className="sb-group sb-group--util">
            {onOpenAi && <SidebarItem kind="util" icon={<KeyRound size={18} />} label={t('sidebar.ai')} isOpen={isOpen} action="nav-ai" onClick={() => { onOpenAi(); closeOnMobile(); }} />}
            {onOpenHelp && <SidebarItem kind="util" icon={<LifeBuoy size={18} />} label={t('help.open')} isOpen={isOpen} action="nav-help" onClick={() => { onOpenHelp(); closeOnMobile(); }} />}
          </nav>
          {user && (
            <div className={`sb-user${isOpen ? '' : ' is-rail'}`}>
              <AppUserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: '34px', height: '34px' } } }} />
              {isOpen && (
                <div className="sb-user__text">
                  <span className="sb-user__name">{user.fullName}</span>
                  <span className="sb-meta">{t('sidebar.freePlan')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </MotionAside>
    </>
  );
};

export default HistorySidebar;
