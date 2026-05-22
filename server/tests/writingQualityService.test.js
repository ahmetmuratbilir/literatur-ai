import test from 'node:test';
import assert from 'node:assert/strict';
import { runWritingQualityCheck } from '../services/writingQualityService.js';

test('writing quality returns readability metrics', () => {
  const text = `
In the realm of educational policy, this sentence is intentionally made extremely long so that it exceeds ordinary academic sentence boundaries and triggers the long sentence density heuristic in a deterministic way for this test case.
Bu çalışma veri toplar. Bu çalışma analiz eder. Bu çalışma sonuç üretir. Bu çalışma tekrar eder.
`;

  const report = runWritingQualityCheck(text);

  assert.equal(report.source, 'writingQuality');
  assert.ok(typeof report.metrics.readabilityScore === 'number');
  assert.ok(typeof report.metrics.avgSentenceLength === 'number');
  assert.ok(typeof report.metrics.repeatedPhraseRatio === 'number');
  assert.equal(report.status, 'warn');
});

