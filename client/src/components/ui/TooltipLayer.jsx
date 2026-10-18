import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Uygulamanın tek ipucu katmanı (WO-024).
 *
 * Tarayıcının `title` kutusu yavaş (~1 sn), stilsiz, klavyeyle açılmaz ve
 * dokunmatikte hiç çıkmaz. Bu katman `title` ya da `data-tip` taşıyan her
 * öğe için, üzerine gelindiğinde veya klavyeyle odaklanıldığında ürünün
 * kendi ipucunu gösterir. Bileşenlere tek tek dokunmak gerekmez.
 *
 * Kurallar (vercel-labs/web-interface-guidelines):
 * - İlk ipucu kısa bir gecikmeyle açılır; komşusuna geçince gecikme yok.
 * - `title` yalnız gösterim sırasında geçici olarak kaldırılır (çift ipucu
 *   olmasın), ayrılınca aynen geri konur: erişilebilir ad ve testler hep
 *   özgün değeri görür.
 * - Ekran okuyucu için ipucu `aria-describedby` ile bağlanır; metin öğenin
 *   adıyla aynıysa bağlanmaz (aynı şeyi iki kez okutmamak için).
 * - Esc, tıklama, kaydırma ve pencere değişimi ipucunu kapatır.
 */
const OPEN_DELAY = 420;
const PEER_WINDOW = 700;
const ID = 'ui-tooltip';

const findTarget = (node) => node?.closest?.('[data-tip], [title]');

export default function TooltipLayer() {
  const [tip, setTip] = useState(null); // { text, x, y, place }
  const state = useRef({ target: null, timer: 0, lastHide: 0, savedTitle: null });

  useEffect(() => {
    const s = state.current;
    const restore = () => {
      const el = s.target;
      if (!el) return;
      if (s.savedTitle !== null && !el.hasAttribute('title')) el.setAttribute('title', s.savedTitle);
      if (el.getAttribute('aria-describedby') === ID) el.removeAttribute('aria-describedby');
      s.savedTitle = null;
    };
    const hide = () => {
      clearTimeout(s.timer);
      if (s.target) { restore(); s.lastHide = Date.now(); }
      s.target = null;
      setTip(null);
    };
    const show = (el) => {
      if (!el.isConnected) return;
      const text = (el.dataset.tip || el.getAttribute('title') || '').trim();
      if (!text) return;
      s.target = el;
      if (el.hasAttribute('title')) { s.savedTitle = el.getAttribute('title'); el.removeAttribute('title'); }
      const name = (el.getAttribute('aria-label') || el.innerText || '').trim();
      if (name !== text) el.setAttribute('aria-describedby', ID);
      const r = el.getBoundingClientRect();
      if (el.dataset.tipSide === 'right') {
        setTip({ text, x: r.right + 10, y: r.top + r.height / 2, place: 'right' });
        return;
      }
      const below = r.top < 56;
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, place: below ? 'below' : 'above' });
    };
    const schedule = (el) => {
      if (s.target === el) return;
      hide();
      const quick = Date.now() - s.lastHide < PEER_WINDOW;
      s.timer = setTimeout(() => show(el), quick ? 0 : OPEN_DELAY);
    };

    const onOver = (e) => {
      if (e.pointerType === 'touch') return;
      const el = findTarget(e.target);
      if (el) schedule(el); else if (s.target) hide();
    };
    const onOut = (e) => {
      const from = findTarget(e.target);
      if (!from) return;
      if (from.contains(e.relatedTarget)) return;
      if (s.target === from || !s.target) hide();
    };
    const onFocus = (e) => {
      // Yalnız klavye odağı: fareyle tıklayınca ipucu açılmasın.
      const el = findTarget(e.target);
      if (el && e.target.matches?.(':focus-visible')) schedule(el);
    };
    const onKey = (e) => { if (e.key === 'Escape' && s.target) hide(); };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  return <Bubble tip={tip} />;
}

/** Çizildikten sonra ölçülür; ekran kenarına taşıyorsa 8 px içeri kaydırılır. */
function Bubble({ tip }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.marginLeft = '0px';
    const r = el.getBoundingClientRect();
    let dx = 0;
    if (r.left < 8) dx = 8 - r.left;
    else if (r.right > window.innerWidth - 8) dx = window.innerWidth - 8 - r.right;
    el.style.marginLeft = `${dx}px`;
  }, [tip]);
  if (!tip) return null;
  return createPortal(
    <div ref={ref} id={ID} role="tooltip" className={`ui-tooltip ui-tooltip--${tip.place}`} style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>,
    document.body,
  );
}
