/**
 * Galeriden gelen yeni şablonlar (WO-032; `docs/design/mockup-sekil-galerisi.html`).
 *
 * Kurallar `draw.js` ile aynı:
 * - Saf SVG, dış istek yok, metin modelden geçmez (kullanıcının yazdığı ya da paragraftan).
 * - Palet rolleri: ayrıntı (`ink`: yazı, kenar, eksen), veri (`accent`), vurgu (`accent2`:
 *   tek öne çıkan öğe, oklar, işaretler), zemin (`soft`).
 * - Sayılar yalnız kullanıcının girdiğinden; hesaplanan tek şey fark ve oran (huni, halka).
 * - Şablona sığmayan öğe silinmez: çizici `{ svg, hidden }` döner, taslak alanı söyler.
 *
 * Satır sözdizimi (taslak alanında her şablonun ipucu gösterilir):
 *   "Başlık: a, b, c"  → başlık + alt öğeler (ağaç, zihin haritası, balık kılçığı, sütunlar, Venn)
 *   "A -> B : etiket"  → ilişki (kavram haritası)
 *   "+ gerekçe" / "- itiraz" → argüman haritası
 *   "Öğe +" / "Öğe -" → bir sonrakine etkinin yönü (etki zinciri, geri besleme)
 *   "Etiket: 1200"     → sayılı katman (huni)
 */
import { drawKit, parseNumber } from './draw.js';

const { look, textBlock, wrapText, svg, arrowDef, clean, esc, mix, FONT } = drawKit;

// --- Yardımcılar --------------------------------------------------------------

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Zemine göre okunur yazı rengi: koyu zeminde beyaz, açıkta temanın koyusu. */
const inkOn = (bg, th) => (lum(bg) < 0.35 ? '#ffffff' : th.ink);
const r1 = (v) => Math.round(v * 10) / 10;

/** "Başlık: a, b; c" → { head, parts }. İki nokta yoksa yalnız başlık. */
export function splitHead(line) {
  const s = clean(line);
  const i = s.indexOf(':');
  if (i < 0) return { head: s, parts: [] };
  return { head: s.slice(0, i).trim(), parts: s.slice(i + 1).split(/[,;]/).map((p) => p.trim()).filter(Boolean) };
}
/** "Öğe +" → { text: 'Öğe', sign: '+' }; işaret yoksa null. */
export function splitSign(line) {
  const s = clean(line);
  const m = s.match(/^(.*?)\s*([+\-−])$/);
  return m && m[1] ? { text: m[1], sign: m[2] === '+' ? '+' : '−' } : { text: s, sign: null };
}
/** "A -> B : etiket" (ya da →) → { from, to, label }; ilişki değilse null. */
export function splitRelation(line) {
  const s = clean(line);
  const m = s.match(/^(.+?)\s*(?:->|→|=>)\s*(.+?)(?:\s*:\s*(.+))?$/);
  return m ? { from: m[1].trim(), to: m[2].trim(), label: (m[3] || '').trim() } : null;
}
const cap = (list, max) => ({ shown: list.slice(0, max), hidden: Math.max(0, list.length - max) });
const card = (L, x, y, w, h, { fill, stroke, sw = 1.2, rx = 10 } = {}) =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${L.rx(rx)}" fill="${fill}" stroke="${stroke}" stroke-width="${L.sw(sw)}"/>`;
const leftText = (text, x, cy, width, opts) => {
  const { lines, size } = wrapText(text, width, opts);
  const lh = size * 1.25;
  return `<text x="${r1(x)}" y="${r1(cy - ((lines.length - 1) * lh) / 2)}" font-family='${FONT}' font-size="${size}" font-weight="${opts.weight || 500}" fill="${opts.fill}" dominant-baseline="middle">${
    lines.map((l, i) => `<tspan x="${r1(x)}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`;
};
const badge = (L, x, y, n, color) =>
  `<circle cx="${r1(x)}" cy="${r1(y)}" r="13" fill="${color}"/><text x="${r1(x)}" y="${r1(y)}" font-family='${FONT}' font-size="${L.fs(12)}" font-weight="700" fill="${inkOn(color, L.th)}" text-anchor="middle" dominant-baseline="central">${esc(n)}</text>`;
const out = (W, H, body, label, L) => svg(W, H, body, label, L.defs());

// --- Sıra ----------------------------------------------------------------------

/** Basamak: her adım bir öncekinden yüksekte (yükselen merdiven). */
export function drawStairs(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map(clean).filter(Boolean), 6);
  const n = Math.max(1, shown.length);
  const W = 640; const H = 340; const base = H - 24; const stepW = (W - 40) / n; const rise = (H - 110) / n;
  let body = '';
  shown.forEach((t, i) => {
    const x = 20 + i * stepW; const top = base - 70 - i * rise;
    body += `<rect x="${r1(x)}" y="${r1(top)}" width="${r1(stepW - 6)}" height="${r1(base - top)}" rx="${L.rx(8)}" fill="${L.fill(i, i === n - 1 ? th.accent2 : th.accent, th.paper, 1.6)}"/>`;
    body += textBlock(String(i + 1), x + (stepW - 6) / 2, top + 22, 40, { size: L.fs(18), weight: 800, fill: inkOn(i === n - 1 ? th.accent2 : th.accent, th) });
    body += textBlock(t, x + (stepW - 6) / 2, top - 30, stepW - 10, { size: L.fs(12), maxLines: 3, fill: th.ink, weight: 600 });
  });
  body += `<line x1="16" y1="${base}" x2="${W - 16}" y2="${base}" stroke="${th.ink}" stroke-width="${L.sw(1.4)}"/>`;
  return { svg: out(W, H, body, label || shown.join(' → '), L), hidden };
}

