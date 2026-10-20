// Şekil ve grafik çizici (WO-028). Saf: veri → SVG dizgesi; DOM'a dokunmaz.
//
// Kurallar (S1 ölçütleri): yalnız <rect>/<path>/<line>/<circle>/<text>/<tspan>
// (+ desen için <defs>/<pattern>/<marker>); foreignObject yok, dış istek yok;
// metin kelime ortasında kırılmaz (sığmayan tek kelime küçültülür). Bütün
// etiketler kullanıcıdan ya da paragraftan gelir; çizici hiçbir metin ya da
// sayı uydurmaz (tüzük 2.8).
//
// Görünüm (WO-030 Faz 4): palet, desen, köşe, yazı boyutu. Varsayılan görünüm
// bugünkü çıktının birebir aynısıdır (birim testi bunu bayt bayt doğrular).
// Renk anlamı tek başına taşımaz: öğeler etiketlidir; desen seçilince öğeler
// dönüşümlü desenle de ayrışır (siyah-beyaz baskı, renk körlüğü).

export const FIGURE_TYPES = ['steps', 'cycle', 'compare', 'timeline'];
export const CHART_TYPES = ['bar', 'line'];

const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';
const THEME = {
  ink: '#0f172a', muted: '#475569', line: '#cbd5e1', soft: '#eef0ff', accent: '#4f46e5', accent2: '#7c3aed', paper: '#ffffff',
  grid: '#eef0f5', hatch: '#a5b4fc',
};
const PALETTES = {
  default: THEME,
  gray: {
    ink: '#111111', muted: '#4a4a4a', line: '#bdbdbd', soft: '#f0f0f0', accent: '#3a3a3a', accent2: '#6e6e6e', paper: '#ffffff',
    grid: '#ececec', hatch: '#a8a8a8',
  },
  // Okabe–Ito: mavi #0072B2, kırmızımsı turuncu #D55E00 (renk körlüğünde ayrışır).
  cvd: {
    ink: '#0f172a', muted: '#475569', line: '#cbd5e1', soft: '#e5f1f8', accent: '#0072B2', accent2: '#D55E00', paper: '#ffffff',
    grid: '#eef0f5', hatch: '#8fbfdc',
  },
  // Siyah-beyaz baskı: siyah, beyaz, griler; kalın çerçeve.
  bw: {
    ink: '#000000', muted: '#333333', line: '#808080', soft: '#ffffff', accent: '#000000', accent2: '#4d4d4d', paper: '#ffffff',
    grid: '#d9d9d9', hatch: '#8c8c8c', strong: true,
  },
};

export const APPEARANCE_DEFAULT = Object.freeze({ palette: 'default', pattern: 'solid', corners: 'round', text: 'normal' });
export const APPEARANCE_OPTIONS = Object.freeze({
  palette: ['default', 'gray', 'cvd', 'bw'],
  pattern: ['solid', 'stripes', 'dots'],
  corners: ['round', 'square'],
  text: ['small', 'normal', 'large'],
});
/** Desenin etkilediği türler (alanı/kutusu olanlar). Çizgi ve zaman çizelgesinde desen yok. */
export const PATTERN_TYPES = ['bar', 'steps', 'cycle', 'compare'];
const TEXT_SCALE = { small: 0.88, normal: 1, large: 1.15 };

/** Bilinmeyen ya da eksik değerleri varsayılana çeker. */
export function normalizeAppearance(a) {
  const out = {};
  for (const key of Object.keys(APPEARANCE_DEFAULT)) {
    out[key] = APPEARANCE_OPTIONS[key].includes(a?.[key]) ? a[key] : APPEARANCE_DEFAULT[key];
  }
  return out;
}
export const isDefaultAppearance = (a) => {
  const n = normalizeAppearance(a);
  return Object.keys(APPEARANCE_DEFAULT).every((key) => n[key] === APPEARANCE_DEFAULT[key]);
};

let seq = 0;
/** Belge içinde çakışmayan kimlik öneki (bir belgede birden çok şekil olabilir). */
export const newDrawId = () => `v${Math.random().toString(36).slice(2, 7)}${(seq += 1).toString(36)}`;

const round1 = (v) => Math.round(v * 10) / 10;
const STRIPE_ANGLES = [45, 135, 90, 0];
const DOTS = [{ s: 7, r: 1.6 }, { s: 10, r: 3 }, { s: 5, r: 1 }, { s: 12, r: 2.2, stagger: true }];

