import test from 'node:test';
import assert from 'node:assert/strict';

import { mapEuropePmcResult } from '../services/europepmc.js';
import { normalizeSearchResult } from '../services/searchRankingService.js';
import {
  getUnpaywallEmail, parseUnpaywall, findOpenAccessCopy, resetUnpaywallState,
} from '../services/unpaywall.js';

// Europe PMC'nin 30 Eyl 2026'daki gercek yanitindan kisaltildi.
const EPMC = {
  id: '42590312', source: 'MED', pmid: '42590312', pmcid: 'PMC13466454', doi: '10.3390/ma19153233',
  title: 'A Modified Temperature-Dependent Elastoplastic Constitutive Model for Blister Growth in Irradiated Al6061 Cladding.',
  pubYear: '2026', firstPublicationDate: '2026-07-30',
  journalInfo: { journal: { title: 'Materials (Basel, Switzerland)' } },
  citedByCount: 4, isOpenAccess: 'Y',
  pubTypeList: { pubType: ['research-article', 'Journal Article'] },
  authorString: 'Luo Q, Wang W, Chen Y, Tang F.',
  abstractText: 'Plate-type fuel elements <i>generate</i> large amounts of fission gases.',
};

test('Europe PMC kaydi ortak bicime eslenir (yil, DOI, PMID, OA, atif)', () => {
  const r = mapEuropePmcResult(EPMC);
  assert.equal(r.title.endsWith('.'), false, 'sondaki nokta silinmeli');
  assert.equal(r.publicationYear, 2026);
  assert.equal(r.yearConfidence, 'high');
  assert.equal(r.doi, '10.3390/ma19153233');
  assert.equal(r.pmid, '42590312');
  assert.equal(r.citedBy, 4);
  assert.equal(r.openAccess, true);
  assert.equal(r.url, 'https://europepmc.org/article/PMC/PMC13466454');
  assert.ok(!r.description.includes('<i>'), 'HTML etiketleri temizlenmeli');
});

test('Europe PMC "Journal Article" turu kalite kriterinde TANINIR (eskiden null -> 0 puan)', () => {
  const n = normalizeSearchResult(mapEuropePmcResult(EPMC));
  assert.equal(n.pubType, 'fla');
});

test('Europe PMC preprint (PPR) hakemli makale sayilmaz', () => {
  const n = normalizeSearchResult(mapEuropePmcResult({ ...EPMC, source: 'PPR', journalInfo: undefined, bookOrReportDetails: { publisher: 'bioRxiv' } }));
  assert.equal(n.pubType, 'pre');
  assert.equal(n.sourceType, 'Preprint');
});

test('Unpaywall: sablon e-posta reddedilir (Unpaywall 422 veriyor)', () => {
  assert.equal(getUnpaywallEmail({ UNPAYWALL_EMAIL: 'research-contact@example.com' }), null);
  assert.equal(getUnpaywallEmail({}), null);
  assert.equal(getUnpaywallEmail({ CONTACT_EMAIL: 'arastirma@universite.edu.tr' }), 'arastirma@universite.edu.tr');
});

test('Unpaywall: yapilandirilmamissa istek ATILMAZ', async () => {
  resetUnpaywallState();
  let called = false;
  const r = await findOpenAccessCopy('10.1038/nature12373', { env: {}, fetchImpl: async () => { called = true; } });
  assert.equal(r.status, 'not_configured');
  assert.equal(called, false);
});

test('Unpaywall: yanit sadelestirilir, surum Turkce etiketlenir, sonuc onbellege alinir', async () => {
  resetUnpaywallState();
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({
      is_oa: true, oa_status: 'bronze',
      best_oa_location: { url_for_pdf: 'https://www.nature.com/articles/nature12373.pdf', version: 'publishedVersion', host_type: 'publisher', license: null },
    }) };
  };
  const env = { UNPAYWALL_EMAIL: 'arastirma@universite.edu.tr' };
  const a = await findOpenAccessCopy('https://doi.org/10.1038/NATURE12373', { env, fetchImpl });
  const b = await findOpenAccessCopy('10.1038/nature12373', { env, fetchImpl });
  assert.equal(a.status, 'ok');
  assert.equal(a.result.pdfUrl, 'https://www.nature.com/articles/nature12373.pdf');
  assert.equal(a.result.versionLabel, 'yayıncı sürümü');
  assert.equal(calls, 1, 'ayni DOI ikinci kez sorulmamali');
  assert.deepEqual(b, a);
});

test('Unpaywall: bulunamayan DOI olumsuz sonuc olarak onbellege alinir', async () => {
  resetUnpaywallState();
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: false, status: 404, json: async () => ({}) }; };
  const env = { UNPAYWALL_EMAIL: 'arastirma@universite.edu.tr' };
  assert.equal((await findOpenAccessCopy('10.1/yok', { env, fetchImpl })).status, 'not_found');
  await findOpenAccessCopy('10.1/yok', { env, fetchImpl });
  assert.equal(calls, 1);
});

test('Unpaywall: gecersiz DOI', async () => {
  assert.equal((await findOpenAccessCopy('abc', { env: { UNPAYWALL_EMAIL: 'a@b.edu' } })).status, 'error');
});

test('parseUnpaywall: kapali erisim', () => {
  const r = parseUnpaywall({ is_oa: false, best_oa_location: null });
  assert.equal(r.isOa, false);
  assert.equal(r.pdfUrl, null);
});
