import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.WRITER_POSTCHECK_ENABLED = 'false';
process.env.WRITER_GATE_MODE = 'warn_only';

const { app } = await import('../index.js');
const { __setGenerationAdapterForTests, __resetGenerationAdapterForTests } = await import(
  '../services/writerGenerationBridge.js'
);

function startServer() {
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const VALID_BODY = {
  papers: [{ title: 'A test paper', year: 2024, description: 'A short abstract.' }],
  prompt: 'Bu makale icin kisa bir akademik degerlendirme yaz.',
};

test('kimliksiz writer istegi 401 doner', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));

  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/writer/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(VALID_BODY),
  });

  assert.equal(res.status, 401);
});

test('revision-roadmap ucu de abonelik kontrolunden geciyor', async (t) => {
  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));

  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/writer/revision-roadmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewerText: 'Hakem yorumu.' }),
  });

  assert.equal(res.status, 401);
});

test('test kimligi yalnizca uretim disinda kabul edilir', async (t) => {
  __setGenerationAdapterForTests(async (...args) => {
    const res = args[6];
    res.write(`data: ${JSON.stringify({ token: 'ok' })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  });
  t.after(() => __resetGenerationAdapterForTests());

  const server = await startServer();
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/api/writer/generate`;

  const allowed = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'test-user-001' },
    body: JSON.stringify(VALID_BODY),
  });
  assert.equal(allowed.status, 200, 'test modunda test kimligi gecerli olmali');
  await allowed.text();

  // Uretim gibi davran: ayni baslik artik kimlik saglamamali.
  process.env.NODE_ENV = 'production';
  t.after(() => {
    process.env.NODE_ENV = 'test';
  });

  const blocked = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'test-user-001' },
    body: JSON.stringify(VALID_BODY),
  });
  assert.equal(blocked.status, 401, 'uretimde x-test-user-id kimlik atlatmasi saglamamali');
});
