import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// Clerk anahtarlari olmadan uygulamayi ayaga kaldiriyoruz: regresyonun tam kosulu bu.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
delete process.env.CLERK_SECRET_KEY;
delete process.env.CLERK_PUBLISHABLE_KEY;

const { app } = await import('../index.js');

function startServer() {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('Clerk yapilandirilmamisken korumali uclar 500 degil 401 doner', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${baseUrl}/api/search?mainTopic=nuclear`);

  assert.equal(
    response.status,
    401,
    'clerkMiddleware() eksik anahtarla exception firlatirsa burasi 500 olur'
  );

  const body = await response.json();
  assert.equal(typeof body.error, 'string');
});

test('hata yanitlari stack trace veya dosya yolu sizdirmaz', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${baseUrl}/api/search?mainTopic=nuclear`);
  const raw = await response.text();

  assert.equal(raw.includes('node_modules'), false, 'yanit node_modules yolu icermemeli');
  assert.equal(raw.includes('    at '), false, 'yanit stack trace icermemeli');
});

test('saglik detayi Clerk yapilandirmasinin eksikligini raporlar', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  // /api/health/details kimlik dogrulamasi ister; test modunda bu baslik gecerli.
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${baseUrl}/api/health/details`, {
    headers: { 'x-test-user-id': 'test-user-001' },
  });
  const body = await response.json();

  assert.equal(body.auth.configured, false);
  assert.match(body.auth.status, /missing/);
});
