/**
 * Metni panoya kopyalar (WO-024). Modern pano API'si izin vermezse (Safari
 * izni, http bağlamı, gömülü çerçeve) eski `execCommand('copy')` yolu denenir.
 * @param {string} text
 * @returns {Promise<boolean>} kopyalandıysa true
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* eski yola düş */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
