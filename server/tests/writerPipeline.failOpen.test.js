import test from 'node:test';
import assert from 'node:assert/strict';
import { createStageResult } from '../services/stageResult.js';
import { runWriterPipeline } from '../services/writerPipeline.js';

function createMockResponse() {
  const chunks = [];
  const headers = {};

  return {
    headers,
    chunks,
    writableEnded: false,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    write(chunk) {
      chunks.push(String(chunk));
      return true;
    },
    end(chunk) {
      if (typeof chunk !== 'undefined') chunks.push(String(chunk));
      this.writableEnded = true;
      return true;
    },
  };
}

function parseSseEvents(chunks) {
  const raw = chunks.join('');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)));
}

function createCollectingLogger(logs) {
  return {
    info(payload) {
      logs.push({ level: 'info', ...payload });
    },
    warn(payload) {
      logs.push({ level: 'warn', ...payload });
    },
    error(payload) {
      logs.push({ level: 'error', ...payload });
    },
  };
}

test('writer pipeline fail-open keeps delivering content when citation stage throws', async () => {
  const req = { closed: false };
  const res = createMockResponse();
  const logs = [];

  await runWriterPipeline({
    requestId: 'req-fail-open-1',
    safePapers: [{ ref: 1, title: 'Test', abstract: 'Some abstract.' }],
    prompt: 'Akademik bir paragraf üret.',
    outputType: 'literature-review',
    tone: 'akademik',
    length: 'kisa',
    language: 'tr',
    req,
    res,
    overrides: {
      logger: createCollectingLogger(logs),
      flags: {
        postcheckEnabled: true,
        citationCheckEnabled: true,
        qualityCheckEnabled: true,
        revisionCoachEnabled: false,
        gateMode: 'warn_only',
      },
      streamAcademicTextWithBridge: async ({ onToken }) => {
        onToken('Paragraf token 1 ');
        onToken('Paragraf token 2.');
        return {
          text: 'Paragraf token 1 Paragraf token 2.',
          doneSeen: true,
          doneEventCount: 1,
          provider: 'test-provider',
          ended: true,
        };
      },
      runCitationCompliance: () => {
        throw new Error('forced citation exception');
      },
      runWritingQualityCheck: () => createStageResult({
        source: 'writingQuality',
        status: 'ok',
        severity: 'low',
      }),
      runOutputGate: ({ citationReport, qualityReport, gateMode }) => createStageResult({
        source: 'outputGate',
        status: 'warn',
        severity: 'medium',
        metrics: {
          gateMode,
          upstreamCitationStatus: citationReport.status,
          upstreamQualityStatus: qualityReport.status,
          shouldBlock: false,
        },
      }),
    },
  });

  assert.equal(res.writableEnded, true);
  const events = parseSseEvents(res.chunks);
  const tokenEvents = events.filter((event) => typeof event.token === 'string');
  const doneEvents = events.filter((event) => event.done === true);

  assert.ok(tokenEvents.length >= 1, 'token event should exist');
  assert.equal(doneEvents.length, 1, 'done event should be emitted once');
  assert.equal(doneEvents[0].postcheck.version, 'v1');
  assert.equal(doneEvents[0].postcheck.status, 'failed');
  assert.equal(doneEvents[0].postcheck.citationReport.status, 'failed');

  const metricsLog = logs.find((entry) => entry.event === 'metrics');
  assert.equal(metricsLog.requestId, 'req-fail-open-1');
  assert.equal(metricsLog.provider, 'test-provider');
  assert.equal(metricsLog.doneEventCount, 1);
  assert.equal(metricsLog.legacyDoneEventCount, 1);
  assert.equal(metricsLog['postcheck.status'], 'failed');
  assert.equal(metricsLog.maxSeverity, 'high');
  assert.equal(metricsLog.warningCount, 1);
  assert.equal(Number.isFinite(metricsLog.totalDurationMs), true);
  assert.equal(Number.isFinite(metricsLog.citationDurationMs), true);
  assert.equal(Number.isFinite(metricsLog.qualityDurationMs), true);
  assert.equal(Number.isFinite(metricsLog.gateDurationMs), true);
});
