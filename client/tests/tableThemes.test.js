import test from 'node:test';
import assert from 'node:assert/strict';

import { TABLE_THEMES, cellLook, tableBorders, themeCss, themeRules } from '../src/components/workspace/tableThemes.js';

/** WO-031 — tablo temaları: ekran CSS'i ve Word görünümü aynı veriden. */

const HEX = /^[0-9A-F]{6}$/;

test('her tema tam: renkler altı haneli, çizgi düzeni bilinen, APA ve Kitap çizgisi APA', () => {
  assert.ok(TABLE_THEMES.length >= 20);
  const ids = new Set();
  for (const th of TABLE_THEMES) {
    assert.ok(!ids.has(th.id), `tekrar: ${th.id}`);
    ids.add(th.id);
    for (const key of ['headInk', 'rule']) assert.match(th[key], HEX, `${th.id}.${key}`);
    for (const key of ['head', 'band']) if (th[key] !== null) assert.match(th[key], HEX, `${th.id}.${key}`);
    assert.ok(['apa', 'booktabs', 'grid', 'rows', 'head', 'none'].includes(th.rules));
  }
  assert.deepEqual(TABLE_THEMES.filter((th) => th.apa).map((th) => th.id), ['apa', 'booktabs']);
});

test('ekran CSS: APA dışındaki her temanın kuralı var; APA için tema kuralı yok (bugünkü görünüm)', () => {
  const css = themeCss();
  for (const th of TABLE_THEMES) {
    const has = css.includes(`[data-theme="${th.id}"]{--tt-head`);
    assert.equal(has, th.id !== 'apa', th.id);
  }
});

test('Word hücre görünümü: başlık zemini ve yazı rengi, bant yalnız seçiliyse, toplam satırı kalın + üst çizgi', () => {
  const lac = TABLE_THEMES.find((th) => th.id === 'lacivert');
  const head = cellLook(lac, { band: true, total: true }, { head: true, rowInBody: -1, lastBody: false, col: 0 });
  assert.deepEqual([head.fill, head.ink, head.bold], ['1E3A5F', 'FFFFFF', true]);
  const second = cellLook(lac, { band: true }, { head: false, rowInBody: 1, lastBody: false, col: 1 });
  assert.equal(second.fill, 'EEF2F7');
  assert.equal(cellLook(lac, { band: false }, { head: false, rowInBody: 1, lastBody: false, col: 1 }).fill, null);
  const total = cellLook(lac, { total: true }, { head: false, rowInBody: 3, lastBody: true, col: 2 });
  assert.equal(total.bold, true);
  assert.deepEqual(total.borders.top, themeRules(lac).totalTop);
  const first = cellLook(lac, { firstcol: true }, { head: false, rowInBody: 0, lastBody: false, col: 0 });
  assert.equal(first.bold, true);
});

test('Word tablo kenarlıkları: APA üst ve alt, dikey yok; ızgara her yerde', () => {
  const apa = tableBorders(TABLE_THEMES[0]);
  assert.ok(apa.top && apa.bottom);
  assert.equal(apa.insideVertical, null);
  const grid = tableBorders(TABLE_THEMES.find((th) => th.id === 'izgara'));
  assert.ok(grid.insideVertical && grid.insideHorizontal && grid.left && grid.right);
});
