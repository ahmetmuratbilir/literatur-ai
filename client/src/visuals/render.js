/**
 * Şekil ve grafiğin çizimi (WO-028, WO-032, WO-033): taslak alanı ve belgedeki
 * şekillerin yeniden çizimi (tema "bütün şekillere uygula") aynı işlevi kullanır.
 * Saf: DOM yok, model yok.
 */
import { drawChart, drawCompare, drawCycle, drawSteps, drawTimeline } from './draw.js';
import {
  drawArgument, drawBarH, drawChain, drawColumns, drawConcept, drawFeedback, drawFishbone, drawFunnel, drawHub, drawKpi,
  drawMatrix, drawMind, drawNumList, drawPyramid, drawRing, drawRoadmap, drawStairs, drawTree, drawVTimeline, drawVenn,
} from './drawMore.js';

// Galeriden gelen şablonlar (WO-032): hepsi aynı `items` listesini kullanır; şablon
// değişince içerik korunur (SmartArt'ın "Düzeni değiştir"i gibi).
export const ITEM_DRAW = {
  stairs: drawStairs, roadmap: drawRoadmap, numlist: drawNumList, hub: drawHub, feedback: drawFeedback, chain: drawChain,
  fishbone: drawFishbone, tree: drawTree, mind: drawMind, pyramid: drawPyramid, funnel: drawFunnel, columns: drawColumns,
  matrix: drawMatrix, venn: drawVenn, concept: drawConcept, argument: drawArgument,
};
export const CHART_DRAW = { barh: drawBarH, ring: drawRing, kpi: drawKpi };

const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);

// Katmanlı liste (Ahmet, 21.10.2026): öğe girintiyle başka öğenin altına alınır (1, 1.1, 1.1.1).
// Kök + dal + yaprak: ilk satır kök, ana satırlar dal, altındakiler dalın öğeleri.
export const ROOTED_TYPES = ['tree', 'mind', 'fishbone'];
// Başlık + madde: her ana satır bir sütun/küme/kutu, altındakiler onun maddeleri.
export const GROUPED_TYPES = ['columns', 'venn', 'matrix'];
export const LEVELED_TYPES = [...ROOTED_TYPES, ...GROUPED_TYPES];
// 1 → 1.1 → 1.1.1 → 1.1.1.1 (Ahmet: "1.1'in altına da 1.1.1 açabileyim"; sayı sınırı yok).
export const MAX_LEVEL = 3;

/** Boş satırlar atılır; katmanı olmayan eski kayıtta her öğe ana satırdır. Katman, bir öncekinin bir fazlasını geçemez. */
export function outlineOf(items = [], levels = []) {
  const out = [];
  items.forEach((text, i) => {
    const t = String(text || '').trim();
    if (!t) return;
    const prev = out.length ? out[out.length - 1].level : -1;
    out.push({ text: t, level: Math.max(0, Math.min(MAX_LEVEL, Number(levels[i]) || 0, prev + 1)) });
  });
  return out;
}

/** Görünen numara: 1, 1.1, 1.1.1, 2 … */
export function outlineNumbers(levels = []) {
  const c = Array(MAX_LEVEL + 1).fill(0);
  return levels.map((lv) => {
    const l = Math.max(0, Math.min(MAX_LEVEL, Number(lv) || 0));
    c[l] += 1;
    for (let k = l + 1; k < c.length; k += 1) c[k] = 0;
    return c.slice(0, l + 1).map((n) => n || 1).join('.');
  });
}

/**
 * Katmanlı listeyi çizicilerin satır biçimine çevirir ("Başlık: a, b"). Kök
 * şablonlarında kullanıcı dalları kökün altına girintilediyse (doğal anahat)
 * bir katman yukarı alınır. Katmanı olmayan satır olduğu gibi kalır (eski
 * "Başlık: a, b" yazımı çalışmaya devam eder).
 */
export function outlineToLines(type, outline) {
  if (!LEVELED_TYPES.includes(type) || !outline.some((o) => o.level > 0)) return outline.map((o) => o.text);
  let rows = outline;
  let head = [];
  if (ROOTED_TYPES.includes(type)) {
    head = [rows[0].text];
    rows = rows.slice(1);
    if (rows.length && rows.every((o) => o.level > 0)) rows = rows.map((o) => ({ ...o, level: o.level - 1 }));
  }
  // Grup: { head, parts: [{ text, depth }] } — depth 0 doğrudan alt öğe, 1 onun altı (1.1.1) …
  // Çiziciler iç içe katmanı girintiyle çizer (drawMore `asGroup`).
  const groups = [];
  rows.forEach((o) => {
    if (o.level === 0 || !groups.length) groups.push({ head: o.text, parts: [] });
    else groups[groups.length - 1].parts.push({ text: o.text, depth: Math.max(0, o.level - 1) });
  });
  return [...head, ...groups];
}

/** Taslağın SVG'si; içerik yoksa null (Tamam pasif). */
export function renderFigure(type, data, label, locale, appearance, uid) {
  const o = { label, appearance, uid };
  if (type === 'steps' || type === 'cycle') {
    const items = data.items.map((s) => s.trim()).filter(Boolean);
    if (items.length < 2) return null;
    return { svg: type === 'steps' ? drawSteps(items, o) : drawCycle(items, o) };
  }
  if (ITEM_DRAW[type]) {
    const items = outlineToLines(type, outlineOf(data.items, data.levels));
    if (items.length < 2 && type !== 'concept') return null;
    const r = ITEM_DRAW[type](items, o);
    if (type === 'concept' && !/<line /.test(r.svg)) return null;
    return { svg: r.svg, hidden: r.hidden };
  }
  if (type === 'compare') {
    const c = data.compare;
    if (!c.leftTitle.trim() || !c.rightTitle.trim() || (!lines(c.left).length && !lines(c.right).length)) return null;
    return { svg: drawCompare({ leftTitle: c.leftTitle, rightTitle: c.rightTitle, left: lines(c.left), right: lines(c.right) }, o) };
  }
  if (type === 'timeline' || type === 'vtimeline') {
    const rows = data.timeline.filter((r) => r.date.trim() || r.text.trim());
    if (rows.length < 2) return null;
    if (type === 'vtimeline') { const r = drawVTimeline(rows, o); return { svg: r.svg, hidden: r.hidden }; }
    return { svg: drawTimeline(rows, o) };
  }
  const r = (CHART_DRAW[type] ? CHART_DRAW[type](data.chart, { ...o, locale }) : drawChart(type, data.chart, { ...o, locale }));
  return r.count ? { svg: r.svg, skipped: r.skipped } : null;
}
