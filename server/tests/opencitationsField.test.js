import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

import { enrichWithCitations } from '../services/opencitations.js';
import { calculateAHP } from '../services/ahp.js';

test('OpenCitations atif sayisi AHP nin okudugu alana yazilir ve atif puanini etkiler', async () => {
  const original = axios.get;
  axios.get = async () => ({ data: [{ count: '120' }] });
  const silent = console.log;
  console.log = () => {};
  try {
    const paper = { doi: '10.1/doaj-makale', citedBy: 0, title: 'x', keyCount: 10, expandedSimilarity: 0.5,
      publicationYear: new Date().getFullYear() - 4, yearConfidence: 'medium' };
    await enrichWithCitations([paper]);
    assert.equal(paper.citedBy, 120, 'AHP citedBy okuyor');
    assert.equal(paper.openCitationVerified, true);
    const [r] = await calculateAHP([paper]);
    assert.ok(r.scores.citation > 0, 'atif puani artik 0 olmamali');
  } finally {
    axios.get = original;
    console.log = silent;
  }
});
