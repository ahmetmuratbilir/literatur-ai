import test from 'node:test';
import assert from 'node:assert/strict';

import { isThrottled } from '../services/arxiv.js';
import { classifySourceError } from '../services/search.js';

test('arXiv kota asimini 406 uzerinden tanir', () => {
  // arXiv kota asiminda 429 degil 406 (Not Acceptable) donuyor.
  assert.equal(isThrottled({ response: { status: 406 } }), true);
  assert.equal(isThrottled({ response: { status: 429 } }), true);
  assert.equal(isThrottled({ response: { status: 503 } }), true);
});

test('kota disi hatalar yeniden denenmez', () => {
  assert.equal(isThrottled({ response: { status: 400 } }), false);
  assert.equal(isThrottled({ response: { status: 404 } }), false);
  assert.equal(isThrottled({ response: { status: 500 } }), false);
  assert.equal(isThrottled({ code: 'ECONNRESET' }), false);
  assert.equal(isThrottled(undefined), false);
});

test('kaynak hatalari dogru kategoriye dusuyor', () => {
  assert.equal(
    classifySourceError(new Error('Scopus API Error: 401')),
    'CREDENTIAL_ACCESS'
  );
  assert.equal(
    classifySourceError(new Error('The provided apiKey is invalid')),
    'CREDENTIAL_ACCESS'
  );
  assert.equal(
    classifySourceError(new Error('ArXiv kota asimi (HTTP 406)')),
    'QUOTA',
    '406 daha once genel ERROR olarak raporlaniyordu'
  );
  assert.equal(classifySourceError(new Error('Request failed with 429')), 'QUOTA');

  const aborted = new Error('aborted');
  aborted.name = 'AbortError';
  assert.equal(classifySourceError(aborted), 'TIMEOUT');

  assert.equal(classifySourceError(new Error('socket hang up')), 'ERROR');
});

test('siniflandirici tanimsiz girdide cokmez', () => {
  assert.equal(classifySourceError(undefined), 'ERROR');
  assert.equal(classifySourceError(null), 'ERROR');
  assert.equal(classifySourceError({}), 'ERROR');
});
