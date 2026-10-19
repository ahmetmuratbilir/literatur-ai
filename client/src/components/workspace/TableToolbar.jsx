import { forwardRef } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, BetweenHorizontalEnd, BetweenHorizontalStart,
  BetweenVerticalEnd, BetweenVerticalStart, Captions, PanelTop, Trash2,
} from 'lucide-react';
import { useI18n } from '../../i18n/context.js';

/**
 * İmleç tablodayken tablonun üstünde duran araç çubuğu (WO-025; Word'ün Tablo
 * Düzeni sekmesinin özü). Düğmeler fareyle basınca imleci tablodan almaz;
 * işlemi Workspace yapar (geri alınabilir).
 *
 * Satır taşıma düğmesi yok: Alt+Shift+↑/↓ (Word'de de kısayol); çubuk dar kalsın.
 *
 * @param ctx `{ row, col, rows, cols, header, inHeader, hasCaption, align }`
 */
const TableToolbar = forwardRef(function TableToolbar({ ctx, style, onAction }, ref) {
  const { t } = useI18n();
  const k = (key) => t(`workspace.table.${key}`);
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
  return (
    <div ref={ref} className="wx-ttbar" role="toolbar" aria-label={k('toolbar')} style={style} onMouseDown={(e) => e.preventDefault()} data-testid="table-toolbar">
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
