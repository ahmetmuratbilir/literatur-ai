import assert from 'node:assert/strict';
import { calculateAHP } from '../services/ahp.js';
import {
  normalizeSearchResult,
  deduplicateResults
} from '../services/searchRankingService.js';
import { buildSearchCacheFingerprint } from '../utils/searchCacheStore.js';
import { getYearDisplay } from '../../client/src/utils/yearDisplay.js';

const ahpResults = await calculateAHP([
  {
    title: 'Metadata year must not boost recency',
    publicationYear: null,
    publicationDate: null,
    metadataYear: 2024,
    metadataDate: '2024-08-01',
    dateSource: 'Crossref indexed',
    yearConfidence: 'low',
    year: 2024,
    citedbyCount: 100,
    pubType: 'fla',
    sourceType: 'Journal',
    doi: '10.1000/metadata-only',
    source: 'Crossref',
    openAccess: false,
    keyCount: 15,
    expandedSimilarity: 0.9
  },
  {
    title: 'Trusted publication year is used',
    publicationYear: 1982,
    publicationDate: '1982-05-12',
    metadataYear: 2004,
    metadataDate: '2004-08-01',
    dateSource: 'OpenAlex publication_year',
    yearConfidence: 'high',
    year: 1982,
    citedbyCount: 100,
    pubType: 'fla',
    sourceType: 'Journal',
    doi: '10.1000/trusted-year',
    source: 'OpenAlex',
    openAccess: false,
    keyCount: 15,
    expandedSimilarity: 0.9
  }
]);

const metadataOnly = ahpResults.find(item => item.title === 'Metadata year must not boost recency');
const trustedYear = ahpResults.find(item => item.title === 'Trusted publication year is used');

assert.equal(metadataOnly.scores.recency, 0.5);
assert.equal(metadataOnly.scores.citation, 0.5);
assert.equal(trustedYear.scores.recency, 0);
assert.ok(trustedYear.scores.citation < metadataOnly.scores.citation);

const deduped = deduplicateResults([
  normalizeSearchResult({
    title: 'Clinical Validation Study',
    doi: '10.2000/clinical-validation',
    source: 'Crossref',
    publicationYear: null,
    publicationDate: null,
    metadataYear: 2004,
    metadataDate: '2004-08-01',
    dateSource: 'Crossref indexed',
    yearConfidence: 'low',
    year: null
  }),
  normalizeSearchResult({
    title: 'Clinical Validation Study',
    doi: '10.2000/clinical-validation',
    source: 'OpenAlex',
    publicationYear: 1982,
    publicationDate: '1982-05-12',
    metadataYear: null,
    metadataDate: null,
    dateSource: 'OpenAlex publication_year',
    yearConfidence: 'high',
    year: 1982
  })
]);

assert.equal(deduped.length, 1);
assert.equal(deduped[0].publicationYear, 1982);
assert.equal(deduped[0].publicationDate, '1982-05-12');
assert.equal(deduped[0].metadataYear, 2004);
assert.equal(deduped[0].metadataDate, '2004-08-01');
assert.equal(deduped[0].year, 1982);
assert.deepEqual(deduped[0].sourceList.sort(), ['Crossref', 'OpenAlex']);

const fingerprint = buildSearchCacheFingerprint({
  mainTopic: 'clinical validation',
  aiQuery: '',
  authorName: '',
  language: 'tr',
  keywords: ['AI'],
  count: 25
});

assert.ok(fingerprint.cacheKey.startsWith('search:v4:'));
assert.equal(fingerprint.normalizedParams.cacheVersion, 'v4');

const publicationDisplay = getYearDisplay({
  publicationYear: 1982,
  metadataYear: 2004,
  yearConfidence: 'high'
});
assert.equal(publicationDisplay.label, '1982');
assert.equal(publicationDisplay.showWarning, false);

const metadataDisplay = getYearDisplay({
  publicationYear: null,
  metadataYear: 2004,
  yearConfidence: 'low'
});
assert.equal(metadataDisplay.label, 'Metadata yılı: 2004');
assert.equal(metadataDisplay.showWarning, true);
assert.match(metadataDisplay.title, /yayın yılı değil/i);

console.log('Date normalization phase 3 safety tests passed.');
