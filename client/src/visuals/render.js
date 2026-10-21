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

/** Taslağın SVG'si; içerik yoksa null (Tamam pasif). */
export function renderFigure(type, data, label, locale, appearance, uid) {
  const o = { label, appearance, uid };
  if (type === 'steps' || type === 'cycle') {
    const items = data.items.map((s) => s.trim()).filter(Boolean);
    if (items.length < 2) return null;
    return { svg: type === 'steps' ? drawSteps(items, o) : drawCycle(items, o) };
  }
  if (ITEM_DRAW[type]) {
    const items = data.items.map((s) => s.trim()).filter(Boolean);
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
