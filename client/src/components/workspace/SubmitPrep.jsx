import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import { countBySeverity, packageStatus } from '../../audit/audit.js';
import { MARGIN_PRESETS, PAGE_SIZES } from './pageSetup.js';
import CheckPanel from './CheckPanel.jsx';

const STEPS = ['check', 'preview', 'export'];
const FORMATS = ['docx', 'print', 'bibtex', 'ris'];

/**
 * "Teslime hazırla" (WO-011 Faz 3): sağdan açılan geniş panel, üç adım.
 * Belge solda görünür kalır; Önizleme adımı onu Teslim görünümüne alır.
 *
 * 1. Kontrol — teslim aşaması denetimi. Hata varken devam edilebilir, uyarılır.
 *    Tez biçiminde teslim paketi bileşenleri, belgedeki gerçek başlıklardan.
 * 2. Önizleme — Teslim önizlemesi, seçili sayfa düzeni ve kurum notu.
 * 3. Dışa aktar — yalnız gerçekten çalışan biçimler: Word, yazdır/PDF,
 *    BibTeX, RIS. Başarı mesajı yok: dosya tarayıcının indirmesine düşer.
 */
export default function SubmitPrep({
  items, locate, onAction, pending, setup, format, headings, basketCount,
  onPreview, onExport, onClose,
}) {
  const { t, lang } = useI18n();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const fmt = (n) => Number(n || 0).toLocaleString(locale);
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState('docx');
  const counts = countBySeverity(items);
  const errors = counts.critical;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goTo = (next) => {
    setStep(next);
    if (STEPS[next] === 'preview') onPreview();
  };

  const pkg = format === 'thesis' ? packageStatus(headings, (key) => t(`workspace.section.${key}`)) : null;
  const disabled = (f) => (f === 'bibtex' || f === 'ris') && basketCount === 0;

  return (
    <aside className="wx-prep" role="dialog" aria-modal="false" aria-label={t('audit.submit.title')} data-testid="submit-prep">
      <header className="wx-prep__head">
        <div>
          <strong>{t('audit.submit.title')}</strong>
          <small>{t('audit.submit.stepOf', { i: step + 1, n: STEPS.length })}</small>
        </div>
        <button type="button" className="wx-icon" onClick={onClose} aria-label={t('audit.submit.close')} data-action="prep-close">
          <X size={16} />
        </button>
      </header>

      <ol className="wx-prep__steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className={i < step ? 'is-done' : undefined}>
            <button type="button" onClick={() => goTo(i)} data-action={`prep-step-${s}`}>
              <span aria-hidden="true">{i < step ? <Check size={12} /> : i + 1}</span> {t(`audit.submit.steps.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      <div className="wx-prep__body">
        {STEPS[step] === 'check' && (
          <>
            <p className={`wx-prep__status${errors ? ' wx-prep__status--warn' : ''}`} role="status">
              {errors ? <AlertTriangle size={15} /> : <Check size={15} />}
              {errors ? t('audit.submit.errors', { n: fmt(errors) }) : t('audit.submit.noErrors')}
            </p>
            {pkg && (
              <section className="wx-prep__pkg" aria-label={t('audit.submit.package.title')} data-testid="thesis-package">
                <h3>{t('audit.submit.package.title')}</h3>
                <ul>
                  {pkg.map((p) => (
                    <li key={p.key} data-key={p.key} data-status={p.status}>
                      <span>{t(`workspace.section.${p.key}`)}</span>
                      <span className={`wx-prep__pill wx-prep__pill--${p.status}`}>{t(`audit.submit.package.status.${p.status}`)}</span>
                      {p.index !== null && (
                        <button type="button" className="wx-act wx-act--sm" onClick={() => onAction('section', { target: { kind: 'section', index: p.index } })}>
                          {t('audit.submit.package.go')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="wx-muted">{t('audit.submit.package.note')}</p>
              </section>
            )}
            <CheckPanel items={items} locate={locate} onAction={onAction} pending={pending} />
          </>
        )}

        {STEPS[step] === 'preview' && (
          <>
            <p className="wx-prep__status" role="status">{t('audit.submit.previewOn')}</p>
            <section aria-label={t('audit.layout.title')}>
              <h3>{t('audit.layout.title')}</h3>
              <dl className="wx-prep__layout">
                <dt>{t('audit.layout.page')}</dt>
                <dd>{PAGE_SIZES[setup.size]?.label || setup.size}{setup.landscape ? ` · ${t('workspace.landscape')}` : ''}</dd>
                <dt>{t('audit.layout.margins')}</dt>
                <dd>{t(`workspace.margin.${setup.margin}`)} · {MARGIN_PRESETS[setup.margin]?.value} mm</dd>
                <dt>{t('audit.layout.font')}</dt>
                <dd>{setup.font} · {setup.fontSize} pt</dd>
              </dl>
              <p className="wx-muted">{t('audit.layout.note')}</p>
            </section>
          </>
        )}

        {STEPS[step] === 'export' && (
          <fieldset className="wx-prep__formats">
            <legend>{t('audit.submit.formats')}</legend>
            {FORMATS.map((f) => (
              <label key={f} className={`wx-prep__format${disabled(f) ? ' is-disabled' : ''}`}>
                <input
                  type="radio"
                  name="prep-format"
                  value={f}
                  checked={choice === f}
                  disabled={disabled(f)}
                  onChange={() => setChoice(f)}
                  data-action={`prep-format-${f}`}
                />
                <span>
                  <strong>{t(`audit.submit.option.${f}.name`)}</strong>
                  <small>{t(`audit.submit.option.${f}.desc`, { n: fmt(basketCount) })}</small>
                </span>
              </label>
            ))}
            {basketCount === 0 && <p className="wx-muted">{t('audit.submit.basketEmpty')}</p>}
            <p className="wx-muted">{t('audit.export.note')}</p>
          </fieldset>
        )}
      </div>

      <footer className="wx-prep__foot">
        {step > 0 && (
          <button type="button" className="wx-btn" onClick={() => goTo(step - 1)} data-action="prep-back">{t('audit.submit.back')}</button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="wx-btn wx-btn--primary" onClick={() => goTo(step + 1)} data-action="prep-next">
            {step === 0 && errors ? t('audit.submit.proceedAnyway') : t('audit.submit.next')}
          </button>
        ) : (
          <button type="button" className="wx-btn wx-btn--primary" onClick={() => onExport(choice)} disabled={disabled(choice)} data-action="prep-run">
            {t('audit.submit.run')}
          </button>
        )}
      </footer>
    </aside>
  );
}