/**
 * Bir çizim için görünüm yardımcıları. Varsayılanda her yardımcı girdiyi aynen
 * döndürür; böylece çıktı bugünküyle bayt bayt aynı kalır.
 */
function look(appearance, uid) {
  const ap = normalizeAppearance(appearance);
  const th = PALETTES[ap.palette];
  const ts = TEXT_SCALE[ap.text];
  const id = uid || newDrawId();
  const patterns = new Map(); // anahtar → { id, def }
  const fs = (v) => (ts === 1 ? v : round1(v * ts));
  const rx = (v) => (ap.corners === 'square' ? 0 : v);
  const sw = (v) => (th.strong ? round1(v * 1.6) : v);
  const markerId = ap.palette === 'default' ? 'ah' : `${id}-ah`;
  /** i. öğenin dolgusu: desen yoksa `base`; varsa dönüşümlü desen (`ink` çizgileri, `base` zemin). */
  const fill = (i, base, ink, weight = 2.4) => {
    if (ap.pattern === 'solid') return base;
    const v = i % 4;
    const key = `${ap.pattern}|${v}|${base}|${ink}|${weight}`;
    if (!patterns.has(key)) {
      const pid = `${id}-p${patterns.size}`;
      let def;
      if (ap.pattern === 'stripes') {
        def = `<pattern id="${pid}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(${STRIPE_ANGLES[v]})"><rect width="8" height="8" fill="${base}"/><line x1="0" y1="0" x2="0" y2="8" stroke="${ink}" stroke-width="${weight}"/></pattern>`;
      } else {
        const d = DOTS[v];
        const r = round1(d.r * (weight / 2.4));
        def = `<pattern id="${pid}" patternUnits="userSpaceOnUse" width="${d.s}" height="${d.s}"><rect width="${d.s}" height="${d.s}" fill="${base}"/><circle cx="${d.s / 2}" cy="${d.s / 2}" r="${r}" fill="${ink}"/>${
          d.stagger ? `<circle cx="0" cy="0" r="${r}" fill="${ink}"/><circle cx="${d.s}" cy="0" r="${r}" fill="${ink}"/><circle cx="0" cy="${d.s}" r="${r}" fill="${ink}"/><circle cx="${d.s}" cy="${d.s}" r="${r}" fill="${ink}"/>` : ''}</pattern>`;
      }
      patterns.set(key, { id: pid, def });
    }
    return `url(#${patterns.get(key).id})`;
  };
  const defs = () => (patterns.size ? `<defs>${[...patterns.values()].map((p) => p.def).join('')}</defs>` : '');
  return { ap, th, fs, rx, sw, markerId, fill, defs, patterned: ap.pattern !== 'solid', strong: !!th.strong };
}

const CHAR_W = 0.56; // ortalama harf genişliği / punto (Latin + Türkçe, ölçülmüş yaklaşık)

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Metni genişliğe göre satırlara böler; kelime bölünmez. Satır sınırı aşılırsa
 * punto küçülür (en az 9). Dönen: { lines, size }.
 */
export function wrapText(text, width, { size = 13, maxLines = 4, minSize = 9 } = {}) {
  const words = clean(text).split(' ').filter(Boolean);
  if (!words.length) return { lines: [''], size };
  for (let s = size; s >= minSize; s -= 1) {
    const perLine = Math.max(1, Math.floor(width / (s * CHAR_W)));
    if (words.some((w) => w.length > perLine)) continue; // kelime ortası kırma yok
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length <= perLine) cur = next;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines) return { lines, size: s };
  }
  // En küçük puntoda da sığmıyorsa satırlar kesilir ve "…" ile biter (kelime bütün).
  const s = minSize;
  const perLine = Math.max(1, Math.floor(width / (s * CHAR_W)));
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= perLine) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const kept = lines.slice(0, maxLines);
  if (lines.length > maxLines) kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s*\S*$/, '')} …`.trim();
  return { lines: kept, size: s };
}

function textBlock(text, cx, cy, width, opts = {}) {
  const { lines, size } = wrapText(text, width, opts);
  const lh = size * 1.25;
  const top = cy - ((lines.length - 1) * lh) / 2;
  const weight = opts.weight || 500;
  const fill = opts.fill || THEME.ink;
  return `<text x="${cx}" y="${top}" font-family='${FONT}' font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle" dominant-baseline="middle">${
    lines.map((l, i) => `<tspan x="${cx}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`;
}

