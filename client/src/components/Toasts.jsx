import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

const MotionDiv = motion.div;

/** Tek bildirim; süresi dolunca kendini kapatır. */
const Toast = ({ toast, onDismiss }) => {
  const { t } = useI18n();
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 6000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const warn = toast.tone === 'warn';
  const Icon = warn ? AlertTriangle : CheckCircle2;
  return (
    <MotionDiv
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      role="status"
      className={`ui-toast ui-toast--${warn ? 'warn' : 'success'}`}
    >
      <Icon size={17} aria-hidden="true" />
      <div className="ui-toast__body">
        <strong>{toast.title}</strong>
        {toast.text && <span>{toast.text}</span>}
      </div>
      <button type="button" className="ui-toast__close" onClick={() => onDismiss(toast.id)} aria-label={t('common.close')}>
        <X size={14} />
      </button>
    </MotionDiv>
  );
};

/**
 * Sağ üstte bildirim yığını: arama sonrası kaynak durumu, "liste dolu" gibi
 * kısa geri bildirimler. Kaynak rozetleri sonuç sayfasında yer kaplıyordu.
 */
const Toasts = ({ toasts, onDismiss }) => (
  <div className="ui-toasts" aria-live="polite">
    <AnimatePresence initial={false}>
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />)}
    </AnimatePresence>
  </div>
);

export default Toasts;
