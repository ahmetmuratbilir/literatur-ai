import { useMemo, useState } from 'react';
import { BarChart3, Check, LineChart, Plus, RefreshCw, Shapes, Trash2, X } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import {
  CHART_TYPES, FIGURE_TYPES, drawChart, drawCompare, drawCycle, drawSteps, drawTimeline, sentencesOf,
} from '../../visuals/draw.js';

const EMPTY = {
  items: ['', '', ''],
  compare: { leftTitle: '', rightTitle: '', left: '', right: '' },
  timeline: [{ date: '', text: '' }, { date: '', text: '' }],
  chart: { rows: [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }], unit: '', xTitle: '', yTitle: '' },
};

const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);

/** Taslağın SVG'si; içerik yoksa null (Tamam pasif). */
function renderDraft(type, data, label, locale) {
  if (type === 'steps' || type === 'cycle') {
    const items = data.items.map((s) => s.trim()).filter(Boolean);
    if (items.length < 2) return null;
    return { svg: type === 'steps' ? drawSteps(items, { label }) : drawCycle(items, { label }) };
  }
  if (type === 'compare') {
    const c = data.compare;
    if (!c.leftTitle.trim() || !c.rightTitle.trim() || (!lines(c.left).length && !lines(c.right).length)) return null;
    return { svg: drawCompare({ leftTitle: c.leftTitle, rightTitle: c.rightTitle, left: lines(c.left), right: lines(c.right) }, { label }) };
  }
  if (type === 'timeline') {
    const rows = data.timeline.filter((r) => r.date.trim() || r.text.trim());
    if (rows.length < 2) return null;
    return { svg: drawTimeline(rows, { label }) };
  }
  const r = drawChart(type, data.chart, { label, locale });
  return r.count ? { svg: r.svg, skipped: r.skipped } : null;
}

/**
 * Napkin gibi taslak alan (WO-028). Belgede seçili paragrafın altında açılır;
 * içindekiler belgeye ancak "Tamam" ile girer (tüzük 2.9). Etiketler ve sayılar
 * kullanıcıdan ya da paragraftan; model yok, uydurma yok (2.8).
 *
 * @param mode 'figure' | 'chart'
 * @param initial Düzenlenen görselin kayıtlı durumu ({ type, data, title }) ya da null
 * @param sourceText Hedef paragrafın metni ("Paragraftan al")
 * @param sourceRows Hedef tablo varsa satırları ("Tablodan al")
 */