/** Dikey yol haritası: solda numaralı omurga, sağda kartlar. */
export function drawRoadmap(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map(clean).filter(Boolean), 8);
  const rowH = 62; const W = 640; const H = 30 + shown.length * rowH;
  let body = `<line x1="60" y1="30" x2="60" y2="${H - 30}" stroke="${th.line}" stroke-width="${L.sw(3)}" stroke-linecap="round"/>`;
  shown.forEach((t, i) => {
    const cy = 15 + i * rowH + rowH / 2;
    body += card(L, 92, cy - 22, W - 120, 44, { fill: th.soft, stroke: th.line });
    body += `<rect x="92" y="${r1(cy - 22)}" width="5" height="44" rx="2" fill="${th.accent}"/>`;
    body += leftText(t, 108, cy, W - 150, { size: L.fs(12.5), maxLines: 2, fill: th.ink });
    body += badge(L, 60, cy, i + 1, i === shown.length - 1 ? th.accent2 : th.accent);
  });
  return { svg: out(W, H, body, label || shown.join(' → '), L), hidden };
}

/** Numaralı liste kartları: iki sütun, büyük numara. */
export function drawNumList(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map(clean).filter(Boolean), 8);
  const cols = shown.length > 3 ? 2 : 1; const rows = Math.ceil(shown.length / cols);
  const W = 640; const gap = 16; const cw = (W - 40 - gap * (cols - 1)) / cols; const ch = 64; const H = 24 + rows * (ch + 12);
  let body = '';
  shown.forEach((t, i) => {
    const c = cols === 2 ? Math.floor(i / rows) : 0; const r = cols === 2 ? i % rows : i;
    const x = 20 + c * (cw + gap); const y = 14 + r * (ch + 12);
    body += card(L, x, y, cw, ch, { fill: th.paper, stroke: th.line });
    body += `<text x="${r1(x + 34)}" y="${r1(y + ch / 2)}" font-family='${FONT}' font-size="${L.fs(26)}" font-weight="800" fill="${th.accent}" text-anchor="middle" dominant-baseline="central">${String(i + 1).padStart(2, '0')}</text>`;
    body += `<line x1="${r1(x + 62)}" y1="${r1(y + 14)}" x2="${r1(x + 62)}" y2="${r1(y + ch - 14)}" stroke="${th.line}"/>`;
    body += leftText(t, x + 74, y + ch / 2, cw - 86, { size: L.fs(12.5), maxLines: 3, fill: th.ink });
  });
  return { svg: out(W, H, body, label || shown.join(', '), L), hidden };
}

// --- Döngü ---------------------------------------------------------------------

/** Merkez + uydu: ilk öğe merkezde, diğerleri çevresinde. */
export function drawHub(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const list = items.map(clean).filter(Boolean);
  const center = list[0] || ''; const { shown, hidden } = cap(list.slice(1), 8);
  const W = 600; const H = 440; const cx = W / 2; const cy = H / 2; const R = 160; const n = Math.max(1, shown.length);
  let body = '';
  const pts = shown.map((_, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + R * Math.cos(a), cy + R * 0.82 * Math.sin(a)]; });
  pts.forEach(([x, y]) => { body += `<line x1="${cx}" y1="${cy}" x2="${r1(x)}" y2="${r1(y)}" stroke="${th.line}" stroke-width="${L.sw(1.6)}"/>`; });
  pts.forEach(([x, y], i) => {
    body += card(L, x - 64, y - 26, 128, 52, { fill: L.fill(i, th.soft, th.hatch, 1), stroke: th.accent, rx: 26 });
    body += textBlock(shown[i], x, y, 112, { size: L.fs(12), maxLines: 2, fill: th.ink });
  });
  body += `<circle cx="${cx}" cy="${cy}" r="66" fill="${th.accent}"/>`;
  body += textBlock(center, cx, cy, 108, { size: L.fs(14), weight: 700, maxLines: 3, fill: inkOn(th.accent, th) });
  return { svg: out(W, H, body, label || center, L), hidden };
}

/** Geri besleme: çember üzerinde düğümler, oklarda +/−; ortada döngü türü (R pekiştiren, B dengeleyen). */
export function drawFeedback(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map(splitSign).filter((x) => x.text), 6);
  const n = Math.max(2, shown.length);
  const W = 560; const H = 420; const cx = W / 2; const cy = H / 2; const R = 145;
  let body = arrowDef(L);
  const pts = shown.map((_, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a }; });
  pts.forEach((p, i) => {
    if (shown.length < 2) return;
    const q = pts[(i + 1) % shown.length];
    const a1 = p.a + 0.34; const a2 = (i + 1 === shown.length ? q.a + 2 * Math.PI : q.a) - 0.34;
    const x1 = cx + R * Math.cos(a1); const y1 = cy + R * Math.sin(a1); const x2 = cx + R * Math.cos(a2); const y2 = cy + R * Math.sin(a2);
    body += `<path d="M${r1(x1)} ${r1(y1)} A${R} ${R} 0 0 1 ${r1(x2)} ${r1(y2)}" fill="none" stroke="${th.accent}" stroke-width="${L.sw(1.8)}" marker-end="url(#${L.markerId})"/>`;
    const sign = shown[i].sign;
    if (sign) {
      const am = (a1 + a2) / 2; const sx = cx + (R + 20) * Math.cos(am); const sy = cy + (R + 20) * Math.sin(am);
      body += `<circle cx="${r1(sx)}" cy="${r1(sy)}" r="11" fill="${sign === '+' ? th.accent2 : th.paper}" stroke="${th.ink}" stroke-width="${L.sw(1)}"/>`;
      body += `<text x="${r1(sx)}" y="${r1(sy)}" font-family='${FONT}' font-size="${L.fs(14)}" font-weight="800" fill="${sign === '+' ? inkOn(th.accent2, th) : th.ink}" text-anchor="middle" dominant-baseline="central">${sign}</text>`;
    }
  });
  shown.forEach((it, i) => {
    const { x, y } = pts[i];
    body += card(L, x - 62, y - 26, 124, 52, { fill: th.paper, stroke: th.ink, rx: 12 });
    body += textBlock(it.text, x, y, 108, { size: L.fs(12), maxLines: 2, fill: th.ink });
  });
  // Döngü türü yalnız bütün oklar işaretliyse: eksi sayısı tekse dengeleyen (B), çiftse pekiştiren (R).
  if (shown.length >= 2 && shown.every((s) => s.sign)) {
    const neg = shown.filter((s) => s.sign === '−').length;
    body += `<circle cx="${cx}" cy="${cy}" r="26" fill="${th.soft}" stroke="${th.accent}" stroke-width="${L.sw(1.4)}"/>`;
    body += `<text x="${cx}" y="${cy}" font-family='${FONT}' font-size="${L.fs(20)}" font-weight="800" fill="${th.accent}" text-anchor="middle" dominant-baseline="central">${neg % 2 ? 'B' : 'R'}</text>`;
  }
  return { svg: out(W, H, body, label || shown.map((s) => s.text).join(' → '), L), hidden };
}

