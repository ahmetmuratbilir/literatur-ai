import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Check, ChevronLeft, ChevronRight, CornerDownRight, LineChart, Maximize2, Plus, RefreshCw, Shapes, Trash2, X } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import {
  APPEARANCE_OPTIONS, CHART_TYPES, FIGURE_TYPES, PATTERN_TYPES, PT_RANGE, WIDTH_RANGE, pointSize,
  isDefaultAppearance, newDrawId, normalizeAppearance, paletteSwatch, sentencesOf,
} from '../../visuals/draw.js';
import { LEVELED_TYPES, MAX_LEVEL, ROOTED_TYPES, outlineNumbers, renderFigure } from '../../visuals/render.js';

// Şablon şeridindeki aileler (galeri ile aynı).
const FAMILIES = [
  ['seq', ['steps', 'stairs', 'roadmap', 'numlist']],
  ['cycle', ['cycle', 'hub', 'feedback']],
  ['cause', ['chain', 'fishbone']],
  ['structure', ['tree', 'mind', 'pyramid', 'funnel']],
  ['compare', ['compare', 'columns', 'matrix', 'venn']],
  ['relation', ['concept', 'argument']],
  ['time', ['timeline', 'vtimeline']],
];
// Sayı sınırı yok gibidir (Ahmet: "isterse 1.10'a kadar uzatsın"); çizime sığmayan öğe "görünmüyor" notunda sayılır.
const MAX_ITEMS = 60;
// Tema galerisinin grupları (WO-033): sıra paletin listedeki sırasıdır.
const THEME_GROUPS = [
  ['color', APPEARANCE_OPTIONS.palette.filter((p) => p !== 'bw' && p !== 'gray' && !p.startsWith('mono'))],
  ['mono', APPEARANCE_OPTIONS.palette.filter((p) => p === 'gray' || p.startsWith('mono'))],
  ['print', ['bw']],
];

const EMPTY = {
  items: ['', '', ''],
  levels: [],
  compare: { leftTitle: '', rightTitle: '', left: '', right: '' },
  timeline: [{ date: '', text: '' }, { date: '', text: '' }],
  chart: { rows: [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }], unit: '', xTitle: '', yTitle: '' },
};

/**
 * Napkin gibi taslak alan (WO-028). Belgede seçili paragrafın altında açılır;
 * içindekiler belgeye ancak "Tamam" ile girer (tüzük 2.9). Etiketler ve sayılar
 * kullanıcıdan ya da paragraftan; model yok, uydurma yok (2.8).
 *
 * @param mode 'figure' | 'chart'
 * @param initial Düzenlenen görselin kayıtlı durumu ({ type, data, title }) ya da null.
 *   Görünüm (WO-030 Faz 4) `data.appearance` içinde saklanır; varsayılansa hiç yazılmaz.
 * @param sourceText Hedef paragrafın metni ("Paragraftan al")
 * @param sourceRows Hedef tablo varsa satırları ("Tablodan al")
 */
