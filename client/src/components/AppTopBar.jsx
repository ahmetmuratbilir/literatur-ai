import { Menu, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import LanguageSwitcher from './LanguageSwitcher.jsx';

/**
 * Uygulama üst çubuğu. Önceki sürümde üst çubuk yoktu: "Sistem" düğmesi ve
 * mobil geçmiş düğmesi içeriğin üzerinde yüzüyor, küçük ekranda başlıkla
 * çakışıyordu. Hepsi burada, akışın içinde.
 */
const AppTopBar = ({ isMobile, onOpenMenu, isAdmin, onOpenSystem }) => {
  const { t } = useI18n();

  return (
    <header className="ui-topbar">
      {isMobile && (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" onClick={onOpenMenu} aria-label={t('shell.menu')}>
          <Menu size={18} />
        </button>
      )}
      <span className="ui-topbar__spacer" />
      <div className="ui-topbar__actions">
        <LanguageSwitcher />
        {isAdmin && (
          <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={onOpenSystem} title={t('shell.systemStatus')}>
            <ShieldCheck size={14} />
            {!isMobile && t('shell.system')}
          </button>
        )}
      </div>
    </header>
  );
};

export default AppTopBar;
