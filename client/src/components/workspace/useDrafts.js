import { useCallback, useEffect, useState } from 'react';
import {
  INDEX_KEY, createDraft, deleteDraft, duplicateDraft, loadIndex, newId, renameDraft, restoreDraft, setActive,
} from './drafts.js';

const storage = () => window.localStorage;
// Bu sekmede açık taslak. Dizindeki `activeId` "en son açılan"dır ve bütün
// sekmelerce paylaşılır; bir sekmede taslak açmak öbür sekmenin belgesini
// değiştirmemeli (WO-011 Faz 1 ek).
const OPEN_KEY = 'literatur-ai:open-draft';

function safeIndex() {
  try {
    return loadIndex(storage());
  } catch {
    return { activeId: null, items: [], failed: true };
  }
}

function readOpenId() {
  try {
    return window.sessionStorage.getItem(OPEN_KEY);
  } catch {
    return null;
  }
}

function rememberOpenId(id) {
  try {
    if (id) window.sessionStorage.setItem(OPEN_KEY, id);
    else window.sessionStorage.removeItem(OPEN_KEY);
  } catch {
    // Oturum deposu yoksa yalnız bellekte tutulur.
  }
}

/**
 * Taslak listesi (WO-011 Faz 1). Depolama işlemi başarısız olursa işlev
 * `null` döner; çağıran kullanıcıya söyler (sessiz kayıp yok).
 *
 * Depolamaya hiç yazılamıyorsa yeni taslak bellekte açılır (`memory`):
 * yazmak serbest, kayıt yok; yazar yüzeyi bunu kalıcı uyarıyla söyler.
 */
export function useDrafts() {
  const [index, setIndex] = useState(safeIndex);
  const [openId, setOpenId] = useState(readOpenId);
  const [memory, setMemory] = useState(null);
  const refresh = useCallback(() => setIndex(safeIndex()), []);

  // Başka sekmede değişirse liste güncellensin.
  useEffect(() => {
    const onStorage = (e) => { if (!e.key || e.key === INDEX_KEY) refresh(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const choose = useCallback((id) => {
    setOpenId(id);
    rememberOpenId(id);
  }, []);

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

  // Bu sekmede açık taslak listede yoksa (silindi, başka sekmede kaldırıldı)
  // en son açılana düşülür. Bellekteki taslak listede olmayabilir.
  const listed = index.items.find((d) => d.id === openId);
  const inMemory = memory && memory.meta.id === openId && !listed ? memory.meta : null;
  const active = listed || inMemory || index.items.find((d) => d.id === index.activeId) || null;

  return {
    index,
    items: index.items,
    active,
    /** Bellekteki taslağın ilk içeriği (yalnız depolama yazılamadığında). */
    memoryData: inMemory ? memory.data : null,
    refresh,
    create: useCallback((data) => {
      const id = run((s) => createDraft(s, data));
      if (id) choose(id);
      return id;
    }, [run, choose]),
    /** Depolama yazılamıyor: taslak yalnız bu sayfanın belleğinde açılır. */
    createInMemory: useCallback((data) => {
      const id = newId();
      setMemory({ meta: { id, title: data.title || '', savedAt: null, words: 0, section: '', format: data.format || null }, data });
      choose(id);
      return id;
    }, [choose]),
    open: useCallback((id) => {
      choose(id);
      return run((s) => setActive(s, id));
    }, [run, choose]),
    rename: useCallback((id, title) => run((s) => renameDraft(s, id, title)), [run]),
    duplicate: useCallback((id, suffix) => run((s) => duplicateDraft(s, id, { suffix })), [run]),
    remove: useCallback((id) => run((s) => deleteDraft(s, id)), [run]),
    restore: useCallback((snapshot) => run((s) => restoreDraft(s, snapshot)), [run]),
  };
}