const svg = (w, h, body, label, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}"><rect width="${w}" height="${h}" fill="${THEME.paper}"/>${defs}${body}</svg>`;
const arrowDef = (L) => `<defs><marker id="${L.markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${L.th.accent}"/></marker></defs>`;

/** Akış: kutular soldan sağa, oklarla; 4'ten fazlası iki satıra iner. */
export function drawSteps(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const list = items.map(clean).filter(Boolean);
  const n = Math.max(1, list.length);
  const perRow = n <= 4 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / perRow);
  const W = 640; const gap = 34; const boxW = Math.min(150, (W - 40 - gap * (perRow - 1)) / perRow); const boxH = 74;
  const H = 40 + rows * boxH + (rows - 1) * 44;
  let body = arrowDef(L);
  const pos = list.map((_, i) => {
    const r = Math.floor(i / perRow); const c = i % perRow;
    const rowW = perRow * boxW + (perRow - 1) * gap;
    return { x: (W - rowW) / 2 + c * (boxW + gap), y: 20 + r * (boxH + 44) };
  });
  list.forEach((t, i) => {
    const { x, y } = pos[i];
    body += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="${L.rx(10)}" fill="${L.fill(i, th.soft, th.hatch, 1)}" stroke="${th.accent}" stroke-width="${L.sw(1.2)}"/>`;
    body += `<text x="${x + 10}" y="${y + 13}" font-family='${FONT}' font-size="${L.fs(10)}" font-weight="700" fill="${th.accent}">${i + 1}</text>`;
    body += textBlock(t, x + boxW / 2, y + boxH / 2 + 3, boxW - 18, { size: L.fs(12.5), maxLines: 3, fill: th.ink });
    if (i < list.length - 1) {
      const a = pos[i]; const b = pos[i + 1];
      body += a.y === b.y
        ? `<line x1="${a.x + boxW + 4}" y1="${a.y + boxH / 2}" x2="${b.x - 4}" y2="${b.y + boxH / 2}" stroke="${th.accent}" stroke-width="${L.sw(1.6)}" marker-end="url(#${L.markerId})"/>`
        : `<path d="M${a.x + boxW / 2} ${a.y + boxH + 4} V${a.y + boxH + 22} H${b.x + boxW / 2} V${b.y - 4}" fill="none" stroke="${th.accent}" stroke-width="${L.sw(1.6)}" marker-end="url(#${L.markerId})"/>`;
    }
  });
  return svg(W, H, body, label || list.join(' → '), L.defs());
}

/** Döngü: öğeler çember üzerinde, saat yönünde oklarla; son öğe ilke döner. */
export function drawCycle(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const list = items.map(clean).filter(Boolean);
  const n = Math.max(1, list.length);
  const W = 560; const H = 420; const cx = W / 2; const cy = H / 2; const R = 150; const boxW = 128; const boxH = 58;
  let body = arrowDef(L) + `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${th.line}" stroke-dasharray="4 5"/>`;
  const pts = list.map((_, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), ang };
  });
  // Oklar kutuların arasındaki yay üzerinde.
  pts.forEach((p, i) => {
    if (n < 2) return;
    const q = pts[(i + 1) % n];
    const a1 = p.ang + 0.32; const a2 = (i + 1 === n ? q.ang + 2 * Math.PI : q.ang) - 0.32;
    const x1 = cx + R * Math.cos(a1); const y1 = cy + R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2); const y2 = cy + R * Math.sin(a2);
    body += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${th.accent}" stroke-width="${L.sw(1.8)}" marker-end="url(#${L.markerId})"/>`;
  });
  list.forEach((t, i) => {
    const { x, y } = pts[i];
    body += `<rect x="${x - boxW / 2}" y="${y - boxH / 2}" width="${boxW}" height="${boxH}" rx="${L.rx(12)}" fill="${L.fill(i, th.paper, th.hatch, 1)}" stroke="${th.accent}" stroke-width="${L.sw(1.3)}"/>`;
    body += textBlock(t, x, y, boxW - 16, { size: L.fs(12.5), maxLines: 3, fill: th.ink });
  });
  return svg(W, H, body, label || list.join(' → '), L.defs());
}

