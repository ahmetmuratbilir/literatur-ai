import test from 'node:test';
import assert from 'node:assert/strict';

import { drawChart, drawCompare, drawCycle, drawSteps, drawTimeline, parseNumber, sentencesOf, wrapText } from '../src/visuals/draw.js';

/** WO-028 — saf SVG çizici. */

const noForeign = (s) => assert.equal(/foreignObject|https?:\/\/(?!www\.w3\.org)/.test(s), false, 'foreignObject ya da dış adres olmamalı');

test('wrapText: kelime ortasında kırmaz; sığmayan uzun kelimede puntoyu küçültür', () => {
  const r = wrapText('Dijital ikizlerin bakım maliyetleriyle ilişkilendirilmesi', 120, { size: 13, maxLines: 3 });
  for (const line of r.lines) assert.equal(/\S-$/.test(line), false);
  assert.ok(r.lines.join(' ').includes('ilişkilendirilmesi'), 'uzun kelime bütün kalmalı');
  assert.ok(r.size <= 13);
  assert.deepEqual(wrapText('', 100).lines, ['']);
});

test('şekiller: öğe metni birebir, kaçışlı; foreignObject yok', () => {
  const steps = drawSteps(['Veri <toplama>', 'Analiz', 'Rapor']);
  assert.match(steps, /Veri &lt;toplama&gt;/);
  assert.match(steps, /role="img"/);
  noForeign(steps);
  const cycle = drawCycle(['Plan', 'Uygula', 'Kontrol', 'Önlem']);
  for (const w of ['Plan', 'Uygula', 'Kontrol', 'Önlem']) assert.ok(cycle.includes(`>${w}<`));
  noForeign(cycle);
  const cmp = drawCompare({ leftTitle: 'Aktif', rightTitle: 'Pasif', left: ['Pompa gerekir'], right: ['Doğal dolaşım'] });
  assert.ok(cmp.includes('Doğal dolaşım'));
  noForeign(cmp);
  const tl = drawTimeline([{ date: '2019', text: 'Başlangıç' }, { date: '2023', text: 'Sonuç' }]);
  assert.ok(tl.includes('2019') && tl.includes('Sonuç'));
  noForeign(tl);
  // Boş öğeler çizilmez
  assert.equal((drawSteps(['A', '  ', 'B']).match(/<rect x=/g) || []).length, 2); // boş öğe kutusu yok
});

test('parseNumber: Türkçe ondalık virgül ve binlik nokta; sayı olmayan null', () => {
  assert.equal(parseNumber('3,4'), 3.4);
  assert.equal(parseNumber('1.250,5'), 1250.5);
  assert.equal(parseNumber('42'), 42);
  assert.equal(parseNumber('-0,5'), -0.5);
  assert.equal(parseNumber('yok'), null);
  assert.equal(parseNumber(''), null);
});

test('grafik: değerler birebir yazılır; sayı olmayan satır çizilmez ve sayılır (2.8)', () => {
  const r = drawChart('bar', { rows: [{ label: 'Deney', value: '3,4' }, { label: 'Kontrol', value: '2,9' }, { label: 'Eksik', value: '—' }], unit: 'puan', yTitle: 'Ortalama' });
  assert.equal(r.count, 2);
  assert.equal(r.skipped, 1);
  assert.ok(r.svg.includes('>3,4<') && r.svg.includes('>2,9<'));
  assert.equal(r.svg.includes('Eksik'), false);
  assert.ok(r.svg.includes('Ortalama (puan)'));
  noForeign(r.svg);
  const line = drawChart('line', { rows: [{ label: '2020', value: 1 }, { label: '2021', value: 4 }] });
  assert.match(line.svg, /<path d="M/);
});

test('sentencesOf: paragrafı cümlelere böler (öğe önerisi; kullanıcı düzenler)', () => {
  assert.deepEqual(sentencesOf('Isı çekirdekten alınır. Su buharlaşır! Yoğuşan su geri döner.'), ['Isı çekirdekten alınır', 'Su buharlaşır', 'Yoğuşan su geri döner']);
});
