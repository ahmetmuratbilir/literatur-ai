import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

/**
 * Gelişmiş mod: kendi ağırlıklarım.
 *
 * İki giriş biçimi var ve aralarındaki fark kullanıcıya söyleniyor:
 *  - Kaydırıcılar: hızlı. Tek bir önem sıralamasından üretildiği için tanım
 *    gereği tutarlı; tutarlılık kontrolü bu modda bir şey ölçmez.
 *  - İkili sorular: 7 kriterin hepsi, 9 soru (tam matris 21 soru isterdi).
 *    Eksik karşılaştırmalar sunucuda Harker (1987) yöntemiyle tamamlanıyor.
 *    İlk 6 soru kriterleri birbirine bağlar; son 3'ü tutarlılığı ölçer.
 * Ağırlıklar sunucuda hesaplanıyor (/api/ranking/evaluate); burada yalnızca
 * kaydırıcı önizlemesi ve soru grafının bağlılık kontrolü var.
 */
const CRITERIA = ['citation', 'keyword', 'quality', 'similarity', 'recency', 'reliability', 'oa'];
// Sunucudaki ahpPairwise.RATING_TO_INTENSITY ile aynı; yalnızca önizleme için.
const INTENSITY = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7 };

// İlk 6 soru bir zincir: 7 kriteri birbirine bağlar (ağaç). Son 3'ü zincirde
// döngü kurar; tutarlılık oranı ancak bu döngüler varsa bir şey ölçer.
const QUESTIONS = [
  ['citation', 'keyword'], ['keyword', 'quality'], ['quality', 'similarity'],
  ['similarity', 'recency'], ['recency', 'reliability'], ['reliability', 'oa'],
  ['citation', 'quality'], ['keyword', 'recency'], ['quality', 'oa'],
];
const CORE_QUESTIONS = 6;

// A'nın B'ye göre önemi (Saaty) ve etiketi.
const PAIR_OPTIONS = [
  { value: 7, label: (t, a) => t('weights.optMuch', { x: a }) },
  { value: 3, label: (t, a) => t('weights.optMore', { x: a }) },
  { value: 1, label: (t) => t('weights.optEqual') },
  { value: 1 / 3, label: (t, a, b) => t('weights.optMore', { x: b }) },
  { value: 1 / 7, label: (t, a, b) => t('weights.optMuch', { x: b }) },
];

/** Yanıtlanan sorular kriterleri kaç gruba ayırıyor. */
function connectedGroups(answeredPairs) {
  const parent = Object.fromEntries(CRITERIA.map((c) => [c, c]));
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const [a, b] of answeredPairs) parent[find(a)] = find(b);
  const involved = new Set(answeredPairs.flat());
  return new Set([...involved].map(find)).size;
}

const chip = (active) => ({
  height: 'auto', minHeight: '30px', padding: '6px 10px', borderRadius: '999px', whiteSpace: 'normal', textAlign: 'center',
  border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-light)'}`,
  background: active ? 'var(--brand-primary)' : 'var(--bg-card)', color: active ? 'white' : 'var(--text-main)',
});