/** Karşılaştırma: iki sütun, başlık + maddeler. */
export function drawCompare({ leftTitle = '', rightTitle = '', left = [], right = [] }, { label = '', appearance, uid } = {}) {
  const Lk = look(appearance, uid); const { th } = Lk;
  const L = left.map(clean).filter(Boolean); const Rr = right.map(clean).filter(Boolean);
  const rows = Math.max(L.length, Rr.length, 1);
  const W = 640; const colW = 280; const gap = 40; const x1 = (W - 2 * colW - gap) / 2; const x2 = x1 + colW + gap;
  const rowH = 46; const H = 20 + 50 + rows * rowH + 16;
  let body = '';
  const col = (x, title, list, color, i) => {
    let out = `<rect x="${x}" y="20" width="${colW}" height="${H - 36}" rx="${Lk.rx(12)}" fill="${Lk.fill(i, th.paper, th.hatch, 1)}" stroke="${Lk.strong ? th.ink : th.line}"${Lk.strong ? ` stroke-width="${Lk.sw(1)}"` : ''}/>`;
    out += `<rect x="${x}" y="20" width="${colW}" height="44" rx="${Lk.rx(12)}" fill="${color}"/><rect x="${x}" y="52" width="${colW}" height="12" fill="${color}"/>`;
    out += textBlock(title, x + colW / 2, 42, colW - 24, { size: Lk.fs(14), weight: 700, fill: '#ffffff', maxLines: 1 });
    list.forEach((t, k) => {
      const y = 64 + k * rowH + rowH / 2 + 4;
      out += `<circle cx="${x + 18}" cy="${y}" r="3.5" fill="${color}"/>`;
      const { lines, size } = wrapText(t, colW - 46, { size: Lk.fs(12.5), maxLines: 2 });
      const lh = size * 1.25;
      out += `<text x="${x + 30}" y="${y - ((lines.length - 1) * lh) / 2}" font-family='${FONT}' font-size="${size}" fill="${th.ink}" dominant-baseline="middle">${lines.map((l, j) => `<tspan x="${x + 30}" dy="${j ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`;
    });
    return out;
  };
  body += col(x1, leftTitle, L, th.accent, 0) + col(x2, rightTitle, Rr, th.accent2, 1);
  return svg(W, H, body, label || `${leftTitle} / ${rightTitle}`, Lk.defs());
}

/** Zaman çizelgesi: yatay eksen, tarih üstte, olay altta (dönüşümlü). */
export function drawTimeline(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const list = items.map((it) => ({ date: clean(it.date), text: clean(it.text) })).filter((it) => it.date || it.text);
  const n = Math.max(1, list.length);
  const W = 640; const H = 260; const y = 130; const x0 = 40; const x1 = W - 40;
  const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${th.line}" stroke-width="${L.sw(3)}" stroke-linecap="round"/>`;
  const slot = Math.min(150, n > 1 ? step - 8 : 300);
  list.forEach((it, i) => {
    const x = n > 1 ? x0 + i * step : W / 2;
    const up = i % 2 === 0;
    body += `<circle cx="${x}" cy="${y}" r="7" fill="${th.accent}" stroke="#fff" stroke-width="2"/>`;
    body += `<line x1="${x}" y1="${up ? y - 10 : y + 10}" x2="${x}" y2="${up ? y - 30 : y + 30}" stroke="${th.line}"/>`;
    body += textBlock(it.date, x, up ? y - 44 : y + 44, slot, { size: L.fs(13), weight: 700, fill: th.accent, maxLines: 1 });
    body += textBlock(it.text, x, up ? y - 82 : y + 82, slot, { size: L.fs(11.5), fill: th.ink, maxLines: 3 });
  });
  return svg(W, H, body, label || list.map((it) => it.date).join(' – '), L.defs());
}

/** Sayı okuma: "3,4" ve "3.4" (Türkçe ondalık virgül). Sayı değilse null. */
export function parseNumber(value) {
  const s = String(value ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  const normal = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.');
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) || v;
}

/**
 * Grafik: { rows: [{label, value}], unit, xTitle, yTitle }. Değer kullanıcıdan;
 * sayı olmayan satır çizilmez ve `skipped` sayısı döner (arayüz söyler, 2.8).
 */
