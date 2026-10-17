import { createContext, useContext } from 'react';

/** Ortak pencere bağlamı (WO-018); sağlayıcı `DialogProvider.jsx`. */
export const DialogContext = createContext(null);

/**
 *   const { askConfirm, askText } = useDialogs();
 *   if (await askConfirm({ title, body, confirmLabel, danger: true })) …
 *   const name = await askText({ title, label, initial });   // null = vazgeçti
 */
export function useDialogs() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs: DialogProvider yok');
  return ctx;
}
