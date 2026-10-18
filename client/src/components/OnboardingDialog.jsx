import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/context.js';
import { useAppAuth } from '../auth/clerkBridge.js';
import { useModal } from './ui/useModal.js';

// Sunucudaki server/config/onboarding.js ile aynı liste.
const OPTIONS = {
  role: ['lisans', 'yuksek-lisans', 'doktora', 'akademisyen', 'arastirmaci', 'diger'],
  purpose: ['tez', 'makale', 'odev-proje', 'literatur-taramasi', 'proje-basvurusu', 'diger'],
  source: ['hoca-arkadas', 'universite', 'sosyal-medya', 'arama-motoru', 'etkinlik', 'diger'],
};
const MAX_PURPOSES = 3;
// Aynı oturumda (ör. kayıt başarısız olduysa) yeniden sorma.
const SESSION_KEY = 'lit-onboarding-asked';

/**
 * İlk giriş tanışma soruları (WO-024): kim kullanıyor, ne için, bizi nereden
 * duydu. Üç soru, sabit seçenekler, atlanabilir. Sunucu "sor" demezse
 * (cevaplanmış, atlanmış ya da veritabanı yok) hiç açılmaz.
 */
export default function OnboardingDialog({ apiUrl, enabled = true }) {
  const { getToken } = useAppAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    try { if (sessionStorage.getItem(SESSION_KEY)) return undefined; } catch { /* gizli pencere */ }
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${apiUrl}/api/me/onboarding`, { headers: { Authorization: `Bearer ${token}` } });
        const data = res.ok ? await res.json() : null;
        if (alive && data?.needed === true) setOpen(true);
      } catch { /* sorulmaz */ }
    })();
    return () => { alive = false; };
  }, [apiUrl, enabled, getToken]);

  if (!open) return null;
  const close = () => {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* yok say */ }
    setOpen(false);
  };
  return <OnboardingBody apiUrl={apiUrl} onDone={close} />;
}

function OnboardingBody({ apiUrl, onDone }) {
  const { t } = useI18n();
  const { getToken } = useAppAuth();
  const id = useId();
  const rootRef = useRef(null);
  const [answers, setAnswers] = useState({ role: '', purpose: [], source: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const send = async (body) => {
    setBusy(true);
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/me/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch { /* kaydedilemezse bu oturumda bir daha sorulmaz */ }
    onDone();
  };
  const skip = () => send({ skip: true });
  const onKeyDown = useModal(rootRef, { onCancel: skip });

  const save = (e) => {
    e.preventDefault();
    const next = {};
    if (!answers.role) next.role = t('onboarding.needRole');
    if (!answers.purpose.length) next.purpose = t('onboarding.needPurpose');
    setErrors(next);
    if (Object.keys(next).length) {
      rootRef.current?.querySelector(`[data-q="${Object.keys(next)[0]}"] input`)?.focus();
      return;
    }
    send({ role: answers.role, purpose: answers.purpose, ...(answers.source ? { source: answers.source } : {}) });
  };

  const togglePurpose = (v) => setAnswers((a) => {
    if (a.purpose.includes(v)) return { ...a, purpose: a.purpose.filter((x) => x !== v) };
    if (a.purpose.length >= MAX_PURPOSES) return a;
    return { ...a, purpose: [...a.purpose, v] };
  });

  const group = (q, multi) => (
    <fieldset className="ui-onb__q" data-q={q} aria-describedby={errors[q] ? `${id}-${q}-e` : undefined}>
      <legend>{t(`onboarding.${q}.label`)}{q === 'source' && <span className="ui-onb__opt"> · {t('onboarding.optional')}</span>}
        {multi && <span className="ui-onb__opt"> · {t('onboarding.upTo', { n: MAX_PURPOSES })}</span>}</legend>
      <div className="ui-onb__chips">
        {OPTIONS[q].map((v) => {
          const on = multi ? answers.purpose.includes(v) : answers[q] === v;
          const full = multi && !on && answers.purpose.length >= MAX_PURPOSES;
          return (
            <label key={v} className={`ui-chip ${on ? 'is-on' : ''} ${full ? 'is-muted' : ''}`}>
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={`${id}-${q}`}
                value={v}
                checked={on}
                onChange={() => (multi ? togglePurpose(v) : setAnswers((a) => ({ ...a, [q]: v })))}
              />
              {t(`onboarding.${q}.${v}`)}
            </label>
          );
        })}
      </div>
      {errors[q] && <p id={`${id}-${q}-e`} className="ui-help__error" role="alert">{errors[q]}</p>}
    </fieldset>
  );

  return createPortal(
    <div ref={rootRef} className="ui-dialog-scrim">
      <form className="ui-dialog ui-dialog--wide ui-onb" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} onKeyDown={onKeyDown} onSubmit={save} noValidate data-testid="onboarding-dialog">
        <h2 id={`${id}-t`} className="ui-dialog__title">{t('onboarding.title')}</h2>
        <p id={`${id}-d`} className="ui-dialog__body">{t('onboarding.intro')}</p>
        {group('role', false)}
        {group('purpose', true)}
        {group('source', false)}
        <p className="ui-help__muted ui-help__privacy">{t('onboarding.privacy')}</p>
        <div className="ui-dialog__actions">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={skip} disabled={busy} data-action="onboarding-skip">{t('onboarding.skip')}</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={busy} data-action="onboarding-save">{busy ? t('onboarding.saving') : t('onboarding.save')}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
