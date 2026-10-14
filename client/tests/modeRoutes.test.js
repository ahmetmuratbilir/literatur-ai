import test from 'node:test';
import assert from 'node:assert/strict';
import { WRITER_HASH, canonicalHash, parseModeHash } from '../src/modeRoutes.js';

test('adres yoksa ya da tanınmıyorsa araştırma modu', () => {
  for (const hash of ['', '#', '#/', '#/bilinmeyen', null, undefined]) {
    assert.equal(parseModeHash(hash).mode, 'research', String(hash));
  }
});

test('yazar modu ve Kontrol paneli', () => {
  assert.deepEqual(parseModeHash('#/yazar'), { mode: 'writer', panel: null, sidebarTab: null, researchMode: null, legacy: false });
  assert.equal(parseModeHash('#/yazar/kontrol').panel, 'check');
  assert.equal(parseModeHash('#/YAZAR/').mode, 'writer');
});

test('WO-010 adresleri kırık değil, yeni yerlerine yönleniyor', () => {
  const cases = {
    '#/yazim': { mode: 'writer', panel: null },
    '#/denetim': { mode: 'writer', panel: 'check' },
    '#/alanim': { mode: 'research', sidebarTab: 'works' },
    '#/kaynaklar/sepet': { mode: 'research', sidebarTab: 'basket' },
    '#/kaynaklar/favoriler': { mode: 'research', sidebarTab: 'favorites' },
    '#/kaynaklar/arastirmaci': { mode: 'research', researchMode: 'author' },
    '#/kaynaklar/ara': { mode: 'research' },
  };
  for (const [hash, expected] of Object.entries(cases)) {
    const route = parseModeHash(hash);
    assert.equal(route.legacy, true, hash);
    for (const [k, v] of Object.entries(expected)) assert.equal(route[k], v, `${hash}.${k}`);
  }
});

test('düzgün adres: yazar #/yazar, araştırma boş', () => {
  assert.equal(canonicalHash(parseModeHash('#/yazim')), WRITER_HASH);
  assert.equal(canonicalHash(parseModeHash('#/denetim')), `${WRITER_HASH}/kontrol`);
  assert.equal(canonicalHash(parseModeHash('#/alanim')), '');
  assert.equal(canonicalHash({ mode: 'research' }), '');
});
