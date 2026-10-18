import { useEffect, useRef } from 'react';
import { useLayer } from './useLayer.js';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Pencere davranışı (WO-018 kuralları, WO-024'te ortak kancaya çıkarıldı):
 * arka plan `inert`; açılışta odak `initialFocus`'a ya da ilk odaklanabilir
 * öğeye; Tab pencerede döner; Esc yalnız bu pencereyi kapatır; kapanınca
 * odak açan öğeye döner.
 *
 *   const rootRef = useRef(null);
 *   const onKeyDown = useModal(rootRef, { open, onCancel, initialFocus });
 *   <div ref={rootRef} onKeyDown={onKeyDown}>…</div>
 *
 * @returns {(e: KeyboardEvent) => void} pencerenin onKeyDown'u (Tab döngüsü)
 */
export function useModal(rootRef, { open = true, onCancel, initialFocus } = {}) {
  useLayer(open, onCancel);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    const root = rootRef.current;
    const touched = [];
    for (const el of document.body.children) {
      if (!root || el === root || el.contains(root) || el.inert) continue;
      el.inert = true;
      el.setAttribute('aria-hidden', 'true');
      touched.push(el);
    }
    const target = initialFocus?.current || root?.querySelector(FOCUSABLE);
    target?.focus?.({ preventScroll: true });
    if (target?.select && target.tagName === 'INPUT') target.select();
    const opener = openerRef.current;
    return () => {
      for (const el of touched) { el.inert = false; el.removeAttribute('aria-hidden'); }
      if (opener && opener.isConnected) opener.focus?.({ preventScroll: true });
    };
    // initialFocus bir ref; değişmesi beklenmez.
  }, [open, rootRef, initialFocus]);

  return (e) => {
    if (e.key !== 'Tab' || !rootRef.current) return;
    const items = [...rootRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
  };
}