export function drawChart(type, { rows = [], unit = '', xTitle = '', yTitle = '' }, { label = '', locale = 'tr-TR', appearance, uid } = {}) {
  const Lk = look(appearance, uid); const { th } = Lk;
  const data = rows.map((r) => ({ label: clean(r.label), value: parseNumber(r.value) })).filter((r) => r.label || r.value != null);
  const valid = data.filter((r) => r.value != null);
  const skipped = data.length - valid.length;
  const W = 640; const H = 360; const L = 64; const R = 20; const T = 24; const B = 70;
  const pw = W - L - R; const ph = H - T - B;
  const min = Math.min(0, ...valid.map((r) => r.value));
  const max = niceMax(Math.max(0, ...valid.map((r) => r.value)));
  const yOf = (v) => T + ph - ((v - min) / (max - min || 1)) * ph;
  const fmt = (v) => Number(v).toLocaleString(locale, { maximumFractionDigits: 2 });
  let body = '';
  for (let i = 0; i <= 4; i += 1) {
    const v = min + ((max - min) * i) / 4; const y = yOf(v);
    body += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="${th.grid}"/>`;
    body += `<text x="${L - 8}" y="${y}" font-family='${FONT}' font-size="${Lk.fs(10.5)}" fill="${th.muted}" text-anchor="end" dominant-baseline="middle">${esc(fmt(v))}</text>`;
  }
  body += `<line x1="${L}" y1="${yOf(0)}" x2="${W - R}" y2="${yOf(0)}" stroke="${th.muted}"${Lk.strong ? ` stroke-width="${Lk.sw(1)}"` : ''}/>`;
  const n = Math.max(1, valid.length); const band = pw / n;
  if (type === 'line') {
    const pts = valid.map((r, i) => [L + band * i + band / 2, yOf(r.value)]);
    if (pts.length > 1) body += `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')}" fill="none" stroke="${th.accent}" stroke-width="${Lk.sw(2.2)}"/>`;
    pts.forEach(([x, y], i) => {
      body += `<circle cx="${x}" cy="${y}" r="4" fill="${th.accent}"/>`;
      body += `<text x="${x}" y="${y - 10}" font-family='${FONT}' font-size="${Lk.fs(10.5)}" fill="${th.ink}" text-anchor="middle">${esc(fmt(valid[i].value))}</text>`;
    });
  } else {
    const bw = Math.min(56, band * 0.62);
    // Desenli ya da siyah-beyazda çubuk çerçeveli; böylece beyaz zeminde de görünür.
    const outline = Lk.patterned || Lk.strong ? ` stroke="${th.accent}" stroke-width="${Lk.sw(1.2)}"` : '';
    valid.forEach((r, i) => {
      const x = L + band * i + (band - bw) / 2; const y0 = yOf(0); const y = yOf(r.value);
      body += `<rect x="${x}" y="${Math.min(y, y0)}" width="${bw}" height="${Math.max(1, Math.abs(y0 - y))}" rx="${Lk.rx(3)}" fill="${Lk.patterned ? Lk.fill(i, th.paper, th.accent) : th.accent}"${outline}/>`;
      body += `<text x="${x + bw / 2}" y="${Math.min(y, y0) - 6}" font-family='${FONT}' font-size="${Lk.fs(10.5)}" fill="${th.ink}" text-anchor="middle">${esc(fmt(r.value))}</text>`;
    });
  }
  valid.forEach((r, i) => {
    body += textBlock(r.label, L + band * i + band / 2, H - B + 20, band - 6, { size: Lk.fs(11), maxLines: 2, fill: th.muted });
  });
  if (yTitle || unit) body += `<text x="16" y="${T + ph / 2}" font-family='${FONT}' font-size="${Lk.fs(11.5)}" font-weight="600" fill="${th.muted}" text-anchor="middle" transform="rotate(-90 16 ${T + ph / 2})">${esc([yTitle, unit && `(${unit})`].filter(Boolean).join(' '))}</text>`;
  if (xTitle) body += `<text x="${L + pw / 2}" y="${H - 12}" font-family='${FONT}' font-size="${Lk.fs(11.5)}" font-weight="600" fill="${th.muted}" text-anchor="middle">${esc(xTitle)}</text>`;
  return { svg: svg(W, H, body, label || yTitle || xTitle || 'grafik', Lk.defs()), skipped, count: valid.length };
}

/** Paragraf metnini cümlelere böler (şekil öğesi olarak önermek için; kullanıcı düzenler). */
export function sentencesOf(text) {
  return clean(text).split(/(?<=[.!?…])\s+(?=[A-ZÇĞİÖŞÜ0-9“"(])/u).map((s) => s.replace(/[.!?…]+$/u, '').trim()).filter(Boolean);
}
