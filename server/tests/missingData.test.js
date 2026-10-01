import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateAHP } from '../services/ahp.js';
import { PROFILES } from '../services/ahpProfiles.js';

// EKSIK BILGI ILKESI: verisi olmayan kriter 0 alir, eksik bilgi avantaj saglamaz.
// Canlida olculen sorun: tarihsiz bir makale "Guncel arastirmalar" profilinde
// 2007-2011 makalelerinin ustune, 3. siraya cikiyordu.

const YEAR = new Date().getFullYear();
const base = { keyCount: 10, expandedSimilarity: 0.6, pubType: 'fla', sourceType: 'Journal', doi: '10.1/x' };

async function score(item, weights = null) {
  const [r] = await calculateAHP([item], weights);
  return r.scores;
}

test('yili bilinmeyen makale guncellikte 0 alir', async () => {
  const s = await score({ ...base, citedBy: 0 });
  assert.equal(s.recency, 0);
});

test('yili bilinmeyen makale Guncel profilinde 15 yillik makalenin USTUNE cikamaz', async () => {
  const [first] = await calculateAHP([
    { ...base, id: 'tarihsiz', citedBy: 0 },
    { ...base, id: '15-yillik', citedBy: 0, publicationYear: YEAR - 15, yearConfidence: 'high' },
  ], PROFILES.guncel.weights);
  assert.equal(first.id, '15-yillik');
});

test('yil yoksa atif sayisi YOK SAYILMAZ ama avantaj da saglamaz', async () => {
  const withoutYear = await score({ ...base, citedBy: 500 });
  const oldPaper = await score({ ...base, citedBy: 500, publicationYear: YEAR - 25, yearConfidence: 'high' });
  const newPaper = await score({ ...base, citedBy: 500, publicationYear: YEAR - 2, yearConfidence: 'high' });
  assert.ok(withoutYear.citation > 0, 'bilinen atif sayisi puan uretmeli');
  // Guncelligin 0 verdigi yasla ayni varsayim: 25 yillik makaleyle esit.
  assert.equal(withoutYear.citation, oldPaper.citation);
  assert.ok(withoutYear.citation < newPaper.citation, 'eksik yil yillik atifi sisirmemeli');
});

test('cok atifli tarihsiz makale yine de yukari cikabilir (kullanici karari)', async () => {
  const [first] = await calculateAHP([
    { ...base, id: 'tarihsiz-cok-atifli', citedBy: 20000 },
    { ...base, id: 'yeni-atifsiz', citedBy: 0, publicationYear: YEAR - 1, yearConfidence: 'high' },
  ]);
  assert.equal(first.id, 'tarihsiz-cok-atifli');
});

test('yayin/kaynak turu bilinmiyorsa kalite alt puanlari 0', async () => {
  const unknown = await score({ ...base, pubType: undefined, sourceType: undefined, doi: '' });
  assert.equal(unknown.quality, 0);
  const onlyDoi = await score({ ...base, pubType: undefined, sourceType: undefined });
  assert.equal(onlyDoi.quality, 0.05, 'yalnizca DOI bonusu kalir');
});

test('DOAJ yayin yili okunur (onceki surum her DOAJ makalesini yilsiz sayiyordu)', async () => {
  const { normalizePublicationDate } = await import('../utils/dateNormalization.js');
  const r = normalizePublicationDate({ publication_date: '2023-01', created_date: '2023-01-20T14:50:55Z' }, 'DOAJ');
  assert.equal(r.publicationYear, 2023);
  assert.ok(['high', 'medium'].includes(r.yearConfidence), 'AHP guven esigini gecmeli');
});

test('DOAJ yili yoksa UYDURULMAZ ve kayit tarihi yayin yili sayilmaz', async () => {
  const { normalizePublicationDate } = await import('../utils/dateNormalization.js');
  const r = normalizePublicationDate({ publication_date: null, created_date: '2021-05-01T00:00:00Z' }, 'DOAJ');
  assert.equal(r.publicationYear, null);
  assert.equal(r.yearConfidence, 'low');
});
