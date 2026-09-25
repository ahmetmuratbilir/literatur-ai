import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.ADMIN_USER_IDS = 'test-user-admin, test-user-second';

const { app } = await import('../index.js');

function startServer() {
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function asUser(id) {
  return { headers: { 'x-test-user-id': id } };
}

test('kimliksiz kullanici sistem durumunu goremez', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/api/health/details`);
  assert.equal(res.status, 401);
});

test('admin olmayan giris yapmis kullanici sistem durumunu goremez', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;

  // Bu ucta onceden HERHANGI bir giris yapmis kullanici, hangi API anahtarinin
  // yapilandirildigini ve veritabani durumunu gorebiliyordu.
  const res = await fetch(`${base}/api/health/details`, asUser('test-user-normal'));

  assert.equal(res.status, 403);
  const body = await res.json();
  assert.match(body.error, /yetkiniz yok/i);
});

test('admin sistem durumunu gorebilir', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/api/health/details`, asUser('test-user-admin'));
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.environment_validation, 'object');
});

test('listede bosluklu yazilmis kimlik de kabul edilir', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;

  // ADMIN_USER_IDS icinde ' test-user-second' bosluklu yazildi.
  const res = await fetch(`${base}/api/health/details`, asUser('test-user-second'));
  assert.equal(res.status, 200);
});

test('/api/me admin durumunu bildirir', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const admin = await (await fetch(`${base}/api/me`, asUser('test-user-admin'))).json();
  assert.deepEqual(admin, { userId: 'test-user-admin', isAdmin: true });

  const normal = await (await fetch(`${base}/api/me`, asUser('test-user-normal'))).json();
  assert.equal(normal.isAdmin, false);

  const anon = await fetch(`${base}/api/me`);
  assert.equal(anon.status, 401);
});

test('admin listesi bos ise hic kimse admin degildir', async () => {
  // Ayri bir sureçte calistirmak yerine dogrudan davranisi dogruluyoruz:
  // bos liste "herkes admin" anlamina gelmemeli.
  const previous = process.env.ADMIN_USER_IDS;
  process.env.ADMIN_USER_IDS = '';
  try {
    const server = await startServer();
    const base = `http://127.0.0.1:${server.address().port}`;
    const res = await fetch(`${base}/api/me`, asUser('test-user-admin'));
    const body = await res.json();
    assert.equal(body.isAdmin, false, 'unutulmus yapilandirma tam yetkiye donusmemeli');
    await new Promise((r) => server.close(r));
  } finally {
    process.env.ADMIN_USER_IDS = previous;
  }
});

test('canli servis kontrolu admin olmayana kapali', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const anon = await fetch(`${base}/api/admin/verify-keys`, { method: 'POST' });
  assert.equal(anon.status, 401);

  const normal = await fetch(`${base}/api/admin/verify-keys`, {
    method: 'POST',
    ...asUser('test-user-normal'),
  });
  assert.equal(normal.status, 403);
});
