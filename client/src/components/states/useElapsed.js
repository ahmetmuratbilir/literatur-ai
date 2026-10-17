import { useEffect, useState } from 'react';

/** Başlangıçtan bu yana geçen ms (250 ms adımla); `startedAt` yoksa 0. WO-021. */
export function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? Math.max(0, now - startedAt) : 0;
}