export default function FigureDraft({ mode, initial, sourceText, sourceRows, number, style, onDone, onCancel, openLook = false, applyAll = false, onApplyAllChange }) {
  const { t, lang } = useI18n();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const k = (key, p) => t(`workspace.figure.${key}`, p);
  const types = mode === 'chart' ? CHART_TYPES : FIGURE_TYPES;
  const [type, setType] = useState(initial?.type || types[0]);
  const [data, setData] = useState(() => {
    const { appearance: _saved, ...rest } = initial?.data || {};
    return { ...EMPTY, ...rest };
  });
  const [appearance, setAppearance] = useState(() => normalizeAppearance(initial?.data?.appearance));
  // Büyük düzenleme (WO-035; Napkin gibi): önizleme taslak alanının tamamına büyür.
  const [big, setBig] = useState(false);
  const stageRef = useRef(null);
  const [lookOpen, setLookOpen] = useState(() => openLook || !isDefaultAppearance(initial?.data?.appearance));
  // Taslağa özgü desen kimliği: düzenlenen şekil belgede dururken önizlemenin desenleri onunkilerle çakışmasın.
  const [uid] = useState(newDrawId);
  const [title, setTitle] = useState(initial?.title || '');
  const preview = useMemo(() => renderFigure(type, data, title, locale, appearance, uid), [type, data, title, locale, appearance, uid]);
  // Galeri küçük resimleri: aynı içerik, her temayla (yalnız Görünüm açıkken çizilir).
  const thumbs = useMemo(() => {
    if (!lookOpen || !preview) return {};
    const out = {};
    APPEARANCE_OPTIONS.palette.forEach((key, i) => { out[key] = renderFigure(type, data, '', locale, { ...appearance, palette: key }, `${uid}t${i}`)?.svg || null; });
    return out;
  }, [lookOpen, preview, type, data, locale, appearance, uid]);
  const patch = (key, value) => setData((d) => ({ ...d, [key]: value }));
  // Seçili şablon şeritte görünsün (düzenlemeye açılınca şerit baştan başlıyordu).
  const stripRef = useRef(null);
  useEffect(() => {
    const strip = stripRef.current;
    const btn = strip?.querySelector('[aria-pressed="true"]');
    if (strip && btn) strip.scrollLeft = Math.max(0, btn.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + btn.offsetWidth / 2);
  }, [type]);
  const word = t('audit.kind.figure');

  // Katmanlı liste (Ahmet, 21.10.2026): öğe girintiyle başka öğenin altına alınır (1, 1.1, 1.1.1).
  // Katmanlar her şablonda saklanır; yalnız yapısı olan şablonlarda (ağaç, zihin haritası, balık
  // kılçığı, çok sütun, Venn, matris) gösterilir ve çizimde kullanılır.
  const leveled = LEVELED_TYPES.includes(type);
  const levelAt = (i) => Math.max(0, Math.min(MAX_LEVEL, Number(data.levels?.[i]) || 0));
  const levels = data.items.map((_, i) => levelAt(i));
  // Kök şablonlarında ilk satır kök/merkez/sonuçtur; numara daldan 1 diye başlar.
  const rooted = ROOTED_TYPES.includes(type);
  const numbers = !leveled ? data.items.map((_, i) => String(i + 1))
    : rooted ? [k(`root.${type}`), ...outlineNumbers(levels.slice(1))] : outlineNumbers(levels);
  const setRows = (items, lv) => setData((d) => ({ ...d, items, levels: lv }));
  const shift = (i, d) => {
    if (rooted && i === 0) return; // kök girintilenmez
    const prev = i === 0 || (rooted && i === 1) ? -1 : levels[i - 1];
    const next = Math.max(0, Math.min(MAX_LEVEL, levels[i] + d, prev + 1));
    setRows(data.items, levels.map((l, j) => (j === i ? next : l)));
  };
  const addChild = (i) => {
    // Kökün "altı" yeni bir daldır: sona, ana katmanda.
    if (rooted && i === 0) { setRows([...data.items, ''], [...levels, 0]); return; }
    const lv = Math.min(MAX_LEVEL, levels[i] + 1);
    let at = i + 1;
    while (at < levels.length && levels[at] > levels[i]) at += 1; // son alt öğenin arkasına
    setRows([...data.items.slice(0, at), '', ...data.items.slice(at)], [...levels.slice(0, at), lv, ...levels.slice(at)]);
  };
  const itemsEditor = (
    <div className="fd-list">
      {data.items.map((v, i) => (
        <div key={i} className={`fd-row${leveled ? ' fd-row--lv' : ''}${leveled && rooted && i === 0 ? ' fd-row--root' : ''}`} style={leveled && !(rooted && i === 0) ? { paddingLeft: levels[i] * 16 } : undefined} data-level={leveled ? levels[i] : undefined}>
          <span className="fd-n">{numbers[i]}</span>
          <input
            value={v}
            onChange={(e) => patch('items', data.items.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => { if (leveled && e.key === 'Tab') { e.preventDefault(); shift(i, e.shiftKey ? -1 : 1); } }}
            placeholder={t(`workspace.figure.ph.${type}`) !== `workspace.figure.ph.${type}` ? k(`ph.${type}`) : k('itemPlaceholder')}
            aria-label={k('item', { n: numbers[i] })}
            data-fd="item"
          />
          {/* Minik "alt öğe ekle" (Ahmet, 21.10.2026): satırın üzerine gelince ya da odakta görünür. İçeri/dışarı: Tab / Shift+Tab. */}
          {leveled && (
            <button
              type="button"
              className="fd-mini"
              onClick={() => addChild(i)}
              disabled={data.items.length >= MAX_ITEMS || (!(rooted && i === 0) && levels[i] >= MAX_LEVEL)}
              aria-label={k('addChild', { n: numbers[i] })}
              title={k('addChild', { n: numbers[i] })}
              data-fd="add-child"
            >
              <CornerDownRight size={11} />
            </button>
          )}
          <button type="button" className="fd-icon" onClick={() => setRows(data.items.filter((_, j) => j !== i), levels.filter((_, j) => j !== i))} disabled={data.items.length <= 2} aria-label={k('remove')} title={k('remove')}><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="fd-acts">
        <button type="button" className="fd-btn" onClick={() => setRows([...data.items, ''], [...levels, 0])} disabled={data.items.length >= MAX_ITEMS}><Plus size={13} /> {k('addItem')}</button>
        {sourceText && (
          <button type="button" className="fd-btn" onClick={() => setRows(sentencesOf(sourceText).slice(0, 8), [])} data-action="fd-from-paragraph" title={k('fromParagraphHint')}>
            <RefreshCw size={13} /> {k('fromParagraph')}
          </button>
        )}
      </div>
      {t(`workspace.figure.hint.${type}`) !== `workspace.figure.hint.${type}` && <small className="fd-hint" data-fd="hint">{k(`hint.${type}`)}</small>}
    </div>
  );

  const compareEditor = (
    <div className="fd-cols">
      {['left', 'right'].map((side) => (
        <div key={side} className="fd-col">
          <input value={data.compare[`${side}Title`]} onChange={(e) => patch('compare', { ...data.compare, [`${side}Title`]: e.target.value })} placeholder={k(`${side}Title`)} aria-label={k(`${side}Title`)} data-fd={`${side}-title`} />
          <textarea rows={5} value={data.compare[side]} onChange={(e) => patch('compare', { ...data.compare, [side]: e.target.value })} placeholder={k('onePerLine')} aria-label={k(`${side}Items`)} data-fd={`${side}-items`} />
        </div>
      ))}
    </div>
  );

  const timelineEditor = (
    <div className="fd-list">
      {data.timeline.map((r, i) => (
        <div key={i} className="fd-row">
          <input className="fd-date" value={r.date} onChange={(e) => patch('timeline', data.timeline.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} placeholder={k('date')} aria-label={k('date')} />
          <input value={r.text} onChange={(e) => patch('timeline', data.timeline.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder={k('event')} aria-label={k('event')} />
          <button type="button" className="fd-icon" onClick={() => patch('timeline', data.timeline.filter((_, j) => j !== i))} disabled={data.timeline.length <= 2} aria-label={k('remove')}><Trash2 size={13} /></button>
        </div>
      ))}
      <button type="button" className="fd-btn" onClick={() => patch('timeline', [...data.timeline, { date: '', text: '' }])} disabled={data.timeline.length >= 8}><Plus size={13} /> {k('addItem')}</button>
    </div>
  );

  const c = data.chart;
  const chartEditor = (
    <div className="fd-list">
      <div className="fd-row fd-row--head"><span>{k('label')}</span><span>{k('value')}</span><span /></div>
      {c.rows.map((r, i) => (
        <div key={i} className="fd-row">
          <input value={r.label} onChange={(e) => patch('chart', { ...c, rows: c.rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder={k('label')} aria-label={k('label')} data-fd="chart-label" />
          <input className="fd-num" inputMode="decimal" value={r.value} onChange={(e) => patch('chart', { ...c, rows: c.rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="0" aria-label={k('value')} data-fd="chart-value" />
          <button type="button" className="fd-icon" onClick={() => patch('chart', { ...c, rows: c.rows.filter((_, j) => j !== i) })} disabled={c.rows.length <= 1} aria-label={k('remove')}><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="fd-acts">
        <button type="button" className="fd-btn" onClick={() => patch('chart', { ...c, rows: [...c.rows, { label: '', value: '' }] })} disabled={c.rows.length >= 12}><Plus size={13} /> {k('addRow')}</button>
        {sourceRows?.length > 0 && (
          <button type="button" className="fd-btn" onClick={() => patch('chart', { ...c, rows: sourceRows.slice(0, 12) })} data-action="fd-from-table" title={k('fromTableHint')}>
            <RefreshCw size={13} /> {k('fromTable')}
          </button>
        )}
      </div>
      <div className="fd-axes">
        <input value={c.yTitle} onChange={(e) => patch('chart', { ...c, yTitle: e.target.value })} placeholder={k('yTitle')} aria-label={k('yTitle')} />
        <input value={c.unit} onChange={(e) => patch('chart', { ...c, unit: e.target.value })} placeholder={k('unit')} aria-label={k('unit')} />
        <input value={c.xTitle} onChange={(e) => patch('chart', { ...c, xTitle: e.target.value })} placeholder={k('xTitle')} aria-label={k('xTitle')} />
      </div>
    </div>
  );

  const editor = type === 'compare' ? compareEditor : (type === 'timeline' || type === 'vtimeline') ? timelineEditor : CHART_TYPES.includes(type) ? chartEditor : itemsEditor;
  const setLook = (key, value) => setAppearance((a) => ({ ...a, [key]: value }));
  const patternOk = PATTERN_TYPES.includes(type);
  /** Sağ kenardaki tutamaçla genişlik: şekil ortalı, genişlik = 2 × merkezden uzaklık / sayfa sütunu. */
  const onHandleDown = (e) => {
    const frame = stageRef.current;
    if (!frame) return;
    e.preventDefault();
    const box = frame.getBoundingClientRect();
    const move = (ev) => {
      const pct = (Math.abs(ev.clientX - (box.left + box.width / 2)) * 2 * 100) / box.width;
      const w = Math.round(pct / WIDTH_RANGE.step) * WIDTH_RANGE.step;
      setLook('width', Math.max(WIDTH_RANGE.min, Math.min(WIDTH_RANGE.max, w)));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onHandleKey = (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    setLook('width', Math.max(WIDTH_RANGE.min, Math.min(WIDTH_RANGE.max, appearance.width + d * WIDTH_RANGE.step)));
  };
  /** Yazı punto kutusu (Ahmet, 21.10.2026): şeklin belgedeki puntosu; boş bırakılırsa otomatik. */
  const ptBox = (
    <label className="fd-pt" title={k('look.ptHint')}>
      <span className="fd-seg__legend">{k('look.pt')}</span>
      <input
        type="number"
        inputMode="decimal"
        min={PT_RANGE.min}
        max={PT_RANGE.max}
        step={PT_RANGE.step}
        value={appearance.textPt ?? ''}
        placeholder={String(pointSize(appearance))}
        onChange={(e) => setLook('textPt', e.target.value === '' ? null : Number(String(e.target.value).replace(',', '.')))}
        data-fd="pt"
      />
      <small>pt</small>
    </label>
  );
  const segment = (key, disabled = false) => (
    <fieldset className="fd-seg" disabled={disabled}>
      <legend>{k(`look.${key}`)}</legend>
      <div className="fd-seg__opts">
        {APPEARANCE_OPTIONS[key].map((v) => (
          <label key={v} className="fd-seg__opt">
            <input type="radio" name={`${uid}-${key}`} value={v} checked={appearance[key] === v} onChange={() => setLook(key, v)} data-fd-look={`${key}-${v}`} />
            <span>{k(`look.${key}Opts.${v}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  const look = (
    <details className="fd-look" open={lookOpen} onToggle={(e) => setLookOpen(e.currentTarget.open)} data-fd="look">
      <summary>{k('look.title')}{!isDefaultAppearance(appearance) && <span className="fd-look__dot" aria-hidden="true" />}</summary>
      <div className="fd-look__body">
        {/* Palet seçici (Ahmet, 20.10.2026): küçük alanda ◀ ▶ ile gezilir, önizleme anında
            değişir; "Tamam" deyince seçim şekille kalır. */}
        {(() => {
          const all = APPEARANCE_OPTIONS.palette;
          const i = Math.max(0, all.indexOf(appearance.palette));
          const step = (d) => setLook('palette', all[(i + d + all.length) % all.length]);
          return (
            <div className="fd-pal" role="group" aria-label={k('look.palette')}>
              <span className="fd-seg__legend">{k('look.palette')}</span>
              <div className="fd-pal__row">
                <button type="button" className="fd-pal__arrow" onClick={() => step(-1)} aria-label={k('look.palettePrev')} data-fd-look="palette-prev"><ChevronLeft size={15} /></button>
                <div className="fd-pal__now" aria-live="polite" data-fd-look="palette" data-value={appearance.palette}>
                  <span className="fd-pal__chips" aria-hidden="true">
                    {paletteSwatch(appearance.palette).map((c, n) => <span key={n} style={{ background: c }} />)}
                  </span>
                  <span className="fd-pal__name">{k(`look.paletteOpts.${appearance.palette}`)}</span>
                  <small className="fd-pal__count">{i + 1}/{all.length}</small>
                </div>
                <button type="button" className="fd-pal__arrow" onClick={() => step(1)} aria-label={k('look.paletteNext')} data-fd-look="palette-next"><ChevronRight size={15} /></button>
              </div>
            </div>
          );
        })()}
        {/* Tema galerisi (WO-033; tablodaki Tasarım gibi): küçük resimler senin şeklinin o
            temayla çizilmiş hali; gruplar renkli / tek renk / baskı. */}
        {lookOpen && (
          <div className="fd-themes" data-fd="themes">
            {THEME_GROUPS.map(([group, keys]) => (
              <div key={group} className="fd-themes__group">
                <small className="fd-fam__label">{k(`look.group.${group}`)}</small>
                <div className="fd-themes__grid">
                  {keys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="fd-theme"
                      aria-pressed={appearance.palette === key}
                      onClick={() => setLook('palette', key)}
                      title={k(`look.paletteOpts.${key}`)}
                      data-fd-theme={key}
                    >
                      {thumbs[key] && <span className="fd-theme__img" dangerouslySetInnerHTML={{ __html: thumbs[key] }} />}
                      <span className="fd-theme__chips" aria-hidden="true">{paletteSwatch(key).map((c, n) => <span key={n} style={{ background: c }} />)}</span>
                      <span className="fd-theme__name">{k(`look.paletteOpts.${key}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {onApplyAllChange && (
              <label className="fd-applyall">
                <input type="checkbox" checked={applyAll} onChange={(e) => onApplyAllChange(e.target.checked)} data-fd="apply-all" />
                {k('look.applyAll')}
              </label>
            )}
          </div>
        )}
        {segment('pattern', !patternOk)}
        {!patternOk && <small className="fd-look__note">{k('look.patternNone')}</small>}
        {segment('corners')}
        {ptBox}
      </div>
    </details>
  );
  const icon = (ty) => (ty === 'bar' || ty === 'barh' ? <BarChart3 size={14} /> : ty === 'line' ? <LineChart size={14} /> : <Shapes size={14} />);
  const typeBtn = (ty) => (
    <button key={ty} type="button" aria-pressed={type === ty} onClick={() => setType(ty)} data-fd-type={ty}>{icon(ty)} {k(`types.${ty}`)}</button>
  );

  return (
    <section className="fd" style={style} aria-label={k(mode === 'chart' ? 'chartTitle' : 'figureTitle')} data-testid="figure-draft" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (big) setBig(false); else onCancel(); } }}>
      <header className="fd-head">
        <span className="fd-badge">{k('draftBadge')}</span>
        {/* Şablon şeridi (WO-032): tek satır, yatay kaydırılır; aileler başlıkla ayrılır. */}
        <div ref={stripRef} className="fd-types" role="group" aria-label={k('type')}>
          {mode === 'chart' ? types.map(typeBtn) : FAMILIES.map(([fam, list]) => (
            <span key={fam} className="fd-fam">
              <small className="fd-fam__label">{k(`family.${fam}`)}</small>
              {list.map(typeBtn)}
            </span>
          ))}
        </div>
        <button type="button" className="fd-icon" onClick={onCancel} aria-label={k('cancel')} title={k('cancel')}><X size={15} /></button>
      </header>
      {big && preview ? (
        <div className="fd-big" data-fd="big">
          <div className="fd-big__bar">
            <strong className="fd-big__title">{k('big.title')}</strong>
            <label className="fd-big__width">
              <span>{k('big.width')}</span>
              <input type="range" min={WIDTH_RANGE.min} max={WIDTH_RANGE.max} step={WIDTH_RANGE.step} value={appearance.width} onChange={(e) => setLook('width', Number(e.target.value))} data-fd="width" />
              <output>%{appearance.width}</output>
            </label>
            {ptBox}
            {segment('corners')}
            {segment('pattern', !patternOk)}
            <button type="button" className="fd-btn" onClick={() => setLook('width', 100)} disabled={appearance.width === 100} data-fd="width-reset">{k('big.reset')}</button>
            <button type="button" className="fd-btn fd-btn--primary" onClick={() => setBig(false)} data-fd="big-done"><Check size={14} /> {k('big.done')}</button>
          </div>
          {/* Sahne: beyaz sayfa sütunu; şekil o sütunun yüzdesi kadar, ortalı (belgede ve Word'de de böyle). */}
          <div className="fd-big__stage">
            <div ref={stageRef} className="fd-big__page">
              <div className="fd-big__fig" style={{ width: `${appearance.width}%` }}>
                <div className="fd-svg" dangerouslySetInnerHTML={{ __html: preview.svg }} />
                <span
                  className="fd-big__handle"
                  role="slider"
                  tabIndex={0}
                  aria-label={k('big.width')}
                  aria-valuemin={WIDTH_RANGE.min}
                  aria-valuemax={WIDTH_RANGE.max}
                  aria-valuenow={appearance.width}
                  onPointerDown={onHandleDown}
                  onKeyDown={onHandleKey}
                  data-fd="handle"
                />
              </div>
            </div>
            <small className="fd-big__note">{k('big.note')}</small>
          </div>
        </div>
      ) : (
      <div className="fd-body">
        <div className="fd-edit">{editor}{look}</div>
        <div className="fd-preview" aria-live="polite">
          {/* Önizlemenin sağ üstünde minik "Düzenle" (WO-035): büyük düzenleme ekranını açar. */}
          {preview && (
            <button type="button" className="fd-bigbtn" onClick={() => setBig(true)} title={k('big.open')} data-fd="big-edit">
              <Maximize2 size={12} /> {k('big.open')}
            </button>
          )}
          {/* Önizleme bizim çizicimizin, kaçışlı SVG'si. */}
          {preview ? <div className="fd-svg" dangerouslySetInnerHTML={{ __html: preview.svg }} /> : <p className="fd-empty">{k(CHART_TYPES.includes(type) ? 'needData' : 'needItems')}</p>}
          {preview?.skipped > 0 && <small className="fd-warn">{k('skipped', { n: preview.skipped })}</small>}
          {preview?.hidden > 0 && <small className="fd-warn" data-fd="hidden">{k('hiddenItems', { n: preview.hidden })}</small>}
        </div>
      </div>
      )}
      <footer className="fd-foot">
        <label className="fd-caption">
          <span>{word} {number}.</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={k('captionPlaceholder')} aria-label={k('captionLabel')} data-fd="caption" />
        </label>
        <button type="button" className="fd-btn" onClick={onCancel} data-action="fd-cancel">{k('cancel')}</button>
        <button type="button" className="fd-btn fd-btn--primary" onClick={() => preview && onDone({ type, data: isDefaultAppearance(appearance) ? data : { ...data, appearance }, title, svg: preview.svg })} disabled={!preview} data-action="fd-done">
          <Check size={14} /> {k('done')}
        </button>
      </footer>
    </section>
  );
}