// --- Neden ---------------------------------------------------------------------

/** Etki zinciri: kutular oklarla; okta +/− etkinin yönü. */
export function drawChain(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map(splitSign).filter((x) => x.text), 8);
  const n = Math.max(1, shown.length); const perRow = n <= 4 ? n : Math.ceil(n / 2); const rows = Math.ceil(n / perRow);
  const W = 640; const gap = 46; const bw = Math.min(140, (W - 40 - gap * (perRow - 1)) / perRow); const bh = 64;
  const H = 40 + rows * bh + (rows - 1) * 52;
  let body = arrowDef(L);
  const pos = shown.map((_, i) => {
    const r = Math.floor(i / perRow); const c = i % perRow; const rowW = perRow * bw + (perRow - 1) * gap;
    return { x: (W - rowW) / 2 + c * (bw + gap), y: 20 + r * (bh + 52) };
  });
  shown.forEach((it, i) => {
    const { x, y } = pos[i];
    body += card(L, x, y, bw, bh, { fill: i === n - 1 ? th.accent : th.soft, stroke: th.accent });
    body += textBlock(it.text, x + bw / 2, y + bh / 2, bw - 16, { size: L.fs(12), maxLines: 3, fill: i === n - 1 ? inkOn(th.accent, th) : th.ink, weight: i === n - 1 ? 700 : 500 });
    if (i < shown.length - 1) {
      const a = pos[i]; const b = pos[i + 1];
      const d = a.y === b.y
        ? `M${r1(a.x + bw + 4)} ${r1(a.y + bh / 2)} H${r1(b.x - 4)}`
        : `M${r1(a.x + bw / 2)} ${r1(a.y + bh + 4)} V${r1(a.y + bh + 26)} H${r1(b.x + bw / 2)} V${r1(b.y - 4)}`;
      body += `<path d="${d}" fill="none" stroke="${th.ink}" stroke-width="${L.sw(1.6)}" marker-end="url(#${L.markerId})"/>`;
      if (it.sign) {
        const mx = a.y === b.y ? (a.x + bw + b.x) / 2 : (a.x + bw / 2 + b.x + bw / 2) / 2; const my = a.y === b.y ? a.y + bh / 2 - 14 : a.y + bh + 26 - 12;
        body += `<text x="${r1(mx)}" y="${r1(my)}" font-family='${FONT}' font-size="${L.fs(15)}" font-weight="800" fill="${th.ink}" text-anchor="middle">${it.sign}</text>`;
      }
    }
  });
  return { svg: out(W, H, body, label || shown.map((s) => s.text).join(' → '), L), hidden };
}

/** Balık kılçığı: sağda sonuç; omurgaya bağlı kategoriler (üst/alt dönüşümlü), altında nedenler. */
export function drawFishbone(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const list = items.map(clean).filter(Boolean);
  const effect = list[0] || ''; const { shown, hidden } = cap(list.slice(1).map(splitHead), 6);
  const W = 680; const H = 380; const spineY = H / 2; const headX = W - 150;
  let body = `<line x1="24" y1="${spineY}" x2="${headX}" y2="${spineY}" stroke="${th.ink}" stroke-width="${L.sw(3)}"/>`;
  body += `<path d="M${headX} ${spineY - 46} L${W - 14} ${spineY} L${headX} ${spineY + 46} Z" fill="${th.accent}"/>`;
  body += textBlock(effect, headX + 52, spineY, 100, { size: L.fs(12.5), weight: 700, maxLines: 3, fill: inkOn(th.accent, th) });
  const slots = Math.max(1, Math.ceil(shown.length / 2)); const span = (headX - 80) / slots;
  shown.forEach((cat, i) => {
    const up = i % 2 === 0; const k = Math.floor(i / 2);
    const x = 70 + k * span + span * 0.55; const tipY = up ? 52 : H - 52;
    body += `<line x1="${r1(x - 60)}" y1="${tipY}" x2="${r1(x)}" y2="${spineY}" stroke="${th.accent}" stroke-width="${L.sw(2)}"/>`;
    body += card(L, x - 60 - 58, tipY - (up ? 34 : -6), 116, 28, { fill: th.accent, stroke: th.accent, rx: 6 });
    body += textBlock(cat.head, x - 60, tipY - (up ? 20 : -20), 108, { size: L.fs(11.5), weight: 700, maxLines: 1, fill: inkOn(th.accent, th) });
    cat.parts.slice(0, 3).forEach((p, j) => {
      const t = (j + 1) / 4; const px = x - 60 + 60 * t; const py = tipY + (spineY - tipY) * t;
      body += `<line x1="${r1(px)}" y1="${r1(py)}" x2="${r1(px - 40)}" y2="${r1(py)}" stroke="${th.line}" stroke-width="${L.sw(1)}"/>`;
      body += `<text x="${r1(px - 44)}" y="${r1(py)}" font-family='${FONT}' font-size="${L.fs(10.5)}" fill="${th.ink}" text-anchor="end" dominant-baseline="middle">${esc(wrapText(p, 110, { size: L.fs(10.5), maxLines: 1 }).lines[0])}</text>`;
    });
  });
  return { svg: out(W, H, body, label || effect, L), hidden };
}

