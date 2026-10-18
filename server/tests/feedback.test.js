import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';

const { createFeedbackRouter, FEEDBACK_MAX } = await import('../routes/feedback.js');

function serve(deps) {
  const app = express();
  app.use(express.json());
  app.use('/fb', createFeedbackRouter({
    getUserId: (req, res) => {
      if (req.get('x-user')) return req.get('x-user');
      res.status(401).json({ error: 'giris' });
      return null;
    },
    lookupUser: async () => ({ email: 'ayse@uni.edu.tr', name: 'Ayşe Yılmaz' }),
    save: async (doc) => ({ _id: 'f1', ...doc }),
    sendEmail: async () => ({ id: 'mail-1' }),
    ...deps,
  }));
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const post = (server, body, user = 'u1') => fetch(`http://127.0.0.1:${server.address().port}/fb`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) },
  body: JSON.stringify(body),
});

const OK = { kind: 'oneri', message: 'Kaynakça çıktısına IEEE biçimi eklenebilir mi?', page: 'yaz/kontrol' };

test('girişsiz geri bildirim 401', async (t) => {
  const server = await serve();
  t.after(() => new Promise((r) => server.close(r)));
  assert.equal((await post(server, OK, null)).status, 401);
});

test('tür ve uzunluk doğrulanır', async (t) => {
  const server = await serve();
  t.after(() => new Promise((r) => server.close(r)));
  assert.equal((await post(server, { ...OK, kind: 'reklam' })).status, 400);
  assert.equal((await post(server, { ...OK, message: 'kısa' })).status, 400);
  assert.equal((await post(server, { ...OK, message: 'x'.repeat(FEEDBACK_MAX + 1) })).status, 400);
});

test('dönüş izni yoksa e-posta adresi kaydedilmez ve iletilmez', async (t) => {
  let saved, mailed;
  const server = await serve({
    save: async (doc) => { saved = doc; return { _id: 'f1' }; },
    sendEmail: async (doc) => { mailed = doc; return { id: 'm' }; },
  });
  t.after(() => new Promise((r) => server.close(r)));
  const res = await post(server, OK);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, saved: true, emailed: true });
  assert.equal(saved.email, '');
  assert.equal(mailed.email, '');
  assert.equal(saved.name, 'Ayşe Yılmaz');
});

test('dönüş izni varsa adres kimlik sağlayıcısından gelir, gövdeden değil', async (t) => {
  let mailed;
  const server = await serve({ sendEmail: async (doc) => { mailed = doc; return { id: 'm' }; } });
  t.after(() => new Promise((r) => server.close(r)));
  await post(server, { ...OK, contactOk: true, email: 'saldirgan@kotu.example' });
  assert.equal(mailed.email, 'ayse@uni.edu.tr');
});

test('veritabanı yok ama e-posta gitti: alınmış sayılır; ikisi de yoksa 503', async (t) => {
  const onlyMail = await serve({ save: async () => null });
  const nothing = await serve({ save: async () => null, sendEmail: async () => ({ simulated: true }) });
  t.after(() => Promise.all([onlyMail, nothing].map((s) => new Promise((r) => s.close(r)))));
  const a = await post(onlyMail, OK);
  assert.equal(a.status, 200);
  assert.deepEqual(await a.json(), { ok: true, saved: false, emailed: true });
  const b = await post(nothing, OK);
  assert.equal(b.status, 503);
  assert.match((await b.json()).error, /info@literatur-ai\.com/);
});

test('e-posta başarılıysa kayıt "iletildi" diye işaretlenir', async (t) => {
  let marked = null;
  const server = await serve({ markEmailed: async (doc) => { marked = doc._id; } });
  t.after(() => new Promise((r) => server.close(r)));
  await post(server, OK);
  assert.equal(marked, 'f1');
});

test('uygulamada bağlı: girişsiz istek 401', async (t) => {
  const { app } = await import('../index.js');
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const fb = await fetch(`${base}/api/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(OK) });
  assert.equal(fb.status, 401);
  const ob = await fetch(`${base}/api/me/onboarding`);
  assert.equal(ob.status, 401);
});
