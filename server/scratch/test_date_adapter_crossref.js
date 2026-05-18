import assert from 'node:assert/strict';
import axios from 'axios';

axios.get = async (url, config = {}) => {
  assert.equal(url, 'https://api.crossref.org/works');
  assert.match(config.params.select, /published-print/);
  assert.match(config.params.select, /published-online/);
  assert.match(config.params.select, /issued/);
  assert.match(config.params.select, /created/);
  assert.match(config.params.select, /deposited/);
  assert.match(config.params.select, /indexed/);

  return {
    data: {
      message: {
        'total-results': 4,
        items: [
          {
            DOI: '10.0000/crossref.1',
            title: ['Crossref print date test'],
            author: [{ given: 'Ada', family: 'Lovelace' }],
            'container-title': ['Crossref Journal'],
            'published-print': { 'date-parts': [[1982, 5, 12]] },
            indexed: { 'date-parts': [[2004, 8, 1]] },
            'is-referenced-by-count': 8,
            abstract: 'Published print should win over indexed.'
          },
          {
            DOI: '10.0000/crossref.2',
            title: ['Crossref issued date test'],
            author: [{ given: 'Grace', family: 'Hopper' }],
            'container-title': ['Crossref Journal'],
            'published-online': { 'date-parts': [[2004, 8, 1]] },
            issued: { 'date-parts': [[1982]] },
            'is-referenced-by-count': 5,
            abstract: 'Issued should be selected before published-online by configured Crossref priority.'
          },
          {
            DOI: '10.0000/crossref.3',
            title: ['Crossref metadata only test'],
            author: [{ given: 'Alan', family: 'Turing' }],
            'container-title': ['Crossref Journal'],
            indexed: { 'date-parts': [[2004, 8, 1]] },
            'is-referenced-by-count': 0,
            abstract: 'Indexed alone is metadata.'
          },
          {
            DOI: '10.0000/crossref.4',
            title: ['Crossref no date test'],
            author: [{ given: 'Katherine', family: 'Johnson' }],
            'container-title': ['Crossref Journal'],
            'is-referenced-by-count': 0,
            abstract: 'No date should stay null.'
          }
        ]
      }
    }
  };
};

const { searchCrossref } = await import('../services/crossref.js');

const crossref = await searchCrossref('clinical validation', 4);
assert.equal(crossref.results.length, 4);

assert.equal(crossref.results[0].publicationYear, 1982);
assert.equal(crossref.results[0].publicationDate, '1982-05-12');
assert.equal(crossref.results[0].metadataYear, 2004);
assert.equal(crossref.results[0].metadataDate, '2004-08-01');
assert.equal(crossref.results[0].year, 1982);
assert.equal(crossref.results[0].dateSource, 'Crossref published-print');
assert.equal(crossref.results[0].yearConfidence, 'high');

assert.equal(crossref.results[1].publicationYear, 1982);
assert.equal(crossref.results[1].publicationDate, null);
assert.equal(crossref.results[1].metadataYear, null);
assert.equal(crossref.results[1].year, 1982);
assert.equal(crossref.results[1].dateSource, 'Crossref issued');
assert.equal(crossref.results[1].yearConfidence, 'medium');

assert.equal(crossref.results[2].publicationYear, null);
assert.equal(crossref.results[2].publicationDate, null);
assert.equal(crossref.results[2].metadataYear, 2004);
assert.equal(crossref.results[2].metadataDate, '2004-08-01');
assert.equal(crossref.results[2].year, null);
assert.equal(crossref.results[2].dateSource, 'Crossref indexed');
assert.equal(crossref.results[2].yearConfidence, 'low');

assert.equal(crossref.results[3].publicationYear, null);
assert.equal(crossref.results[3].publicationDate, null);
assert.equal(crossref.results[3].metadataYear, null);
assert.equal(crossref.results[3].metadataDate, null);
assert.equal(crossref.results[3].year, null);
assert.equal(crossref.results[3].dateSource, null);
assert.equal(crossref.results[3].yearConfidence, 'low');

console.log('\nCrossref date adapter integration tests passed.');
