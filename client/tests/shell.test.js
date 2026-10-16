import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ROUTE, MODULES, SOURCE_TABS, closeSession, formatRoute, modeForRoute, openSession,
  parseHash, routeForMode, routeForSession, sameRoute, sessionForRoute,
} from '../src/shell/routes.js';

test('her modul ve alt sayfa gidis-donus ayni adrese cikiyor', () => {
  for (const module of MODULES) {
    const tabs = module === 'sources' ? SOURCE_TABS : [null];
    for (const tab of tabs) {
      const route = { module, tab };
      assert.deepEqual(parseHash(formatRoute(route)), route, formatRoute(route));
    }
  }
});

test('adresler Turkce ve okunur', () => {
  assert.equal(formatRoute({ module: 'write' }), '#/yazim');
  assert.equal(formatRoute({ module: 'sources', tab: 'basket' }), '#/kaynaklar/sepet');
  assert.equal(formatRoute({ module: 'audit' }), '#/denetim');
  assert.equal(formatRoute({ module: 'home' }), '#/alanim');
});

test('taninmayan adres varsayilana duser, bos ekran yok', () => {
  for (const bad of ['', '#', '#/', '#/yok-boyle-bir-sey', 'merhaba', '#/kaynaklar/uydurma', null, undefined]) {
    const route = parseHash(bad);
    assert.ok(MODULES.includes(route.module), `${bad} -> ${JSON.stringify(route)}`);
  }
  assert.deepEqual(parseHash('#/kaynaklar/uydurma'), { module: 'sources', tab: 'search' });
  assert.deepEqual(parseHash(''), DEFAULT_ROUTE);
});

test('buyuk harf, sondaki egik cizgi ve sorgu dizgesi bozmaz', () => {
  assert.deepEqual(parseHash('#/YAZIM/'), { module: 'write', tab: null });
  assert.deepEqual(parseHash('#/kaynaklar/sepet?x=1'), { module: 'sources', tab: 'basket' });
  assert.deepEqual(parseHash('#kaynaklar/arastirmaci'), { module: 'sources', tab: 'author' });
});

test('eski mode degeri ile adres birbirine cevriliyor', () => {
  for (const mode of ['search', 'author', 'workspace']) {
    assert.equal(modeForRoute(routeForMode(mode)), mode);
  }
  // Kabukta karsiligi olmayan ekranlar aramaya duser, cokmez
  assert.equal(modeForRoute({ module: 'home' }), 'search');
  assert.equal(modeForRoute({ module: 'audit' }), 'search');
});

test('calisma sekmesi oturumlari adreslerle eslesiyor', () => {
  for (const session of ['search', 'author', 'draft', 'audit']) {
    assert.equal(sessionForRoute(routeForSession(session)), session);
  }
  assert.equal(sessionForRoute({ module: 'home' }), null, 'Alanim bir oturum degil');
  assert.equal(sessionForRoute({ module: 'sources', tab: 'basket' }), null);
});

test('sekme acma tekrarsiz ve sirayi koruyor', () => {
  let tabs = [];
  tabs = openSession(tabs, 'search');
  tabs = openSession(tabs, 'draft');
  tabs = openSession(tabs, 'search');
  tabs = openSession(tabs, null);
  assert.deepEqual(tabs, ['search', 'draft']);
});

test('etkin sekme kapaninca soldaki komsuya, yoksa sagdakine, yoksa Alanima', () => {
  const tabs = ['search', 'draft', 'audit'];
  assert.deepEqual(closeSession(tabs, 'audit', 'audit'), { tabs: ['search', 'draft'], next: { module: 'write', tab: null } });
  assert.deepEqual(closeSession(tabs, 'search', 'search').next, { module: 'write', tab: null });
  assert.deepEqual(closeSession(['draft'], 'draft', 'draft'), { tabs: [], next: { module: 'home', tab: null } });
  // Etkin olmayan sekme kapaninca yer degismez
  assert.deepEqual(closeSession(tabs, 'search', 'draft'), { tabs: ['draft', 'audit'], next: null });
  // Olmayan sekme
  assert.deepEqual(closeSession(tabs, 'author', 'draft'), { tabs, next: null });
});

test('ayni adres karsilastirmasi', () => {
  assert.ok(sameRoute({ module: 'write', tab: null }, { module: 'write' }));
  assert.ok(!sameRoute({ module: 'sources', tab: 'search' }, { module: 'sources', tab: 'basket' }));
});
