import { useI18n } from '../../i18n/context.js';

/** Hata sınırının kurtarma ekranı (WO-024): yeniden dene, yenile, bildir. */
export default function CrashFallback({ area, onRetry }) {
  const { t } = useI18n();
  // Sayfa düzeyinde uygulama çökmüş, yardım penceresini açacak dinleyici yok:
  // doğrudan e-posta. Bölüm düzeyinde uygulama ayakta, pencere açılır.
  const report = () => window.dispatchEvent(new CustomEvent('openHelp', { detail: { kind: 'hata' } }));
  const mail = `mailto:info@literatur-ai.com?subject=${encodeURIComponent(t('crash.title'))}`;
  return (
    <div className={`ui-crash ui-crash--${area}`} role="alert">
      <h2 className="ui-crash__title">{t('crash.title')}</h2>
      <p className="ui-crash__body">{t('crash.body')}</p>
      <div className="ui-crash__actions">
        <button type="button" className="ui-btn ui-btn--primary" onClick={onRetry} data-action="crash-retry">{t('common.retry')}</button>
        <button type="button" className="ui-btn ui-btn--outline" onClick={() => window.location.reload()} data-action="crash-reload">{t('crash.reload')}</button>
        {area === 'page'
          ? <a className="ui-btn ui-btn--ghost" href={mail} data-action="crash-report">{t('crash.report')}</a>
          : <button type="button" className="ui-btn ui-btn--ghost" onClick={report} data-action="crash-report">{t('crash.report')}</button>}
      </div>
    </div>
  );
}
