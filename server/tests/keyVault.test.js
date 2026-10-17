import test from 'node:test';
import assert from 'node:assert/strict';
import { lastFour, openKey, sealKey, vaultReady } from '../services/keyVault.js';

const SECRET = 'test-master-secret-0123456789abcdef';
const KEY = 'sk-test-SECRET-1234567890-abcd';

test('gidiş-dönüş: şifrelenen anahtar aynen çözülür; şifreli metinde anahtar yok', () => {
  const sealed = sealKey(KEY, SECRET);
  assert.ok(sealed.cipher && sealed.iv && sealed.tag);
  assert.ok(!JSON.stringify(sealed).includes('SECRET-1234'));
  assert.equal(openKey(sealed, SECRET), KEY);
});

test('her kayıtta farklı IV: aynı anahtar iki kez farklı şifreli metin', () => {
  const a = sealKey(KEY, SECRET);
  const b = sealKey(KEY, SECRET);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.cipher, b.cipher);
});

test('bozuk etiket ya da başka ana anahtar reddedilir', () => {
  const sealed = sealKey(KEY, SECRET);
  const badTag = { ...sealed, tag: Buffer.alloc(16).toString('base64') };
  assert.throws(() => openKey(badTag, SECRET));
  assert.throws(() => openKey(sealed, 'baska-bir-ana-anahtar-0123456789'));
});

test('ana anahtar yok ya da kısa: kasa hazır değil, şifreleme reddedilir', () => {
  assert.equal(vaultReady(''), false);
  assert.equal(vaultReady('kisa'), false);
  assert.equal(vaultReady(SECRET), true);
  assert.throws(() => sealKey(KEY, ''));
});

test('arayüze yalnız son 4 karakter; kısa dizgede hiçbiri', () => {
  assert.equal(lastFour(KEY), 'abcd');
  assert.equal(lastFour('abc'), '');
});
