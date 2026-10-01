import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  ShieldCheck, RefreshCw, Loader2, CheckCircle2, XCircle,
  AlertTriangle, MinusCircle, X, PauseCircle,
} from 'lucide-react';
import { useI18n } from '../i18n/context.js';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Her durumun rengi ve ikonu. Renk tek başına bilgi taşımıyor: her satırda
 * ikon ve metin de var. `zero_results`, `skipped` ve `unused` sağlık
 * kontrolüne sonradan eklendi; burada tanımsız oldukları için kapalı Scopus
 * bile "Hata" diye görünüyordu.
 */
const STATE_STYLE = {
  ok: { color: '#15803d', bg: '#dcfce7', Icon: CheckCircle2 },
  configured: { color: '#15803d', bg: '#dcfce7', Icon: CheckCircle2 },
  invalid_key: { color: '#b91c1c', bg: '#fee2e2', Icon: XCircle },
  unreachable: { color: '#b91c1c', bg: '#fee2e2', Icon: XCircle },
  error: { color: '#b91c1c', bg: '#fee2e2', Icon: XCircle },
  zero_results: { color: '#b91c1c', bg: '#fee2e2', Icon: AlertTriangle },
  quota: { color: '#a16207', bg: '#fef9c3', Icon: AlertTriangle },
  model_missing: { color: '#a16207', bg: '#fef9c3', Icon: AlertTriangle },
  placeholder: { color: '#a16207', bg: '#fef9c3', Icon: AlertTriangle },
  malformed: { color: '#a16207', bg: '#fef9c3', Icon: AlertTriangle },
  unused: { color: '#a16207', bg: '#fef9c3', Icon: AlertTriangle },
  missing: { color: '#57534e', bg: '#f5f5f4', Icon: MinusCircle },
  skipped: { color: '#57534e', bg: '#f5f5f4', Icon: PauseCircle },
};

function StatusPill({ state }) {
  const { t } = useI18n();
  const style = STATE_STYLE[state] || STATE_STYLE.error;
  const { Icon } = style;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: style.bg, color: style.color, padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <Icon size={12} />
      {t(`admin.state.${STATE_STYLE[state] ? state : 'error'}`)}
    </span>
  );
}

