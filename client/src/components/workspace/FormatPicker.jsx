import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, FileText, FolderKanban, GraduationCap, Layers, X } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import { FORMATS, TEMPLATES } from './templates.js';
import { DEFAULT_SETUP, MARGIN_PRESETS, PAGE_SIZES } from './pageSetup.js';

// Sunucunun gerçekten kaynakça üretebildiği stiller (bibliography.js STYLE_FILES).
const SUPPORTED_STYLES = ['APA 7', 'IEEE', 'MLA', 'Chicago'];

const ICONS = { article: FileText, thesis: GraduationCap, review: BookOpen, project: FolderKanban, blank: Layers };

/**
 * Belge biçimi seçimi (WO-011 Faz 1).
 *
 * mode 'create': yeni taslak — ad, biçim, atıf stili.
 * mode 'change': mevcut taslak — metin silinmez; `planFor(templateId)`
 *   kaç bölüm ekleneceğini söyler, kaldırma ayrıca onaylanır (Workspace).
 */
export default function FormatPicker({ mode = 'create', initial = {}, planFor = null, onCancel, onConfirm }) {
  const { t } = useI18n();
  const [formatId, setFormatId] = useState(initial.formatId || 'article');
  const [systematic, setSystematic] = useState(Boolean(initial.systematic));
  const [style, setStyle] = useState(SUPPORTED_STYLES.includes(initial.bibFormat) ? initial.bibFormat : 'APA 7');
  const [name, setName] = useState(initial.title || '');
  const dialogRef = useRef(null);

  const option = FORMATS.find((f) => f.id === formatId) || FORMATS[0];
  const templateId = option.systematic && systematic ? option.systematic : option.template;
  const template = TEMPLATES.find((x) => x.id === templateId);
  const setup = { ...DEFAULT_SETUP, ...(template?.setup || {}) };
  const plan = useMemo(() => (planFor ? planFor(templateId) : null), [planFor, templateId]);

  // Esc kapatır; açılınca odak pencereye gelir.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const confirm = () => onConfirm({
    formatId, templateId, bibFormat: style, setup, title: name.trim(),
  });

  return (
    <div className="wx-fmt" role="dialog" aria-modal="true" aria-label={mode === 'create' ? t('workspace.format.title') : t('workspace.format.changeTitle')} tabIndex={-1} ref={dialogRef}>
      <div className="wx-fmt__panel">
        <header className="wx-fmt__head">
          <div>
            <h2>{mode === 'create' ? t('workspace.format.title') : t('workspace.format.changeTitle')}</h2>
            <p>{mode === 'create' ? t('workspace.format.lead') : t('workspace.format.changeLead')}</p>
          </div>
          {onCancel && (
            <button type="button" className="wx-icon" onClick={onCancel} aria-label={t('workspace.format.cancel')} data-action="format-cancel">
              <X size={18} />
            </button>
          )}
        </header>

        <div className="wx-fmt__body">
          <div className="wx-fmt__options" role="radiogroup" aria-label={t('workspace.format.title')}>
            {FORMATS.map((f) => {
              const Icon = ICONS[f.id];
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={formatId === f.id}
                  className="wx-fmt__option"
                  onClick={() => setFormatId(f.id)}
                  data-action={`format-${f.id}`}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{t(`workspace.format.option.${f.id}.name`)}</strong>
                    <small>{t(`workspace.format.option.${f.id}.desc`)}</small>
                  </span>
                </button>
              );
            })}
            {option.systematic && (
              <label className="wx-fmt__check">
                <input type="checkbox" checked={systematic} onChange={(e) => setSystematic(e.target.checked)} data-action="format-systematic" />
                {t('workspace.format.systematic')}
              </label>
            )}
          </div>

          <section className="wx-fmt__preview" aria-label={t('workspace.format.preview')}>
            {mode === 'create' && (
              <label className="wx-fmt__field">
                <span>{t('workspace.format.nameLabel')}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('workspace.titlePlaceholder')} data-action="format-name" />
              </label>
            )}

            <h3>{t('workspace.format.sections')}</h3>
            {template?.sections.length ? (
              <ol className="wx-fmt__sections" data-testid="format-sections">
                {template.sections.map((s) => (
                  <li key={s.key} className={`wx-fmt__l${s.level}`}>{t(`workspace.section.${s.key}`)}</li>
                ))}
              </ol>
            ) : <p className="wx-muted">{t('workspace.format.noSections')}</p>}
            {formatId === 'thesis' && <p className="wx-fmt__note">{t('workspace.format.thesisNote')}</p>}

            <h3>{t('workspace.format.page')}</h3>
            <dl className="wx-fmt__page" data-testid="format-page">
              <dt>{t('workspace.pageSize')}</dt><dd>{PAGE_SIZES[setup.size]?.label}</dd>
              <dt>{t('workspace.margins')}</dt><dd>{t(`workspace.margin.${setup.margin}`)} · {MARGIN_PRESETS[setup.margin]?.value} mm</dd>
              <dt>{t('workspace.font')}</dt><dd>{setup.font} · {setup.fontSize} pt</dd>
              <dt>{t('workspace.format.lineHeight')}</dt><dd>{setup.lineHeight}</dd>
            </dl>

            <label className="wx-fmt__field">
              <span>{t('workspace.format.citation')}</span>
              <select value={style} onChange={(e) => setStyle(e.target.value)} data-action="format-style">
                {SUPPORTED_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <small>{t('workspace.format.citationNote')}</small>
            </label>

            {plan && (
              <p className="wx-fmt__note" data-testid="format-plan">
                {plan.add.length ? t('workspace.format.willAdd', { n: plan.add.length }) : t('workspace.format.nothingToAdd')}
              </p>
            )}
          </section>
        </div>

        <footer className="wx-fmt__foot">
          {onCancel && <button type="button" className="wx-btn" onClick={onCancel}>{t('workspace.format.cancel')}</button>}
          <button type="button" className="wx-btn wx-btn--primary" onClick={confirm} data-action="format-confirm">
            {mode === 'create' ? t('workspace.format.create') : t('workspace.format.apply')}
          </button>
        </footer>
      </div>
    </div>
  );
}
