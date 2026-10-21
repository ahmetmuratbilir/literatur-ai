import { forwardRef } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, BetweenHorizontalEnd, BetweenHorizontalStart,
  BetweenVerticalEnd, BetweenVerticalStart, Captions, Paintbrush, PanelTop, Trash2,
} from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import { TABLE_THEMES } from './tableThemes.js';

/** Galerideki küçük önizleme: gerçek tablo kuralıyla (aynı CSS) çizilir. */
const Preview = ({ id, flags }) => (
  <table
    className="wx-vtable wx-ttheme__mini"
    data-theme={id === 'apa' ? undefined : id}
    data-band={flags.band ? '1' : undefined}
    data-total={flags.total ? '1' : undefined}
    data-firstcol={flags.firstcol ? '1' : undefined}
    aria-hidden="true"
  >
    {flags.header && <thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>}
    <tbody>
      {[0, 1, 2, 3].map((r) => <tr key={r}><td>{r + 1}</td><td>·</td><td>·</td></tr>)}
    </tbody>
  </table>
);

/**
 * İmleç tablodayken tablonun üstünde duran araç çubuğu (WO-025; Word'ün Tablo
 * Düzeni sekmesinin özü). Düğmeler fareyle basınca imleci tablodan almaz;
 * işlemi Workspace yapar (geri alınabilir).
 *
 * "Tasarım" (WO-031) Word'ün Tablo Tasarımı sekmesi gibi: tema galerisi ve
 * Başlık / Toplam / Bantlı satır / İlk sütun seçenekleri.
 *
 * Satır taşıma düğmesi yok: Alt+Shift+↑/↓ (Word'de de kısayol); çubuk dar kalsın.
 *
 * @param ctx `{ row, col, rows, cols, header, inHeader, hasCaption, align, theme, flags }`
 */
const TableToolbar = forwardRef(function TableToolbar({ ctx, style, onAction, designOpen = false, onDesignOpen }, ref) {
  const { t } = useI18n();
  const k = (key, p) => t(`workspace.table.${key}`, p);
  // Açık/kapalı durumu Workspace'te: tema seçilince tablo yeniden yazılır ve çubuk yeniden kurulur.
  const setDesignOpen = (v) => onDesignOpen?.(typeof v === 'function' ? v(designOpen) : v);
  const flags = { header: ctx.header, ...(ctx.flags || {}) };
  const btn = (action, label, icon, { disabled = false, pressed } = {}) => (
    <button
      type="button"
      className="wx-ttool"
      onClick={() => onAction(action)}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      data-action={`table-${action}`}
    >
      {icon}
    </button>
  );
  const option = (key) => (
    <label key={key} className="wx-ttheme__opt">
      <input
        type="checkbox"
        checked={Boolean(flags[key])}
        onChange={() => onAction(key === 'header' ? 'header' : `flag:${key}`)}
        data-action={`table-flag-${key}`}
      />
      {k(`flag.${key}`)}
    </label>
  );
  return (
    <div ref={ref} className="wx-ttbar" role="toolbar" aria-label={k('toolbar')} style={style} onMouseDown={(e) => e.preventDefault()} data-testid="table-toolbar">
      <span className="wx-ttheme__anchor">
        <button
          type="button"
          className="wx-ttool wx-ttool--text wx-ttool--design"
          aria-expanded={designOpen}
          aria-haspopup="dialog"
          onClick={() => setDesignOpen((o) => !o)}
          data-action="table-design"
          title={k('design')}
        >
          <Paintbrush size={14} /> {k('design')}
        </button>
        {designOpen && (
          <div className="wx-ttheme" role="dialog" aria-label={k('designTitle')} data-testid="table-design" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setDesignOpen(false); } }}>
            <div className="wx-ttheme__opts">{['header', 'total', 'band', 'firstcol'].map(option)}</div>
            <div className="wx-ttheme__grid">
              {TABLE_THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  className="wx-ttheme__item"
                  aria-pressed={(ctx.theme || 'apa') === th.id}
                  onClick={() => onAction(`theme:${th.id}`)}
                  data-theme-id={th.id}
                  title={k(`theme.${th.id}`)}
                >
                  <Preview id={th.id} flags={flags} />
                  <span className="wx-ttheme__name">{k(`theme.${th.id}`)}</span>
                  {!th.apa && <small className="wx-ttheme__tag">{k('notApa')}</small>}
                </button>
              ))}
            </div>
            <p className="wx-ttheme__note">{k('designNote')}</p>
          </div>
        )}
      </span>
      <span className="wx-ttbar__sep" aria-hidden="true" />
      {btn('row-above', k('rowAbove'), <BetweenHorizontalStart size={15} />, { disabled: ctx.inHeader })}
      {btn('row-below', k('rowBelow'), <BetweenHorizontalEnd size={15} />)}
      {btn('col-left', k('colLeft'), <BetweenVerticalStart size={15} />)}
      {btn('col-right', k('colRight'), <BetweenVerticalEnd size={15} />)}
      <span className="wx-ttbar__sep" aria-hidden="true" />
      {btn('align-left', k('alignLeft'), <AlignLeft size={15} />, { pressed: ctx.align === 'left' })}
      {btn('align-center', k('alignCenter'), <AlignCenter size={15} />, { pressed: ctx.align === 'center' })}
      {btn('align-right', k('alignRight'), <AlignRight size={15} />, { pressed: ctx.align === 'right' })}
      <span className="wx-ttbar__sep" aria-hidden="true" />
      {btn('header', k('headerRow'), <PanelTop size={15} />, { pressed: ctx.header })}
      {btn('caption', ctx.hasCaption ? k('captionRemove') : k('captionAdd'), <Captions size={15} />, { pressed: ctx.hasCaption })}
      <span className="wx-ttbar__sep" aria-hidden="true" />
      <button type="button" className="wx-ttool wx-ttool--text" onClick={() => onAction('del-row')} data-action="table-del-row" title={k('deleteRow')}>{k('deleteRowShort')}</button>
      <button type="button" className="wx-ttool wx-ttool--text" onClick={() => onAction('del-col')} data-action="table-del-col" title={k('deleteCol')}>{k('deleteColShort')}</button>
      {btn('delete', k('deleteTable'), <Trash2 size={15} />)}
    </div>
  );
});

export default TableToolbar;
