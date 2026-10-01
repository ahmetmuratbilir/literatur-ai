/**
 * "Sepete ekle" animasyonu: düğmeden, görünen sepet hedefine
 * ([data-basket-target]) küçülerek uçan bir makale etiketi.
 * Hareket azaltma tercihi açıksa ya da hedef görünmüyorsa hiçbir şey yapmaz.
 */
export function flyToBasket(fromEl, label = '') {
  if (!fromEl || typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  // Önce sağdaki yazar modu düğmesi ("primary"), görünmüyorsa kenar çubuğu.
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const target = [...document.querySelectorAll('[data-basket-target="primary"]')].find(visible)
    || [...document.querySelectorAll('[data-basket-target]')].find(visible);
  if (!target) return;

  const from = fromEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();

  const chip = document.createElement('div');
  chip.className = 'basket-fly';
  chip.textContent = label.length > 48 ? `${label.slice(0, 46)}…` : label;
  chip.style.left = `${from.left}px`;
  chip.style.top = `${from.top}px`;
  document.body.appendChild(chip);

  const dx = to.left + to.width / 2 - (from.left + chip.offsetWidth / 2);
  const dy = to.top + to.height / 2 - (from.top + chip.offsetHeight / 2);

  const anim = chip.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.7)`, opacity: 0.9, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0.2 },
  ], { duration: 650, easing: 'cubic-bezier(.5,0,.3,1)' });

  const done = () => {
    chip.remove();
    target.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 });
  };
  anim.onfinish = done;
  anim.oncancel = () => chip.remove();
}