// --- Yapı ----------------------------------------------------------------------

/** Ağaç: ilk satır kök; "Dal: alt1, alt2" satırları dallar ve yapraklar. */
export function drawTree(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const list = items.map(clean).filter(Boolean);
  const root = list[0] || ''; const { shown, hidden } = cap(list.slice(1).map(splitHead), 5);
  const n = Math.max(1, shown.length); const W = 680; const colW = (W - 40) / n;
  const leafMax = Math.max(0, ...shown.map((b) => Math.min(b.parts.length, 4)));
  const H = 200 + leafMax * 40;
  let body = card(L, W / 2 - 90, 16, 180, 50, { fill: th.accent, stroke: th.accent });
  body += textBlock(root, W / 2, 41, 166, { size: L.fs(13.5), weight: 700, maxLines: 2, fill: inkOn(th.accent, th) });
  shown.forEach((b, i) => {
    const x = 20 + i * colW + colW / 2; const y = 110;
    body += `<path d="M${W / 2} 66 V88 H${r1(x)} V${y}" fill="none" stroke="${th.ink}" stroke-width="${L.sw(1.4)}"/>`;
    body += card(L, x - colW / 2 + 6, y, colW - 12, 44, { fill: th.soft, stroke: th.accent });
    body += textBlock(b.head, x, y + 22, colW - 26, { size: L.fs(12), weight: 700, maxLines: 2, fill: th.ink });
    b.parts.slice(0, 4).forEach((p, j) => {
      const ly = y + 62 + j * 40;
      body += `<path d="M${r1(x - colW / 2 + 18)} ${y + 44} V${ly + 16} H${r1(x - colW / 2 + 28)}" fill="none" stroke="${th.line}" stroke-width="${L.sw(1.2)}"/>`;
      body += card(L, x - colW / 2 + 28, ly, colW - 40, 32, { fill: th.paper, stroke: th.line, rx: 6 });
      body += leftText(p, x - colW / 2 + 36, ly + 16, colW - 56, { size: L.fs(11), maxLines: 2, fill: th.ink });
    });
  });
  return { svg: out(W, H, body, label || root, L), hidden };
}

/** Zihin haritası: merkez; dallar sağa ve sola, dalın alt öğeleri yanında. */
export function drawMind(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const list = items.map(clean).filter(Boolean);
  const center = list[0] || ''; const { shown, hidden } = cap(list.slice(1).map(splitHead), 6);
  const W = 700; const H = 420; const cx = W / 2; const cy = H / 2;
  let body = '';
  const sides = [shown.filter((_, i) => i % 2 === 0), shown.filter((_, i) => i % 2 === 1)];
  sides.forEach((side, s) => {
    const dir = s === 0 ? 1 : -1; const bx = cx + dir * 170;
    side.forEach((b, j) => {
      const by = side.length === 1 ? cy : 70 + (j * (H - 140)) / (side.length - 1);
      body += `<path d="M${cx + dir * 70} ${cy} C${cx + dir * 120} ${cy}, ${r1(bx - dir * 70)} ${r1(by)}, ${r1(bx - dir * 60)} ${r1(by)}" fill="none" stroke="${th.accent}" stroke-width="${L.sw(2.4)}"/>`;
      body += card(L, bx - 60, by - 20, 120, 40, { fill: th.soft, stroke: th.accent, rx: 20 });
      body += textBlock(b.head, bx, by, 108, { size: L.fs(12), weight: 700, maxLines: 2, fill: th.ink });
      b.parts.slice(0, 3).forEach((p, k) => {
        const py = by - 22 + k * 22; const px = bx + dir * 72;
        body += `<line x1="${bx + dir * 60}" y1="${r1(by)}" x2="${px}" y2="${r1(py)}" stroke="${th.line}" stroke-width="${L.sw(1)}"/>`;
        body += `<text x="${px + dir * 4}" y="${r1(py)}" font-family='${FONT}' font-size="${L.fs(10.5)}" fill="${th.ink}" text-anchor="${dir > 0 ? 'start' : 'end'}" dominant-baseline="middle">${esc(wrapText(p, 110, { size: L.fs(10.5), maxLines: 1 }).lines[0])}</text>`;
      });
    });
  });
  body += `<ellipse cx="${cx}" cy="${cy}" rx="78" ry="44" fill="${th.accent}"/>`;
  body += textBlock(center, cx, cy, 136, { size: L.fs(14), weight: 700, maxLines: 2, fill: inkOn(th.accent, th) });
  return { svg: out(W, H, body, label || center, L), hidden };
}

