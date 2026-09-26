import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  ShieldCheck, RefreshCw, Loader2, CheckCircle2, XCircle,
  AlertTriangle, MinusCircle, X,
} from 'lucide-react';

const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Her durumun rengi ve etiketi. Renk tek başına bilgi taşımıyor: her satırda
 * ikon ve metin de var, böylece renk ayrımı yapamayan biri de okuyabiliyor.
 */
const STATE_STYLE = {
  ok: { label: 'Çalışıyor', color: '#15803d', bg: '#dcfce7', Icon: CheckCircle2 },
  invalid_key: { label: 'Anahtar geçersiz', color: '#b91c1c', bg: '#fee2e2', Icon: XCircle },
  quota: { label: 'Kota dolu', color: '#a16207', bg: '#fef9c3', Icon: AlertTriangle },
  unreachable: { label: 'Erişilemiyor', color: '#b91c1c', bg: '#fee2e2', Icon: XCircle },
  missing: { label: 'Tanımsız', color: '#57534e', bg: '#f5f5f4', Icon: MinusCircle },
  model_missing: { label: 'Model yok', color: '#a16207', bg: '#fef9c3', Icon: AlertTriangle },
  error: { label: 'Hata', color: '#b91c1c', bg: '#fee2e2', Icon: XCircle },
  placeholder: { label: 'Şablon değeri', color: '#a16207', bg: '#fef9c3', Icon: AlertTriangle },
  malformed: { label: 'Biçim hatalı', color: '#a16207', bg: '#fef9c3', Icon: AlertTriangle },
  configured: { label: 'Tanımlı', color: '#15803d', bg: '#dcfce7', Icon: CheckCircle2 },
};

function StatusPill({ state }) {
  const style = STATE_STYLE[state] || STATE_STYLE.error;
  const { Icon } = style;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: style.bg, color: style.color,
      padding: '2px 8px', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <Icon size={12} />
      {style.label}
    </span>
  );
}

const cardStyle = {
  background: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '18px 20px',
  marginBottom: '16px',
};

