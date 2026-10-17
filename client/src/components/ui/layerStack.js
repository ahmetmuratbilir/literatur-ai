/**
 * Katman yığını (WO-018, etkileşim planı §1.2). Saf modül, DOM yok.
 *
 * Açılan her katman (açılır menü, çekmece, pencere, biçim seçici) yığına
 * girer. Tek bir `keydown` dinleyicisi Esc'de yalnız en üsttekini kapatır.
 * Daha önce 7 ayrı belge dinleyicisi vardı: iki katman açıkken bir Esc
 * ikisini birden kapatıyordu.
 *
 * Bir giriş alanı Esc'yi kendisi karşılıyorsa (öneri listesini kapatmak,
 * yeniden adlandırmayı bırakmak) `preventDefault` çağırır; yığın o tuşa
 * dokunmaz.
 */

export function createLayerStack() {
  const stack = [];
  return {
    /** Katmanı ekler; geri dönen fonksiyon onu çıkarır (aynı nesne birden çok kez girmez). */
    push(layer) {
      if (!stack.includes(layer)) stack.push(layer);
      return () => this.remove(layer);
    },
    remove(layer) {
      const i = stack.lastIndexOf(layer);
      if (i >= 0) stack.splice(i, 1);
    },
    top() {
      return stack.length ? stack[stack.length - 1] : null;
    },
    size() {
      return stack.length;
    },
    /** Esc olayını işler: yalnız en üstteki kapanır. İşlendiyse true. */
    handleKey(event) {
      if (!event || event.key !== 'Escape' || event.defaultPrevented) return false;
      const top = this.top();
      if (!top) return false;
      event.preventDefault?.();
      top.close();
      return true;
    },
  };
}

/** Uygulamanın tek yığını. */
export const layers = createLayerStack();

let installed = false;
/** Tek belge dinleyicisini bir kez kurar. */
export function installEscape(target = typeof document !== 'undefined' ? document : null) {
  if (installed || !target) return;
  installed = true;
  target.addEventListener('keydown', (e) => { layers.handleKey(e); });
}
