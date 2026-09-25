import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';

const { app } = await import('../index.js');

function startServer() {
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('bicimsiz shareId veritabanina gitmeden 404 doner', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Gecersiz bicimler: uzunluk, alfabe, bos.
  for (const bad of ['abc', 'ZZZZZZZZZZZZZZZZ', '0123456789abcdef0', '../../etc/passwd']) {
    const res = await fetch(`${baseUrl}/api/share/${encodeURIComponent(bad)}`);
    assert.equal(res.status, 404, `"${bad}" icin 404 beklendi, ${res.status} alindi`);

    const body = await res.json();
    assert.equal(typeof body.error, 'string');
  }
});

test('gecerli bicimli shareId veritabani yokken 503 doner', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const res = await fetch(`${baseUrl}/api/share/0123456789abcdef`);

  // Bicim gecerli oldugu icin akis veritabani kontrolune ilerlemeli.
  assert.equal(res.status, 503, 'gecerli kimlik db kontrolune ulasmali');
});

test('share yanitlari stack trace sizdirmaz', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const raw = await (await fetch(`${baseUrl}/api/share/0123456789abcdef`)).text();

  assert.equal(raw.includes('node_modules'), false);
  assert.equal(raw.includes('    at '), false);
});
