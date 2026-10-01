import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import MethodologyModal from './MethodologyModal.jsx';
import { useI18n } from '../i18n/context.js';

/**
 * Sıralama paneli: hazır profiller + yüzde ağırlıklar tek yerde.
 *
 * Kapalıyken tek satır özet. Açılınca profiller küçük çipler; birine basmak
 * yalnızca kaydırıcıları o profilin değerleriyle doldurur. Kaydırıcılar
 * BAĞIMSIZ: biri oynayınca ötekiler kıpırdamaz (eski sürümde 1-5 ölçeğinden
 * normalize edildiği için tek hareket dört yüzdeyi birden değiştiriyordu).
 * Toplam 100 olmadan uygulanmaz; "100'e tamamla" farkı oranla dağıtır.
 * Profil listesi ve değerleri sunucudan (ahpProfiles.js) gelir.
 */
const CRITERIA = ['citation', 'keyword', 'quality', 'similarity', 'recency', 'reliability', 'oa'];
// Sunucudaki MAX_CRITERION_WEIGHT (0,5) ile aynı; üstü sunucuda kırpılıyor.
const MAX_PCT = 50;
const STEP = 0.5;
const EPS = 0.05;

const round1 = (x) => Math.round(x * 10) / 10;
const sumOf = (w) => round1(CRITERIA.reduce((acc, c) => acc + (Number(w[c]) || 0), 0));

/** Oran vektörünü 0,1 hassasiyetle toplamı tam 100 olan yüzdelere çevirir. */
function toPercents(weights) {
  const total = CRITERIA.reduce((acc, c) => acc + (Number(weights?.[c]) || 0), 0) || 1;
  const pct = Object.fromEntries(CRITERIA.map((c) => [c, round1(((Number(weights?.[c]) || 0) / total) * 100)]));
  const diff = round1(100 - sumOf(pct));
  if (diff !== 0) {
    const biggest = CRITERIA.reduce((a, b) => (pct[b] > pct[a] ? b : a));
    pct[biggest] = round1(pct[biggest] + diff);
  }
  return pct;
}

/** Toplamı 100'e oranla tamamlar; 50 sınırını aşan payı ötekilere dağıtır. */
function fillTo100(pct) {
  let w = { ...pct };
  if (sumOf(w) <= 0) w = Object.fromEntries(CRITERIA.map((c) => [c, 1]));
  const total = CRITERIA.reduce((acc, c) => acc + w[c], 0);
  let next = Object.fromEntries(CRITERIA.map((c) => [c, (w[c] / total) * 100]));
  for (let pass = 0; pass < CRITERIA.length; pass++) {
    const over = CRITERIA.filter((c) => next[c] > MAX_PCT);
    if (!over.length) break;
    const excess = over.reduce((acc, c) => acc + next[c] - MAX_PCT, 0);
    over.forEach((c) => { next[c] = MAX_PCT; });
    const free = CRITERIA.filter((c) => next[c] < MAX_PCT);
    const base = free.reduce((acc, c) => acc + next[c], 0);
    free.forEach((c) => { next[c] += base > 0 ? excess * (next[c] / base) : excess / free.length; });
  }
  return toPercents(next);
}

const samePct = (a, b) => a && b && CRITERIA.every((c) => Math.abs(a[c] - b[c]) < EPS);

