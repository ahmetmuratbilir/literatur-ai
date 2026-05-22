import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.WRITER_POSTCHECK_ENABLED = 'true';
process.env.WRITER_CITATION_CHECK_ENABLED = 'true';
process.env.WRITER_QUALITY_CHECK_ENABLED = 'true';
process.env.WRITER_GATE_MODE = 'warn_only';
process.env.WRITER_REVISION_COACH_ENABLED = 'false';

const { app } = await import('../index.js');
const { __setGenerationAdapterForTests, __resetGenerationAdapterForTests } = await import('../services/writerGenerationBridge.js');

function parseSseEvents(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)));
}

function startServer() {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

test('writer generate SSE emits token stream, single done, and versioned postcheck with request id header', async (t) => {
  __setGenerationAdapterForTests(async (...args) => {
    const res = args[6];
    res.write(`data: ${JSON.stringify({ meta: { provider: 'groq' } })}\n\n`);
    res.write(`data: ${JSON.stringify({ token: 'Token-1 ' })}\n\n`);
    res.write(`data: ${JSON.stringify({ token: 'Token-2' })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  });
  t.after(() => {
    __resetGenerationAdapterForTests();
  });

  const server = await startServer();
  t.after(async () => {
    await stopServer(server);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${baseUrl}/api/writer/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': 'test-user-001',
    },
    body: JSON.stringify({
      papers: [
        {
          title: 'A test paper',
          authors: ['Doe'],
          year: 2024,
          description: 'A short abstract for testing.',
          doi: '10.1000/test-doi',
          url: 'https://example.org/paper',
        },
      ],
      prompt: 'Bu makale için kısa bir akademik değerlendirme yaz.',
      outputType: 'literature-review',
      tone: 'akademik',
      length: 'kisa',
      language: 'tr',
      bibliographyFormat: 'APA 7',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-request-id') !== null, true);
  assert.match(response.headers.get('content-type') || '', /text\/event-stream/i);

  const body = await response.text();
  const events = parseSseEvents(body);
  const tokenEvents = events.filter((event) => typeof event.token === 'string');
  const doneEvents = events.filter((event) => event.done === true);

  assert.ok(tokenEvents.length >= 1, 'token event should exist');
  assert.equal(doneEvents.length, 1, 'done event should be emitted once');
  assert.equal(doneEvents[0].postcheck.version, 'v1');
  assert.equal(doneEvents[0].postcheck.gateMode, 'warn_only');
});
