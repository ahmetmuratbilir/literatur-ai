import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  APPEARANCE_DEFAULT, drawChart, drawCompare, drawCycle, drawSteps, drawTimeline, isDefaultAppearance, normalizeAppearance,
} from '../src/visuals/draw.js';

/** WO-030 Faz 4 — şekil/grafik görünümü (palet, desen, köşe, yazı boyutu). */

const sha = (s) => createHash('sha256').update(s).digest('hex');

// Görünüm eklenmeden önceki çizicinin çıktısının özetleri (2026-10-20, değişiklikten önce alındı).
const GOLDEN = {
  steps: ['61e415802167c6953aef0936c94f8f08a9c72f55f0e0cb7c957a8989db66bd1e', (o) => drawSteps(['Veri <toplama>', 'Analiz', 'Rapor', 'Yaz', 'Beş'], o)],
  cycle: ['b9930746574e0bea03866f447c955fb01ab420a5280e0a71fe8198ccc431f509', (o) => drawCycle(['Plan', 'Uygula', 'Kontrol', 'Önlem'], o)],
  compare: ['ce9882ff28fcb55e52d70c9d8ee5f6083464f7b3656afa3be668b3eb2d9d8670', (o) => drawCompare({ leftTitle: 'Aktif', rightTitle: 'Pasif', left: ['Pompa gerekir', 'x'], right: ['Doğal dolaşım'] }, o)],
  timeline: ['799037cad0fd29ad84d85a884880d47c71e622eb7cb51916a1a29e43339deffc', (o) => drawTimeline([{ date: '2019', text: 'Başlangıç' }, { date: '2023', text: 'Sonuç' }], o)],
  bar: ['0e0a7fb41c31287ba31abfc588b8539872fa13bcac967176ae9b21c7aaf3ba86', (o) => drawChart('bar', { rows: [{ label: 'A', value: '3,4' }, { label: 'B', value: '-2' }, { label: 'C', value: 'x' }], unit: 'p', yTitle: 'Y', xTitle: 'X' }, o).svg],
  line: ['d1e01c5be4a6c326001161d1ab050e7078683691fb06b8e1a938ee6a98883af3', (o) => drawChart('line', { rows: [{ label: 'A', value: '3,4' }, { label: 'B', value: '2' }] }, o).svg],
};

const bars = (appearance, uid) => drawChart('bar', { rows: [{ label: 'A', value: 3 }, { label: 'B', value: 5 }, { label: 'C', value: 2 }, { label: 'D', value: 4 }, { label: 'E', value: 1 }] }, { appearance, uid }).svg;
const ids = (s) => [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);

test('varsayılan görünüm: çıktı bugünküyle bayt bayt aynı (görünüm yok, boş ya da açık varsayılan)', () => {
  for (const [name, [hash, draw]] of Object.entries(GOLDEN)) {
    assert.equal(sha(draw()), hash, `${name}: görünüm verilmeden`);
    assert.equal(sha(draw({ appearance: {} })), hash, `${name}: boş görünüm`);
    assert.equal(sha(draw({ appearance: { ...APPEARANCE_DEFAULT }, uid: 'x1' })), hash, `${name}: açık varsayılan`);
    assert.equal(draw({ appearance: { palette: 'yok', text: 42 } }), draw(), `${name}: bilinmeyen değer varsayılana döner`);
  }
});

test('normalizeAppearance / isDefaultAppearance', () => {
  assert.deepEqual(normalizeAppearance(null), APPEARANCE_DEFAULT);
  assert.deepEqual(normalizeAppearance({ palette: 'bw', pattern: 'kareli' }), { ...APPEARANCE_DEFAULT, palette: 'bw' });
  assert.equal(isDefaultAppearance(undefined), true);
  assert.equal(isDefaultAppearance({ corners: 'square' }), false);
});

