import { useMemo } from 'react';
import { ArrowRight, BookmarkCheck, FileText, History, PlusCircle, Sparkles, Trash2, UserRound } from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import { countWords } from '../components/workspace/outline.js';

// Workspace.jsx'teki kayıt anahtarı. Belge yalnız bu cihazda (bulut yok).
const STORAGE_KEY = 'literatur-ai:workspace:v2';

/** Kayıtlı taslağın özeti; depolama kapalıysa ya da boşsa null. */
function readDraft() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const text = saved?.html ? new DOMParser().parseFromString(saved.html, 'text/html').body.textContent || '' : '';
    return {
      title: saved?.title || '',
      words: countWords(text),
      savedAt: saved?.savedAt || null,
      section: saved?.lastSection?.text || '',
    };
  } catch {
    return null;
  }
}

/**
 * Alanım (WO-010): taslak, son aramalar, kayıtlı analizler, sepet özeti.
 * Eski kenar çubuğunun Geçmiş ve Analizler sekmelerinin yeni yeri.
 */
export default function Home({
  active, library, basket, onOpenDraft, onSelectHistory, onDeleteHistory, onNewSearch, onOpenBasket,
}) {
  const { t, lang } = useI18n();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  // Modül her görünür olduğunda taslak yeniden okunur: Yazım'da değişmiş olabilir.
  const draft = useMemo(() => (active ? readDraft() : null), [active]);
  const savedText = draft?.savedAt
    ? new Date(draft.savedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="la-page la-page--wide">
      <div className="la-page-head">
        <div>
          <h1>{t('appShell.home.title')}</h1>
          <p>{t('appShell.home.lead')}</p>
        </div>
        <button type="button" className="la-btn la-btn--primary" onClick={onNewSearch} data-action="home-new-search">
          <PlusCircle size={15} /> {t('sidebar.newSearch')}
        </button>
      </div>

      <div className="la-home">
        <section className="la-card la-card--wide" aria-label={t('appShell.home.draft')}>
          <div className="la-draft">
            <span className="la-draft__icon"><FileText size={20} /></span>
            <div className="la-draft__text">
              <strong>{draft?.title || t('workspace.untitled')}</strong>
              <small>
                {draft && draft.words > 0
                  ? t('appShell.home.draftMeta', { n: draft.words.toLocaleString(locale), when: savedText || '—' })
                  : t('appShell.home.draftEmpty')}
              </small>
              {draft?.section && <small>{t('appShell.home.lastSection', { name: draft.section })}</small>}
            </div>
            <button type="button" className="la-btn la-btn--primary" onClick={onOpenDraft} data-action="home-open-draft">
              {draft && draft.words > 0 ? t('appShell.home.continue') : t('appShell.home.start')} <ArrowRight size={15} />
            </button>
          </div>
          <p className="la-note" style={{ padding: '0 16px 14px' }}>{t('workspace.saveLocalHint')}</p>
        </section>

        <section className="la-card" aria-label={t('sidebar.history')}>
          <div className="la-card__head">
            <h2><History size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t('sidebar.recent')}</h2>
            <small>{library.history.length || ''}</small>
          </div>
          {library.history.length === 0 ? (
            <p className="la-empty">{library.failed ? t('appShell.home.offline') : t('sidebar.historyEmpty')}</p>
          ) : (
            <ul className="la-list">
              {library.history.slice(0, 12).map((item) => {
                const topic = item.mainTopic || item.aiQuery
                  || (Array.isArray(item.keywords) && item.keywords.length ? item.keywords.join(', ') : '');
                // Yazar araması kişinin adıyla görünür; konu varsa yanına eklenir.
                const label = item.authorId
                  ? [item.authorName, topic].filter(Boolean).join(' · ') || t('sidebar.untitledSearch')
                  : topic || t('sidebar.untitledSearch');
                return (
                  <li key={item._id}>
                    {item.authorId ? <UserRound size={15} color="var(--la-muted)" /> : <History size={15} color="var(--la-muted)" />}
                    <div className="la-list__main">
                      <button type="button" onClick={() => onSelectHistory(item)} data-action="home-history-open" title={label}>
                        {label}
                      </button>
                      {item.createdAt && <small>{new Date(item.createdAt).toLocaleDateString(locale)}</small>}
                    </div>
                    <button
                      type="button"
                      className="la-icon-btn la-icon-btn--danger"
                      onClick={() => onDeleteHistory(item._id)}
                      aria-label={t('sidebar.deleteEntry')}
                      title={t('sidebar.deleteEntry')}
                      data-action="home-history-delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className="la-card" aria-label={t('basket.title')}>
            <div className="la-card__head">
              <h2><BookmarkCheck size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t('basket.title')}</h2>
              <small>{basket.papers.length}/{basket.limit}</small>
            </div>
            <div className="la-card__body">
              <p className="la-note">{basket.papers.length ? t('appShell.home.basketLead', { n: basket.papers.length }) : t('basket.empty')}</p>
            </div>
            <div className="la-actions">
              <button type="button" className="la-btn" onClick={onOpenBasket} data-action="home-open-basket">
                {t('appShell.home.openBasket')} <ArrowRight size={14} />
              </button>
            </div>
          </section>

          <section className="la-card" aria-label={t('sidebar.analyses')}>
            <div className="la-card__head">
              <h2><Sparkles size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t('sidebar.aiAnalyses')}</h2>
              <small>{library.analyses.length || ''}</small>
            </div>
            {library.analyses.length === 0 ? (
              <p className="la-empty">{t('sidebar.analysesEmpty')}</p>
            ) : (
              <ul className="la-list">
                {library.analyses.slice(0, 8).map((a) => (
                  <li key={a._id}>
                    <div className="la-list__main">
                      <strong title={a.topic}>{a.topic}</strong>
                      {a.explanation && <small title={a.explanation}>{a.explanation}</small>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
