import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { AlertCircle, ChevronDown, Loader2, Search } from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import AuthorPicker from './AuthorPicker.jsx';
import { mergeAuthorPage, applyRetractions } from '../utils/authorResults.js';

/**
 * Yazar paneli (CLAUDE.md WO-002, 2.11): literatür aramasından ayrı bir giriş
 * noktası. Kendi seçili yazarını, eser listesini ve sayfalamasını tutar; konu
 * aramasının sonuçlarına dokunmaz, onlara da bağlı değildir.
 *
 * Panel sekme değişince silinmez, yalnız gizlenir: geri dönen kullanıcı kendi
 * listesini bulur. Eser kartı, sepet ve okuyucu App'teki ortak `renderPaper`
 * ile çizilir; panel bunları yeniden yazmaz.
 */
const PAGE_SIZE = 25;

export default function AuthorPanel({ apiUrl, getToken, request, renderPaper, checkRetractions, hidden = false }) {
  const { t, lang } = useI18n();
  const [author, setAuthor] = useState(null);
  const [topic, setTopic] = useState('');
  const [data, setData] = useState(null);
  const [lastParams, setLastParams] = useState(null);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orcidOrgs, setOrcidOrgs] = useState({ orcid: null, list: [] });
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');

  const runSearch = async (who, about) => {
    if (!who?.id) { setError(t('search.authorNeedPick')); return; }
    const params = { mainTopic: about.trim(), authorName: who.name || '', authorId: who.id, count: PAGE_SIZE };
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const token = await getTokenRef.current();
      const res = await axios.get(`${apiUrl}/api/search`, { params, headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
      setLastParams(params);
      setShown(PAGE_SIZE);
    } catch (err) {
      setError(err.response?.data?.error || t('search.failed'));
      setLoading(false);
      return;
    }
    // Geçmiş kaydı aramayı etkilemez; veritabanı kapalıysa sessizce atlanır.
    try {
      const token = await getTokenRef.current();
      await axios.post(`${apiUrl}/api/history`, {
        mainTopic: params.mainTopic, authorName: params.authorName, authorId: params.authorId, keywords: [], aiQuery: '',
      }, { headers: { Authorization: `Bearer ${token}` } });
      window.dispatchEvent(new CustomEvent('refreshHistory'));
    } catch (historyErr) {
      console.warn('Yazar araması geçmişe kaydedilemedi:', historyErr?.message);
    } finally {
      setLoading(false);
    }
  };

  // Geçmişten açılan yazar araması: App panele isteği iletir, panel kendisi arar.
  useEffect(() => {
    if (!request?.author) return;
    setAuthor(request.author);
    setTopic(request.topic || '');
    runSearch(request.author, request.topic || '');
    // Yalnızca yeni istekte çalışır; runSearch her render'da yeni kimlik alıyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.at]);

  // Seçili yazarın ORCID kurumları (zenginleştirme, 3.10): gelmezse kart olduğu gibi kalır.
  const orcid = author?.orcid || null;
  useEffect(() => {
    if (!orcid) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const { data: res } = await axios.get(`${apiUrl}/api/authors/orcid`, { params: { ids: orcid }, headers: { Authorization: `Bearer ${token}` } });
        if (!cancelled) setOrcidOrgs({ orcid, list: res?.affiliations?.[orcid] || [] });
      } catch {
        // Rozetsiz kart hata değil.
      }
    })();
    return () => { cancelled = true; };
  }, [orcid, apiUrl]);
  const orgs = orcidOrgs.orcid === orcid ? orcidOrgs.list : [];

  const hasMorePages = Boolean(data?.author?.hasMore && lastParams);
  const showMore = async () => {
    if (!data?.results) return;
    if (shown >= data.results.length && hasMorePages) {
      setMoreLoading(true);
      try {
        const token = await getTokenRef.current();
        const res = await axios.get(`${apiUrl}/api/search`, {
          params: { ...lastParams, authorPage: (data.author.page || 1) + 1 },
          headers: { Authorization: `Bearer ${token}` },
        });
        const merged = mergeAuthorPage(data, res.data);
        setData(merged);
        setShown(Math.min(shown + PAGE_SIZE, merged.results.length));
      } catch (err) {
        setError(err.response?.data?.error || t('search.failed'));
      } finally {
        setMoreLoading(false);
      }
      return;
    }
    const next = Math.min(shown + PAGE_SIZE, data.results.length);
    const page = data.results.slice(shown, next);
    setShown(next);
    // Arama yalnız ilk 25'i geri çekmeye karşı kontrol ediyor; açılan sayfa şimdi.
    const dois = page.filter((r) => r.doi && !r.retraction).map((r) => r.doi);
    if (dois.length === 0) return;
    setMoreLoading(true);
    try {
      const found = await checkRetractions(dois);
      if (found) setData((d) => (d ? applyRetractions(d, found) : d));
    } finally {
      setMoreLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    runSearch(author, topic);
  };

  const meta = data?.author;
  return (
    <div hidden={hidden}>
      <section className="ui-panel query-panel" style={{ marginBottom: 'var(--space-6)' }}>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <AuthorPicker apiUrl={apiUrl} getToken={getToken} value={author} onChange={setAuthor} disabled={loading} />
          {author && orgs.length > 0 && (
            <p className="ui-author-note">{t('search.authorAlsoAt', { list: orgs.join(' · ') })}</p>
          )}

          <div>
            <label htmlFor="author-panel-topic" className="ui-field-label">{t('search.authorTopicLabel')}</label>
            <div className="input-wrapper" style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} size={18} />
              <input
                id="author-panel-topic"
                type="text"
                className="input"
                style={{ height: '52px', paddingLeft: '46px', fontSize: 'var(--fs-md)', borderRadius: 'var(--radius-md)', width: '100%' }}
                placeholder={t('search.authorTopicPlaceholder')}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                autoComplete="off"
              />
            </div>
            <p className="ui-author-note" style={{ marginTop: 'var(--space-2)' }}>{t('search.authorNote')}</p>
          </div>

          <button type="submit" disabled={loading || !author} className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            {loading ? t('search.submitting') : t('search.submit')}
          </button>
        </form>
      </section>

      {loading && (
        <div className="ui-panel" role="status" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'var(--brand-primary)' }} />
          <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--text-muted)' }}>{t('loading.title')}</p>
        </div>
      )}

      {data && !loading && (
        <div>
          <div className="ui-toolbar">
            <div className="ui-toolbar__meta" aria-live="polite">
              <strong>{t('results.shown', { n: Math.min(shown, data.results.length), total: data.results.length })}</strong>
              {meta && (
                <> · {t(meta.hasMore ? 'results.authorLoaded' : (meta.capped ? 'results.authorCapped' : 'results.authorAll'), {
                  n: fmt(data.results.length),
                  total: fmt(meta.total),
                })}{meta.partial && <> · {t('results.authorPartial')}</>}</>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' }}>
            {data.results.slice(0, shown).map((item, idx) => renderPaper(item, idx, data))}
          </div>

          {(shown < data.results.length || hasMorePages) && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
              <button type="button" className="ui-btn ui-btn--outline" onClick={showMore} disabled={moreLoading}>
                {moreLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                {shown < data.results.length
                  ? t('results.showMore', { n: Math.min(PAGE_SIZE, data.results.length - shown), left: data.results.length - shown })
                  : t('results.authorLoadMore', { n: Math.min(meta.pageSize, Math.max(0, Math.min(meta.total, meta.max) - meta.page * meta.pageSize)) })}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="ui-notice ui-notice--error" style={{ marginTop: 'var(--space-6)' }}>
          <AlertCircle size={18} />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px' }}>{t('search.failedTitle')}</strong>
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