/** Piramit: ilk öğe tepede; katmanlar aşağı doğru genişler, renk koyudan açığa. */
export function drawPyramid(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map(clean).filter(Boolean), 6);
  const n = Math.max(1, shown.length); const W = 640; const H = 60 + n * 58; const top = 20; const bottomW = 540; const topW = 120; const layerH = (H - 40) / n;
  let body = '';
  shown.forEach((t, i) => {
    const w1 = i === 0 ? 0 : topW + ((bottomW - topW) * i) / n; const w2 = topW + ((bottomW - topW) * (i + 1)) / n; const y1 = top + i * layerH; const y2 = y1 + layerH - 4;
    const fill = mix(th.accent, '#ffffff', n > 1 ? (i / (n - 1)) * 0.7 : 0);
    body += `<path d="M${r1(W / 2 - w1 / 2)} ${r1(y1)} L${r1(W / 2 + w1 / 2)} ${r1(y1)} L${r1(W / 2 + w2 / 2)} ${r1(y2)} L${r1(W / 2 - w2 / 2)} ${r1(y2)} Z" fill="${L.fill(i, fill, th.paper, 1.4)}" stroke="${th.paper}" stroke-width="2"/>`;
    const tw = Math.max(96, (i === 0 ? w2 * 0.62 : (w1 + w2) / 2 - 30));
    body += textBlock(t, W / 2, i === 0 ? y1 + (y2 - y1) * 0.64 : (y1 + y2) / 2, tw, { size: L.fs(12), weight: 700, maxLines: 2, fill: inkOn(fill, th) });
  });
  return { svg: out(W, H, body, label || shown.join(' > '), L), hidden };
}

/** Huni (PRISMA gibi): "Etiket: sayı" katmanları; sayı varsa sağda, ardışık fark "−n" olarak. */
export function drawFunnel(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map(splitHead).filter((x) => x.head), 6);
  const rows = shown.map((x) => ({ text: x.head, value: x.parts.length ? parseNumber(x.parts[0].replace(/\./g, '')) : null }));
  const n = Math.max(1, rows.length); const W = 640; const layerH = 54; const H = 30 + n * (layerH + 6); const maxW = 440; const minW = 160;
  let body = '';
  rows.forEach((r, i) => {
    const w = maxW - ((maxW - minW) * i) / Math.max(1, n - 1); const x = 40 + (maxW - w) / 2; const y = 14 + i * (layerH + 6);
    const fill = i === n - 1 ? th.accent2 : mix(th.accent, '#ffffff', (i / Math.max(1, n - 1)) * 0.45);
    body += card(L, x, y, w, layerH, { fill: L.fill(i, fill, th.paper, 1.4), stroke: fill, rx: 8 });
    body += textBlock(r.text, x + w / 2, y + layerH / 2, w - 20, { size: L.fs(12.5), weight: 700, maxLines: 2, fill: inkOn(fill, th) });
    if (r.value !== null) {
      body += `<text x="${40 + maxW + 26}" y="${y + layerH / 2}" font-family='${FONT}' font-size="${L.fs(16)}" font-weight="800" fill="${th.ink}" dominant-baseline="middle">${esc(r.value.toLocaleString('tr-TR'))}</text>`;
      const prev = rows[i - 1];
      if (prev?.value !== null && prev?.value !== undefined && prev.value > r.value) {
        body += `<text x="${40 + maxW + 26}" y="${y - 2}" font-family='${FONT}' font-size="${L.fs(10.5)}" fill="${th.muted}" dominant-baseline="middle">−${esc((prev.value - r.value).toLocaleString('tr-TR'))}</text>`;
      }
    }
  });
  return { svg: out(W, H, body, label || rows.map((r) => r.text).join(' → '), L), hidden };
}

// --- Karşılaştırma -------------------------------------------------------------

/** Çok sütunlu karşılaştırma: her satır "Başlık: madde; madde". */
export function drawColumns(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map(splitHead).filter((x) => x.head), 5);
  const n = Math.max(1, shown.length); const W = 680; const gap = 12; const cw = (W - 40 - gap * (n - 1)) / n;
  const rowsMax = Math.max(1, ...shown.map((c) => Math.min(6, c.parts.length))); const H = 90 + rowsMax * 40;
  let body = '';
  shown.forEach((c, i) => {
    const x = 20 + i * (cw + gap);
    body += card(L, x, 16, cw, H - 32, { fill: th.paper, stroke: th.line });
    body += `<rect x="${r1(x)}" y="16" width="${r1(cw)}" height="44" rx="${L.rx(10)}" fill="${th.accent}"/><rect x="${r1(x)}" y="48" width="${r1(cw)}" height="12" fill="${th.accent}"/>`;
    body += textBlock(c.head, x + cw / 2, 38, cw - 16, { size: L.fs(12.5), weight: 700, maxLines: 2, fill: inkOn(th.accent, th) });
    c.parts.slice(0, 6).forEach((p, j) => {
      const y = 82 + j * 40;
      body += `<circle cx="${r1(x + 14)}" cy="${y}" r="3" fill="${th.accent2}"/>`;
      body += leftText(p, x + 24, y, cw - 32, { size: L.fs(11.5), maxLines: 2, fill: th.ink });
    });
  });
  return { svg: out(W, H, body, label || shown.map((c) => c.head).join(' / '), L), hidden };
}

