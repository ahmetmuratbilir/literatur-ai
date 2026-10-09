import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
delete process.env.CLERK_SECRET_KEY;
delete process.env.CLERK_PUBLISHABLE_KEY;
delete process.env.ORCID_ACCESS_TOKEN;

const { app } = await import('../index.js');

// OpenAlex ve ORCID sahte; yerel sunucuya giden istekler gercek.
const previousDispatcher = getGlobalDispatcher();
const agent = new MockAgent();
agent.disableNetConnect();
agent.enableNetConnect(/127\.0\.0\.1/);
setGlobalDispatcher(agent);
const openalex = agent.get('https://api.openalex.org');
const orcid = agent.get('https://pub.orcid.org');

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(async () => {
  // Kurulan her sahte cevap gercekten istendi mi: istenmeyen varsa bir yol hic calismamis demektir.
  agent.assertNoPendingInterceptors();
  await new Promise((resolve) => server.close(resolve));
  await agent.close();
  setGlobalDispatcher(previousDispatcher);
});

const AUTH = { headers: { 'x-test-user-id': 'test-user-001' } };
const author = (id, extra = {}) => ({
  id: `https://openalex.org/${id}`, display_name: id, works_count: 3, cited_by_count: 1,
  last_known_institutions: [{ display_name: 'Hacettepe University', country_code: 'TR' }], ...extra,
});
const get = async (path) => {
  const res = await fetch(`${base}${path}`, AUTH);
  return { status: res.status, body: await res.json() };
};
// MockAgent sorgu parametrelerini alfabetik siraya diziyor; yol + parametre ayri bakilir.
const pathOf = (prefix) => (p) => {
  const [want, wantQuery = ''] = prefix.split('?');
  const [path, query = ''] = p.split('?');
  return path.startsWith(want) && (!wantQuery || query.split('&').some((kv) => kv.startsWith(wantQuery)));
};

test('kimliksiz istek 401', async () => {
  const res = await fetch(`${base}/api/authors?q=Ahmet%20Yilmaz`);
  assert.equal(res.status, 401);
  const enr = await fetch(`${base}/api/authors/orcid?ids=0000-0002-1594-3680`);
  assert.equal(enr.status, 401);
});

test('liste yalnizca OpenAlexten gelir; NULL ve silinmis yazar suzulur', async () => {
  openalex.intercept({ path: pathOf('/authors?search=Ahmet') }).reply(200, {
    results: [author('A1', { orcid: 'https://orcid.org/0000-0002-1594-3680' }), author('A9999999999'), author('A5317838346'), author('A2')],
  });
  const { status, body } = await get('/api/authors?q=Ahmet%20Yilmaz');
  assert.equal(status, 200);
  assert.deepEqual(body.authors.map((a) => a.id), ['A1', 'A2']);
  assert.equal(body.authors[0].orcid, '0000-0002-1594-3680');
  assert.equal(body.authors[0].source, undefined, 'kaynak etiketi yok');
});

// Kurumlu aramada iki /authors istegi paralel gider: biri kurum filtreli, biri degil.
const authorsQuery = (filtered, onMatch = () => {}) => (p) => {
  const [path, query = ''] = p.split('?');
  const params = query.split('&');
  const ok = path === '/authors' && params.some((kv) => kv.startsWith('search='))
    && params.some((kv) => kv.startsWith('filter=')) === filtered;
  if (ok) onMatch(p);
  return ok;
};
const institutions = (search, reply) => openalex.intercept({ path: pathOf(`/institutions?search=${search}`) }).reply(...reply);

test('kurum siralama sinyali: eslesenler ustte, digerleri altta, ayni kisi bir kez', async () => {
  institutions('Hacettepe', [200, { results: [{ id: 'https://openalex.org/I66514158' }, { id: 'https://openalex.org/I2802421040' }] }]);
  let filteredPath = '';
  openalex.intercept({ path: authorsQuery(true, (p) => { filteredPath = p; }) }).reply(200, { results: [author('A3'), author('A1')] });
  openalex.intercept({ path: authorsQuery(false) }).reply(200, { results: [author('A1'), author('A2'), author('A4')] });
  const { status, body } = await get('/api/authors?q=Ahmet%20Yilmaz&inst=Hacettepe');
  assert.equal(status, 200);
  assert.deepEqual(body.authors.map((a) => [a.id, a.institutionMatch]), [['A3', true], ['A1', true], ['A2', false], ['A4', false]]);
  assert.deepEqual(body.institution, { status: 'matched', matched: 2, nameSearchFailed: false });
  assert.match(decodeURIComponent(filteredPath), /filter=affiliations\.institution\.id:I66514158\|I2802421040/);
});

test('kurumda bu adla kimse yoksa isim listesi gelir ve bu soylenir', async () => {
  institutions('Hacettepe', [200, { results: [{ id: 'https://openalex.org/I66514158' }] }]);
  openalex.intercept({ path: authorsQuery(true) }).reply(200, { results: [] });
  openalex.intercept({ path: authorsQuery(false) }).reply(200, { results: [author('A2')] });
  const { body } = await get('/api/authors?q=Ahmet%20Yilmaz&inst=Hacettepe');
  assert.deepEqual(body.authors.map((a) => [a.id, a.institutionMatch]), [['A2', false]]);
  assert.deepEqual(body.institution, { status: 'matched', matched: 0, nameSearchFailed: false });
});

