import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPostcheck } from '../services/postcheckBuilder.js';
import { createStageResult } from '../services/stageResult.js';

test('buildPostcheck aggregates status and includes version', () => {
  const citationReport = createStageResult({
    source: 'citationCompliance',
    status: 'warn',
    severity: 'medium',
  });
  const qualityReport = createStageResult({
    source: 'writingQuality',
    status: 'ok',
    severity: 'low',
  });
  const gateReport = createStageResult({
    source: 'outputGate',
    status: 'failed',
    severity: 'high',
  });

  const postcheck = buildPostcheck({
    gateMode: 'warn_only',
    citationReport,
    qualityReport,
    gateReport,
    durationMs: 42,
  });

  assert.equal(postcheck.status, 'failed');
  assert.equal(postcheck.severity, 'high');
  assert.equal(postcheck.version, 'v1');
  assert.equal(postcheck.gateMode, 'warn_only');
});