/** Dörtlü matris: dört "Başlık: açıklama" kutusu, eksen okları. */
export function drawMatrix(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map(splitHead).filter((x) => x.head), 4);
  const W = 600; const H = 460; const x0 = 60; const y0 = 20; const qw = (W - x0 - 20) / 2; const qh = (H - y0 - 50) / 2;
  let body = arrowDef(L);
  const at = [[0, 0], [1, 0], [0, 1], [1, 1]];
  shown.forEach((q, i) => {
    const [c, r] = at[i]; const x = x0 + c * qw; const y = y0 + r * qh; const hi = i === 1;
    body += card(L, x + 4, y + 4, qw - 8, qh - 8, { fill: hi ? mix(th.accent2, '#ffffff', 0.78) : th.soft, stroke: hi ? th.accent2 : th.line, sw: hi ? 1.8 : 1 });
    body += textBlock(q.head, x + qw / 2, y + 40, qw - 30, { size: L.fs(14), weight: 700, maxLines: 2, fill: th.ink });
    if (q.parts.length) body += textBlock(q.parts.join(', '), x + qw / 2, y + qh / 2 + 20, qw - 36, { size: L.fs(11.5), maxLines: 4, fill: th.ink });
  });
  body += `<line x1="${x0 - 18}" y1="${H - 30}" x2="${x0 - 18}" y2="${y0}" stroke="${th.ink}" stroke-width="${L.sw(1.6)}" marker-end="url(#${L.markerId})"/>`;
  body += `<line x1="${x0 - 18}" y1="${H - 30}" x2="${W - 10}" y2="${H - 30}" stroke="${th.ink}" stroke-width="${L.sw(1.6)}" marker-end="url(#${L.markerId})"/>`;
  return { svg: out(W, H, body, label || shown.map((q) => q.head).join(' / '), L), hidden };
}

/** Venn (2–3 küme): "Küme: öğe, öğe"; "Ortak: …" satırı kesişime yazılır. */
export function drawVenn(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const all = items.map(splitHead).filter((x) => x.head);
  const common = all.find((x) => /^(ortak|kesişim|common|overlap)$/i.test(x.head));
  const { shown, hidden } = cap(all.filter((x) => x !== common), 3);
  const n = shown.length; const W = 620; const H = n === 3 ? 470 : 340; const R = n === 3 ? 140 : 150;
  const centers = n === 3 ? [[W / 2 - 90, 175], [W / 2 + 90, 175], [W / 2, 320]] : [[W / 2 - 95, H / 2], [W / 2 + 95, H / 2]];
  const colors = [th.accent, th.accent2, th.ink];
  let body = '';
  shown.forEach((s, i) => {
    const [x, y] = centers[i];
    body += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${R}" fill="${colors[i]}" fill-opacity="0.16" stroke="${colors[i]}" stroke-width="${L.sw(2)}"/>`;
  });
  shown.forEach((s, i) => {
    const [x, y] = centers[i]; const away = n === 3 ? [[-55, -30], [55, -30], [0, 55]][i] : [[-70, 0], [70, 0]][i];
    const lx = x + away[0]; const ly = y + away[1];
    body += textBlock(s.head, lx, ly - 34, 110, { size: L.fs(13.5), weight: 800, maxLines: 1, fill: th.ink });
    s.parts.slice(0, 3).forEach((p, j) => { body += textBlock(p, lx, ly - 8 + j * 18, 110, { size: L.fs(11), maxLines: 1, fill: th.ink }); });
  });
  if (common && n >= 2) {
    const cx = n === 3 ? W / 2 : W / 2; const cy = n === 3 ? 225 : H / 2;
    body += textBlock((common.parts.length ? common.parts : [common.head]).slice(0, 3).join(', '), cx, cy, n === 3 ? 70 : 90, { size: L.fs(11), weight: 700, maxLines: 4, fill: th.ink });
  }
  return { svg: out(W, H, body, label || shown.map((s) => s.head).join(' ∩ '), L), hidden };
}

// --- İlişki --------------------------------------------------------------------

/** Kavram haritası: "A -> B : etiket" satırları; en çok bağlı kavram vurgulanır. */
export function drawConcept(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const rels = items.map(splitRelation).filter(Boolean);
  const names = []; rels.forEach((r) => [r.from, r.to].forEach((x) => { if (!names.includes(x)) names.push(x); }));
  const { shown, hidden } = cap(names, 8);
  const W = 680; const H = 440; const cx = W / 2; const cy = H / 2; const n = Math.max(1, shown.length);
  const pos = Object.fromEntries(shown.map((name, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [name, [cx + 240 * Math.cos(a), cy + 160 * Math.sin(a)]]; }));
  const degree = Object.fromEntries(shown.map((x) => [x, rels.filter((r) => r.from === x || r.to === x).length]));
  const hub = shown.reduce((a, b) => (degree[b] > degree[a] ? b : a), shown[0]);
  let body = arrowDef(L);
  rels.forEach((r) => {
    if (!pos[r.from] || !pos[r.to]) return;
    const [x1, y1] = pos[r.from]; const [x2, y2] = pos[r.to];
    const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy) || 1; const ux = dx / len; const uy = dy / len;
    const sx = x1 + ux * 62; const sy = y1 + uy * 26; const ex = x2 - ux * 66; const ey = y2 - uy * 30;
    body += `<line x1="${r1(sx)}" y1="${r1(sy)}" x2="${r1(ex)}" y2="${r1(ey)}" stroke="${th.ink}" stroke-width="${L.sw(1.4)}" marker-end="url(#${L.markerId})"/>`;
    if (r.label) {
      const mx = (sx + ex) / 2; const my = (sy + ey) / 2; const t = wrapText(r.label, 110, { size: L.fs(10.5), maxLines: 1 }).lines[0]; const tw = Math.min(118, t.length * L.fs(10.5) * 0.58 + 10);
      body += `<rect x="${r1(mx - tw / 2)}" y="${r1(my - 9)}" width="${r1(tw)}" height="18" rx="4" fill="${th.paper}"/>`;
      body += `<text x="${r1(mx)}" y="${r1(my)}" font-family='${FONT}' font-size="${L.fs(10.5)}" font-style="italic" fill="${th.muted}" text-anchor="middle" dominant-baseline="middle">${esc(t)}</text>`;
    }
  });
  shown.forEach((name) => {
    const [x, y] = pos[name]; const hi = name === hub && degree[hub] > 1;
    body += card(L, x - 62, y - 26, 124, 52, { fill: hi ? th.accent : th.soft, stroke: hi ? th.accent : th.accent, sw: hi ? 1.6 : 1.2, rx: 12 });
    body += textBlock(name, x, y, 110, { size: L.fs(12), weight: hi ? 700 : 600, maxLines: 2, fill: hi ? inkOn(th.accent, th) : th.ink });
  });
  return { svg: out(W, H, body, label || shown.join(', '), L), hidden };
}

