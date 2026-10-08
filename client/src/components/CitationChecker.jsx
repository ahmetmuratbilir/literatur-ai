import { useState } from 'react';
import axios from 'axios';
import { AlertTriangle, BookmarkCheck, BookmarkPlus, CheckCircle2, Copy, ExternalLink, HelpCircle, ListChecks, Loader2, Unlock, XCircle } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

const MAX_LINES = 50;

/** "1. ", "[3] ", "• " gibi numara ve madde işaretlerini atar. */
const cleanLine = (line) => line.replace(/^\s*(\[\d+\]|\d+[.)]|[•\-–*])\s+/, '').trim();

/** Çözümlenen kaydı "Makalen için" listesinin beklediği biçime çevirir. */
const toPaper = (m) => ({
  title: m.title,
  creator: (m.authors || []).map((a) => [a.given, a.family].filter(Boolean).join(' ')).join(', '),
  year: m.year,
  publicationName: m.venue,
  doi: m.doi,
  url: m.landing_url,
  description: '',
  source: 'resolver',
});

const STATUS = {
  found: { icon: CheckCircle2, cls: 'cc-pill--ok' },
  candidates: { icon: HelpCircle, cls: 'cc-pill--warn' },
  not_found: { icon: XCircle, cls: 'cc-pill--bad' },
  error: { icon: XCircle, cls: 'cc-pill--bad' },
};

/** Fark kaydını okunur cümleye çevirir. */
function useDiscrepancyText() {
  const { t } = useI18n();
  return (d) => {
    if (d.note === 'missing_coauthors') return t('verify.diff.missingCoauthors', { names: (d.missing || []).join(', ') });
    if (d.note === 'surname_spelling') return t('verify.diff.surname', { input: d.input, canonical: d.canonical });
    if (d.note === 'first_author_differs') return t('verify.diff.firstAuthor', { input: d.input, canonical: d.canonical });
    if (d.note === 'year_differs') return t('verify.diff.year', { input: d.input, canonical: d.canonical });
    if (d.note === 'title_differs') return t('verify.diff.title');
    if (d.note === 'venue_differs') return t('verify.diff.venue', { canonical: d.canonical });
    const field = t(`verify.field.${d.field}`);
    if (d.note === 'missing') return t('verify.diff.missingField', { field, canonical: d.canonical });
    return t('verify.diff.differs', { field, input: d.input, canonical: d.canonical });
  };
}

const CopyButton = ({ text }) => {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ui-btn ui-btn--ghost ui-btn--sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* izin yok */ }
      }}
    >
      {done ? <CheckCircle2 size={13} /> : <Copy size={13} />} {done ? t('verify.copied') : t('verify.copy')}
    </button>
  );
};

