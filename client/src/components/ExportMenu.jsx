import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

/**
 * PDF / CSV / DOCX tek bir menüde. Önceki üç ayrı düğme mobilde dağınık bir
 * ızgaraya dönüşüyordu.
 */
const ExportMenu = ({ onPdf, onCsv, onDocx }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const pick = (fn) => { setOpen(false); fn(); };

  return (
    <div className="ui-menu" ref={ref}>
      <button type="button" className="ui-btn ui-btn--outline" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Download size={14} /> {t('results.export')} <ChevronDown size={14} />
      </button>
      {open && (
        <ul className="ui-menu__list" role="menu">
          <li role="none"><button type="button" role="menuitem" className="ui-menu__item" onClick={() => pick(onPdf)}>PDF</button></li>
          <li role="none"><button type="button" role="menuitem" className="ui-menu__item" onClick={() => pick(onDocx)}>Word (DOCX)</button></li>
          <li role="none"><button type="button" role="menuitem" className="ui-menu__item" onClick={() => pick(onCsv)}>Excel (CSV)</button></li>
        </ul>
      )}
    </div>
  );
};

export default ExportMenu;
