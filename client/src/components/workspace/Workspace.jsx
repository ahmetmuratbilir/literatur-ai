import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  AlignCenter, AlignJustify, AlignLeft, ArrowLeft, Bold, Check, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardCheck, Download, FileText, History, Info, Italic, LayoutTemplate, Library, List, ListChecks, ListOrdered, ListTree,
  PanelRightClose, PanelRightOpen, Plus, Printer, Quote, Redo2, RefreshCw, RotateCcw, Search, SlidersHorizontal,
  Underline, Undo2, Upload, X,
} from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import {
  DEFAULT_SETUP, FONTS, FONT_SIZES, LINE_HEIGHTS, MARGIN_PRESETS, PAGE_SIZES, pageGeometry, pageStyle,
} from './pageSetup.js';
import {
  MARK, OVERRIDE, applyOverride, classifySentence, sentenceKey, splitSentences, summarize,
} from './claimDetection.js';
import { FORMATS, TEMPLATES, planFormatChange, templateHtml, templateWords } from './templates.js';
import FormatPicker from './FormatPicker.jsx';
import CheckPanel from './CheckPanel.jsx';
import OutlineNav from './OutlineNav.jsx';
import SubmitPrep from './SubmitPrep.jsx';
import { captionOf, citedDois, marginItems, runAudit } from '../../audit/audit.js';
import { downloadText, toBibTeX, toRIS } from '../../utils/citationExport.js';
import {
  DRAFT_PREFIX, LOCK_BEAT, lockHolder, lockKey, newId, readDraft, readLock, releaseLock, saveConflictCopy, saveDraft, writeLock,
} from './drafts.js';
import { buildOutline, countWords } from './outline.js';
import { inlineCitation, referenceLine } from './citation.js';
import { isReferencesHeading, matchSources } from './references.js';
import { SUPPORT_SHAPES, isSettled, locateSpan, refusalKey, supportLabel } from './evidence.js';

/**
 * Yazar yüzeyi — docs/design/tasarim-yonu.md
 *
 * §3  56 px ray · 260 px gezgin · belge · 360 px bağlam paneli. 1280 px
 *     altında bağlam paneli, 1024 px altında gezgin üstü örten katman olur.
 * §5  İki görünüm: Taslak (68ch, ekran serifi, 17px/1.65) ve Teslim
 *     önizleme (gerçek kağıt, kenar, yazı tipi). Önizleme "yaklaşık" der.
 * §6  Renk kanıt içindir: arayüz nötr, indigo yalnız birincil eylemde.
 * §8  Boş sayfa bir sonraki hamleyi söyler; şablon seçmeye zorlanmaz.
 * §11 Kayıt: ○ kaydedilmedi · ◐ bu cihazda · ● bulutta (bulut henüz yok).
 * §13 Şerit 12–16 denetim; cetvel salt göstergedir, sürüklenmez.
 *
 * Uygulanmayanlar, sebepleriyle:
 * - Kanıt paneli (§4): pasaj arama ve doğrulama ucu yok.
 * - Cümle çapası ve köken alanı (§5, CLAUDE.md 3.6): contentEditable'da Enter
 *   blok özniteliklerini yeni paragrafa kopyalıyor; köken kaydı yanlış
 *   cümleye yapışırdı. Güvenilir hali TipTap ister (WO-004).
 * - 2. ve 3. kademe sınıflandırma: sunucuda yerel model yok.
 * Arayüz bu sınırları kullanıcıya yazar, sessizce geçmez (CLAUDE.md 2.8).
 */
const SAVE_DELAY = 800;
const FLASH_MS = 1600;
const WIDE = '(min-width: 1281px)';
// Sunucudaki resmî CSL stilleri (server/services/bibliography.js STYLE_FILES).
const BIB_FORMATS = ['APA 7', 'IEEE', 'MLA', 'Chicago'];
const MAX_RETRACTION_DOIS = 25;
// Yerleşim ölçüleri (WO-010): sağ panel 360, masa iç boşluğu 2×24, CSS 96 dpi.
const SIDE_W = 360;
const DESK_GUTTER = 48;
const DRAFT_MIN_PX = 640;
// Bu sekmenin kimliği: aynı taslağı hangi sekmenin düzenlediğini ayırır (WO-011).
const TAB_ID = newId();
const MM_TO_PX = 96 / 25.4;
const normDoi = (doi) => String(doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase();
const MEDIUM = '(min-width: 1025px)';

/** Taslağın kayıtlı hali. Depolama kapalıysa (gizli sekme, engellenmiş çerez) boş döner. */
function readSaved(draftId) {
  try {
    return readDraft(window.localStorage, draftId);
  } catch {
    return null;
  }
}

function mediaMatches(query) {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return true;
  }
}

/**
 * Kaynağın liste kimliği. Gezgindeki liste ile bağlam paneli aynı anahtarı
 * üretmek zorunda; ikisi ayrı yerde hesaplanırsa seçim sessizce kopar.
 */
function sourceKey(paper, i) {
  return paper?.doi || paper?.url || paper?.title || String(i);
}

/**
 * Biçim değişimi için belgedeki başlıklar (WO-011): şablon kimliği, seviye,
 * kendi içeriğinin (bir sonraki başlığa kadar) boş olup olmadığı ve hemen
 * ardından alt başlık gelip gelmediği.
 */
function describeHeadings(el) {
  if (!el) return [];
  const kids = [...el.children];
  const out = [];
  kids.forEach((node, i) => {
    if (!/^H[1-3]$/.test(node.tagName)) return;
    const level = Number(node.tagName[1]);
    let ownEmpty = true;
    let hasChildren = false;
    for (let j = i + 1; j < kids.length; j += 1) {
      const next = kids[j];
      if (/^H[1-3]$/.test(next.tagName)) {
        hasChildren = Number(next.tagName[1]) > level;
        break;
      }
      if (next.textContent.trim() || next.querySelector('img, table')) ownEmpty = false;
    }
    out.push({ node, text: node.textContent.trim(), level, key: node.dataset.templateSection || null, ownEmpty, hasChildren });
  });
  return out;
}

/** Kaydedilecek HTML: geçici vurgu sınıfı kayda girmez. */
function serialize(el) {
  if (!el) return '';
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.wx-flash').forEach((node) => {
    node.classList.remove('wx-flash');
    if (!node.getAttribute('class')) node.removeAttribute('class');
  });
  return clone.innerHTML;
}

/** Belgenin üst düzey bloğu: imleç hangi paragrafta. */
function topBlock(el, node) {
  let current = node;
  while (current && current.parentNode !== el) current = current.parentNode;
  return current || null;
}

/** Bloğun metninde [start, end) aralığını kapsayan Range; iç biçim etiketlerini aşar. */
function rangeForOffsets(block, start, end) {
  const range = document.createRange();
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let started = false;
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent.length;
    if (!started && start <= pos + len) {
      range.setStart(node, Math.max(0, start - pos));
      started = true;
    }
    if (started && end <= pos + len) {
      range.setEnd(node, Math.max(0, end - pos));
      return range;
    }
    pos += len;
    node = walker.nextNode();
  }
  return started ? range : null;
}

/** İnceleme listesine hangi cümle girer. Boş parça iddia tartışmasına girmez. */
function inReview(sentence, kind) {
  if (kind === MARK.uncited) return sentence.mark === MARK.uncited;
  if (kind === MARK.notClaim) return sentence.mark === MARK.notClaim && sentence.reason !== 'empty';
  return false;
}

/** "3 gün önce" — Intl ile, dile göre. */
function formatAgo(ms, locale, now) {
  if (!ms) return '';
  const minutes = Math.round((ms - now) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(minutes) < 60 * 24) return rtf.format(Math.round(minutes / 60), 'hour');
  return rtf.format(Math.round(minutes / 1440), 'day');
}

function Tool({ icon, label, onClick }) {
  return (
    <button type="button" className="wx-tool" onClick={onClick} title={label} aria-label={label}>
      {icon}
    </button>
  );
}

