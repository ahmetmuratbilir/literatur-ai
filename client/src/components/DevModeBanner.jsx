import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Clerk yapılandırılmadığında sayfanın üstünde duran uyarı şeridi.
 *
 * Tam ekran bir hata sayfası yerine şerit kullanılıyor: geliştirici arayüzün
 * geri kalanını görebilmeli, ama gerçek kimlik doğrulamanın devre dışı
 * olduğunu da gözden kaçırmamalı.
 */
export default function DevModeBanner() {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 16px',
        background: '#fef3c7',
        borderBottom: '1px solid #f0c860',
        color: '#78350f',
        fontSize: '13.5px',
        lineHeight: 1.5,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Geliştirme modu — kimlik doğrulama kapalı.</strong>{' '}
        <code style={{ fontSize: '12.5px' }}>VITE_CLERK_PUBLISHABLE_KEY</code> tanımlı
        olmadığı için giriş ekranı atlanıyor ve sabit bir test kullanıcısı
        kullanılıyor. Arayüzü gezebilirsin, ama bu haliyle yayına alınamaz.
        Gerçek girişi açmak için{' '}
        <a
          href="https://dashboard.clerk.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#78350f', fontWeight: 600 }}
        >
          Clerk
        </a>{' '}
        anahtarını <code style={{ fontSize: '12.5px' }}>client/.env</code> içine ekle ve
        Vite'ı yeniden başlat.
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Uyarıyı kapat"
        style={{
          background: 'none',
          border: 0,
          color: '#78350f',
          cursor: 'pointer',
          padding: '2px',
          flexShrink: 0,
          lineHeight: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
