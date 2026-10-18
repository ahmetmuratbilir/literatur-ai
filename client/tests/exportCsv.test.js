import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell } from '../src/hooks/useExport.js';

test('boş alan "undefined" değil boş hücre olur', () => {
  assert.equal(csvCell(undefined), '""');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(0), '"0"');
});

test('tırnak kaçışlanır', () => {
  assert.equal(csvCell('Bir "test" başlığı'), '"Bir ""test"" başlığı"');
});

test('formül gibi başlayan dış kaynak metni çalıştırılamaz (CSV enjeksiyonu)', () => {
  for (const evil of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)']) {
    assert.ok(csvCell(evil).startsWith(`"'`), evil);
  }
  assert.equal(csvCell('Normal başlık'), '"Normal başlık"');
});
