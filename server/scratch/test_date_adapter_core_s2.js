import assert from 'node:assert/strict';
import axios from 'axios';
import { MockAgent, setGlobalDispatcher } from 'undici';

const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
setGlobalDispatcher(mockAgent);

mockAgent.get('https://api.core.ac.uk')
  .intercept({
    path: /\/v3\/search\/works\/.*/,
    method: 'GET'
  })
  .reply(200, {
    totalHits: 3,
    results: [
      {
        id: 'core-1',
        title: 'CORE published date test',
        publishedDate: '2021-03-04',
        updatedDate: '2024-05-09',
        authors: [{ name: 'Katherine Johnson' }],
        publisher: 'CORE Journal',
        abstract: 'Published date should be used.',
        citationCount: 4
      },
      {
        id: 'core-2',
        title: 'CORE year published test',
        yearPublished: 2020,
        updatedDate: '2024-05-09',
        authors: [{ name: 'Dorothy Vaughan' }],
        publisher: 'CORE Journal',
        abstract: 'Year published should be a medium confidence publication year.',
        citationCount: 2
      },
      {
        id: 'core-3',
        title: 'CORE metadata only test',
        updatedDate: '2004-08-01',
        authors: [{ name: 'Mary Jackson' }],
        publisher: 'CORE Journal',
        abstract: 'Updated alone should stay metadata.',
        citationCount: 0
      }
    ]
  }, {
    headers: { 'content-type': 'application/json' }
  });

axios.get = async (url, config = {}) => {
  assert.equal(url, 'https://api.semanticscholar.org/graph/v1/paper/search');
  assert.match(config.params.fields, /publicationDate/);

  return {
    data: {
      total: 3,
      data: [
        {
          paperId: 's2-1',
          title: 'Semantic Scholar publication date test',
          publicationDate: '2020-06-07',
          year: 2004,
          authors: [{ name: 'Ada Lovelace' }],
          venue: 'S2 Journal',
          externalIds: { DOI: '10.0000/s2.1' },
          url: 'https://example.test/s2-1',
          citationCount: 8,
          abstract: 'Publication date should win over year.'
        },
        {
          paperId: 's2-2',
          title: 'Semantic Scholar year test',
          year: 2020,
          authors: [{ name: 'Grace Hopper' }],
          venue: 'S2 Journal',
          externalIds: {},
          citationCount: 3,
          abstract: 'Year alone should be medium confidence.'
        },
        {
          paperId: 's2-3',
          title: 'Semantic Scholar unknown year test',
          authors: [{ name: 'Alan Turing' }],
          venue: 'S2 Journal',
          externalIds: {},
          citationCount: 0,
          abstract: 'Missing date should stay null.'
        }
      ]
    }
  };
};

const { searchCore } = await import('../services/core.js');
const { searchSemanticScholar } = await import('../services/semanticscholar.js');

const core = await searchCore('clinical validation', { mainTopic: 'clinical validation', count: 3 }, null);
assert.equal(core.results.length, 3);
assert.equal(core.results[0].publicationYear, 2021);
assert.equal(core.results[0].publicationDate, '2021-03-04');
assert.equal(core.results[0].metadataYear, 2024);
assert.equal(core.results[0].year, 2021);
assert.equal(core.results[0].dateSource, 'CORE publishedDate');
assert.equal(core.results[0].yearConfidence, 'high');
assert.equal(core.results[1].publicationYear, 2020);
assert.equal(core.results[1].publicationDate, null);
assert.equal(core.results[1].metadataYear, 2024);
assert.equal(core.results[1].year, 2020);
assert.equal(core.results[1].dateSource, 'CORE yearPublished');
assert.equal(core.results[1].yearConfidence, 'medium');
assert.equal(core.results[2].publicationYear, null);
assert.equal(core.results[2].metadataYear, 2004);
assert.equal(core.results[2].year, null);
assert.equal(core.results[2].yearConfidence, 'low');

const s2 = await searchSemanticScholar('clinical validation', 3);
assert.equal(s2.results.length, 3);
assert.equal(s2.results[0].publicationYear, 2020);
assert.equal(s2.results[0].publicationDate, '2020-06-07');
assert.equal(s2.results[0].metadataYear, null);
assert.equal(s2.results[0].year, 2020);
assert.equal(s2.results[0].dateSource, 'SemanticScholar publicationDate');
assert.equal(s2.results[0].yearConfidence, 'high');
assert.equal(s2.results[1].publicationYear, 2020);
assert.equal(s2.results[1].publicationDate, null);
assert.equal(s2.results[1].year, 2020);
assert.equal(s2.results[1].dateSource, 'SemanticScholar year');
assert.equal(s2.results[1].yearConfidence, 'medium');
assert.equal(s2.results[2].publicationYear, null);
assert.equal(s2.results[2].metadataYear, null);
assert.equal(s2.results[2].year, null);
assert.equal(s2.results[2].yearConfidence, 'low');

await mockAgent.close();

console.log('\nCORE + Semantic Scholar date adapter integration tests passed.');
