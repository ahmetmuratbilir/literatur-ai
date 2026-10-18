import { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/context.js';
import { useModal } from './useModal.js';
import { DialogContext } from './dialogContext.js';

/**
 * Ortak pencere (WO-018, etkileşim planı §1.3). Tarayıcının `confirm` ve
 * `prompt` kutularının yerine ürünün kendi penceresi:
 *
 *   const { askConfirm, askText } = useDialogs();
 *   if (await askConfirm({ title, body, confirmLabel, danger: true })) …
 *   const name = await askText({ title, label, initial });   // null = vazgeçti
 *
 * Kurallar: aynı anda tek pencere; odak pencerede kalır (Tab döner); arka
 * plan `inert`; açılışta ilk anlamlı alana odak (metin alanı seçili ya da
 * "Vazgeç" — geri alınamaz eylemde varsayılan güvenli düğme); kapanınca odak
 * açan öğeye döner; Esc yalnız bu pencereyi kapatır; dışarı tıklama yalnız
 * değişiklik yoksa kapatır.
 */

export function DialogProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const open = useCallback((kind, opts) => new Promise((resolve) => {
    setCurrent((prev) => {
      // Tek pencere: açıkken yenisi gelirse öncekisi vazgeçilmiş sayılır.
      prev?.resolve(prev.kind === 'text' ? null : false);
      return { ...opts, kind, resolve };
    });
  }), []);
  const askConfirm = useCallback((opts) => open('confirm', opts), [open]);
  const askText = useCallback((opts) => open('text', opts), [open]);
  const finish = useCallback((value) => {
    setCurrent((prev) => { prev?.resolve(value); return null; });
  }, []);
  return (
    <DialogContext.Provider value={{ askConfirm, askText }}>
      {children}
      {current && <Dialog key={current.title} spec={current} onFinish={finish} />}
    </DialogContext.Provider>
  );
}

function Dialog({ spec, onFinish }) {
  const { t } = useI18n();
  const id = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const cancelRef = useRef(null);
  const [value, setValue] = useState(spec.initial ?? '');
  const isText = spec.kind === 'text';
  const dirty = isText && value !== (spec.initial ?? '');
  const cancelValue = isText ? null : false;
  const cancel = () => onFinish(cancelValue);
  const confirm = () => {
    if (isText) { if (value.trim()) onFinish(value.trim()); return; }
    onFinish(true);
  };

  // Arka plan inert, açılış odağı (metin alanı ya da güvenli "Vazgeç"), Tab
  // döngüsü, Esc ve kapanışta odağın geri dönmesi: useModal (WO-024).
  const trapTab = useModal(rootRef, { onCancel: cancel, initialFocus: isText ? inputRef : cancelRef });

  const onKeyDown = (e) => {
    trapTab(e);
    if (e.key === 'Enter' && isText && e.target === inputRef.current) { e.preventDefault(); confirm(); }
  };

  return createPortal(
    <div
      ref={rootRef}
      className="ui-dialog-scrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !dirty) cancel(); }}
    >
      <div
        className="ui-dialog"
        role={spec.danger ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={spec.body ? `${id}-b` : undefined}
        onKeyDown={onKeyDown}
        data-testid="dialog"
      >
        <h2 id={`${id}-t`} className="ui-dialog__title">{spec.title}</h2>
        {spec.body && <p id={`${id}-b`} className="ui-dialog__body">{spec.body}</p>}
        {spec.list?.length > 0 && <ul className="ui-dialog__list">{spec.list.map((x) => <li key={x}>{x}</li>)}</ul>}
        {isText && (
          <label className="ui-dialog__field">
            <span>{spec.label}</span>
            <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} maxLength={spec.maxLength || 200} data-action="dialog-input" />
          </label>
        )}
        <div className="ui-dialog__actions">
          <button ref={cancelRef} type="button" className="ui-btn ui-btn--ghost" onClick={cancel} data-action="dialog-cancel">
            {spec.cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            className={`ui-btn ${spec.danger ? 'ui-btn--danger' : 'ui-btn--primary'}`}
            onClick={confirm}
            disabled={isText && !value.trim()}
            data-action="dialog-confirm"
          >
            {spec.confirmLabel || t('common.ok')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
