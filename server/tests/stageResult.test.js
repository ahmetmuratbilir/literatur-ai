import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSeverity, aggregateStatus, createStageResult } from '../services/stageResult.js';

test('aggregateStatus uses failed > warn > ok precedence', () => {
  const stages = [
    createStageResult({ source: 'a', status: 'ok' }),
    createStageResult({ source: 'b', status: 'warn' }),
    createStageResult({ source: 'c', status: 'failed' }),
  ];
  assert.equal(aggregateStatus(stages), 'failed');
});

test('aggregateSeverity uses high > medium > low precedence', () => {
  const stages = [
    createStageResult({ source: 'a', severity: 'low' }),
    createStageResult({ source: 'b', severity: 'medium' }),
    createStageResult({ source: 'c', severity: 'high' }),
  ];
  assert.equal(aggregateSeverity(stages), 'high');
});

