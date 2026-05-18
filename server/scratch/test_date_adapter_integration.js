import assert from 'node:assert/strict';
import axios from 'axios';
import { MockAgent, setGlobalDispatcher } from 'undici';

const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
setGlobalDispatcher(mockAgent);

mockAgent.get('https://api.openalex.org')
  .intercept({
    path: /\/works.*/,
    method: 'GET'
  })
  .reply(200, {
    meta: { count: 2 },
    results: [
      {
        id: 'https://openalex.org/W1',
        title: 'Clinical validation in AI',
        publication_year: 1982,
        updated_date: '2004-08-01',
        authorships: [{ author: { display_name: 'Ada Lovelace' } }],
        primary_location: { source: { display_name: 'Open Journal' } },
        abstract_inverted_index: { Clinical: [0], validation: [1] },
        cited_by_count: 7
      },
      {
        id: 'https://openalex.org/W2',
        title: 'Record without publication year',
        updated_date: '2004-08-01',
        authorships: [],
        primary_location: { source: { display_name: 'Metadata Journal' } },
        cited_by_count: 0
      }
    ]
  }, {
    headers: { 'content-type': 'application/json' }
  });

const arxivXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
  <opensearch:totalResults>2</opensearch:totalResults>
  <entry>
    <id>http://arxiv.org/abs/2101.00001v1</id>
    <updated>2024-05-09T10:00:00Z</updated>
    <published>2021-02-03T10:00:00Z</published>
    <title>arXiv published date test</title>
    <summary>Published should win over updated.</summary>
    <author><name>Grace Hopper</name></author>
    <link href="http://arxiv.org/abs/2101.00001v1" rel="alternate" type="text/html" />
  </entry>
  <entry>
    <id>http://arxiv.org/abs/unknownv1</id>
    <updated>2004-08-01T10:00:00Z</updated>
    <title>arXiv metadata only test</title>
    <summary>Updated alone is metadata.</summary>
    <author><name>Alan Turing</name></author>
    <link href="http://arxiv.org/abs/unknownv1" rel="alternate" type="text/html" />
  </entry>
</feed>`;

axios.get = async (url) => {
  assert.equal(url, 'https://export.arxiv.org/api/query');
  return { data: arxivXml };
};

const { searchOpenAlex } = await import('../services/openalex.js');
const { searchArXiv } = await import('../services/arxiv.js');

const openAlex = await searchOpenAlex('clinical validation', { count: 2 }, null);
assert.equal(openAlex.results.length, 2);
assert.equal(openAlex.results[0].publicationYear, 1982);
assert.equal(openAlex.results[0].metadataYear, 2004);
assert.equal(openAlex.results[0].year, 1982);
assert.equal(openAlex.results[0].dateSource, 'OpenAlex publication_year');
assert.equal(openAlex.results[0].yearConfidence, 'high');
assert.equal(openAlex.results[1].publicationYear, null);
assert.equal(openAlex.results[1].metadataYear, 2004);
assert.equal(openAlex.results[1].year, null);
assert.equal(openAlex.results[1].yearConfidence, 'low');

const arxiv = await searchArXiv('clinical validation', 2);
assert.equal(arxiv.results.length, 2);
assert.equal(arxiv.results[0].publicationYear, 2021);
assert.equal(arxiv.results[0].publicationDate, '2021-02-03');
assert.equal(arxiv.results[0].metadataYear, 2024);
assert.equal(arxiv.results[0].year, 2021);
assert.equal(arxiv.results[0].dateSource, 'arXiv published');
assert.equal(arxiv.results[0].yearConfidence, 'high');
assert.equal(arxiv.results[1].publicationYear, null);
assert.equal(arxiv.results[1].metadataYear, 2004);
assert.equal(arxiv.results[1].year, null);
assert.equal(arxiv.results[1].yearConfidence, 'low');

await mockAgent.close();

console.log('\nOpenAlex + arXiv date adapter integration tests passed.');
