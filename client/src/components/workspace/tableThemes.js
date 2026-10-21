/**
 * Tablo tasarımı (WO-031): Word'ün "Tablo Tasarımı" gibi tema + seçenekler.
 *
 * Tek kaynak: ekrandaki CSS (`themeCss`) ve Word çıktısı (`cellLook`,
 * `tableBorders`) aynı tema verisinden üretilir; ekranda ne görünüyorsa
 * Word'e o gider. Tema tabloya `data-theme` olarak, seçenekler
 * `data-total` / `data-band` / `data-firstcol` olarak yazılır; başlık satırı
 * bugünkü gibi `<thead>` ile. `data-theme` yoksa tablo APA'dır (bugünkü görünüm).
 *
 * APA 7 gölgelendirmeden kaçınır ve dikey çizgi kullanmaz; renkli temalar
 * `apa: false` taşır ve seçicide "APA dışı" diye gösterilir.
 * Renkler: araştırma raporu (WCAG kontrast hesaplı) + Color Hunt seçkisi
 * (`docs/design/tema-ve-tablo-tasarimi.md`, `mockup-paletler.html`).
 *
 * `rules`: çizgi düzeni —
 *   apa      üst ve alt kalın, başlık altı ince
 *   booktabs üst ve alt daha kalın, başlık altı ince (LaTeX booktabs)
 *   grid     bütün hücreler ince çizgili
 *   rows     satırlar arası ince yatay çizgi, altta koyu çizgi
 *   head     yalnız başlık altında vurgu çizgisi ve altta koyu çizgi
 *   none     çizgi yok (zemin renkleri ayırır)
 */

export const TABLE_THEMES = [
  { id: 'apa', head: null, headInk: '000000', band: null, rule: '000000', rules: 'apa', apa: true },
  { id: 'booktabs', head: null, headInk: '000000', band: null, rule: '000000', rules: 'booktabs', apa: true },
  { id: 'izgara', head: 'F2F2F2', headInk: '111827', band: null, rule: 'BFBFBF', rules: 'grid', apa: false },
  { id: 'baski', head: 'D9D9D9', headInk: '111827', band: 'F2F2F2', rule: '808080', rules: 'rows', apa: false },
  { id: 'lacivert', head: '1E3A5F', headInk: 'FFFFFF', band: 'EEF2F7', rule: '1E3A5F', rules: 'head', apa: false },
  { id: 'denizYesili', head: '134E4A', headInk: 'FFFFFF', band: 'E6F2F1', rule: '9CC5C1', rules: 'rows', apa: false },
  { id: 'kiremit', head: '7C2D12', headInk: 'FFFFFF', band: 'FDF2E9', rule: 'E3BFA6', rules: 'rows', apa: false },
  { id: 'civit', head: '312E81', headInk: 'FFFFFF', band: 'EEF0FB', rule: 'C3C6EC', rules: 'rows', apa: false },
  { id: 'murdum', head: '3B0764', headInk: 'FFFFFF', band: 'F5F0FA', rule: 'D7C6E8', rules: 'rows', apa: false },
  { id: 'komur', head: '404040', headInk: 'FFFFFF', band: 'F2F2F2', rule: '404040', rules: 'none', apa: false },
  { id: 'wordMavi', head: '4472C4', headInk: 'FFFFFF', band: 'D9E2F3', rule: '8EAADB', rules: 'grid', apa: false },
  { id: 'civitGece', head: '201658', headInk: 'FFFFFF', band: 'F9E8C9', rule: '98ABEE', rules: 'rows', apa: false },
  { id: 'lacivertKum', head: '222831', headInk: 'FFFFFF', band: 'ECECEC', rule: 'C1A57B', rules: 'head', apa: false },
  { id: 'denizci', head: '142D4C', headInk: 'FFFFFF', band: 'ECECEC', rule: '9FD3C7', rules: 'rows', apa: false },
  { id: 'petrol', head: '06202B', headInk: 'FFFFFF', band: 'E6F4F1', rule: '077A7D', rules: 'head', apa: false },
  { id: 'orman', head: '1E5128', headInk: 'FFFFFF', band: 'EEF5E4', rule: '4E9F3D', rules: 'rows', apa: false },
  { id: 'morGece', head: '280B45', headInk: 'FFFFFF', band: 'FFF6D6', rule: 'C84771', rules: 'head', apa: false },
  { id: 'tasAdacayi', head: '181D31', headInk: 'FFFFFF', band: 'F0E9D2', rule: '678983', rules: 'rows', apa: false },
  { id: 'geceKirmizi', head: '171717', headInk: 'FFFFFF', band: 'EDEDED', rule: 'DA0037', rules: 'head', apa: false },
  { id: 'gunBatimi', head: '6A2C70', headInk: 'FFFFFF', band: 'F6F3EA', rule: 'F08A5D', rules: 'rows', apa: false },
];

const BY_ID = Object.fromEntries(TABLE_THEMES.map((th) => [th.id, th]));
export const DEFAULT_TABLE_THEME = 'apa';
export const FLAGS = ['total', 'band', 'firstcol'];

/** Kimliğe göre tema; bilinmeyen ya da yoksa APA. */
export const themeById = (id) => BY_ID[id] || BY_ID.apa;
/** Tablonun teması; bilinmeyen ya da yoksa APA. */
export const themeOf = (table) => BY_ID[table?.dataset?.theme] || BY_ID.apa;
/** Tablonun seçenekleri: başlık (thead), toplam, bant, ilk sütun. */
export const flagsOf = (table) => ({
  header: Boolean(table?.tHead && table.tHead.rows.length),
  total: table?.dataset?.total === '1',
  band: table?.dataset?.band === '1',
  firstcol: table?.dataset?.firstcol === '1',
});

