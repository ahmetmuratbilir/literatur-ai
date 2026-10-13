import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  AlignCenter, AlignJustify, AlignLeft, Bold, ChevronDown, ChevronRight, FileText,
  Italic, Library, List, ListOrdered, Printer, Quote, Redo2, Underline, Undo2,
} from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import { DEFAULT_SETUP, FONTS, FONT_SIZES, MARGIN_PRESETS, PAGE_SIZES, pageGeometry, pageStyle } from './pageSetup.js';
import { MARK, classifySentence, splitSentences, summarize } from './claimDetection.js';
import { TEMPLATES, templateHtml } from './templates.js';
import { inlineCitation } from './citation.js';

/**
 * Yazar yüzeyi — `docs/design/tasarim-yonu.md` uygulanmış hali.
 *
 * Üç bölge (§3): gezgin · belge · bağlam paneli. Belge 68ch, ekran serifi,
 * 17px/1.65 (§6). Renk kanıt için ayrılmış; arayüz nötr (§7). Web fontu yok
 * (§8). Belgeye hiçbir şey kendiliğinden girmez (CLAUDE.md 2.9).
 *
 * Yönergenin bu sürümde UYGULANMAYAN kısımları, sebepleriyle:
 * - Kanıt paneli (§4): pasaj arama ve P3 doğrulama ucu henüz yok.
 * - Cümle çapaları ve çapa kayması (§6): kararlı çapa TipTap gerektiriyor;
 *   bağımlılık onayı alınmadı. Bugünkü işaretler metinden okunuyor.
 * - 2. ve 3. kademe sınıflandırma (§6): sunucuda yerel model yok.
 * - Mod kaldırma (§3): arama ekranının yeniden yerleştirilmesi gerekiyor.
 * Arayüz bu sınırları kullanıcıya yazar, sessizce geçmez (CLAUDE.md 2.8).
 */
const STORAGE_KEY = 'literatur-ai:workspace:v2';
const SAVE_DELAY = 800;

/** Depolama kapalıysa (gizli sekme, engellenmiş çerez) sessizce boş döner. */
function readSaved() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function Tool({ icon, label, onClick }) {
  return (
    <button type="button" className="wx-tool" onClick={onClick} title={label} aria-label={label}>
      {icon}
    </button>
  );
}