export default function FigureDraft({ mode, initial, sourceText, sourceRows, number, style, onDone, onCancel }) {
  const { t, lang } = useI18n();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const k = (key, p) => t(`workspace.figure.${key}`, p);
  const types = mode === 'chart' ? CHART_TYPES : FIGURE_TYPES;
  const [type, setType] = useState(initial?.type || types[0]);
  const [data, setData] = useState(() => ({ ...EMPTY, ...(initial?.data || {}) }));
  const [title, setTitle] = useState(initial?.title || '');
  const preview = useMemo(() => renderDraft(type, data, title, locale), [type, data, title, locale]);
  const patch = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const word = t('audit.kind.figure');

  const itemsEditor = (
    <div className="fd-list">
      {data.items.map((v, i) => (
        <div key={i} className="fd-row">
          <span className="fd-n">{i + 1}</span>
          <input value={v} onChange={(e) => patch('items', data.items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={k('itemPlaceholder')} aria-label={k('item', { n: i + 1 })} data-fd="item" />
          <button type="button" className="fd-icon" onClick={() => patch('items', data.items.filter((_, j) => j !== i))} disabled={data.items.length <= 2} aria-label={k('remove')} title={k('remove')}><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="fd-acts">
        <button type="button" className="fd-btn" onClick={() => patch('items', [...data.items, ''])} disabled={data.items.length >= 8}><Plus size={13} /> {k('addItem')}</button>
        {sourceText && (
          <button type="button" className="fd-btn" onClick={() => patch('items', sentencesOf(sourceText).slice(0, 8))} data-action="fd-from-paragraph" title={k('fromParagraphHint')}>
            <RefreshCw size={13} /> {k('fromParagraph')}
          </button>
        )}
      </div>
    </div>
  );

  const compareEditor = (
    <div className="fd-cols">
      {['left', 'right'].map((side) => (
        <div key={side} className="fd-col">
          <input value={data.compare[`${side}Title`]} onChange={(e) => patch('compare', { ...data.compare, [`${side}Title`]: e.target.value })} placeholder={k(`${side}Title`)} aria-label={k(`${side}Title`)} data-fd={`${side}-title`} />
          <textarea rows={5} value={data.compare[side]} onChange={(e) => patch('compare', { ...data.compare, [side]: e.target.value })} placeholder={k('onePerLine')} aria-label={k(`${side}Items`)} data-fd={`${side}-items`} />
        </div>
      ))}
    </div>
  );

  const timelineEditor = (
    <div className="fd-list">
      {data.timeline.map((r, i) => (
        <div key={i} className="fd-row">
          <input className="fd-date" value={r.date} onChange={(e) => patch('timeline', data.timeline.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} placeholder={k('date')} aria-label={k('date')} />
          <input value={r.text} onChange={(e) => patch('timeline', data.timeline.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder={k('event')} aria-label={k('event')} />
          <button type="button" className="fd-icon" onClick={() => patch('timeline', data.timeline.filter((_, j) => j !== i))} disabled={data.timeline.length <= 2} aria-label={k('remove')}><Trash2 size={13} /></button>
        </div>
      ))}
      <button type="button" className="fd-btn" onClick={() => patch('timeline', [...data.timeline, { date: '', text: '' }])} disabled={data.timeline.length >= 8}><Plus size={13} /> {k('addItem')}</button>
    </div>
  );

  const c = data.chart;
  const chartEditor = (
    <div className="fd-list">
      <div className="fd-row fd-row--head"><span>{k('label')}</span><span>{k('value')}</span><span /></div>
      {c.rows.map((r, i) => (
        <div key={i} className="fd-row">
          <input value={r.label} onChange={(e) => patch('chart', { ...c, rows: c.rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder={k('label')} aria-label={k('label')} data-fd="chart-label" />
          <input className="fd-num" inputMode="decimal" value={r.value} onChange={(e) => patch('chart', { ...c, rows: c.rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="0" aria-label={k('value')} data-fd="chart-value" />
          <button type="button" className="fd-icon" onClick={() => patch('chart', { ...c, rows: c.rows.filter((_, j) => j !== i) })} disabled={c.rows.length <= 1} aria-label={k('remove')}><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="fd-acts">
        <button type="button" className="fd-btn" onClick={() => patch('chart', { ...c, rows: [...c.rows, { label: '', value: '' }] })} disabled={c.rows.length >= 12}><Plus size={13} /> {k('addRow')}</button>
        {sourceRows?.length > 0 && (
          <button type="button" className="fd-btn" onClick={() => patch('chart', { ...c, rows: sourceRows.slice(0, 12) })} data-action="fd-from-table" title={k('fromTableHint')}>
            <RefreshCw size={13} /> {k('fromTable')}
          </button>
        )}
      </div>
      <div className="fd-axes">
        <input value={c.yTitle} onChange={(e) => patch('chart', { ...c, yTitle: e.target.value })} placeholder={k('yTitle')} aria-label={k('yTitle')} />
        <input value={c.unit} onChange={(e) => patch('chart', { ...c, unit: e.target.value })} placeholder={k('unit')} aria-label={k('unit')} />
        <input value={c.xTitle} onChange={(e) => patch('chart', { ...c, xTitle: e.target.value })} placeholder={k('xTitle')} aria-label={k('xTitle')} />
      </div>
    </div>
  );

  const editor = type === 'compare' ? compareEditor : type === 'timeline' ? timelineEditor : CHART_TYPES.includes(type) ? chartEditor : itemsEditor;
  const icon = (ty) => (ty === 'bar' ? <BarChart3 size={14} /> : ty === 'line' ? <LineChart size={14} /> : <Shapes size={14} />);

  return (
    <section className="fd" style={style} aria-label={k(mode === 'chart' ? 'chartTitle' : 'figureTitle')} data-testid="figure-draft" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
      <header className="fd-head">
        <span className="fd-badge">{k('draftBadge')}</span>
        <div className="fd-types" role="group" aria-label={k('type')}>
          {types.map((ty) => (
            <button key={ty} type="button" aria-pressed={type === ty} onClick={() => setType(ty)} data-fd-type={ty}>{icon(ty)} {k(`types.${ty}`)}</button>
          ))}
        </div>
        <button type="button" className="fd-icon" onClick={onCancel} aria-label={k('cancel')} title={k('cancel')}><X size={15} /></button>
      </header>
      <div className="fd-body">
        <div className="fd-edit">{editor}</div>
        <div className="fd-preview" aria-live="polite">
          {/* Önizleme bizim çizicimizin, kaçışlı SVG'si. */}
          {preview ? <div className="fd-svg" dangerouslySetInnerHTML={{ __html: preview.svg }} /> : <p className="fd-empty">{k(CHART_TYPES.includes(type) ? 'needData' : 'needItems')}</p>}
          {preview?.skipped > 0 && <small className="fd-warn">{k('skipped', { n: preview.skipped })}</small>}
        </div>
      </div>
      <footer className="fd-foot">
        <label className="fd-caption">
          <span>{word} {number}.</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={k('captionPlaceholder')} aria-label={k('captionLabel')} data-fd="caption" />
        </label>
        <button type="button" className="fd-btn" onClick={onCancel} data-action="fd-cancel">{k('cancel')}</button>
        <button type="button" className="fd-btn fd-btn--primary" onClick={() => preview && onDone({ type, data, title, svg: preview.svg })} disabled={!preview} data-action="fd-done">
          <Check size={14} /> {k('done')}
        </button>
      </footer>
    </section>
  );
}
