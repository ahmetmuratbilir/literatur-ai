import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { KeyRound, X } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import { useLayer } from '../ui/useLayer.js';

/**
 * Ayarlar › Yapay zekâ bağlantıları (WO-023). Varsayılan: Literatür AI'nın
 * anahtarları. İsteyen kendi DeepSeek / Gemini / Groq anahtarını bağlar.
 * Anahtar bir kez gönderilir; sunucu şifreli saklar, tamamını bir daha
 * göstermez (yalnız son 4 karakter). Tarayıcıda saklanmaz (tüzük 3.8).
 */

const PROVIDER_NAMES = { deepseek: 'DeepSeek', gemini: 'Google Gemini', groq: 'Groq' };
const STATUS_TONE = { ok: 'ok', invalid: 'bad', quota: 'warn', error: 'warn', unknown: '' };

/**
 * Sunucu yanıtını beklenen şekle getirir. Eskiden yanıt doğrudan duruma
 * yayılıyordu: `connections` gelmeyince (ör. API adresi yanlışken Vercel'in
 * döndürdüğü HTML) `.find` patlıyor, bütün uygulama beyaz sayfaya dönüyordu.
 * @returns {object|null} null = yanıt kullanılamaz
 */
const shapeOf = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return {
    enabled: data.enabled === true,
    storage: typeof data.storage === 'string' ? data.storage : null,
    providers: Array.isArray(data.providers) ? data.providers : [],
    connections: Array.isArray(data.connections) ? data.connections : [],
  };
};

export default function AiConnections({ open, onClose, apiUrl, getToken }) {
  const { t, lang } = useI18n();
  const id = useId();
  const [state, setState] = useState({ loading: true, enabled: false, storage: null, providers: [], connections: [], error: null });
  const [provider, setProvider] = useState('deepseek');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const firstRef = useRef(null);
  useLayer(open, onClose);

  const request = useCallback(async (method, path = '', body) => {
    const token = await getToken();
    const res = await axios({ method, url: `${apiUrl}/api/ai-connections${path}`, data: body, headers: { Authorization: `Bearer ${token}` } });
    return res.data;
  }, [apiUrl, getToken]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    request('get')
      .then((data) => {
        if (!alive) return;
        const shaped = shapeOf(data);
        setState((s) => (shaped ? { ...s, ...shaped, loading: false, error: null } : { ...s, loading: false, error: 'load' }));
      })
      .catch(() => { if (alive) setState((s) => ({ ...s, loading: false, error: 'load' })); });
    firstRef.current?.focus();
    return () => { alive = false; };
  }, [open, request]);

  const act = async (method, path, body, after) => {
    setBusy(true);
    setMessage(null);
    try {
      const data = await request(method, path, body);
      setState((s) => ({ ...s, connections: Array.isArray(data?.connections) ? data.connections : s.connections }));
      after?.(data);
    } catch (err) {
      setMessage({ tone: 'bad', text: err.response?.data?.error || t('aiConn.failed') });
    } finally {
      setBusy(false);
    }
  };

  const save = (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    act('post', '', { provider, key: key.trim() }, (data) => {
      setKey('');
      setMessage({ tone: STATUS_TONE[data.status] || '', text: t(`aiConn.saved.${data.status}`) });
    });
  };

  if (!open) return null;
  const active = state.connections.find((c) => c.active) || null;
  const when = (d) => (d ? new Date(d).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : t('aiConn.never'));

  return createPortal(
    <div className="ui-dialog-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !key) onClose(); }}>
      <div className="ui-dialog ui-dialog--wide" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} data-testid="ai-connections">
        <div className="ai-conn__head">
          <h2 id={`${id}-t`} className="ui-dialog__title"><KeyRound size={18} aria-hidden="true" /> {t('aiConn.title')}</h2>
          <button ref={firstRef} type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}><X size={16} /></button>
        </div>
        <p className="ui-dialog__body">{t('aiConn.intro')}</p>

        {state.loading && <p className="ui-dialog__body">{t('common.loading')}</p>}
        {state.error && <div className="ui-notice ui-notice--error" role="alert">{t('aiConn.loadFailed')}</div>}
        {!state.loading && !state.error && !state.enabled && (
          <div className="ui-notice" role="status" data-testid="ai-conn-disabled">{t('aiConn.disabled')}</div>
        )}

        {!state.loading && state.enabled && (
          <>
            {state.storage === 'memory' && <div className="ui-notice ui-notice--warn" role="status">{t('aiConn.memory')}</div>}
            <ul className="ai-conn__list">
              <li className={`ai-conn__row${active ? '' : ' is-active'}`}>
                <div><strong>{t('aiConn.default')}</strong><small>{t('aiConn.defaultHint')}</small></div>
                {active
                  ? <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" disabled={busy} onClick={() => act('post', '/default')} data-action="ai-default">{t('aiConn.useDefault')}</button>
                  : <span className="ai-conn__badge is-ok">{t('aiConn.inUse')}</span>}
              </li>
              {state.connections.map((c) => (
                <li key={c.provider} className={`ai-conn__row${c.active ? ' is-active' : ''}`} data-provider={c.provider}>
                  <div>
                    <strong>{PROVIDER_NAMES[c.provider] || c.provider} <span className="ai-conn__mask">••••{c.last4}</span></strong>
                    <small>
                      <span className={`ai-conn__badge is-${STATUS_TONE[c.lastStatus] || 'none'}`}>{t(`aiConn.status.${c.lastStatus}`)}</span>
                      {' · '}{t('aiConn.checked', { when: when(c.lastCheckedAt) })}
                    </small>
                  </div>
                  <div className="ai-conn__acts">
                    {c.active
                      ? <span className="ai-conn__badge is-ok">{t('aiConn.inUse')}</span>
                      : <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" disabled={busy} onClick={() => act('post', `/${c.provider}/activate`)} data-action="ai-activate">{t('aiConn.activate')}</button>}
                    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={busy} onClick={() => act('post', `/${c.provider}/test`, null, (d) => setMessage({ tone: STATUS_TONE[d.status] || '', text: t(`aiConn.tested.${d.status}`) }))} data-action="ai-test">{t('aiConn.test')}</button>
                    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={busy} onClick={() => act('delete', `/${c.provider}`)} data-action="ai-remove">{t('aiConn.remove')}</button>
                  </div>
                </li>
              ))}
            </ul>

            <form className="ai-conn__form" onSubmit={save}>
              <label>
                <span>{t('aiConn.provider')}</span>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} data-action="ai-provider">
                  {state.providers.map((p) => <option key={p} value={p}>{PROVIDER_NAMES[p] || p}</option>)}
                </select>
              </label>
              <label className="ai-conn__key">
                <span>{t('aiConn.key')}</span>
                <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder={t('aiConn.keyPlaceholder')} data-action="ai-key" />
              </label>
              <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || key.trim().length < 10} data-action="ai-save">{busy ? t('aiConn.saving') : t('aiConn.save')}</button>
            </form>
          </>
        )}

        {message && <div className={`ui-notice${message.tone === 'bad' ? ' ui-notice--error' : message.tone === 'warn' ? ' ui-notice--warn' : ''}`} role="status" data-testid="ai-conn-message">{message.text}</div>}
        <p className="ai-conn__fine">{t('aiConn.fine')}</p>
      </div>
    </div>,
    document.body,
  );
}