const AdvancedWeights = ({ apiUrl, onApply, disabled, active, hasResults = false }) => {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('sliders');
  const [ratings, setRatings] = useState(() => Object.fromEntries(CRITERIA.map((c) => [c, 3])));
  const [judgments, setJudgments] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Çelişki açıklaması sunucudan o anki dilde geliyor; dil değişince eskisi kalmasın.
  useEffect(() => { setResult(null); setError(null); }, [lang]);
  // Aramadan önce ağırlıklar yalnızca kaydedilir; arama bunlarla yapılır.
  const applyLabel = hasResults ? t('weights.reapply') : t('weights.apply');
  const levels = t('weights.levels');
  const label = (c) => t(`criteria.${c}`);

  const preview = useMemo(() => {
    const total = CRITERIA.reduce((acc, c) => acc + INTENSITY[ratings[c]], 0);
    return Object.fromEntries(CRITERIA.map((c) => [c, Math.round((INTENSITY[ratings[c]] / total) * 100)]));
  }, [ratings]);

  const answeredPairs = QUESTIONS.filter(([a, b]) => judgments[`${a}|${b}`] !== undefined);
  const groups = connectedGroups(answeredPairs);
  const covered = new Set(answeredPairs.flat()).size;
  const ready = answeredPairs.length > 0 && groups === 1;
  const hasCheck = answeredPairs.length > covered - 1;

  const evaluate = async (body) => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await axios.post(`${apiUrl}/api/ranking/evaluate`, body);
      return data;
    } catch (err) {
      setError(err.response?.data?.error || t('weights.failed'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const applySliders = async () => {
    const data = await evaluate({ mode: 'ratings', ratings });
    if (data?.ok) onApply(data.weights);
  };

  const applyPairwise = async (overrides = {}) => {
    const merged = { ...judgments, ...overrides };
    const data = await evaluate({
      mode: 'pairwise',
      judgments: QUESTIONS
        .filter(([a, b]) => merged[`${a}|${b}`] !== undefined)
        .map(([a, b]) => ({ a, b, value: merged[`${a}|${b}`] })),
      // Sunucu yalnızca bu arayüzde SEÇİLEBİLEN değerleri önersin.
      allowedValues: PAIR_OPTIONS.map((o) => o.value),
    });
    if (!data) return;
    setResult(data);
    if (data.ok && data.isConsistent) onApply(data.weights);
  };

  const acceptSuggestion = () => {
    const { a, b, value } = result.inconsistency.suggestion;
    // Öneri (a, b) yönünde; formdaki soru ters sırada olabilir.
    const direct = QUESTIONS.some(([x, y]) => x === a && y === b);
    const key = direct ? `${a}|${b}` : `${b}|${a}`;
    const v = direct ? value : 1 / value;
    setJudgments({ ...judgments, [key]: v });
    applyPairwise({ [key]: v });
  };

  const setAnswer = (key, value) => {
    setResult(null);
    const next = { ...judgments };
    if (next[key] === value) delete next[key]; // aynı seçeneğe tekrar basmak yanıtı geri alır
    else next[key] = value;
    setJudgments(next);
  };

  const status = (() => {
    if (answeredPairs.length === 0) return t('weights.noAnswers');
    if (groups > 1) return t('weights.groups', { n: groups });
    const parts = [hasCheck ? t('weights.canCheck', { n: answeredPairs.length }) : t('weights.noCheck')];
    if (covered < CRITERIA.length) parts.push(t('weights.keepDefault', { n: CRITERIA.length - covered }));
    return parts.join(' ');
  })();

  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="ui-btn ui-btn--ghost ui-btn--sm"
        style={{ paddingInline: '6px', marginLeft: '-6px', color: active ? 'var(--brand-primary)' : 'var(--text-muted)' }}
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {t('weights.toggle')}{active ? t('weights.active') : ''}
      </button>

      {open && (
        <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-4)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', display: 'grid', gap: 'var(--space-3)', fontSize: 'var(--fs-sm)', background: 'var(--bg-subtle)' }}>
          <div className="ui-seg" role="tablist" style={{ justifySelf: 'start' }}>
            <button type="button" role="tab" className="ui-seg__btn" aria-pressed={mode === 'sliders'} aria-selected={mode === 'sliders'} onClick={() => setMode('sliders')} style={{ letterSpacing: 0 }}>{t('weights.sliders')}</button>
            <button type="button" role="tab" className="ui-seg__btn" aria-pressed={mode === 'pairwise'} aria-selected={mode === 'pairwise'} onClick={() => setMode('pairwise')} style={{ letterSpacing: 0 }}>{t('weights.pairwise')}</button>
          </div>

          {mode === 'sliders' && (
            <>
              {CRITERIA.map((c) => (
                <label key={c} htmlFor={`w-${c}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr 44px', gap: '10px', alignItems: 'center' }}>
                  <span>{label(c)}</span>
                  <input
                    id={`w-${c}`} type="range" min="1" max="5" step="1" value={ratings[c]}
                    aria-valuetext={levels[ratings[c]]}
                    onChange={(e) => setRatings({ ...ratings, [c]: Number(e.target.value) })}
                    style={{ accentColor: 'var(--brand-primary)' }}
                  />
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>%{preview[c]}</span>
                </label>
              ))}
              <p className="ui-hint" style={{ color: 'var(--text-muted)' }}>{t('weights.slidersNote')}</p>
              <button type="button" className="ui-btn ui-btn--primary" style={{ justifySelf: 'start' }} disabled={disabled || busy} onClick={applySliders}>
                {busy ? t('weights.computing') : applyLabel}
              </button>
            </>
          )}

          {mode === 'pairwise' && (
            <>
              <p className="ui-hint" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('weights.pairIntro')}</p>

              {QUESTIONS.map(([a, b], idx) => {
                const key = `${a}|${b}`;
                return (
                  <fieldset key={key} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: '6px' }}>
                    <legend style={{ fontWeight: 600, marginBottom: '4px', padding: 0 }}>
                      {idx === CORE_QUESTIONS && (
                        <span className="ui-section-label" style={{ display: 'block', margin: '6px 0 8px' }}>{t('weights.checkHeading')}</span>
                      )}
                      {t('weights.question', { a: label(a), bLower: label(b).toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US') })}
                    </legend>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {PAIR_OPTIONS.map((o) => (
                        <button key={o.value} type="button" className="ui-btn ui-btn--sm" aria-pressed={judgments[key] === o.value}
                          style={chip(judgments[key] === o.value)}
                          onClick={() => setAnswer(key, o.value)}>
                          {o.label(t, label(a), label(b))}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                );
              })}

              {result?.ok && !result.isConsistent && result.inconsistency && (
                <div role="alert" className="ui-notice ui-notice--warn" style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700 }}>
                    <AlertTriangle size={15} /> {t('weights.conflictTitle')}
                  </div>
                  <div>{result.inconsistency.explanation}</div>
                  <div><strong>{t('weights.suggestion')}</strong> {result.inconsistency.suggestion.text}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', opacity: 0.8 }}>
                    {t('weights.crNote', { cr: result.consistencyRatio.toFixed(2) })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={busy} onClick={acceptSuggestion}>
                      {result.inconsistency.suggestion.fixesIt ? t('weights.applySuggestion') : t('weights.applySuggestionAgain')}
                    </button>
                    <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" disabled={busy}
                      onClick={() => onApply(result.weights, { inconsistent: true })}>
                      {t('weights.continueAnyway')}
                    </button>
                  </div>
                </div>
              )}

              <div className="ui-hint" style={{ color: 'var(--text-muted)' }} aria-live="polite">{status}</div>

              <button type="button" className="ui-btn ui-btn--primary" style={{ justifySelf: 'start' }} disabled={disabled || busy || !ready} onClick={() => applyPairwise()}>
                {busy ? t('weights.computing') : applyLabel}
              </button>
            </>
          )}

          {error && <div role="alert" style={{ color: 'var(--score-low)' }}>{error}</div>}
        </div>
      )}
    </div>
  );
};

export default AdvancedWeights;
