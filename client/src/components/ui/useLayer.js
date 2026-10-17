import { useEffect, useRef } from 'react';
import { installEscape, layers } from './layerStack.js';

/**
 * Açıkken katman yığınına girer; Esc yalnız en üstteki katmanı kapatır
 * (WO-018). `onClose` her çizimde değişebilir; son hali çağrılır.
 */
export function useLayer(open, onClose) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!open) return undefined;
    installEscape();
    const layer = { close: () => closeRef.current?.() };
    return layers.push(layer);
  }, [open]);
}
