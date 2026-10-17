import test from 'node:test';
import assert from 'node:assert/strict';
import { WRITER_HASH, canonicalHash, parseModeHash } from '../src/modeRoutes.js';

test('adres yoksa ya da tanınmıyorsa araştırma bölümü', () => {
  for (const hash of ['', '#', '#/', '#/bilinmeyen', null, undefined]) {
    assert.equal(parseModeHash(hash).mode, 'research', String(hash));
  }
});

test('Yaz bölümü ve Kontrol paneli', () => {
  assert.equal(WRITER_HASH, '#/yaz');
  assert.deepEqual(parseModeHash('#/yaz'), { mode: 'writer', panel: null, sidebarTab: null, researchMode: null, legacy: false });
  assert.equal(parseModeHash('#/yaz/kontrol').panel, 'check');
  assert.equal(parseModeHash('#/YAZ/').mode, 'writer');
});

test('eski adresler kırık değil, yeni yerlerine yönleniyor', () => {
  const cases = {
    // WO-011 ("yazar modu" adı kalktı, WO-017)
    '#/yazar': { mode: 'writer', panel: null },
    '#/yazar/kontrol': { mode: 'writer', panel: 'check' },
    // WO-010
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

test('düzgün adres: Yaz #/yaz, araştırma boş', () => {
  assert.equal(canonicalHash(parseModeHash('#/yazar')), '#/yaz');
  assert.equal(canonicalHash(parseModeHash('#/yazar/kontrol')), '#/yaz/kontrol');
  assert.equal(canonicalHash(parseModeHash('#/yazim')), WRITER_HASH);
  assert.equal(canonicalHash(parseModeHash('#/denetim')), `${WRITER_HASH}/kontrol`);
  assert.equal(canonicalHash(parseModeHash('#/alanim')), '');
  assert.equal(canonicalHash({ mode: 'research' }), '');
});