test('kurum bulunamazsa isim listesi yine gelir, durum not_found olarak soylenir', async () => {
  institutions('Yokboyle', [200, { results: [] }]);
  openalex.intercept({ path: authorsQuery(false) }).reply(200, { results: [author('A2')] });
  const { status, body } = await get('/api/authors?q=Ahmet%20Yilmaz&inst=Yokboyle');
  assert.equal(status, 200);
  assert.deepEqual(body.authors.map((a) => a.id), ['A2']);
  assert.deepEqual(body.institution, { status: 'not_found', matched: 0, nameSearchFailed: false });
});

test('kurum aramasi duserse isim listesi gelir, durum error olarak soylenir', async () => {
  institutions('Hacettepe', [503, {}]);
  openalex.intercept({ path: authorsQuery(false) }).reply(200, { results: [author('A2')] });
  const { status, body } = await get('/api/authors?q=Ahmet%20Yilmaz&inst=Hacettepe');
  assert.equal(status, 200);
  assert.deepEqual(body.authors.map((a) => a.id), ['A2']);
  assert.deepEqual(body.institution, { status: 'error', matched: 0, nameSearchFailed: false });
});

test('isim aramasi duser kurum eslesirse yalniz eslesenler gelir ve bu soylenir', async () => {
  institutions('Hacettepe', [200, { results: [{ id: 'https://openalex.org/I66514158' }] }]);
  openalex.intercept({ path: authorsQuery(true) }).reply(200, { results: [author('A3')] });
  openalex.intercept({ path: authorsQuery(false) }).reply(503, {});
  const { status, body } = await get('/api/authors?q=Ahmet%20Yilmaz&inst=Hacettepe');
  assert.equal(status, 200);
  assert.deepEqual(body.authors.map((a) => a.id), ['A3']);
  assert.deepEqual(body.institution, { status: 'matched', matched: 1, nameSearchFailed: true });
});

test('kurumlu aramada iki yol da duserse 502', async () => {
  institutions('Hacettepe', [503, {}]);
  openalex.intercept({ path: authorsQuery(false) }).reply(503, {});
  const { status } = await get('/api/authors?q=Ahmet%20Yilmaz&inst=Hacettepe');
  assert.equal(status, 502);
});

test('tek harfli kurum yok sayilir, kurum alani donmez', async () => {
  openalex.intercept({ path: authorsQuery(false) }).reply(200, { results: [author('A2')] });
  const { body } = await get('/api/authors?q=Ahmet%20Yilmaz&inst=H');
  assert.deepEqual(body.authors.map((a) => a.id), ['A2']);
  assert.equal(body.institution, undefined);
});

test('yapistirilan ORCID iD tekil sorguyla tek kayda cozulur', async () => {
  openalex.intercept({ path: pathOf('/authors/orcid:0000-0002-1594-3680') })
    .reply(200, author('A5034625040', { orcid: 'https://orcid.org/0000-0002-1594-3680' }));
  const { body } = await get('/api/authors?q=https%3A%2F%2Forcid.org%2F0000-0002-1594-3680');
  assert.deepEqual(body.authors.map((a) => a.id), ['A5034625040']);
});

test('OpenAlexte karsiligi olmayan ORCID bos liste doner', async () => {
  openalex.intercept({ path: pathOf('/authors/orcid:0000-0002-1694-233X') }).reply(404, { error: 'not found' });
  const { status, body } = await get('/api/authors?q=0000-0002-1694-233X');
  assert.equal(status, 200);
  assert.deepEqual(body.authors, []);
});

test('OpenAlex hatasi 502 doner', async () => {
  openalex.intercept({ path: pathOf('/authors?search=Hata') }).reply(503, {});
  const { status } = await get('/api/authors?q=Hata%20Testi');
  assert.equal(status, 502);
});

test('ORCID kapaliyken zenginlestirme ORCIDe hic gitmez', async () => {
  process.env.ORCID_ENABLED = 'false';
  // Intercept yok: istek gitseydi MockAgent hata verirdi.
  const { body } = await get('/api/authors/orcid?ids=0000-0002-1594-3680');
  assert.deepEqual(body, { enabled: false, affiliations: {} });
});

test('ORCID aciksa kurum gecmisi tek istekte gelir', async () => {
  process.env.ORCID_ENABLED = 'true';
  let seenPath = '';
  orcid.intercept({ path: (p) => { seenPath = p; return p.startsWith('/v3.0/expanded-search/'); } }).reply(200, {
    'expanded-result': [{ 'orcid-id': '0000-0002-1594-3680', 'institution-name': ['Hacettepe University', 'Uludağ University'] }],
  });
  const { body } = await get('/api/authors/orcid?ids=0000-0002-1594-3680,bozuk,0000-0002-1694-233X');
  assert.deepEqual(body, { enabled: true, affiliations: { '0000-0002-1594-3680': ['Hacettepe University', 'Uludağ University'] } });
  assert.match(decodeURIComponent(seenPath.replace(/\+/g, ' ')), /q=orcid:\(0000-0002-1594-3680 OR 0000-0002-1694-233X\)/);
});

test('ORCID hata verirse zenginlestirme bos doner, istek basarisiz sayilmaz', async () => {
  process.env.ORCID_ENABLED = 'true';
  orcid.intercept({ path: pathOf('/v3.0/expanded-search/') }).reply(503, {});
  const { status, body } = await get('/api/authors/orcid?ids=0000-0002-1594-3680');
  assert.equal(status, 200);
  assert.deepEqual(body, { enabled: true, affiliations: {}, failed: true });
});
