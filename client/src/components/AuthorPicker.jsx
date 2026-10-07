import { useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, UserRound, X } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

/**
 * Yazar seçici: ad yazılır, OpenAlex yazar dizininden adaylar listelenir,
 * kullanıcı doğru kişiyi kurum / ORCID / yayın sayısıyla seçer.
 *
 * Seçim şart, çünkü "Mehmet Yılmaz" gibi bir ad farklı üniversitelerden onlarca
 * kişiye denk geliyor; arama sonra seçilen kişinin kimliğiyle yapılır.
 * Liste klavyeyle de gezilir (yukarı/aşağı, Enter, Esc).
 */
const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;

export default function AuthorPicker({ apiUrl, getToken, value, onChange, disabled = false }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  // Son tamamlanan yanıt, hangi sorgu için geldiğiyle birlikte. Liste ve
  // "yükleniyor" durumu bundan türetiliyor: efekt içinde ayrıca durum
  // sıfırlamak her yazışta fazladan render demekti.
  const [result, setResult] = useState({ q: '', authors: [], error: false });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // getToken her render'da yeni kimlik alabiliyor; efektin bağımlılığı olsaydı
  // her render'da yeniden istek atılırdı.
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const listId = useId();
  const inputId = useId();
  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');

  const q = query.trim();
  const wantsLookup = !value && q.length >= MIN_CHARS;

  // Yazdıkça ara. Temizleme fonksiyonu eski isteğin geç gelen yanıtının
  // yenisini ezmesini engelliyor.
  useEffect(() => {
    if (!wantsLookup) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const token = await getTokenRef.current();
        const { data } = await axios.get(`${apiUrl}/api/authors`, {
          params: { q },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setResult({ q, authors: Array.isArray(data?.authors) ? data.authors : [], error: false });
      } catch {
        if (!cancelled) setResult({ q, authors: [], error: true });
      }
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q, wantsLookup, apiUrl]);

  const settled = wantsLookup && result.q === q;
  const candidates = settled ? result.authors : [];
  const status = !wantsLookup ? 'idle' : !settled ? 'loading' : result.error ? 'error' : 'done';

  const pick = (author) => {
    onChange(author);
    setQuery('');
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (!open || candidates.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % candidates.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? candidates.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(candidates[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  // Seçilmiş yazar: kimlik kartı gibi, ✕ ile kaldırılır.
  if (value) {
    return (
      <div className="ui-author-picked">
        <span className="ui-author-avatar" aria-hidden="true"><UserRound size={18} /></span>
        <div className="ui-author-picked__body">
          <strong>{value.name}</strong>
          <span>
            {[value.institution, value.worksCount != null ? t('search.authorWorks', { n: fmt(value.worksCount) }) : null]
              .filter(Boolean).join(' · ')}
          </span>
        </div>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" onClick={() => onChange(null)}
          aria-label={t('search.authorClear')} title={t('search.authorClear')} disabled={disabled}>
          <X size={16} />
        </button>
      </div>
    );
  }

  const showList = open && (status === 'done' || status === 'error');

  return (
    <div className="ui-author-picker">
      <label htmlFor={inputId} className="ui-field-label">{t('search.authorNameLabel')}</label>
      <div className="ui-author-input">
        <UserRound size={18} className="ui-author-input__icon" aria-hidden="true" />
        <input
          id={inputId}
          type="text"
          className="input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={onKeyDown}
          onFocus={() => candidates.length > 0 && setOpen(true)}
          placeholder={t('search.authorPlaceholder')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          disabled={disabled}
        />
        {status === 'loading' && <Loader2 size={16} className="animate-spin ui-author-input__spin" aria-label={t('search.authorSearching')} />}
      </div>
      <p className="ui-author-hint">{t('search.authorHint')}</p>

      {showList && (
        <div className="ui-author-list" id={listId} role="listbox" aria-label={t('search.authorPick')}>
          {status === 'error' && <p className="ui-author-empty">{t('search.authorLookupFailed')}</p>}
          {status === 'done' && candidates.length === 0 && <p className="ui-author-empty">{t('search.authorNoMatch')}</p>}
          {candidates.map((a, i) => (
            <button
              key={a.id}
              id={`${listId}-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`ui-author-option${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(a)}
            >
              <span className="ui-author-option__name">{a.name}</span>
              <span className="ui-author-option__inst">{[a.institution, a.country].filter(Boolean).join(', ') || '—'}</span>
              <span className="ui-author-option__stats">
                {t('search.authorWorks', { n: fmt(a.worksCount) })} · {t('search.authorCites', { n: fmt(a.citedByCount) })}
                {a.hIndex != null && <> · h {a.hIndex}</>}
                {a.orcid && <span className="ui-author-orcid">ORCID</span>}
              </span>
              {a.topics?.length > 0 && <span className="ui-author-option__topics">{a.topics.join(' · ')}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
