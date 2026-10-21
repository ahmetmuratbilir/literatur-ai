import test from 'node:test';
import assert from 'node:assert/strict';

import { CHART_TYPES, FIGURE_TYPES } from '../src/visuals/draw.js';
import * as M from '../src/visuals/drawMore.js';

/** WO-032 — galeriden gelen şablonlar: her biri çizer, sığmayanı saklamaz ama sayar, sözdizimi okunur. */

const balanced = (svg) => {
  // Kabaca iyi biçim: açılan ve kapanan etiket sayısı tutarlı, kaçışsız < yok.
  const open = (svg.match(/<(?!\/)(?![^>]*\/>)[a-zA-Z]+[^>]*>/g) || []).length;
  const close = (svg.match(/<\/[a-zA-Z]+>/g) || []).length;
  return open === close && !/<[^a-zA-Z/!?]/.test(svg);
};

const LIST = ['Bir', 'İki', 'Üç', 'Dört', 'Beş'];
const CASES = {
  stairs: () => M.drawStairs(LIST),
  roadmap: () => M.drawRoadmap(LIST),
  numlist: () => M.drawNumList(LIST),
  hub: () => M.drawHub(['Merkez', ...LIST]),
  feedback: () => M.drawFeedback(['A +', 'B +', 'C −']),
  chain: () => M.drawChain(['A +', 'B -', 'C']),
  fishbone: () => M.drawFishbone(['Sonuç', 'İnsan: x, y', 'Makine: z']),
  tree: () => M.drawTree(['Kök', 'Dal: a, b', 'Dal 2: c']),
  mind: () => M.drawMind(['Merkez', 'Dal: a, b', 'Dal 2: c', 'Dal 3']),
  pyramid: () => M.drawPyramid(LIST),
  funnel: () => M.drawFunnel(['Taranan: 1.200', 'Elenen: 300', 'Dahil: 24']),
  columns: () => M.drawColumns(['A: x; y', 'B: z', 'C: w']),
  matrix: () => M.drawMatrix(['Q1: a', 'Q2: b', 'Q3: c', 'Q4: d']),
  venn: () => M.drawVenn(['A: x', 'B: y', 'Ortak: z']),
  concept: () => M.drawConcept(['A -> B : ilişki', 'B → C', 'A -> C']),
  argument: () => M.drawArgument(['İddia', '+ gerekçe', '- itiraz']),
  vtimeline: () => M.drawVTimeline([{ date: '2019', text: 'a' }, { date: '2020', text: 'b' }]),
  barh: () => M.drawBarH({ rows: [{ label: 'A', value: '3' }, { label: 'B', value: '5' }] }),
  ring: () => M.drawRing({ rows: [{ label: 'A', value: '40' }] }),
  kpi: () => M.drawKpi({ rows: [{ label: 'Yıl', value: '2019' }] }),
};

test('her yeni şablon iyi biçimli SVG çizer ve listede yer alır', () => {
  for (const [type, run] of Object.entries(CASES)) {
    const r = run();
    assert.match(r.svg, /^<svg [^>]*role="img"/, type);
    assert.ok(balanced(r.svg), `${type}: etiketler dengeli`);
    assert.ok([...FIGURE_TYPES, ...CHART_TYPES].includes(type), `${type} listede`);
  }
  assert.equal(FIGURE_TYPES.length + CHART_TYPES.length, 26);
});

test('kullanıcı metni kaçışlanır (SVG içine etiket sızmaz)', () => {
  const r = M.drawRoadmap(['<script>x</script>', 'a & b']);
  assert.ok(!r.svg.includes('<script>'));
  assert.ok(r.svg.includes('&lt;script&gt;') && r.svg.includes('a &amp; b'));
});

test('sığmayan öğe silinmez, sayılır (tüzük 2.8)', () => {
  const many = Array.from({ length: 10 }, (_, i) => `Öğe ${i + 1}`);
  assert.equal(M.drawPyramid(many).hidden, 4);
  assert.equal(M.drawMatrix(many.map((x) => `${x}: a`)).hidden, 6);
  assert.equal(M.drawRoadmap(many.slice(0, 8)).hidden, 0);
});

test('sözdizimi: başlık, işaret, ilişki', () => {
  assert.deepEqual(M.splitHead('Dal: a, b; c'), { head: 'Dal', parts: ['a', 'b', 'c'] });
  assert.deepEqual(M.splitHead('Yalnız başlık'), { head: 'Yalnız başlık', parts: [] });
  assert.deepEqual(M.splitSign('Sıcaklık +'), { text: 'Sıcaklık', sign: '+' });
  assert.deepEqual(M.splitSign('Bulut örtüsü −'), { text: 'Bulut örtüsü', sign: '−' });
  assert.deepEqual(M.splitSign('Düz metin'), { text: 'Düz metin', sign: null });
  assert.deepEqual(M.splitRelation('A -> B : artırır'), { from: 'A', to: 'B', label: 'artırır' });
  assert.equal(M.splitRelation('ilişki yok'), null);
});

test('geri besleme döngü türü: eksi sayısı tekse B, çiftse R; işaretsiz okta tür yok', () => {
  assert.match(M.drawFeedback(['A +', 'B +', 'C −']).svg, />B</);
  assert.match(M.drawFeedback(['A −', 'B −']).svg, />R</);
  assert.doesNotMatch(M.drawFeedback(['A +', 'B']).svg, />[RB]<\/text>/);
});

test('sayılar uydurulmaz: huni farkı girilen sayılardan, sayı kartı yazıldığı gibi, yüzde başta', () => {
  const f = M.drawFunnel(['Taranan: 1.200', 'Dahil: 24']).svg;
  assert.match(f, /−1\.176/);
  assert.match(M.drawKpi({ rows: [{ label: 'Yıl', value: '2019' }] }).svg, />2019</);
  assert.match(M.drawBarH({ rows: [{ label: 'A', value: '42' }], unit: '%' }).svg, />%42</);
});

test('taslak çizimi her şablon türünde çalışır (dikey zaman dahil; önceden hiç çizilmiyordu)', async () => {
  const { renderFigure } = await import('../src/visuals/render.js');
  const data = {
    items: ['A: x', 'B: y', 'C -> D : z', '+ e'],
    compare: { leftTitle: 'L', rightTitle: 'R', left: 'a', right: 'b' },
    timeline: [{ date: '2019', text: 'a' }, { date: '2020', text: 'b' }],
    chart: { rows: [{ label: 'A', value: '3' }, { label: 'B', value: '5' }], unit: '', xTitle: '', yTitle: '' },
  };
  for (const type of [...FIGURE_TYPES, ...CHART_TYPES]) {
    const r = renderFigure(type, data, '', 'tr-TR', undefined, 't1');
    assert.ok(r && /^<svg /.test(r.svg), `${type} çizilmedi`);
  }
  assert.match(renderFigure('vtimeline', data, '', 'tr-TR', undefined, 't1').svg, /2019/);
});
