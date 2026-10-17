import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Loader2, WifiOff } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import { failedNames, sourceLabel } from './errorClass.js';

/**
 * Arama ekranının bekleme, hata, boş ve kısmi sonuç durumları (WO-021,
 * etkileşim planı §3–§5; prototip docs/design/mockup-durumlar.html).
 * Yalnız doğru olan gösterilir: geçen süre, sonuç şeklinde iskelet, İptal.
 * Aşama metni ya da sabit kaynak sayısı yok (tüzük 2.8).
 */

/** > 2 sn: iskelet + gerçek süre + İptal; > 20 sn: "beklenenden uzun". */
export function SearchWaiting({ elapsed, onCancel }) {
  const { t } = useI18n();
  if (elapsed < 2000) return null;
  return (
    <div className="ui-wait" role="status" aria-live="polite" data-testid="search-waiting">
      <div className="ui-wait__row">
        <Loader2 className="animate-spin" size={16} aria-hidden="true" />
        <span><strong>{t('states.searching')}</strong> · {t('states.elapsed', { n: Math.floor(elapsed / 1000) })}</span>
        <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={onCancel} data-action="search-cancel">{t('states.cancel')}</button>
      </div>
      {elapsed >= 20000 && (
        <div className="ui-notice ui-notice--warn" data-testid="search-slow">
          <AlertTriangle size={18} aria-hidden="true" />
          <div><strong>{t('states.slow')}</strong> {t('states.slowText')}</div>
        </div>
      )}
      <div aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ui-skel-card">
            <div className="ui-skel" style={{ width: '82%', height: 16 }} />
            <div className="ui-skel" style={{ width: '46%', height: 12 }} />
            <div className="ui-skel" style={{ width: '100%', height: 44 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** İptal edildi: "yapılmadı" demez (sunucuya ulaşmış istek sayılmış olabilir). */
export function SearchCancelled({ onRetry }) {
  const { t } = useI18n();
  return (
    <div className="ui-notice" role="status" data-testid="search-cancelled">
      <Info size={18} aria-hidden="true" />
      <div>
        <strong>{t('states.cancelled')}</strong> {t('states.cancelledText')}
        <div className="ui-notice__acts"><button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={onRetry}>{t('states.again')}</button></div>
      </div>
    </div>
  );
}

const ICONS = { offline: WifiOff, network: WifiOff, rate: AlertTriangle, timeout: AlertTriangle, auth: AlertTriangle, unavailable: Info };

/**
 * Hata: ne oldu, kaybedilen var mı, ne yapılacak. 429'da geri sayım.
 * Her yeni hatada `key` ile yeniden kurulur; sayaç baştan başlar.
 */
export function ErrorNotice({ error, onRetry, onSignIn }) {
  const { t } = useI18n();
  const [left, setLeft] = useState(error.kind === 'rate' ? error.retryAfter : 0);
  useEffect(() => {
    if (error.kind !== 'rate') return undefined;
    const id = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [error.kind]);
  const kind = error.kind;
  const Icon = ICONS[kind] || AlertCircle;
  const tone = kind === 'unavailable' ? '' : kind === 'server' || kind === 'sources' ? ' ui-notice--error' : ' ui-notice--warn';
  const list = failedNames(error.failedSources).join(', ');
  const text = t(`states.err.${kind}Text`, { n: left, list, message: error.message || '' });
  return (
    <div className={`ui-notice${tone}`} role={kind === 'server' || kind === 'sources' ? 'alert' : 'status'} data-testid="search-error" data-kind={kind}>
      <Icon size={18} aria-hidden="true" />
      <div>
        <strong>{t(`states.err.${kind}Title`)}</strong> {text}
        <div className="ui-notice__acts">
          {kind === 'auth' && onSignIn ? (
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={onSignIn}>{t('states.signIn')}</button>
          ) : (
            <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={onRetry} disabled={kind === 'rate' && left > 0} data-action="search-retry">
              {kind === 'rate' && left > 0 ? t('states.retryIn', { n: left }) : t('common.retry')}
            </button>
          )}
        </div>
        {(error.status || error.message) && (
          <details className="ui-notice__tech">
            <summary>{t('states.details')}</summary>
            <code>{[error.status, kind, error.message].filter(Boolean).join(' · ')}</code>
          </details>
        )}
      </div>
    </div>
  );
}

/** Boş sonuç: taranan kaynakları söyler; "çalışma yok" demez (2.8). */
export function EmptyResult({ sources, onImprove }) {
  const { t } = useI18n();
  const names = (sources || []).map(sourceLabel);
  return (
    <div className="ui-notice" role="status" data-testid="search-empty">
      <Info size={18} aria-hidden="true" />
      <div>
        <strong>{t('states.empty', { n: names.length || '—' })}</strong> {t('states.emptyText', { list: names.join(', ') || '—' })}
        {onImprove && <div className="ui-notice__acts"><button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={onImprove}>{t('states.improve')}</button></div>}
      </div>
    </div>
  );
}

/** Kısmi sonuç: yanıt vermeyen kaynaklar adıyla; sessiz kayıp yok (2.11). */
export function PartialSources({ failedSources, scanned }) {
  const { t } = useI18n();
  const names = failedNames(failedSources);
  if (!names.length) return null;
  return (
    <div className="ui-notice ui-notice--warn" role="status" data-testid="search-partial">
      <AlertTriangle size={18} aria-hidden="true" />
      <div><strong>{t('states.partial', { n: names.length, list: names.join(', ') })}</strong> {t('states.partialText', { n: scanned })}</div>
    </div>
  );
}
