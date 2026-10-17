import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

const MotionDiv = motion.div;

/**
 * Tek bildirim; süresi dolunca kendini kapatır. Üzerine gelince ya da
 * klavyeyle içine girilince süre durur (WO-018): "Geri al"a yetişilsin.
 */
const Toast = ({ toast, onDismiss }) => {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  const left = useRef(toast.duration || 6000);
  useEffect(() => {
    if (paused) return undefined;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), left.current);
    return () => { clearTimeout(timer); left.current -= Date.now() - started; };
  }, [paused, toast.id, onDismiss]);

  const warn = toast.tone === 'warn';
  const Icon = warn ? AlertTriangle : CheckCircle2;
  return (
    <MotionDiv
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      role={warn ? 'alert' : 'status'}
      className={`ui-toast ui-toast--${warn ? 'warn' : 'success'}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}
    >
      <Icon size={17} aria-hidden="true" />
      <div className="ui-toast__body">
        <strong>{toast.title}</strong>
        {toast.text && <span>{toast.text}</span>}
        {/* İsteğe bağlı eylem (ör. taslak silindi → "Geri al"); tıklayınca bildirim kapanır. */}
        {toast.action && (
          <button
            type="button"
            className="ui-toast__action"
            onClick={() => { toast.action.onClick(); onDismiss(toast.id); }}
            data-action="toast-action"
          >
            {toast.action.label}
          </button>
        )}
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
