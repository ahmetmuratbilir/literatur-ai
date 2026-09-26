import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.ALLOW_E2E_TEST_AUTH = 'true';

const { app } = await import('../index.js');

function startServer() {
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('abonelik zorunlu degilken giris yapmis kullanici 503 almaz', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;

  // Uretimde tam olarak bu istek 503 donuyordu: kimlik gecerliydi, abonelik
  // dogrulamasi patliyordu ve fail-closed herkesi disarida birakiyordu.
  const res = await fetch(`${base}/api/search?mainTopic=test`, {
    headers: { 'x-test-user-id': 'test-user-someone' },
  });

  assert.notEqual(res.status, 503, 'abonelik kontrolu kapaliyken 503 donmemeli');
});

test('saglik raporu abonelik zorunlulugunun durumunu bildirir', async (t) => {
  process.env.ADMIN_USER_IDS = 'test-user-admin';
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/api/health/details`, {
    headers: { 'x-test-user-id': 'test-user-admin' },
  });
  const body = await res.json();

  assert.equal(typeof body.billing, 'object');
  assert.equal(body.billing.enforced, false, 'varsayilan kapali olmali');
  assert.match(body.billing.status, /kapali/);
});
