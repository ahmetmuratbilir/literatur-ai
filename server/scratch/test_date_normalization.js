import assert from 'node:assert/strict';
import {
  extractYearFromDate,
  normalizePublicationDate,
  chooseBestPublicationDate,
  mergeDateMetadata
} from '../utils/dateNormalization.js';

const tests = [
  {
    name: 'OpenAlex publication_year wins over updated metadata',
    actual: normalizePublicationDate({
      publication_year: 1982,
      updated: '2004-08-01'
    }, 'OpenAlex'),
    expected: {
      publicationYear: 1982,
      metadataYear: 2004,
      dateSource: 'OpenAlex publication_year',
      yearConfidence: 'high'
    }
  },
  {
    name: 'Crossref issued wins over indexed metadata',
    actual: normalizePublicationDate({
      issued: { 'date-parts': [[1982]] },
      indexed: { 'date-parts': [[2004, 8, 1]] }
    }, 'Crossref'),
    expected: {
      publicationYear: 1982,
      metadataYear: 2004,
      metadataDate: '2004-08-01',
      dateSource: 'Crossref issued',
      yearConfidence: 'medium'
    }
  },
  {
    name: 'Only updated date stays metadata with low confidence',
    actual: normalizePublicationDate({
      updated: '2004-08-01'
    }, 'arXiv'),
    expected: {
      publicationYear: null,
      metadataYear: 2004,
      metadataDate: '2004-08-01',
      dateSource: 'arXiv updated',
      yearConfidence: 'low'
    }
  },
  {
    name: 'arXiv published wins over updated metadata',
    actual: normalizePublicationDate({
      published: '2021-02-03T10:00:00Z',
      updated: '2024-05-09T10:00:00Z'
    }, 'arXiv'),
    expected: {
      publicationYear: 2021,
      publicationDate: '2021-02-03',
      metadataYear: 2024,
      metadataDate: '2024-05-09',
      dateSource: 'arXiv published',
      yearConfidence: 'high'
    }
  },
  {
    name: 'Crossref published-print wins over published-online',
    actual: normalizePublicationDate({
      'published-print': { 'date-parts': [[1982, 5, 12]] },
      'published-online': { 'date-parts': [[2004, 8, 1]] }
    }, 'Crossref'),
    expected: {
      publicationYear: 1982,
      publicationDate: '1982-05-12',
      metadataYear: null,
      dateSource: 'Crossref published-print',
      yearConfidence: 'high'
    }
  }
];

function assertPartial(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `${key} should be ${value}, got ${actual[key]}`);
  }
}

for (const test of tests) {
  assertPartial(test.actual, test.expected);
  console.log(`[PASS] ${test.name}`);
}

assert.equal(extractYearFromDate('not a date'), null);
assert.equal(extractYearFromDate({ 'date-parts': [[1982, 5, 12]] }), 1982);

const chosen = chooseBestPublicationDate([
  {
    kind: 'metadata',
    year: 2004,
    date: '2004-08-01',
    source: 'Crossref indexed',
    priority: 100,
    yearConfidence: 'low'
  },
  {
    kind: 'publication',
    year: 1982,
    date: null,
    source: 'OpenAlex publication_year',
    priority: 20,
    yearConfidence: 'high'
  }
]);
assert.equal(chosen.publicationYear, 1982);
assert.equal(chosen.metadataYear, 2004);

const merged = mergeDateMetadata(
  normalizePublicationDate({ indexed: '2004-08-01' }, 'Crossref'),
  normalizePublicationDate({ publication_year: 1982 }, 'OpenAlex')
);
assert.equal(merged.publicationYear, 1982);
assert.equal(merged.metadataYear, 2004);

const unknown = normalizePublicationDate({}, 'Unknown');
assert.deepEqual(unknown, {
  publicationYear: null,
  publicationDate: null,
  metadataYear: null,
  metadataDate: null,
  dateSource: null,
  yearConfidence: 'low'
});

console.log('\nAll date normalization tests passed.');
