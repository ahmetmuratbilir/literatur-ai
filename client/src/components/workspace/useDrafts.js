import { useCallback, useEffect, useState } from 'react';
import {
  INDEX_KEY, createDraft, deleteDraft, duplicateDraft, loadIndex, renameDraft, restoreDraft, setActive,
} from './drafts.js';

const storage = () => window.localStorage;

function safeIndex() {
  try {
    return loadIndex(storage());
  } catch {
    return { activeId: null, items: [], failed: true };
  }
}

/**
 * Taslak listesi (WO-011 Faz 1). Depolama işlemi başarısız olursa işlev
 * `null` döner; çağıran kullanıcıya söyler (sessiz kayıp yok).
 */
export function useDrafts() {
  const [index, setIndex] = useState(safeIndex);
  const refresh = useCallback(() => setIndex(safeIndex()), []);

  // Başka sekmede değişirse liste güncellensin.
  useEffect(() => {
    const onStorage = (e) => { if (!e.key || e.key === INDEX_KEY) refresh(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const run = useCallback((fn) => {
    try {
      const result = fn(storage());
      refresh();
      return result;
    } catch {
      refresh();
      return null;
    }
  }, [refresh]);

  return {
    index,
    items: index.items,
    active: index.items.find((d) => d.id === index.activeId) || null,
    refresh,
    create: useCallback((data) => run((s) => createDraft(s, data)), [run]),
    open: useCallback((id) => run((s) => setActive(s, id)), [run]),
    rename: useCallback((id, title) => run((s) => renameDraft(s, id, title)), [run]),
    duplicate: useCallback((id, suffix) => run((s) => duplicateDraft(s, id, { suffix })), [run]),
    remove: useCallback((id) => run((s) => deleteDraft(s, id)), [run]),
    restore: useCallback((snapshot) => run((s) => restoreDraft(s, snapshot)), [run]),
  };
}