/** Argüman haritası: ilk satır iddia; "+ gerekçe" solda, "- itiraz" sağda. */
export function drawArgument(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const list = items.map(clean).filter(Boolean);
  const claim = (list[0] || '').replace(/^[+\-−]\s*/, '');
  const rest = list.slice(1).map((l) => ({ pro: !/^[-−]/.test(l), text: l.replace(/^[+\-−]\s*/, '') }));
  const pros = cap(rest.filter((r) => r.pro), 4); const cons = cap(rest.filter((r) => !r.pro), 4);
  const rows = Math.max(1, pros.shown.length, cons.shown.length); const W = 680; const H = 140 + rows * 70;
  let body = arrowDef(L);
  body += card(L, W / 2 - 170, 16, 340, 64, { fill: th.accent, stroke: th.accent });
  body += textBlock(claim, W / 2, 48, 316, { size: L.fs(13.5), weight: 700, maxLines: 3, fill: inkOn(th.accent, th) });
  const col = (arr, x, pro) => arr.forEach((r, i) => {
    const y = 120 + i * 70; const color = pro ? th.accent : th.accent2;
    if (i === 0) body += `<path d="M${r1(x + 150)} ${y} V100 H${r1(W / 2 + (pro ? -24 : 24))} V84" fill="none" stroke="${color}" stroke-width="${L.sw(1.6)}" marker-end="url(#${L.markerId})"/>`;
    if (i > 0) body += `<line x1="${r1(x + 150)}" y1="${y - 14}" x2="${r1(x + 150)}" y2="${y}" stroke="${color}" stroke-width="${L.sw(1.6)}"/>`;
    body += card(L, x, y, 300, 56, { fill: th.paper, stroke: th.line });
    body += `<rect x="${x}" y="${y}" width="6" height="56" rx="3" fill="${color}"/>`;
    body += badge(L, x + 26, y + 28, pro ? '+' : '−', color);
    body += leftText(r.text, x + 48, y + 28, 242, { size: L.fs(11.5), maxLines: 3, fill: th.ink });
  });
  col(pros.shown, 20, true); col(cons.shown, W - 320, false);
  return { svg: out(W, H, body, label || claim, L), hidden: pros.hidden + cons.hidden };
}

// --- Zaman ---------------------------------------------------------------------

/** Dikey zaman çizelgesi: ortada omurga, kartlar dönüşümlü sağda ve solda. */
export function drawVTimeline(items, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const { shown, hidden } = cap(items.map((it) => ({ date: clean(it.date), text: clean(it.text) })).filter((it) => it.date || it.text), 8);
  const W = 640; const rowH = 72; const H = 30 + shown.length * rowH; const cx = W / 2;
  let body = `<line x1="${cx}" y1="16" x2="${cx}" y2="${H - 16}" stroke="${th.line}" stroke-width="${L.sw(3)}" stroke-linecap="round"/>`;
  shown.forEach((it, i) => {
    const y = 20 + i * rowH + rowH / 2; const right = i % 2 === 0; const x = right ? cx + 26 : cx - 26 - 250;
    body += `<circle cx="${cx}" cy="${y}" r="8" fill="${i === shown.length - 1 ? th.accent2 : th.accent}" stroke="#fff" stroke-width="2"/>`;
    body += card(L, x, y - 28, 250, 56, { fill: th.soft, stroke: th.line });
    body += leftText(it.date, x + 12, y - 12, 226, { size: L.fs(12.5), weight: 800, maxLines: 1, fill: th.accent });
    body += leftText(it.text, x + 12, y + 10, 226, { size: L.fs(11), maxLines: 2, fill: th.ink });
  });
  return { svg: out(W, H, body, label || shown.map((it) => it.date).join(' – '), L), hidden };
}

// --- Sayı ----------------------------------------------------------------------

const rowsOf = (rows) => rows.map((r) => ({ label: clean(r.label), value: parseNumber(r.value), raw: clean(r.value) })).filter((r) => r.label || r.value !== null);
/** Türkçede yüzde işareti başa: "%42"; diğer birimler sona. */
const withUnit = (text, unit) => (unit === '%' ? `%${text}` : unit ? `${text} ${unit}` : text);

