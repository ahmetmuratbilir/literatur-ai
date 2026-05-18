import assert from 'node:assert/strict';
import { normalizeData } from '../utils/normalization.js';

const normalized = await normalizeData([
  {
    'dc:title': 'Scopus prism cover date test',
    'dc:creator': 'Ada Lovelace',
    'prism:publicationName': 'Scopus Journal',
    'prism:coverDate': '1982-05-12',
    updated: '2004-08-01',
    'dc:description': 'Prism cover date should win over updated.'
  },
  {
    'dc:title': 'Scopus cover date test',
    'dc:creator': 'Grace Hopper',
    'prism:publicationName': 'Scopus Journal',
    coverDate: '1999-04-03',
    'dc:description': 'Generic coverDate should be high confidence.'
  },
  {
    'dc:title': 'Scopus pub year test',
    'dc:creator': 'Katherine Johnson',
    'prism:publicationName': 'Scopus Journal',
    pubYear: 2020,
    'dc:description': 'pubYear should be medium confidence.'
  },
  {
    'dc:title': 'Scopus metadata only test',
    'dc:creator': 'Dorothy Vaughan',
    'prism:publicationName': 'Scopus Journal',
    updated: '2004-08-01',
    'dc:description': 'Updated alone should stay metadata.'
  },
  {
    'dc:title': 'Scopus no date test',
    'dc:creator': 'Mary Jackson',
    'prism:publicationName': 'Scopus Journal',
    'dc:description': 'No date should stay null.'
  }
], 'clinical validation');

assert.equal(normalized.length, 5);

assert.equal(normalized[0].publicationYear, 1982);
assert.equal(normalized[0].publicationDate, '1982-05-12');
assert.equal(normalized[0].metadataYear, 2004);
assert.equal(normalized[0].metadataDate, '2004-08-01');
assert.equal(normalized[0].year, 1982);
assert.equal(normalized[0].dateSource, 'Scopus prism:coverDate');
assert.equal(normalized[0].yearConfidence, 'high');

assert.equal(normalized[1].publicationYear, 1999);
assert.equal(normalized[1].publicationDate, '1999-04-03');
assert.equal(normalized[1].metadataYear, null);
assert.equal(normalized[1].year, 1999);
assert.equal(normalized[1].dateSource, 'Scopus coverDate');
assert.equal(normalized[1].yearConfidence, 'high');

assert.equal(normalized[2].publicationYear, 2020);
assert.equal(normalized[2].publicationDate, null);
assert.equal(normalized[2].metadataYear, null);
assert.equal(normalized[2].year, 2020);
assert.equal(normalized[2].dateSource, 'Scopus pubYear');
assert.equal(normalized[2].yearConfidence, 'medium');

assert.equal(normalized[3].publicationYear, null);
assert.equal(normalized[3].publicationDate, null);
assert.equal(normalized[3].metadataYear, 2004);
assert.equal(normalized[3].metadataDate, '2004-08-01');
assert.equal(normalized[3].year, null);
assert.equal(normalized[3].dateSource, 'Scopus updated');
assert.equal(normalized[3].yearConfidence, 'low');

assert.equal(normalized[4].publicationYear, null);
assert.equal(normalized[4].publicationDate, null);
assert.equal(normalized[4].metadataYear, null);
assert.equal(normalized[4].metadataDate, null);
assert.equal(normalized[4].year, null);
assert.equal(normalized[4].dateSource, null);
assert.equal(normalized[4].yearConfidence, 'low');

console.log('\nScopus date adapter integration tests passed.');
