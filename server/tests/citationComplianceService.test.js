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


const SELECTED_PAPERS = [
  { ref: 1, authors: 'Yilmaz, A.', year: 2021, doi: '10.1000/secilen-bir' },
  { ref: 2, authors: 'Kaya, B.', year: 2022, doi: '10.1000/secilen-iki' },
];

test('IEEE: secilen makale sayisini asan atif numarasi yakalanir', () => {
  const text = [
    'Pasif sogutma incelenmistir [1]. Ek bulgular da vardir [7].',
    '',
    '## Kaynakca',
    '[1] Yilmaz, A., "Bir," Dergi, 2021.',
    '[7] Bilinmeyen, X., "Yok," Dergi, 2020.',
  ].join('\n');

  const report = runCitationCompliance(text, { papers: SELECTED_PAPERS });
  const codes = report.findings.map((f) => f.code);

  assert.ok(codes.includes('CITATION_OUTSIDE_SELECTION'), 'kapsam disi atif bildirilmeli');
  assert.equal(report.severity, 'high');
  assert.equal(report.metrics.outOfRangeCitationCount, 1);
  assert.equal(report.metrics.selectedPaperCount, 2);
});

test('APA: secilen makalelerde olmayan yazar adi yakalanir', () => {
  const text = [
    'Bulgular tutarlidir (Yilmaz, 2021). Baska bir calisma farklidir (Ucarlan, 2019).',
    '',
    '## Kaynakca',
    'Yilmaz, A. (2021). Bir. Dergi.',
    'Ucarlan, Z. (2019). Uydurma. Dergi.',
  ].join('\n');

  const report = runCitationCompliance(text, { papers: SELECTED_PAPERS });
  const codes = report.findings.map((f) => f.code);

  assert.ok(codes.includes('CITATION_AUTHOR_NOT_IN_SELECTION'));
  assert.equal(report.metrics.unknownAuthorCount, 1);
});

test('kaynakcada secilmemis DOI yakalanir', () => {
  const text = [
    'Bir calisma (Yilmaz, 2021).',
    '',
    '## Kaynakca',
    'Yilmaz, A. (2021). Bir. Dergi. 10.1000/secilen-bir',
    'Yilmaz, A. (2021). Iki. Dergi. 10.9999/hic-secilmedi',
  ].join('\n');

  const report = runCitationCompliance(text, { papers: SELECTED_PAPERS });
  const codes = report.findings.map((f) => f.code);

  assert.ok(codes.includes('REFERENCE_DOI_NOT_IN_SELECTION'));
  assert.equal(report.metrics.unknownDoiCount, 1);
});

test('dogru atiflar yanlis pozitif uretmez', () => {
  const text = [
    'Pasif sogutma incelenmistir [1]. Ikinci bulgu da vardir [2].',
    '',
    '## Kaynakca',
    '[1] Yilmaz, A., "Bir," Dergi, 2021. 10.1000/secilen-bir',
    '[2] Kaya, B., "Iki," Dergi, 2022. 10.1000/secilen-iki',
  ].join('\n');

  const report = runCitationCompliance(text, { papers: SELECTED_PAPERS });
  const codes = report.findings.map((f) => f.code);

  assert.equal(codes.includes('CITATION_OUTSIDE_SELECTION'), false);
  assert.equal(codes.includes('REFERENCE_DOI_NOT_IN_SELECTION'), false);
});

test('makale listesi verilmezse kaynak dogrulamasi atlanir', () => {
  const text = 'Bir sey [9].\n\n## Kaynakca\n[9] X, "Y," Z, 2020.';

  const report = runCitationCompliance(text);

  assert.equal(report.metrics.sourceVerification, 'skipped_no_papers');
  assert.equal(
    report.findings.some((f) => f.code === 'CITATION_OUTSIDE_SELECTION'),
    false,
    'liste yokken kapsam iddiasinda bulunulmamali'
  );
});

test('yazar bilgisi olmayan makaleler yazar kontrolunu tetiklemez', () => {
  const text = 'Bir calisma (Herhangi, 2020).\n\n## Kaynakca\nHerhangi, K. (2020). X. Dergi.';

  const report = runCitationCompliance(text, {
    papers: [{ ref: 1, authors: 'Bilinmiyor', year: 2020 }],
  });

  assert.equal(report.metrics.authorVerification, 'skipped_no_author_data');
  assert.equal(
    report.findings.some((f) => f.code === 'CITATION_AUTHOR_NOT_IN_SELECTION'),
    false
  );
});
