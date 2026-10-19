import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/context.js';
import { PICKER_COLS, PICKER_ROWS, pickerSize } from '../../visuals/table.js';

const CAPTION_KEY = 'literatur-ai:table-caption';
const readCaptionPref = () => {
  try { return localStorage.getItem(CAPTION_KEY) !== '0'; } catch { return true; }
};

/**
 * Word'deki Ekle › Tablo ızgarası (WO-025): üzerine gelinen hücreye kadar
 * boyanır, üstte "3 sütun × 4 satır" yazar; tıklayınca o boyutta tablo eklenir.
 * Klavye: oklar seçimi büyütür/küçültür, Enter ekler (Esc'yi Popover kapatır).
 */
export default function TableGridPicker({ onPick }) {
  const { t } = useI18n();
  const [pos, setPos] = useState({ row: 0, col: 0 });
  const [withCaption, setWithCaption] = useState(readCaptionPref);
  const gridRef = useRef(null);
  const size = pickerSize(pos.row, pos.col);

  useEffect(() => { gridRef.current?.focus({ preventScroll: true }); }, []);

  const pick = (s = size) => onPick({ ...s, caption: withCaption });

  const onKeyDown = (e) => {
    const step = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
    if (step) {
      e.preventDefault();
      setPos((p) => ({
        row: Math.max(0, Math.min(PICKER_ROWS - 1, p.row + step[0])),
        col: Math.max(0, Math.min(PICKER_COLS - 1, p.col + step[1])),
      }));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick();
    }
  };

  const toggleCaption = (on) => {
    setWithCaption(on);
    try { localStorage.setItem(CAPTION_KEY, on ? '1' : '0'); } catch { /* tercih hatırlanmaz; ekleme çalışır */ }
  };

  return (
    <div className="wx-tgrid">
      <div className="wx-tgrid__label" aria-hidden="true">{t('workspace.table.size', { cols: size.cols, rows: size.rows })}</div>
      <div
        ref={gridRef}
        className="wx-tgrid__cells"
        role="grid"
        tabIndex={0}
        aria-label={t('workspace.table.gridLabel')}
        aria-description={t('workspace.table.size', { cols: size.cols, rows: size.rows })}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setPos({ row: 0, col: 0 })}
        data-action="table-grid"
      >
        {Array.from({ length: PICKER_ROWS }, (_, r) => (
          <div key={r} className="wx-tgrid__row" role="row">
            {Array.from({ length: PICKER_COLS }, (_, c) => (
              <span
                key={c}
                role="gridcell"
                className={`wx-tgrid__cell${r <= pos.row && c <= pos.col ? ' is-on' : ''}`}
                onMouseEnter={() => setPos({ row: r, col: c })}
                onClick={() => pick(pickerSize(r, c))}
                data-cell={`${r}:${c}`}
              />
            ))}
          </div>
        ))}
      </div>
      <label className="wx-tgrid__opt">
        <input type="checkbox" checked={withCaption} onChange={(e) => toggleCaption(e.target.checked)} data-action="table-caption-pref" />
        {t('workspace.table.withCaption')}
      </label>
    </div>
  );
}
