import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayerStack } from '../src/components/ui/layerStack.js';

const esc = () => ({ key: 'Escape', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });

test('Esc yalnız en üstteki katmanı kapatır', () => {
  const s = createLayerStack();
  const closed = [];
  s.push({ close: () => closed.push('menü') });
  s.push({ close: () => closed.push('pencere') });
  assert.equal(s.handleKey(esc()), true);
  assert.deepEqual(closed, ['pencere']);
});

test('kapanan katman çıkınca sıradaki üste gelir', () => {
  const s = createLayerStack();
  const closed = [];
  const a = { close: () => closed.push('a') };
  const b = { close: () => closed.push('b') };
  s.push(a);
  const removeB = s.push(b);
  removeB();
  s.handleKey(esc());
  assert.deepEqual(closed, ['a']);
});

test('yığın boşken Esc işlenmez; başka tuş işlenmez', () => {
  const s = createLayerStack();
  assert.equal(s.handleKey(esc()), false);
  s.push({ close: () => assert.fail('kapanmamalı') });
  assert.equal(s.handleKey({ key: 'Enter' }), false);
});

test('giriş alanı Esc\'yi karşıladıysa (preventDefault) yığın dokunmaz', () => {
  const s = createLayerStack();
  s.push({ close: () => assert.fail('kapanmamalı') });
  const e = esc();
  e.preventDefault();
  assert.equal(s.handleKey(e), false);
});

test('aynı katman iki kez girmez; ortadaki çıkarılabilir', () => {
  const s = createLayerStack();
  const a = { close() {} };
  const b = { close() {} };
  const c = { close() {} };
  s.push(a); s.push(a); s.push(b); s.push(c);
  assert.equal(s.size(), 3);
  s.remove(b);
  assert.equal(s.top(), c);
  s.remove(c);
  assert.equal(s.top(), a);
});
