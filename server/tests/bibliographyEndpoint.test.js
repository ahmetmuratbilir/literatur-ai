import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
delete process.env.CLERK_SECRET_KEY;
delete process.env.CLERK_PUBLISHABLE_KEY;

const { app } = await import('../index.js');

// doi.org sahte; yerel sunucuya giden istekler gercek.
const previousDispatcher = getGlobalDispatcher();
const agent = new MockAgent();
agent.disableNetConnect();
agent.enableNetConnect(/127\.0\.0\.1/);
setGlobalDispatcher(agent);
const doiOrg = agent.get('https://doi.org');

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(async () => {
  agent.assertNoPendingInterceptors();
  await new Promise((resolve) => server.close(resolve));
  await agent.close();
  setGlobalDispatcher(previousDispatcher);
});

const post = async (body, { auth = true } = {}) => {
  const res = await fetch(`${base}/api/bibliography`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { 'x-test-user-id': 'test-user-001' } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const ZEYNEP = { key: 'z', title: 'Dogal dolasim deneyleri', creator: 'Zeynep Kaya', year: 2020, publicationName: 'Nukleer Muhendislik' };
const AHMET = { key: 'a', title: 'Pasif guvenlik sistemleri', creator: 'Ahmet Arslan', year: 2019, publicationName: 'Enerji Dergisi' };

test('kimliksiz istek reddedilir', async () => {
  const { status } = await post({ papers: [AHMET] }, { auth: false });
  assert.equal(status, 401);
});

test('bos liste, fazla kaynak ve bilinmeyen bicim 400 doner', async () => {
  assert.equal((await post({ papers: [] })).status, 400);
  assert.equal((await post({ papers: Array.from({ length: 31 }, (_, i) => ({ ...AHMET, key: String(i) })) })).status, 400);
  assert.equal((await post({ papers: [AHMET], format: 'Harvard-uydurma' })).status, 400);
});

test('APA: soyadina gore alfabetik, kunye kayittaki alanlardan', async () => {
  const { status, body } = await post({ papers: [ZEYNEP, AHMET], format: 'APA 7' });
  assert.equal(status, 200);
  assert.equal(body.format, 'APA 7');
  assert.deepEqual(body.entries.map((e) => e.key), ['a', 'z']);
  assert.match(body.entries[0].text, /^Arslan, A\. \(2019\)\. Pasif guvenlik sistemleri\. Enerji Dergisi\./);
  assert.ok(body.entries.every((e) => e.source === 'record'));
});

test('IEEE: metindeki sira korunur, numara siraya gore', async () => {
  const { body } = await post({ papers: [ZEYNEP, AHMET], format: 'IEEE' });
  assert.deepEqual(body.entries.map((e) => e.key), ['z', 'a']);
  assert.match(body.entries[0].text, /^\[1\]/);
  assert.match(body.entries[1].text, /^\[2\]/);
});

test('DOI varsa kunye doi.org\'dan gelir ve bu soylenir', async () => {
  doiOrg.intercept({ path: '/10.9999/wx-test-1', method: 'GET' }).reply(200, {
    type: 'article-journal',
    title: 'Passive decay heat removal',
    author: [{ family: 'Chen', given: 'Li' }, { family: 'Wang', given: 'Hui' }],
    issued: { 'date-parts': [[2021]] },
    'container-title': 'Nuclear Engineering and Design',
    volume: '371',
    page: '110950',
    DOI: '10.9999/wx-test-1',
  }, { headers: { 'content-type': 'application/vnd.citationstyles.csl+json' } });

  // Kayittaki alanlar eksik ve farkli: kunyenin doi.org'dan geldigi buradan anlasilir.
  const { body } = await post({ papers: [{ key: 'c', title: 'eksik baslik', doi: '10.9999/wx-test-1' }] });
  const [entry] = body.entries;
  assert.equal(entry.source, 'doi');
  assert.match(entry.text, /Chen, L\., & Wang, H\. \(2021\)\. Passive decay heat removal\. Nuclear Engineering and Design, 371, 110950/);
  assert.match(entry.text, /https:\/\/doi\.org\/10\.9999\/wx-test-1/);
});