const RankingPanel = ({ apiUrl, profileId, customWeights, onProfile, onCustom, disabled, warnings, hasResults = false }) => {
  const { t, lang } = useI18n();
  const [profiles, setProfiles] = useState(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [inputs, setInputs] = useState({});
  const [showMethodology, setShowMethodology] = useState(false);
  const closeMethodology = useCallback(() => setShowMethodology(false), []);
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const fmt = (x) => x.toLocaleString(locale, { maximumFractionDigits: 1 });

  useEffect(() => {
    let alive = true;
    fetch(`${apiUrl}/api/ranking/profiles`, { headers: { 'Accept-Language': lang } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && Array.isArray(d?.profiles)) setProfiles(d.profiles); })
      .catch(() => { /* Uç yoksa panel görünmez; arama varsayılanla çalışır. */ });
    return () => { alive = false; };
  }, [apiUrl, lang]);

  const applied = useMemo(() => {
    if (customWeights) return toPercents(customWeights);
    const p = profiles?.find((x) => x.id === profileId) || profiles?.[0];
    return p ? toPercents(p.weights) : null;
  }, [customWeights, profiles, profileId]);

  if (!profiles || !applied) return null;

  // Taslak yoksa (panel yeni açıldı) uygulanan değerler gösterilir.
  const current = draft || applied;
  const total = sumOf(current);
  const balanced = Math.abs(total - 100) < EPS;
  const matched = profiles.find((p) => p.available && samePct(toPercents(p.weights), current));
  const appliedProfile = customWeights ? null : profiles.find((p) => p.id === profileId);
  const dirty = !samePct(current, applied);

  const setValue = (c, value) => {
    const v = Math.min(MAX_PCT, Math.max(0, round1(value)));
    setDraft({ ...current, [c]: v });
  };

  const onInput = (c, raw) => {
    setInputs({ ...inputs, [c]: raw });
    const v = Number(String(raw).replace(',', '.'));
    if (raw.trim() !== '' && Number.isFinite(v)) setValue(c, v);
  };

  const apply = () => {
    if (!balanced) return;
    if (matched) onProfile(matched.id);
    else onCustom(Object.fromEntries(CRITERIA.map((c) => [c, current[c] / 100])));
  };

  const summaryName = appliedProfile ? appliedProfile.label : t('rankingPanel.custom');
  const top = [...CRITERIA].sort((a, b) => applied[b] - applied[a]).slice(0, 3)
    .map((c) => `${t(`criteria.${c}`)} ${t('rankingPanel.pct', { v: fmt(applied[c]) })}`).join(' · ');

  return (
    <div className="rp">
      <button type="button" className="rp__summary" aria-expanded={open} onClick={() => { setOpen(!open); setDraft(null); setInputs({}); }}>
        <SlidersHorizontal size={15} aria-hidden="true" />
        <span className="rp__summary-label">{t('ranking.label')}:</span>
        <strong>{summaryName}</strong>
        <span className="rp__summary-top">{top}</span>
        <span className="rp__summary-action">
          {open ? t('rankingPanel.close') : t('rankingPanel.open')}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div className="rp__body">
          <div className="rp__presets" role="radiogroup" aria-label={t('rankingPanel.presets')}>
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={matched?.id === p.id}
                className="rp__chip"
                disabled={!p.available || disabled}
                title={p.available ? p.description : p.unavailableReason}
                onClick={() => { setDraft(toPercents(p.weights)); setInputs({}); }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="rp__rows">
            {CRITERIA.map((c) => (
              <div key={c} className="rp__row">
                <label htmlFor={`rp-${c}`} className="rp__name">{t(`criteria.${c}`)}</label>
                <input
                  id={`rp-${c}`} type="range" min="0" max={MAX_PCT} step={STEP}
                  value={current[c]}
                  onChange={(e) => { setValue(c, Number(e.target.value)); setInputs({ ...inputs, [c]: undefined }); }}
                  aria-valuetext={t('rankingPanel.pct', { v: fmt(current[c]) })}
                />
                <div className="rp__num">
                  {lang === 'tr' && <span aria-hidden="true">%</span>}
                  <input
                    type="text" inputMode="decimal" aria-label={t('criteria.' + c)}
                    value={inputs[c] ?? fmt(current[c])}
                    onChange={(e) => onInput(c, e.target.value)}
                    onBlur={() => setInputs({ ...inputs, [c]: undefined })}
                  />
                  {lang !== 'tr' && <span aria-hidden="true">%</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="rp__footer">
            <span className={`rp__total ${balanced ? 'is-ok' : 'is-off'}`} aria-live="polite">
              {t('rankingPanel.total', { v: fmt(total) })}
              {!balanced && ` · ${total < 100 ? t('rankingPanel.missing', { v: fmt(round1(100 - total)) }) : t('rankingPanel.extra', { v: fmt(round1(total - 100)) })}`}
            </span>
            {!balanced && (
              <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={() => { setDraft(fillTo100(current)); setInputs({}); }}>
                {t('rankingPanel.fill')}
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setShowMethodology(true)}>
              {t('ranking.how')}
            </button>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={disabled || !balanced || !dirty} onClick={apply}>
              {hasResults ? t('weights.reapply') : t('weights.apply')}
            </button>
          </div>
          <p className="rp__hint">{t('rankingPanel.hint', { max: MAX_PCT })}</p>
        </div>
      )}

      {showMethodology && <MethodologyModal apiUrl={apiUrl} onClose={closeMethodology} />}
      {Array.isArray(warnings) && warnings.length > 0 && (
        <div role="status" className="rp__warn">{warnings.join(' ')}</div>
      )}
    </div>
  );
};

export default RankingPanel;
