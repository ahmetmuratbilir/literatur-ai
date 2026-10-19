import { useEffect, useRef, useState } from 'react';
import { KeyRound, LifeBuoy, MoreHorizontal } from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import { useLayer } from './ui/useLayer.js';

/**
 * Hesap satırındaki ⋯ menüsü (WO-026 Faz 2, K1): seyrek kullanılan "Yapay zekâ
 * bağlantıları" ve "Yardım ve destek" kenar çubuğunun ana listesinden buraya.
 * Esc ve dışarı tıklama kapatır (WO-018 katman yığını); kapanınca odak düğmeye döner.
 */
export default function AccountMenu({ onOpenAi, onOpenHelp, onPicked }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  useLayer(open, close);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (fn) => () => {
    setOpen(false);
    fn();
    onPicked?.();
  };

  if (!onOpenAi && !onOpenHelp) return null;
  return (
    <div ref={rootRef} className="sb-acct">
      <button
        ref={buttonRef}
        type="button"
        className="sb-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('sidebar.accountMenu')}
        title={t('sidebar.accountMenu')}
        onClick={() => setOpen((o) => !o)}
        data-action="account-menu"
      >
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div className="sb-menu" role="menu" aria-label={t('sidebar.accountMenu')}>
          {onOpenAi && (
            <button type="button" role="menuitem" className="sb-menu__item" onClick={pick(onOpenAi)} data-action="nav-ai">
              <KeyRound size={15} /> {t('sidebar.ai')}
            </button>
          )}
          {onOpenHelp && (
            <button type="button" role="menuitem" className="sb-menu__item" onClick={pick(onOpenHelp)} data-action="nav-help">
              <LifeBuoy size={15} /> {t('help.open')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
