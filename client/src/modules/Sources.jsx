import { useEffect, useRef, useState } from 'react';
import { BookmarkCheck, Download, ExternalLink, PenLine, Search, Star, Trash2, Upload, UserRound } from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import { toBibTeX, toRIS, downloadText } from '../utils/citationExport.js';
import { SOURCE_TABS } from '../shell/routes.js';

const TAB_ICONS = { search: Search, author: UserRound, basket: BookmarkCheck, favorites: Star };
const CONFIRM_MS = 3000;

/**
 * Kaynaklar (WO-010 K2): Literatür ara · Araştırmacı · Sepetim · Favoriler.
 *
 * Arama ve Araştırmacı paneli `App.jsx`'te kurulup buraya düğüm olarak
 * geliyor: durumları orada, değişmeden. Burada yalnız sekme ve görünürlük
 * var; gizlenen panel silinmez, kendi listesini korur.
 */
export default function Sources({
  tab, navigate, searchView, authorView, basket, favorites, onRemoveFavorite, onWrite, onImport, authorEnabled = true,
}) {
  const { t } = useI18n();
  const tabs = SOURCE_TABS.filter((x) => x !== 'author' || authorEnabled);

  return (
    <div className="la-page">
      <div className="la-subtabs" role="tablist" aria-label={t('appShell.module.sources')}>
        {tabs.map((id) => {
          const Icon = TAB_ICONS[id];
          const count = id === 'basket' ? `${basket.papers.length}/${basket.limit}` : id === 'favorites' && favorites.length ? favorites.length : null;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-action={`sources-${id}`}
              onClick={() => navigate({ module: 'sources', tab: id })}
            >
              <Icon size={15} /> {t(`appShell.sources.${id}`)}
              {count !== null && <em>{count}</em>}
            </button>
          );
        })}
      </div>

      <div hidden={tab !== 'search'}>{searchView}</div>
      {authorEnabled && <div hidden={tab !== 'author'}>{authorView}</div>}
      {tab === 'basket' && <BasketView basket={basket} onWrite={onWrite} onImport={onImport} />}
      {tab === 'favorites' && <FavoritesView favorites={favorites} onRemove={onRemoveFavorite} />}
    </div>
  );
}

function BasketView({ basket, onWrite, onImport }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const papers = basket.papers;
  const stamp = new Date().toISOString().slice(0, 10);
  const exportAs = (format) => {
    if (!papers.length) return;
    if (format === 'bib') downloadText(`literatur-ai_kaynakca_${stamp}.bib`, toBibTeX(papers), 'application/x-bibtex');
    else downloadText(`literatur-ai_kaynakca_${stamp}.ris`, toRIS(papers), 'application/x-research-info-systems');
  };

  // 30 kaynağı tek yanlış tıklamayla kaybetmemek için iki adım (WriterDock'taki kural).
  const clear = () => {
    clearTimeout(timer.current);
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), CONFIRM_MS);
      return;
    }
    setConfirming(false);
    basket.clear();
  };

  return (
    <section className="la-card" aria-label={t('basket.title')}>
      <div className="la-card__head">
        <h2>{t('basket.title')}</h2>
        <small>{papers.length}/{basket.limit}</small>
      </div>
      <div className="la-card__body"><p className="la-note">{t('basket.hint')}</p></div>
      {papers.length === 0 ? (
        <p className="la-empty">{t('basket.empty')}</p>
      ) : (
        <ol className="la-list">
          {papers.map((p, i) => {
            const href = p.url || (p.doi ? `https://doi.org/${p.doi}` : null);
            return (
              <li key={p._id || `${p.doi || p.title}-${i}`}>
                <span className="la-list__num">{i + 1}</span>
                <div className="la-list__main">
                  {href
                    ? <a href={href} target="_blank" rel="noopener noreferrer" title={p.title}>{p.title || t('sidebar.untitled')} <ExternalLink size={11} /></a>
                    : <strong title={p.title}>{p.title || t('sidebar.untitled')}</strong>}
                  <small>{[String(p.authors || p.creator || '').split(',')[0], p.year, p.publicationName].filter(Boolean).join(' · ')}</small>
                </div>
                <button
                  type="button"
                  className="la-icon-btn la-icon-btn--danger"
                  onClick={() => basket.remove(p)}
                  aria-label={t('basket.remove')}
                  title={t('basket.remove')}
                  data-action="basket-remove"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="la-actions">
        <button type="button" className="la-btn la-btn--primary" onClick={onWrite} disabled={!papers.length} data-action="basket-write">
          <PenLine size={14} /> {t('basket.write')}
        </button>
        <button type="button" className="la-btn" onClick={onImport} data-action="basket-import">
          <Upload size={14} /> {t('workspace.imp.open')}
        </button>
        <button type="button" className="la-btn" onClick={() => exportAs('bib')} disabled={!papers.length} title={t('basket.exportHint')} data-action="basket-bibtex">
          <Download size={14} /> BibTeX
        </button>
        <button type="button" className="la-btn" onClick={() => exportAs('ris')} disabled={!papers.length} title={t('basket.exportHint')} data-action="basket-ris">
          <Download size={14} /> RIS
        </button>
        {papers.length > 0 && (
          <button type="button" className="la-btn la-btn--danger" onClick={clear} data-action="basket-clear" style={{ marginLeft: 'auto' }}>
            <Trash2 size={14} /> {confirming ? t('appShell.basket.confirmClear') : t('basket.clear')}
          </button>
        )}
      </div>
      {basket.offline && <p className="la-note la-warn" style={{ padding: '0 16px 12px' }}>{t('basket.offline')}</p>}
    </section>
  );
}

function FavoritesView({ favorites, onRemove }) {
  const { t } = useI18n();
  return (
    <section className="la-card" aria-label={t('sidebar.favorites')}>
      <div className="la-card__head">
        <h2>{t('sidebar.favorites')}</h2>
        <small>{favorites.length || ''}</small>
      </div>
      {favorites.length === 0 ? (
        <p className="la-empty">{t('sidebar.favoritesEmpty')}</p>
      ) : (
        <ul className="la-list">
          {favorites.map((p) => (
            <li key={p._id}>
              <Star size={14} color="var(--la-muted)" />
              <div className="la-list__main">
                {p.url
                  ? <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.title}>{p.title || t('sidebar.untitled')}</a>
                  : <strong title={p.title}>{p.title || t('sidebar.untitled')}</strong>}
                <small>{[String(p.authors || '').split(',')[0], p.year].filter(Boolean).join(' · ')}</small>
              </div>
              <button
                type="button"
                className="la-icon-btn la-icon-btn--danger"
                onClick={() => onRemove(p._id)}
                aria-label={t('sidebar.removeFavorite')}
                title={t('sidebar.removeFavorite')}
                data-action="favorite-remove"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
