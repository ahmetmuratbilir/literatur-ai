import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LifeBuoy, X, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import { useAppAuth } from '../auth/clerkBridge.js';
import { useModal } from './ui/useModal.js';
import { copyText } from '../utils/clipboard.js';

const KINDS = ['oneri', 'hata', 'soru', 'diger'];
const MIN = 10;
const MAX = 2000;
const INBOX = 'info@literatur-ai.com';

/**
 * Yardım ve destek (WO-024). Üstte kısa cevaplar (satır içi yardım önce),
 * altta ekibe giden geri bildirim formu: POST /api/feedback → info@ adresine.
 * Gönderilen: mesaj, tür, bulunulan ekranın adı, tarayıcı bilgisi; e-posta
 * adresi yalnız kullanıcı dönüşe izin verirse (sunucu kimlikten alır).
 */
export default function HelpDialog({ open, onClose, apiUrl, context = '', initialKind = 'oneri' }) {
  if (!open) return null;
  return <HelpBody onClose={onClose} apiUrl={apiUrl} context={context} initialKind={initialKind} />;
}

function HelpBody({ onClose, apiUrl, context, initialKind }) {
  const { t } = useI18n();
  const { getToken } = useAppAuth();
  const id = useId();
  const rootRef = useRef(null);
  const textRef = useRef(null);
  const [kind, setKind] = useState(KINDS.includes(initialKind) ? initialKind : 'oneri');
  const [message, setMessage] = useState('');
  const [contactOk, setContactOk] = useState(true);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | failed
  const [fieldError, setFieldError] = useState('');
  const [copied, setCopied] = useState(null); // 'address' | 'message'
  const copy = async (what) => {
    if (await copyText(what === 'address' ? INBOX : message.trim())) {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    }
  };
  const dirty = message.trim().length > 0 && status !== 'sent';
  const onKeyDown = useModal(rootRef, { onCancel: onClose });

  const submit = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (text.length < MIN) {
      setFieldError(t('help.tooShort', { n: MIN }));
      textRef.current?.focus();
      return;
    }
    setFieldError('');
    setStatus('sending');
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind, message: text, page: context, contactOk }),
      });
      setStatus(res.ok ? 'sent' : 'failed');
    } catch {
      setStatus('failed');
    }
  };

  return createPortal(
    <div ref={rootRef} className="ui-dialog-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !dirty) onClose(); }}>
      <div className="ui-dialog ui-dialog--wide ui-help" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onKeyDown={onKeyDown} data-testid="help-dialog">
        <div className="ui-help__head">
          <span className="ui-help__icon" aria-hidden="true"><LifeBuoy size={18} /></span>
          <h2 id={`${id}-t`} className="ui-dialog__title">{t('help.title')}</h2>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon ui-help__close" onClick={onClose} aria-label={t('common.close')} data-action="help-close"><X size={18} /></button>
        </div>

        {status === 'sent' ? (
          <div className="ui-help__done" role="status">
            <CheckCircle2 size={28} aria-hidden="true" />
            <p><strong>{t('help.sentTitle')}</strong></p>
            <p className="ui-help__muted">{contactOk ? t('help.sentReply') : t('help.sentNoReply')}</p>
            <div className="ui-dialog__actions">
              <button type="button" className="ui-btn ui-btn--primary" onClick={onClose} data-action="help-done">{t('common.close')}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="ui-help__faq">
              {['rank', 'passage', 'drafts'].map((k) => (
                <details key={k}>
                  <summary>{t(`help.faq.${k}.q`)}</summary>
                  <p>{t(`help.faq.${k}.a`)}</p>
                </details>
              ))}
            </div>

            <form className="ui-help__form" onSubmit={submit} noValidate>
              <fieldset className="ui-help__kinds">
                <legend>{t('help.kindLabel')}</legend>
                {KINDS.map((k) => (
                  <label key={k} className={`ui-chip ${kind === k ? 'is-on' : ''}`}>
                    <input type="radio" name={`${id}-kind`} value={k} checked={kind === k} onChange={() => setKind(k)} />
                    {t(`help.kind.${k}`)}
                  </label>
                ))}
              </fieldset>

              <label className="ui-dialog__field" htmlFor={`${id}-m`}>
                <span>{t('help.messageLabel')}</span>
              </label>
              <textarea
                id={`${id}-m`}
                ref={textRef}
                className="ui-help__text"
                value={message}
                onChange={(e) => { setMessage(e.target.value.slice(0, MAX)); if (fieldError) setFieldError(''); }}
                placeholder={t(`help.placeholder.${kind}`)}
                rows={5}
                aria-invalid={fieldError ? 'true' : undefined}
                aria-describedby={`${id}-c ${fieldError ? `${id}-e` : ''}`}
                data-action="help-message"
              />
              <div className="ui-help__meta">
                {fieldError ? <span id={`${id}-e`} className="ui-help__error" role="alert">{fieldError}</span> : <span />}
                <span id={`${id}-c`} className="ui-help__count">{message.length}/{MAX}</span>
              </div>

              <label className="ui-help__check">
                <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} data-action="help-contact" />
                <span>{t('help.contactOk')}</span>
              </label>
              <p className="ui-help__muted ui-help__privacy">{t('help.privacy')}</p>

              {/* mailto yalnız bilgisayarda e-posta programı ayarlıysa açılır; Gmail'i
                  tarayıcıdan kullananlar için adres ve mesaj kopyalanabilir. */}
              {status === 'failed' && (
                <div className="ui-help__fallback" role="alert">
                  <p className="ui-help__error">
                    {t('help.failed')} <a href={`mailto:${INBOX}?subject=${encodeURIComponent(t(`help.kind.${kind}`))}&body=${encodeURIComponent(message)}`}>{INBOX}</a>
                  </p>
                  <div className="ui-help__copy">
                    <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={() => copy('address')} data-action="help-copy-address">
                      {copied === 'address' ? t('help.copied') : t('help.copyAddress')}
                    </button>
                    <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={() => copy('message')} disabled={!message.trim()} data-action="help-copy-message">
                      {copied === 'message' ? t('help.copied') : t('help.copyMessage')}
                    </button>
                  </div>
                </div>
              )}

              <div className="ui-dialog__actions">
                <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} data-action="help-cancel">{t('common.cancel')}</button>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={status === 'sending'} data-action="help-send">
                  {status === 'sending' ? t('help.sending') : t('help.send')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
