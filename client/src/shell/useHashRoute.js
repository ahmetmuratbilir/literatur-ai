import { useCallback, useEffect, useState } from 'react';
import { formatRoute, parseHash } from './routes.js';

const readRoute = () => (typeof window === 'undefined' ? parseHash('') : parseHash(window.location.hash));

/**
 * Kabuğun adresi. `enabled` false iken (eski arayüz, paylaşılan bağlantı)
 * adres çubuğuna dokunmaz.
 *
 * Geri tuşu her modül değişiminde bir adım geri gider; aynı adrese tekrar
 * gitmek geçmişe yeni kayıt eklemez.
 * @returns {[object, (route: object, options?: {replace?: boolean}) => void]}
 */
export function useHashRoute(enabled) {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    if (!enabled) return undefined;
    const sync = () => setRoute(readRoute());
    // İlk açılışta adresi düzgün biçime çek; geçmişe kayıt eklemeden.
    const canonical = formatRoute(readRoute());
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${canonical}`);
    }
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [enabled]);

  const navigate = useCallback((next, { replace = false } = {}) => {
    const hash = formatRoute(next);
    if (!enabled) return;
    if (window.location.hash === hash) {
      setRoute(parseHash(hash));
      return;
    }
    if (replace) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
      setRoute(parseHash(hash));
      return;
    }
    window.location.hash = hash;
  }, [enabled]);

  return [route, navigate];
}
