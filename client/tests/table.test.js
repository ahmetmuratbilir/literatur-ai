import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_COLS, MAX_ROWS, captionLine, captionTitle, createGrid, fromCells, gridFromRows, insertCol, insertRow,
  isEmptyGrid, isSingleCell, moveCol, moveRow, parseTsv, pasteBlock, removeCol, removeRow, setAlign, setCell, tableHtml,
} from '../src/visuals/table.js';
import { captionOf } from '../src/audit/audit.js';

/** WO-019 Faz 1: görsel panelinin tablo çekirdeği. */

test('createGrid: istenen boyut, başlık satırı açık, hepsi sola hizalı', () => {
  const g = createGrid(2, 3);
  assert.deepEqual(g.cells, [['', '', ''], ['', '', '']]);
  assert.equal(g.header, true);
  assert.deepEqual(g.align, ['left', 'left', 'left']);
  assert.equal(isEmptyGrid(g), true);
});

test('fromCells: kısa satırlar doldurulur', () => {
  const g = fromCells([['a', 'b', 'c'], ['d']]);
  assert.deepEqual(g.cells, [['a', 'b', 'c'], ['d', '', '']]);
});

test('satır/sütun ekle-sil-taşı; son satır ve sütun silinmez', () => {
  let g = fromCells([['a', 'b'], ['c', 'd']]);
  g = insertRow(g, 1);
  assert.deepEqual(g.cells, [['a', 'b'], ['', ''], ['c', 'd']]);
  g = insertCol(g, 0);
  assert.deepEqual(g.cells[0], ['', 'a', 'b']);
  assert.equal(g.align.length, 3);
  g = removeCol(removeRow(g, 1), 0);
  assert.deepEqual(g.cells, [['a', 'b'], ['c', 'd']]);
  g = moveRow(g, 1, 0);
  assert.deepEqual(g.cells, [['c', 'd'], ['a', 'b']]);
  g = setAlign(g, 1, 'right');
  g = moveCol(g, 1, 0);
  assert.deepEqual(g.cells, [['d', 'c'], ['b', 'a']]);
  assert.deepEqual(g.align, ['right', 'left']);
  const one = fromCells([['x']]);
  assert.equal(removeRow(one, 0), one);
  assert.equal(removeCol(one, 0), one);
});

test('setCell yalnız o hücreyi değiştirir, sınır dışı yok sayılır', () => {
  const g = fromCells([['a', 'b']]);
  assert.deepEqual(setCell(g, 0, 1, 'B').cells, [['a', 'B']]);
  assert.equal(setCell(g, 5, 0, 'x'), g);
});

test('parseTsv: Excel biçimi — sekme, satır sonu, tırnaklı çok satırlı hücre', () => {
  const text = 'Grup\tn\tOrt.\r\nA\t12\t"3,4\r\n(SS 1,1)"\r\nB\t"say ""on"""\t2,9\r\n';
  assert.deepEqual(parseTsv(text), [
    ['Grup', 'n', 'Ort.'],
    ['A', '12', '3,4\n(SS 1,1)'],
    ['B', 'say "on"', '2,9'],
  ]);
  assert.deepEqual(parseTsv('tek'), [['tek']]);
  assert.equal(isSingleCell(parseTsv('tek')), true);
  assert.equal(isSingleCell(parseTsv('a\tb')), false);
});

test('pasteBlock: imleçten başlar, ızgarayı büyütür', () => {
  const r = pasteBlock(createGrid(2, 2), 1, 1, [['x', 'y'], ['z', 'w']]);
  assert.deepEqual(r.grid.cells, [['', '', ''], ['', 'x', 'y'], ['', 'z', 'w']]);
  assert.equal(r.droppedRows, 0);
  assert.equal(r.droppedCols, 0);
});

test('pasteBlock: sınırı aşan kısım alınmaz ve sayısı döner (2.8)', () => {
  const block = Array.from({ length: MAX_ROWS + 5 }, () => Array(MAX_COLS + 2).fill('1'));
  const r = pasteBlock(createGrid(), 0, 0, block);
  assert.equal(r.grid.cells.length, MAX_ROWS);
  assert.equal(r.grid.cells[0].length, MAX_COLS);
  assert.equal(r.droppedRows, 5);
  assert.equal(r.droppedCols, 2);
});

test('tableHtml: başlık thead/th, hiza satır içi stil, kaçış, boş hücre <br>', () => {
  const g = setAlign(fromCells([['Ad', 'Değer'], ['<b>', 'a\nb'], ['', '3']]), 1, 'right');
  const html = tableHtml(g, 'v1');
  assert.match(html, /^<table class="wx-vtable" data-visual-id="v1" data-visual-kind="table"><thead><tr><th scope="col">Ad<\/th>/);
  assert.match(html, /<th scope="col" style="text-align: right;">Değer<\/th>/);
  assert.match(html, /<td>&lt;b&gt;<\/td><td style="text-align: right;">a<br>b<\/td>/);
  assert.match(html, /<tr><td><br><\/td>/);
  assert.equal(tableHtml({ ...g, header: false }, 'v1').includes('<thead>'), false);
});

test('gridFromRows: belgeden okunan tablo aynı ızgaraya döner', () => {
  const g = gridFromRows([
    [{ text: 'Ad', header: true }, { text: 'Değer', header: true, align: 'right' }],
    [{ text: ` x${String.fromCharCode(160)}` }, { text: '3', align: 'right' }],
  ]);
  assert.equal(g.header, true);
  assert.deepEqual(g.cells, [['Ad', 'Değer'], ['x', '3']]);
  assert.deepEqual(g.align, ['left', 'right']);
  assert.equal(gridFromRows([[{ text: 'a' }], [{ text: 'b', header: true }]]).header, false);
});

test('başlık satırı denetimin tanıdığı biçimde', () => {
  assert.equal(captionLine('Tablo', 2, '  Örneklem   özellikleri '), 'Tablo 2. Örneklem özellikleri');
  assert.deepEqual(captionOf(captionLine('Tablo', 2, 'X')), { kind: 'table', n: 2 });
  assert.deepEqual(captionOf(captionLine('Tablo', 1, '')), { kind: 'table', n: 1 });
  assert.equal(captionTitle('Tablo 12. Bulgular'), 'Bulgular');
  assert.equal(captionTitle('Table 3: Results'), 'Results');
});
