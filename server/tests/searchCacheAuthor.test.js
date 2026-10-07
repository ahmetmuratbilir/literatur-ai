import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchCacheFingerprint } from '../utils/searchCacheStore.js';

const base = { mainTopic: 'circadian clock', keywords: [], count: 25 };

test('yazar kimligi olmayan aramanin anahtari degismez', () => {
  // authorId alani yalnizca yazar aramasinda eklenir: bos alan olarak her
  // anahtara girseydi mevcut tum onbellek kayitlari bosa giderdi.
  const withoutField = buildSearchCacheFingerprint(base);
  const withEmpty = buildSearchCacheFingerprint({ ...base, authorId: null });
  assert.equal(withEmpty.cacheKey, withoutField.cacheKey);
  assert.equal('authorId' in withoutField.normalizedParams, false);
});

test('farkli yazarlar ayni konuda ayri onbellek anahtari alir', () => {
  const a = buildSearchCacheFingerprint({ ...base, authorName: 'Mehmet Yilmaz', authorId: 'A111' });
  const b = buildSearchCacheFingerprint({ ...base, authorName: 'Mehmet Yilmaz', authorId: 'A222' });
  const none = buildSearchCacheFingerprint(base);
  // Ayni adli iki farkli kisi birbirinin sonucunu onbellekten almamali.
  assert.notEqual(a.cacheKey, b.cacheKey);
  assert.notEqual(a.cacheKey, none.cacheKey);
  assert.match(a.displayQuery, /authorId:A111/);
});