const thStyle = { textAlign: 'left', padding: '8px 10px', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '9px 10px', borderBottom: '1px solid var(--slate-100)', verticalAlign: 'top' };
const h3 = { margin: '0 0 4px', fontSize: 'var(--fs-md)', fontWeight: 700 };
const lead = { margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' };

/**
 * Sistem durumu paneli — yalnızca yöneticilere açık.
 *
 *  - Yapılandırma: .env değerlerinin biçim kontrolü (anında, ağ gerektirmez)
 *  - Canlı kontrol: sağlayıcıların gerçekten çalışıp çalışmadığı (istek üzerine)
 *  - Ardışık sıfır: gerçek kullanıcı aramalarında üst üste boş dönen kaynaklar
 * Satırlardaki ayrıntılar sunucunun tanı çıktısıdır ve çevrilmez.
 */
export default function AdminPanel({ getToken, onClose }) {
  const { t, lang } = useI18n();
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [probe, setProbe] = useState(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState(null);

  const loadHealth = useCallback(async () => {
    setHealthError(null);
    try {
      const token = await getToken();
      const res = await axios.get(`${defaultApiUrl}/api/health/details`, { headers: { Authorization: `Bearer ${token}` } });
      setHealth(res.data);
    } catch (err) {
      setHealthError(err.response?.data?.error || t('admin.healthFailed'));
    }
    // t bilerek bagimlilik degil: panel acilista bir kez yuklenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const runProbe = async () => {
    setProbing(true);
    setProbeError(null);
    try {
      const token = await getToken();
      const res = await axios.post(`${defaultApiUrl}/api/admin/verify-keys`, {}, { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 });
      setProbe(res.data);
    } catch (err) {
      setProbeError(err.response?.data?.error || t('admin.probeFailed'));
    } finally {
      setProbing(false);
    }
  };

  const envRows = health?.environment_validation ? Object.entries(health.environment_validation) : [];
  const required = <span style={{ color: '#b91c1c', marginLeft: '4px' }} title={t('admin.required')}>*</span>;

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <ShieldCheck size={22} style={{ color: 'var(--brand-primary)' }} />
        <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 700 }}>{t('admin.title')}</h2>
        <span className="ui-chip ui-chip--brand">{t('admin.adminOnly')}</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="ui-btn ui-btn--ghost ui-btn--icon" style={{ marginLeft: 'auto' }}>
            <X size={18} />
          </button>
        )}
      </div>
      <p style={{ ...lead, margin: '0 0 20px', maxWidth: '68ch' }}>{t('admin.intro')}</p>

      <section className="ui-panel" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-5)' }}>
        <h3 style={h3}>{t('admin.configTitle')}</h3>
        <p style={lead}>{t('admin.configText')}</p>
        {healthError && <div style={{ color: 'var(--score-low)', fontSize: 'var(--fs-sm)' }}>{healthError}</div>}
        {!healthError && envRows.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{t('common.loading')}</div>}
        {envRows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
              <thead><tr><th style={thStyle}>{t('admin.colVariable')}</th><th style={thStyle}>{t('admin.colStatus')}</th><th style={thStyle}>{t('admin.colDetail')}</th></tr></thead>
              <tbody>
                {envRows.map(([name, info]) => (
                  <tr key={name}>
                    <td style={{ ...tdStyle, fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' }}>{name}{info.required && required}</td>
                    <td style={tdStyle}><StatusPill state={info.state} /></td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{info.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ui-panel" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <h3 style={h3}>{t('admin.liveTitle')}</h3>
            <p style={{ ...lead, margin: 0 }}>{t('admin.liveText')}</p>
          </div>
          <button type="button" onClick={runProbe} disabled={probing} className="ui-btn ui-btn--primary">
            {probing ? <><Loader2 size={15} className="animate-spin" /> {t('admin.probing')}</> : <><RefreshCw size={15} /> {t('admin.probe')}</>}
          </button>
        </div>

        {probeError && <div style={{ marginTop: '12px', color: 'var(--score-low)', fontSize: 'var(--fs-sm)' }}>{probeError}</div>}

        {probe && (
          <>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '16px 0 10px', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              <span><strong style={{ color: '#15803d' }}>{probe.summary.ok}</strong> {t('admin.working')}</span>
              <span><strong style={{ color: '#b91c1c' }}>{probe.summary.failing}</strong> {t('admin.failing')}</span>
              {probe.summary.requiredFailing > 0 && (
                <span style={{ color: '#b91c1c', fontWeight: 600 }}>{t('admin.requiredFailing', { n: probe.summary.requiredFailing })}</span>
              )}
              <span style={{ color: 'var(--text-light)' }}>{new Date(probe.checkedAt).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                <thead><tr><th style={thStyle}>{t('admin.colService')}</th><th style={thStyle}>{t('admin.colStatus')}</th><th style={thStyle}>{t('admin.colDetail')}</th><th style={thStyle}>{t('admin.colTime')}</th></tr></thead>
                <tbody>
                  {probe.rows.map((r) => (
                    <tr key={r.service}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{r.service}{r.required && required}</td>
                      <td style={tdStyle}><StatusPill state={r.state} /></td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{r.detail}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-light)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.ms != null ? `${r.ms} ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {Array.isArray(probe.zeroStreaks) && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <h4 style={{ ...h3, fontSize: 'var(--fs-sm)' }}>{t('admin.streaksTitle')}</h4>
                {probe.zeroStreaks.length === 0 ? (
                  <p style={{ ...lead, margin: 0 }}>{t('admin.streaksNone')}</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    {probe.zeroStreaks.map((z) => (
                      <li key={z.source}>
                        <strong style={{ color: z.alerted ? '#b91c1c' : 'var(--text-main)' }}>{z.source}</strong> — {t('admin.streakRow', { n: z.count, since: new Date(z.since).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US') })}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {health && (
        <section className="ui-panel" style={{ padding: 'var(--space-5)' }}>
          <h3 style={{ ...h3, marginBottom: '12px' }}>{t('admin.runtimeTitle')}</h3>
          <div style={{ display: 'grid', gap: '8px', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            <div>
              <strong style={{ color: 'var(--text-main)' }}>{t('admin.database')}</strong>{' '}
              <StatusPill state={health.database?.connected ? 'ok' : 'unreachable'} />
              <span style={{ marginLeft: '8px', color: 'var(--text-light)' }}>readyState: {health.database?.readyState}</span>
            </div>
            <div><strong style={{ color: 'var(--text-main)' }}>{t('admin.environment')}</strong> {health.environment}</div>
            {health.billing && (
              <div>
                <strong style={{ color: 'var(--text-main)' }}>{t('admin.billing')}</strong>{' '}
                <StatusPill state={health.billing.enforced ? 'ok' : 'missing'} />
                <span style={{ marginLeft: '8px', color: 'var(--text-light)' }}>{health.billing.status}</span>
              </div>
            )}
            <div><strong style={{ color: 'var(--text-main)' }}>CORS:</strong> {health.cors?.status}</div>
            {health.auth && (
              <div>
                <strong style={{ color: 'var(--text-main)' }}>{t('admin.auth')}</strong>{' '}
                <StatusPill state={health.auth.configured ? 'ok' : 'missing'} />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
