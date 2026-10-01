import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

/**
 * Clerk yapılandırılmadığında sayfanın üstünde duran uyarı şeridi.
 *
 * Tam ekran bir hata sayfası yerine şerit kullanılıyor: geliştirici arayüzün
 * geri kalanını görebilmeli, ama gerçek kimlik doğrulamanın devre dışı
 * olduğunu da gözden kaçırmamalı. `ui-devbanner` masaüstünde sol kenar
 * çubuğunun genişliği kadar içeriden başlar; önceki sürümde metnin başı
 * sabit kenar çubuğunun altında kalıyordu.
 */
export default function DevModeBanner() {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  if (!open) return null;

  const code = { fontSize: '12.5px' };
  return (
    <div role="status" className="ui-devbanner">
      <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{t('dev.title')}</strong>{' '}
        {t('dev.before')} <code style={code}>VITE_CLERK_PUBLISHABLE_KEY</code> {t('dev.middle')}{' '}
        <a href="https://dashboard.clerk.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>Clerk</a>{' '}
        {t('dev.keyInto')} <code style={code}>client/.env</code> {t('dev.after')}
      </div>
      <button type="button" onClick={() => setOpen(false)} aria-label={t('dev.dismiss')}
        style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: '2px', flexShrink: 0, lineHeight: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}
