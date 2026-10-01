import test from 'node:test';
import assert from 'node:assert/strict';

import { mapOpenAireResult } from '../services/openaire.js';
import { mapDataCiteResult, titleQuery } from '../services/datacite.js';
import { normalizePublicationType } from '../utils/dataUtils.js';

test('OpenAIRE kaydi ortak bicime eslenir (DOI, dergi, atif, erisim)', () => {
  const r = mapOpenAireResult({
    id: 'doi_x',
    mainTitle: 'Calculation of <i>OEE</i> weight',
    authors: [{ fullName: 'Dani Yuniawan' }, { name: 'Teruaki', surname: 'Ito' }],
    publicationDate: '2013-10-31',
    pids: [{ scheme: 'doi', value: '10.1177/1063293x13507938' }],
    bestAccessRight: { label: 'OPEN' },
    container: { name: 'Concurrent Engineering', vol: '21', sp: '296', ep: '306' },
    instances: [{ type: 'Article', urls: ['https://doi.org/10.1177/1063293x13507938'] }],
    indicators: { citationImpact: { citationCount: 9 } },
    descriptions: ['<jats:p>Overall equipment effectiveness is…</jats:p>'],
    language: { code: 'eng' },
  });
  assert.equal(r.title, 'Calculation of OEE weight');
  assert.equal(r.creator, 'Dani Yuniawan, Teruaki Ito');
  assert.equal(r.doi, '10.1177/1063293x13507938');
  assert.equal(r.year, 2013);
  assert.equal(r.citedBy, 9);
  assert.equal(r.openAccess, true);
  assert.equal(r.publicationName, 'Concurrent Engineering');
  assert.equal(normalizePublicationType(r.type), 'fla');
  assert.equal(r.description, 'Overall equipment effectiveness is…');
});

test('OpenAIRE tez kaydi tez olarak isaretlenir; DOI yoksa ilk URL', () => {
  const r = mapOpenAireResult({ id: 'y', mainTitle: 'Tez', instances: [{ type: 'Doctoral thesis', urls: ['https://acikerisim.example.edu.tr/1'] }], bestAccessRight: { label: 'CLOSED' } });
  assert.equal(r.sourceType, 'Thesis');
  assert.equal(r.doi, '');
  assert.equal(r.url, 'https://acikerisim.example.edu.tr/1');
  assert.equal(r.openAccess, false);
});

test('DataCite: baslik sorgusu ozel karakterlerden temizlenir', () => {
  assert.equal(titleQuery('"overall equipment" AND (OEE)'), 'titles.title:(overall equipment OEE)');
  assert.equal(titleQuery('a:b c/d'), 'titles.title:(a b c d)');
  assert.equal(titleQuery(''), '');
});

test('DataCite kaydi ortak bicime eslenir; tez ve acik lisans taninir', () => {
  const r = mapDataCiteResult({ attributes: {
    doi: '10.5281/zenodo.1', titles: [{ title: 'OEE in lean' }],
    creators: [{ givenName: 'Ayşe', familyName: 'Yılmaz' }, { name: 'Kurum, Adı' }],
    publicationYear: 2022, types: { resourceType: 'Doctoral thesis', citeproc: 'thesis' },
    publisher: 'Zenodo', rightsList: [{ rightsUri: 'https://creativecommons.org/licenses/by/4.0/' }],
    descriptions: [{ descriptionType: 'Abstract', description: '<p>Ozet</p>' }], url: 'https://zenodo.org/records/1',
  } });
  assert.equal(r.creator, 'Ayşe Yılmaz, Kurum, Adı');
  assert.equal(r.year, 2022);
  assert.equal(r.sourceType, 'Thesis');
  assert.equal(r.openAccess, true);
  assert.equal(r.description, 'Ozet');
  assert.equal(r.publicationName, 'Zenodo');
});
