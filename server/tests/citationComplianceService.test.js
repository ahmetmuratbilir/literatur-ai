import test from 'node:test';
import assert from 'node:assert/strict';
import { runCitationCompliance } from '../services/citationComplianceService.js';

test('citation compliance detects orphan citations and invalid DOI', () => {
  const text = `
## Literature Review
This section cites major findings [1] and complementary work [2].

## Kullanılan Kaynaklar
[1] Smith, J. (2024). Example article. https://doi.org/10.1000/xyz123
[3] Doe, R. (2023). Another article. https://dx.doi.org/10.1000/baddoi
`;

  const report = runCitationCompliance(text);

  assert.equal(report.source, 'citationCompliance');
  assert.equal(report.status, 'warn');
  assert.equal(report.metrics.referenceStyleDetected, 'ieee');
  assert.equal(report.metrics.invalidDoiCount, 1);
  assert.ok(report.metrics.orphanInTextCount >= 1);
});

