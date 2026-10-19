import test from 'node:test';
import assert from 'node:assert/strict';
import { answeredSources, classifyError, failedNames, sourceLabel } from '../src/components/states/errorClass.js';

const http = (status, data = {}, headers = {}) => ({ response: { status, data, headers } });

test('iptal, zaman aşımı, ağ ve bağlantı yok ayrı', () => {
  assert.equal(classifyError({ code: 'ERR_CANCELED' }).kind, 'cancelled');
  assert.equal(classifyError({ name: 'CanceledError' }).kind, 'cancelled');
  assert.equal(classifyError({ code: 'ECONNABORTED', message: 'timeout of 60000ms exceeded' }).kind, 'timeout');
  assert.equal(classifyError({ message: 'Network Error' }, { online: true }).kind, 'network');
  assert.equal(classifyError({ message: 'Network Error' }, { online: false }).kind, 'offline');
});

test('HTTP durumları: 401, 429 (Retry-After), 502/503, 504, 5xx, 4xx', () => {
  assert.equal(classifyError(http(401)).kind, 'auth');
  assert.deepEqual(classifyError(http(429, {}, { 'retry-after': '12' })), { kind: 'rate', status: 429, retryAfter: 12 });
  assert.equal(classifyError(http(429)).retryAfter, 30);
  assert.equal(classifyError(http(429, {}, { 'retry-after': '9999' })).retryAfter, 300);
  assert.equal(classifyError(http(503)).kind, 'unavailable');
  assert.equal(classifyError(http(502)).kind, 'unavailable');
  assert.equal(classifyError(http(504)).kind, 'timeout');
  assert.deepEqual(classifyError(http(500, { error: 'x' })), { kind: 'server', status: 500, message: 'x' });
  assert.equal(classifyError(http(400, { error: 'Konu gerekli' })).message, 'Konu gerekli');
});

test('bütün kaynaklar düştü: 503 olsa da ayrı sınıf, düşen kaynaklarla', () => {
  const r = classifyError(http(503, { code: 'SOURCES_UNAVAILABLE', failedSources: [{ name: 'OpenAlex' }, { name: 'SemanticScholar' }] }));
  assert.equal(r.kind, 'sources');
  assert.deepEqual(failedNames(r.failedSources), ['OpenAlex', 'Semantic Scholar']);
});

test('kaynak adları okunur; tekrar eden ad bir kez', () => {
  assert.equal(sourceLabel('EuropePMC'), 'Europe PMC');
  assert.equal(sourceLabel('ArXiv'), 'arXiv');
  assert.equal(sourceLabel('Bilinmeyen'), 'Bilinmeyen');
  assert.deepEqual(failedNames([{ name: 'OpenAlex' }, { name: 'OpenAlex' }, null]), ['OpenAlex']);
});

test('yanıt veren kaynaklar: düşen ve atlanan kaynak "taranan" sayılmaz (2.8)', () => {
  const queried = ['OpenAlex', 'CORE', 'SemanticScholar', 'DOAJ'];
  const failed = [{ name: 'CORE', type: 'TIMEOUT' }, { name: 'SemanticScholar', type: 'QUOTA' }];
  assert.deepEqual(answeredSources(queried, failed), ['OpenAlex', 'DOAJ']);
  assert.deepEqual(answeredSources(queried, []), ['OpenAlex', 'CORE', 'Semantic Scholar', 'DOAJ']);
  // Türkçe OpenAlex araması ayrı ad taşır; ana OpenAlex yanıt vermiş sayılır
  assert.deepEqual(answeredSources(['OpenAlex'], [{ name: 'OpenAlex TR' }]), ['OpenAlex']);
  assert.deepEqual(answeredSources(undefined, undefined), []);
});