/** Tek satırın sonucu. */
const ResultRow = ({ row, index, basket, onAdd, apiUrl, getToken }) => {
  const { t } = useI18n();
  const diffText = useDiscrepancyText();
  const [picked, setPicked] = useState(null);

  // Adaylar arama sonucudur (çoğu OpenAlex), künyeleri düzeltilmemiştir:
  // seçilen adayın DOI'si yeniden çözülür ve Crossref künyesi kullanılır.
  const pick = async (c) => {
    setPicked(c);
    if (!c.doi) return;
    try {
      const token = await getToken();
      const res = await axios.post(`${apiUrl}/api/resolve`, { input: c.doi }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.status === 'found' && res.data.match) setPicked(res.data.match);
    } catch { /* aday olduğu gibi kalır */ }
  };
  const match = row.match || picked;
  const status = picked ? 'found' : row.status;
  const S = STATUS[status] || STATUS.error;
  const Icon = S.icon;
  const kept = match && basket.has({ doi: match.doi, title: match.title });
  const doiElsewhere = row.discrepancies?.find((d) => d.note === 'doi_points_elsewhere');

  return (
    <li className="cc-row">
      <div className="cc-row__head">
        <span className="cc-row__num">{index + 1}</span>
        <span className={`cc-pill ${S.cls}`}><Icon size={13} /> {t(`verify.status.${status}`)}</span>
        {match?.retracted && <span className="cc-pill cc-pill--bad"><AlertTriangle size={13} /> {t('verify.retracted')}</span>}
        {match?.oa_pdf_url && (
          <a className="cc-pill cc-pill--oa" href={match.oa_pdf_url} target="_blank" rel="noopener noreferrer"><Unlock size={13} /> {t('verify.openAccess')}</a>
        )}
      </div>
      <p className="cc-row__input">{row.input}</p>

      {match && (
        <>
          <p className="cc-row__apa">{match.apa7 || match.title}</p>
          {!picked && row.discrepancies?.length > 0 && (
            <ul className="cc-diffs">
              {row.discrepancies.map((d, i) => <li key={i}>{diffText(d)}</li>)}
            </ul>
          )}
          <div className="cc-row__actions">
            {match.apa7 && <CopyButton text={match.apa7} />}
            <button type="button" className={`ui-btn ui-btn--sm ${kept ? 'ui-btn--primary' : 'ui-btn--outline'}`} onClick={(e) => onAdd(toPaper(match), e.currentTarget)}>
              {kept ? <BookmarkCheck size={13} /> : <BookmarkPlus size={13} />} {kept ? t('card.added') : t('card.add')}
            </button>
            {match.landing_url && (
              <a className="ui-btn ui-btn--ghost ui-btn--sm" href={match.landing_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {t('verify.open')}</a>
            )}
          </div>
        </>
      )}

      {!match && row.status === 'candidates' && (
        <div className="cc-cands">
          {doiElsewhere && <p className="cc-row__note">{t('verify.diff.doiElsewhere', { doi: doiElsewhere.input, title: doiElsewhere.canonical })}</p>}
          <span>{t('verify.whichOne')}</span>
          {row.candidates.slice(0, 3).map((c) => (
            <button key={c.doi || c.title} type="button" className="cc-cand" onClick={() => pick(c)}>
              <strong>{c.title}</strong>
              <span>{[c.authors?.[0]?.family, c.year, c.venue].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}

      {row.status === 'not_found' && <p className="cc-row__note">{t('verify.notFoundHint')}</p>}
    </li>
  );
};

/**
 * "Kaynakçanı doğrula": kullanıcı kaynakçasını yapıştırır; her satır gerçek
 * makaleyle eşleştirilir, farklar (soyad yazımı, eksik ortak yazar, cilt/sayı)
 * gösterilir. Eşleşme bulunamazsa uydurulmaz: "bulunamadı" dürüst sonuçtur.
 */
const CitationChecker = ({ apiUrl, getToken, basket, onAdd }) => {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const tooMany = lines.length > MAX_LINES;

  const run = async () => {
    if (!lines.length || tooMany) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await axios.post(`${apiUrl}/api/resolve/batch`, { lines }, { headers: { Authorization: `Bearer ${token}` } });
      setRows(res.data.results || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      setError(err.response?.data?.error || t('verify.failed'));
    } finally {
      setLoading(false);
    }
  };

  const fixedBibliography = (rows || []).filter((r) => r.match?.apa7).map((r) => r.match.apa7).join('\n\n');

  return (
    <section className="ui-panel" style={{ marginBottom: 'var(--space-6)' }}>
      <div className="cc-head">
        <ListChecks size={20} aria-hidden="true" />
        <div>
          <h2>{t('verify.title')}</h2>
          <p>{t('verify.lead')}</p>
        </div>
      </div>

      <label htmlFor="cc-input" className="ui-field-label">{t('verify.inputLabel')}</label>
      <textarea
        id="cc-input"
        className="cc-input"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('verify.placeholder')}
        spellCheck={false}
      />
      <div className="cc-toolbar">
        <span className={tooMany ? 'cc-count cc-count--bad' : 'cc-count'}>{t('verify.lineCount', { n: lines.length, max: MAX_LINES })}</span>
        <button type="button" className="ui-btn ui-btn--primary" onClick={run} disabled={loading || !lines.length || tooMany}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <ListChecks size={15} />}
          {loading ? t('verify.running', { n: lines.length }) : t('verify.run')}
        </button>
      </div>

      {error && <div role="alert" className="ui-notice ui-notice--error" style={{ marginTop: 'var(--space-4)' }}><AlertTriangle size={16} /><div>{error}</div></div>}

      {rows && (
        <div className="cc-results">
          {summary && (
            <div className="cc-summary" aria-live="polite">
              <span className="cc-pill cc-pill--ok">{t('verify.sum.found', { n: summary.found || 0 })}</span>
              <span className="cc-pill cc-pill--warn">{t('verify.sum.candidates', { n: summary.candidates || 0 })}</span>
              <span className="cc-pill cc-pill--bad">{t('verify.sum.notFound', { n: (summary.not_found || 0) + (summary.error || 0) })}</span>
              {summary.withDiscrepancies > 0 && <span className="cc-pill cc-pill--warn">{t('verify.sum.diffs', { n: summary.withDiscrepancies })}</span>}
              {fixedBibliography && <span style={{ marginLeft: 'auto' }}><CopyButton text={fixedBibliography} /></span>}
            </div>
          )}
          <ol className="cc-list">
            {rows.map((row, i) => <ResultRow key={`${i}-${row.input}`} row={row} index={i} basket={basket} onAdd={onAdd} apiUrl={apiUrl} getToken={getToken} />)}
          </ol>
        </div>
      )}
    </section>
  );
};

export default CitationChecker;