/** Yatay çubuk: etiket solda, değer sağda; bütün çubuklar tek renk (veri rolü). */
export function drawBarH({ rows = [], unit = '' }, { label = '', locale = 'tr-TR', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const data = rowsOf(rows); const valid = data.filter((r) => r.value !== null);
  const W = 640; const rowH = 38; const H = 30 + valid.length * rowH; const x0 = 170; const maxW = W - x0 - 90;
  const max = Math.max(...valid.map((r) => Math.abs(r.value)), 0) || 1;
  const fmt = (v) => Number(v).toLocaleString(locale, { maximumFractionDigits: 2 });
  let body = `<line x1="${x0}" y1="12" x2="${x0}" y2="${H - 12}" stroke="${th.ink}" stroke-width="${L.sw(1.2)}"/>`;
  valid.forEach((r, i) => {
    const y = 16 + i * rowH; const w = Math.max(2, (Math.abs(r.value) / max) * maxW);
    body += leftText(r.label, 16, y + rowH / 2 - 4, x0 - 26, { size: L.fs(11.5), maxLines: 2, fill: th.ink });
    body += `<rect x="${x0}" y="${y + 4}" width="${r1(w)}" height="${rowH - 14}" rx="${L.rx(4)}" fill="${L.patterned ? L.fill(i, th.paper, th.accent) : th.accent}"${L.patterned || L.strong ? ` stroke="${th.accent}" stroke-width="${L.sw(1.2)}"` : ''}/>`;
    body += `<text x="${r1(x0 + w + 8)}" y="${y + rowH / 2 - 3}" font-family='${FONT}' font-size="${L.fs(11.5)}" font-weight="700" fill="${th.ink}" dominant-baseline="middle">${esc(withUnit(fmt(r.value), unit))}</text>`;
  });
  return { svg: out(W, H, body, label || valid.map((r) => r.label).join(', '), L), skipped: data.length - valid.length, count: valid.length };
}

/**
 * Yüzde halkası: tek satır ve değer 0–100 ise yüzde halkası; birden çok satırda
 * paylar (değer / toplam). Paylar hesaplanır, uydurulmaz; negatif değer çizilmez.
 */
export function drawRing({ rows = [], unit = '' }, { label = '', locale = 'tr-TR', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const data = rowsOf(rows); const valid = data.filter((r) => r.value !== null && r.value >= 0);
  const W = 600; const H = 320; const cx = 160; const cy = H / 2; const R = 110; const sw = 34;
  const fmt = (v) => Number(v).toLocaleString(locale, { maximumFractionDigits: 1 });
  const arc = (a1, a2) => {
    const p = (a) => [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    const [x1, y1] = p(a1); const [x2, y2] = p(a2);
    return `M${r1(x1)} ${r1(y1)} A${R} ${R} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${r1(x2)} ${r1(y2)}`;
  };
  let body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${th.soft}" stroke-width="${sw}"/>`;
  const single = valid.length === 1 && valid[0].value <= 100;
  if (single) {
    const v = valid[0].value; const a2 = -Math.PI / 2 + (2 * Math.PI * Math.min(v, 99.999)) / 100;
    if (v > 0) body += `<path d="${arc(-Math.PI / 2, a2)}" fill="none" stroke="${th.accent}" stroke-width="${sw}" stroke-linecap="${L.ap.corners === 'square' ? 'butt' : 'round'}"/>`;
    body += textBlock(`%${fmt(v)}`, cx, cy - 6, 140, { size: L.fs(30), weight: 800, maxLines: 1, fill: th.ink });
    body += textBlock(valid[0].label, cx, cy + 26, 150, { size: L.fs(11.5), maxLines: 2, fill: th.muted });
  } else {
    const total = valid.reduce((s, r) => s + r.value, 0) || 1;
    const colors = [th.accent, th.accent2, th.ink, th.muted, th.hatch, th.line];
    let a = -Math.PI / 2;
    valid.forEach((r, i) => {
      const a2 = a + (2 * Math.PI * r.value) / total;
      if (r.value > 0) body += `<path d="${arc(a, Math.min(a2, a + 2 * Math.PI - 0.0001))}" fill="none" stroke="${L.patterned ? L.fill(i, th.paper, colors[i % colors.length]) : colors[i % colors.length]}" stroke-width="${sw}"/>`;
      a = a2;
      const ly = 60 + i * 34;
      body += `<rect x="330" y="${ly - 9}" width="18" height="18" rx="4" fill="${colors[i % colors.length]}"/>`;
      body += leftText(`${r.label} — %${fmt((r.value / total) * 100)}`, 356, ly, 220, { size: L.fs(12), maxLines: 1, fill: th.ink });
    });
    if (unit) body += textBlock(withUnit(fmt(total), unit), cx, cy, 150, { size: L.fs(20), weight: 800, maxLines: 1, fill: th.ink });
  }
  return { svg: out(W, H, body, label || valid.map((r) => r.label).join(', '), L), skipped: data.length - valid.length, count: valid.length };
}

/** Sayı kartları: büyük değer (veri rengi), altında etiket. */
export function drawKpi({ rows = [], unit = '' }, { label = '', appearance, uid } = {}) {
  const L = look(appearance, uid); const { th } = L;
  const data = rowsOf(rows); const valid = data.filter((r) => r.value !== null).slice(0, 6);
  const n = Math.max(1, valid.length); const cols = n <= 3 ? n : 3; const rows2 = Math.ceil(n / cols);
  const W = 640; const gap = 14; const cw = (W - 40 - gap * (cols - 1)) / cols; const ch = 120; const H = 24 + rows2 * (ch + gap);
  let body = '';
  valid.forEach((r, i) => {
    const c = i % cols; const rr = Math.floor(i / cols); const x = 20 + c * (cw + gap); const y = 12 + rr * (ch + gap);
    body += card(L, x, y, cw, ch, { fill: th.soft, stroke: th.line, rx: 12 });
    body += `<rect x="${r1(x)}" y="${y}" width="${r1(cw)}" height="5" rx="2" fill="${th.accent2}"/>`;
    body += textBlock(`${r.raw}${unit ? ` ${unit}` : ''}`, x + cw / 2, y + 50, cw - 20, { size: L.fs(28), weight: 800, maxLines: 1, fill: th.accent });
    body += textBlock(r.label, x + cw / 2, y + 90, cw - 24, { size: L.fs(11.5), maxLines: 2, fill: th.ink });
  });
  return { svg: out(W, H, body, label || valid.map((r) => r.label).join(', '), L), skipped: data.length - valid.length, count: valid.length };
}