export default function Workspace({ basket, tabs, apiUrl, getToken, hidden = false }) {
  const { t, lang } = useI18n();
  const saved = useMemo(() => readSaved(), []);
  const [setup, setSetup] = useState(() => ({ ...DEFAULT_SETUP, ...(saved?.setup || {}) }));
  const [title, setTitle] = useState(() => saved?.title || '');
  const [started, setStarted] = useState(() => Boolean(saved?.html));
  // §12: üç kayıt durumu. Sunucu kaydı henüz yok, bu yüzden 'cloud' kullanılmıyor.
  const [saveState, setSaveState] = useState({ kind: 'saved', at: null });
  const [outline, setOutline] = useState([]);
  const [counts, setCounts] = useState({ total: 0, cited: 0, uncited: 0, notClaim: 0 });
  const [navTab, setNavTab] = useState('sections');
  const [drafts, setDrafts] = useState({});
  const [activeSource, setActiveSource] = useState(null);
  const pageRef = useRef(null);
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');

  /**
   * Cümleleri işaretler ve bölüm ağacını çıkarır. İşaretler yalnız yerel
   * kuralla konuyor; "kanıtlı" demiyor, "atıf işareti var" diyor.
   */
  const scan = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    const headings = [];
    const all = [];

    for (const block of el.children) {
      if (/^H[1-3]$/.test(block.tagName)) {
        block.removeAttribute('data-mark');
        headings.push({ level: Number(block.tagName[1]), text: block.textContent.trim() });
        continue;
      }
      if (block.tagName !== 'P' && block.tagName !== 'BLOCKQUOTE') continue;
      const marks = splitSentences(block.textContent).map((s) => classifySentence(s.text).mark);
      all.push(...marks.map((mark) => ({ mark })));
      // Blok tek bir işaret taşır: en zayıf durum kazanır (§4 ile aynı mantık).
      const worst = marks.includes(MARK.uncited) ? MARK.uncited
        : marks.includes(MARK.cited) ? MARK.cited : MARK.notClaim;
      if (worst === MARK.notClaim) block.removeAttribute('data-mark');
      else block.setAttribute('data-mark', worst);
    }
    setOutline(headings);
    setCounts(summarize(all));
  }, []);

  // Başlangıç içeriği bir kez yazılır; sonraki render'lar imleci bozmasın.
  useEffect(() => {
    const el = pageRef.current;
    if (!el || !started) return;
    el.innerHTML = saved?.html || '<p><br></p>';
    scan();
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {
      // Desteklenmiyorsa biçim etiketle uygulanır; sorun değil.
    }
  }, [saved, started, scan]);

  const persist = useCallback((extra = {}) => {
    const el = pageRef.current;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        html: el ? el.innerHTML : '', title, setup, ...extra,
      }));
      setSaveState({ kind: 'local', at: new Date() });
    } catch {
      setSaveState({ kind: 'unsaved', at: null });
    }
  }, [setup, title]);

  const onInput = () => {
    setSaveState((s) => (s.kind === 'dirty' ? s : { kind: 'dirty', at: null }));
    scan();
  };

  // Yazdıkça kaydet; her tuşta değil, kısa bir duraklamadan sonra.
  useEffect(() => {
    if (saveState.kind !== 'dirty') return undefined;
    const timer = setTimeout(() => persist(), SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [saveState.kind, persist]);

  const exec = (command, value = null) => {
    pageRef.current?.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      // Komut desteklenmiyorsa biçim uygulanmaz; belge bozulmaz.
    }
    onInput();
  };

  const start = (templateId) => {
    const template = TEMPLATES.find((x) => x.id === templateId) || TEMPLATES[0];
    if (template.setup) setSetup((s) => ({ ...s, ...template.setup }));
    setStarted(true);
    // Belge DOM'u efektte kurulduğu için içerik orada yazılacak.
    window.setTimeout(() => {
      const el = pageRef.current;
      if (!el) return;
      el.innerHTML = templateHtml(template, t);
      scan();
      persist({ html: el.innerHTML });
    }, 0);
  };

  /**
   * Tek pasajdan tek cümle (CLAUDE.md 2.2, 3.1). Modele yalnız özet gider;
   * atıf dizgesi burada, doğrulanmış kayıttan kurulur.
   */
  const makeSentence = async (paper, key) => {
    const passage = (paper.description || '').trim();
    if (!passage) return;
    setDrafts((d) => ({ ...d, [key]: { loading: true } }));
    try {
      const token = await getTokenRef.current();
      const { data } = await axios.post(`${apiUrl}/api/cited-sentence`,
        { passage, topic: title },
        { headers: { Authorization: `Bearer ${token}` } });
      if (data?.refused) {
        setDrafts((d) => ({ ...d, [key]: { error: t('workspace.refused') } }));
        return;
      }
      setDrafts((d) => ({ ...d, [key]: { sentence: data.sentence, citation: inlineCitation(paper, lang), passage } }));
    } catch (err) {
      setDrafts((d) => ({ ...d, [key]: { error: err.response?.data?.error || t('search.failed') } }));
    }
  };

  /**
   * §4: tek bir "metne ekle" düğmesi yok, eylem adıyla ne yaptığını söyler.
   * Burada eklenen şey üretilmiş cümle + atıf; pasaj değil.
   */
  const insertSentence = (key) => {
    const draft = drafts[key];
    const el = pageRef.current;
    if (!draft?.sentence || !el) return;
    const p = document.createElement('p');
    p.textContent = `${draft.sentence} ${draft.citation}`;
    el.appendChild(p);
    setDrafts((d) => ({ ...d, [key]: { ...d[key], inserted: true } }));
    onInput();
  };

  /** §4: pasaj hiçbir koşulda tırnaksız ve atıfsız belgeye girmez. */
  const insertQuote = (paper, key) => {
    const draft = drafts[key];
    const el = pageRef.current;
    const passage = draft?.passage || (paper.description || '').trim();
    if (!passage || !el) return;
    const q = document.createElement('blockquote');
    q.textContent = `“${passage}” ${inlineCitation(paper, lang)}`;
    el.appendChild(q);
    onInput();
  };

  const geometry = pageGeometry(setup);
  const saveLabel = {
    dirty: t('workspace.saveDirty'),
    local: t('workspace.saveLocal', { time: saveState.at?.toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) || '' }),
    unsaved: t('workspace.saveNone'),
    saved: t('workspace.saveLocalShort'),
  }[saveState.kind];

  return (
    <div className="wx" hidden={hidden}>
      {/* Yazdırmada kağıt boyutu ve kenar boşlukları ekrandakiyle aynı olsun. */}
      <style>{`@page { size: ${geometry.width}mm ${geometry.height}mm; margin: ${geometry.margin}mm; }`}</style>
      {tabs}

      {!started ? (
        // §9 "İlk on dakika": üç yol, hiçbiri zorunlu değil, sihirbaz yok.
        <section className="wx-start">
          <h2>{t('workspace.startTitle')}</h2>
          <p>{t('workspace.startLead')}</p>
          <div className="wx-start__ways">
            <button type="button" className="wx-way wx-way--main" onClick={() => start('blank')}>
              <strong>{t('workspace.wayBlank')}</strong>
              <small>{t('workspace.wayBlankHint')}</small>
            </button>
            <button type="button" className="wx-way" onClick={() => start('imrad')}>
              <strong>{t('workspace.wayImrad')}</strong>
              <small>{t('workspace.wayImradHint')}</small>
            </button>
            <button type="button" className="wx-way" onClick={() => start('thesis')}>
              <strong>{t('workspace.wayThesis')}</strong>
              <small>{t('workspace.wayThesisHint')}</small>
            </button>
          </div>
        </section>
      ) : (
        <div className="wx-body">

          {/* --- Gezgin (§3) --- */}
          <aside className="wx-nav" aria-label={t('workspace.navigator')}>
            <div className="wx-nav__tabs" role="tablist">
              <button type="button" role="tab" aria-selected={navTab === 'sections'} onClick={() => setNavTab('sections')}>
                {t('workspace.tabSections')}
              </button>
              <button type="button" role="tab" aria-selected={navTab === 'sources'} onClick={() => setNavTab('sources')}>
                {t('workspace.tabSources')} {basket.papers.length > 0 && <span className="wx-count">{basket.papers.length}</span>}
              </button>
            </div>

            <div className="wx-nav__body">
              {navTab === 'sections' && (outline.length === 0 ? (
                <p className="wx-muted">{t('workspace.noSections')}</p>
              ) : outline.map((h, i) => (
                <div key={`${h.text}-${i}`} className={`wx-tree wx-tree--l${h.level}`}>
                  {h.level === 1 ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span>{h.text || t('workspace.untitledSection')}</span>
                </div>
              )))}

              {navTab === 'sources' && (basket.papers.length === 0 ? (
                <p className="wx-muted">{t('workspace.sourcesEmpty')}</p>
              ) : basket.papers.map((paper, i) => {
                const key = paper.doi || paper.url || paper.title || String(i);
                return (
                  <button key={key} type="button"
                    className={`wx-src${activeSource === key ? ' is-on' : ''}`}
                    onClick={() => setActiveSource(key)}>
                    <strong>{paper.title}</strong>
                    <small>{[paper.creator?.split(',')[0], paper.year].filter(Boolean).join(' · ')}</small>
                  </button>
                );
              }))}
            </div>
          </aside>

          {/* --- Belge (§6) --- */}
          <div className="wx-main">
            <div className="wx-ribbon" role="toolbar" aria-label={t('workspace.toolbar')}>
              <select className="wx-sel" defaultValue="p"
                onChange={(e) => { exec('formatBlock', e.target.value); e.target.value = 'p'; }}
                aria-label={t('workspace.style')}>
                <option value="p">{t('workspace.body')}</option>
                <option value="h1">{t('workspace.heading', { n: 1 })}</option>
                <option value="h2">{t('workspace.heading', { n: 2 })}</option>
                <option value="h3">{t('workspace.heading', { n: 3 })}</option>
                <option value="blockquote">{t('workspace.quote')}</option>
              </select>
              <Tool icon={<Bold size={15} />} label={t('workspace.bold')} onClick={() => exec('bold')} />
              <Tool icon={<Italic size={15} />} label={t('workspace.italic')} onClick={() => exec('italic')} />
              <Tool icon={<Underline size={15} />} label={t('workspace.underline')} onClick={() => exec('underline')} />
              <span className="wx-divider" />
              <Tool icon={<AlignLeft size={15} />} label={t('workspace.alignLeft')} onClick={() => exec('justifyLeft')} />
              <Tool icon={<AlignCenter size={15} />} label={t('workspace.alignCenter')} onClick={() => exec('justifyCenter')} />
              <Tool icon={<AlignJustify size={15} />} label={t('workspace.alignJustify')} onClick={() => exec('justifyFull')} />
              <Tool icon={<List size={15} />} label={t('workspace.bulletList')} onClick={() => exec('insertUnorderedList')} />
              <Tool icon={<ListOrdered size={15} />} label={t('workspace.numberList')} onClick={() => exec('insertOrderedList')} />
              <span className="wx-divider" />
              <Tool icon={<Undo2 size={15} />} label={t('workspace.undo')} onClick={() => exec('undo')} />
              <Tool icon={<Redo2 size={15} />} label={t('workspace.redo')} onClick={() => exec('redo')} />
              <span className="wx-ribbon__end">
                <select className="wx-sel" value={setup.size} onChange={(e) => setSetup((s) => ({ ...s, size: e.target.value }))} aria-label={t('workspace.pageSize')}>
                  {Object.values(PAGE_SIZES).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <select className="wx-sel" value={setup.margin} onChange={(e) => setSetup((s) => ({ ...s, margin: e.target.value }))} aria-label={t('workspace.margins')}>
                  {Object.values(MARGIN_PRESETS).map((m) => <option key={m.id} value={m.id}>{t(`workspace.margin.${m.id}`)}</option>)}
                </select>
                <button type="button" className="wx-btn" onClick={async () => {
                  const { exportDocx } = await import('./exportDocument.js');
                  await exportDocx({ root: pageRef.current, setup, title: title || t('workspace.untitled') });
                }}>
                  <FileText size={14} /> Word
                </button>
                <button type="button" className="wx-btn" onClick={() => window.print()}>
                  <Printer size={14} /> {t('workspace.print')}
                </button>
              </span>
            </div>

            {/* §6 özet satırı — yüzde yok, sayı var */}
            <p className="wx-summary" aria-live="polite">
              {t('workspace.summary', {
                total: fmt(counts.total),
                cited: fmt(counts.cited),
                uncited: fmt(counts.uncited),
                notClaim: fmt(counts.notClaim),
              })}
              <span className="wx-summary__note">{t('workspace.summaryLimit')}</span>
            </p>

            <div className="wx-desk" style={pageStyle(setup)}>
              <input
                className="wx-title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setSaveState({ kind: 'dirty', at: null }); }}
                placeholder={t('workspace.titlePlaceholder')}
                aria-label={t('workspace.title')}
              />
              <div
                ref={pageRef}
                className="wx-page"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label={t('workspace.document')}
                onInput={onInput}
                onBlur={() => persist()}
              />
            </div>

            <div className="wx-status">
              <span className={`wx-save wx-save--${saveState.kind === 'dirty' ? 'dirty' : saveState.kind === 'unsaved' ? 'none' : 'local'}`}>
                {saveLabel}
              </span>
              <span className="wx-status__spacer" />
              <span>{PAGE_SIZES[setup.size].label} · {t(`workspace.margin.${setup.margin}`)}</span>
            </div>
          </div>

          {/* --- Bağlam paneli (§3, §4) --- */}
          <aside className="wx-side" aria-label={t('workspace.contextPanel')}>
            <div className="wx-side__head">{t('workspace.contextPanel')}</div>
            <div className="wx-side__body">
              {/* Kanıt paneli henüz yok; neden olmadığı yazılı (CLAUDE.md 2.8). */}
              <div className="wx-notice">
                <strong>{t('workspace.evidenceSoonTitle')}</strong>
                <p>{t('workspace.evidenceSoonText')}</p>
              </div>

              {(() => {
                const paper = basket.papers.find((p, i) => (p.doi || p.url || p.title || String(i)) === activeSource);
                if (!paper) {
                  return <p className="wx-muted">{t('workspace.pickSource')}</p>;
                }
                const key = activeSource;
                const draft = drafts[key];
                const passage = (paper.description || '').trim();
                return (
                  <article className="wx-card">
                    <h4>{paper.title}</h4>
                    <small>{[paper.creator, paper.year, paper.publicationName].filter(Boolean).join(' · ')}</small>

                    {!passage && <p className="wx-warn">{t('workspace.noPassage')}</p>}
                    {passage && (
                      <>
                        <div className="wx-passage">{passage}</div>
                        <small className="wx-muted">{t('workspace.passageIsAbstract')}</small>
                        <div className="wx-acts">
                          <button type="button" onClick={() => makeSentence(paper, key)} disabled={draft?.loading}>
                            <Quote size={13} /> {draft?.loading ? t('workspace.generating') : t('workspace.generateSentence')}
                          </button>
                          <button type="button" className="ghost" onClick={() => insertQuote(paper, key)}>
                            {t('workspace.quoteIt')}
                          </button>
                        </div>
                      </>
                    )}

                    {draft?.error && <p className="wx-warn">{draft.error}</p>}
                    {draft?.sentence && (
                      <div className="wx-draft">
                        <p>{draft.sentence} {draft.citation}</p>
                        <div className="wx-acts">
                          <button type="button" onClick={() => insertSentence(key)}>{t('workspace.insertSentence')}</button>
                          <button type="button" className="ghost" onClick={() => makeSentence(paper, key)}>{t('workspace.regenerate')}</button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })()}

              <article className="wx-card wx-card--lib">
                <h4><Library size={14} /> {t('workspace.needSource')}</h4>
                <p>{t('workspace.needSourceText')}</p>
              </article>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
