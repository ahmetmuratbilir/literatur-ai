import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon, AlertTriangle, BookMarked, ChevronDown, ChevronRight, Info, Library, ListTree, LocateFixed, Plus, Quote,
} from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import { SEVERITY, countBySeverity, groupItems } from '../../audit/audit.js';

const SEVERITY_ICON = { critical: AlertOctagon, warning: AlertTriangle, info: Info };
const ACTION_ICON = { reveal: LocateFixed, section: ListTree, bib: BookMarked, sources: Library, addSource: Plus, notClaim: Quote };

/** Maddenin eylemleri: önce gezinme (satıra tıklamak bunu yapar), sonra düzeltme. */
function actionsFor(item) {
  const kind = item.target?.kind;
  const out = [];
  if (kind === 'sentence') out.push('reveal');
  if (kind === 'section') out.push('section');
  if (kind === 'bib') out.push('bib');
  if (kind === 'sources') out.push('sources');
  if (item.rule === 'uncitedClaim') out.push('addSource', 'notClaim');
  if (item.rule === 'orphan') out.push('addSource');
  return out;
}

/** Kuralın başlık ve açıklaması için çeviri parametreleri. */
function paramsFor(item, t, fmt) {
  const p = item.params || {};
  return {
    ...p,
    n: fmt(p.n),
    target: fmt(p.target),
    kind: p.kind ? t(`audit.kind.${p.kind}`) : '',
    fields: (p.fields || []).map((f) => t(`audit.field.${f}`)).join(', '),
  };
}

/**
 * Denetim maddeleri listesi (WO-011 Faz 3): yazar modunun sağ panelindeki
 * Kontrol sekmesi ve "Teslime hazırla"nın ilk adımı aynı listeyi kullanır.
 * Aynı kuraldan birden çok madde tek satırda toplanır, açılınca liste olur.
 *
 * @param items     runAudit çıktısı
 * @param locate    maddenin belgedeki konumu ("Bölüm 2.3 · Paragraf 3") ya da null
 * @param onAction  (action, item) — reveal, section, bib, sources, addSource, notClaim
 * @param focusId   kenar işaretinden gelen madde: görünür olur ve vurgulanır
 */
export default function CheckPanel({ items, locate, onAction, focusId = null, focusTick = 0, pending = false, note = null }) {
  const { t, lang } = useI18n();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString(locale) : n);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(() => new Set());
  const listRef = useRef(null);

  const counts = countBySeverity(items);
  const shown = filter === 'all' ? items : items.filter((i) => i.severity === filter);
  const groups = useMemo(() => groupItems(shown), [shown]);

  // Kenar işaretinden gelindi: süzgeç onu gizlemesin, grubu açılsın, satır görünsün.
  const [seenTick, setSeenTick] = useState(0);
  const focused = items.find((i) => i.id === focusId);
  if (focused && focusTick !== seenTick) {
    setSeenTick(focusTick);
    if (filter !== 'all' && filter !== focused.severity) setFilter('all');
    const groupId = `${focused.severity}:${focused.rule}`;
    if (!open.has(groupId)) setOpen((prev) => new Set(prev).add(groupId));
  }
  useEffect(() => {
    if (!focusId) return;
    const row = listRef.current?.querySelector(`[data-item-id="${CSS.escape(focusId)}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [focusId, focusTick]);

  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const actionButtons = (item) => actionsFor(item).map((action) => {
    const Icon = ACTION_ICON[action];
    return (
      <button key={action} type="button" className="wx-act wx-act--sm" onClick={() => onAction(action, item)} data-action={`check-${action}`}>
        <Icon size={13} /> {t(`audit.action.${action}`)}
      </button>
    );
  });

  /** Tek madde: başlığa tıklamak ilk gezinme eylemini yapar. */
  const row = (item, { nested = false } = {}) => {
    const params = paramsFor(item, t, fmt);
    const where = locate?.(item);
    const primary = actionsFor(item)[0];
    const title = t(`audit.rule.${item.rule}.title`, params);
    return (
      <li
        key={item.id}
        className={`wx-ctl__item wx-ctl__item--${item.severity}${nested ? ' wx-ctl__item--nested' : ''}${item.id === focusId ? ' is-focused' : ''}`}
        data-rule={item.rule}
        data-severity={item.severity}
        data-item-id={item.id}
      >
        {!nested && <SeverityBadge severity={item.severity} t={t} />}
        <div className="wx-ctl__main">
          {primary && ['reveal', 'section'].includes(primary) ? (
            <button type="button" className="wx-ctl__title" onClick={() => onAction(primary, item)} data-action="check-open">{title}</button>
          ) : <strong className="wx-ctl__title">{title}</strong>}
          {where && <code className="wx-ctl__where">{where}</code>}
          {item.excerpt && <blockquote>{item.excerpt}</blockquote>}
          {!nested && <small>{t(`audit.rule.${item.rule}.hint`, params)}</small>}
          {item.rule === 'emptySection' && item.params?.optional && <small>{t('audit.optionalNote')}</small>}
          {item.rule === 'uncitedSources' && item.params?.titles?.length > 0 && (
            <ul className="wx-ctl__titles">{item.params.titles.slice(0, 6).map((title) => <li key={title}>{title}</li>)}</ul>
          )}
          <div className="wx-ctl__acts">{actionButtons(item)}</div>
        </div>
      </li>
    );
  };

  return (
    <section className="wx-ctl" aria-label={t('audit.listTitle')}>
      <div className="wx-ctl__filters" role="tablist" aria-label={t('audit.filter')}>
        {['all', ...SEVERITY].map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            data-action={`check-filter-${f}`}
          >
            {t(`audit.filterLabel.${f}`)} <em>{fmt(f === 'all' ? items.length : counts[f])}</em>
          </button>
        ))}
      </div>
      {note && <p className="wx-muted wx-ctl__note">{note}</p>}

      {shown.length === 0 ? (
        <p className="wx-muted wx-ctl__empty">{items.length === 0 ? t('audit.clean') : t('audit.noneInFilter')}</p>
      ) : (
        <ul className="wx-ctl__list" ref={listRef}>
          {groups.map((group) => {
            if (group.items.length === 1) return row(group.items[0]);
            const isOpen = open.has(group.id);
            const sample = group.items[0];
            return (
              <li key={group.id} className={`wx-ctl__group wx-ctl__item--${group.severity}`} data-group-rule={group.rule} data-severity={group.severity}>
                <SeverityBadge severity={group.severity} t={t} />
                <div className="wx-ctl__main">
                  <button
                    type="button"
                    className="wx-ctl__title wx-ctl__toggle"
                    aria-expanded={isOpen}
                    onClick={() => toggle(group.id)}
                    data-action="check-group-toggle"
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {t(`audit.group.${group.rule}`, { n: fmt(group.items.length) }) || t('audit.group.other', { n: fmt(group.items.length) })}
                  </button>
                  <small>{t(`audit.rule.${sample.rule}.hint`, paramsFor(sample, t, fmt))}</small>
                  {isOpen && <ul className="wx-ctl__sub">{group.items.map((item) => row(item, { nested: true }))}</ul>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pending && <p className="wx-muted">{t('audit.retractionChecking')}</p>}
      <p className="wx-muted wx-ctl__limits">{t('audit.limits')}</p>
    </section>
  );
}

function SeverityBadge({ severity, t }) {
  const Icon = SEVERITY_ICON[severity];
  return (
    <span className={`wx-ctl__badge wx-ctl__badge--${severity}`}>
      <Icon size={12} aria-hidden="true" /> {t(`audit.severity.${severity}`)}
    </span>
  );
}