/** Açılır panel: dışarı tıklayınca ve Esc ile kapanır. */
function Popover({ open, onClose, label, wide = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const anchor = ref.current?.parentElement;
      if (anchor && !anchor.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className={`wx-pop${wide ? ' wx-pop--wide' : ''}`} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * @param embedded  Uygulama kabuğunun içinde (WO-010): portal yok, tam ekran yok.
 * @param apiRef    Kabuğun belgeye verdiği komutlar (Denetim → "Metinde göster").
 * @param onSnapshot Belgenin özetini kabuğa bildirir; Denetim bu özetten çalışır.
 * @param onFindSources "Kaynak bul": araştırma moduna döner (WO-011).
 * @param initialData Depolama yazılamadığında bellekteki taslak (WO-011).
 * @param onConflict  Çakışmada bu sekmenin metni kopya taslağa yazıldı.
 * @param panelRequest `{ panel: 'check', at }` — `#/yazar/kontrol` Kontrol'ü açar.
 */
export default function Workspace({
  basket, apiUrl, getToken, hidden = false, onExit,
  embedded = false, apiRef = null, onSnapshot = null, onFindSources = null,
  draftId = null, onSaved = null, initialData = null, onConflict = null, panelRequest = null,
}) {
  const { t, lang } = useI18n();
  // Taslak değişince bileşen yeniden kurulur (App `key={draftId}`); okuma bir kez.
  // Bellekteki taslak yalnız ilk açılışta okunur: depolama sonradan açılıp
  // taslak listeye geçince belge yeniden yüklenmesin (imleç kaybolmasın).
  const initialRef = useRef(initialData);
  const saved = useMemo(() => initialRef.current || readSaved(draftId), [draftId]);
  const [format, setFormat] = useState(() => saved?.format || null);
  const [setup, setSetup] = useState(() => ({ ...DEFAULT_SETUP, ...(saved?.setup || {}) }));
  const [view, setView] = useState(() => (saved?.view === 'submit' ? 'submit' : 'draft'));
  const [title, setTitle] = useState(() => saved?.title || '');
  const [saveState, setSaveState] = useState(() => ({ kind: initialRef.current ? 'failed' : (saved?.html ? 'local' : 'empty'), at: null }));
  // Depolamaya yazılamıyor: yazmaya izin verilir, kalıcı uyarı ve çıkış uyarısı gösterilir.
  const [storageDown, setStorageDown] = useState(Boolean(initialRef.current));
  // Başka sekme bu taslağı düzenliyor: burada salt okunur.
  const [readOnly, setReadOnly] = useState(false);
  const [outline, setOutline] = useState({ headings: [], words: 0 });
  const [counts, setCounts] = useState({ total: 0, cited: 0, uncited: 0, notClaim: 0 });
  const [isEmpty, setIsEmpty] = useState(false);
  const [currentSection, setCurrentSection] = useState(-1);
  const [sentences, setSentences] = useState([]);
  const [refs, setRefs] = useState({ present: false, lines: [] });
  const [blocks, setBlocks] = useState([]);
  const [review, setReview] = useState(null);
  const [sideView, setSideView] = useState('source');
  const [bodyText, setBodyText] = useState('');
  const [bibFormat, setBibFormat] = useState(() => (BIB_FORMATS.includes(saved?.bibFormat) ? saved.bibFormat : 'APA 7'));
  // Kaynakça kapsamı. Varsayılan "atıf yapılanlar": akademik kaynakça
  // yalnızca metinde atıf verilen çalışmaları listeler. Zotero'dan kaynak
  // aktarıp henüz atıf vermemiş kullanıcı boş kaynakçayla kalmasın diye
  // "sepetteki tümü" seçilebiliyor; hangisinin seçili olduğu arayüzde yazar.
  const [bibScope, setBibScope] = useState(() => (saved?.bibScope === 'all' ? 'all' : 'cited'));
  const [bib, setBib] = useState({ status: 'idle', entries: [], error: '' });
  const [retractions, setRetractions] = useState({ byDoi: {}, failed: false });
  // §11: geri dönen kullanıcıya nerede kaldığı söylenir.
  const [resume, setResume] = useState(() => (saved?.html && saved?.lastSection?.text
    ? { ...saved.lastSection, ago: formatAgo(saved.savedAt, lang === 'tr' ? 'tr-TR' : 'en-US', Date.now()) }
    : null));
  const [navPanel, setNavPanel] = useState(() => (mediaMatches(MEDIUM) ? 'sections' : null));
  const [sideOpen, setSideOpen] = useState(() => mediaMatches(WIDE));
  const [menu, setMenu] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [activeSource, setActiveSource] = useState(null);
  // Zotero / Mendeley dosyasından aktarma: dosya okunur, kullanıcı seçer (2.9).
  const [imp, setImp] = useState(null);
  // Biçim değiştirme penceresi açık mı.
  const [fmtOpen, setFmtOpen] = useState(false);
  // Faz 3: "Teslime hazırla" paneli ve kenar işaretinden Kontrol'e gelen madde.
  const [prepOpen, setPrepOpen] = useState(false);
  const [checkFocus, setCheckFocus] = useState({ id: null, tick: 0 });
  const [markers, setMarkers] = useState([]);
  // Geri çekme durumu: `key` cevabın hangi isteğe ait olduğunu söyler.
  const [retraction, setRetraction] = useState({ byDoi: null, failed: false, key: '' });
  // Seçimin üstündeki küçük araç çubuğu: masadaki konumu, yoksa null.
  const [selBar, setSelBar] = useState(null);
  // Teslim görünümü ölçeği: 'fit' sayfayı masaya sığdırır, 'actual' gerçek boyut.
  // Faz 2: Teslim görünümü %100 açılır; sayfa sığmazsa sol panel kapanır, sayfa küçülmez.
  // Eski kayıtlardaki "sığdır" eski varsayılandı; geri yüklenmez.
  const [zoomMode, setZoomMode] = useState('actual');
  const [pageInfo, setPageInfo] = useState({ i: 1, n: 1 });
  const [renamingSection, setRenamingSection] = useState(null);
  const userNavRef = useRef(false);
  const [deskWidth, setDeskWidth] = useState(0);
  const deskRef = useRef(null);
  const pageRef = useRef(null);
  const fileRef = useRef(null);
  const lastRangeRef = useRef(null);
  // Kullanıcının "iddia / iddia değil" kararları, cümle metnine bağlı (§5).
  const overridesRef = useRef(saved?.overrides || {});
  const sentencesRef = useRef([]);
  const currentSectionRef = useRef(null);
  // Son yazılan kaynakça satırları: yeniden yazarken elle eklenmiş metni ayırt etmek için.
  const lastBibRef = useRef(saved?.bibTexts || []);
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const fmt = (n) => Number(n || 0).toLocaleString(locale);
  const closeMenu = useCallback(() => setMenu(null), []);
  const toggleMenu = (id) => setMenu((m) => (m === id ? null : id));

  // Tam ekran açıkken arkadaki sayfa kaymasın.
  useEffect(() => {
    if (hidden) return undefined;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = previous; };
  }, [hidden]);

  // Metin ile sepet: hangi kaynağa atıf var, hangisine yok, hangi atıf sahipsiz.
  const match = useMemo(() => matchSources(bodyText, basket.papers), [bodyText, basket.papers]);
  const citedPapers = useMemo(
    () => match.cited.map((i) => ({ paper: basket.papers[i], key: sourceKey(basket.papers[i], i) })),
    [match, basket.papers],
  );
  // Kaynakçaya girecek kaynaklar: atıf yapılanlar (metindeki ilk geçiş
  // sırasıyla) ya da sepetin tamamı (sepet sırasıyla).
  const bibPapers = useMemo(
    () => (bibScope === 'all'
      ? basket.papers.map((p, i) => ({ paper: p, key: sourceKey(p, i) }))
      : citedPapers),
    [bibScope, basket.papers, citedPapers],
  );
  const citedSignature = `${bibScope}:${bibPapers.map((c) => c.key).join('|')}`;
  const bibOpen = sideOpen && sideView === 'bib' && !review && !hidden;

  const fallbackReference = (key) => {
    const i = basket.papers.findIndex((p, j) => sourceKey(p, j) === key);
    return i >= 0 ? referenceLine(basket.papers[i]) : '';
  };

  // Kaynakça önizlemesi: panel açıkken ve atıf kümesi ya da stil değişince.
  // Sıra metindeki ilk geçiş sırasıdır (IEEE numarası buna göre).
  useEffect(() => {
    if (!bibOpen || !citedSignature) return undefined;
    const controller = new AbortController();
    setBib((b) => ({ ...b, status: 'loading', error: '' }));
    (async () => {
      try {
        const token = await getTokenRef.current();
        const papers = bibPapers.map(({ paper, key }) => ({
          key, title: paper.title, creator: paper.creator, year: paper.year,
          publicationName: paper.publicationName, volume: paper.volume, issue: paper.issue,
          pages: paper.pages, doi: paper.doi, url: paper.url,
        }));
        const { data } = await axios.post(`${apiUrl}/api/bibliography`, { papers, format: bibFormat }, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        setBib({ status: 'ready', entries: data.entries || [], error: '' });
      } catch (err) {
        if (axios.isCancel(err)) return;
        setBib({ status: 'error', entries: [], error: err.response?.data?.error || '' });
      }
    })();
    return () => controller.abort();
    // bibPapers citedSignature'dan türüyor; imza değişmedikçe istek yinelenmez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bibOpen, citedSignature, bibFormat, apiUrl]);

  // Geri çekme durumu her açılışta canlı sorulur (CLAUDE.md 3.4: önbelleğe
  // alınmaz). Yanıt gelmeyen kaynak "temiz" değil "bilinmiyor" sayılır.
  useEffect(() => {
    const dois = [...new Set(bibPapers.map((c) => normDoi(c.paper.doi)).filter(Boolean))].slice(0, MAX_RETRACTION_DOIS);
    if (!bibOpen || !dois.length) return undefined;
    const controller = new AbortController();
    (async () => {
      try {
        const token = await getTokenRef.current();
        const { data } = await axios.post(`${apiUrl}/api/retractions`, { dois }, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        setRetractions({ byDoi: data.results || {}, failed: Boolean(data.failed) });
      } catch (err) {
        if (axios.isCancel(err)) return;
        setRetractions({ byDoi: {}, failed: true });
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bibOpen, citedSignature, apiUrl]);

  // İnceleme açıkken ilgili cümleler belgede vurgulanır. CSS Custom Highlight
  // API belgeye dokunmaz: kayda, dışa aktarmaya ve geri almaya hiçbir şey
  // girmez. Desteklemeyen tarayıcıda liste yine çalışır, yalnız vurgu olmaz.
  useEffect(() => {
    const registry = window.CSS?.highlights;
    const HighlightType = window.Highlight;
    if (!registry || !HighlightType) return undefined;
    if (!review) {
      registry.delete('wx-review');
      return undefined;
    }
    const ranges = sentencesRef.current
      .filter((s) => inReview(s, review) && s.block.isConnected)
      .map((s) => rangeForOffsets(s.block, s.start, s.end))
      .filter(Boolean);
    registry.set('wx-review', new HighlightType(...ranges));
    return () => registry.delete('wx-review');
  }, [review, sentences]);

  // Sepette kaynak varken bağlam paneli boş durmaz: seçim yoksa ya da seçili
  // kaynak sepetten çıkarıldıysa ilk kaynağa düşer. Seçim belgeye bir şey
  // yazmaz, yalnız sağda hangi pasajın göründüğünü belirler (CLAUDE.md 2.9).
  useEffect(() => {
    const keys = basket.papers.map(sourceKey);
    if (keys.length === 0) {
      if (activeSource !== null) setActiveSource(null);
    } else if (!keys.includes(activeSource)) {
      setActiveSource(keys[0]);
    }
  }, [basket.papers, activeSource]);

  /**
   * Cümleleri işaretler, bölüm ağacını ve kelime sayılarını çıkarır.
   * İşaretler yalnız yerel kuralla konuyor; "kanıtlı" demiyor, "atıf işareti
   * var" diyor.
   */
  const scan = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    const items = [];
    const all = [];
    const body = [];
    // Denetim için (WO-010 2.1): kaynakça bölümünün metni ve gövde blokları.
    const refsLines = [];
    const blocks = [];
    let hasRefs = false;
    let refsLevel = 0;

    for (const block of el.children) {
      // Rehber satırı yalnız başlığın hemen altındaki paragrafta kalır. Enter
      // özniteliği yeni paragrafa kopyalar; her boş satırda rehber çıkmasın.
      if (block.hasAttribute('data-hint') && !/^H[1-6]$/.test(block.previousElementSibling?.tagName || '')) {
        block.removeAttribute('data-hint');
      }
      if (/^H[1-3]$/.test(block.tagName)) {
        block.removeAttribute('data-mark');
        const level = Number(block.tagName[1]);
        if (isReferencesHeading(block.textContent)) {
          refsLevel = level;
          hasRefs = true;
        } else if (refsLevel && level <= refsLevel) refsLevel = 0;
        items.push({
          kind: 'heading',
          level: Number(block.tagName[1]),
          text: block.textContent.trim(),
          target: Number(block.getAttribute('data-target')) || 0,
          key: block.getAttribute('data-template-section') || null,
        });
        continue;
      }
      items.push({ kind: 'text', text: block.textContent });
      // Kaynakça satırları "(2019)." taşır; iddia ya da atıf sayılmasınlar.
      if (refsLevel) {
        block.removeAttribute('data-mark');
        if (block.textContent.trim()) refsLines.push(block.textContent.trim());
        continue;
      }
      body.push(block.textContent);
      if (!['P', 'DIV', 'BLOCKQUOTE'].includes(block.tagName)) continue;
      const firstSentence = all.length;
      const marks = [];
      for (const part of splitSentences(block.textContent)) {
        const lead = part.text.length - part.text.trimStart().length;
        const text = part.text.trim();
        const key = sentenceKey(text);
        const override = overridesRef.current[key];
        const { mark, reason } = applyOverride(classifySentence(text), override);
        marks.push(mark);
        all.push({
          id: all.length, text, key, mark, reason, overridden: Boolean(override),
          block, start: part.start + lead, end: part.start + lead + text.length,
        });
      }
      // Blok tek bir işaret taşır: en zayıf durum kazanır.
      const worst = marks.includes(MARK.uncited) ? MARK.uncited
        : marks.includes(MARK.cited) ? MARK.cited : MARK.notClaim;
      if (worst === MARK.notClaim) block.removeAttribute('data-mark');
      else block.setAttribute('data-mark', worst);
      if (block.textContent.trim()) {
        blocks.push({ tag: block.tagName, text: block.textContent.trim(), key: all[firstSentence]?.key || null });
      }
    }
    setRefs({ present: hasRefs, lines: refsLines });
    setBlocks(blocks);
    setOutline(buildOutline(items));
    sentencesRef.current = all;
    setSentences(all.map((s) => ({
      id: s.id, text: s.text, key: s.key, mark: s.mark, reason: s.reason, overridden: s.overridden,
    })));
    setCounts(summarize(all));
    setBodyText(body.join('\n'));
    setIsEmpty(el.textContent.trim() === '');
  }, []);

  // Başlangıç içeriği bir kez yazılır; sonraki render'lar imleci bozmasın.
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    el.innerHTML = saved?.html || '<p><br></p>';
    scan();
    try {
      // Enter <div> değil <p> üretsin: sınıflandırma ve .docx paragrafı bekliyor.
      document.execCommand('defaultParagraphSeparator', false, 'p');
      document.execCommand('styleWithCSS', false, true);
    } catch {
      // Desteklenmiyorsa varsayılan davranış kalır; belge bozulmaz.
    }
  }, [saved, scan]);

  // İmlecin son konumu: panelden eklenen cümle oraya gider, belgenin sonuna değil.
  useEffect(() => {
    const onSelection = () => {
      const el = pageRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer)) {
        setSelBar(null);
        return;
      }
      lastRangeRef.current = range.cloneRange();
      // Seçim varsa üstünde küçük araç çubuğu (WO-010 1.4). Konum masanın
      // kaydırılan içeriğine göre: çubuk metinle birlikte kayar.
      const desk = deskRef.current;
      if (desk && !range.collapsed && range.toString().trim().length >= 2) {
        const rect = range.getBoundingClientRect();
        const box = desk.getBoundingClientRect();
        if (rect.width > 0) {
          setSelBar({
            top: Math.max(4, rect.top - box.top + desk.scrollTop - 42),
            left: Math.min(Math.max(rect.left - box.left + desk.scrollLeft + rect.width / 2, 120), desk.scrollWidth - 120),
          });
        }
      } else {
        setSelBar(null);
      }
      const block = topBlock(el, range.startContainer);
      if (!block) return;
      let index = -1;
      let heading = null;
      for (const child of el.children) {
        if (/^H[1-3]$/.test(child.tagName)) {
          index += 1;
          heading = child;
        }
        if (child === block) break;
      }
      setCurrentSection(index);
      currentSectionRef.current = heading ? { index, text: heading.textContent.trim() } : null;
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  // Masanın iç genişliği: Teslim görünümünde "sığdır" ölçeği buna göre.
  useEffect(() => {
    const desk = deskRef.current;
    if (!desk || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setDeskWidth(entry.contentRect.width));
    observer.observe(desk);
    return () => observer.disconnect();
  }, []);

  // --- Kayıt (WO-011 Faz 1) ---------------------------------------------
  // Eskiden kayıt bir efektin zamanlayıcısına bağlıydı ve ara sıra hiç
  // çalışmıyordu (temel çizgi testi B4: 12 koşuda 1, 10 koşuda 3 kez metin
  // 12 sn boyunca kaydedilmedi). Şimdi: değişiklik anında zamanlayıcı kurulur,
  // zamanlayıcı en son kayıt fonksiyonunu ref'ten okur; sayfa gizlenince,
  // kapanırken ve mod değişirken bekleyen kayıt hemen yazılır.
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef(null);
  const persistRef = useRef(() => {});
  // Bu sekmenin yüklediği ya da son yazdığı sürüm; başkası araya yazdıysa üzerine yazılmaz.
  const revRef = useRef(saved?.rev || 0);
  const readOnlyRef = useRef(false);
  const setReadOnlyBoth = useCallback((value) => {
    readOnlyRef.current = value;
    setReadOnly(value);
  }, []);

  /** Depodaki (başka sekmenin yazdığı) hali belgeye koyar; kaydırma yerinde kalır. */
  const applyStored = useCallback((data) => {
    const el = pageRef.current;
    if (!el || !data) return;
    el.innerHTML = data.html || '<p><br></p>';
    setTitle(data.title || '');
    setSetup({ ...DEFAULT_SETUP, ...(data.setup || {}) });
    setFormat(data.format || null);
    if (BIB_FORMATS.includes(data.bibFormat)) setBibFormat(data.bibFormat);
    overridesRef.current = data.overrides || {};
    lastBibRef.current = data.bibTexts || [];
    revRef.current = data.rev || 0;
    dirtyRef.current = false;
    lastRangeRef.current = null;
    setSaveState({ kind: 'local', at: new Date() });
    scan();
  }, [scan]);

  /** Depoda daha yeni sürüm varsa ve burada kaydedilmemiş değişiklik yoksa sessizce yükler. */
  const loadNewer = useCallback(() => {
    if (!draftId || dirtyRef.current) return;
    let stored = null;
    try {
      stored = readDraft(window.localStorage, draftId);
    } catch {
      return;
    }
    if (stored && (stored.rev || 0) > revRef.current) applyStored(stored);
  }, [draftId, applyStored]);

  const persist = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    if (!draftId || readOnlyRef.current) return;
    try {
      const data = {
        html: serialize(pageRef.current),
        title,
        format,
        setup,
        view,
        overrides: overridesRef.current,
        lastSection: currentSectionRef.current,
        savedAt: Date.now(),
        words: countWords(pageRef.current?.textContent || ''),
        bibFormat,
        bibScope,
        bibTexts: lastBibRef.current,
        zoom: zoomMode,
      };
      const result = saveDraft(window.localStorage, draftId, data, { baseRev: revRef.current });
      if (result.conflict) {
        // İki tarafta da kaydedilmemiş değişiklik var: hiçbiri ezilmez. Bu
        // sekmenin metni ayrı taslak olur, belge öbür sekmenin haline geçer.
        const copyId = saveConflictCopy(window.localStorage, draftId, data, { suffix: t('workspace.sync.conflictSuffix') });
        applyStored(result.stored);
        setStorageDown(false);
        onSaved?.(null);
        onConflict?.({ copyId, title: data.title });
        return;
      }
      revRef.current = result.rev;
      dirtyRef.current = false;
      setStorageDown(false);
      setSaveState({ kind: 'local', at: new Date() });
      onSaved?.(result.meta);
    } catch {
      // Depolama kapalı ya da dolu: değişiklik bellekte kalır, kullanıcıya söylenir.
      setStorageDown(true);
      setSaveState({ kind: 'failed', at: null });
    }
  }, [draftId, title, format, setup, view, bibFormat, bibScope, zoomMode, onSaved, onConflict, applyStored, t]);

  useEffect(() => { persistRef.current = persist; }, [persist]);

  /** Bekleyen değişiklik varsa hemen yazar. */
  const flush = useCallback(() => {
    if (dirtyRef.current) persistRef.current();
  }, []);

  const markDirty = useCallback(() => {
    if (readOnlyRef.current) return;
    dirtyRef.current = true;
    setSaveState((s) => (s.kind === 'dirty' ? s : { kind: 'dirty', at: null }));
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistRef.current(), SAVE_DELAY);
  }, []);

  // Sekme gizlenirken ya da sayfa kapanırken bekleyen kayıt kaybolmasın.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      clearTimeout(saveTimerRef.current);
    };
  }, [flush]);

  // Mod değişimi (WO-011): araştırmaya geçerken belge kapanmaz, gizlenir.
  // Gizlenirken bekleyen kayıt yazılır, kaydırma konumu saklanır; geri
  // gelince kaydırma ve imleç yerine konur.
  const scrollRef = useRef(0);
  useLayoutEffect(() => {
    const desk = deskRef.current;
    if (hidden) {
      flush();
      return;
    }
    if (desk && scrollRef.current) desk.scrollTop = scrollRef.current;
    const range = lastRangeRef.current;
    const el = pageRef.current;
    if (range && el && el.contains(range.startContainer)) {
      el.focus({ preventScroll: true });
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [hidden, flush]);

  // --- Sekmeler arası (WO-011 Faz 1 ek) ---------------------------------
  // Görünür sekme taslağın kilidini alır ve tazeler; kilit başkasındaysa
  // salt okunur açılır ("Burada düzenle" ile alabilir). Kilidi kaybeden
  // sekme bekleyen kaydını yazar ve salt okunur olur. Gizlenen (araştırma
  // modundaki) sekme kilidi bırakır.
  const claimRef = useRef(() => {});
  useEffect(() => {
    if (hidden || !draftId || storageDown) {
      claimRef.current = () => {};
      return undefined;
    }
    const claim = () => {
      try {
        const storage = window.localStorage;
        if (lockHolder(readLock(storage, draftId), TAB_ID) === 'other') {
          if (!readOnlyRef.current) {
            // Kaydedilmemiş değişiklik varsa önce yazılır; yoksa yeni sürüm üretilmez.
            if (dirtyRef.current) persistRef.current();
            setReadOnlyBoth(true);
          }
          return;
        }
        writeLock(storage, draftId, TAB_ID);
        if (readOnlyRef.current) {
          setReadOnlyBoth(false);
          loadNewer();
        }
      } catch {
        // Depolama yoksa kilit de yok; kayıt zaten "Kaydedilemedi" der.
      }
    };
    claimRef.current = claim;
    claim();
    const timer = setInterval(claim, LOCK_BEAT);
    const release = () => {
      try { releaseLock(window.localStorage, draftId, TAB_ID); } catch { /* depolama yok */ }
    };
    window.addEventListener('pagehide', release);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [hidden, draftId, storageDown, loadNewer, setReadOnlyBoth]);

  // Başka sekmenin yazdığı içerik ve kilit değişiklikleri.
  useEffect(() => {
    if (!draftId) return undefined;
    const contentKey = `${DRAFT_PREFIX}${draftId}`;
    const onStorage = (e) => {
      if (e.key === contentKey && e.newValue) {
        let stored = null;
        try { stored = JSON.parse(e.newValue); } catch { return; }
        if ((stored?.rev || 0) <= revRef.current) return;
        // Burada da kaydedilmemiş değişiklik varsa kayıt çakışmayı görür ve kopya açar.
        if (dirtyRef.current && !readOnlyRef.current) persistRef.current();
        else applyStored(stored);
      } else if (e.key === lockKey(draftId) || e.key === null) {
        claimRef.current();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [draftId, applyStored]);

  /** "Burada düzenle": kilidi alır; öbür sekme kaydını yazıp salt okunur olur. */
  const takeOver = () => {
    try {
      loadNewer();
      writeLock(window.localStorage, draftId, TAB_ID);
      setReadOnlyBoth(false);
    } catch {
      setStorageDown(true);
    }
  };

  // Depolama yazılamıyorken sayfadan çıkılırsa tarayıcı sorsun.
  useEffect(() => {
    if (!storageDown) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [storageDown]);

  const onInput = () => {
    markDirty();
    scan();
    setResume(null);
  };

  const exec = (command, value = null) => {
    pageRef.current?.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      // Komut desteklenmiyorsa biçim uygulanmaz; belge bozulmaz.
    }
    onInput();
  };

  const changeView = (next) => {
    userNavRef.current = false;
    setView(next);
    markDirty();
  };

  // Sayfa ayarı yalnız teslim önizlemesinde görünür; değiştiren kullanıcı
  // sonucu görsün diye o görünüme geçilir.
  const updateSetup = (patch) => {
    setSetup((s) => ({ ...s, ...patch }));
    setView('submit');
    markDirty();
  };

  /** Biçim değişimi planı: FormatPicker kaç bölüm ekleneceğini gösterir. */
  const planFor = useCallback((templateId) => planFormatChange(
    describeHeadings(pageRef.current), TEMPLATES.find((x) => x.id === templateId), t, isReferencesHeading,
  ), [t]);

  /**
   * Biçimi değiştirir (WO-011 Faz 1). Metin silinmez: eksik bölümler şablon
   * sırasındaki yerlerine eklenir; boş ve yeni biçimde olmayan bölümler ancak
   * kullanıcı onaylarsa kaldırılır. Sayfa ayarları ve atıf stili de değişir.
   */
  const applyFormat = ({ formatId, templateId, bibFormat: nextStyle, setup: nextSetup }) => {
    const el = pageRef.current;
    const template = TEMPLATES.find((x) => x.id === templateId);
    setFmtOpen(false);
    if (!el || !template) return;
    const plan = planFor(templateId);
    // Bölümler kimlikle eşlenir; kimliği olmayan eski belgede adla.
    const nodeByKey = new Map();
    for (const h of describeHeadings(el)) {
      const key = h.key || template.sections.find((s) => t(`workspace.section.${s.key}`).trim().toLocaleLowerCase('tr') === h.text.toLocaleLowerCase('tr'))?.key;
      if (key && !nodeByKey.has(key)) nodeByKey.set(key, h.node);
    }

    for (const section of plan.add) {
      const at = template.sections.findIndex((s) => s.key === section.key);
      const next = template.sections.slice(at + 1).map((s) => nodeByKey.get(s.key)).find(Boolean);
      const nodes = [...document.createRange().createContextualFragment(templateHtml({ sections: [section] }, t)).childNodes];
      for (const node of nodes) (next ? next.before(node) : el.appendChild(node));
      if (nodes[0]) nodeByKey.set(section.key, nodes[0]);
    }

    if (plan.removable.length) {
      const names = plan.removable.map((h) => h.text).join(', ');
      if (window.confirm(t('workspace.format.removeAsk', { n: plan.removable.length, names }))) {
        // Plan, kendi içeriği boş ve alt bölümü olmayan bölümleri seçti; yine de
        // kaldırmadan hemen önce yeniden bakılır (arada metin yazılmış olabilir).
        for (const h of plan.removable) {
          const heading = h.node;
          if (!heading?.isConnected) continue;
          const run = [];
          for (let n = heading.nextElementSibling; n && !/^H[1-3]$/.test(n.tagName); n = n.nextElementSibling) run.push(n);
          const next = run.length ? run[run.length - 1].nextElementSibling : heading.nextElementSibling;
          if (run.some((n) => n.textContent.trim() || n.querySelector('img, table'))) continue;
          if (next && /^H[1-3]$/.test(next.tagName) && Number(next.tagName[1]) > Number(heading.tagName[1])) continue;
          run.forEach((n) => n.remove());
          heading.remove();
        }
      }
    }

    setSetup((s) => ({ ...s, ...nextSetup }));
    setBibFormat(nextStyle);
    setFormat(formatId);
    onInput();
  };

  /** Şablon belgeyi değiştirir; metin varsa önce sorar (§8, CLAUDE.md 2.9). */
  const applyTemplate = (id) => {
    const el = pageRef.current;
    const template = TEMPLATES.find((x) => x.id === id);
    if (!el || !template) return;
    if (el.textContent.trim() && !window.confirm(t('workspace.templateReplace'))) return;
    if (template.setup) setSetup((s) => ({ ...s, ...template.setup }));
    el.innerHTML = templateHtml(template, t);
    lastRangeRef.current = null;
    closeMenu();
    onInput();
    // Yeni bölüm ağacı görünsün; dar ekranda gezgin belgeyi örtmesin.
    if (mediaMatches(MEDIUM)) setNavPanel('sections');
  };

  const goToSection = (index) => {
    const el = pageRef.current;
    const heading = el?.querySelectorAll('h1, h2, h3')[index];
    if (!heading) return;
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(heading);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const smooth = !mediaMatches('(prefers-reduced-motion: reduce)');
    heading.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
    if (!mediaMatches(MEDIUM)) setNavPanel(null);
  };

  // --- Belge yapısı işlemleri (WO-011 Faz 2) ------------------------------
  // Bölüm = başlık + kendisinden düşük seviyeli olmayan bir sonraki başlığa
  // kadar her blok (alt bölümler dahil). Taşıma düğümleri taşır, metin silmez.
  const headingNodes = () => [...(pageRef.current?.children || [])].filter((n) => /^H[1-3]$/.test(n.tagName));
  const sectionNodes = (heading) => {
    const level = Number(heading.tagName[1]);
    const out = [heading];
    for (let n = heading.nextElementSibling; n; n = n.nextElementSibling) {
      if (/^H[1-3]$/.test(n.tagName) && Number(n.tagName[1]) <= level) break;
      out.push(n);
    }
    return out;
  };

  /** Bölümü (içeriği ve alt bölümleriyle) hedef başlığın önüne taşır. */
  const moveSection = (from, before) => {
    const hs = headingNodes();
    const source = hs[from];
    const target = hs[before];
    if (!source || !target || source === target) return;
    const nodes = sectionNodes(source);
    if (nodes.includes(target)) return;
    for (const node of nodes) target.before(node);
    setCurrentSection(-1);
    onInput();
  };

  /** Klavye ile taşıma: aynı seviyedeki komşuyla yer değiştirir; üst bölümden çıkmaz. */
  const stepSection = (index, dir) => {
    const hs = headingNodes();
    const self = hs[index];
    if (!self) return;
    const level = Number(self.tagName[1]);
    if (dir < 0) {
      for (let j = index - 1; j >= 0; j -= 1) {
        const l = Number(hs[j].tagName[1]);
        if (l < level) return;
        if (l === level) { moveSection(index, j); return; }
      }
      return;
    }
    const end = sectionNodes(self);
    const next = hs.find((h, j) => j > index && !end.includes(h));
    if (!next || Number(next.tagName[1]) !== level) return;
    moveSection(hs.indexOf(next), index);
  };

  const renameSection = (index, text) => {
    const heading = headingNodes()[index];
    if (!heading) return;
    heading.textContent = text;
    onInput();
  };

  /** Yeni bölüm: belgedeki üst seviyede, Kaynakça'dan önce; adı hemen düzenlenir. */
  const addSection = () => {
    const el = pageRef.current;
    if (!el) return;
    const hs = headingNodes();
    const level = hs.length ? Math.min(...hs.map((h) => Number(h.tagName[1]))) : 1;
    const heading = document.createElement(`h${level}`);
    heading.textContent = t('workspace.outlineNav.newSection');
    const para = document.createElement('p');
    para.appendChild(document.createElement('br'));
    const refs = hs.find((h) => isReferencesHeading(h.textContent));
    if (refs) { refs.before(heading); refs.before(para); } else { el.append(heading, para); }
    onInput();
    setRenamingSection(headingNodes().indexOf(heading));
    heading.scrollIntoView({ block: 'center' });
  };

  /** Kullanıcı kararı sınıflandırıcıyı ezer; `null` otomatik karara döner. */
  const setOverride = (key, value) => {
    const next = { ...overridesRef.current };
    if (value) next[key] = value;
    else delete next[key];
    overridesRef.current = next;
    scan();
    markDirty();
  };

  const goToSentence = (id) => {
    const s = sentencesRef.current[id];
    if (!s?.block?.isConnected) return;
    const range = rangeForOffsets(s.block, s.start, s.end);
    if (!range) return;
    pageRef.current.focus({ preventScroll: true });
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const smooth = !mediaMatches('(prefers-reduced-motion: reduce)');
    s.block.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    // Dar ekranda panel belgeyi örter; gösterilen cümle görünsün.
    if (!mediaMatches(WIDE)) setSideOpen(false);
  };

  const openReview = (kind) => {
    setReview((r) => (r === kind ? null : kind));
    // Tıklamada çalışır; o an aşağıdaki tanım hazırdır.
    openSidePanel();
  };

  const resumeWork = () => {
    const el = pageRef.current;
    if (!el || !resume) return;
    const headings = [...el.querySelectorAll('h1, h2, h3')];
    const byText = headings.findIndex((h) => h.textContent.trim() === resume.text);
    const index = byText >= 0 ? byText : resume.index;
    setResume(null);
    if (index >= 0 && index < headings.length) goToSection(index);
  };

  /**
   * Bloğu imlecin bulunduğu paragrafın altına koyar. İmleç boş bir
   * paragraftaysa (ör. şablonun rehber satırı) onun yerine geçer. İmleç
   * belgede hiç olmadıysa sona eklenir.
   */
  const insertBlock = (block) => {
    const el = pageRef.current;
    if (!el) return;
    const range = lastRangeRef.current;
    const anchor = range && el.contains(range.startContainer) ? topBlock(el, range.startContainer) : null;
    if (anchor && anchor.tagName === 'P' && !anchor.textContent.trim()) anchor.replaceWith(block);
    else if (anchor) anchor.after(block);
    else el.appendChild(block);

    const after = document.createRange();
    after.selectNodeContents(block);
    after.collapse(false);
    lastRangeRef.current = after;

    block.classList.add('wx-flash');
    window.setTimeout(() => {
      block.classList.remove('wx-flash');
      if (!block.getAttribute('class')) block.removeAttribute('class');
    }, FLASH_MS);
    block.scrollIntoView({ block: 'nearest' });
    onInput();
  };

  /**
   * Tek pasajdan tek cümle (CLAUDE.md 2.2, 3.1). Modele yalnız özet gider;
   * atıf dizgesi burada, doğrulanmış kayıttan kurulur.
   *
   * mode: 'first' ana bulgu · 'similar' aynı bulgu, farklı cümle · 'new'
   * pasajdaki başka bir bulgu. Sunucu her cümleyi pasaja karşı denetler ve
   * destek sınıfını döndürür (2.2 kural 2). Ret, elindeki cümleyi silmez.
   */
  const makeSentence = async (paper, key, mode = 'first') => {
    const passage = (paper.description || '').trim();
    if (!passage) return;
    const previous = mode === 'first' ? [] : (drafts[key]?.history || []);
    // "Benzeri" yalnız mevcut cümlenin dayandığı parçadan kurulur; sunucu parçayı yeniden doğrular.
    const focus = mode === 'similar' && drafts[key]?.support?.spanVerified ? drafts[key].support.span : '';
    setDrafts((d) => ({ ...d, [key]: { ...(mode === 'first' ? {} : d[key]), loading: mode, notice: '' } }));
    try {
      const token = await getTokenRef.current();
      const { data } = await axios.post(`${apiUrl}/api/cited-sentence`,
        { passage, topic: title, mode, previous, focus },
        { headers: { Authorization: `Bearer ${token}` } });
      if (data?.refused) {
        setDrafts((d) => ({ ...d, [key]: { ...d[key], loading: false, notice: t(refusalKey(data.reason)) } }));
        return;
      }
      setDrafts((d) => ({
        ...d,
        [key]: {
          sentence: data.sentence,
          citation: inlineCitation(paper, lang),
          passage,
          support: data.support || null,
          // Sunucuya "bunları tekrarlama" diye giden geçmiş; en fazla 5.
          history: [...(d[key]?.history || []), data.sentence].slice(-5),
          loading: false,
          notice: '',
        },
      }));
    } catch (err) {
      setDrafts((d) => ({ ...d, [key]: { ...d[key], loading: false, notice: err.response?.data?.error || t('search.failed') } }));
    }
  };

  /** Eklenen şey üretilmiş cümle + atıf; pasaj değil. */
  const insertSentence = (key) => {
    const draft = drafts[key];
    if (!draft?.sentence) return;
    const p = document.createElement('p');
    p.textContent = `${draft.sentence} ${draft.citation}`;
    insertBlock(p);
    setDrafts((d) => ({ ...d, [key]: { ...d[key], inserted: true } }));
  };

  /** Pasaj hiçbir koşulda tırnaksız ve atıfsız belgeye girmez. */
  const insertQuote = (paper, key) => {
    const passage = drafts[key]?.passage || (paper.description || '').trim();
    if (!passage) return;
    const q = document.createElement('blockquote');
    q.textContent = `“${passage}” ${inlineCitation(paper, lang)}`;
    insertBlock(q);
  };

  /**
   * Kaynakçayı belgeye yazar (CLAUDE.md 2.9: yalnız kullanıcı tıklamasıyla).
   * Kaynakça başlığı varsa altındaki bölüm değiştirilir; elle yazılmış
   * paragraf varsa önce sorulur. Başlık yoksa belgenin sonuna eklenir.
   */
  const writeBibliography = () => {
    const el = pageRef.current;
    const texts = bib.entries.map((e) => e.text || fallbackReference(e.key)).filter(Boolean);
    if (!el || !texts.length) return;

    let heading = [...el.children].find((b) => /^H[1-3]$/.test(b.tagName) && isReferencesHeading(b.textContent));
    if (!heading) {
      heading = document.createElement(el.querySelector('h1') ? 'h1' : 'h2');
      heading.textContent = t('workspace.section.references');
      el.appendChild(heading);
    }
    const level = Number(heading.tagName[1]);
    const section = [];
    for (let n = heading.nextElementSibling; n && !(/^H[1-3]$/.test(n.tagName) && Number(n.tagName[1]) <= level); n = n.nextElementSibling) {
      section.push(n);
    }
    const known = new Set(lastBibRef.current);
    const foreign = section.filter((b) => b.textContent.trim() && !known.has(b.textContent.trim()));
    if (foreign.length && !window.confirm(t('workspace.bib.replaceConfirm', { n: foreign.length }))) return;

    section.forEach((b) => b.remove());
    let after = heading;
    for (const text of texts) {
      const p = document.createElement('p');
      // Yalnız asılı girinti için; içerik kararı bu özniteliğe bağlı değil.
      p.setAttribute('data-bib', '');
      p.textContent = text;
      after.after(p);
      after = p;
    }
    lastBibRef.current = texts;
    heading.scrollIntoView({ block: 'start', behavior: mediaMatches('(prefers-reduced-motion: reduce)') ? 'auto' : 'smooth' });
    onInput();
  };

  // --- Zotero / Mendeley / EndNote dosyasından aktarma -------------------
  // Dosya sunucuda ayrıştırılır (server/services/referenceImport.js); gelen
  // kayıtlardan hangileri sepete girecek kullanıcıya kalır (CLAUDE.md 2.9).
  // Künye dosyadan geldiği gibi okunur, doğrulanmış kayıt değil: DOI'si
  // olanlar kaynakça üretilirken doi.org'dan tazelenir (2.8).

  const readImportFile = async (file) => {
    if (!file) return;
    setImp({ status: 'reading', picked: {} });
    let text = '';
    try {
      text = await file.text();
    } catch {
      setImp({ status: 'error', error: t('workspace.imp.failed'), picked: {} });
      return;
    }
    try {
      const token = await getTokenRef.current();
      const { data } = await axios.post(`${apiUrl}/api/references/import`, { text }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Sepette olan kayıtlar işaretli gelir: seçilemezler, ama görünür
      // kalırlar ki kullanıcı dosyanın tamamını gördüğünü bilsin.
      const entries = (data.entries || []).map((e) => ({ ...e, inBasket: basket.has(e) }));
      setImp({
        status: 'ready',
        format: data.format,
        entries,
        total: data.total || 0,
        skipped: data.skipped || 0,
        picked: {},
      });
    } catch (err) {
      setImp({ status: 'error', error: err.response?.data?.error || t('workspace.imp.failed'), picked: {} });
    }
  };

  const openImport = () => {
    setImp({ status: 'idle', picked: {} });
    if (!mediaMatches(MEDIUM)) setNavPanel(null);
  };

  const togglePick = (id) => setImp((s) => {
    const picked = { ...s.picked };
    if (picked[id]) delete picked[id];
    else picked[id] = true;
    return { ...s, picked };
  });

  /** Sepete eklenen kayıtlar tek tek gider: biri reddedilirse diğerleri girer. */
  const addPicked = async () => {
    const chosen = imp.entries.filter((e) => imp.picked[e.id]);
    if (!chosen.length) return;
    setImp((s) => ({ ...s, status: 'adding' }));
    let added = 0;
    let failed = 0;
    for (const entry of chosen) {
      // Sırayla: sepet sınırı her eklemede yeniden okunuyor (useBasket).
      const result = await basket.add({
        title: entry.title,
        creator: entry.creator,
        year: entry.year,
        publicationName: entry.publicationName,
        volume: entry.volume,
        issue: entry.issue,
        pages: entry.pages,
        doi: entry.doi,
        url: entry.url,
        description: entry.description,
        // Kaydın nereden geldiği kaybolmasın: doğrulanmış kaynak değil.
        source: entry.doi ? `${imp.format}+doi` : imp.format,
      });
      if (result.ok) added += 1;
      else failed += 1;
    }
    setImp((s) => ({ ...s, status: 'done', added, failed }));
  };

  /** Cümleyi bulur, seçer, ortalar ve bir an vurgular. Bulunamazsa false. */
  const revealSentenceKey = (key) => {
    const s = sentencesRef.current.find((x) => x.key === key);
    if (!s) return false;
    goToSentence(s.id);
    s.block.classList.add('wx-flash');
    window.setTimeout(() => {
      s.block.classList.remove('wx-flash');
      if (!s.block.getAttribute('class')) s.block.removeAttribute('class');
    }, FLASH_MS);
    return true;
  };

  const exportWord = async () => {
    closeMenu();
    const { exportDocx } = await import('./exportDocument.js');
    await exportDocx({ root: pageRef.current, setup, title: title || t('workspace.untitled') });
  };

  const printDocument = () => {
    closeMenu();
    window.print();
  };

  // --- Kabuk köprüsü (WO-010) ------------------------------------------
  // Komutlar her render'da tazelenir: kapanışlar en son durumu görsün.
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      /** Cümleyi bulur, seçer ve ortalar. Bulunamazsa false. */
      goToSentenceKey: revealSentenceKey,
      /** Sağ panelde Kontrol sekmesini açar (`#/yazar/kontrol`). */
      openCheck: () => {
        setReview(null);
        setSideView('check');
        openSidePanel();
      },
      goToSection,
      setView: (v) => { setView(v); markDirty(); },
      exportWord,
      print: printDocument,
      openImport,
      flush,
      /** Depoda daha yeni sürüm varsa (ör. kenar çubuğundan yeniden adlandırma) yükler. */
      reload: loadNewer,
      openBibliography: () => {
        setReview(null);
        setSideView('bib');
        openSidePanel();
      },
    };
  });

  // Belgenin özeti: Denetim modülü bundan çalışır, DOM'a dokunmaz.
  useEffect(() => {
    if (!onSnapshot) return;
    onSnapshot({
      title,
      isEmpty,
      saveState: saveState.kind,
      setup,
      outline,
      sentences,
      blocks,
      refs,
      match,
      papers: basket.papers,
    });
  }, [onSnapshot, title, isEmpty, saveState.kind, setup, outline, sentences, blocks, refs, match, basket.papers]);

  // --- Kontrol (WO-011 Faz 3) -----------------------------------------
  // Eski Denetim ekranının kuralları (audit/audit.js) burada yazarken canlı
  // çalışır. Yazarken boş bölüm Bilgi; "Teslime hazırla" teslim aşamasıyla
  // çalışır, orada zorunlu boş bölüm Uyarı olur.
  const auditInput = useMemo(() => ({
    sentences, blocks, outline, refs, match, papers: basket.papers, setup,
  }), [sentences, blocks, outline, refs, match, basket.papers, setup]);
  const checkVisible = !hidden && ((sideOpen && sideView === 'check' && !review) || prepOpen);

  // Geri çekme durumu Kontrol görünürken canlı sorulur (CLAUDE.md 3.4:
  // önbelleğe alınmaz). Cevap gelmeyen kaynak "bilinmiyor" sayılır.
  const doiKey = citedDois(auditInput).slice(0, MAX_RETRACTION_DOIS).join('|');
  const retractionPending = Boolean(checkVisible && doiKey && retraction.key !== doiKey);
  useEffect(() => {
    if (!checkVisible || !doiKey || retraction.key === doiKey) return undefined;
    const controller = new AbortController();
    (async () => {
      try {
        const token = await getToken();
        const { data } = await axios.post(`${apiUrl}/api/retractions`, { dois: doiKey.split('|') }, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        setRetraction({ byDoi: data?.results || {}, failed: Boolean(data?.failed), key: doiKey });
      } catch (err) {
        if (axios.isCancel(err)) return;
        setRetraction({ byDoi: null, failed: true, key: doiKey });
      }
    })();
    return () => controller.abort();
  }, [checkVisible, doiKey, retraction.key, apiUrl, getToken]);

  const retractionOptions = retraction.key === doiKey
    ? { retractions: retraction.byDoi, retractionFailed: retraction.failed }
    : {};
  const checkItems = useMemo(
    () => runAudit(auditInput, { ...retractionOptions, stage: 'draft' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retractionOptions her render'da yeni nesne; içeriği retraction ve doiKey'den
    [auditInput, retraction, doiKey],
  );
  const prepItems = useMemo(
    () => (prepOpen ? runAudit(auditInput, { ...retractionOptions, stage: 'submit' }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yukarıdakiyle aynı
    [prepOpen, auditInput, retraction, doiKey],
  );

  // Bölüm numaraları ("2.3"): belgedeki en üst başlık seviyesi 1 sayılır.
  const sectionNumbers = useMemo(() => {
    const list = outline.headings;
    if (!list.length) return [];
    const base = Math.min(...list.map((h) => h.level));
    const counters = [];
    return list.map((h) => {
      const depth = h.level - base;
      counters[depth] = (counters[depth] || 0) + 1;
      counters.length = depth + 1;
      return counters.map((n) => n || 1).join('.');
    });
  }, [outline.headings]);

  /** Maddenin belgedeki yeri: "Bölüm 2.3 · Paragraf 3". */
  const locateItem = useCallback((item) => {
    const target = item.target;
    if (target?.kind === 'section') {
      const n = sectionNumbers[target.index];
      return n ? t('audit.location.section', { section: n }) : null;
    }
    if (target?.kind !== 'sentence') return null;
    const s = sentencesRef.current.find((x) => x.key === target.key);
    const el = pageRef.current;
    if (!s?.block || !el) return null;
    let heading = -1;
    let paragraph = 0;
    for (const child of el.children) {
      if (/^H[1-3]$/.test(child.tagName)) {
        heading += 1;
        paragraph = 0;
        continue;
      }
      if (child.textContent.trim()) paragraph += 1;
      if (child === s.block) break;
    }
    return heading < 0
      ? t('audit.location.preamble', { p: paragraph })
      : t('audit.location.paragraph', { section: sectionNumbers[heading] || heading + 1, p: paragraph });
  }, [sectionNumbers, t]);

  /** Belge yapısının "Tablolar ve şekiller" bölümü: "Tablo N." / "Şekil N:" satırları. */
  const captions = useMemo(() => blocks.filter((b) => captionOf(b.text)).map((b) => ({ key: b.key, text: b.text.slice(0, 80) })), [blocks]);

  /** "İddia değil" diye işaretlenmiş cümleler: Kontrol'de "Susturulanlar". */
  const mutedSentences = useMemo(() => {
    const seen = new Set();
    return sentences.filter((s) => {
      if (!s.overridden || s.mark !== MARK.notClaim || seen.has(s.key)) return false;
      seen.add(s.key);
      return true;
    }).map((s) => ({ key: s.key, text: s.text }));
  }, [sentences]);

  /** Kontrol satırındaki eylemler. */
  const onCheckAction = (action, item) => {
    const target = item.target;
    if (action === 'reveal' && target?.key) revealSentenceKey(target.key);
    else if (action === 'section' && Number.isInteger(target?.index)) goToSection(target.index);
    else if (action === 'bib') {
      setReview(null);
      setSideView('bib');
      openSidePanel();
    } else if (action === 'sources' || action === 'addSource') {
      setReview(null);
      setSideView('list');
      openSidePanel();
    } else if (action === 'notClaim' && target?.key) setOverride(target.key, OVERRIDE.notClaim);
  };

  // `#/yazar/kontrol` (ve eski `#/denetim`) Kontrol sekmesini açar.
  useEffect(() => {
    if (panelRequest?.panel !== 'check') return;
    setReview(null);
    setSideView('check');
    setSideOpen(true);
  }, [panelRequest]);

  // Kenar işaretleri: hata ve uyarı taşıyan cümlenin bloğunun sağ kenarında.
  // Konum sayfanın kendi (ölçeksiz) koordinatında; Teslim görünümündeki zoom
  // işaretleri de sayfayla birlikte ölçekler.
  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el || hidden) return;
    const byBlock = new Map();
    for (const item of marginItems(checkItems)) {
      const s = sentencesRef.current.find((x) => x.key === item.target.key);
      if (!s?.block?.isConnected) continue;
      const entry = byBlock.get(s.block);
      if (!entry) byBlock.set(s.block, { item, severity: item.severity, n: 1 });
      else {
        entry.n += 1;
        if (item.severity === 'critical') entry.severity = 'critical';
      }
    }
    const left = el.offsetLeft + el.offsetWidth - 16;
    const next = [...byBlock.entries()].map(([block, entry]) => ({
      id: entry.item.id,
      rule: entry.item.rule,
      title: t(`audit.rule.${entry.item.rule}.title`, {
        ...entry.item.params,
        kind: entry.item.params?.kind ? t(`audit.kind.${entry.item.params.kind}`) : '',
      }) + (entry.n > 1 ? ` (+${entry.n - 1})` : ''),
      severity: entry.severity,
      n: entry.n,
      top: block.offsetTop,
      height: block.offsetHeight,
      left,
    }));
    setMarkers((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [checkItems, hidden, view, setup, zoomMode, deskWidth, sideOpen, navPanel, t]);

  const openMarker = (marker) => {
    setReview(null);
    setSideView('check');
    openSidePanel();
    setCheckFocus((f) => ({ id: marker.id, tick: f.tick + 1 }));
  };

  /** "Teslime hazırla" › Dışa aktar. Başarı mesajı yok: indirme tarayıcıda görünür. */
  const exportFor = (choice) => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (choice === 'docx') exportWord();
    else if (choice === 'print') printDocument();
    else if (choice === 'bibtex' && basket.papers.length) downloadText(`literatur-ai_kaynakca_${stamp}.bib`, toBibTeX(basket.papers), 'application/x-bibtex');
    else if (choice === 'ris' && basket.papers.length) downloadText(`literatur-ai_kaynakca_${stamp}.ris`, toRIS(basket.papers), 'application/x-research-info-systems');
  };

  const toggleNav = (panel) => {
    userNavRef.current = navPanel !== panel;
    setNavPanel((p) => (p === panel ? null : panel));
  };

  // A4 %100 kuralı (Faz 2): Teslim görünümünde sayfa masaya sığmıyorsa sol
  // panel kapanır; sayfa küçülmez. Kullanıcı paneli kendisi açtıysa dokunulmaz.
  useLayoutEffect(() => {
    if (hidden || view !== 'submit' || zoomMode !== 'actual' || !navPanel || userNavRef.current) return;
    const desk = deskRef.current;
    if (!desk) return;
    const need = pageGeometry(setup).width * MM_TO_PX + DESK_GUTTER;
    if (desk.clientWidth < need) setNavPanel(null);
  }, [hidden, view, zoomMode, navPanel, sideOpen, setup, deskWidth]);

  // Kaydırınca aktif bölüm: masanın üstüne en yakın geçmiş başlık (Faz 2).
  const trackFrame = useRef(0);
  const trackSection = () => {
    cancelAnimationFrame(trackFrame.current);
    trackFrame.current = requestAnimationFrame(() => {
      const desk = deskRef.current;
      if (!desk) return;
      const top = desk.getBoundingClientRect().top + 80;
      let index = -1;
      headingNodes().forEach((h, i) => { if (h.getBoundingClientRect().top <= top) index = i; });
      setCurrentSection((c) => (c === index ? c : Math.max(index, 0)));
    });
  };

  // Sayfa x / y (yaklaşık): Teslim görünümünde kağıt yüksekliğinden hesaplanır.
  const measurePages = useCallback(() => {
    const desk = deskRef.current;
    const el = pageRef.current;
    if (!desk || !el || view !== 'submit') return;
    const pageH = pageGeometry(setup).height * MM_TO_PX;
    const scale = zoomMode === 'fit' ? Math.min(1, (deskWidth || 1) / (pageGeometry(setup).width * MM_TO_PX)) : 1;
    const n = Math.max(1, Math.ceil(el.scrollHeight / pageH));
    const i = Math.min(n, Math.floor(desk.scrollTop / (pageH * scale)) + 1);
    setPageInfo((p) => (p.i === i && p.n === n ? p : { i, n }));
  }, [view, setup, zoomMode, deskWidth]);
  useEffect(() => { measurePages(); }, [measurePages, outline.words]);

  /**
   * Sağ panel açılır. Sayfa sığmayacaksa önce belge ağacı kapanır; sayfa
   * küçültülmez (WO-010 yerleşim kuralı, tasarım brief'i §2). Ağaç kullanıcı
   * isterse yine açılır; o zaman Teslim görünümü "sığdır" ölçeğine geçer.
   * 1280 px altında panel zaten üstü örten katman: yer kaplamaz.
   */
  const openSidePanel = () => {
    if (!sideOpen && navPanel && mediaMatches(WIDE)) {
      const deskWidth = deskRef.current?.clientWidth || 0;
      const pageWidth = view === 'submit' ? pageGeometry(setup).width * MM_TO_PX : DRAFT_MIN_PX;
      if (deskWidth - SIDE_W < pageWidth + DESK_GUTTER) setNavPanel(null);
    }
    setSideOpen(true);
  };

  const openSource = (key) => {
    setActiveSource(key);
    setSideView('source');
    openSidePanel();
    if (!mediaMatches(MEDIUM)) setNavPanel(null);
  };

  /** İmlecin yerine (ya da seçimin sonuna) aktif kaynağın metin içi atfı. */
  const insertCitation = () => {
    const el = pageRef.current;
    const current = basket.papers.find((p, i) => sourceKey(p, i) === activeSource);
    if (!el || !current) {
      setSideView('list');
      openSidePanel();
      return;
    }
    const sel = window.getSelection();
    const live = sel && sel.rangeCount && el.contains(sel.getRangeAt(0).startContainer) ? sel.getRangeAt(0) : null;
    const range = (live || lastRangeRef.current)?.cloneRange();
    if (!range || !el.contains(range.startContainer)) return;
    range.collapse(false);
    // Önceki karakter boşluk değilse araya boşluk konur: "kaynaklar(Kaya, 2020)" olmasın.
    const before = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.textContent.slice(0, range.startOffset)
      : '';
    const text = `${/\s$/.test(before) || !before ? '' : ' '}${inlineCitation(current, lang)}`;
    const node = document.createTextNode(text);
    range.insertNode(node);
    const after = document.createRange();
    after.setStartAfter(node);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    lastRangeRef.current = after.cloneRange();
    setSelBar(null);
    onInput();
  };

  /** Seçimin başladığı cümlenin iddia kararını tersine çevirir (§5). */
  const toggleClaimAtSelection = () => {
    const el = pageRef.current;
    const sel = window.getSelection();
    if (!el || !sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const block = topBlock(el, range.startContainer);
    if (!block) return;
    const probe = document.createRange();
    probe.selectNodeContents(block);
    probe.setEnd(range.startContainer, range.startOffset);
    const offset = probe.toString().length;
    const target = sentencesRef.current.find((s) => s.block === block && offset >= s.start && offset <= s.end);
    if (!target) return;
    setOverride(target.key, target.mark === MARK.notClaim ? OVERRIDE.claim : OVERRIDE.notClaim);
    setSelBar(null);
  };

  /** Dar ekranda üstü örten paneller arka plana tıklayınca kapanır. */
  const closeOverlays = () => {
    if (!mediaMatches(WIDE)) setSideOpen(false);
    if (!mediaMatches(MEDIUM)) setNavPanel(null);
  };

  const geometry = pageGeometry(setup);
  // Teslim görünümü ölçeği: "sığdır" sayfayı masaya sığacak kadar küçültür,
  // asla büyütmez; "gerçek boyut" 1:1 (CSS 96 dpi — ekrandaki %100, fiziksel
  // boyut değildir; brief bunu ayrıca vurguluyor).
  const fitScale = deskWidth > 0 ? Math.min(1, deskWidth / (geometry.width * MM_TO_PX)) : 1;
  const zoomScale = view === 'submit' && zoomMode === 'fit' ? Math.round(fitScale * 1000) / 1000 : 1;
  const paperIndex = basket.papers.findIndex((p, i) => sourceKey(p, i) === activeSource);
  const paper = paperIndex >= 0 ? basket.papers[paperIndex] : null;
  const draft = paper ? drafts[activeSource] : null;
  const passage = (paper?.description || '').trim();
  const draftLabel = supportLabel(draft?.support);
  const draftSettled = isSettled(draft?.support);
  const spanRange = draft?.sentence && draft.support?.spanVerified ? locateSpan(passage, draft.support.span) : null;
  const stepSource = (delta) => {
    const n = basket.papers.length;
    if (n < 2) return;
    const next = (paperIndex + delta + n) % n;
    setActiveSource(sourceKey(basket.papers[next], next));
  };

  const time = saveState.at?.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const save = {
    dirty: { icon: '○', text: t('workspace.saveDirty') },
    local: { icon: '◐', text: time ? t('workspace.saveLocal', { time }) : t('workspace.saveLocalShort') },
    failed: { icon: '○', text: t('workspace.saveNone') },
  }[saveState.kind];

  const bodyClass = ['wx-body', navPanel && 'is-nav-open', sideOpen && 'is-side-open'].filter(Boolean).join(' ');

  const citedCount = bibPapers.length;
  const flagged = bibPapers.filter((c) => ['retracted', 'concern'].includes(retractions.byDoi[normDoi(c.paper.doi)]?.status));
  const unknownCount = bibPapers.filter((c) => c.paper.doi && retractions.byDoi[normDoi(c.paper.doi)]?.status === 'unknown').length;
  const bibView = (
    <section className="wx-bib" aria-label={t('workspace.bib.title')}>
      <div className="wx-bib__head">
        <strong>{t('workspace.bib.title')}</strong>
        <select className="wx-sel" value={bibFormat} onChange={(e) => { setBibFormat(e.target.value); markDirty(); }} aria-label={t('workspace.bib.style')}>
          {BIB_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div className="wx-bib__scope" role="group" aria-label={t('workspace.bib.scopeLabel')}>
        <div className="wx-seg wx-seg--sm">
          <button type="button" aria-pressed={bibScope === 'cited'} onClick={() => { setBibScope('cited'); markDirty(); }}>
            {t('workspace.bib.scopeCited', { n: fmt(match.cited.length) })}
          </button>
          <button type="button" aria-pressed={bibScope === 'all'} onClick={() => { setBibScope('all'); markDirty(); }}>
            {t('workspace.bib.scopeAll', { n: fmt(basket.papers.length) })}
          </button>
        </div>
        <small className="wx-muted">{t(`workspace.bib.scopeHint.${bibScope}`)}</small>
      </div>

      {citedCount === 0 ? (
        <p className="wx-muted">{t(bibScope === 'all' ? 'workspace.bib.noneAll' : 'workspace.bib.none')}</p>
      ) : (
        <>
          <p className="wx-muted">{t(bibScope === 'all' ? 'workspace.bib.leadAll' : 'workspace.bib.lead', { n: fmt(citedCount) })}</p>
          {bib.status === 'loading' && <p className="wx-muted">{t('workspace.bib.loading')}</p>}
          {bib.status === 'error' && <p className="wx-warn">{bib.error || t('workspace.bib.failed')}</p>}
          {bib.status === 'ready' && (
            <ol className="wx-bib__list">
              {bib.entries.map((e) => (
                <li key={e.key}>
                  <p>{e.text || fallbackReference(e.key)}</p>
                  <span className="wx-tag">{t(`workspace.bib.from.${e.text ? e.source : 'fallback'}`)}</span>
                </li>
              ))}
            </ol>
          )}
          {bibFormat !== 'APA 7' && <p className="wx-muted">{t('workspace.bib.inTextNote')}</p>}
          <div className="wx-acts">
            <button type="button" className="wx-act wx-act--primary" onClick={writeBibliography} disabled={bib.status !== 'ready'}>
              {t('workspace.bib.write')}
            </button>
          </div>
        </>
      )}

      <div className="wx-bib__checks">
        <strong>{t('workspace.bib.checksTitle')}</strong>
        {match.orphans.length > 0 && (
          <div className="wx-check">
            <p className="wx-warn">{t('workspace.bib.orphans', { n: fmt(match.orphans.length) })}</p>
            <ul>{match.orphans.map((o) => <li key={o}>“{o}”</li>)}</ul>
            <small className="wx-muted">{t('workspace.bib.orphansHint')}</small>
          </div>
        )}
        {flagged.length > 0 && (
          <div className="wx-check">
            <p className="wx-warn">{t('workspace.bib.flagged', { n: fmt(flagged.length) })}</p>
            <ul>
              {flagged.map((c) => (
                <li key={c.key}>
                  <strong>{t(`workspace.bib.status.${retractions.byDoi[normDoi(c.paper.doi)].status}`)}</strong> · {c.paper.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(retractions.failed || unknownCount > 0) && (
          <p className="wx-muted">{t('workspace.bib.retractionUnknown', { n: fmt(unknownCount) })}</p>
        )}
        {/* "Sepetteki tümü" seçiliyken atıfsız kaynak kaynakçaya giriyor: uyarı yanıltıcı olur. */}
        {bibScope === 'cited' && match.uncited.length > 0 && (
          <div className="wx-check">
            <p className="wx-muted">{t('workspace.bib.uncited', { n: fmt(match.uncited.length) })}</p>
            <ul>{match.uncited.map((i) => <li key={sourceKey(basket.papers[i], i)}>{basket.papers[i].title}</li>)}</ul>
          </div>
        )}
        {citedCount > 0 && !match.orphans.length && !flagged.length && (bibScope === 'all' || !match.uncited.length) && !unknownCount && !retractions.failed && (
          <p className="wx-ok"><Check size={14} /> {t('workspace.bib.consistent')}</p>
        )}
        <small className="wx-muted">{t('workspace.bib.numericNote')}</small>
      </div>
    </section>
  );

  // Aktarma penceresi. Seçim sepetin kalan yeriyle sınırlı: sepet dolu
  // olduğunda sessizce kırpmak yerine kaç yer kaldığı söylenir (2.8).
  const room = Math.max(0, basket.limit - basket.papers.length);
  const pickedCount = imp ? Object.keys(imp.picked).length : 0;
  const importView = imp && (
    <div className="wx-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setImp(null); }}>
      <section className="wx-import" role="dialog" aria-modal="true" aria-label={t('workspace.imp.title')}>
        <div className="wx-import__head">
          <strong>{t('workspace.imp.title')}</strong>
          <button type="button" className="wx-icon wx-icon--sm" onClick={() => setImp(null)} aria-label={t('workspace.imp.cancel')}>
            <X size={15} />
          </button>
        </div>

        <div className="wx-import__body">
          {imp.status === 'idle' && (
            <>
              <p className="wx-muted">{t('workspace.imp.lead')}</p>
              <button type="button" className="wx-act wx-act--primary" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> {t('workspace.imp.pick')}
              </button>
            </>
          )}
          {imp.status === 'reading' && <p className="wx-muted">{t('workspace.imp.reading')}</p>}
          {imp.status === 'error' && (
            <>
              <p className="wx-warn">{imp.error}</p>
              <button type="button" className="wx-act" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> {t('workspace.imp.pick')}
              </button>
            </>
          )}
          {imp.status === 'done' && (
            <>
              <p className="wx-ok"><Check size={14} /> {t('workspace.imp.added', { n: fmt(imp.added) })}</p>
              {imp.failed > 0 && <p className="wx-warn">{t('workspace.imp.someFailed', { n: fmt(imp.failed) })}</p>}
            </>
          )}

          {(imp.status === 'ready' || imp.status === 'adding') && (
            imp.entries.length === 0 ? (
              <p className="wx-muted">{t('workspace.imp.none')}</p>
            ) : (
              <>
                <p className="wx-muted">{t('workspace.imp.found', { n: fmt(imp.entries.length), format: imp.format === 'ris' ? 'RIS' : 'BibTeX' })}</p>
                {imp.skipped > 0 && <small className="wx-muted">{t('workspace.imp.skipped', { n: fmt(imp.skipped) })}</small>}
                <p className={room === 0 ? 'wx-warn' : 'wx-muted'}>
                  {room === 0 ? t('workspace.imp.full', { n: fmt(basket.limit) }) : t('workspace.imp.capacity', { n: fmt(room) })}
                </p>
                <div className="wx-import__acts">
                  <button
                    type="button"
                    className="wx-act wx-act--sm"
                    disabled={room === 0}
                    onClick={() => setImp((s) => ({
                      ...s,
                      picked: Object.fromEntries(s.entries.filter((e) => !e.inBasket).slice(0, room).map((e) => [e.id, true])),
                    }))}
                  >
                    {t('workspace.imp.selectAll')}
                  </button>
                  <button type="button" className="wx-act wx-act--sm" disabled={!pickedCount} onClick={() => setImp((s) => ({ ...s, picked: {} }))}>
                    {t('workspace.imp.clearAll')}
                  </button>
                </div>
                <ul className="wx-import__list">
                  {imp.entries.map((e) => {
                    const on = Boolean(imp.picked[e.id]);
                    // Kalan yer dolduysa yeni kayıt seçilemez; seçili olan geri alınabilir.
                    const blocked = e.inBasket || (!on && pickedCount >= room);
                    return (
                      <li key={e.id} className={e.inBasket ? 'is-dim' : undefined}>
                        <label>
                          <input type="checkbox" checked={on} disabled={blocked} onChange={() => togglePick(e.id)} />
                          <span>
                            <strong>{e.title || '—'}</strong>
                            <small>{[e.creator?.split(';')[0], e.year, e.publicationName].filter(Boolean).join(' · ')}</small>
                            <span className="wx-tags">
                              <span className="wx-tag">{e.doi ? t('workspace.hasDoi') : t('workspace.imp.noDoiWarn')}</span>
                              {e.inBasket && <span className="wx-tag">{t('workspace.imp.inBasket')}</span>}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <small className="wx-muted">{t('workspace.imp.trust')}</small>
                <div className="wx-acts">
                  <button type="button" className="wx-act wx-act--primary" disabled={!pickedCount || imp.status === 'adding'} onClick={addPicked}>
                    {imp.status === 'adding' ? t('workspace.imp.adding') : t('workspace.imp.add', { n: fmt(pickedCount) })}
                  </button>
                </div>
              </>
            )
          )}
        </div>
      </section>
    </div>
  );

  const reviewItems = review ? sentences.filter((s) => inReview(s, review)) : [];
  const overriddenCount = sentences.filter((s) => s.overridden).length;
  const reviewView = review ? (
    <section className="wx-review" aria-label={t(`workspace.review.title.${review}`)}>
      <div className="wx-review__head">
        <ListChecks size={15} />
        <strong>{t(`workspace.review.title.${review}`)}</strong>
        <small>{fmt(reviewItems.length)}</small>
        <button type="button" className="wx-icon wx-icon--sm" onClick={() => setReview(null)} title={t('workspace.review.close')} aria-label={t('workspace.review.close')}>
          <X size={14} />
        </button>
      </div>
      <p className="wx-muted">{t(`workspace.review.lead.${review}`)}</p>
      {reviewItems.length === 0 ? (
        <p className="wx-muted">{t('workspace.review.empty')}</p>
      ) : (
        <ol className="wx-review__list">
          {reviewItems.map((s) => (
            <li key={s.id} className="wx-rev">
              <button type="button" className="wx-rev__text" onClick={() => goToSentence(s.id)} title={t('workspace.review.goTo')}>
                {s.text}
              </button>
              <div className="wx-rev__meta">
                <span className="wx-tag">{t(`workspace.reason.${s.reason}`)}</span>
                {s.overridden ? (
                  <button type="button" className="wx-act wx-act--sm" onClick={() => setOverride(s.key, null)}>
                    <RotateCcw size={12} /> {t('workspace.review.reset')}
                  </button>
                ) : review === MARK.uncited ? (
                  <button type="button" className="wx-act wx-act--sm" onClick={() => setOverride(s.key, OVERRIDE.notClaim)}>
                    {t('workspace.review.markNotClaim')}
                  </button>
                ) : (
                  <button type="button" className="wx-act wx-act--sm" onClick={() => setOverride(s.key, OVERRIDE.claim)}>
                    {t('workspace.review.markClaim')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {overriddenCount > 0 && <p className="wx-muted">{t('workspace.review.overridden', { n: fmt(overriddenCount) })}</p>}
    </section>
  ) : null;

  const surface = (
    <div className={`wx${embedded ? ' wx--embedded' : ''}`} hidden={hidden} role="region" aria-label={t('workspace.document')}>
      {/* Yazdırmada kağıt boyutu ve kenar boşlukları ekrandakiyle aynı olsun. */}
      <style>{`@page { size: ${geometry.width}mm ${geometry.height}mm; margin: ${geometry.margin}mm; }`}</style>

      {/* "Teslime hazırla" açıkken ona yer ayrılır: belge solda görünür kalır. */}
      <div className={`wx-shell${prepOpen ? ' wx-shell--prep' : ''}`}>
        {/* --- Üst çubuk: çıkış, belge kimliği ve belge düzeyindeki eylemler --- */}
        <header className="wx-top">
          {onExit && (
            <>
              <button type="button" className="wx-exit" onClick={onExit} title={t('workspace.exit')}>
                <ArrowLeft size={16} /> <span className="wx-hide-sm">{t('workspace.exit')}</span>
              </button>
              <span className="wx-top__sep" aria-hidden="true" />
            </>
          )}
          <input
            className="wx-top__title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            placeholder={t('workspace.titlePlaceholder')}
            aria-label={t('workspace.title')}
            readOnly={readOnly}
          />
          {/* Biçim etiketi (WO-011): atıf stili · sayfa boyutu; tıklayınca biçim değişir.
              Kayıt durumundan önce durur: kayıt yazısı genişleyince düğme kaymasın
              (odak kaybı kaydı tetikliyor, kayan düğmede tıklama boşa gidiyordu). */}
          <button
            type="button"
            className="wx-fmtlabel"
            onClick={() => setFmtOpen(true)}
            disabled={readOnly}
            title={t('workspace.format.labelHint')}
            data-action="write-format"
          >
            {t('workspace.format.label', { style: bibFormat, size: PAGE_SIZES[setup.size]?.label || setup.size })}
          </button>
          <span className="wx-top__spacer" />

          <div className="wx-anchor">
            <button type="button" className="wx-btn" aria-expanded={menu === 'template'} onClick={() => toggleMenu('template')} disabled={readOnly}>
              <LayoutTemplate size={15} /> <span className="wx-hide-sm">{t('workspace.templates')}</span>
            </button>
            <Popover open={menu === 'template'} onClose={closeMenu} label={t('workspace.templatesTitle')} wide>
              <div className="wx-pop__head">
                <strong>{t('workspace.templatesTitle')}</strong>
                <p>{t('workspace.templatesLead')}</p>
              </div>
              {TEMPLATES.map((tpl) => (
                <button key={tpl.id} type="button" className="wx-pop__item" onClick={() => applyTemplate(tpl.id)}>
                  <strong>{t(`workspace.tpl.${tpl.id}.name`)}</strong>
                  <small>{t(`workspace.tpl.${tpl.id}.desc`)}</small>
                  {tpl.sections.length > 0 && (
                    <small className="wx-pop__meta">
                      {t('workspace.templateSections', { n: fmt(tpl.sections.length) })}
                      {' · '}
                      {t('workspace.templateWords', { n: fmt(templateWords(tpl)) })}
                    </small>
                  )}
                </button>
              ))}
            </Popover>
          </div>

          <button
            type="button"
            className="wx-btn"
            aria-pressed={prepOpen}
            onClick={() => { closeMenu(); setPrepOpen((o) => !o); }}
            data-action="write-submit"
          >
            <ClipboardCheck size={15} /> <span className="wx-hide-sm">{t('audit.submit.open')}</span>
          </button>

          <div className="wx-anchor">
            <button type="button" className="wx-btn wx-btn--primary" aria-expanded={menu === 'export'} onClick={() => toggleMenu('export')}>
              <Download size={15} /> <span className="wx-hide-sm">{t('workspace.exportMenu')}</span> <ChevronDown size={14} />
            </button>
            <Popover open={menu === 'export'} onClose={closeMenu} label={t('workspace.exportMenu')}>
              <button type="button" className="wx-pop__item wx-pop__item--row" onClick={exportWord}>
                <FileText size={17} />
                <span><strong>{t('workspace.exportDocx')}</strong><small>{t('workspace.exportDocxHint')}</small></span>
              </button>
              <button type="button" className="wx-pop__item wx-pop__item--row" onClick={printDocument}>
                <Printer size={17} />
                <span><strong>{t('workspace.print')}</strong><small>{t('workspace.printHint')}</small></span>
              </button>
            </Popover>
          </div>

          <button
            type="button"
            className="wx-icon"
            aria-pressed={sideOpen}
            data-action="write-side"
            onClick={() => (sideOpen ? setSideOpen(false) : openSidePanel())}
            title={sideOpen ? t('workspace.closePanel') : t('workspace.openPanel')}
            aria-label={sideOpen ? t('workspace.closePanel') : t('workspace.openPanel')}
          >
            {sideOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </header>

        <div className={bodyClass}>
          {/* --- Belge yapısı (WO-010 1.1): 240 px, araç çubuğundaki düğmeyle açılıp kapanır.
              Kaynak listesi sağ panelin "Kaynaklar" sekmesine taşındı. --- */}
          {navPanel && (
            <OutlineNav
              headings={outline.headings}
              numbers={sectionNumbers}
              current={currentSection}
              words={outline.words}
              captions={captions}
              readOnly={readOnly}
              onGo={goToSection}
              onRename={renameSection}
              onMove={moveSection}
              onStep={stepSection}
              onAdd={addSection}
              onRevealCaption={revealSentenceKey}
              onClose={() => setNavPanel(null)}
              renaming={renamingSection}
              setRenaming={setRenamingSection}
            />
          )}

          {/* --- Belge --- */}
          <main className="wx-main">
            <div className="wx-ribbon" role="toolbar" aria-label={t('workspace.toolbar')} inert={readOnly || undefined}>
              <button
                type="button"
                className="wx-tool"
                aria-pressed={navPanel === 'sections'}
                onClick={() => toggleNav('sections')}
                title={navPanel ? t('workspace.outlineHide') : t('workspace.outlineShow')}
                aria-label={navPanel ? t('workspace.outlineHide') : t('workspace.outlineShow')}
                data-action="write-outline"
              >
                <ListTree size={16} />
              </button>
              <span className="wx-divider" />
              <select className="wx-sel" defaultValue="p"
                onChange={(e) => { exec('formatBlock', e.target.value); e.target.value = 'p'; }}
                aria-label={t('workspace.style')}>
                <option value="p">{t('workspace.body')}</option>
                <option value="h1">{t('workspace.heading', { n: 1 })}</option>
                <option value="h2">{t('workspace.heading', { n: 2 })}</option>
                <option value="h3">{t('workspace.heading', { n: 3 })}</option>
                <option value="blockquote">{t('workspace.quote')}</option>
              </select>
              <span className="wx-divider" />
              <Tool icon={<Bold size={16} />} label={t('workspace.bold')} onClick={() => exec('bold')} />
              <Tool icon={<Italic size={16} />} label={t('workspace.italic')} onClick={() => exec('italic')} />
              <Tool icon={<Underline size={16} />} label={t('workspace.underline')} onClick={() => exec('underline')} />
              <span className="wx-divider" />
              <Tool icon={<AlignLeft size={16} />} label={t('workspace.alignLeft')} onClick={() => exec('justifyLeft')} />
              <Tool icon={<AlignCenter size={16} />} label={t('workspace.alignCenter')} onClick={() => exec('justifyCenter')} />
              <Tool icon={<AlignJustify size={16} />} label={t('workspace.alignJustify')} onClick={() => exec('justifyFull')} />
              <span className="wx-divider" />
              <Tool icon={<List size={16} />} label={t('workspace.bulletList')} onClick={() => exec('insertUnorderedList')} />
              <Tool icon={<ListOrdered size={16} />} label={t('workspace.numberList')} onClick={() => exec('insertOrderedList')} />
              <span className="wx-divider" />
              <Tool icon={<Undo2 size={16} />} label={t('workspace.undo')} onClick={() => exec('undo')} />
              <Tool icon={<Redo2 size={16} />} label={t('workspace.redo')} onClick={() => exec('redo')} />
              <span className="wx-divider" />
              {/* Seçili kaynağın metin içi atfı imlece; künye doğrulanmış kayıttan (CLAUDE.md 3.1). */}
              <button
                type="button"
                className="wx-btn wx-btn--ghost"
                onMouseDown={(e) => e.preventDefault()}
                onClick={insertCitation}
                title={paper ? t('workspace.citeHint', { name: inlineCitation(paper, lang) }) : t('workspace.citeNeedSource')}
                data-action="write-cite"
              >
                <Quote size={15} /> <span className="wx-hide-md">{t('workspace.cite')}</span>
              </button>

              <span className="wx-ribbon__end">
                {/* Belgenin yazı tipi ve puntosu: tüm belgeye uygulanır, Teslim görünümünde görünür. */}
                <select
                  className="wx-sel wx-hide-lg"
                  value={setup.font}
                  onChange={(e) => updateSetup({ font: e.target.value })}
                  aria-label={t('workspace.docFont')}
                  title={t('workspace.docFontHint')}
                  data-action="write-font"
                >
                  {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select
                  className="wx-sel wx-hide-lg"
                  value={setup.fontSize}
                  onChange={(e) => updateSetup({ fontSize: Number(e.target.value) })}
                  aria-label={t('workspace.fontSize')}
                  title={t('workspace.docFontHint')}
                >
                  {FONT_SIZES.map((s) => <option key={s} value={s}>{s} pt</option>)}
                </select>
                <div className="wx-anchor">
                  <button type="button" className="wx-btn wx-btn--ghost" aria-expanded={menu === 'page'} onClick={() => toggleMenu('page')}>
                    <SlidersHorizontal size={15} /> <span className="wx-hide-sm">{t('workspace.pageSettings')}</span>
                  </button>
                  <Popover open={menu === 'page'} onClose={closeMenu} label={t('workspace.pageSettings')}>
                    <div className="wx-form">
                      <label>
                        <span>{t('workspace.pageSize')}</span>
                        <select value={setup.size} onChange={(e) => updateSetup({ size: e.target.value })}>
                          {Object.values(PAGE_SIZES).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>{t('workspace.orientation')}</span>
                        <select value={setup.landscape ? 'landscape' : 'portrait'} onChange={(e) => updateSetup({ landscape: e.target.value === 'landscape' })}>
                          <option value="portrait">{t('workspace.portrait')}</option>
                          <option value="landscape">{t('workspace.landscape')}</option>
                        </select>
                      </label>
                      <label className="wx-form__wide">
                        <span>{t('workspace.margins')}</span>
                        <select value={setup.margin} onChange={(e) => updateSetup({ margin: e.target.value })}>
                          {Object.values(MARGIN_PRESETS).map((m) => (
                            <option key={m.id} value={m.id}>{t(`workspace.margin.${m.id}`)} · {fmt(m.value)} mm</option>
                          ))}
                        </select>
                      </label>
                      <label className="wx-form__wide">
                        <span>{t('workspace.font')}</span>
                        <select value={setup.font} onChange={(e) => updateSetup({ font: e.target.value })}>
                          {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>{t('workspace.fontSize')}</span>
                        <select value={setup.fontSize} onChange={(e) => updateSetup({ fontSize: Number(e.target.value) })}>
                          {FONT_SIZES.map((s) => <option key={s} value={s}>{s} pt</option>)}
                        </select>
                      </label>
                      <label>
                        <span>{t('workspace.lineHeight')}</span>
                        <select value={setup.lineHeight} onChange={(e) => updateSetup({ lineHeight: Number(e.target.value) })}>
                          {LINE_HEIGHTS.map((l) => <option key={l} value={l}>{fmt(l)}</option>)}
                        </select>
                      </label>
                    </div>
                    <p className="wx-pop__note">{t('workspace.submitNote')}</p>
                  </Popover>
                </div>
              </span>
            </div>

            {/* Faz 2: belge üstünde en fazla bir bilgi şeridi (öncelik: kilit, depolama, kaldığın yer, teslim notu). */}

            {/* Sekmeler arası (WO-011): başka sekme düzenliyorsa burada salt okunur. */}
            {readOnly && (
              <div className="wx-sync wx-sync--lock" role="status" data-testid="draft-locked">
                <Info size={15} />
                <span>{t('workspace.sync.locked')}</span>
                <button type="button" className="wx-act wx-act--sm wx-act--primary" onClick={takeOver} data-action="draft-take-over">
                  {t('workspace.sync.editHere')}
                </button>
              </div>
            )}
            {/* Depolama yazılamıyor: yazmak serbest, kayıt yok; kalıcı uyarı ve DOCX. */}
            {!readOnly && storageDown && (
              <div className="wx-sync wx-sync--down" role="alert" data-testid="storage-warn">
                <Info size={15} />
                <span>{t('workspace.sync.storageDown')}</span>
                <button type="button" className="wx-act wx-act--sm" onClick={exportWord} data-action="storage-docx">
                  <Download size={14} /> {t('workspace.sync.downloadDocx')}
                </button>
              </div>
            )}

            {!readOnly && !storageDown && resume && (
              <div className="wx-resume" role="status">
                <History size={15} />
                <span>
                  {t('workspace.resume.lead', { section: resume.text })}
                  {resume.ago ? ` · ${resume.ago}` : ''}
                  {counts.uncited > 0 ? ` · ${t('workspace.resume.uncited', { n: fmt(counts.uncited) })}` : ''}
                </span>
                <button type="button" className="wx-act wx-act--sm wx-act--primary" onClick={resumeWork}>
                  {t('workspace.resume.go')}
                </button>
                <button type="button" className="wx-icon wx-icon--sm" onClick={() => setResume(null)} title={t('workspace.resume.dismiss')} aria-label={t('workspace.resume.dismiss')}>
                  <X size={14} />
                </button>
              </div>
            )}

            {!readOnly && !storageDown && !resume && view === 'submit' && (
              <p className="wx-note"><Info size={14} /> {t('workspace.submitNote')}</p>
            )}

            <div
              ref={deskRef}
              className={`wx-desk wx-desk--${view}`}
              style={{ ...pageStyle(setup), '--wx-zoom': zoomScale }}
              onScroll={(e) => {
                // Gizlenince (display:none) kaydırma sıfırlanır; son konum burada tutulur.
                if (!hidden) scrollRef.current = e.currentTarget.scrollTop;
                if (selBar) setSelBar(null);
                measurePages();
                trackSection();
              }}
            >
              {/* Seçim araç çubuğu (WO-010 1.4): fare ile basınca seçim kaybolmasın. */}
              {selBar && (
                <div className="wx-selbar" role="toolbar" aria-label={t('workspace.selbar')} style={{ top: selBar.top, left: selBar.left }} onMouseDown={(e) => e.preventDefault()}>
                  <button type="button" onClick={insertCitation} data-action="selbar-cite" title={paper ? inlineCitation(paper, lang) : t('workspace.citeNeedSource')}>
                    <Quote size={13} /> {t('workspace.cite')}
                  </button>
                  <span aria-hidden="true" />
                  <button type="button" onClick={toggleClaimAtSelection} data-action="selbar-claim" title={t('workspace.claimToggleHint')}>
                    <ListChecks size={13} /> {t('workspace.claimToggle')}
                  </button>
                </div>
              )}
              {view === 'submit' && (
                <div className="wx-ruler" aria-hidden="true">
                  {Array.from({ length: Math.floor(geometry.contentWidth / 10) + 1 }, (_, i) => (
                    <span key={i} style={{ left: `calc(var(--ws-margin) + ${i * 10}mm)` }}>{i || ''}</span>
                  ))}
                </div>
              )}
              <div className="wx-sheet">
                <div
                  ref={pageRef}
                  className={`wx-page wx-page--${view}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label={t('workspace.document')}
                  onInput={onInput}
                  onBlur={flush}
                />
                {markers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`wx-marker wx-marker--${m.severity}`}
                    style={{ top: m.top, height: m.height, left: m.left }}
                    onClick={() => openMarker(m)}
                    title={t('audit.check.marker', { title: m.title })}
                    aria-label={t('audit.check.marker', { title: m.title })}
                    data-action="check-marker"
                    data-rule={m.rule}
                    data-severity={m.severity}
                  />
                ))}
                {/* §8: boş sayfa bir sonraki hamleyi söyler; şablon zorunlu değil. */}
                {isEmpty && (
                  <div className="wx-empty">
                    <strong>{t('workspace.emptyTitle')}</strong>
                    <p>{t('workspace.emptyLead')}</p>
                    <p className="wx-empty__or">{t('workspace.emptyOr')}</p>
                    <div className="wx-empty__tpls">
                      {TEMPLATES.filter((x) => x.sections.length > 0).map((x) => (
                        <button key={x.id} type="button" onClick={() => applyTemplate(x.id)}>
                          <LayoutTemplate size={14} /> {t(`workspace.tpl.${x.id}.name`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Faz 2: tek satır. Sayfa (yaklaşık) · kelime · kayıt · görünüm · ölçek.
                Cümle/atıf sayaçları Kontrol sekmesinde. */}
            <footer className="wx-status" aria-live="polite">
              {view === 'submit' && (
                <span title={t('workspace.pageApprox')} data-testid="page-of">{t('workspace.pageOf', { i: fmt(pageInfo.i), n: fmt(pageInfo.n) })}</span>
              )}
              <span>{t('workspace.stat.words', { n: fmt(outline.words) })}</span>
              {save && (
                <span
                  className={`wx-save wx-save--${saveState.kind}`}
                  title={saveState.kind === 'local' ? t('workspace.saveLocalHint') : undefined}
                  role={saveState.kind === 'failed' ? 'alert' : undefined}
                >
                  <span aria-hidden="true">{save.icon}</span> {save.text}
                  {saveState.kind === 'failed' && (
                    <button type="button" className="wx-save__retry" onClick={() => persistRef.current()} data-action="write-save-retry">
                      {t('workspace.saveRetry')}
                    </button>
                  )}
                </span>
              )}
              <span className="wx-status__spacer" />
              {/* Görünüm ve ölçek (WO-010 1.2): Taslak · Teslim; Teslim'de sığdır / gerçek boyut. */}
              <div className="wx-seg wx-seg--sm" role="group" aria-label={t('workspace.view.label')}>
                <button type="button" aria-pressed={view === 'draft'} onClick={() => changeView('draft')} data-action="write-view-draft">
                  {t('workspace.view.draft')}
                </button>
                <button type="button" aria-pressed={view === 'submit'} onClick={() => changeView('submit')} data-action="write-view-submit">
                  {t('workspace.view.submit')}
                </button>
              </div>
              {view === 'submit' && (
                <div className="wx-seg wx-seg--sm wx-hide-sm" role="group" aria-label={t('workspace.zoom.label')}>
                  <button
                    type="button"
                    aria-pressed={zoomMode === 'fit'}
                    onClick={() => { setZoomMode('fit'); markDirty(); }}
                    data-action="write-zoom-fit"
                    title={t('workspace.zoom.fitHint')}
                  >
                    {t('workspace.zoom.fit')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={zoomMode === 'actual'}
                    onClick={() => { setZoomMode('actual'); markDirty(); }}
                    data-action="write-zoom-actual"
                    title={t('workspace.zoom.actualHint')}
                  >
                    {t('workspace.zoom.actual')}
                  </button>
                </div>
              )}
            </footer>
          </main>

          {/* --- Bağlam paneli (§3, §4) --- */}
          {sideOpen && (
            <aside className="wx-side" aria-label={t('workspace.contextPanel')} inert={readOnly || undefined}>
              <div className="wx-panel-head">
                {review ? <strong>{t('workspace.contextPanel')}</strong> : (
                  <div className="wx-seg wx-seg--sm" role="group" aria-label={t('workspace.contextPanel')}>
                    <button type="button" aria-pressed={sideView === 'source'} onClick={() => setSideView('source')} data-action="side-evidence">{t('workspace.side.evidence')}</button>
                    <button type="button" aria-pressed={sideView === 'list'} onClick={() => setSideView('list')} data-action="side-sources">
                      {t('workspace.side.sources')}{basket.papers.length > 0 ? ` · ${fmt(basket.papers.length)}` : ''}
                    </button>
                    <button type="button" aria-pressed={sideView === 'bib'} onClick={() => setSideView('bib')} data-action="side-bib">{t('workspace.bib.tab')}</button>
                    <button type="button" aria-pressed={sideView === 'check'} onClick={() => setSideView('check')} data-action="side-check">
                      {t('audit.check.tab')}{checkItems.length > 0 ? ` · ${fmt(checkItems.length)}` : ''}
                    </button>
                  </div>
                )}
                {!review && sideView === 'source' && paper && basket.papers.length > 1 && (
                  <span className="wx-stepper">
                    <button type="button" className="wx-icon wx-icon--sm" onClick={() => stepSource(-1)} aria-label={t('workspace.prevSource')}>
                      <ChevronLeft size={15} />
                    </button>
                    <small>{t('workspace.sourceOf', { i: fmt(paperIndex + 1), n: fmt(basket.papers.length) })}</small>
                    <button type="button" className="wx-icon wx-icon--sm" onClick={() => stepSource(1)} aria-label={t('workspace.nextSource')}>
                      <ChevronRight size={15} />
                    </button>
                  </span>
                )}
                <button type="button" className="wx-icon wx-icon--sm wx-panel-head__close" onClick={() => setSideOpen(false)} aria-label={t('workspace.closePanel')}>
                  <X size={15} />
                </button>
              </div>

              <div className="wx-side__body">
                {reviewView}
                {!review && sideView === 'bib' && bibView}
                {!review && sideView === 'check' && (
                  <CheckPanel
                    items={checkItems}
                    locate={locateItem}
                    onAction={onCheckAction}
                    focusId={checkFocus.id}
                    focusTick={checkFocus.tick}
                    pending={retractionPending}
                    note={t('audit.check.live')}
                    summary={(
                      <p className="wx-ctl__summary" data-testid="check-summary">
                        <span>{t('workspace.stat.sentences', { n: fmt(counts.total) })}</span>
                        <span>{t('workspace.stat.cited', { n: fmt(counts.cited) })}</span>
                        <button type="button" className="wx-stat wx-stat--uncited" onClick={() => openReview(MARK.uncited)}>{t('workspace.stat.uncited', { n: fmt(counts.uncited) })}</button>
                        <button type="button" className="wx-stat wx-stat--plain" onClick={() => openReview(MARK.notClaim)}>{t('workspace.stat.notClaim', { n: fmt(counts.notClaim) })}</button>
                        <small className="wx-muted">{t('workspace.summaryLimit')}</small>
                      </p>
                    )}
                    muted={mutedSentences}
                    onUnmute={(key) => setOverride(key, null)}
                  />
                )}
                {!review && sideView === 'list' && (
                  <section className="wx-srclist" aria-label={t('workspace.side.sources')}>
                    <div className="wx-acts">
                      {onFindSources && (
                        <button type="button" className="wx-act wx-act--primary" onClick={onFindSources} data-action="write-find-sources">
                          <Search size={14} /> {t('workspace.findSources')}
                        </button>
                      )}
                      <button type="button" className="wx-act" onClick={openImport} data-action="write-import">
                        <Upload size={14} /> {t('workspace.imp.short')}
                      </button>
                    </div>
                    {basket.papers.length === 0 ? (
                      <p className="wx-muted">{t('workspace.sourcesEmpty')}</p>
                    ) : (
                      <div className="wx-srclist__items">
                        {basket.papers.map((p, i) => {
                          const key = sourceKey(p, i);
                          return (
                            <button key={key} type="button" className={`wx-src${activeSource === key ? ' is-on' : ''}`} onClick={() => openSource(key)} data-action="side-source-open">
                              <strong>{p.title}</strong>
                              <small>{[p.creator?.split(',')[0], p.year].filter(Boolean).join(' · ')}</small>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}
                {!review && sideView === 'source' && (paper ? (
                  <article className="wx-card">
                    <h4>{paper.title}</h4>
                    <small className="wx-card__meta">{[paper.creator, paper.year, paper.publicationName].filter(Boolean).join(' · ')}</small>
                    {/* §4: rozet kayıt bilgisidir, kalite yargısı değil. */}
                    <div className="wx-tags">
                      <span className="wx-tag">{paper.doi ? t('workspace.hasDoi') : t('workspace.noDoi')}</span>
                      <span className="wx-tag">{passage ? t('workspace.hasAbstract') : t('workspace.noAbstract')}</span>
                    </div>

                    {!passage && <p className="wx-warn">{t('workspace.noPassage')}</p>}
                    {passage && (
                      <>
                        {/* §4: pasajın karar veren kısmı vurgulu. Yalnız sunucunun birebir doğruladığı parça. */}
                        <blockquote className="wx-passage">
                          {spanRange ? (
                            <>
                              {passage.slice(0, spanRange[0])}
                              <mark>{passage.slice(spanRange[0], spanRange[1])}</mark>
                              {passage.slice(spanRange[1])}
                            </>
                          ) : passage}
                        </blockquote>
                        <small className="wx-muted">{t('workspace.passageIsAbstract')}</small>
                        <div className="wx-acts">
                          {!draft?.sentence && (
                            <button type="button" className="wx-act wx-act--primary" onClick={() => makeSentence(paper, activeSource)} disabled={Boolean(draft?.loading)}>
                              <Quote size={13} /> {draft?.loading ? t('workspace.generating') : t('workspace.generateSentence')}
                            </button>
                          )}
                          <button type="button" className="wx-act" onClick={() => insertQuote(paper, activeSource)}>
                            {t('workspace.quoteIt')}
                          </button>
                        </div>
                      </>
                    )}

                    {draft?.sentence && (
                      <div className="wx-draft">
                        <p>{draft.sentence} <span className="wx-cite">{draft.citation}</span></p>

                        {/* 2.2 kural 2: her cümle destek sınıfıyla. Renk + şekil + metin (§6). */}
                        <div className={`wx-support wx-support--${draftLabel}`}>
                          <span className="wx-support__shape" aria-hidden="true">{SUPPORT_SHAPES[draftLabel]}</span>
                          <strong>{t(`workspace.support.${draftLabel}`)}</strong>
                        </div>
                        {draftLabel === 'partial' && draft.support?.scopeGap && (
                          <small className="wx-muted">{t('workspace.support.gap', { gap: draft.support.scopeGap })}</small>
                        )}
                        {draft.support?.span && !draft.support.spanVerified && (
                          <small className="wx-muted">{t('workspace.support.spanMissing')}</small>
                        )}
                        <small className="wx-muted">{t('workspace.support.note')}</small>

                        <div className="wx-acts">
                          {draft.inserted ? (
                            <span className="wx-done"><Check size={14} /> {t('workspace.inserted')}</span>
                          ) : draftSettled ? (
                            <button type="button" className="wx-act wx-act--primary" onClick={() => insertSentence(activeSource)}>
                              {t('workspace.insertSentence')}
                            </button>
                          ) : (
                            <button type="button" className="wx-act" onClick={() => insertSentence(activeSource)}>
                              {t('workspace.support.insertAnyway')}
                            </button>
                          )}
                        </div>
                        {!draft.inserted && !draftSettled && <p className="wx-warn">{t('workspace.support.insertWarn')}</p>}
                        {!draft.inserted && <small className="wx-muted">{t('workspace.insertWhere')}</small>}

                        <div className="wx-regen">
                          <div className="wx-acts">
                            <button type="button" className="wx-act" onClick={() => makeSentence(paper, activeSource, 'similar')} disabled={Boolean(draft.loading)}>
                              <RefreshCw size={13} /> {draft.loading === 'similar' ? t('workspace.generating') : t('workspace.similar')}
                            </button>
                            <button type="button" className="wx-act" onClick={() => makeSentence(paper, activeSource, 'new')} disabled={Boolean(draft.loading)}>
                              <Plus size={13} /> {draft.loading === 'new' ? t('workspace.generating') : t('workspace.fresh')}
                            </button>
                          </div>
                          <small className="wx-muted">{t('workspace.modesHint')}</small>
                        </div>
                      </div>
                    )}
                    {draft?.notice && <p className="wx-warn">{draft.notice}</p>}
                  </article>
                ) : basket.papers.length > 0 ? (
                  <p className="wx-muted">{t('workspace.pickSource')}</p>
                ) : (
                  <article className="wx-card wx-card--lib">
                    <h4><Library size={14} /> {t('workspace.needSource')}</h4>
                    <p>{t('workspace.needSourceText')}</p>
                  </article>
                ))}

                {/* Kanıt doğrulaması yok; bu söylenir ama paneli kaplamaz (CLAUDE.md 2.8). */}
                <details className="wx-limits">
                  <summary><Info size={13} /> {t('workspace.limitsTitle')}</summary>
                  <p>{t('workspace.evidenceSoonText')}</p>
                </details>
              </div>
            </aside>
          )}

          <div className="wx-scrim" onClick={closeOverlays} aria-hidden="true" />
        </div>
      </div>

      {importView}
      {prepOpen && (
        <SubmitPrep
          items={prepItems}
          locate={locateItem}
          onAction={(action, item) => {
            // Sağ paneli açan eylemler paneli görünür kılmak için çekmeceyi kapatır.
            if (['bib', 'sources', 'addSource'].includes(action)) setPrepOpen(false);
            onCheckAction(action, item);
          }}
          pending={retractionPending}
          setup={setup}
          format={format}
          headings={outline.headings}
          basketCount={basket.papers.length}
          onPreview={() => { if (view !== 'submit') { setView('submit'); markDirty(); } }}
          onExport={exportFor}
          onClose={() => setPrepOpen(false)}
        />
      )}
      {fmtOpen && (
        <FormatPicker
          mode="change"
          initial={{ formatId: FORMATS.some((f) => f.id === format) ? format : 'article', bibFormat, title }}
          planFor={planFor}
          onCancel={() => setFmtOpen(false)}
          onConfirm={applyFormat}
        />
      )}
      {/* Dosya seçici: aktarma penceresi açılınca kullanılır, görünmez durur. */}
      <input
        ref={fileRef}
        type="file"
        accept=".bib,.ris,.txt,application/x-bibtex,application/x-research-info-systems,text/plain"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Aynı dosya ikinci kez seçilebilsin: değer sıfırlanır.
          e.target.value = '';
          readImportFile(file);
        }}
      />
    </div>
  );

  // Kabuğun içindeyse yerinde çizilir (WO-010). Eski arayüzde kenar çubuğu ve
  // üst çubuk görünmesin diye yüzey body'ye çizilir. Sunucu tarafı render'da
  // (testler) document yok; o zaman da yerinde.
  if (embedded || typeof document === 'undefined') return surface;
  return createPortal(surface, document.body);
}
