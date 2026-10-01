import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Share2, CheckCircle2, Copy, Linkedin, Mail } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

// ESLint yapılandırmasında eslint-plugin-react yok; JSX içindeki motion.div
// "kullanım" sayılmıyor. Büyük harfli takma ad bu yanlış pozitifi kaldırıyor.
const MotionDiv = motion.div;

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function ShareModal({ show, onClose, shareUrl, copied, onCopy }) {
  const { t } = useI18n();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!show) return undefined;
    inputRef.current?.select();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, onClose]);

  if (!show) return null;

  const url = shareUrl || '';
  const options = [
    { key: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={17} />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { key: 'whatsapp', label: 'WhatsApp', icon: <WhatsAppIcon />, href: `https://wa.me/?text=${encodeURIComponent(`${t('share.message')}\n\n${url}`)}` },
    { key: 'email', label: t('share.email'), icon: <Mail size={17} />, href: `mailto:?subject=${encodeURIComponent(t('share.subject'))}&body=${encodeURIComponent(`${t('share.message')}\n\n${url}`)}` },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'grid', placeItems: 'center', padding: '16px' }}>
      <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }} />
      <MotionDiv
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ position: 'relative', width: '100%', maxWidth: '460px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-lg)', display: 'grid', gap: 'var(--space-4)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Share2 size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="share-title" style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{t('share.title')}</h3>
            <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{t('share.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="ui-btn ui-btn--ghost ui-btn--icon"><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            id="share-url"
            ref={inputRef}
            readOnly
            value={url}
            aria-label={t('share.link')}
            onFocus={(e) => e.target.select()}
            className="input"
            style={{ flex: 1, minWidth: 0, height: '40px', paddingLeft: '12px', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}
          />
          <button type="button" onClick={onCopy} className={`ui-btn ${copied ? 'ui-btn--outline' : 'ui-btn--primary'}`} style={{ height: '40px', color: copied ? 'var(--score-high)' : undefined }}>
            {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
            {copied ? t('share.copied') : t('share.copy')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          {options.map((o) => (
            <a key={o.key} href={o.href} target={o.key === 'email' ? undefined : '_blank'} rel="noopener noreferrer" className="ui-btn ui-btn--outline" style={{ textDecoration: 'none' }}>
              {o.icon} {o.label}
            </a>
          ))}
        </div>
      </MotionDiv>
    </div>
  );
}
