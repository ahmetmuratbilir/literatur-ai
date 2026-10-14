import { useEffect } from 'react';
import {
  FileText, LayoutDashboard, Library, ListChecks, Minimize2, PenLine, Search, ShieldCheck, UserRound, X, Zap,
} from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import { AppUserButton } from '../auth/clerkBridge.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { MODULES, routeForSession, sessionForRoute } from './routes.js';
import './shell.css';

const MODULE_ICONS = {
  home: LayoutDashboard,
  write: PenLine,
  sources: Library,
  audit: ListChecks,
};

const SESSION_ICONS = {
  search: Search,
  author: UserRound,
  draft: FileText,
  audit: ListChecks,
};

/**
 * Uygulama kabuğu (WO-010): ray · üst çubuk · açık çalışma sekmeleri · modül.
 *
 * Durum burada tutulmuyor; `App.jsx` adres, sekme listesi ve etiketleri
 * veriyor. Kabuk yalnız çiziyor ve gezinme isteğini geri iletiyor.
 */
export default function AppShell({
  route, navigate, sessions, sessionLabel, onCloseSession,
  basketCount = 0, focus = false, onExitFocus, isAdmin = false, onOpenSystem, onSearch,
  children,
}) {
  const { t } = useI18n();
  const activeSession = sessionForRoute(route);

  // Odak modundan Esc ile çıkılır (açık bir menü de aynı tuşla kapanır).
  useEffect(() => {
    if (!focus) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onExitFocus?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, onExitFocus]);

  const moduleLabel = t(`appShell.module.${route.module}`);
  const subLabel = route.module === 'sources' && route.tab ? t(`appShell.sources.${route.tab}`) : null;

  return (
    <div className="la-shell" data-focus={focus ? 'true' : undefined}>
      <nav className="la-rail" aria-label={t('appShell.rail')}>
        <button type="button" className="la-rail__brand" onClick={() => navigate({ module: 'home' })} aria-label={t('appShell.module.home')}>
          <Zap size={18} fill="currentColor" />
        </button>
        {MODULES.map((module) => {
          const Icon = MODULE_ICONS[module];
          const label = t(`appShell.module.${module}`);
          const current = route.module === module;
          return (
            <button
              key={module}
              type="button"
              className="la-rail__item"
              aria-current={current ? 'page' : undefined}
              aria-label={label}
              data-action={`rail-${module}`}
              // Sepete uçan etiketin hedefi: "Makalene ekle" animasyonu buraya iner.
              data-basket-target={module === 'sources' ? 'primary' : undefined}
              onClick={() => navigate(module === 'sources' ? { module, tab: route.module === 'sources' ? route.tab : 'search' } : { module })}
            >
              <Icon size={20} />
              {module === 'sources' && basketCount > 0 && <em className="la-rail__badge">{basketCount}</em>}
              <span className="la-tip" aria-hidden="true">{label}</span>
            </button>
          );
        })}
        <span className="la-rail__spacer" />
        <div className="la-rail__user">
          <AppUserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: '30px', height: '30px' } } }} />
        </div>
      </nav>

      <div className="la-frame">
        <header className="la-top">
          <span className="la-top__brand">{t('shell.brand')}</span>
          <nav className="la-crumbs" aria-label={t('appShell.crumbs')}>
            <span aria-hidden="true">/</span>
            {subLabel ? (
              <>
                <span>{moduleLabel}</span>
                <span aria-hidden="true">›</span>
                <strong>{subLabel}</strong>
              </>
            ) : <strong>{moduleLabel}</strong>}
          </nav>
          <span className="la-top__spacer" />
          <button type="button" className="la-search" onClick={onSearch} data-action="top-search" title={t('appShell.searchHint')}>
            <Search size={15} />
            <span>{t('appShell.search')}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="la-top__actions">
            <LanguageSwitcher />
            {isAdmin && (
              <button type="button" className="la-btn" onClick={onOpenSystem} data-action="top-system" title={t('shell.systemStatus')}>
                <ShieldCheck size={14} /> {t('shell.system')}
              </button>
            )}
          </div>
        </header>

        <div className="la-tabs" role="tablist" aria-label={t('appShell.tabs')}>
          {sessions.length === 0 && <span className="la-tabs__empty">{t('appShell.noTabs')}</span>}
          {sessions.map((session) => {
            const Icon = SESSION_ICONS[session];
            const label = sessionLabel(session);
            const selected = session === activeSession;
            return (
              <div key={session} className="la-tab" role="presentation" data-selected={selected ? 'true' : undefined}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className="la-tab__open"
                  data-action={`tab-${session}`}
                  title={label}
                  onClick={() => navigate(routeForSession(session))}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
                <button
                  type="button"
                  className="la-tab__close"
                  data-action={`tab-close-${session}`}
                  aria-label={t('appShell.closeTab', { name: label })}
                  title={t(session === 'search' ? 'appShell.closeSearchHint' : 'appShell.closeTabHint')}
                  onClick={() => onCloseSession(session)}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>

        <main className="la-main">{children}</main>
      </div>

      {focus && (
        <button type="button" className="la-focus-exit" onClick={onExitFocus} data-action="focus-exit">
          <Minimize2 size={14} /> {t('appShell.focusExit')}
        </button>
      )}
    </div>
  );
}
