import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
delete process.env.CLERK_SECRET_KEY;
delete process.env.CLERK_PUBLISHABLE_KEY;

const { app } = await import('../index.js');

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => new Promise((resolve) => server.close(resolve)));

const post = async (body, { auth = true } = {}) => {
  const res = await fetch(`${base}/api/references/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { 'x-test-user-id': 'test-user-001' } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const BIB = `@article{kaya2020,
  title = {Doğal dolaşım deneyleri},
  author = {Kaya, Zeynep},
  journal = {Nükleer Mühendislik},
  year = {2020},
  doi = {10.9999/imp-1}
}`;

test('kimliksiz istek reddedilir', async () => {
  const { status } = await post({ text: BIB }, { auth: false });
  assert.equal(status, 401);
});

test('metin yoksa 400 doner', async () => {
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ text: 42 })).status, 400);
});

test('BibTeX icerigi kayitlara cevrilir, Turkce korunur', async () => {
  const { status, body } = await post({ text: BIB });
  assert.equal(status, 200);
  assert.equal(body.format, 'bibtex');
  assert.equal(body.total, 1);
  assert.equal(body.skipped, 0);
  assert.equal(body.entries[0].title, 'Doğal dolaşım deneyleri');
  assert.equal(body.entries[0].publicationName, 'Nükleer Mühendislik');
  assert.equal(body.entries[0].doi, '10.9999/imp-1');
});

test('RIS icerigi de ayni bicimde doner (eszamansiz ayristirici)', async () => {
  const ris = 'TY  - JOUR\nTI  - Passive safety\nAU  - Smith, John\nPY  - 2019\nSP  - 10\nEP  - 20\nER  -\n';
  const { status, body } = await post({ text: ris });
  assert.equal(status, 200);
  assert.equal(body.format, 'ris');
  assert.equal(body.entries[0].pages, '10-20');
});

test('taninmayan dosya hata kodu ile 400 doner', async () => {
  const { status, body } = await post({ text: 'bu bir kaynakca dosyasi degil' });
  assert.equal(status, 400);
  assert.equal(body.code, 'UNKNOWN_FORMAT');
  assert.match(body.error, /BibTeX/);
});

test('bos dosya ayri kod doner: kullanici sebebini gorur', async () => {
  const { status, body } = await post({ text: '   \n  ' });
  assert.equal(status, 400);
  assert.equal(body.code, 'EMPTY');
});

test('uc yalniz ayristirir: sepete hicbir sey yazmaz', async () => {
  // CLAUDE.md 2.9 — hangi kayit sepete girecegine kullanici karar verir.
  const before = await fetch(`${base}/api/basket`, { headers: { 'x-test-user-id': 'test-user-001' } });
  const beforeBody = await before.json();
  await post({ text: BIB });
  const after = await fetch(`${base}/api/basket`, { headers: { 'x-test-user-id': 'test-user-001' } });
  const afterBody = await after.json();
  assert.deepEqual(afterBody.papers, beforeBody.papers);
});