// Çizgi kalınlıkları: ekranda px, Word'de sekizde bir punto.
const W = { thin: [1, 4], mid: [1.5, 8], thick: [2, 12] };
/** Bir tema için çizgiler: { top, headBottom, bottom, innerH, innerV, totalTop }; her biri [renk, kalınlık] ya da null. */
export function themeRules(th) {
  const strong = th.head || '000000';
  switch (th.rules) {
    case 'apa': return { top: [th.rule, 'mid'], headBottom: [th.rule, 'thin'], bottom: [th.rule, 'mid'], innerH: null, innerV: null, totalTop: [th.rule, 'thin'] };
    case 'booktabs': return { top: [th.rule, 'thick'], headBottom: [th.rule, 'thin'], bottom: [th.rule, 'thick'], innerH: null, innerV: null, totalTop: [th.rule, 'thin'] };
    case 'grid': return { top: [th.rule, 'thin'], headBottom: [th.rule, 'thin'], bottom: [th.rule, 'thin'], innerH: [th.rule, 'thin'], innerV: [th.rule, 'thin'], totalTop: [strong, 'mid'], sides: [th.rule, 'thin'] };
    case 'rows': return { top: null, headBottom: null, bottom: [strong, 'mid'], innerH: [th.rule, 'thin'], innerV: null, totalTop: [strong, 'mid'] };
    case 'head': return { top: null, headBottom: [th.rule, 'thick'], bottom: [strong, 'mid'], innerH: null, innerV: null, totalTop: [strong, 'thin'] };
    default: return { top: null, headBottom: null, bottom: null, innerH: null, innerV: null, totalTop: [strong, 'thin'] };
  }
}

const css = (line) => (line ? `${W[line[1]][0]}px solid #${line[0]}` : '0 none');

/**
 * Ekran CSS'i: her tema için değişkenler + ortak kurallar. Seçici sayfaya bağlı
 * değil; tasarım galerisindeki küçük önizlemeler de aynı kuralı kullanır.
 */
export function themeCss() {
  const vars = TABLE_THEMES.filter((th) => th.id !== 'apa').map((th) => {
    const r = themeRules(th);
    return `table.wx-vtable[data-theme="${th.id}"]{--tt-head:${th.head ? `#${th.head}` : 'transparent'};--tt-head-ink:#${th.headInk};`
      + `--tt-band:${th.band ? `#${th.band}` : 'transparent'};--tt-top:${css(r.top)};--tt-headline:${css(r.headBottom)};`
      + `--tt-bottom:${css(r.bottom)};--tt-inner-h:${css(r.innerH)};--tt-inner-v:${css(r.innerV)};--tt-total:${css(r.totalTop)};--tt-sides:${css(r.sides)}}`;
  }).join('\n');
  return `${vars}
table.wx-vtable[data-theme]:not([data-theme="apa"]){border-collapse:collapse;border-top:var(--tt-top);border-bottom:var(--tt-bottom);border-left:var(--tt-sides);border-right:var(--tt-sides)}
table.wx-vtable[data-theme]:not([data-theme="apa"]) :is(th,td){border:0 none;border-top:var(--tt-inner-h);border-left:var(--tt-inner-v)}
table.wx-vtable[data-theme]:not([data-theme="apa"]) :is(th,td):first-child{border-left:0 none}
table.wx-vtable[data-theme]:not([data-theme="apa"]) thead th{background:var(--tt-head);color:var(--tt-head-ink);border-top:0 none;border-bottom:var(--tt-headline)}
table.wx-vtable[data-theme]:not([data-theme="apa"]) tbody tr:first-child :is(th,td){border-top:0 none}
table.wx-vtable[data-theme]:not([data-theme="apa"])[data-band="1"] tbody tr:nth-child(even) :is(th,td){background:var(--tt-band)}
table.wx-vtable[data-total="1"] tbody tr:last-child :is(th,td){font-weight:700;border-top:var(--tt-total, 1px solid #000)}
table.wx-vtable[data-firstcol="1"] tbody :is(th,td):first-child{font-weight:700}`;
}

/**
 * Word için bir hücrenin görünümü. `pos`: { head, rowInBody, lastBody, col }.
 * Dönen: { fill, ink, bold, borders } — renkler '#'sız hex; kenarlık [renk, kalınlık].
 */
export function cellLook(th, flags, pos) {
  const r = themeRules(th);
  const out = { fill: null, ink: null, bold: false, borders: {} };
  if (pos.head) {
    out.fill = th.head;
    out.ink = th.head ? th.headInk : null;
    out.bold = true;
    if (r.headBottom) out.borders.bottom = r.headBottom;
    return out;
  }
  if (flags.band && th.band && pos.rowInBody % 2 === 1) out.fill = th.band;
  if (flags.total && pos.lastBody) {
    out.bold = true;
    if (r.totalTop) out.borders.top = r.totalTop;
  }
  if (flags.firstcol && pos.col === 0) out.bold = true;
  return out;
}

/** Word tablo kenarlıkları (tablo düzeyi). */
export function tableBorders(th) {
  const r = themeRules(th);
  return { top: r.top, bottom: r.bottom, insideHorizontal: r.innerH, insideVertical: r.innerV, left: r.sides || null, right: r.sides || null };
}

/** Kalınlık adı → Word sekizde bir punto. */
export const wordSize = (name) => W[name][1];