test('palet uygulanır: renk körü dostu Okabe–Ito, gri tonlar, siyah-beyaz kalın çerçeve', () => {
  const cvd = drawCompare({ leftTitle: 'A', rightTitle: 'B', left: ['x'], right: ['y'] }, { appearance: { palette: 'cvd' } });
  assert.ok(cvd.includes('#0072B2') && cvd.includes('#D55E00'));
  assert.equal(cvd.includes('#4f46e5'), false, 'varsayılan mor kalmamalı');
  const gray = bars({ palette: 'gray' });
  assert.ok(gray.includes('fill="#3a3a3a"'));
  assert.equal(/#4f46e5|#7c3aed/.test(gray), false);
  const bw = bars({ palette: 'bw' });
  assert.ok(bw.includes('fill="#000000"'));
  assert.match(bw, /stroke="#000000" stroke-width="1\.9"/, 'siyah-beyazda çubuklar çerçeveli, kalın');
  // Ok ucu rengi paletten; kimliği şekle özgü (başka şekilde aynı "ah" kimliği başka renkte olmasın).
  const steps = drawSteps(['A', 'B'], { appearance: { palette: 'cvd' }, uid: 'f1' });
  assert.ok(steps.includes('<marker id="f1-ah"') && steps.includes('url(#f1-ah)'));
});

test('desen: dönüşümlü desenler, çerçeveli çubuk; kimlikler şekle özgü ve çakışmaz', () => {
  const s = bars({ pattern: 'stripes' }, 'figA');
  const p = ids(s).filter((id) => id.includes('-p'));
  assert.equal(p.length, 4, 'beş çubukta dört dönüşümlü desen (beşinci birinciyi tekrarlar)');
  assert.equal(new Set(p).size, p.length);
  assert.ok(p.every((id) => id.startsWith('figA-')));
  const fills = [...s.matchAll(/<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" rx="3" fill="url\(#([^)]+)\)"/g)].map((m) => m[1]);
  assert.equal(fills.length, 5);
  assert.notEqual(fills[0], fills[1], 'yan yana çubuklar farklı desen');
  assert.equal(fills[0], fills[4]);
  for (const f of fills) assert.ok(s.includes(`<pattern id="${f}"`), 'her başvurunun tanımı aynı SVG içinde');
  assert.match(s, /patternTransform="rotate\(45\)"/);
  assert.match(bars({ pattern: 'dots' }, 'x'), /<pattern id="x-p0"[^>]*>.*<circle /);
  // Kimlik verilmezse her çizim yeni kimlik alır: aynı belgede iki şekil çakışmaz.
  const one = ids(bars({ pattern: 'dots' })); const two = ids(bars({ pattern: 'dots' }));
  assert.equal(one.filter((id) => two.includes(id)).length, 0);
  // Kutular da desenlenir (metin okunur kalsın diye açık renk çizgi).
  assert.match(drawSteps(['A', 'B', 'C'], { appearance: { pattern: 'stripes' }, uid: 's' }), /fill="url\(#s-p2\)"/);
  // Desen olmayan türde defs eklenmez.
  assert.equal(/<pattern/.test(drawChart('line', { rows: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }, { appearance: { pattern: 'stripes' } }).svg), false);
  assert.equal(/<pattern/.test(drawTimeline([{ date: '1', text: 'a' }, { date: '2', text: 'b' }], { appearance: { pattern: 'dots' } })), false);
});

test('köşe ve yazı boyutu', () => {
  const sq = drawSteps(['A', 'B'], { appearance: { corners: 'square' } });
  assert.equal(/rx="(?!0")/.test(sq), false, 'köşeli: bütün rx 0');
  const size = (s) => [...s.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  const normal = size(bars());
  const small = size(bars({ text: 'small' }));
  const large = size(bars({ text: 'large' }));
  assert.equal(small.length, normal.length);
  normal.forEach((n, i) => {
    assert.ok(small[i] < n, 'küçük');
    assert.ok(large[i] > n, 'büyük');
  });
  assert.ok(size(bars({ text: 'large' })).includes(12.1), '10.5 × 1.15 → 12.1');
});