const thStyle = {
  textAlign: 'left', padding: '8px 10px', fontSize: '0.68rem',
  letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b',
  borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
};
const tdStyle = { padding: '9px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

/**
 * Sistem durumu paneli — yalnızca admin kullanıcılara açık.
 *
 * İki ayrı bilgi gösterir:
 *  - Yapılandırma: .env değerlerinin biçim kontrolü (anında, ağ gerektirmez)
 *  - Canlı kontrol: sağlayıcının anahtarı kabul edip etmediği (istek üzerine)
 *
 * Bu ikisi farklı sorular. Biçimi kusursuz ama iptal edilmiş bir anahtar
 * yalnızca canlı kontrolde görünür.
 */
export default function AdminPanel({ getToken, onClose }) {
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [probe, setProbe] = useState(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState(null);

  const loadHealth = useCallback(async () => {
    setHealthError(null);
    try {
      const token = await getToken();
      const res = await axios.get(`${defaultApiUrl}/api/health/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHealth(res.data);
    } catch (err) {
      setHealthError(err.response?.data?.error || 'Sistem durumu alınamadı.');
    }
  }, [getToken]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const runProbe = async () => {
    setProbing(true);
    setProbeError(null);
    try {
      const token = await getToken();
      const res = await axios.post(`${defaultApiUrl}/api/admin/verify-keys`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000,
      });
      setProbe(res.data);
    } catch (err) {
      setProbeError(err.response?.data?.error || 'Kontrol tamamlanamadı.');
    } finally {
      setProbing(false);
    }
  };

  const envRows = health?.environment_validation
    ? Object.entries(health.environment_validation)
    : [];

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '6px', flexWrap: 'wrap',
      }}>
        <ShieldCheck size={22} style={{ color: '#4f46e5' }} />
        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>
          Sistem Durumu
        </h2>
        <span style={{
          fontSize: '0.7rem', background: '#eef2ff', color: '#4338ca',
          padding: '3px 8px', borderRadius: '999px', fontWeight: 600,
        }}>
          yalnızca yönetici
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Paneli kapat"
            style={{
              marginLeft: 'auto', background: 'none', border: 0,
              cursor: 'pointer', color: '#64748b', lineHeight: 0, padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '0.86rem', maxWidth: '68ch' }}>
        Bu sayfa hangi servislerin yapılandırıldığını ve gerçekten çalıştığını gösterir.
        Bilgi sıradan kullanıcılara kapalıdır: hangi servisin kapalı olduğu dışarıdan
        bilinmemeli.
      </p>

      {/* --- Yapılandırma --- */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
          Yapılandırma
        </h3>
        <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.82rem' }}>
          <code>.env</code> değerlerinin biçim kontrolü. Şablondan kopyalanmış bir değer
          burada yakalanır.
        </p>

        {healthError && (
          <div style={{ color: '#b91c1c', fontSize: '0.86rem' }}>{healthError}</div>
        )}

        {!healthError && envRows.length === 0 && (
          <div style={{ color: '#64748b', fontSize: '0.86rem' }}>Yükleniyor…</div>
        )}

        {envRows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Değişken</th>
                  <th style={thStyle}>Durum</th>
                  <th style={thStyle}>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {envRows.map(([name, info]) => (
                  <tr key={name}>
                    <td style={{ ...tdStyle, fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' }}>
                      {name}
                      {info.required && (
                        <span style={{ color: '#b91c1c', marginLeft: '4px' }} title="Zorunlu">*</span>
                      )}
                    </td>
                    <td style={tdStyle}><StatusPill state={info.state} /></td>
                    <td style={{ ...tdStyle, color: '#475569' }}>{info.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Canlı kontrol --- */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Canlı kontrol
            </h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>
              Her sağlayıcıya birer istek atar. Biçimi doğru ama iptal edilmiş bir anahtar
              yalnızca burada görünür. Birkaç saniye sürer ve kotadan yer, 5 dakikada
              en fazla 4 kez çalıştırılabilir.
            </p>
          </div>
          <button
            type="button"
            onClick={runProbe}
            disabled={probing}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '9px 15px', borderRadius: '9px', border: 0,
              background: probing ? '#c7d2fe' : '#4f46e5', color: 'white',
              fontWeight: 600, fontSize: '0.85rem',
              cursor: probing ? 'progress' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {probing
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Kontrol ediliyor…</>
              : <><RefreshCw size={15} /> Servisleri test et</>}
          </button>
        </div>

        {probeError && (
          <div style={{ marginTop: '12px', color: '#b91c1c', fontSize: '0.86rem' }}>{probeError}</div>
        )}

        {probe && (
          <>
            <div style={{
              display: 'flex', gap: '16px', flexWrap: 'wrap',
              margin: '16px 0 10px', fontSize: '0.84rem', color: '#475569',
            }}>
              <span><strong style={{ color: '#15803d' }}>{probe.summary.ok}</strong> çalışıyor</span>
              <span><strong style={{ color: '#b91c1c' }}>{probe.summary.failing}</strong> sorunlu</span>
              {probe.summary.requiredFailing > 0 && (
                <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                  {probe.summary.requiredFailing} zorunlu servis çalışmıyor
                </span>
              )}
              <span style={{ color: '#94a3b8' }}>
                {new Date(probe.checkedAt).toLocaleString('tr-TR')}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Servis</th>
                    <th style={thStyle}>Durum</th>
                    <th style={thStyle}>Detay</th>
                    <th style={thStyle}>Süre</th>
                  </tr>
                </thead>
                <tbody>
                  {probe.rows.map((r) => (
                    <tr key={r.service}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#0f172a' }}>
                        {r.service}
                        {r.required && (
                          <span style={{ color: '#b91c1c', marginLeft: '4px' }} title="Zorunlu">*</span>
                        )}
                      </td>
                      <td style={tdStyle}><StatusPill state={r.state} /></td>
                      <td style={{ ...tdStyle, color: '#475569' }}>{r.detail}</td>
                      <td style={{ ...tdStyle, color: '#94a3b8', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {r.ms != null ? `${r.ms} ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* --- Veritabanı ve yazım bayrakları --- */}
      {health && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
            Çalışma zamanı
          </h3>
          <div style={{ display: 'grid', gap: '8px', fontSize: '0.85rem', color: '#475569' }}>
            <div>
              <strong>Veritabanı:</strong>{' '}
              <StatusPill state={health.database?.connected ? 'ok' : 'unreachable'} />
              <span style={{ marginLeft: '8px', color: '#94a3b8' }}>
                readyState: {health.database?.readyState}
              </span>
            </div>
            <div><strong>Ortam:</strong> {health.environment}</div>
            {health.billing && (
              <div>
                <strong>Abonelik kontrolü:</strong>{' '}
                <StatusPill state={health.billing.enforced ? 'ok' : 'missing'} />
                <span style={{ marginLeft: '8px', color: '#94a3b8' }}>
                  {health.billing.status}
                </span>
              </div>
            )}
            <div><strong>CORS:</strong> {health.cors?.status}</div>
            {health.auth && (
              <div>
                <strong>Kimlik doğrulama:</strong>{' '}
                <StatusPill state={health.auth.configured ? 'ok' : 'missing'} />
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
