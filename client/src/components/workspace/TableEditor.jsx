import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Columns3, Rows3, Trash2,
} from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import {
  insertCol, insertRow, isSingleCell, moveCol, moveRow, parseTsv, pasteBlock, removeCol, removeRow, setAlign, setCell,
} from '../../visuals/table.js';

/** Panodaki HTML'de tablo varsa satırları (Word, Google Docs, Excel HTML). */
function rowsFromHtml(html) {
  if (!html || !/<table[\s>]/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;
  return [...table.rows].map((tr) => [...tr.cells].map((cell) => cell.textContent.replace(/\s+/g, ' ').trim()));
}

/**
 * Görsel paneli — tablo düzenleyici (WO-019 Faz 1). Napkin hissi: hücreye
 * tıkla-yaz; Enter alt hücre, son hücrede Tab yeni satır; Excel/Word'den
 * yapıştırılan blok ızgaraya dağılır. Durum üstte (`grid`), burada yalnız
 * etkin hücre tutulur.
 */
export default function TableEditor({ grid, onChange, onNotice }) {
  const { t, lang } = useI18n();
  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');
  const [active, setActive] = useState({ r: 0, c: 0 });
  const [focusAt, setFocusAt] = useState(null);
  const cellsRef = useRef(new Map());
  const rows = grid.cells.length;
  const cols = grid.cells[0].length;
  const r = Math.min(active.r, rows - 1);
  const c = Math.min(active.c, cols - 1);

  // Odak yalnız panelde bir hamle (Enter, Tab, satır ekle…) olunca taşınır.
  // Izgara belgeden yeniden okununca odak çalınmaz: kullanıcı belgede yazıyor.
  useEffect(() => {
    if (!focusAt) return;
    cellsRef.current.get(`${focusAt.r}:${focusAt.c}`)?.focus();
  }, [focusAt]);

  const go = (next, to) => {
    onChange(next);
    if (to) {
      setActive(to);
      setFocusAt((prev) => ({ ...to, tick: (prev?.tick || 0) + 1 }));
    }
  };

  const onKeyDown = (e, i, j) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (i === rows - 1) go(insertRow(grid, rows), { r: rows, c: j });
      else go(grid, { r: i + 1, c: j });
    } else if (e.key === 'Tab' && !e.shiftKey && i === rows - 1 && j === cols - 1) {
      // Word gibi: son hücrede Tab yeni satır açar. Son satır boşsa Tab
      // panelden çıkar; klavye kullanıcısı tablonun içinde hapsolmaz.
      if (grid.cells[i].some((v) => v.trim())) {
        e.preventDefault();
        go(insertRow(grid, rows), { r: rows, c: 0 });
      }
    }
  };

  const onPaste = (e, i, j) => {
    const data = e.clipboardData;
    if (!data) return;
    const block = rowsFromHtml(data.getData('text/html')) || parseTsv(data.getData('text/plain'));
    if (!block.length || isSingleCell(block)) return; // tek değer: hücreye düz metin olarak girsin
    e.preventDefault();
    const { grid: next, droppedRows, droppedCols } = pasteBlock(grid, i, j, block);
    go(next, { r: i, c: j });
    onNotice(droppedRows || droppedCols
      ? t('workspace.visual.table.pasteClipped', { rows: fmt(droppedRows), cols: fmt(droppedCols) })
      : t('workspace.visual.table.pasted', { rows: fmt(block.length), cols: fmt(Math.max(...block.map((b) => b.length))) }));
  };

  const tool = (label, icon, onClick, disabled = false, pressed) => (
    <button
      type="button"
      className="wx-icon wx-icon--sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
    >
      {icon}
    </button>
  );

  return (
    <div className="wx-tedit">
      <div className="wx-tedit__bar" role="toolbar" aria-label={t('workspace.visual.table.toolbar')}>
        <button type="button" className="wx-act" onClick={() => go(insertRow(grid, r + 1), { r: r + 1, c })} disabled={rows >= 200} data-action="table-add-row">
          <Rows3 size={13} /> {t('workspace.visual.table.addRow')}
        </button>
        <button type="button" className="wx-act" onClick={() => go(insertCol(grid, c + 1), { r, c: c + 1 })} disabled={cols >= 30} data-action="table-add-col">
          <Columns3 size={13} /> {t('workspace.visual.table.addCol')}
        </button>
        <label className="wx-tedit__check">
          <input type="checkbox" checked={grid.header} onChange={(e) => onChange({ ...grid, header: e.target.checked })} data-action="table-header" />
          {t('workspace.visual.table.header')}
        </label>
        <small className="wx-muted wx-tedit__size">{t('workspace.visual.table.size', { rows: fmt(rows), cols: fmt(cols) })}</small>
      </div>

      <div className="wx-tedit__bar wx-tedit__bar--cell" role="toolbar" aria-label={t('workspace.visual.table.cellTools', { r: fmt(r + 1), c: fmt(c + 1) })}>
        <small className="wx-muted">{t('workspace.visual.table.cellAt', { r: fmt(r + 1), c: fmt(c + 1) })}</small>
        {tool(t('workspace.visual.table.rowUp'), <ArrowUp size={14} />, () => go(moveRow(grid, r, r - 1), { r: r - 1, c }), r === 0)}
        {tool(t('workspace.visual.table.rowDown'), <ArrowDown size={14} />, () => go(moveRow(grid, r, r + 1), { r: r + 1, c }), r === rows - 1)}
        {tool(t('workspace.visual.table.colLeft'), <ArrowLeft size={14} />, () => go(moveCol(grid, c, c - 1), { r, c: c - 1 }), c === 0)}
        {tool(t('workspace.visual.table.colRight'), <ArrowRight size={14} />, () => go(moveCol(grid, c, c + 1), { r, c: c + 1 }), c === cols - 1)}
        <span className="wx-tedit__sep" aria-hidden="true" />
        {tool(t('workspace.visual.table.alignLeft'), <AlignLeft size={14} />, () => onChange(setAlign(grid, c, 'left')), false, grid.align[c] === 'left')}
        {tool(t('workspace.visual.table.alignCenter'), <AlignCenter size={14} />, () => onChange(setAlign(grid, c, 'center')), false, grid.align[c] === 'center')}
        {tool(t('workspace.visual.table.alignRight'), <AlignRight size={14} />, () => onChange(setAlign(grid, c, 'right')), false, grid.align[c] === 'right')}
      </div>
      <div className="wx-tedit__bar">
        <button type="button" className="wx-act wx-act--quiet" onClick={() => go(removeRow(grid, r), { r: Math.max(0, r - 1), c })} disabled={rows <= 1} data-action="table-remove-row">
          <Trash2 size={13} /> {t('workspace.visual.table.removeRow')}
        </button>
        <button type="button" className="wx-act wx-act--quiet" onClick={() => go(removeCol(grid, c), { r, c: Math.max(0, c - 1) })} disabled={cols <= 1} data-action="table-remove-col">
          <Trash2 size={13} /> {t('workspace.visual.table.removeCol')}
        </button>
      </div>

      <div className="wx-tedit__scroll">
        <table className="wx-tedit__grid" data-testid="table-editor">
          <tbody>
            {grid.cells.map((row, i) => (
              <tr key={i} className={grid.header && i === 0 ? 'is-head' : undefined}>
                {row.map((value, j) => (
                  <td key={j} className={i === r && j === c ? 'is-on' : undefined}>
                    <textarea
                      ref={(node) => {
                        if (node) cellsRef.current.set(`${i}:${j}`, node);
                        else cellsRef.current.delete(`${i}:${j}`);
                      }}
                      rows={1}
                      value={value}
                      style={{ textAlign: grid.align[j] }}
                      onFocus={() => setActive({ r: i, c: j })}
                      onChange={(e) => onChange(setCell(grid, i, j, e.target.value))}
                      onKeyDown={(e) => onKeyDown(e, i, j)}
                      onPaste={(e) => onPaste(e, i, j)}
                      aria-label={t('workspace.visual.table.cellAt', { r: fmt(i + 1), c: fmt(j + 1) })}
                      data-cell={`${i}:${j}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small className="wx-muted">{t('workspace.visual.table.keys')}</small>
    </div>
  );
}
