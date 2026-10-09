import { useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, UserRound, X } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

/**
 * Yazar seçici: ad (ya da ORCID iD) yazılır, OpenAlex yazar dizininden adaylar
 * listelenir, kullanıcı doğru kişiyi kurum / ORCID / yayın sayısıyla seçer.
 *
 * Seçim şart, çünkü "Mehmet Yılmaz" gibi bir ad farklı üniversitelerden onlarca
 * kişiye denk geliyor; arama sonra seçilen kişinin kimliğiyle yapılır.
 * İsteğe bağlı kurum: o kurumda hiç bulunmuş kişiler gösterilir; diğerleri
 * silinmez, sayısıyla gizlenir ve tek tıkla açılır.
 *
 * Listeyi yalnızca OpenAlex üretir. ORCID kurum geçmişi liste geldikten sonra
 * ayrı istekle eklenir; gelmezse kart olduğu gibi kalır (CLAUDE.md 3.10).
 * Liste klavyeyle de gezilir (yukarı/aşağı, Enter, Esc).
 */
const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;

const sameOrg = (a, b) => String(a || '').toLocaleLowerCase('tr') === String(b || '').toLocaleLowerCase('tr');

export default function AuthorPicker({ apiUrl, getToken, value, onChange, disabled = false }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [institution, setInstitution] = useState('');
  // Son tamamlanan yanıt, hangi sorgu için geldiğiyle birlikte. Liste ve
  // "yükleniyor" durumu bundan türetiliyor: efekt içinde ayrıca durum
  // sıfırlamak her yazışta fazladan render demekti.
  const [result, setResult] = useState({ key: '', authors: [], error: false, institution: null });
  // ORCID kurum geçmişi, hangi listeye ait olduğuyla birlikte.
  const [enrichment, setEnrichment] = useState({ key: '', affiliations: {} });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Gizlenen (kurumla eşleşmeyen) kişileri açtığı listenin anahtarı.
  const [revealedKey, setRevealedKey] = useState(null);
  // getToken her render'da yeni kimlik alabiliyor; efektin bağımlılığı olsaydı
  // her render'da yeniden istek atılırdı.
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const listId = useId();
  const inputId = useId();
  const instId = useId();
  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');

  const q = query.trim();
  const inst = institution.trim();
  const key = `${q}\u0000${inst}`;
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
          params: inst ? { q, inst } : { q },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          setResult({
            key,
            authors: Array.isArray(data?.authors) ? data.authors : [],
            error: false,
            institution: data?.institution || null,
          });
        }
      } catch {
        if (!cancelled) setResult({ key, authors: [], error: true, institution: null });
      }
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, q, inst, wantsLookup, apiUrl]);

  // Liste geldikten sonra ORCID'i bilinen kişilerin kurum geçmişi. Hata
  // kullanıcıya gösterilmez: zenginleştirme yoksa kart yine eksiksizdir.
  const orcidIds = result.authors.map((a) => a.orcid).filter(Boolean).join(',');
  useEffect(() => {
    if (!orcidIds) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const { data } = await axios.get(`${apiUrl}/api/authors/orcid`, {
          params: { ids: orcidIds },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setEnrichment({ key: result.key, affiliations: data?.affiliations || {} });
      } catch {
        // Rozetsiz kart hata değil.
      }
    })();
    return () => { cancelled = true; };
  }, [orcidIds, result.key, apiUrl]);

  const settled = wantsLookup && result.key === key;
  const allCandidates = settled ? result.authors : [];
  // Kurumla eşleşen varsa yalnız onlar görünür; diğerleri sayısıyla gizlenir
  // ve tek tıkla açılır (CLAUDE.md 3.10). Eşleşen yoksa herkes görünür.
  const matchedOnly = allCandidates.filter((a) => a.institutionMatch);
  const hiding = matchedOnly.length > 0 && revealedKey !== result.key;
  const candidates = hiding ? matchedOnly : allCandidates;
  const hiddenCount = allCandidates.length - candidates.length;
  const status = !wantsLookup ? 'idle' : !settled ? 'loading' : result.error ? 'error' : 'done';
  const affiliationsOf = (a) => (enrichment.key === result.key && a.orcid ? enrichment.affiliations[a.orcid] || [] : []);

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
            {value.orcid && (
              <>
                {' · '}
                <a className="ui-author-orcid" href={`https://orcid.org/${value.orcid}`} target="_blank" rel="noopener noreferrer"
                  title={t('search.authorOrcidLink')}>
                  ORCID
                </a>
              </>
            )}
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
  const institutionNote = institutionNoteFor(result.institution, inst, t);

  return (
    <div className="ui-author-picker">
      <div className="ui-author-row">
        <div className="ui-author-name">
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

          {showList && (
            <div className="ui-author-list" id={listId} role="listbox" aria-label={t('search.authorPick')}>
              {status === 'error' && <p className="ui-author-empty">{t('search.authorLookupFailed')}</p>}
              {status === 'done' && institutionNote && <p className="ui-author-note-inline" role="status">{institutionNote}</p>}
              {status === 'done' && candidates.length === 0 && <p className="ui-author-empty">{t('search.authorNoMatch')}</p>}
              {candidates.map((a, i) => {
                const others = affiliationsOf(a).filter((o) => !sameOrg(o, a.institution)).slice(0, 2);
                return (
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
                    {others.length > 0 && (
                      <span className="ui-author-option__topics">{t('search.authorAlsoAt', { list: others.join(' · ') })}</span>
                    )}
                    <span className="ui-author-option__stats">
                      {t('search.authorWorks', { n: fmt(a.worksCount) })} · {t('search.authorCites', { n: fmt(a.citedByCount) })}
                      {a.hIndex != null && <> · h {a.hIndex}</>}
                      {a.orcid && <span className="ui-author-orcid">ORCID</span>}
                      {a.institutionMatch && <span className="ui-author-inst-match">{t('search.authorInstMatch')}</span>}
                    </span>
                    {a.topics?.length > 0 && <span className="ui-author-option__topics">{a.topics.join(' · ')}</span>}
                  </button>
                );
              })}
              {status === 'done' && hiddenCount > 0 && (
                <button type="button" className="ui-author-reveal" onClick={() => { setRevealedKey(result.key); setActive(-1); }}>
                  {t('search.authorShowHidden', { n: hiddenCount })}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="ui-author-inst">
          <label htmlFor={instId} className="ui-field-label">{t('search.authorInstLabel')}</label>
          <input
            id={instId}
            type="text"
            className="input"
            value={institution}
            onChange={(e) => { setInstitution(e.target.value); setOpen(true); setActive(-1); }}
            placeholder={t('search.authorInstPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
          />
        </div>
      </div>
      <p className="ui-author-hint">{t('search.authorHint')}</p>
    </div>
  );
}

/**
 * Kurum girildiyse listenin üstündeki durum notu (CLAUDE.md 2.8, 3.10): kurum
 * bulunamadıysa ya da kurum araması düştüyse liste yalnız isimle gelir ve bu
 * söylenir; eşleşen kimse yoksa da söylenir. Eşleşme varsa not gerekmez,
 * kartlardaki işaret yeterli.
 */
function institutionNoteFor(info, inst, t) {
  if (!info || !inst) return null;
  if (info.nameSearchFailed) return t('search.authorNameSearchFailed');
  if (info.status === 'not_found') return t('search.authorInstNotFound', { inst });
  if (info.status === 'error') return t('search.authorInstFailed');
  if (info.matched === 0) return t('search.authorInstNoMatch', { inst });
  return null;
}
