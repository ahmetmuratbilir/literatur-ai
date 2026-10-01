import { useCallback, useMemo, useState } from 'react';
import { I18nContext, LANGS, applyLang, readStoredLang, storeLang, translate } from './context.js';

const I18nProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    const initial = readStoredLang();
    // İlk render'dan ÖNCE uygula: ilk API isteği doğru dille gitmeli.
    applyLang(initial);
    return initial;
  });

  const setLang = useCallback((next) => {
    if (!LANGS.includes(next)) return;
    applyLang(next);
    storeLang(next);
    setLangState(next);
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export default I18nProvider;
